import fs from "node:fs";
import path from "node:path";
import {
  Analyzer,
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

export type DocEntry = {
  id: string;
  section: string;
  title: string;
  summary: string;
  tags: string[];
  apis: string[];
  level: "foundation" | "querying" | "indexing" | "advanced";
  order: string;
  markdown: string;
  body: string;
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
};

const tagAnalyzer = new Analyzer([], new KeywordTokenizer());
const fuzzyAnalyzer = new Analyzer(undefined, undefined, [new NgramTokenFilter(3)]);
const edgeAnalyzer = new Analyzer(undefined, undefined, [new EdgeNgramsTokenFilter(2, 6)]);
const vectorAnalyzer = new Analyzer();

function stripMarkdown(value: string): string {
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
  const title = metadata.title;
  const summary = metadata.summary;
  const id = metadata.id;
  const section = metadata.section;
  const level = metadata.level as DocEntry["level"];
  const order = metadata.order;

  if (!title || !summary || !id || !section || !level || !order) {
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
    body: stripMarkdown(markdownBody),
    examples: extractCodeBlocks(markdownBody),
    path: filePath
  };
}

function toDocument(entry: DocEntry): Document {
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
      combined: [entry.title, entry.summary, entry.body, entry.tags.join(" "), entry.apis.join(" ")].join(" "),
      suggest: [entry.title, entry.tags.join(" "), entry.apis.join(" ")].join(" "),
      order: [entry.order]
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
    combined: new TextFieldIndex(undefined, undefined, ranking),
    suggest: new TextFieldIndex(edgeAnalyzer, edgeAnalyzer, ranking),
    order: new TextFieldIndex(tagAnalyzer, tagAnalyzer)
  });
}

function createSerializedIndexes(docs: DocEntry[], ranking: RankingAlgorithm): SerializedRuntimeIndexes {
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

export function buildDemoDataPayload(rootDir: string): DemoDataPayload {
  const docsDir = path.resolve(rootDir, "docs");
  const docs = fs
    .readdirSync(docsDir)
    .filter((filename) => filename.endsWith(".md"))
    .map((filename) => {
      const fullPath = path.join(docsDir, filename);
      const raw = fs.readFileSync(fullPath, "utf8");
      return toDocEntry(path.posix.join("docs", filename), raw);
    })
    .sort((left, right) => left.order.localeCompare(right.order));

  return {
    docs,
    indexes: {
      [RankingAlgorithm.BM25]: createSerializedIndexes(docs, RankingAlgorithm.BM25),
      [RankingAlgorithm.TFIDF]: createSerializedIndexes(docs, RankingAlgorithm.TFIDF)
    }
  };
}

export function writeDemoDataFile(rootDir: string, outputPath: string): void {
  const payload = buildDemoDataPayload(rootDir);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}
