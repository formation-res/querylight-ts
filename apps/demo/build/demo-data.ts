import fs from "node:fs";
import path from "node:path";
import { pipeline, env, type FeatureExtractionPipeline } from "@huggingface/transformers";
import {
  Analyzer,
  NumericFieldIndex,
  DocumentIndex,
  EdgeNgramsTokenFilter,
  KeywordTokenizer,
  NgramTokenFilter,
  RankingAlgorithm,
  TextFieldIndex,
  bigramVector,
  type Document,
  type DocumentIndexState
} from "../../../packages/querylight/src/index";
import {
  SEMANTIC_CHUNKING_VERSION,
  SEMANTIC_MODEL_ID,
  createArticleSemanticText,
  createChunkSemanticText,
  createChunkSourceRecords,
  stripMarkdown,
  type ArticleEmbeddingRecord,
  type ChunkEmbeddingRecord,
  type RelatedArticleRecord,
  type SemanticPayload
} from "../src/semantic";
import { buildApiDocEntries } from "./api-docs";

export type DocEntry = {
  id: string;
  section: string;
  title: string;
  summary: string;
  tags: string[];
  apis: string[];
  level: "foundation" | "querying" | "indexing" | "advanced";
  order: number;
  markdown: string;
  body: string;
  wordCount: number;
  examples: string[];
  path: string;
};

export type SerializedRuntimeIndexes = {
  hydrated: DocumentIndexState;
  fuzzy: DocumentIndexState;
  vectorEmbeddings: Record<string, number[]>;
};

export type DemoDataPayload = {
  docs: DocEntry[];
  indexes: Record<RankingAlgorithm, SerializedRuntimeIndexes>;
  semantic: SemanticPayload;
};

const tagAnalyzer = new Analyzer([], new KeywordTokenizer());
const fuzzyAnalyzer = new Analyzer(undefined, undefined, [new NgramTokenFilter(3)]);
const edgeAnalyzer = new Analyzer(undefined, undefined, [new EdgeNgramsTokenFilter(2, 6)]);
const vectorAnalyzer = new Analyzer();

env.allowLocalModels = true;

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

function extractCodeBlocks(value: string): string[] {
  return [...value.matchAll(/```[\w-]*\n([\s\S]*?)```/g)].map((match) => match[1]?.trim() ?? "").filter(Boolean);
}

function parseStringArray(value: string): string[] {
  const normalized = value.trim().replace(/^\[/, "").replace(/\]$/, "");
  if (normalized.length === 0) {
    return [];
  }
  return normalized.split(",").map((item) => item.trim().replace(/^"(.*)"$/, "$1")).filter(Boolean);
}

function parseFrontmatter(raw: string): { metadata: Record<string, string>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    throw new Error("markdown file is missing frontmatter");
  }
  const metadata = Object.fromEntries(
    match[1]
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf(":");
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim();
        return [key, value.replace(/^"(.*)"$/, "$1")];
      })
  );
  return { metadata, body: match[2].trim() };
}

function toDocEntry(filePath: string, raw: string): DocEntry {
  const { metadata, body: markdownBody } = parseFrontmatter(raw);
  const body = stripMarkdown(markdownBody);
  const title = metadata.title;
  const summary = metadata.summary;
  const id = metadata.id;
  const section = metadata.section;
  const level = metadata.level as DocEntry["level"];
  const order = Number(metadata.order);

  if (!title || !summary || !id || !section || !level || Number.isNaN(order)) {
    throw new Error(`invalid doc metadata in ${filePath}`);
  }

  return {
    id,
    section,
    title,
    summary,
    tags: parseStringArray(metadata.tags ?? ""),
    apis: parseStringArray(metadata.apis ?? ""),
    level,
    order,
    markdown: markdownBody,
    body,
    wordCount: body.split(/\s+/).filter(Boolean).length,
    examples: extractCodeBlocks(markdownBody),
    path: filePath
  };
}

function collectMarkdownFiles(dirPath: string): string[] {
  return fs.readdirSync(dirPath, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      return collectMarkdownFiles(fullPath);
    }
    return entry.isFile() && entry.name.endsWith(".md") ? [fullPath] : [];
  });
}

function toDocument(entry: DocEntry): Document {
  // Keep metadata in dedicated fields so the demo can mix free-text search,
  // facets, suggestions, and API/tag navigation from one index payload.
  return {
    id: entry.id,
    fields: {
      title: [entry.title],
      tagline: [entry.summary],
      body: [entry.body],
      section: [entry.section],
      level: [entry.level],
      tags: entry.tags,
      api: entry.apis,
      examples: entry.examples,
      wordCount: [String(entry.wordCount)],
      combined: [entry.title, entry.summary, entry.body, entry.tags.join(" "), entry.apis.join(" ")].join(" "),
      suggest: [entry.title, entry.tags.join(" "), entry.apis.join(" ")].join(" "),
      order: [String(entry.order)]
    }
  };
}

function createDocIndex(ranking: RankingAlgorithm): DocumentIndex {
  return new DocumentIndex({
    title: new TextFieldIndex(undefined, undefined, ranking),
    tagline: new TextFieldIndex(undefined, undefined, ranking),
    body: new TextFieldIndex(undefined, undefined, ranking),
    section: new TextFieldIndex(tagAnalyzer, tagAnalyzer),
    level: new TextFieldIndex(tagAnalyzer, tagAnalyzer),
    tags: new TextFieldIndex(tagAnalyzer, tagAnalyzer),
    api: new TextFieldIndex(tagAnalyzer, tagAnalyzer),
    examples: new TextFieldIndex(undefined, undefined, ranking),
    wordCount: new NumericFieldIndex(),
    combined: new TextFieldIndex(undefined, undefined, ranking),
    suggest: new TextFieldIndex(edgeAnalyzer, edgeAnalyzer, ranking),
    order: new TextFieldIndex(tagAnalyzer, tagAnalyzer)
  });
}

