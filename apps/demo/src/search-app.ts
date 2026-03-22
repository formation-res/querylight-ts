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
  NumericFieldIndex,
  OP,
  type Query,
  RangeQuery,
  RankingAlgorithm,
  reciprocalRankFusion,
  type SignificantTermsBucket,
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
import packageMeta from "../../../packages/querylight/package.json";
import { resolveDocLink } from "./doc-routes";
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
import { createSemanticVectorScorer } from "./webgpu-vector-scorer";

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
  order: number;
  markdown: string;
  body: string;
  wordCount: number;
  examples: string[];
  path: string;
  url: string;
};

type WordCountFacet = {
  key: string;
  label: string;
  from?: number;
  to?: number;
};

type SearchState = {
  query: string;
  mode: SearchMode;
  operation: OP;
  prefix: boolean;
  ranking: RankingAlgorithm;
  offset: number;
  api: string | null;
  tag: string | null;
  section: string | null;
  wordCountFacet: string | null;
  excludeAdvanced: boolean;
};

type FacetKind = "api" | "section" | "tag" | "word-count";

type SearchResult = {
  lexicalHits: Hits;
  fuzzyHits: Hits;
  vectorHits: Hits;
  finalHits: Hits;
  visibleHits: Hits;
  totalHits: number;
  offset: number;
  pageSize: number;
  responseTimeMs: number;
  highlightsById: Map<string, HighlightResult>;
  selectedIds: Set<string>;
  tagFacets: Record<string, number>;
  sectionFacets: Record<string, number>;
  apiFacets: Record<string, number>;
  wordCountStats: { count: number; min: number | null; max: number | null; sum: number; avg: number | null };
  wordCountFacets: Array<{ key: string; label: string; docCount: number }>;
  wordCountHistogram: Array<{ key: number; docCount: number }>;
  significantTerms: SignificantTermsBucket[];
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
  byUrl: Map<string, DocEntry>;
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
  backend: "webgpu" | "cpu";
};

type SemanticQuestionState = {
  query: string;
  status: "idle" | "loading-model" | "searching" | "ready" | "error";
  results: ChunkHitViewModel[];
  error: string | null;
};

let app: HTMLDivElement | null = null;

