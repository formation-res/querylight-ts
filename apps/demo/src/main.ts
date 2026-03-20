import "./styles.css";
import "highlight.js/styles/github.css";
import {
  Analyzer,
  BoolQuery,
  DocumentIndex,
  type DocumentIndexState,
  EdgeNgramsTokenFilter,
  KeywordTokenizer,
  MatchAll,
  MatchPhrase,
  MatchQuery,
  NgramTokenFilter,
  OP,
  RangeQuery,
  RankingAlgorithm,
  reciprocalRankFusion,
  TermQuery,
  TextFieldIndex,
  VectorFieldIndex,
  createSeededRandom,
  type HighlightFragment,
  type HighlightResult,
  type Hits
} from "@tryformation/querylight-ts";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import typescript from "highlight.js/lib/languages/typescript";
import MarkdownIt from "markdown-it";
import demoDataUrl from "./generated/demo-data.json?url";
import packageMeta from "../../../packages/querylight/package.json";
import {
  SEMANTIC_INDEX_HASH_TABLES,
  SEMANTIC_INDEX_RANDOM_SEED,
  formatHeadingPath,
  serializeHeadingPath,
  type ChunkEmbeddingRecord,
  type RelatedArticleRecord,
  type SemanticModelInfo,
  type SemanticPayload
} from "./semantic";

declare const __BUILD_TIMESTAMP__: string;

type SearchMode = "hybrid" | "match" | "phrase" | "fuzzy";
type QueryExperience = "search" | "ask";

type DocEntry = {
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

type SearchState = {
  query: string;
  mode: SearchMode;
  operation: OP;
  prefix: boolean;
  ranking: RankingAlgorithm;
  tag: string | null;
  section: string | null;
  excludeAdvanced: boolean;
};

type SearchResult = {
  lexicalHits: Hits;
  fuzzyHits: Hits;
  vectorHits: Hits;
  finalHits: Hits;
  highlightsById: Map<string, HighlightResult>;
  selectedIds: Set<string>;
  tagFacets: Record<string, number>;
  sectionFacets: Record<string, number>;
  apiFacets: Record<string, number>;
  significantTerms: Record<string, [number, number]>;
};

type RuntimeIndexes = {
  hydrated: DocumentIndex;
  fuzzy: DocumentIndex;
};

type DemoDataPayload = {
  docs: DocEntry[];
  indexes: Record<
    RankingAlgorithm,
    {
      hydrated: DocumentIndexState;
      fuzzy: DocumentIndexState;
    }
  >;
  semantic: SemanticPayload;
};

type RuntimeContext = {
  docs: DocEntry[];
  byId: Map<string, DocEntry>;
  sections: string[];
  allTags: string[];
  renderedMarkdown: Map<string, string>;
  indexes: Record<RankingAlgorithm, RuntimeIndexes>;
  semantic: SemanticRuntime;
};

type NavSection = {
  name: string;
  docs: DocEntry[];
};

type ChunkHitViewModel = {
  chunk: ChunkEmbeddingRecord;
  doc: DocEntry;
  score: number;
};

type RelatedArticleViewModel = {
  doc: DocEntry;
  score: number;
};

type SemanticRuntime = {
  model: SemanticModelInfo;
  chunkIndex: VectorFieldIndex;
  relatedArticlesByDocId: Map<string, RelatedArticleRecord>;
  chunkEmbeddingsById: Map<string, ChunkEmbeddingRecord>;
};

type SemanticQuestionState = {
  query: string;
  status: "idle" | "loading-model" | "searching" | "ready" | "error";
  results: ChunkHitViewModel[];
  error: string | null;
};

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("App root not found");
}

hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
  highlight(code, language) {
    if (language && hljs.getLanguage(language)) {
      return `<pre class="hljs"><code>${hljs.highlight(code, { language }).value}</code></pre>`;
    }
    return `<pre class="hljs"><code>${hljs.highlightAuto(code).value}</code></pre>`;
  }
});

markdown.core.ruler.push("querylight_heading_anchors", (state) => {
  let currentH2: string | null = null;
  let currentH3: string | null = null;

  state.tokens.forEach((token, index) => {
    if (token.type !== "heading_open") {
      return;
    }

    const inlineToken = state.tokens[index + 1];
    const headingText = inlineToken?.type === "inline" ? inlineToken.content.trim() : "";
    if (!headingText) {
      return;
    }

    if (token.tag === "h2") {
      currentH2 = headingText;
      currentH3 = null;
      token.attrSet("id", chunkAnchorDomId(serializeHeadingPath([headingText])));
      return;
    }

    if (token.tag === "h3") {
      currentH3 = headingText;
      token.attrSet("id", chunkAnchorDomId(serializeHeadingPath([currentH2, currentH3].filter((value): value is string => Boolean(value)))));
    }
  });
});

const tagAnalyzer = new Analyzer([], new KeywordTokenizer());
const fuzzyAnalyzer = new Analyzer(undefined, undefined, [new NgramTokenFilter(3)]);
const edgeAnalyzer = new Analyzer(undefined, undefined, [new EdgeNgramsTokenFilter(2, 6)]);
const SEARCH_INPUT_DEBOUNCE_MS = 150;
const DOC_SECTION_ORDER = ["Overview", "Analysis", "Queries", "Discovery", "Ranking", "Indexing", "Advanced", "Operations"];
const PACKAGE_NAME = packageMeta.name;
const PACKAGE_VERSION = packageMeta.version;
const REPOSITORY_URL = packageMeta.repository.url.replace(/^git\+/, "").replace(/\.git$/, "");
const NPM_PACKAGE_URL = `https://www.npmjs.com/package/${encodeURIComponent(PACKAGE_NAME)}`;
const NPM_BADGE_URL = `https://img.shields.io/npm/v/${encodeURIComponent(PACKAGE_NAME)}?label=npm&color=cb3837`;
const BUILD_TIMESTAMP = __BUILD_TIMESTAMP__;
const GITHUB_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true" class="size-4 fill-current">
    <path d="M12 0.5C5.37 0.5 0 5.87 0 12.5c0 5.3 3.44 9.79 8.21 11.38.6.11.82-.26.82-.58 0-.29-.01-1.05-.02-2.06-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.74.08-.74 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49.99.11-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.4 11.4 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.25 2.87.12 3.17.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.82 1.1.82 2.23 0 1.61-.01 2.91-.01 3.31 0 .32.21.7.83.58A12 12 0 0 0 24 12.5C24 5.87 18.63 0.5 12 0.5Z"/>
  </svg>
`;

const initialState: SearchState = {
  query: "",
  mode: "hybrid",
  operation: OP.OR,
  prefix: false,
  ranking: RankingAlgorithm.BM25,
  tag: null,
  section: null,
  excludeAdvanced: false
};

let state: SearchState = { ...initialState };
let activeDocId = "";
let activeChunkId: string | null = null;
let currentView: "home" | "results" | "detail" | "ask" = "home";
let activeExperience: QueryExperience = "search";
let submittedResult: SearchResult | null = null;
let suggestionResult: SearchResult | null = null;
let semanticQuestionState: SemanticQuestionState = {
  query: "",
  status: "idle",
  results: [],
  error: null
};

function renderLoading(message: string): void {
  app.innerHTML = `
    <main class="mx-auto min-h-screen w-[min(1200px,calc(100vw-32px))] px-0 py-8">
      <section class="surface p-8">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Querylight Demo</p>
        <h1 class="mt-3 font-serif text-5xl leading-none text-stone-950">Loading documentation</h1>
        <p class="mt-4 max-w-2xl text-base text-stone-600">${message}</p>
      </section>
    </main>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function chunkAnchorDomId(anchor: string): string {
  return `chunk-anchor-${anchor}`;
}