function createSerializedIndexes(docs: DocEntry[], ranking: RankingAlgorithm): SerializedRuntimeIndexes {
  // Build two lexical views of the same corpus:
  // - a fielded index for the main search UI
  // - an ngram index for typo recovery and reciprocal-rank fusion
  const source = createDocIndex(ranking);
  const fuzzy = new DocumentIndex({
    combined: new TextFieldIndex(fuzzyAnalyzer, fuzzyAnalyzer, ranking)
  });
  const vectorEmbeddings: Record<string, number[]> = {};

  docs.forEach((entry) => {
    const doc = toDocument(entry);
    source.index(doc);
    fuzzy.index({ id: entry.id, fields: { combined: [doc.fields.combined?.[0] ?? ""] } });
    vectorEmbeddings[entry.id] = bigramVector(doc.fields.combined?.[0] ?? "", vectorAnalyzer);
  });

  return {
    hydrated: JSON.parse(JSON.stringify(source.indexState)) as DocumentIndexState,
    fuzzy: JSON.parse(JSON.stringify(fuzzy.indexState)) as DocumentIndexState,
    vectorEmbeddings
  };
}

async function getEmbeddingExtractor(): Promise<FeatureExtractionPipeline> {
  extractorPromise ??= pipeline("feature-extraction", SEMANTIC_MODEL_ID);
  return extractorPromise;
}

async function embedText(value: string): Promise<number[]> {
  // Use normalized mean-pooled embeddings so cosine similarity is directly
  // usable both for offline relatedness and runtime question matching.
  const extractor = await getEmbeddingExtractor();
  const output = await extractor(value, { pooling: "mean", normalize: true });
  return output.tolist()[0] as number[];
}

async function createSemanticPayload(docs: DocEntry[]): Promise<SemanticPayload> {
  // Precompute the full semantic corpus at build time so the deployed demo only
  // needs to embed the user's query in the browser.
  const articleEmbeddings: ArticleEmbeddingRecord[] = [];
  const chunkEmbeddings: ChunkEmbeddingRecord[] = [];
  let dimensions = 0;

  for (const doc of docs) {
    const articleEmbedding = await embedText(createArticleSemanticText(doc));
    dimensions ||= articleEmbedding.length;
    articleEmbeddings.push({
      docId: doc.id,
      embedding: articleEmbedding
    });

    const chunks = createChunkSourceRecords(doc);
    for (const chunk of chunks) {
      // Chunk-level embeddings power Ask-the-docs because paragraph-sized
      // matches are more precise than whole-page matches.
      const embedding = await embedText(createChunkSemanticText(chunk));
      dimensions ||= embedding.length;
      chunkEmbeddings.push({
        ...chunk,
        embedding
      });
    }
  }

  const relatedArticles = createRelatedArticleRecords(articleEmbeddings);

  return {
    model: {
      modelId: SEMANTIC_MODEL_ID,
      dimensions,
      chunkingVersion: SEMANTIC_CHUNKING_VERSION,
      pooling: "mean",
      normalized: true
    },
    articleEmbeddings,
    relatedArticles,
    chunkEmbeddings
  };
}

function createRelatedArticleRecords(articleEmbeddings: ArticleEmbeddingRecord[]): RelatedArticleRecord[] {
  // Related article cards are computed offline from whole-page embeddings to
  // keep the browser runtime simple and deterministic.
  return articleEmbeddings.map((source) => ({
    docId: source.docId,
    neighbors: articleEmbeddings
      .filter((candidate) => candidate.docId !== source.docId)
      .map((candidate) => ({
        docId: candidate.docId,
        score: cosineSimilarity(source.embedding, candidate.embedding)
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 2)
  }));
}

function cosineSimilarity(left: number[], right: number[]): number {
  let dotProduct = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dotProduct += leftValue * rightValue;
    leftNorm += leftValue * leftValue;
    rightNorm += rightValue * rightValue;
  }

  return dotProduct / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

export async function buildDemoDataPayload(rootDir: string): Promise<DemoDataPayload> {
  const docsDir = path.resolve(rootDir, "docs");
  const sourceDocs = collectMarkdownFiles(docsDir)
    .map((fullPath) => {
      const raw = fs.readFileSync(fullPath, "utf8");
      return toDocEntry(path.posix.join("docs", path.relative(docsDir, fullPath).split(path.sep).join("/")), raw);
    })
    .sort((left, right) => left.order - right.order || left.title.localeCompare(right.title));
  const apiDocs = await buildApiDocEntries(rootDir);
  const docs = [...sourceDocs, ...apiDocs]
    .sort((left, right) => left.section.localeCompare(right.section) || left.order - right.order || left.title.localeCompare(right.title));

  const semantic = await createSemanticPayload(sourceDocs);

  return {
    docs,
    indexes: {
      [RankingAlgorithm.BM25]: createSerializedIndexes(docs, RankingAlgorithm.BM25),
      [RankingAlgorithm.TFIDF]: createSerializedIndexes(docs, RankingAlgorithm.TFIDF)
    },
    semantic
  };
}

export async function writeDemoDataFile(rootDir: string, outputPath: string): Promise<void> {
  // Vite calls this in dev and production builds so markdown edits refresh both
  // lexical indexes and semantic embeddings together.
  const payload = await buildDemoDataPayload(rootDir);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload), "utf8");
}
