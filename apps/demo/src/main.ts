import "./styles.css";
import "highlight.js/styles/github.css";
import {
  Analyzer,
  BoolQuery,
  DocumentIndex,
  EdgeNgramsTokenFilter,
  GeoFieldIndex,
  GeoPointQuery,
  GeoPolygonQuery,
  KeywordTokenizer,
  MatchAll,
  MatchPhrase,
  MatchQuery,
  NgramTokenFilter,
  OP,
  RangeQuery,
  RankingAlgorithm,
  TermQuery,
  TextFieldIndex,
  VectorFieldIndex,
  bigramVector,
  createSeededRandom,
  rectangleToPolygon,
  type Document,
  type Hits
} from "@querylight/core";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import typescript from "highlight.js/lib/languages/typescript";
import MarkdownIt from "markdown-it";

type SearchMode = "hybrid" | "match" | "phrase" | "fuzzy" | "vector" | "geo-point" | "geo-polygon" | "all";

type DocEntry = {
  id: string;
  section: string;
  title: string;
  summary: string;
  tags: string[];
  apis: string[];
  level: "foundation" | "querying" | "indexing" | "advanced";
  order: string;
  city: string;
  point: [number, number];
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
  geoHits: Hits;
  finalHits: Hits;
  selectedIds: Set<string>;
  tagFacets: Record<string, number>;
  sectionFacets: Record<string, number>;
  apiFacets: Record<string, number>;
  significantTerms: Record<string, [number, number]>;
};

type RuntimeIndexes = {
  hydrated: DocumentIndex;
  fuzzy: DocumentIndex;
  vector: VectorFieldIndex;
  geo: DocumentIndex;
  serialized: ReturnType<DocumentIndex["indexState"]>;
};

type RuntimeContext = {
  docs: DocEntry[];
  byId: Map<string, DocEntry>;
  sections: string[];
  allTags: string[];
  allCities: string[];
  indexes: Record<RankingAlgorithm, RuntimeIndexes>;
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

const tagAnalyzer = new Analyzer([], new KeywordTokenizer());
const fuzzyAnalyzer = new Analyzer(undefined, undefined, [new NgramTokenFilter(3)]);
const edgeAnalyzer = new Analyzer(undefined, undefined, [new EdgeNgramsTokenFilter(2, 6)]);
const vectorAnalyzer = new Analyzer();
const SEARCH_INPUT_DEBOUNCE_MS = 150;
const docModules = import.meta.glob("../../../docs/*.md", {
  query: "?raw",
  import: "default"
});

const initialState: SearchState = {
  query: "phrase search",
  mode: "hybrid",
  operation: OP.AND,
  prefix: false,
  ranking: RankingAlgorithm.BM25,
  tag: null,
  section: null,
  excludeAdvanced: false
};

let state: SearchState = { ...initialState };
let activeDocId = "";

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

function stripMarkdown(value: string): string {
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

function toDocEntry(path: string, raw: string): DocEntry {
  const { metadata, body: markdownBody } = parseFrontmatter(raw);
  const title = metadata.title;
  const summary = metadata.summary;
  const id = metadata.id;
  const section = metadata.section;
  const level = metadata.level as DocEntry["level"];
  const order = metadata.order;
  const city = metadata.city;
  const lat = Number(metadata.lat);
  const lon = Number(metadata.lon);

  if (!title || !summary || !id || !section || !level || !order || !city || Number.isNaN(lat) || Number.isNaN(lon)) {
    throw new Error(`invalid doc metadata in ${path}`);
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
    city,
    point: [lat, lon],
    markdown: markdownBody,
    body: stripMarkdown(markdownBody),
    examples: extractCodeBlocks(markdownBody),
    path
  };
}

async function loadDocs(): Promise<DocEntry[]> {
  const loaded = await Promise.all(
    Object.entries(docModules).map(async ([path, loader]) => {
      const raw = await loader();
      return toDocEntry(path, raw as string);
    })
  );
  return loaded.sort((left, right) => left.order.localeCompare(right.order));
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
      combined: [entry.title, entry.summary, entry.body, entry.tags.join(" "), entry.apis.join(" "), entry.examples.join(" ")].join(" "),
      suggest: [entry.title, entry.tags.join(" "), entry.apis.join(" ")].join(" "),
      order: [entry.order],
      location: [JSON.stringify({ type: "Point", coordinates: [entry.point[1], entry.point[0]] })]
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
    order: new TextFieldIndex(tagAnalyzer, tagAnalyzer),
    location: new GeoFieldIndex()
  });
}