function requireApp(): HTMLDivElement {
  if (!app) {
    throw new Error("App root not found");
  }
  return app;
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

const tagAnalyzer = new Analyzer([], new KeywordTokenizer());
const fuzzyAnalyzer = new Analyzer(undefined, undefined, [new NgramTokenFilter(3)]);
const edgeAnalyzer = new Analyzer(undefined, undefined, [new EdgeNgramsTokenFilter(2, 6)]);
const SEARCH_INPUT_DEBOUNCE_MS = 150;
const SEARCH_RESULTS_PAGE_SIZE = 20;
const WORD_COUNT_FACETS: WordCountFacet[] = [
  { key: "short", label: "Under 400", to: 400 },
  { key: "medium", label: "400-800", from: 400, to: 800 },
  { key: "long", label: "800-1400", from: 800, to: 1400 },
  { key: "deep", label: "1400+", from: 1400 }
];
const WORD_COUNT_HISTOGRAM_INTERVAL = 250;
const DOC_SECTION_ORDER = [
  "Overview",
  "API Reference",
  "Schema",
  "Analysis",
  "Lexical Querying",
  "Ranking",
  "Aggregations",
  "Indexing",
  "Other Features",
  "Guides",
  "Demo Internals",
  "Operations"
];
const TOC_SECTION_STORAGE_KEY = "querylight-demo:toc-sections";
const DOCS_HOME_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true" class="size-4">
    <path
      d="M3.75 10.94 12 4.5l8.25 6.44v8.31a.75.75 0 0 1-.75.75H14.25v-5.25a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75V20H4.5a.75.75 0 0 1-.75-.75z"
      fill="currentColor"
    />
  </svg>
`;
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
  offset: 0,
  api: null,
  tag: null,
  section: null,
  wordCountFacet: null,
  excludeAdvanced: false
};

let state: SearchState = { ...initialState };
let activeDocId = "";
let activeChunkId: string | null = null;
let currentView: "home" | "results" | "detail" | "ask" = "home";
let activeExperience: QueryExperience = "ask";
let submittedResult: SearchResult | null = null;
let suggestionResult: SearchResult | null = null;
let semanticQuestionState: SemanticQuestionState = {
  query: "",
  status: "idle",
  results: [],
  error: null
};

class SearchContextController {
  private currentState: SearchState;
  private readonly cache = new Map<string, Promise<SearchResult>>();
  private readonly resolved = new Map<string, SearchResult>();

  constructor(private readonly runtime: RuntimeContext, initial: SearchState) {
    this.currentState = { ...initial };
  }

  get state(): SearchState {
    return { ...this.currentState };
  }

  replace(next: SearchState): SearchState {
    this.currentState = { ...next };
    return this.state;
  }

  patch(next: Partial<SearchState>): SearchState {
    this.currentState = { ...this.currentState, ...next };
    return this.state;
  }

  toggleFacet(facet: FacetKind, value: string): SearchState {
    const currentValue = this.currentState[this.facetKey(facet)];
    return this.replace({
      ...this.currentState,
      [this.facetKey(facet)]: currentValue === value ? null : value || null
    });
  }

  async resultFor(next: SearchState = this.currentState): Promise<SearchResult> {
    const cacheKey = JSON.stringify(next);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const result = searchForState(this.runtime, next).then((resolved) => {
      this.resolved.set(cacheKey, resolved);
      return resolved;
    });
    this.cache.set(cacheKey, result);
    return result;
  }

  peek(next: SearchState = this.currentState): SearchResult | null {
    return this.resolved.get(JSON.stringify(next)) ?? null;
  }

  private facetKey(facet: FacetKind): "api" | "section" | "tag" | "wordCountFacet" {
    switch (facet) {
      case "word-count":
        return "wordCountFacet";
      default:
        return facet;
    }
  }
}

function isSemanticSearchBusy(): boolean {
  return semanticQuestionState.status === "loading-model" || semanticQuestionState.status === "searching";
}

function getSemanticOverlayMessage(): string {
  return semanticQuestionState.status === "loading-model"
    ? "Loading the embedding model for the first semantic query."
    : "Thinking through the docs...";
}

function renderLoading(message: string): void {
  requireApp().innerHTML = `
    <main class="mx-auto min-h-screen w-[min(1200px,calc(100vw-32px))] px-0 py-8">
      <section class="surface p-8">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Querylight Demo</p>
        <h1 class="mt-3 font-serif text-5xl leading-none text-stone-950">Loading documentation</h1>
        <p class="mt-4 max-w-2xl text-base text-stone-600">${message}</p>
      </section>
    </main>
  `;
}

function escapeHtml(value: string | number | boolean): string {
  return String(value)
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

function buildDetailQuery(): string {
  const params = new URLSearchParams();
  if (state.query.trim()) {
    params.set("q", state.query.trim());
  }
  return params.toString();
}

function updateDetailHash(doc: DocEntry, chunkId?: string | null): void {
  window.history.pushState(
    { view: "detail", docId: doc.id, chunkId },
    "",
    buildDocHref(doc, chunkId)
  );
}

function clearDetailHash(): void {
  const query = buildDetailQuery();
  const target = query ? `/?${query}` : "/";
  window.history.replaceState({ view: currentView }, "", target);
}

function parseDetailHash(): { docUrl: string; chunkId: string | null } | null {
  const pathname = window.location.pathname;
  if (!pathname.startsWith("/docs/")) {
    return null;
  }
  const normalizedPath = pathname.endsWith("/") ? pathname : `${pathname}/`;
  const chunkAnchor = window.location.hash.replace(/^#chunk-anchor-/, "").trim() || null;
  return {
    docUrl: normalizedPath,
    chunkId: chunkAnchor
  };
}

function buildDocHref(doc: DocEntry, chunkId?: string | null): string {
  const chunkAnchor = chunkId && chunkId.includes("::")
    ? chunkAnchorDomId(chunkId.split("::")[1] ?? "intro")
    : chunkId
      ? chunkAnchorDomId(chunkId)
    : null;
  return `${doc.url}${chunkAnchor ? `#${chunkAnchor}` : ""}`;
}

function normalizeDocUrl(pathname: string): string {
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

function isSearchRoute(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/docs/");
}

function rewriteDocMarkdownLinks(markdownSource: string, sourcePath: string): string {
  return markdownSource.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text: string, href: string) => {
    const resolvedHref = resolveDocLink(sourcePath, href);
    return resolvedHref === href ? match : `[${text}](${resolvedHref})`;
  });
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
    wordCount: new NumericFieldIndex(),
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

async function createSemanticRuntime(semanticPayload: SemanticPayload): Promise<SemanticRuntime> {
  // Load the precomputed chunk embeddings into an ANN index once at startup so
  // Ask-the-docs queries only need to embed the user's question.
  const { scorer, backend } = await createSemanticVectorScorer();
  const chunkIndex = new VectorFieldIndex({
    numHashTables: SEMANTIC_INDEX_HASH_TABLES,
    dimensions: semanticPayload.model.dimensions,
    random: createSeededRandom(SEMANTIC_INDEX_RANDOM_SEED),
    options: { scorer }
  });

  semanticPayload.chunkEmbeddings.forEach((record) => {
    chunkIndex.insert(record.chunkId, [record.embedding]);
  });

  return {
    model: semanticPayload.model,
    chunkIndex,
    relatedArticlesByDocId: new Map(semanticPayload.relatedArticles.map((record) => [record.docId, record])),
    chunkEmbeddingsById: new Map(semanticPayload.chunkEmbeddings.map((record) => [record.chunkId, record])),
    backend
  };
}

async function createRuntimeContext(demoData: DemoDataPayload): Promise<RuntimeContext> {
  const docs = [...demoData.docs].sort((left, right) => {
    const leftSectionIndex = DOC_SECTION_ORDER.indexOf(left.section);
    const rightSectionIndex = DOC_SECTION_ORDER.indexOf(right.section);
    const normalizedLeftSectionIndex = leftSectionIndex === -1 ? DOC_SECTION_ORDER.length : leftSectionIndex;
    const normalizedRightSectionIndex = rightSectionIndex === -1 ? DOC_SECTION_ORDER.length : rightSectionIndex;
    return normalizedLeftSectionIndex - normalizedRightSectionIndex || left.order - right.order || left.title.localeCompare(right.title);
  });
  const sectionSet = new Set(docs.map((doc) => doc.section));
  const sections = DOC_SECTION_ORDER.filter((section) => sectionSet.has(section)).concat(
    [...sectionSet].filter((section) => !DOC_SECTION_ORDER.includes(section))
  );

  return {
    docs,
    byId: new Map(docs.map((doc) => [doc.id, doc])),
    byUrl: new Map(docs.map((doc) => [doc.url, doc])),
    sections,
    allTags: [...new Set(docs.flatMap((doc) => doc.tags))].sort(),
    renderedMarkdown: new Map(),
    indexes: {
      [RankingAlgorithm.BM25]: loadSerializedIndexes(RankingAlgorithm.BM25, demoData.indexes[RankingAlgorithm.BM25]),
      [RankingAlgorithm.TFIDF]: loadSerializedIndexes(RankingAlgorithm.TFIDF, demoData.indexes[RankingAlgorithm.TFIDF])
    },
    semantic: await createSemanticRuntime(demoData.semantic)
  };
}

function createNavSections(context: RuntimeContext): NavSection[] {
  return context.sections
    .map((section) => ({
      name: section,
      docs: context.docs.filter((doc) => doc.section === section).sort((left, right) => left.order - right.order || left.title.localeCompare(right.title))
    }))
    .filter((section) => section.docs.length > 0);
}

function readCollapsedTocSections(allSectionNames: string[]): Set<string> {
  try {
    const raw = window.localStorage.getItem(TOC_SECTION_STORAGE_KEY);
    if (!raw) {
      return new Set(allSectionNames);
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((value): value is string => typeof value === "string")) : new Set();
  } catch {
    return new Set(allSectionNames);
  }
}

function writeCollapsedTocSections(sections: Set<string>): void {
  window.localStorage.setItem(TOC_SECTION_STORAGE_KEY, JSON.stringify([...sections]));
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

async function getSemanticQuestionResults(context: RuntimeContext, queryVector: number[], limit = 4): Promise<ChunkHitViewModel[]> {
  // The demo corpus is small enough to rerank every chunk exactly. That gives
  // more stable ask-the-docs behavior than relying on ANN bucket collisions.
  const byDocId = new Map<string, ChunkHitViewModel>();
  const candidateIds = [...context.semantic.chunkEmbeddingsById.keys()];

  (await context.semantic.chunkIndex.rerankAsync(queryVector, candidateIds, limit * 4))
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
  const filters: Query[] = [];
  const mustNot: TermQuery[] = [];
  if (current.section) {
    filters.push(new TermQuery({ field: "section", text: current.section }));
  }
  if (current.api) {
    filters.push(new TermQuery({ field: "api", text: current.api }));
  }
  if (current.tag) {
    filters.push(new TermQuery({ field: "tags", text: current.tag }));
  }
  const wordCountFacet = wordCountFacetByKey(current.wordCountFacet);
  if (wordCountFacet) {
    filters.push(new RangeQuery({
      field: "wordCount",
      range: {
        ...(wordCountFacet.from == null ? {} : { gte: String(wordCountFacet.from) }),
        ...(wordCountFacet.to == null ? {} : { lt: String(wordCountFacet.to) })
      }
    }));
  }
  if (current.excludeAdvanced) {
    mustNot.push(new TermQuery({ field: "level", text: "advanced" }));
  }
  return { filters, mustNot };
}

type QueryFilters = {
  filters: Query[];
  mustNot: TermQuery[];
};

function wordCountFacetByKey(key: string | null): WordCountFacet | null {
  return WORD_COUNT_FACETS.find((facet) => facet.key === key) ?? null;
}

async function searchForState(context: RuntimeContext, current: SearchState): Promise<SearchResult> {
  const startedAt = performance.now();
  // One search pass produces both the visible result list and the derived facet
  // data so the sidebar always reflects the currently selected result set.
  const active = context.indexes[current.ranking];
  const index = active.hydrated;
  const bodyIndex = index.getFieldIndex("body") as TextFieldIndex;
  const tagIndex = index.getFieldIndex("tags") as TextFieldIndex;
  const sectionIndex = index.getFieldIndex("section") as TextFieldIndex;
  const apiIndex = index.getFieldIndex("api") as TextFieldIndex;
  const wordCountIndex = index.getFieldIndex("wordCount") as NumericFieldIndex;
  const { queryText, quotedPhrase } = parseQueryInput(current.query);
  const trimmed = queryText.trim();
  const allowPrefixSuggestions = trimmed.length >= 2;
  const { filters, mustNot } = buildFacetFilterQueries(current);
  const filterOnlyQuery = filters.length > 0 || mustNot.length > 0 ? new BoolQuery({ filter: filters, mustNot }) : new MatchAll();

  const baseTextQuery =
    trimmed.length === 0
      ? new MatchAll()
      : new BoolQuery({
          should: [
            new MatchQuery({ field: "title", text: trimmed, operation: current.operation, prefixMatch: current.prefix, boost: 7 }),
            new MatchQuery({ field: "tagline", text: trimmed, operation: current.operation, prefixMatch: current.prefix, boost: 2.5 }),
            new MatchQuery({ field: "body", text: trimmed, operation: current.operation, prefixMatch: current.prefix, boost: 2 }),
            new MatchQuery({ field: "api", text: trimmed, operation: OP.OR, prefixMatch: current.prefix, boost: 2.75 }),
            new MatchQuery({ field: "tags", text: trimmed, operation: OP.OR, prefixMatch: current.prefix, boost: 2.25 })
          ],
          filter: filters,
          mustNot
        });

  const phraseQuery =
    trimmed.length === 0
      ? filterOnlyQuery
      : new BoolQuery({
          should: [
            new MatchPhrase({ field: "title", text: quotedPhrase ?? trimmed, slop: quotedPhrase ? 0 : 1, boost: 8 }),
            new MatchPhrase({ field: "body", text: quotedPhrase ?? trimmed, slop: quotedPhrase ? 1 : 2, boost: 3 })
          ],
          filter: filters,
          mustNot
        });

  const hybridLexicalQuery =
    trimmed.length === 0
      ? filterOnlyQuery
      : new BoolQuery({
          should: [
            new MatchPhrase({ field: "title", text: quotedPhrase ?? trimmed, slop: quotedPhrase ? 0 : 1, boost: 8 }),
            new MatchPhrase({ field: "body", text: quotedPhrase ?? trimmed, slop: quotedPhrase ? 1 : 2, boost: 3 }),
            ...(quotedPhrase
              ? []
              : [
                  new MatchQuery({ field: "title", text: trimmed, operation: current.operation, boost: 6 }),
                  new MatchQuery({ field: "tagline", text: trimmed, operation: current.operation, boost: 2.5 }),
                  new MatchQuery({ field: "body", text: trimmed, operation: current.operation, boost: 2 }),
                  new MatchQuery({ field: "api", text: trimmed, operation: OP.OR, boost: 2.75 }),
                  new MatchQuery({ field: "tags", text: trimmed, operation: OP.OR, boost: 2.25 }),
                  ...(allowPrefixSuggestions
                    ? [
                        new MatchQuery({ field: "title", text: trimmed, operation: OP.OR, prefixMatch: true, boost: 4 }),
                        new MatchQuery({ field: "suggest", text: trimmed, operation: OP.OR, prefixMatch: true, boost: 3 })
                      ]
                    : [])
                ])
          ],
          filter: filters,
          mustNot
        });

  const fuzzyHits =
    trimmed.length === 0
      ? []
      : await active.fuzzy.searchRequest({
          query: new MatchQuery({ field: "combined", text: trimmed, operation: OP.OR, boost: 1.5 }),
          limit: Number.MAX_SAFE_INTEGER
        });

  const allowedIds =
    filters.length > 0 || mustNot.length > 0
      ? (await index.searchRequest({ query: filterOnlyQuery })).map(([id]) => id)
      : undefined;
  const filterOnlySet = new Set(allowedIds ?? context.docs.map((doc) => doc.id));
  const filterOnlyHits: Hits = context.docs
    .filter((doc) => filterOnlySet.has(doc.id))
    .map((doc) => [doc.id, 1] as const);

  const phraseHits =
    trimmed.length === 0
      ? filterOnlyHits
      : await index.searchRequest({ query: phraseQuery, limit: Number.MAX_SAFE_INTEGER });
  const hybridLexicalHits =
    trimmed.length === 0
      ? filterOnlyHits
      : await index.searchRequest({ query: hybridLexicalQuery, limit: Number.MAX_SAFE_INTEGER });

  let fullFinalHits: Hits;
  let lexicalHits: Hits;
  let highlightQuery: BoolQuery | MatchAll | null = null;

  switch (current.mode) {
    case "phrase":
      lexicalHits = phraseHits;
      fullFinalHits = lexicalHits;
      highlightQuery = phraseQuery;
      break;
    case "fuzzy":
      lexicalHits = trimmed.length === 0 ? filterOnlyHits : [];
      fullFinalHits = trimmed.length === 0 ? lexicalHits : fuzzyHits;
      highlightQuery = null;
      break;
    case "match":
      lexicalHits = await index.searchRequest({ query: baseTextQuery, limit: Number.MAX_SAFE_INTEGER });
      fullFinalHits = rerankWithTitleBoost(context, trimmed, lexicalHits);
      highlightQuery = baseTextQuery;
      break;
    case "hybrid":
    default:
      lexicalHits = hybridLexicalHits;
      fullFinalHits =
        trimmed.length === 0
          ? lexicalHits
          : rerankWithTitleBoost(context, trimmed, reciprocalRankFusion([hybridLexicalHits, fuzzyHits], { rankConstant: 20, weights: [3, 1] }));
      highlightQuery = hybridLexicalQuery;
      break;
  }
  const normalizedOffset = Math.max(0, Math.min(current.offset, Math.max(fullFinalHits.length - 1, 0)));
  const visibleHits = fullFinalHits.slice(normalizedOffset, normalizedOffset + SEARCH_RESULTS_PAGE_SIZE);

  const highlightsById = new Map(
    (highlightQuery && trimmed.length > 0 ? visibleHits : [])
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

  const selectedIds = new Set(fullFinalHits.map(([id]) => id));
  const tagFacets = tagIndex.termsAggregation(12, selectedIds.size > 0 ? selectedIds : undefined);
  const sectionFacets = sectionIndex.termsAggregation(8, selectedIds.size > 0 ? selectedIds : undefined);
  const apiFacets = apiIndex.termsAggregation(10, selectedIds.size > 0 ? selectedIds : undefined);
  const wordCountStats = wordCountIndex.stats(selectedIds.size > 0 ? selectedIds : undefined);
  const wordCountFacets = wordCountIndex
    .rangeAggregation(WORD_COUNT_FACETS, selectedIds.size > 0 ? selectedIds : undefined)
    .map((bucket) => ({
      key: bucket.key,
      label: WORD_COUNT_FACETS.find((facet) => facet.key === bucket.key)?.label ?? bucket.key,
      docCount: bucket.docCount
    }));
  const wordCountHistogram = wordCountIndex.histogram(
    WORD_COUNT_HISTOGRAM_INTERVAL,
    selectedIds.size > 0 ? selectedIds : undefined
  );
  const hasScopedSearch = trimmed.length > 0 || filters.length > 0 || mustNot.length > 0;
  const significantTermsSubset =
    !hasScopedSearch
      ? null
      : selectedIds.size > 0 && selectedIds.size <= Math.floor(context.docs.length * 0.9)
        ? selectedIds
        : new Set(visibleHits.map(([id]) => id));
  const significantTerms =
    significantTermsSubset && significantTermsSubset.size > 0
      ? bodyIndex
          .significantTermsAggregation(20, significantTermsSubset)
          .filter((bucket) => !/^\d+$/.test(bucket.key) && bucket.score > 1.05 && bucket.subsetDocCount > 1)
          .slice(0, 10)
      : [];
  const responseTimeMs = Math.max(1, Math.round(performance.now() - startedAt));

  return {
    lexicalHits,
    fuzzyHits,
    vectorHits: [],
    finalHits: fullFinalHits,
    visibleHits,
    totalHits: fullFinalHits.length,
    offset: normalizedOffset,
    pageSize: SEARCH_RESULTS_PAGE_SIZE,
    responseTimeMs,
    highlightsById,
    selectedIds,
    tagFacets,
    sectionFacets,
    apiFacets,
    wordCountStats,
    wordCountFacets,
    wordCountHistogram,
    significantTerms
  };
}

function createShell(context: RuntimeContext): void {
  const navSections = createNavSections(context);
  const buildTimeLabel = formatRelativeBuildTime(BUILD_TIMESTAMP);
  const currentPath = window.location.pathname;
  const docsSearchClass = currentPath === "/" ? " nav-result-active" : "";
  const documentationClass = currentPath.startsWith("/docs/") && !currentPath.startsWith("/docs/api/") ? " nav-result-active" : "";
  const apiReferenceClass = currentPath.startsWith("/docs/api/") ? " nav-result-active" : "";

  requireApp().innerHTML = `
    <main id="demo-shell" class="demo-shell mx-auto w-[min(1560px,calc(100vw-24px))] py-6 lg:py-8" data-busy="false">
      <div id="demo-shell-content" class="demo-shell-content">
      <section class="surface mb-5 p-5 sm:p-6">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div class="max-w-3xl">
            <p class="text-xs font-semibold uppercase tracking-[0.22em] text-orange-700">Querylight TS Demo</p>
            <h1 class="mt-3 font-serif text-4xl leading-tight text-stone-950 sm:text-5xl">Documentation search and embedded analytics.</h1>
            <p class="mt-3 max-w-2xl text-sm leading-7 text-stone-600 sm:text-base">
              Explore the docs search experience or switch to the dashboard to see Querylight TS turn raw API payloads into faceted, local-first charts.
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <a href="/" class="chip-button${docsSearchClass}">Docs Search</a>
            <a href="/docs/" class="chip-button${documentationClass}">Documentation</a>
            <a href="/docs/api/" class="chip-button${apiReferenceClass}">API Reference</a>
            <a href="/dashboard/" class="chip-button">Dashboard</a>
          </div>
        </div>
        <p class="mt-4 text-xs text-stone-500">${escapeHtml(`Package ${packageMeta.version} · ${buildTimeLabel}`)}</p>
      </section>
      <section class="surface search-shell p-5 sm:p-6">
        <div class="mb-4 inline-flex rounded-full border border-stone-900/10 bg-white/75 p-1">
          <button id="experience-ask" type="button" class="chip-button">Ask the docs</button>
          <button id="experience-search" type="button" class="chip-button">Search</button>
        </div>
        <form id="query-form" class="search-form" autocomplete="off">
          <div class="search-input-wrap">
            <input id="query" class="control-input min-w-0 flex-1" placeholder="Search Querylight TS documentation" />
            <button id="clear-query" type="button" class="control-button control-button-muted">Clear</button>
            <button id="submit-query" type="submit" class="control-button">Search</button>
            <div id="suggestions" class="suggestions-panel hidden"></div>
          </div>
        </form>
        <div id="active-filters-inline" class="mt-4 flex flex-wrap gap-2"></div>
      </section>

      <section id="reader-layout" class="reader-layout reader-layout-below mt-5" data-mobile-panel="none">
        <div class="reader-mobile-bar">
          <button type="button" class="control-button control-button-muted reader-mobile-button" data-action="open-mobile-toc">Browse docs</button>
          <button type="button" class="control-button control-button-muted reader-mobile-button" data-action="open-mobile-filters">Search tools</button>
        </div>

        <aside class="reader-sidebar">
          <section class="surface reader-mobile-panel-shell p-5">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Table of Contents</p>
                <h2 class="mt-2 font-serif text-2xl text-stone-950">All Documentation</h2>
                <button id="go-home" type="button" class="chip-button mt-4" aria-label="Open docs start page">
                  ${DOCS_HOME_ICON}
                  <span>Docs start page</span>
                </button>
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
                    <details class="toc-section" data-section-shell="${escapeHtml(section.name)}">
                      <summary class="toc-section-summary">
                        <span class="toc-section-title">${escapeHtml(section.name)}</span>
                        <span class="toc-section-count" data-section-count="${escapeHtml(section.name)}">${section.docs.length}/${section.docs.length}</span>
                      </summary>
                      <div class="mt-3 grid gap-2" data-section-content="${escapeHtml(section.name)}"></div>
                    </details>
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
      </div>

      <div id="semantic-busy-overlay" class="semantic-busy-overlay" aria-hidden="true">
        <div class="semantic-busy-panel">
          <span class="semantic-busy-pulse" aria-hidden="true"></span>
          <p class="semantic-busy-label">Thinking</p>
          <p id="semantic-busy-message" class="semantic-busy-message">Thinking through the docs...</p>
        </div>
      </div>
    </main>
  `;
}

function syncSemanticBusyOverlay(): void {
  const shell = document.querySelector<HTMLElement>("#demo-shell");
  const shellContent = document.querySelector<HTMLElement>("#demo-shell-content");
  const overlay = document.querySelector<HTMLElement>("#semantic-busy-overlay");
  const overlayMessage = document.querySelector<HTMLElement>("#semantic-busy-message");
  const busy = isSemanticSearchBusy();

  if (!shell || !shellContent || !overlay || !overlayMessage) {
    return;
  }

  shell.dataset.busy = busy ? "true" : "false";
  shellContent.inert = busy;
  shellContent.setAttribute("aria-hidden", busy ? "true" : "false");
  overlay.setAttribute("aria-hidden", busy ? "false" : "true");
  overlayMessage.textContent = getSemanticOverlayMessage();
}

function updateSummary(context: RuntimeContext, summaryNode: HTMLParagraphElement, current: SearchResult | null): void {
  if (activeExperience === "ask") {
    summaryNode.textContent =
      semanticQuestionState.status === "ready"
        ? `${semanticQuestionState.results.length} answers · semantic chunks · ${context.semantic.backend === "webgpu" ? "WebGPU" : "CPU fallback"}`
        : semanticQuestionState.status === "error"
          ? "Ask the docs unavailable"
          : "Ask the docs";
    return;
  }
  if (!current) {
    summaryNode.textContent = "No active search";
    return;
  }
  const filters = [
    state.section ? `section:${state.section}` : "",
    state.api ? `api:${state.api}` : "",
    state.tag ? `tag:${state.tag}` : "",
    wordCountFacetByKey(state.wordCountFacet)?.label ? `length:${wordCountFacetByKey(state.wordCountFacet)?.label}` : "",
    state.excludeAdvanced ? "without advanced" : ""
  ].filter(Boolean).join(" · ");
  summaryNode.textContent = `${current.totalHits} results · ${state.mode} · ${state.ranking}${filters ? ` · ${filters}` : ""}`;
}

function renderToc(context: RuntimeContext, tocNode: HTMLDivElement, tocStatusNode: HTMLParagraphElement, current: SearchResult | null): void {
  const hasMatches = Boolean(current?.finalHits.length);
  const enabledIds = current?.finalHits.length ? current.selectedIds : new Set(context.docs.map((doc) => doc.id));

  tocStatusNode.textContent = hasMatches
    ? `${enabledIds.size} of ${context.docs.length} pages active`
    : `${context.docs.length} pages available`;

  createNavSections(context).forEach((section) => {
    const sectionShell = tocNode.querySelector<HTMLElement>(`[data-section-shell="${CSS.escape(section.name)}"]`);
    const sectionNode = tocNode.querySelector<HTMLDivElement>(`[data-section-content="${CSS.escape(section.name)}"]`);
    const countNode = tocNode.querySelector<HTMLElement>(`[data-section-count="${CSS.escape(section.name)}"]`);
    if (!sectionShell || !sectionNode || !countNode) {
      return;
    }
    const activeCount = section.docs.filter((doc) => enabledIds.has(doc.id)).length;
    sectionShell.dataset.hasActive = activeCount > 0 ? "true" : "false";
    countNode.textContent = `${activeCount}/${section.docs.length}`;

    sectionNode.innerHTML = section.docs
      .map((doc) => {
        const isActive = doc.id === activeDocId;
        const isEnabled = enabledIds.has(doc.id) || isActive;
        const meta = [doc.level, ...doc.tags.slice(0, 2)].join(" · ");
        return `
          <button
            class="toc-link ${isActive ? "toc-link-active" : ""} ${!isEnabled ? "toc-link-disabled" : ""}"
            data-doc="${escapeHtml(doc.id)}"
            ${isEnabled ? "" : "disabled"}
          >
            <span class="min-w-0 toc-link-body">
              <span class="toc-link-title">${escapeHtml(doc.title)}</span>
              <span class="toc-link-meta">${escapeHtml(meta)}</span>
            </span>
          </button>
        `;
      })
      .join("");
  });
}

function renderSuggestions(context: RuntimeContext, suggestionsNode: HTMLDivElement, current: SearchResult | null): void {
  if (currentView !== "home" || activeExperience !== "search" || !state.query.trim() || !current || current.finalHits.length === 0) {
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

function renderActiveFilters(...nodes: HTMLDivElement[]): void {
  const activeFilters = [
    state.section ? { label: `Section: ${state.section}`, facet: "section", value: state.section } : null,
    state.api ? { label: `API: ${state.api}`, facet: "api", value: state.api } : null,
    state.tag ? { label: `Tag: ${state.tag}`, facet: "tag", value: state.tag } : null,
    state.wordCountFacet
      ? { label: `Length: ${wordCountFacetByKey(state.wordCountFacet)?.label ?? state.wordCountFacet}`, facet: "word-count", value: state.wordCountFacet }
      : null
  ].filter(Boolean) as Array<{ label: string; facet: string; value: string }>;

  const content = activeFilters.length > 0
    ? activeFilters
        .map((filter) => `<button class="chip-button" data-facet="${filter.facet}" data-value="${escapeHtml(filter.value)}">${escapeHtml(filter.label)} ×</button>`)
        .join("")
    : `<p class="text-sm text-stone-500">No active facets.</p>`;

  nodes.forEach((node) => {
    node.innerHTML = content;
  });
}

function renderFacets(
  context: RuntimeContext,
  searchContext: SearchContextController,
  activeFiltersNode: HTMLDivElement,
  activeFiltersInlineNode: HTMLDivElement,
  facetSectionsNode: HTMLDivElement,
  current: SearchResult | null
): void {
  renderActiveFilters(activeFiltersNode, activeFiltersInlineNode);

  const source = current ?? searchContext.peek({ ...initialState });
  if (!source) {
    facetSectionsNode.innerHTML = `<div class="grid gap-5"><p class="text-sm text-stone-500">Loading facets…</p></div>`;
    return;
  }
  const sectionFacets = Object.entries(source.sectionFacets);
  const tagFacets = Object.entries(source.tagFacets);
  const apiFacets = Object.entries(source.apiFacets);
  const wordCountFacets = source.wordCountFacets;
  const wordCountHistogram = source.wordCountHistogram;
  const maxWordCountBucket = Math.max(...wordCountHistogram.map((bucket) => bucket.docCount), 1);
  const significantTerms = source.significantTerms.slice(0, 6);
  const wordCountAverage = source.wordCountStats.avg == null ? "n/a" : Math.round(source.wordCountStats.avg).toLocaleString();
  const wordCountRange =
    source.wordCountStats.min == null || source.wordCountStats.max == null
      ? "n/a"
      : `${source.wordCountStats.min.toLocaleString()}-${source.wordCountStats.max.toLocaleString()}`;

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
        <div class="flex items-end justify-between gap-3">
          <h3 class="text-sm font-semibold text-stone-900">Article Length</h3>
          <p class="text-xs text-stone-500">avg ${escapeHtml(wordCountAverage)} words</p>
        </div>
        <p class="mt-2 text-xs text-stone-500">${source.wordCountStats.count} values indexed · range ${escapeHtml(wordCountRange)}</p>
        <div class="mt-3 flex flex-wrap gap-2">
          ${wordCountFacets.map((bucket) => `<button class="chip-button" data-facet="word-count" data-value="${escapeHtml(bucket.key)}">${escapeHtml(bucket.label)} <span class="text-stone-400">${bucket.docCount}</span></button>`).join("") || `<p class="text-sm text-stone-500">No length buckets.</p>`}
        </div>
        <div class="word-count-histogram mt-4">
          ${wordCountHistogram.map((bucket) => `
            <button
              type="button"
              class="word-count-bar"
              data-facet="word-count"
              data-value="${escapeHtml(
                WORD_COUNT_FACETS.find((facet) =>
                  (facet.from == null || bucket.key >= facet.from) &&
                  (facet.to == null || bucket.key < facet.to)
                )?.key ?? ""
              )}"
              title="${escapeHtml(`${bucket.key.toLocaleString()}-${(bucket.key + WORD_COUNT_HISTOGRAM_INTERVAL - 1).toLocaleString()} words · ${bucket.docCount} docs`)}"
            >
              <span class="word-count-bar-label">${escapeHtml(bucket.key.toLocaleString())}</span>
              <span class="word-count-bar-track"><span class="word-count-bar-fill" style="width:${(bucket.docCount / maxWordCountBucket) * 100}%"></span></span>
              <span class="word-count-bar-count">${bucket.docCount}</span>
            </button>
          `).join("") || `<p class="text-sm text-stone-500">No histogram buckets.</p>`}
        </div>
      </section>
      <section>
        <h3 class="text-sm font-semibold text-stone-900">Significant Terms</h3>
        <div class="mt-3 flex flex-wrap gap-2">
          ${significantTerms
            .map((bucket) => `<button class="chip-button" data-example="${escapeHtml(bucket.key)}">${escapeHtml(bucket.key)} <span class="text-stone-400">${bucket.score.toFixed(2)}</span></button>`)
            .join("") || `<p class="text-sm text-stone-500">Do a lexical search to get significant terms.</p>`}
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
                <span class="text-xs uppercase tracking-[0.12em] text-stone-500">${escapeHtml(doc.section)}</span>
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
  const pageStart = current.totalHits === 0 ? 0 : current.offset + 1;
  const pageEnd = current.offset + current.visibleHits.length;
  const showPrevious = current.offset > 0;
  const showNext = pageEnd < current.totalHits;
  centerNode.innerHTML = `
    <article class="surface reader-page px-6 py-8 sm:px-8 sm:py-10">
      <header>
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Search Results</p>
        <h1 class="mt-2 font-serif text-[clamp(2.4rem,5vw,4rem)] leading-none text-stone-950">${state.query.trim() || "All documentation"}</h1>
        <p id="result-count" class="mt-3 text-sm text-stone-600">${current.totalHits} matches · ${current.responseTimeMs} ms${current.offset > 0 ? ` · offset ${current.offset}` : ""}${current.totalHits > 0 ? ` · showing ${pageStart}-${pageEnd}` : ""}</p>
        ${
          current.totalHits > current.pageSize
            ? `
              <div class="mt-4 flex flex-wrap gap-2">
                <button type="button" class="chip-button" data-action="page-previous" ${showPrevious ? "" : "disabled"}>Previous</button>
                <button type="button" class="chip-button" data-action="page-next" ${showNext ? "" : "disabled"}>Next</button>
              </div>
            `
            : ""
        }
      </header>
      <div class="mt-8 grid gap-3">
        ${
          current.totalHits === 0
            ? `<div class="rounded-3xl border border-dashed border-stone-900/10 bg-stone-50/80 px-5 py-4 text-sm text-stone-600">No matches found. Try a broader query or remove some facets.</div>`
            : current.visibleHits
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
                        <span>${current.offset + index + 1}. ${escapeHtml(doc.section)}</span>
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
  const topResults = current?.visibleHits.slice(0, 3) ?? [];
  const renderedMarkdown =
    context.renderedMarkdown.get(doc.id) ?? markdown.render(rewriteDocMarkdownLinks(doc.markdown, doc.path));
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
              ${doc.apis.map((api) => `<button class="chip-button" data-facet="api" data-facet-origin="detail" data-value="${escapeHtml(api)}">${escapeHtml(api)}</button>`).join("")}
            </div>
          </div>
          <div class="mt-5">
            <h2 class="font-serif text-xl text-stone-950">Tags</h2>
            <div class="mt-3 flex flex-wrap gap-2">
              ${doc.tags.map((tag) => `<button class="chip-button" data-facet="tag" data-facet-origin="detail" data-value="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join("")}
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

function renderAskResultsPage(context: RuntimeContext, centerNode: HTMLDivElement): void {
  const statusMessage =
    semanticQuestionState.status === "loading-model"
      ? "Loading the embedding model for the first semantic query."
      : semanticQuestionState.status === "searching"
        ? "Matching your question against semantic chunks."
        : semanticQuestionState.status === "error"
          ? semanticQuestionState.error ?? "Semantic search failed."
        : semanticQuestionState.status === "ready"
            ? `${semanticQuestionState.results.length} semantic matches · ${context.semantic.backend === "webgpu" ? "WebGPU" : "CPU fallback"}`
            : `Ask a natural-language question and match it against article chunks. ${context.semantic.backend === "webgpu" ? "WebGPU acceleration is active." : "Using CPU fallback."}`;

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
    renderAskResultsPage(context, centerNode);
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

function normalizeResultOffset(result: SearchResult): number {
  if (result.totalHits === 0) {
    return 0;
  }
  return Math.min(result.offset, Math.max(result.totalHits - 1, 0));
}

async function wireApp(context: RuntimeContext): Promise<() => void> {
  const searchContext = new SearchContextController(context, initialState);
  await searchContext.resultFor({ ...initialState });
  const queryForm = document.querySelector<HTMLFormElement>("#query-form");
  const queryInput = document.querySelector<HTMLInputElement>("#query");
  const homeButton = document.querySelector<HTMLButtonElement>("#go-home");
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
  const activeFiltersInlineNode = document.querySelector<HTMLDivElement>("#active-filters-inline");
  const facetSectionsNode = document.querySelector<HTMLDivElement>("#facet-sections");
  const readerLayout = document.querySelector<HTMLElement>("#reader-layout");

  if (
    !queryForm ||
    !queryInput ||
    !homeButton ||
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
    !activeFiltersInlineNode ||
    !facetSectionsNode ||
    !readerLayout
  ) {
    throw new Error("app nodes not found");
  }

  const eventController = new AbortController();
  const { signal } = eventController;

  const sectionNames = createNavSections(context).map((section) => section.name);
  const collapsedSections = readCollapsedTocSections(sectionNames);
  const setSectionCollapsed = (sectionName: string, collapsed: boolean) => {
    const sectionNode = tocNode.querySelector<HTMLDetailsElement>(`[data-section-shell="${CSS.escape(sectionName)}"]`);
    if (!sectionNode) {
      return;
    }
    sectionNode.open = !collapsed;
    if (collapsed) {
      collapsedSections.add(sectionName);
    } else {
      collapsedSections.delete(sectionName);
    }
    writeCollapsedTocSections(collapsedSections);
  };

  const expandSectionForDoc = (docId: string) => {
    const doc = context.byId.get(docId);
    if (!doc) {
      return;
    }
    setSectionCollapsed(doc.section, false);
  };

  tocNode.querySelectorAll<HTMLDetailsElement>("[data-section-shell]").forEach((sectionNode) => {
    const sectionName = sectionNode.dataset.sectionShell ?? "";
    sectionNode.open = !collapsedSections.has(sectionName);
    sectionNode.addEventListener("toggle", () => {
      if (!sectionName) {
        return;
      }
      if (sectionNode.open) {
        collapsedSections.delete(sectionName);
      } else {
        collapsedSections.add(sectionName);
      }
      writeCollapsedTocSections(collapsedSections);
    }, { signal });
  });

  const setMobilePanel = (panel: "none" | "toc" | "filters") => {
    readerLayout.dataset.mobilePanel = panel;
    document.body.classList.toggle("mobile-panel-open", panel !== "none");
  };

  const closeMobilePanel = () => {
    setMobilePanel("none");
  };

  const goHome = () => {
    state = searchContext.replace({ ...initialState });
    activeExperience = "search";
    submittedResult = null;
    suggestionResult = null;
    semanticQuestionState = {
      query: "",
      status: "idle",
      results: [],
      error: null
    };
    currentView = "home";
    activeDocId = "";
    activeChunkId = null;
    clearDetailHash();
    hideSuggestions();
    renderApp();
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
    syncSemanticBusyOverlay();
    updateSummary(context, summaryNode, submittedResult);
    renderToc(context, tocNode, tocStatusNode, submittedResult);
    renderFacets(context, searchContext, activeFiltersNode, activeFiltersInlineNode, facetSectionsNode, submittedResult);
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
    if (!detailHash) {
      return;
    }
    const doc = context.byUrl.get(detailHash.docUrl);
    if (!doc) {
      return;
    }
    activeDocId = doc.id;
    expandSectionForDoc(activeDocId);
    activeChunkId = detailHash.chunkId
      ? [...context.semantic.chunkEmbeddingsById.values()].find(
          (chunk) => chunk.docId === doc.id && serializeHeadingPath(chunk.headingPath) === detailHash.chunkId
        )?.chunkId ?? null
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

      const results = await getSemanticQuestionResults(context, embedding);
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

  const runSubmittedSearch = async (nextView: "results" | "detail" = "results") => {
    suggestionResult = null;
    submittedResult = await searchContext.resultFor(state);
    const normalizedOffset = normalizeResultOffset(submittedResult);
    if (normalizedOffset !== state.offset) {
      state = searchContext.patch({ offset: normalizedOffset });
      submittedResult = await searchContext.resultFor(state);
    }
    if (submittedResult.finalHits.length > 0 && !submittedResult.selectedIds.has(activeDocId)) {
      activeDocId = submittedResult.finalHits[0]?.[0] ?? "";
    }
    currentView = nextView;
    if (nextView !== "detail") {
      clearDetailHash();
    }
    renderApp();
  };

  const syncViewFromLocation = async () => {
    const detailHash = parseDetailHash();
    if (detailHash && window.location.pathname !== "/") {
      applyLocationHash();
      renderApp();
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const nextQuery = params.get("q") ?? "";
    const nextApi = params.get("api");
    const nextTag = params.get("tag");

    state = searchContext.replace({ ...initialState });
    submittedResult = null;
    suggestionResult = null;
    activeDocId = "";
    activeChunkId = null;
    activeExperience = "search";
    state = searchContext.patch({
      query: nextQuery,
      offset: 0,
      api: nextApi,
      tag: nextTag
    });

    if (state.query.trim()) {
      setSearchModeFromQuery(state.query);
      submittedResult = await searchContext.resultFor(state);
      currentView = "results";
    } else if (state.tag || state.api || state.section || state.wordCountFacet || state.excludeAdvanced) {
      submittedResult = await searchContext.resultFor(state);
      currentView = "results";
    } else if (currentView !== "ask") {
      submittedResult = null;
      suggestionResult = null;
      activeDocId = "";
      activeChunkId = null;
      currentView = "home";
    }
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
    pendingSuggestions = window.setTimeout(async () => {
      pendingSuggestions = null;
      suggestionResult = await searchContext.resultFor(state);
      renderSuggestionsOnly();
    }, SEARCH_INPUT_DEBOUNCE_MS);
  };

  const resetToHomeIfEmpty = () => {
    if (!state.query.trim() && !state.tag && !state.api && !state.section && !state.wordCountFacet && !state.excludeAdvanced) {
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
      state = searchContext.patch({ query: queryInput.value, offset: 0 });
    }
    syncControls();
    scheduleSuggestions();
  }, { signal });

  queryInput.addEventListener("focus", () => {
    scheduleSuggestions();
  }, { signal });

  queryInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideSuggestions();
      return;
    }
    if (event.key === "Enter" && activeExperience === "ask") {
      event.preventDefault();
      void runSemanticSearch();
    }
  }, { signal });

  queryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (activeExperience === "ask") {
      void runSemanticSearch();
    } else {
      void runSubmittedSearch("results");
    }
  }, { signal });

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
      state = searchContext.patch({ query: "", offset: 0 });
    }
    resetToHomeIfEmpty();
    queryInput.focus();
    renderApp();
  }, { signal });

  homeButton.addEventListener("click", () => {
    closeMobilePanel();
    goHome();
  }, { signal });

  experienceSearchButton.addEventListener("click", () => {
    activeExperience = "search";
    if (!submittedResult && !state.query.trim()) {
      currentView = "home";
    } else if (submittedResult) {
      currentView = currentView === "detail" ? "detail" : "results";
    }
    renderApp();
  }, { signal });

  experienceAskButton.addEventListener("click", () => {
    activeExperience = "ask";
    currentView = semanticQuestionState.results.length > 0 ? "ask" : "home";
    hideSuggestions();
    renderApp();
  }, { signal });

  const applySearchOptions = async () => {
    if (currentView === "home" && !submittedResult) {
      renderShell();
      return;
    }
    await runSubmittedSearch(currentView === "detail" ? "detail" : "results");
  };

  modeSelect.addEventListener("change", () => {
    state = searchContext.patch({ mode: modeSelect.value as SearchMode, offset: 0 });
    void applySearchOptions();
  }, { signal });
  rankingSelect.addEventListener("change", () => {
    state = searchContext.patch({ ranking: rankingSelect.value as RankingAlgorithm, offset: 0 });
    void applySearchOptions();
  }, { signal });
  operationSelect.addEventListener("change", () => {
    state = searchContext.patch({ operation: operationSelect.value as OP, offset: 0 });
    void applySearchOptions();
  }, { signal });
  prefixInput.addEventListener("change", () => {
    state = searchContext.patch({ prefix: prefixInput.checked, offset: 0 });
    void applySearchOptions();
  }, { signal });
  excludeAdvancedInput.addEventListener("change", () => {
    state = searchContext.patch({ excludeAdvanced: excludeAdvancedInput.checked, offset: 0 });
    void applySearchOptions();
  }, { signal });

  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const anchorTarget = target.closest<HTMLAnchorElement>("a[href]");
    if (
      anchorTarget &&
      !anchorTarget.target &&
      !anchorTarget.hasAttribute("download") &&
      !event.defaultPrevented &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      const rawHref = anchorTarget.getAttribute("href") ?? anchorTarget.href;
      const activeDoc = activeDocId ? context.byId.get(activeDocId) : null;
      const normalizedHref = activeDoc ? resolveDocLink(activeDoc.path, rawHref) : rawHref;
      const targetUrl = new URL(normalizedHref, window.location.href);
      if (targetUrl.origin === window.location.origin && isSearchRoute(targetUrl.pathname)) {
        if (targetUrl.pathname === "/") {
          event.preventDefault();
          window.history.pushState({ view: "search" }, "", `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`);
          void syncViewFromLocation();
          return;
        }

        const doc = context.byUrl.get(normalizeDocUrl(targetUrl.pathname));
        if (doc && targetUrl.pathname.startsWith("/docs/")) {
          event.preventDefault();
          window.history.pushState({ view: "detail", docId: doc.id }, "", `${normalizeDocUrl(targetUrl.pathname)}${targetUrl.hash}`);
          void syncViewFromLocation();
          return;
        }
      }
    }

    const backToResults = target.closest<HTMLElement>("[data-action='back-to-results']");
    if (backToResults) {
      if (submittedResult) {
        currentView = "results";
      }
      activeChunkId = null;
      activeExperience = "search";
      if (window.location.pathname.startsWith("/docs/")) {
        window.history.back();
        return;
      } else {
        clearDetailHash();
      }
      renderShell();
      return;
    }

    const pageAction = target.closest<HTMLElement>("[data-action='page-previous'], [data-action='page-next']")?.dataset.action;
    if (pageAction && submittedResult) {
      const nextOffset =
        pageAction === "page-previous"
          ? Math.max(0, submittedResult.offset - submittedResult.pageSize)
          : submittedResult.offset + submittedResult.pageSize;
      state = searchContext.patch({ offset: nextOffset });
      void (async () => {
        submittedResult = await searchContext.resultFor(state);
        currentView = "results";
        hideSuggestions();
        renderApp();
      })();
      return;
    }

    const example = target.closest<HTMLElement>("[data-example]")?.dataset.example;
    if (example) {
      state.query = example;
      state.offset = 0;
      setSearchModeFromQuery(example);
      closeMobilePanel();
      activeExperience = "search";
      void runSubmittedSearch("results");
      return;
    }

    const docTarget = target.closest<HTMLElement>("[data-doc]");
    const docId = docTarget?.dataset.doc;
    if (docId) {
      const doc = context.byId.get(docId);
      if (!doc) {
        return;
      }
      const chunkId = docTarget?.dataset.chunkId ?? null;
      activeDocId = doc.id;
      activeChunkId = chunkId;
      activeExperience = currentView === "ask" ? "ask" : "search";
      currentView = "detail";
      updateDetailHash(doc, chunkId);
      closeMobilePanel();
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
    const facetOrigin = facetTarget.dataset.facetOrigin;
    const value = facetTarget.dataset.value ?? "";
    if (facet === "tag" || facet === "api" || facet === "section" || facet === "word-count") {
      state = searchContext.toggleFacet(facet, value);
      state = searchContext.patch({ offset: 0 });
    }
    closeMobilePanel();
    activeExperience = "search";
    void (async () => {
      submittedResult = await searchContext.resultFor(state);
      currentView = "results";
      clearDetailHash();
      renderApp();
    })();
  }, { signal });

  window.addEventListener("resize", syncViewportState, { signal });
  window.addEventListener("popstate", () => {
    void syncViewFromLocation();
  }, { signal });

  await syncViewFromLocation();
  syncViewportState();

  return () => {
    if (pendingSuggestions !== null) {
      window.clearTimeout(pendingSuggestions);
    }
    eventController.abort();
    document.body.classList.remove("mobile-panel-open");
  };
}

let runtimeContextPromise: Promise<RuntimeContext> | null = null;

async function readGzippedJson<T>(response: Response): Promise<T> {
  if (!response.body) {
    throw new Error("failed to read compressed demo data response body");
  }
  if (typeof DecompressionStream !== "function") {
    throw new Error("this browser does not support gzip-compressed demo data");
  }
  const decompressed = response.body.pipeThrough(new DecompressionStream("gzip"));
  return await new Response(decompressed).json() as T;
}

async function loadRuntimeContext(): Promise<RuntimeContext> {
  const response = await fetch("/data/demo-data.json.gz");
  if (!response.ok) {
    throw new Error(`failed to load demo data: ${response.status} ${response.statusText}`);
  }
  const demoData = await readGzippedJson<DemoDataPayload>(response);
  return createRuntimeContext(demoData);
}

function resetSearchState(): void {
  state = { ...initialState };
  activeDocId = "";
  activeChunkId = null;
  currentView = "home";
  activeExperience = "ask";
  submittedResult = null;
  suggestionResult = null;
  semanticQuestionState = {
    query: "",
    status: "idle",
    results: [],
    error: null
  };
}

export async function mountSearchApp(nextApp: HTMLDivElement): Promise<() => void> {
  app = nextApp;
  resetSearchState();
  renderLoading("Loading prebuilt documentation search indexes.");
  runtimeContextPromise ??= loadRuntimeContext();

  try {
    const context = await runtimeContextPromise;
    createShell(context);
    return await wireApp(context);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    requireApp().innerHTML = `
      <main class="mx-auto min-h-screen w-[min(1200px,calc(100vw-32px))] py-8">
        <section class="surface p-8">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">Load Error</p>
          <h1 class="mt-3 font-serif text-4xl text-stone-950">Documentation bootstrap failed</h1>
          <pre class="mt-4 overflow-x-auto rounded-3xl border border-red-900/10 bg-red-50 p-4 text-sm text-red-900">${escapeHtml(message)}</pre>
        </section>
      </main>
    `;
    return () => {
      document.body.classList.remove("mobile-panel-open");
    };
  }
}
