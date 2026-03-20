export const SEMANTIC_MODEL_ID = "Xenova/all-MiniLM-L6-v2";
export const SEMANTIC_CHUNKING_VERSION = "heading-paragraph-v1";
export const SEMANTIC_INDEX_HASH_TABLES = 8;
export const SEMANTIC_INDEX_RANDOM_SEED = 42;
export const CHUNK_TARGET_TOKENS = 120;
export const CHUNK_MIN_TOKENS = 80;
export const CHUNK_MAX_TOKENS = 180;
export const CHUNK_OVERLAP_PARAGRAPHS = 1;

export type SemanticModelInfo = {
  modelId: string;
  dimensions: number;
  chunkingVersion: string;
  pooling: "mean";
  normalized: true;
};

export type ArticleEmbeddingRecord = {
  docId: string;
  embedding: number[];
};

export type RelatedArticleRecord = {
  docId: string;
  neighbors: Array<{
    docId: string;
    score: number;
  }>;
};

export type ChunkEmbeddingRecord = {
  chunkId: string;
  docId: string;
  title: string;
  section: string;
  headingPath: string[];
  text: string;
  embedding: number[];
};

export type ChunkSourceRecord = Omit<ChunkEmbeddingRecord, "embedding">;

export type SemanticPayload = {
  model: SemanticModelInfo;
  articleEmbeddings: ArticleEmbeddingRecord[];
  relatedArticles: RelatedArticleRecord[];
  chunkEmbeddings: ChunkEmbeddingRecord[];
};

type SemanticDocSource = {
  id: string;
  title: string;
  section: string;
  summary: string;
  markdown: string;
  body: string;
};

type HeadingBlock = {
  headingPath: string[];
  markdown: string;
};

export function stripMarkdown(value: string): string {
  // Keep semantic text stable by removing markup that would add noise without
  // helping the model understand the actual content.
  return value
    .replace(/```[\w-]*\n[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[>*_~]/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createArticleSemanticText(doc: SemanticDocSource): string {
  // Whole-article embeddings support related-article suggestions, so include the
  // title, summary, and body to capture the page's overall topic.
  return [doc.title, doc.summary, doc.body].filter(Boolean).join("\n\n");
}

export function createChunkSourceRecords(doc: SemanticDocSource): ChunkSourceRecord[] {
  // Ask-the-docs works better on smaller topical chunks than on whole pages, so
  // split by headings first and then pack paragraphs into overlapping groups.
  const blocks = splitMarkdownIntoHeadingBlocks(doc.markdown);
  const chunks: ChunkSourceRecord[] = [];

  for (const block of blocks) {
    const paragraphs = block.markdown
      .split(/\n\s*\n/g)
      .map((paragraph) => stripMarkdown(paragraph))
      .filter(Boolean);

    if (paragraphs.length === 0) {
      continue;
    }

    splitParagraphsIntoGroups(paragraphs).forEach((text, index) => {
      chunks.push({
        chunkId: `${doc.id}::${serializeHeadingPath(block.headingPath)}::${index}`,
        docId: doc.id,
        title: doc.title,
        section: doc.section,
        headingPath: block.headingPath,
        text
      });
    });
  }

  if (chunks.length > 0) {
    return chunks;
  }

  return [{
    chunkId: `${doc.id}::intro::0`,
    docId: doc.id,
    title: doc.title,
    section: doc.section,
    headingPath: [],
    text: stripMarkdown(doc.markdown) || doc.summary || doc.title
  }];
}

export function createChunkSemanticText(chunk: ChunkSourceRecord): string {
  // Preserve document context in every chunk embedding by repeating the title
  // and heading path alongside the chunk text.
  return [chunk.title, ...chunk.headingPath, chunk.text].filter(Boolean).join("\n\n");
}

export function formatHeadingPath(headingPath: string[]): string {
  return headingPath.length > 0 ? headingPath.join(" / ") : "Introduction";
}

function splitMarkdownIntoHeadingBlocks(markdown: string): HeadingBlock[] {
  // Keep chunk boundaries aligned with visible sections so semantic matches map
  // back to the rendered documentation structure.
  const lines = markdown.split("\n");
  const blocks: HeadingBlock[] = [];
  let currentH2: string | null = null;
  let currentH3: string | null = null;
  let currentLines: string[] = [];
  let currentHeadingPath: string[] = [];

  const flush = () => {
    const text = currentLines.join("\n").trim();
    if (!text) {
      currentLines = [];
      return;
    }
    blocks.push({
      headingPath: [...currentHeadingPath],
      markdown: text
    });
    currentLines = [];
  };

  for (const line of lines) {
    if (/^#\s+/.test(line)) {
      continue;
    }

    if (/^##\s+/.test(line)) {
      flush();
      currentH2 = line.replace(/^##\s+/, "").trim();
      currentH3 = null;
      currentHeadingPath = currentH2 ? [currentH2] : [];
      continue;
    }

    if (/^###\s+/.test(line)) {
      flush();
      currentH3 = line.replace(/^###\s+/, "").trim();
      currentHeadingPath = [currentH2, currentH3].filter((value): value is string => Boolean(value));
      continue;
    }

    currentLines.push(line);
  }

  flush();

  return blocks;
}

function splitParagraphsIntoGroups(paragraphs: string[]): string[] {
  if (paragraphs.length === 0) {
    return [];
  }

  const groups: string[] = [];
  let start = 0;

  while (start < paragraphs.length) {
    let end = start;
    let tokenCount = 0;

    while (end < paragraphs.length) {
      const nextTokens = estimateTokenCount(paragraphs[end]!);
      const wouldExceedMax = tokenCount > 0 && tokenCount + nextTokens > CHUNK_MAX_TOKENS;
      if (wouldExceedMax && tokenCount >= CHUNK_MIN_TOKENS) {
        break;
      }

      tokenCount += nextTokens;
      end += 1;

      if (tokenCount >= CHUNK_TARGET_TOKENS) {
        break;
      }
    }

    if (end === start) {
      end += 1;
    }

    groups.push(paragraphs.slice(start, end).join("\n\n"));

    if (end >= paragraphs.length) {
      break;
    }

    // Small overlaps reduce the chance that a useful answer disappears exactly
    // at a chunk boundary.
    start = Math.max(end - CHUNK_OVERLAP_PARAGRAPHS, start + 1);
  }

  return groups;
}

function estimateTokenCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function serializeHeadingPath(headingPath: string[]): string {
  if (headingPath.length === 0) {
    return "intro";
  }
  return headingPath
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";
}