function createIndexes(docs: DocEntry[], ranking: RankingAlgorithm): RuntimeIndexes {
  const source = createDocIndex(ranking);
  const fuzzy = new DocumentIndex({
    combined: new TextFieldIndex(fuzzyAnalyzer, fuzzyAnalyzer, ranking)
  });
  const vector = new VectorFieldIndex(6, 36 * 36, createSeededRandom(42));
  const geo = new DocumentIndex({
    location: new GeoFieldIndex()
  });

  docs.forEach((entry) => {
    const doc = toDocument(entry);
    source.index(doc);
    fuzzy.index({ id: entry.id, fields: { combined: [doc.fields.combined?.[0] ?? ""] } });
    geo.index({ id: entry.id, fields: { location: doc.fields.location ?? [] } });
    vector.insert(entry.id, [bigramVector(doc.fields.combined?.[0] ?? "", vectorAnalyzer)]);
  });

  const serialized = JSON.parse(JSON.stringify(source.indexState));
  return {
    hydrated: createDocIndex(ranking).loadState(serialized),
    fuzzy,
    vector,
    geo,
    serialized
  };
}

function createRuntimeContext(docs: DocEntry[]): RuntimeContext {
  return {
    docs,
    byId: new Map(docs.map((doc) => [doc.id, doc])),
    sections: [...new Set(docs.map((doc) => doc.section))],
    allTags: [...new Set(docs.flatMap((doc) => doc.tags))].sort(),
    allCities: [...new Set(docs.map((doc) => doc.city))],
    indexes: {
      [RankingAlgorithm.BM25]: createIndexes(docs, RankingAlgorithm.BM25),
      [RankingAlgorithm.TFIDF]: createIndexes(docs, RankingAlgorithm.TFIDF)
    }
  };
}