function chunkTargetDomId(chunkId: string): string {
  return `chunk-target-${encodeURIComponent(chunkId)}`;
}

function getChunkAnchor(chunk: ChunkEmbeddingRecord): string {
  return serializeHeadingPath(chunk.headingPath);
}

function buildDetailHash(docId: string, chunkId?: string | null): string {
  const params = new URLSearchParams({ doc: docId });
  if (chunkId) {
    params.set("chunk", chunkId);
  }
  return `#${params.toString()}`;
}

function updateDetailHash(docId: string, chunkId?: string | null): void {
  const url = new URL(window.location.href);
  const nextHash = buildDetailHash(docId, chunkId);
  if (url.hash === nextHash) {
    return;
  }
  url.hash = nextHash;
  window.history.replaceState(null, "", url);
}

function clearDetailHash(): void {
  const url = new URL(window.location.href);
  if (!url.hash) {
    return;
  }
  url.hash = "";
  window.history.replaceState(null, "", url);
}

function parseDetailHash(): { docId: string; chunkId: string | null } | null {
  const rawHash = window.location.hash.replace(/^#/, "");
  if (!rawHash) {
    return null;
  }
  const params = new URLSearchParams(rawHash);
  const docId = params.get("doc");
  if (!docId) {
    return null;
  }
  return {
    docId,
    chunkId: params.get("chunk")
  };
}

function formatRelativeBuildTime(timestamp: string): string {
  const builtAt = new Date(timestamp).getTime();
  if (!Number.isFinite(builtAt)) {
    return "Built recently";
  }

  const diffMinutes = Math.round((builtAt - Date.now()) / 60000);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return `Built ${formatter.format(diffMinutes, "minute")}`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return `Built ${formatter.format(diffHours, "hour")}`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `Built ${formatter.format(diffDays, "day")}`;
}

function renderHighlightFragment(fragment: HighlightFragment): string {
  return fragment.parts
    .map((part) => part.highlighted ? `<mark class="search-highlight">${escapeHtml(part.text)}</mark>` : escapeHtml(part.text))
    .join("");
}

function renderLiteralHighlight(text: string, query: string): string {
  const trimmed = query.trim();
  if (!trimmed) {
    return escapeHtml(text);
  }
  const pattern = new RegExp(`(${escapeRegExp(trimmed)})`, "ig");
  const parts = text.split(pattern);
  if (parts.length === 1) {
    return escapeHtml(text);
  }
  return parts
    .map((part, index) => index % 2 === 1 ? `<mark class="search-highlight">${escapeHtml(part)}</mark>` : escapeHtml(part))
    .join("");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fieldHighlight(highlight: HighlightResult | undefined, field: string): HighlightFragment | null {
  return highlight?.fields.find((result) => result.field === field)?.fragments[0] ?? null;
}

function bestExplanation(highlight: HighlightResult | undefined): { label: string; html: string } | null {
  const tagline = fieldHighlight(highlight, "tagline");
  if (tagline) {
    return { label: "Summary", html: renderHighlightFragment(tagline) };
  }
  const body = fieldHighlight(highlight, "body");
  if (body) {
    return { label: "Excerpt", html: renderHighlightFragment(body) };
  }
  return null;
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

function loadSerializedIndexes(
  ranking: RankingAlgorithm,
  serializedIndexes: {
    hydrated: DocumentIndexState;
    fuzzy: DocumentIndexState;
  }
): RuntimeIndexes {
  return {
    hydrated: createDocIndex(ranking).loadState(serializedIndexes.hydrated),
    fuzzy: new DocumentIndex({
      combined: new TextFieldIndex(fuzzyAnalyzer, fuzzyAnalyzer, ranking)
    }).loadState(serializedIndexes.fuzzy)
  };
}

function createVectorIndex(dimensions: number): VectorFieldIndex {
  return new VectorFieldIndex(SEMANTIC_INDEX_HASH_TABLES, dimensions, createSeededRandom(SEMANTIC_INDEX_RANDOM_SEED));
}

function createSemanticRuntime(semanticPayload: SemanticPayload): SemanticRuntime {
  // Load the precomputed chunk embeddings into an ANN index once at startup so
  // Ask-the-docs queries only need to embed the user's question.
  const chunkIndex = createVectorIndex(semanticPayload.model.dimensions);

  semanticPayload.chunkEmbeddings.forEach((record) => {
    chunkIndex.insert(record.chunkId, [record.embedding]);
  });

  return {
    model: semanticPayload.model,
    chunkIndex,
    relatedArticlesByDocId: new Map(semanticPayload.relatedArticles.map((record) => [record.docId, record])),
    chunkEmbeddingsById: new Map(semanticPayload.chunkEmbeddings.map((record) => [record.chunkId, record]))
  };
}

function createRuntimeContext(demoData: DemoDataPayload): RuntimeContext {
  const docs = demoData.docs;
  const sectionSet = new Set(docs.map((doc) => doc.section));
  const sections = DOC_SECTION_ORDER.filter((section) => sectionSet.has(section)).concat(
    [...sectionSet].filter((section) => !DOC_SECTION_ORDER.includes(section))
  );

  return {
    docs,
    byId: new Map(docs.map((doc) => [doc.id, doc])),
    sections,
    allTags: [...new Set(docs.flatMap((doc) => doc.tags))].sort(),
    renderedMarkdown: new Map(),
    indexes: {
      [RankingAlgorithm.BM25]: loadSerializedIndexes(RankingAlgorithm.BM25, demoData.indexes[RankingAlgorithm.BM25]),
      [RankingAlgorithm.TFIDF]: loadSerializedIndexes(RankingAlgorithm.TFIDF, demoData.indexes[RankingAlgorithm.TFIDF])
    },
    semantic: createSemanticRuntime(demoData.semantic)
  };
}

function createNavSections(context: RuntimeContext): NavSection[] {
  return context.sections
    .map((section) => ({
      name: section,
      docs: context.docs.filter((doc) => doc.section === section)
    }))
    .filter((section) => section.docs.length > 0);
}

let browserEmbeddingExtractorPromise: Promise<(value: string) => Promise<number[]>> | null = null;

async function embedSemanticQuery(value: string, modelId: string): Promise<number[]> {
  // Lazy-load the browser model so the normal lexical search experience does not
  // pay the transformer startup cost unless the user opens Ask the Docs.
  browserEmbeddingExtractorPromise ??= (async () => {
    const { pipeline } = await import("@huggingface/transformers");
    const extractor = await pipeline("feature-extraction", modelId);
    return async (input: string) => {
      const output = await extractor(input, { pooling: "mean", normalize: true });
      return output.tolist()[0] as number[];
    };
  })();

  try {
    const extractor = await browserEmbeddingExtractorPromise;
    return extractor(value);
  } catch (error) {
    browserEmbeddingExtractorPromise = null;
    throw error;
  }
}

function getRelatedArticles(context: RuntimeContext, doc: DocEntry): RelatedArticleViewModel[] {
  const relatedRecord = context.semantic.relatedArticlesByDocId.get(doc.id);
  if (!relatedRecord) {
    return [];
  }

  return relatedRecord.neighbors
    .map((neighbor) => {
      const relatedDoc = context.byId.get(neighbor.docId);
      return relatedDoc ? { doc: relatedDoc, score: neighbor.score } : null;
    })
    .filter((value): value is RelatedArticleViewModel => value !== null);
}

function getSemanticQuestionResults(context: RuntimeContext, queryVector: number[], limit = 4): ChunkHitViewModel[] {
  // Retrieve more than the final limit and then collapse to one hit per
  // document so the answer list is diverse instead of dominated by one page.
  const byDocId = new Map<string, ChunkHitViewModel>();

  context.semantic.chunkIndex
    .query(queryVector, limit * 4)
    .forEach(([chunkId, score]) => {
      const chunk = context.semantic.chunkEmbeddingsById.get(chunkId);
      const doc = chunk ? context.byId.get(chunk.docId) : null;
      if (!chunk || !doc || byDocId.has(doc.id)) {
        return;
      }
      byDocId.set(doc.id, { chunk, doc, score });
    });

  return [...byDocId.values()].slice(0, limit);
}

function rerankWithTitleBoost(context: RuntimeContext, rawQuery: string, hits: Hits): Hits {
  const normalizedQuery = rawQuery.trim().toLowerCase();
  if (!normalizedQuery) {
    return hits;
  }

  const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);
  return hits
    .map(([id, score]) => {
      const title = context.byId.get(id)?.title.toLowerCase() ?? "";
      let boost = 0;

      if (title === normalizedQuery) {
        boost += 12;
      }
      if (title.startsWith(normalizedQuery)) {
        boost += 8;
      }
      if (title.includes(normalizedQuery)) {
        boost += 6;
      }
      if (queryTerms.every((term) => title.includes(term))) {
        boost += 4;
      }
      if (queryTerms.some((term) => title.startsWith(term))) {
        boost += 2;
      }

      return [id, score + boost] as const;
    })
    .sort((a, b) => b[1] - a[1]);
}

function parseQueryInput(rawQuery: string): { queryText: string; quotedPhrase: string | null } {
  const quotedPhrase = rawQuery.match(/"([^"]+)"/)?.[1] ?? null;
  return {
    queryText: rawQuery.replace(/"/g, "").trim(),
    quotedPhrase
  };
}

function buildFacetFilterQueries(current: SearchState): QueryFilters {
  const filters: TermQuery[] = [];
  const mustNot: TermQuery[] = [];
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

type QueryFilters = {
  filters: TermQuery[];
  mustNot: TermQuery[];
};

function searchForState(context: RuntimeContext, current: SearchState): SearchResult {
  // One search pass produces both the visible result list and the derived facet
  // data so the sidebar always reflects the currently selected result set.
  const active = context.indexes[current.ranking];
  const index = active.hydrated;
  const bodyIndex = index.getFieldIndex("body") as TextFieldIndex;
  const tagIndex = index.getFieldIndex("tags") as TextFieldIndex;
  const sectionIndex = index.getFieldIndex("section") as TextFieldIndex;
  const apiIndex = index.getFieldIndex("api") as TextFieldIndex;
  const { queryText, quotedPhrase } = parseQueryInput(current.query);
  const trimmed = queryText.trim();
  const allowPrefixSuggestions = trimmed.length >= 2;
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
            new MatchQuery("tags", trimmed, OP.OR, current.prefix, 2.25)
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
            new MatchPhrase("title", quotedPhrase ?? trimmed, quotedPhrase ? 0 : 1, 8),
            new MatchPhrase("body", quotedPhrase ?? trimmed, quotedPhrase ? 1 : 2, 3)
          ],
          [],
          filters,
          mustNot
        );

  const hybridLexicalQuery =
    trimmed.length === 0
      ? filterOnlyQuery
      : new BoolQuery(
          [
            new MatchPhrase("title", quotedPhrase ?? trimmed, quotedPhrase ? 0 : 1, 8),
            new MatchPhrase("body", quotedPhrase ?? trimmed, quotedPhrase ? 1 : 2, 3),
            ...(quotedPhrase
              ? []
              : [
                  new MatchQuery("title", trimmed, current.operation, false, 6),
                  new MatchQuery("tagline", trimmed, current.operation, false, 2.5),
                  new MatchQuery("body", trimmed, current.operation, false, 2),
                  new MatchQuery("api", trimmed, OP.OR, false, 2.75),
                  new MatchQuery("tags", trimmed, OP.OR, false, 2.25),
                  ...(allowPrefixSuggestions
                    ? [new MatchQuery("title", trimmed, OP.OR, true, 4), new MatchQuery("suggest", trimmed, OP.OR, true, 3)]
                    : [])
                ])
          ],
          [],
          filters,
          mustNot
        );

  const fuzzyHits =
    trimmed.length === 0
      ? []
      : active.fuzzy.searchRequest({
          query: new MatchQuery("combined", trimmed, OP.OR, false, 1.5),
          limit: 20
        });

  const allowedIds =
    filters.length > 0 || mustNot.length > 0
      ? index.searchRequest({ query: filterOnlyQuery }).map(([id]) => id)
      : undefined;

  const phraseHits =
    trimmed.length === 0
      ? []
      : index.searchRequest({ query: phraseQuery, limit: 20 });
  const hybridLexicalHits =
    trimmed.length === 0
      ? []
      : index.searchRequest({ query: hybridLexicalQuery, limit: 20 });

  let finalHits: Hits;
  let lexicalHits: Hits;
  let highlightQuery: BoolQuery | MatchAll | null = null;

  switch (current.mode) {
    case "phrase":
      lexicalHits = phraseHits;
      finalHits = lexicalHits;
      highlightQuery = phraseQuery;
      break;
    case "fuzzy":
      lexicalHits = [];
      finalHits = fuzzyHits;
      highlightQuery = null;
      break;
    case "match":
      lexicalHits = index.searchRequest({ query: baseTextQuery, limit: 20 });
      finalHits = rerankWithTitleBoost(context, trimmed, lexicalHits);
      highlightQuery = baseTextQuery;
      break;
    case "hybrid":
    default:
      lexicalHits = hybridLexicalHits;
      finalHits =
        trimmed.length === 0
          ? lexicalHits
          : rerankWithTitleBoost(context, trimmed, reciprocalRankFusion([hybridLexicalHits, fuzzyHits], { rankConstant: 20, weights: [3, 1] }));
      highlightQuery = hybridLexicalQuery;
      break;
  }

  const highlightsById = new Map(
    (highlightQuery && trimmed.length > 0 ? finalHits : [])
      .map(([id]) => [
        id,
        index.highlight(id, highlightQuery!, {
          fields: ["title", "tagline", "body"],
          fragmentSize: 140,
          numberOfFragments: 1,
          requireFieldMatch: true
        })
      ] as const)
  );

  const selectedIds = new Set(finalHits.map(([id]) => id));
  const tagFacets = tagIndex.termsAggregation(12, selectedIds.size > 0 ? selectedIds : undefined);
  const sectionFacets = sectionIndex.termsAggregation(8, selectedIds.size > 0 ? selectedIds : undefined);
  const apiFacets = apiIndex.termsAggregation(10, selectedIds.size > 0 ? selectedIds : undefined);
  const significantTerms = bodyIndex.getTopSignificantTerms(
    10,
    selectedIds.size > 0 ? selectedIds : new Set(context.docs.map((doc) => doc.id))
  );

  return {
    lexicalHits,
    fuzzyHits,
    vectorHits: [],
    finalHits,
    highlightsById,
    selectedIds,
    tagFacets,
    sectionFacets,
    apiFacets,
    significantTerms
  };
}

function createShell(context: RuntimeContext): void {
  const navSections = createNavSections(context);
  const buildTimeLabel = formatRelativeBuildTime(BUILD_TIMESTAMP);

  app.innerHTML = `
    <main class="mx-auto w-[min(1560px,calc(100vw-24px))] py-6 lg:py-8">
      <section class="surface search-shell p-5 sm:p-6">
        <div class="mb-4 inline-flex rounded-full border border-stone-900/10 bg-white/75 p-1">
          <button id="experience-search" type="button" class="chip-button">Search</button>
          <button id="experience-ask" type="button" class="chip-button">Ask the docs</button>
        </div>
        <form id="query-form" class="search-form" autocomplete="off">
          <div class="search-input-wrap">
            <input id="query" class="control-input min-w-0 flex-1" placeholder="Search Querylight TS documentation" />
            <button id="clear-query" type="button" class="control-button control-button-muted">Clear</button>
            <button id="submit-query" type="submit" class="control-button">Search</button>
            <div id="suggestions" class="suggestions-panel hidden"></div>
          </div>
        </form>
      </section>

      <section id="reader-layout" class="reader-layout reader-layout-below mt-5" data-mobile-panel="none">
        <div class="reader-mobile-bar">
          <button type="button" class="control-button control-button-muted reader-mobile-button" data-action="open-mobile-toc">Browse docs</button>
          <button type="button" class="control-button control-button-muted reader-mobile-button" data-action="open-mobile-filters">Search tools</button>
        </div>

        <aside class="reader-sidebar">
          <section class="surface reader-mobile-panel-shell p-5">
            <div class="flex items-end justify-between gap-3">
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Table of Contents</p>
                <h2 class="mt-2 font-serif text-2xl text-stone-950">All Documentation</h2>
              </div>
              <div class="flex items-center gap-3">
                <p id="toc-status" class="text-right text-xs text-stone-500"></p>
                <button type="button" class="reader-mobile-close" data-action="close-mobile-panel">Close</button>
              </div>
            </div>
            <div id="toc" class="mt-5 grid gap-5">
              ${navSections
                .map(
                  (section) => `
                    <section>
                      <h3 class="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">${escapeHtml(section.name)}</h3>
                      <div class="mt-3 grid gap-2" data-section="${escapeHtml(section.name)}"></div>
                    </section>
                  `
                )
                .join("")}
            </div>
          </section>
        </aside>

        <section class="reader-main">
          <div id="center-view" class="reader-page-wrap"></div>
        </section>

        <aside class="reader-facets">
          <div class="reader-facets-inner">
            <section class="surface reader-mobile-panel-shell p-5">
              <div class="flex items-start justify-between gap-3">
                <p class="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Search Options</p>
                <button type="button" class="reader-mobile-close" data-action="close-mobile-panel">Close</button>
              </div>
              <div class="mt-4 grid gap-3">
                <label>
                  <span class="mb-2 block text-sm font-semibold text-stone-700">Mode</span>
                  <select id="mode" class="control-input">
                    <option value="hybrid">Hybrid</option>
                    <option value="match">Match</option>
                    <option value="phrase">Phrase</option>
                    <option value="fuzzy">Fuzzy (ngrams)</option>
                  </select>
                </label>
                <label>
                  <span class="mb-2 block text-sm font-semibold text-stone-700">Ranking</span>
                  <select id="ranking" class="control-input">
                    <option value="BM25">BM25</option>
                    <option value="TFIDF">TF-IDF</option>
                  </select>
                </label>
                <label>
                  <span class="mb-2 block text-sm font-semibold text-stone-700">Boolean mode</span>
                  <select id="operation" class="control-input">
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                  </select>
                </label>
                <label class="flex min-h-[54px] items-center gap-3 rounded-2xl border border-stone-900/10 bg-white/80 px-4">
                  <input id="prefix" type="checkbox" class="size-4 accent-orange-700" />
                  <span class="text-sm font-medium text-stone-700">Enable prefix expansion</span>
                </label>
                <label class="flex min-h-[54px] items-center gap-3 rounded-2xl border border-stone-900/10 bg-white/80 px-4">
                  <input id="exclude-advanced" type="checkbox" class="size-4 accent-orange-700" />
                  <span class="text-sm font-medium text-stone-700">Hide advanced topics</span>
                </label>
              </div>
            </section>

            <section class="surface reader-mobile-panel-shell p-5">
              <div class="flex items-end justify-between gap-3">
                <div>
                  <p class="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Facets</p>
                  <h2 class="mt-2 font-serif text-2xl text-stone-950">Refine Results</h2>
                </div>
                <p id="summary" class="text-right text-xs text-stone-500"></p>
              </div>
              <div id="active-filters" class="mt-4 flex flex-wrap gap-2"></div>
              <div id="facet-sections" class="mt-5"></div>
            </section>
          </div>
        </aside>

        <button id="reader-mobile-overlay" type="button" class="reader-mobile-overlay" data-action="close-mobile-panel" aria-label="Close mobile panels"></button>
      </section>

      <footer class="surface mt-5 px-5 py-4 sm:px-6">
        <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div class="flex flex-wrap items-center gap-3">
            <a
              class="chip-button"
              href="https://formationxyz.com"
              target="_blank"
              rel="noreferrer"
            >
              Created by FORMATION XYZ
            </a>
          </div>
          <div class="flex flex-col items-start gap-3 md:items-end">
            <div class="flex flex-wrap items-center gap-3 md:justify-end">
              <a
                class="chip-button"
                href="${escapeHtml(NPM_PACKAGE_URL)}"
                target="_blank"
                rel="noreferrer"
                aria-label="${escapeHtml(`${PACKAGE_NAME} on npm, version ${PACKAGE_VERSION}`)}"
              >
                <img
                  src="${escapeHtml(NPM_BADGE_URL)}"
                  alt="${escapeHtml(`npm version ${PACKAGE_VERSION}`)}"
                  class="block h-5"
                />
              </a>
              <a
                class="chip-button"
                href="${escapeHtml(REPOSITORY_URL)}"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub repository"
              >
                ${GITHUB_ICON}
                <span>GitHub</span>
              </a>
            </div>
            <p class="text-xs text-stone-500 md:text-right">${escapeHtml(buildTimeLabel)} · Copyright FORMARTION GmbH 2026-present</p>
          </div>
        </div>
      </footer>
    </main>
  `;

  wireApp(context);
}

function updateSummary(summaryNode: HTMLParagraphElement, current: SearchResult | null): void {
  if (activeExperience === "ask") {
    summaryNode.textContent =
      semanticQuestionState.status === "ready"
        ? `${semanticQuestionState.results.length} answers · semantic chunks`
        : semanticQuestionState.status === "error"
          ? "Ask the docs unavailable"
          : "Ask the docs";
    return;
  }
  if (!current) {
    summaryNode.textContent = "No active search";
    return;
  }
  const filters = [state.section ? `section:${state.section}` : "", state.tag ? `tag:${state.tag}` : "", state.excludeAdvanced ? "without advanced" : ""]
    .filter(Boolean)
    .join(" · ");
  summaryNode.textContent = `${current.finalHits.length} results · ${state.mode} · ${state.ranking}${filters ? ` · ${filters}` : ""}`;
}

function renderToc(context: RuntimeContext, tocNode: HTMLDivElement, tocStatusNode: HTMLParagraphElement, current: SearchResult | null): void {
  const hasMatches = Boolean(current?.finalHits.length);
  const enabledIds = current?.finalHits.length ? current.selectedIds : new Set(context.docs.map((doc) => doc.id));

  tocStatusNode.textContent = hasMatches
    ? `${enabledIds.size} of ${context.docs.length} pages active`
    : `${context.docs.length} pages available`;

  createNavSections(context).forEach((section) => {
    const sectionNode = tocNode.querySelector<HTMLDivElement>(`[data-section="${CSS.escape(section.name)}"]`);
    if (!sectionNode) {
      return;
    }

    sectionNode.innerHTML = section.docs
      .map((doc) => {
        const isActive = doc.id === activeDocId;
        const isEnabled = enabledIds.has(doc.id) || isActive;
        return `
          <button
            class="toc-link ${isActive ? "toc-link-active" : ""} ${!isEnabled ? "toc-link-disabled" : ""}"
            data-doc="${escapeHtml(doc.id)}"
            ${isEnabled ? "" : "disabled"}
          >
            <span class="toc-link-order">${escapeHtml(doc.order)}</span>
            <span class="min-w-0 toc-link-body">
              <span class="toc-link-title">${escapeHtml(doc.title)}</span>
              <span class="toc-link-meta">${escapeHtml(doc.level)}</span>
            </span>
          </button>
        `;
      })
      .join("");
  });
}

function renderSuggestions(context: RuntimeContext, suggestionsNode: HTMLDivElement, current: SearchResult | null): void {
  if (activeExperience !== "search" || !state.query.trim() || !current || current.finalHits.length === 0) {
    suggestionsNode.classList.add("hidden");
    suggestionsNode.innerHTML = "";
    return;
  }

  suggestionsNode.classList.remove("hidden");
  suggestionsNode.innerHTML = current.finalHits
    .slice(0, 5)
    .map(([id, score], index) => {
      const doc = context.byId.get(id);
      if (!doc) {
        return "";
      }
      const highlight = current.highlightsById.get(id);
      const title = fieldHighlight(highlight, "title");
      const explanation = bestExplanation(highlight);
      return `
        <button type="button" class="suggestion-item" data-doc="${escapeHtml(id)}" data-suggestion="true">
          <span class="text-xs uppercase tracking-[0.12em] text-stone-500">${index + 1}. ${escapeHtml(doc.section)} · ${score.toFixed(2)}</span>
          <span class="suggestion-title">${title ? renderHighlightFragment(title) : renderLiteralHighlight(doc.title, state.query)}</span>
          <span class="suggestion-summary">${explanation?.html ?? escapeHtml(doc.summary)}</span>
        </button>
      `;
    })
    .join("");
}

function renderFacets(context: RuntimeContext, activeFiltersNode: HTMLDivElement, facetSectionsNode: HTMLDivElement, current: SearchResult | null): void {
  const activeFilters = [
    state.section ? { label: `Section: ${state.section}`, facet: "section", value: state.section } : null,
    state.tag ? { label: `Tag: ${state.tag}`, facet: "tag", value: state.tag } : null
  ].filter(Boolean) as Array<{ label: string; facet: string; value: string }>;

  activeFiltersNode.innerHTML =
    activeFilters.length > 0
      ? activeFilters
          .map((filter) => `<button class="chip-button" data-facet="${filter.facet}" data-value="${escapeHtml(filter.value)}">${escapeHtml(filter.label)} ×</button>`)
          .join("")
      : `<p class="text-sm text-stone-500">No active facets.</p>`;

  // When there is no active search, fall back to corpus-wide facet counts so the
  // sidebar still acts as an exploratory navigation surface.
  const source = current ?? searchForState(context, { ...initialState, query: "", tag: null, section: null });
  const sectionFacets = Object.entries(source.sectionFacets);
  const tagFacets = Object.entries(source.tagFacets);
  const apiFacets = Object.entries(source.apiFacets);
  const significantTerms = Object.entries(source.significantTerms).slice(0, 6);

  facetSectionsNode.innerHTML = `
    <div class="grid gap-5">
      <section>
        <h3 class="text-sm font-semibold text-stone-900">Sections</h3>
        <div class="mt-3 flex flex-wrap gap-2">
          ${sectionFacets.map(([value, count]) => `<button class="chip-button" data-facet="section" data-value="${escapeHtml(value)}">${escapeHtml(value)} <span class="text-stone-400">${count}</span></button>`).join("") || `<p class="text-sm text-stone-500">No section facets.</p>`}
        </div>
      </section>
      <section>
        <h3 class="text-sm font-semibold text-stone-900">Tags</h3>
        <div class="mt-3 flex flex-wrap gap-2">
          ${tagFacets.map(([value, count]) => `<button class="chip-button" data-facet="tag" data-value="${escapeHtml(value)}">${escapeHtml(value)} <span class="text-stone-400">${count}</span></button>`).join("") || `<p class="text-sm text-stone-500">No tag facets.</p>`}
        </div>
      </section>
      <section>
        <h3 class="text-sm font-semibold text-stone-900">APIs</h3>
        <div class="mt-3 flex flex-wrap gap-2">
          ${apiFacets.map(([value, count]) => `<button class="chip-button" data-facet="api" data-value="${escapeHtml(value)}">${escapeHtml(value)} <span class="text-stone-400">${count}</span></button>`).join("") || `<p class="text-sm text-stone-500">No API facets.</p>`}
        </div>
      </section>
      <section>
        <h3 class="text-sm font-semibold text-stone-900">Significant Terms</h3>
        <div class="mt-3 flex flex-wrap gap-2">
          ${significantTerms
            .map(([term, values]) => `<button class="chip-button" data-example="${escapeHtml(term)}">${escapeHtml(term)} <span class="text-stone-400">${values[0].toFixed(2)}</span></button>`)
            .join("") || `<p class="text-sm text-stone-500">No term suggestions.</p>`}
        </div>
      </section>
    </div>
  `;
}

function renderRelatedArticles(context: RuntimeContext, doc: DocEntry): string {
  const related = getRelatedArticles(context, doc);
  if (related.length === 0) {
    return "";
  }

  return `
    <section class="surface px-6 py-5 sm:px-8">
      <div class="flex items-end justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Related Articles</p>
          <h2 class="mt-2 font-serif text-2xl text-stone-950">Keep exploring</h2>
        </div>
        <p class="text-sm text-stone-500">Article-level semantic similarity</p>
      </div>
      <div class="mt-4 grid gap-3 md:grid-cols-2">
        ${related
          .map(({ doc: relatedDoc, score }) => `
            <button class="nav-result" data-doc="${escapeHtml(relatedDoc.id)}" data-open-doc="true">
              <div class="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.12em] text-stone-500">
                <span>${escapeHtml(relatedDoc.section)}</span>
                <span>${score.toFixed(2)}</span>
              </div>
              <h3 class="result-title result-title-sm">${escapeHtml(relatedDoc.title)}</h3>
              <p class="result-summary result-summary-sm">${escapeHtml(relatedDoc.summary)}</p>
            </button>
          `)
          .join("")}
      </div>
    </section>
  `;
}

function renderHome(context: RuntimeContext, centerNode: HTMLDivElement): void {
  const featured = context.docs.slice(0, 6);
  centerNode.innerHTML = `
    <article class="surface reader-page px-6 py-8 sm:px-8 sm:py-10">
      <header>
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Start Page</p>
        <h1 class="mt-2 font-serif text-[clamp(2.5rem,5vw,4.2rem)] leading-none text-stone-950">Querylight TS documentation</h1>
        <p class="mt-4 max-w-3xl text-base leading-7 text-stone-600">
          Explore the docs, try the in-browser search experience, and jump out to the package or source when you want to wire it into your own project.
        </p>
        <div class="mt-5 flex flex-wrap gap-3">
          <a class="chip-button" href="https://github.com/formation-res/querylight-ts" target="_blank" rel="noreferrer">GitHub repository</a>
          <a class="chip-button" href="https://www.npmjs.com/package/@tryformation/querylight-ts" target="_blank" rel="noreferrer">npm package</a>
        </div>
      </header>
      <section class="mt-8 grid gap-4 md:grid-cols-2">
        ${featured
          .map(
            (doc) => `
              <button class="doc-card" data-doc="${escapeHtml(doc.id)}" data-open-doc="true">
                <span class="text-xs uppercase tracking-[0.12em] text-stone-500">${escapeHtml(doc.section)} · ${escapeHtml(doc.order)}</span>
                <h2 class="card-title">${escapeHtml(doc.title)}</h2>
                <p class="card-summary">${escapeHtml(doc.summary)}</p>
              </button>
            `
          )
          .join("")}
      </section>
    </article>
  `;
}

function renderResultsPage(context: RuntimeContext, centerNode: HTMLDivElement, current: SearchResult): void {
  centerNode.innerHTML = `
    <article class="surface reader-page px-6 py-8 sm:px-8 sm:py-10">
      <header>
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Search Results</p>
        <h1 class="mt-2 font-serif text-[clamp(2.4rem,5vw,4rem)] leading-none text-stone-950">${state.query.trim() || "All documentation"}</h1>
        <p class="mt-3 text-sm text-stone-600">${current.finalHits.length} matches</p>
      </header>
      <div class="mt-8 grid gap-3">
        ${
          current.finalHits.length === 0
            ? `<div class="rounded-3xl border border-dashed border-stone-900/10 bg-stone-50/80 px-5 py-4 text-sm text-stone-600">No matches found. Try a broader query or remove some facets.</div>`
            : current.finalHits
                .map(([id, score], index) => {
                  const doc = context.byId.get(id);
                  if (!doc) {
                    return "";
                  }
                  const highlight = current.highlightsById.get(id);
                  const title = fieldHighlight(highlight, "title");
                  const explanation = bestExplanation(highlight);
                  return `
                    <button class="nav-result" data-doc="${escapeHtml(id)}" data-open-doc="true">
                      <div class="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.12em] text-stone-500">
                        <span>${index + 1}. ${escapeHtml(doc.section)}</span>
                        <span>${score.toFixed(2)}</span>
                      </div>
                      <h2 class="result-title">${title ? renderHighlightFragment(title) : renderLiteralHighlight(doc.title, state.query)}</h2>
                      <p class="result-summary">${escapeHtml(doc.summary)}</p>
                      ${explanation ? `<p class="result-explanation"><span class="result-explanation-label">${escapeHtml(explanation.label)}</span>${explanation.html}</p>` : ""}
                    </button>
                  `;
                })
                .join("")
        }
      </div>
    </article>
  `;
}

function renderDetailPage(context: RuntimeContext, centerNode: HTMLDivElement, doc: DocEntry, current: SearchResult | null): void {
  const topResults = current?.finalHits.slice(0, 3) ?? [];
  const renderedMarkdown = context.renderedMarkdown.get(doc.id) ?? markdown.render(doc.markdown);
  context.renderedMarkdown.set(doc.id, renderedMarkdown);
  const relatedArticlesPanel = renderRelatedArticles(context, doc);
  const activeChunk =
    activeChunkId && context.semantic.chunkEmbeddingsById.get(activeChunkId)?.docId === doc.id
      ? context.semantic.chunkEmbeddingsById.get(activeChunkId) ?? null
      : null;
  const activeChunkAnchor = activeChunk ? getChunkAnchor(activeChunk) : null;

  centerNode.innerHTML = `
    <article class="reader-page grid gap-4">
      ${
        topResults.length > 0
          ? `
            <section class="surface px-6 py-5 sm:px-8">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Top Matches</p>
                  <h2 class="mt-2 font-serif text-2xl text-stone-950">Current search</h2>
                </div>
                <button class="text-sm font-semibold text-orange-800 transition hover:text-orange-900" data-action="back-to-results" type="button">More results</button>
              </div>
              <div class="mt-4 grid gap-3 md:grid-cols-3">
                ${topResults
                  .map(([id, score], index) => {
                    const resultDoc = context.byId.get(id);
                    if (!resultDoc) {
                      return "";
                    }
                    const highlight = current?.highlightsById.get(id);
                    const title = fieldHighlight(highlight, "title");
                    return `
                      <button class="nav-result ${resultDoc.id === doc.id ? "nav-result-active" : ""}" data-doc="${escapeHtml(id)}" data-open-doc="true">
                        <div class="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.12em] text-stone-500">
                          <span>${index + 1}. ${escapeHtml(resultDoc.section)}</span>
                          <span>${score.toFixed(2)}</span>
                        </div>
                        <h3 class="result-title result-title-sm">${title ? renderHighlightFragment(title) : renderLiteralHighlight(resultDoc.title, state.query)}</h3>
                        <p class="result-summary result-summary-sm">${escapeHtml(resultDoc.summary)}</p>
                      </button>
                    `;
                  })
                  .join("")}
              </div>
            </section>
          `
          : ""
      }
      <article class="surface overflow-hidden">
        <header class="border-b border-stone-900/8 px-6 py-6 sm:px-8">
          ${
            current
              ? `<button class="text-sm font-semibold text-orange-800 transition hover:text-orange-900" data-action="back-to-results" type="button">Back to search results</button>`
              : ""
          }
          <p class="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Reference Entry</p>
          <h1 class="mt-2 font-serif text-[clamp(2.4rem,5vw,4rem)] leading-none text-stone-950">${escapeHtml(doc.title)}</h1>
          <p class="mt-3 text-sm text-stone-600">${escapeHtml(`${doc.section} · ${doc.level} · order ${doc.order}`)}</p>
        </header>
        <div id="${chunkAnchorDomId("intro")}" class="px-6 py-8 sm:px-8 sm:py-10">
          <p class="text-lg text-stone-600">${escapeHtml(doc.summary)}</p>
          ${
            activeChunk
              ? `
                <section id="${chunkTargetDomId(activeChunk.chunkId)}" class="mt-6 rounded-3xl border border-orange-900/10 bg-orange-50/80 px-5 py-4">
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p class="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Matched Chunk</p>
                      <h2 class="mt-2 font-serif text-2xl text-stone-950">${escapeHtml(formatHeadingPath(activeChunk.headingPath))}</h2>
                    </div>
                    <a class="chip-button" href="#${escapeHtml(chunkAnchorDomId(activeChunkAnchor ?? "intro"))}">Jump to section</a>
                  </div>
                  <p class="mt-4 text-sm leading-7 text-stone-700">${escapeHtml(activeChunk.text)}</p>
                </section>
              `
              : ""
          }
          <div class="mt-5">
            <h2 class="font-serif text-xl text-stone-950">Relevant APIs</h2>
            <div class="mt-3 flex flex-wrap gap-2">
              ${doc.apis.map((api) => `<button class="chip-button" data-facet="api" data-value="${escapeHtml(api)}">${escapeHtml(api)}</button>`).join("")}
            </div>
          </div>
          <div class="mt-5">
            <h2 class="font-serif text-xl text-stone-950">Tags</h2>
            <div class="mt-3 flex flex-wrap gap-2">
              ${doc.tags.map((tag) => `<button class="chip-button" data-facet="tag" data-value="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join("")}
            </div>
          </div>
          <article class="prose-docs mt-8">${renderedMarkdown}</article>
          ${
            current
              ? `<div class="mt-8"><button class="text-sm font-semibold text-orange-800 transition hover:text-orange-900" data-action="back-to-results" type="button">Back to search results</button></div>`
              : ""
          }
        </div>
      </article>
      ${relatedArticlesPanel}
    </article>
  `;

  if (activeChunkId) {
    const chunkTarget = centerNode.querySelector<HTMLElement>(`#${CSS.escape(chunkTargetDomId(activeChunkId))}`);
    if (chunkTarget) {
      window.requestAnimationFrame(() => {
        chunkTarget.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    }
  }
}

function renderAskResultsPage(centerNode: HTMLDivElement): void {
  const statusMessage =
    semanticQuestionState.status === "loading-model"
      ? "Loading the embedding model for the first semantic query."
      : semanticQuestionState.status === "searching"
        ? "Matching your question against semantic chunks."
        : semanticQuestionState.status === "error"
          ? semanticQuestionState.error ?? "Semantic search failed."
          : semanticQuestionState.status === "ready"
            ? `${semanticQuestionState.results.length} semantic matches`
            : "Ask a natural-language question and match it against article chunks.";

  centerNode.innerHTML = `
    <article class="surface reader-page px-6 py-8 sm:px-8 sm:py-10">
      <header>
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Ask The Docs</p>
        <h1 class="mt-2 font-serif text-[clamp(2.4rem,5vw,4rem)] leading-none text-stone-950">${escapeHtml(semanticQuestionState.query || "Semantic answers")}</h1>
        <p class="mt-3 text-sm text-stone-600">${escapeHtml(statusMessage)}</p>
      </header>
      <div class="mt-8 grid gap-3">
        ${
          semanticQuestionState.results.length === 0
            ? `<div class="rounded-3xl border border-dashed border-stone-900/10 bg-stone-50/80 px-5 py-4 text-sm text-stone-600">No semantic matches found. Try a broader question.</div>`
            : semanticQuestionState.results
                .map(({ chunk, doc, score }, index) => `
                  <button class="nav-result" data-doc="${escapeHtml(doc.id)}" data-chunk-id="${escapeHtml(chunk.chunkId)}" data-open-doc="true">
                    <div class="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.12em] text-stone-500">
                      <span>${index + 1}. ${escapeHtml(doc.section)} · ${escapeHtml(formatHeadingPath(chunk.headingPath))}</span>
                      <span>${score.toFixed(2)}</span>
                    </div>
                    <h2 class="result-title">${escapeHtml(doc.title)}</h2>
                    <p class="result-summary">${escapeHtml(chunk.text)}</p>
                  </button>
                `)
                .join("")
        }
      </div>
    </article>
  `;
}

function renderCenter(context: RuntimeContext, centerNode: HTMLDivElement, current: SearchResult | null): void {
  if (currentView === "ask") {
    renderAskResultsPage(centerNode);
    return;
  }
  if (currentView === "results" && current) {
    renderResultsPage(context, centerNode, current);
    return;
  }

  if (currentView === "detail" && activeDocId) {
    const doc = context.byId.get(activeDocId);
    if (doc) {
      renderDetailPage(context, centerNode, doc, current);
      return;
    }
  }

  renderHome(context, centerNode);
}

function setSearchModeFromQuery(value: string): void {
  if (value.includes("\"")) {
    state.mode = "phrase";
  } else if (/[a-z]{4,}\s[a-z]{4,}/i.test(value)) {
    state.mode = "hybrid";
  }
}

function wireApp(context: RuntimeContext): void {
  const queryForm = document.querySelector<HTMLFormElement>("#query-form");
  const queryInput = document.querySelector<HTMLInputElement>("#query");
  const clearQueryButton = document.querySelector<HTMLButtonElement>("#clear-query");
  const experienceSearchButton = document.querySelector<HTMLButtonElement>("#experience-search");
  const experienceAskButton = document.querySelector<HTMLButtonElement>("#experience-ask");
  const modeSelect = document.querySelector<HTMLSelectElement>("#mode");
  const rankingSelect = document.querySelector<HTMLSelectElement>("#ranking");
  const operationSelect = document.querySelector<HTMLSelectElement>("#operation");
  const prefixInput = document.querySelector<HTMLInputElement>("#prefix");
  const excludeAdvancedInput = document.querySelector<HTMLInputElement>("#exclude-advanced");
  const suggestionsNode = document.querySelector<HTMLDivElement>("#suggestions");
  const summaryNode = document.querySelector<HTMLParagraphElement>("#summary");
  const centerNode = document.querySelector<HTMLDivElement>("#center-view");
  const tocNode = document.querySelector<HTMLDivElement>("#toc");
  const tocStatusNode = document.querySelector<HTMLParagraphElement>("#toc-status");
  const activeFiltersNode = document.querySelector<HTMLDivElement>("#active-filters");
  const facetSectionsNode = document.querySelector<HTMLDivElement>("#facet-sections");
  const readerLayout = document.querySelector<HTMLElement>("#reader-layout");

  if (
    !queryForm ||
    !queryInput ||
    !clearQueryButton ||
    !experienceSearchButton ||
    !experienceAskButton ||
    !modeSelect ||
    !rankingSelect ||
    !operationSelect ||
    !prefixInput ||
    !excludeAdvancedInput ||
    !suggestionsNode ||
    !summaryNode ||
    !centerNode ||
    !tocNode ||
    !tocStatusNode ||
    !activeFiltersNode ||
    !facetSectionsNode ||
    !readerLayout
  ) {
    throw new Error("app nodes not found");
  }

  const setMobilePanel = (panel: "none" | "toc" | "filters") => {
    readerLayout.dataset.mobilePanel = panel;
    document.body.classList.toggle("mobile-panel-open", panel !== "none");
  };

  const closeMobilePanel = () => {
    setMobilePanel("none");
  };

  const syncViewportState = () => {
    if (window.innerWidth >= 1280) {
      closeMobilePanel();
    }
  };

  const syncControls = () => {
    const isAsk = activeExperience === "ask";
    queryInput.value = isAsk ? semanticQuestionState.query : state.query;
    queryInput.placeholder = isAsk ? "Ask a question like: how do I use vector search?" : "Search Querylight TS documentation";
    modeSelect.value = state.mode;
    rankingSelect.value = state.ranking;
    operationSelect.value = state.operation;
    prefixInput.checked = state.prefix;
    excludeAdvancedInput.checked = state.excludeAdvanced;
    clearQueryButton.disabled = (isAsk ? semanticQuestionState.query : state.query).length === 0;
    experienceSearchButton.classList.toggle("nav-result-active", !isAsk);
    experienceAskButton.classList.toggle("nav-result-active", isAsk);
    [modeSelect, rankingSelect, operationSelect, prefixInput, excludeAdvancedInput].forEach((control) => {
      control.disabled = isAsk;
      control.closest("label")?.classList.toggle("opacity-45", isAsk);
    });
    const submitLabel = queryForm.querySelector<HTMLButtonElement>("#submit-query");
    if (submitLabel) {
      submitLabel.textContent = isAsk ? "Ask" : "Search";
    }
  };

  const renderShell = () => {
    syncControls();
    updateSummary(summaryNode, submittedResult);
    renderToc(context, tocNode, tocStatusNode, submittedResult);
    renderFacets(context, activeFiltersNode, facetSectionsNode, submittedResult);
    renderCenter(context, centerNode, submittedResult);
  };

  const renderSuggestionsOnly = () => {
    syncControls();
    renderSuggestions(context, suggestionsNode, suggestionResult);
  };

  const hideSuggestions = () => {
    suggestionResult = null;
    renderSuggestions(context, suggestionsNode, suggestionResult);
  };

  const renderApp = () => {
    renderShell();
    renderSuggestionsOnly();
  };

  const applyLocationHash = () => {
    const detailHash = parseDetailHash();
    if (!detailHash || !context.byId.has(detailHash.docId)) {
      return;
    }

    activeDocId = detailHash.docId;
    activeChunkId =
      detailHash.chunkId && context.semantic.chunkEmbeddingsById.get(detailHash.chunkId)?.docId === detailHash.docId
        ? detailHash.chunkId
        : null;
    currentView = "detail";
  };

  const runSemanticSearch = async () => {
    const trimmed = semanticQuestionState.query.trim();
    if (!trimmed) {
      semanticQuestionState = {
        query: "",
        status: "idle",
        results: [],
        error: null
      };
      currentView = "home";
      renderApp();
      return;
    }

    activeExperience = "ask";
    const firstLoad = browserEmbeddingExtractorPromise === null;
    semanticQuestionState = {
      ...semanticQuestionState,
      status: firstLoad ? "loading-model" : "searching",
      results: [],
      error: null
    };
    renderApp();

    try {
      const embedding = await embedSemanticQuery(trimmed, context.semantic.model.modelId);
      semanticQuestionState = {
        ...semanticQuestionState,
        status: "searching"
      };
      renderApp();

      const results = getSemanticQuestionResults(context, embedding);
      semanticQuestionState = {
        ...semanticQuestionState,
        status: "ready",
        results,
        error: null
      };
      currentView = "ask";
    } catch (error: unknown) {
      semanticQuestionState = {
        ...semanticQuestionState,
        status: "error",
        results: [],
        error: error instanceof Error ? error.message : String(error)
      };
      currentView = "ask";
    }

    renderApp();
  };

  const runSubmittedSearch = (nextView: "results" | "detail" = "results") => {
    suggestionResult = null;
    submittedResult = searchForState(context, state);
    if (submittedResult.finalHits.length > 0 && !submittedResult.selectedIds.has(activeDocId)) {
      activeDocId = submittedResult.finalHits[0]?.[0] ?? "";
    }
    currentView = nextView;
    renderApp();
  };

  let pendingSuggestions: ReturnType<typeof window.setTimeout> | null = null;
  const scheduleSuggestions = () => {
    if (pendingSuggestions !== null) {
      window.clearTimeout(pendingSuggestions);
    }
    if (activeExperience !== "search" || !state.query.trim()) {
      suggestionResult = null;
      renderSuggestionsOnly();
      return;
    }
    pendingSuggestions = window.setTimeout(() => {
      pendingSuggestions = null;
      suggestionResult = searchForState(context, state);
      renderSuggestionsOnly();
    }, SEARCH_INPUT_DEBOUNCE_MS);
  };

  const resetToHomeIfEmpty = () => {
    if (!state.query.trim() && !state.tag && !state.section && !state.excludeAdvanced) {
      submittedResult = null;
      suggestionResult = null;
      currentView = "home";
      activeDocId = "";
      activeChunkId = null;
      clearDetailHash();
    }
    if (!semanticQuestionState.query.trim()) {
      semanticQuestionState = { query: "", status: "idle", results: [], error: null };
    }
  };

  queryInput.addEventListener("input", () => {
    if (activeExperience === "ask") {
      semanticQuestionState = {
        ...semanticQuestionState,
        query: queryInput.value,
        status: queryInput.value.trim() ? semanticQuestionState.status : "idle",
        error: null,
        ...(queryInput.value.trim() ? {} : { results: [] })
      };
    } else {
      state.query = queryInput.value;
    }
    syncControls();
    scheduleSuggestions();
  });

  queryInput.addEventListener("focus", () => {
    scheduleSuggestions();
  });

  queryInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideSuggestions();
      return;
    }
    if (event.key === "Enter" && activeExperience === "ask") {
      event.preventDefault();
      void runSemanticSearch();
    }
  });

  queryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (activeExperience === "ask") {
      void runSemanticSearch();
    } else {
      runSubmittedSearch("results");
    }
  });

  clearQueryButton.addEventListener("click", () => {
    if (activeExperience === "ask") {
      semanticQuestionState = {
        query: "",
        status: "idle",
        results: [],
        error: null
      };
      currentView = "home";
    } else {
      state.query = "";
    }
    resetToHomeIfEmpty();
    queryInput.focus();
    renderApp();
  });

  experienceSearchButton.addEventListener("click", () => {
    activeExperience = "search";
    if (!submittedResult && !state.query.trim()) {
      currentView = "home";
    } else if (submittedResult) {
      currentView = currentView === "detail" ? "detail" : "results";
    }
    renderApp();
  });

  experienceAskButton.addEventListener("click", () => {
    activeExperience = "ask";
    currentView = semanticQuestionState.results.length > 0 ? "ask" : "home";
    hideSuggestions();
    renderApp();
  });

  const applySearchOptions = () => {
    if (currentView === "home" && !submittedResult) {
      renderShell();
      return;
    }
    runSubmittedSearch(currentView === "detail" ? "detail" : "results");
  };

  modeSelect.addEventListener("change", () => {
    state.mode = modeSelect.value as SearchMode;
    applySearchOptions();
  });
  rankingSelect.addEventListener("change", () => {
    state.ranking = rankingSelect.value as RankingAlgorithm;
    applySearchOptions();
  });
  operationSelect.addEventListener("change", () => {
    state.operation = operationSelect.value as OP;
    applySearchOptions();
  });
  prefixInput.addEventListener("change", () => {
    state.prefix = prefixInput.checked;
    applySearchOptions();
  });
  excludeAdvancedInput.addEventListener("change", () => {
    state.excludeAdvanced = excludeAdvancedInput.checked;
    applySearchOptions();
  });

  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const backToResults = target.closest<HTMLElement>("[data-action='back-to-results']");
    if (backToResults) {
      if (submittedResult) {
        currentView = "results";
      }
      activeChunkId = null;
      activeExperience = "search";
      clearDetailHash();
      renderShell();
      return;
    }

    const example = target.closest<HTMLElement>("[data-example]")?.dataset.example;
    if (example) {
      state.query = example;
      setSearchModeFromQuery(example);
      closeMobilePanel();
      activeExperience = "search";
      runSubmittedSearch("results");
      return;
    }

    const docTarget = target.closest<HTMLElement>("[data-doc]");
    const docId = docTarget?.dataset.doc;
    if (docId) {
      activeDocId = docId;
      activeChunkId = docTarget?.dataset.chunkId ?? null;
      closeMobilePanel();
      if (docTarget?.dataset.openDoc === "true" || docTarget?.dataset.suggestion === "true") {
        if (!submittedResult && state.query.trim()) {
          submittedResult = searchForState(context, state);
        }
        activeExperience = currentView === "ask" ? "ask" : "search";
        currentView = "detail";
      } else if (!submittedResult) {
        currentView = "detail";
      }
      updateDetailHash(activeDocId, activeChunkId);
      suggestionResult = null;
      renderApp();
      return;
    }

    const facetTarget = target.closest<HTMLElement>("[data-facet]");
    if (!facetTarget) {
      const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
      if (action === "open-mobile-toc") {
        setMobilePanel("toc");
        return;
      }
      if (action === "open-mobile-filters") {
        setMobilePanel("filters");
        return;
      }
      if (action === "close-mobile-panel") {
        closeMobilePanel();
        return;
      }
      if (!target.closest("#query-form")) {
        hideSuggestions();
      }
      return;
    }
    const facet = facetTarget.dataset.facet;
    const value = facetTarget.dataset.value ?? "";
    if (facet === "tag") {
      state.tag = state.tag === value ? null : value;
    } else if (facet === "api") {
      state.query = value;
      state.mode = "match";
    } else if (facet === "section") {
      state.section = state.section === value ? null : value;
    }
    closeMobilePanel();
    activeExperience = "search";
    runSubmittedSearch("results");
  });

  window.addEventListener("hashchange", () => {
    applyLocationHash();
    renderApp();
  });
  window.addEventListener("resize", syncViewportState);

  applyLocationHash();
  syncControls();
  syncViewportState();
  renderApp();
}

async function bootstrap(): Promise<void> {
  renderLoading("Loading prebuilt documentation search indexes.");
  const response = await fetch(demoDataUrl);
  if (!response.ok) {
    throw new Error(`failed to load demo data: ${response.status} ${response.statusText}`);
  }
  const demoData = (await response.json()) as DemoDataPayload;
  const context = createRuntimeContext(demoData);
  createShell(context);
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  app.innerHTML = `
    <main class="mx-auto min-h-screen w-[min(1200px,calc(100vw-32px))] py-8">
      <section class="surface p-8">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">Load Error</p>
        <h1 class="mt-3 font-serif text-4xl text-stone-950">Documentation bootstrap failed</h1>
        <pre class="mt-4 overflow-x-auto rounded-3xl border border-red-900/10 bg-red-50 p-4 text-sm text-red-900">${escapeHtml(message)}</pre>
      </section>
    </main>
  `;
});
