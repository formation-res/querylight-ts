import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import {
  Analyzer,
  BoolQuery,
  DocumentIndex,
  EdgeNgramsTokenFilter,
  KeywordTokenizer,
  MatchAll,
  MatchPhrase,
  MatchQuery,
  NgramTokenFilter,
  OP,
  RankingAlgorithm,
  TermQuery,
  TextFieldIndex,
  VectorFieldIndex,
  bigramVector,
  createSeededRandom
} from "../packages/querylight/dist/index.js";

const DOCS_DIR = new URL("../docs/", import.meta.url);
const DOC_SECTION_ORDER = ["Overview", "Analysis", "Queries", "Discovery", "Ranking", "Indexing", "Advanced", "Operations"];
const SEARCH_INPUT_DEBOUNCE_MS = 150;

const tagAnalyzer = new Analyzer([], new KeywordTokenizer());
const fuzzyAnalyzer = new Analyzer(undefined, undefined, [new NgramTokenFilter(3)]);
const edgeAnalyzer = new Analyzer(undefined, undefined, [new EdgeNgramsTokenFilter(2, 6)]);
const vectorAnalyzer = new Analyzer();

const queries = [
  { label: "suggest:vector", query: "vector", mode: "hybrid", operation: OP.AND, prefix: false, ranking: RankingAlgorithm.BM25, tag: null, section: null, excludeAdvanced: false },
  { label: "suggest:range fi", query: "range fi", mode: "hybrid", operation: OP.AND, prefix: false, ranking: RankingAlgorithm.BM25, tag: null, section: null, excludeAdvanced: false },
  { label: "hybrid:api", query: "geo polygon", mode: "hybrid", operation: OP.AND, prefix: false, ranking: RankingAlgorithm.BM25, tag: null, section: null, excludeAdvanced: false },
  { label: "match:bm25", query: "bm25 ranking", mode: "match", operation: OP.AND, prefix: false, ranking: RankingAlgorithm.BM25, tag: null, section: null, excludeAdvanced: false },
  { label: "phrase:serialization", query: "\"index state serialization\"", mode: "phrase", operation: OP.AND, prefix: false, ranking: RankingAlgorithm.BM25, tag: null, section: null, excludeAdvanced: false },
  { label: "facet:querying", query: "query", mode: "hybrid", operation: OP.OR, prefix: true, ranking: RankingAlgorithm.BM25, tag: null, section: "Queries", excludeAdvanced: false },
  { label: "vector", query: "nearest neighbor embeddings", mode: "vector", operation: OP.AND, prefix: false, ranking: RankingAlgorithm.BM25, tag: null, section: null, excludeAdvanced: false },
  { label: "all:no-advanced", query: "", mode: "all", operation: OP.AND, prefix: false, ranking: RankingAlgorithm.BM25, tag: null, section: null, excludeAdvanced: true }
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripMarkdown(value) {
  return value
    .replace(/```[\w-]*\n([\s\S]*?)```/g, " $1 ")
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

function extractCodeBlocks(value) {
  return [...value.matchAll(/```[\w-]*\n([\s\S]*?)```/g)].map((match) => match[1]?.trim() ?? "").filter(Boolean);
}

function parseStringArray(value) {
  const normalized = value.trim().replace(/^\[/, "").replace(/\]$/, "");
  if (normalized.length === 0) {
    return [];
  }
  return normalized.split(",").map((item) => item.trim().replace(/^"(.*)"$/, "$1")).filter(Boolean);
}

function parseFrontmatter(raw) {
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

function toDocEntry(filePath, raw) {
  const { metadata, body: markdownBody } = parseFrontmatter(raw);
  return {
    id: metadata.id,
    section: metadata.section,
    title: metadata.title,
    summary: metadata.summary,
    tags: parseStringArray(metadata.tags ?? ""),
    apis: parseStringArray(metadata.apis ?? ""),
    level: metadata.level,
    order: metadata.order,
    markdown: markdownBody,
    body: stripMarkdown(markdownBody),
    examples: extractCodeBlocks(markdownBody),
    path: filePath
  };
}

async function loadDocs() {
  const filenames = (await fs.readdir(DOCS_DIR)).filter((file) => file.endsWith(".md")).sort();
  const docs = await Promise.all(
    filenames.map(async (filename) => {
      const filePath = new URL(filename, DOCS_DIR);
      const raw = await fs.readFile(filePath, "utf8");
      return toDocEntry(path.basename(filename), raw);
    })
  );
  return docs.sort((left, right) => left.order.localeCompare(right.order));
}

function toDocument(entry) {
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
      combined: [entry.title, entry.summary, entry.body, entry.tags.join(" "), entry.apis.join(" "), entry.examples.join(" ")].join(" "),
      suggest: [entry.title, entry.tags.join(" "), entry.apis.join(" ")].join(" "),
      order: [entry.order]
    }
  };
}

function createDocIndex(ranking) {
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

function createIndexes(docs, ranking) {
  const source = createDocIndex(ranking);
  const fuzzy = new DocumentIndex({
    combined: new TextFieldIndex(fuzzyAnalyzer, fuzzyAnalyzer, ranking)
  });
  const vector = new VectorFieldIndex(6, 36 * 36, createSeededRandom(42));

  for (const entry of docs) {
    const doc = toDocument(entry);
    source.index(doc);
    fuzzy.index({ id: entry.id, fields: { combined: [doc.fields.combined?.[0] ?? ""] } });
    vector.insert(entry.id, [bigramVector(doc.fields.combined?.[0] ?? "", vectorAnalyzer)]);
  }

  const serialized = JSON.parse(JSON.stringify(source.indexState));
  return {
    hydrated: createDocIndex(ranking).loadState(serialized),
    fuzzy,
    vector
  };
}

function createRuntimeContext(docs) {
  const sectionSet = new Set(docs.map((doc) => doc.section));
  return {
    docs,
    byId: new Map(docs.map((doc) => [doc.id, doc])),
    sections: DOC_SECTION_ORDER.filter((section) => sectionSet.has(section)).concat([...sectionSet].filter((section) => !DOC_SECTION_ORDER.includes(section))),
    indexes: {
      [RankingAlgorithm.BM25]: createIndexes(docs, RankingAlgorithm.BM25),
      [RankingAlgorithm.TFIDF]: createIndexes(docs, RankingAlgorithm.TFIDF)
    }
  };
}

function mergeHits(...groups) {
  const scores = new Map();
  groups.forEach((hits, index) => {
    const weight = Math.max(0.25, 1 - index * 0.2);
    hits.forEach(([id, score]) => {
      scores.set(id, (scores.get(id) ?? 0) + score * weight);
    });
  });
  return [...scores.entries()].sort((a, b) => b[1] - a[1]);
}

function rerankWithTitleBoost(context, rawQuery, hits) {
  const normalizedQuery = rawQuery.trim().toLowerCase();
  if (!normalizedQuery) {
    return hits;
  }

  const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);
  return hits
    .map(([id, score]) => {
      const title = context.byId.get(id)?.title.toLowerCase() ?? "";
      let boost = 0;
      if (title === normalizedQuery) boost += 12;
      if (title.startsWith(normalizedQuery)) boost += 8;
      if (title.includes(normalizedQuery)) boost += 6;
      if (queryTerms.every((term) => title.includes(term))) boost += 4;
      if (queryTerms.some((term) => title.startsWith(term))) boost += 2;
      return [id, score + boost];
    })
    .sort((a, b) => b[1] - a[1]);
}

function parseQueryInput(rawQuery) {
  const quotedPhrase = rawQuery.match(/"([^"]+)"/)?.[1] ?? null;
  return {
    queryText: rawQuery.replace(/"/g, "").trim(),
    quotedPhrase
  };
}

function buildFacetFilterQueries(current) {
  const filters = [];
  const mustNot = [];
  if (current.section) {
    filters.push(new TermQuery("section", current.section));
  }
  if (current.tag) {
    filters.push(new TermQuery("tags", current.tag));
  }
  if (current.excludeAdvanced) {
    mustNot.push(new TermQuery("level", "advanced"));
  }
  return { filters, mustNot };
}

function timeBlock(metrics, label, fn) {
  const start = performance.now();
  const value = fn();
  metrics[label] = (metrics[label] ?? 0) + (performance.now() - start);
  return value;
}

function profileSearchForState(context, current) {
  const metrics = {};
  const active = context.indexes[current.ranking];
  const index = active.hydrated;
  const bodyIndex = index.getFieldIndex("body");
  const tagIndex = index.getFieldIndex("tags");
  const sectionIndex = index.getFieldIndex("section");
  const apiIndex = index.getFieldIndex("api");
  const { queryText, quotedPhrase } = parseQueryInput(current.query);
  const trimmed = queryText.trim();
  const { filters, mustNot } = buildFacetFilterQueries(current);
  const filterOnlyQuery = filters.length > 0 || mustNot.length > 0 ? new BoolQuery([], [], filters, mustNot) : new MatchAll();

  const baseTextQuery =
    trimmed.length === 0
      ? new MatchAll()
      : new BoolQuery(
          [
            new MatchQuery("title", trimmed, current.operation, current.prefix, 7),
            new MatchQuery("tagline", trimmed, current.operation, current.prefix, 2.5),
            new MatchQuery("body", trimmed, current.operation, current.prefix, 2),
            new MatchQuery("api", trimmed, OP.OR, current.prefix, 2.75),
            new MatchQuery("tags", trimmed, OP.OR, current.prefix, 2.25),
            new MatchQuery("examples", trimmed, OP.OR, current.prefix, 1.5),
            new MatchQuery("suggest", trimmed, OP.OR, true, 1.25)
          ],
          [],
          filters,
          mustNot
        );

  const phraseQuery =
    trimmed.length === 0
      ? filterOnlyQuery
      : new BoolQuery(
          [
            new MatchPhrase("title", quotedPhrase ?? trimmed, 0, 8),
            new MatchPhrase("body", quotedPhrase ?? trimmed, 1, 3),
            new MatchPhrase("examples", quotedPhrase ?? trimmed, 1, 2)
          ],
          [],
          filters,
          mustNot
        );

  const fuzzyHits = trimmed.length === 0 ? [] : timeBlock(metrics, "fuzzy", () => active.fuzzy.searchRequest({
    query: new MatchQuery("combined", trimmed, OP.AND, false, 1.5),
    limit: 20
  }));

  const allowedIds =
    filters.length > 0 || mustNot.length > 0
      ? timeBlock(metrics, "filter_ids", () => index.searchRequest({ query: filterOnlyQuery }).map(([id]) => id))
      : undefined;

  const vectorHits =
    trimmed.length === 0
      ? []
      : timeBlock(metrics, "vector", () => active.vector.query(bigramVector(trimmed, vectorAnalyzer), 20, allowedIds));

  let lexicalHits;
  let finalHits;

  switch (current.mode) {
    case "all":
      lexicalHits = timeBlock(metrics, "lexical_all", () => index.searchRequest({ query: filterOnlyQuery }));
      finalHits = lexicalHits;
      break;
    case "phrase":
      lexicalHits = timeBlock(metrics, "phrase_query", () => index.searchRequest({ query: phraseQuery, limit: 20 }));
      finalHits = lexicalHits;
      break;
    case "fuzzy":
      lexicalHits = [];
      finalHits = fuzzyHits;
      break;
    case "vector":
      lexicalHits = [];
      finalHits = vectorHits;
      break;
    case "match":
      lexicalHits = timeBlock(metrics, "lexical_match", () => index.searchRequest({ query: baseTextQuery, limit: 20 }));
      finalHits = timeBlock(metrics, "rerank", () => rerankWithTitleBoost(context, trimmed, lexicalHits));
      break;
    case "hybrid":
    default: {
      lexicalHits = timeBlock(metrics, "lexical_hybrid", () => index.searchRequest({ query: baseTextQuery, limit: 20 }));
      finalHits =
        trimmed.length === 0
          ? lexicalHits
          : timeBlock(metrics, "hybrid_merge", () =>
              rerankWithTitleBoost(
                context,
                trimmed,
                mergeHits(
                  timeBlock(metrics, "phrase_hybrid", () => index.searchRequest({ query: phraseQuery, limit: 10 })),
                  lexicalHits,
                  fuzzyHits,
                  vectorHits
                )
              )
            );
      break;
    }
  }

  const selectedIds = new Set(finalHits.map(([id]) => id));
  const aggregationSubset = selectedIds.size > 0 ? selectedIds : undefined;
  const significantSubset = selectedIds.size > 0 ? selectedIds : new Set(context.docs.map((doc) => doc.id));

  const tagFacets = timeBlock(metrics, "facets_tag", () => tagIndex.termsAggregation(12, aggregationSubset));
  const sectionFacets = timeBlock(metrics, "facets_section", () => sectionIndex.termsAggregation(8, aggregationSubset));
  const apiFacets = timeBlock(metrics, "facets_api", () => apiIndex.termsAggregation(10, aggregationSubset));
  const significantTerms = timeBlock(metrics, "significant_terms", () => bodyIndex.getTopSignificantTerms(10, significantSubset));

  return {
    metrics,
    result: {
      lexicalHits,
      fuzzyHits,
      vectorHits,
      finalHits,
      tagFacets,
      sectionFacets,
      apiFacets,
      significantTerms
    }
  };
}

function summarizeRuns(label, runs) {
  const totals = new Map();
  for (const run of runs) {
    for (const [name, value] of Object.entries(run.metrics)) {
      totals.set(name, [...(totals.get(name) ?? []), value]);
    }
  }
  const totalTimes = runs.map((run) => Object.values(run.metrics).reduce((sum, value) => sum + value, 0));
  const avgTotal = totalTimes.reduce((sum, value) => sum + value, 0) / totalTimes.length;
  const maxTotal = Math.max(...totalTimes);
  const rows = [...totals.entries()]
    .map(([name, values]) => {
      const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
      return { name, avg, pct: avgTotal === 0 ? 0 : (avg / avgTotal) * 100 };
    })
    .sort((left, right) => right.avg - left.avg);

  console.log(`\n${label}`);
  console.log(`  avg total: ${avgTotal.toFixed(3)} ms`);
  console.log(`  max total: ${maxTotal.toFixed(3)} ms`);
  console.log(`  budget share vs ${SEARCH_INPUT_DEBOUNCE_MS}ms debounce: ${(avgTotal / SEARCH_INPUT_DEBOUNCE_MS * 100).toFixed(1)}%`);
  for (const row of rows) {
    console.log(`  ${row.name.padEnd(18)} ${row.avg.toFixed(3).padStart(8)} ms  ${row.pct.toFixed(1).padStart(5)}%`);
  }
}

async function main() {
  const docsStart = performance.now();
  const docs = await loadDocs();
  const docsMs = performance.now() - docsStart;

  const indexStart = performance.now();
  const context = createRuntimeContext(docs);
  const indexMs = performance.now() - indexStart;

  console.log(`Loaded ${docs.length} docs in ${docsMs.toFixed(3)} ms`);
  console.log(`Built BM25 + TFIDF runtime indexes in ${indexMs.toFixed(3)} ms`);

  for (const query of queries) {
    const warmups = [];
    for (let i = 0; i < 20; i += 1) {
      warmups.push(profileSearchForState(context, query));
    }

    const runs = [];
    for (let i = 0; i < 100; i += 1) {
      runs.push(profileSearchForState(context, query));
    }
    summarizeRuns(query.label, runs);

    const sample = runs[0]?.result.finalHits.slice(0, 3).map(([id]) => id).join(", ") ?? "";
    console.log(`  top hits: ${sample || "(none)"}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