function mergeHits(...groups: Hits[]): Hits {
  const scores = new Map<string, number>();
  groups.forEach((hits, index) => {
    const weight = Math.max(0.25, 1 - index * 0.2);
    hits.forEach(([id, score]) => {
      scores.set(id, (scores.get(id) ?? 0) + score * weight);
    });
  });
  return [...scores.entries()].sort((a, b) => b[1] - a[1]);
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
  const active = context.indexes[current.ranking];
  const index = active.hydrated;
  const bodyIndex = index.getFieldIndex("body") as TextFieldIndex;
  const tagIndex = index.getFieldIndex("tags") as TextFieldIndex;
  const sectionIndex = index.getFieldIndex("section") as TextFieldIndex;
  const apiIndex = index.getFieldIndex("api") as TextFieldIndex;
  const { queryText, quotedPhrase } = parseQueryInput(current.query);
  const trimmed = queryText.trim();
  const { filters, mustNot } = buildFacetFilterQueries(current);

  const baseTextQuery =
    trimmed.length === 0
      ? new MatchAll()
      : new BoolQuery(
          [
            new MatchQuery("title", trimmed, current.operation, current.prefix, 4),
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
      ? new BoolQuery([], [], filters, mustNot)
      : new BoolQuery(
          [
            new MatchPhrase("title", quotedPhrase ?? trimmed, 0, 4),
            new MatchPhrase("body", quotedPhrase ?? trimmed, 1, 3),
            new MatchPhrase("examples", quotedPhrase ?? trimmed, 1, 2)
          ],
          [],
          filters,
          mustNot
        );

  const fuzzyHits =
    trimmed.length === 0
      ? []
      : active.fuzzy.searchRequest({
          query: new MatchQuery("combined", trimmed, OP.AND, false, 1.5),
          limit: 20
        });

  const allowedIds =
    filters.length > 0 || mustNot.length > 0
      ? index.searchRequest({ query: new BoolQuery([], [], filters, mustNot) }).map(([id]) => id)
      : undefined;

  const vectorHits =
    trimmed.length === 0
      ? []
      : active.vector.query(bigramVector(trimmed, vectorAnalyzer), 20, allowedIds);

  const geoPointHits = active.geo.searchRequest({
    query: new GeoPointQuery("location", 52.52, 13.405)
  });
  const geoPolygonHits = active.geo.searchRequest({
    query: new GeoPolygonQuery("location", rectangleToPolygon(-10, 48, 25, 61))
  });

  let finalHits: Hits;
  let lexicalHits: Hits;
  let geoHits: Hits = [];

  switch (current.mode) {
    case "all":
      lexicalHits = index.searchRequest({ query: new BoolQuery([], [], filters, mustNot) });
      finalHits = lexicalHits;
      break;
    case "phrase":
      lexicalHits = index.searchRequest({ query: phraseQuery, limit: 20 });
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
    case "geo-point":
      lexicalHits = [];
      geoHits = geoPointHits;
      finalHits = geoPointHits;
      break;
    case "geo-polygon":
      lexicalHits = [];
      geoHits = geoPolygonHits;
      finalHits = geoPolygonHits;
      break;
    case "match":
      lexicalHits = index.searchRequest({ query: baseTextQuery, limit: 20 });
      finalHits = lexicalHits;
      break;
    case "hybrid":
    default:
      lexicalHits = index.searchRequest({ query: baseTextQuery, limit: 20 });
      finalHits = mergeHits(index.searchRequest({ query: phraseQuery, limit: 10 }), lexicalHits, fuzzyHits, vectorHits);
      break;
  }

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
    vectorHits,
    geoHits,
    finalHits,
    selectedIds,
    tagFacets,
    sectionFacets,
    apiFacets,
    significantTerms
  };
}

function createShell(context: RuntimeContext): void {
  app.innerHTML = `
    <main class="mx-auto grid w-[min(1200px,calc(100vw-32px))] gap-5 py-8">
      <section class="surface p-7 md:p-8">
        <div class="max-w-4xl">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Documentation Browser Demo</p>
          <h1 class="mt-2 font-serif text-[clamp(2.8rem,8vw,5.1rem)] leading-none text-stone-950">Querylight TS in depth</h1>
          <p class="mt-4 max-w-3xl text-lg text-stone-600">This app loads markdown from the repository <code>docs/</code> folder at runtime, renders it as documentation, and indexes it in the browser with Querylight. It exercises BM25, TF-IDF, phrase search, prefix expansion, bool filtering, aggregations, significant terms, fuzzy ngrams, vectors, geo queries, and hydrated JSON state.</p>
        </div>
        <div class="mt-6 grid gap-3 md:grid-cols-6">
          <label class="md:col-span-2">
            <span class="mb-2 block text-sm font-semibold text-stone-700">Search the docs</span>
            <input id="query" class="control-input" placeholder="Try: phrase search, vectro serch, portable json index state, geo polygon" />
          </label>
          <label>
            <span class="mb-2 block text-sm font-semibold text-stone-700">Mode</span>
            <select id="mode" class="control-input">
              <option value="hybrid">Hybrid</option>
              <option value="match">Match</option>
              <option value="phrase">Phrase</option>
              <option value="fuzzy">Fuzzy (ngrams)</option>
              <option value="vector">Vector</option>
              <option value="geo-point">Geo point</option>
              <option value="geo-polygon">Geo polygon</option>
              <option value="all">Match all</option>
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
          <div class="grid gap-3">
            <label class="flex min-h-[54px] items-center gap-3 rounded-2xl border border-stone-900/10 bg-white/80 px-4">
              <input id="prefix" type="checkbox" class="size-4 accent-orange-700" />
              <span class="text-sm font-medium text-stone-700">Enable prefix expansion</span>
            </label>
            <label class="flex min-h-[54px] items-center gap-3 rounded-2xl border border-stone-900/10 bg-white/80 px-4">
              <input id="exclude-advanced" type="checkbox" class="size-4 accent-orange-700" />
              <span class="text-sm font-medium text-stone-700">Hide advanced topics</span>
            </label>
          </div>
        </div>
        <div id="examples" class="mt-5 flex flex-wrap gap-2"></div>
      </section>

      <section class="surface p-6">
        <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Live Results</p>
            <h2 id="summary-title" class="font-serif text-3xl text-stone-950">Documentation Results</h2>
          </div>
          <p id="summary" class="text-sm text-stone-600"></p>
        </div>
        <div class="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(320px,0.95fr)]">
          <div id="results" class="grid gap-3"></div>
          <aside class="grid gap-4">
            <div class="rounded-3xl border border-stone-900/10 bg-white/60 p-4">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Facets</p>
              <div class="mt-4">
                <h3 class="font-serif text-lg text-stone-950">Sections</h3>
                <div id="section-facets" class="mt-3 flex flex-wrap gap-2"></div>
              </div>
              <div class="mt-5">
                <h3 class="font-serif text-lg text-stone-950">Tags</h3>
                <div id="tag-facets" class="mt-3 flex flex-wrap gap-2"></div>
              </div>
              <div class="mt-5">
                <h3 class="font-serif text-lg text-stone-950">APIs</h3>
                <div id="api-facets" class="mt-3 flex flex-wrap gap-2"></div>
              </div>
            </div>
            <div class="rounded-3xl border border-stone-900/10 bg-white/60 p-4">
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Significant Terms</p>
              <div id="significant-terms" class="mt-4 flex flex-wrap gap-2"></div>
            </div>
          </aside>
        </div>
      </section>

      <section class="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
        <section class="surface p-6">
          <div class="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Reference Entry</p>
              <h2 id="detail-title" class="font-serif text-3xl text-stone-950">Select a result</h2>
            </div>
            <p id="detail-meta" class="text-sm text-stone-600"></p>
          </div>
          <div id="detail" class="mt-6"></div>
        </section>
        <section class="surface p-6">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Feature Coverage</p>
            <h2 class="font-serif text-3xl text-stone-950">What this browser is exercising</h2>
          </div>
          <div id="coverage" class="mt-5 grid gap-3 md:grid-cols-2"></div>
        </section>
      </section>
    </main>
  `;

  const examplesNode = document.querySelector<HTMLDivElement>("#examples");
  if (!examplesNode) {
    throw new Error("examples node not found");
  }
  const exampleQueries = [
    "phrase search",
    "\"portable json index state\"",
    "vectro serch",
    "bool query filtering",
    "agg",
    "geo polygon",
    "BM25 ranking"
  ];
  examplesNode.innerHTML = exampleQueries
    .map((query) => `<button class="chip-button" data-example="${escapeHtml(query)}">${escapeHtml(query)}</button>`)
    .join("");

  wireApp(context);
}

function renderFacetList(node: HTMLDivElement, facetMap: Record<string, number>, activeValue: string | null, handlerName: "section" | "tag" | "api"): void {
  node.innerHTML = Object.entries(facetMap)
    .slice(0, 10)
    .map(
      ([term, count]) => `
        <button class="chip-button ${activeValue === term ? "border-orange-700/50 text-stone-950" : ""}" data-facet="${handlerName}" data-value="${escapeHtml(term)}">
          <span>${escapeHtml(term)}</span>
          <strong class="font-mono text-orange-800">${count}</strong>
        </button>
      `
    )
    .join("");
}

function renderDetail(context: RuntimeContext, detailNode: HTMLDivElement, detailTitleNode: HTMLHeadingElement, detailMetaNode: HTMLParagraphElement, doc: DocEntry | undefined, current: SearchResult): void {
  if (!doc) {
    detailTitleNode.textContent = "Select a result";
    detailMetaNode.textContent = "";
    detailNode.innerHTML = "";
    return;
  }

  const locationLabel = `${doc.city} (${doc.point[0].toFixed(2)}, ${doc.point[1].toFixed(2)})`;
  const vectorRank = current.vectorHits.findIndex(([id]) => id === doc.id);
  const fuzzyRank = current.fuzzyHits.findIndex(([id]) => id === doc.id);
  const lexicalRank = current.lexicalHits.findIndex(([id]) => id === doc.id);

  detailTitleNode.textContent = doc.title;
  detailMetaNode.textContent = `${doc.section} · ${doc.level} · order ${doc.order}`;
  detailNode.innerHTML = `
    <p class="text-lg text-stone-600">${escapeHtml(doc.summary)}</p>
    <div class="mt-5 rounded-3xl border border-stone-900/10 bg-stone-50/80 p-4">
      <h3 class="font-serif text-xl text-stone-950">Live Coverage</h3>
      <ul class="mt-3 grid list-disc gap-2 pl-5 text-sm text-stone-700">
        <li>Lexical rank: ${lexicalRank >= 0 ? lexicalRank + 1 : "not matched"}</li>
        <li>Fuzzy rank: ${fuzzyRank >= 0 ? fuzzyRank + 1 : "not matched"}</li>
        <li>Vector rank: ${vectorRank >= 0 ? vectorRank + 1 : "not matched"}</li>
        <li>Geo demo point: ${escapeHtml(locationLabel)}</li>
        <li>Markdown source: <code>${escapeHtml(doc.path.replace("../../../", ""))}</code></li>
      </ul>
    </div>
    <div class="mt-5">
      <h3 class="font-serif text-xl text-stone-950">Relevant APIs</h3>
      <div class="mt-3 flex flex-wrap gap-2">
        ${doc.apis.map((api) => `<button class="chip-button" data-facet="api" data-value="${escapeHtml(api)}">${escapeHtml(api)}</button>`).join("")}
      </div>
    </div>
    <div class="mt-5">
      <h3 class="font-serif text-xl text-stone-950">Tags</h3>
      <div class="mt-3 flex flex-wrap gap-2">
        ${doc.tags.map((tag) => `<button class="chip-button" data-facet="tag" data-value="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join("")}
      </div>
    </div>
    <article class="prose-docs mt-8">${markdown.render(doc.markdown)}</article>
  `;
}

function renderCoverage(context: RuntimeContext, coverageNode: HTMLDivElement, current: SearchResult): void {
  const active = context.indexes[state.ranking];
  const serializedDocCount = Object.keys(active.serialized.documents).length;
  const fieldKinds = Object.values(active.serialized.fieldState).map((entry) => entry.kind).join(", ");
  coverageNode.innerHTML = [
    `Hydrated ${state.ranking} index drives the main lexical search. Hybrid mode merges MatchPhrase, MatchQuery, ngram fuzzy lookup, and vector hits.`,
    `Tags, sections, and APIs are computed with termsAggregation. Significant terms come from the body field over the current result subset.`,
    `Geo mode runs point or polygon queries over doc metadata. Vector mode uses bigramVector and VectorFieldIndex for typo-tolerant retrieval.`,
    `${serializedDocCount} documents loaded from JSON state. Field state kinds: ${escapeHtml(fieldKinds)}.`,
    `${current.finalHits.length} results, ${current.fuzzyHits.length} fuzzy hits, ${current.vectorHits.length} vector hits, ${current.geoHits.length} geo hits.`,
    `${context.docs.length} markdown docs across ${context.sections.length} sections, ${context.allTags.length} tags, and ${context.allCities.length} geo points.`
  ]
    .map(
      (text) => `
        <article class="rounded-3xl border border-stone-900/10 bg-white/60 p-4 text-sm leading-6 text-stone-700">
          ${text}
        </article>
      `
    )
    .join("");
}

function renderResults(context: RuntimeContext, resultsNode: HTMLDivElement, current: SearchResult): void {
  if (current.finalHits.length === 0) {
    resultsNode.innerHTML = `
      <article class="rounded-3xl border border-stone-900/10 bg-white/70 p-5">
        <h3 class="font-serif text-2xl text-stone-950">No matches</h3>
        <p class="mt-2 text-stone-600">Try a broader query, switch to fuzzy or vector mode, or clear one of the active facets.</p>
      </article>
    `;
    return;
  }

  resultsNode.innerHTML = current.finalHits
    .slice(0, 20)
    .map(([id, score], index) => {
      const doc = context.byId.get(id);
      if (!doc) {
        return "";
      }
      return `
        <button class="w-full rounded-3xl border ${activeDocId === id ? "border-orange-700/45 ring-1 ring-orange-700/15" : "border-stone-900/10"} bg-white/75 p-5 text-left transition hover:border-orange-700/40" data-doc="${escapeHtml(id)}">
          <div class="flex items-center justify-between gap-3 text-sm text-stone-500">
            <span>${index + 1}. ${escapeHtml(doc.section)}</span>
            <span>${escapeHtml(doc.level)}</span>
          </div>
          <h3 class="mt-3 font-serif text-2xl text-stone-950">${escapeHtml(doc.title)}</h3>
          <p class="mt-2 text-stone-600">${escapeHtml(doc.summary)}</p>
          <div class="mt-4 flex flex-wrap gap-2">
            ${doc.tags.slice(0, 4).map((tag) => `<span class="rounded-full border border-stone-900/10 bg-white/80 px-3 py-1 text-xs text-stone-600">${escapeHtml(tag)}</span>`).join("")}
          </div>
          <div class="mt-4 flex items-center justify-between gap-3 text-sm text-stone-500">
            <span>score ${score.toFixed(4)}</span>
            <span>order ${escapeHtml(doc.order)}</span>
          </div>
        </button>
      `;
    })
    .join("");
}

function updateSummary(summaryTitleNode: HTMLHeadingElement, summaryNode: HTMLParagraphElement, current: SearchResult): void {
  const filters = [state.section ? `section:${state.section}` : "", state.tag ? `tag:${state.tag}` : "", state.excludeAdvanced ? "without advanced" : ""]
    .filter(Boolean)
    .join(" · ");
  summaryTitleNode.textContent = state.mode === "all" ? "All Documentation Entries" : "Documentation Results";
  summaryNode.textContent = `${current.finalHits.length} results · ${state.mode} mode · ${state.ranking}${filters ? ` · ${filters}` : ""}`;
}

function setSearchModeFromQuery(value: string): void {
  if (value.includes("\"")) {
    state.mode = "phrase";
  } else if (/[a-z]{4,}\s[a-z]{4,}/i.test(value)) {
    state.mode = "hybrid";
  }
}

function wireApp(context: RuntimeContext): void {
  const queryInput = document.querySelector<HTMLInputElement>("#query");
  const modeSelect = document.querySelector<HTMLSelectElement>("#mode");
  const rankingSelect = document.querySelector<HTMLSelectElement>("#ranking");
  const operationSelect = document.querySelector<HTMLSelectElement>("#operation");
  const prefixInput = document.querySelector<HTMLInputElement>("#prefix");
  const excludeAdvancedInput = document.querySelector<HTMLInputElement>("#exclude-advanced");
  const resultsNode = document.querySelector<HTMLDivElement>("#results");
  const summaryNode = document.querySelector<HTMLParagraphElement>("#summary");
  const summaryTitleNode = document.querySelector<HTMLHeadingElement>("#summary-title");
  const detailTitleNode = document.querySelector<HTMLHeadingElement>("#detail-title");
  const detailMetaNode = document.querySelector<HTMLParagraphElement>("#detail-meta");
  const detailNode = document.querySelector<HTMLDivElement>("#detail");
  const sectionFacetsNode = document.querySelector<HTMLDivElement>("#section-facets");
  const tagFacetsNode = document.querySelector<HTMLDivElement>("#tag-facets");
  const apiFacetsNode = document.querySelector<HTMLDivElement>("#api-facets");
  const significantTermsNode = document.querySelector<HTMLDivElement>("#significant-terms");
  const coverageNode = document.querySelector<HTMLDivElement>("#coverage");

  if (
    !queryInput ||
    !modeSelect ||
    !rankingSelect ||
    !operationSelect ||
    !prefixInput ||
    !excludeAdvancedInput ||
    !resultsNode ||
    !summaryNode ||
    !summaryTitleNode ||
    !detailTitleNode ||
    !detailMetaNode ||
    !detailNode ||
    !sectionFacetsNode ||
    !tagFacetsNode ||
    !apiFacetsNode ||
    !significantTermsNode ||
    !coverageNode
  ) {
    throw new Error("app nodes not found");
  }

  const syncControls = () => {
    queryInput.value = state.query;
    modeSelect.value = state.mode;
    rankingSelect.value = state.ranking;
    operationSelect.value = state.operation;
    prefixInput.checked = state.prefix;
    excludeAdvancedInput.checked = state.excludeAdvanced;
  };

  const runSearch = () => {
    const current = searchForState(context, state);
    if (!current.selectedIds.has(activeDocId)) {
      activeDocId = current.finalHits[0]?.[0] ?? context.docs[0]?.id ?? "";
    }

    updateSummary(summaryTitleNode, summaryNode, current);
    renderResults(context, resultsNode, current);
    renderFacetList(sectionFacetsNode, current.sectionFacets, state.section, "section");
    renderFacetList(tagFacetsNode, current.tagFacets, state.tag, "tag");
    renderFacetList(apiFacetsNode, current.apiFacets, null, "api");
    significantTermsNode.innerHTML = Object.entries(current.significantTerms)
      .slice(0, 10)
      .map(([term, [score, count]]) => `<span class="rounded-full border border-stone-900/10 bg-white/80 px-3 py-2 text-sm text-stone-700">${escapeHtml(term)} <strong class="font-mono text-orange-800">${score.toFixed(2)}</strong> <em class="font-mono not-italic text-stone-500">${count}</em></span>`)
      .join("");
    renderDetail(context, detailNode, detailTitleNode, detailMetaNode, context.byId.get(activeDocId), current);
    renderCoverage(context, coverageNode, current);
  };

  let pendingSearch: ReturnType<typeof window.setTimeout> | null = null;
  const scheduleSearch = () => {
    if (pendingSearch !== null) {
      window.clearTimeout(pendingSearch);
    }
    pendingSearch = window.setTimeout(() => {
      pendingSearch = null;
      runSearch();
    }, SEARCH_INPUT_DEBOUNCE_MS);
  };
  const runSearchNow = () => {
    if (pendingSearch !== null) {
      window.clearTimeout(pendingSearch);
      pendingSearch = null;
    }
    runSearch();
  };

  queryInput.addEventListener("input", () => {
    state.query = queryInput.value;
    scheduleSearch();
  });
  modeSelect.addEventListener("change", () => {
    state.mode = modeSelect.value as SearchMode;
    runSearchNow();
  });
  rankingSelect.addEventListener("change", () => {
    state.ranking = rankingSelect.value as RankingAlgorithm;
    runSearchNow();
  });
  operationSelect.addEventListener("change", () => {
    state.operation = operationSelect.value as OP;
    runSearchNow();
  });
  prefixInput.addEventListener("change", () => {
    state.prefix = prefixInput.checked;
    runSearchNow();
  });
  excludeAdvancedInput.addEventListener("change", () => {
    state.excludeAdvanced = excludeAdvancedInput.checked;
    runSearchNow();
  });

  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const example = target.closest<HTMLElement>("[data-example]")?.dataset.example;
    if (example) {
      state.query = example;
      setSearchModeFromQuery(example);
      syncControls();
      runSearchNow();
      return;
    }

    const docId = target.closest<HTMLElement>("[data-doc]")?.dataset.doc;
    if (docId) {
      activeDocId = docId;
      runSearchNow();
      return;
    }

    const facetTarget = target.closest<HTMLElement>("[data-facet]");
    if (!facetTarget) {
      return;
    }
    const facet = facetTarget.dataset.facet;
    const value = facetTarget.dataset.value ?? "";
    if (facet === "section") {
      state.section = state.section === value ? null : value;
    } else if (facet === "tag") {
      state.tag = state.tag === value ? null : value;
    } else if (facet === "api") {
      state.query = value;
      state.mode = "match";
    }
    syncControls();
    runSearchNow();
  });

  syncControls();
  runSearch();
}

async function bootstrap(): Promise<void> {
  renderLoading("Scanning markdown files from the repository and building the browser-side indexes.");
  const docs = await loadDocs();
  const context = createRuntimeContext(docs);
  activeDocId = docs[0]?.id ?? "";
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
