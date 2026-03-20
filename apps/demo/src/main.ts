import "./styles.css";
import {
  Analyzer,
  BoolQuery,
  DocumentIndex,
  MatchAll,
  MatchPhrase,
  MatchQuery,
  OP,
  RankingAlgorithm,
  TextFieldIndex,
  type Document
} from "@querylight/core";

type DemoRecord = {
  id: string;
  title: string;
  body: string;
  tags: string[];
  year: string;
};

const records: DemoRecord[] = [
  {
    id: "hamlet",
    title: "Hamlet Production Notes",
    body: "To be, or not to be appears in a rehearsal note alongside blocking directions and stage light timings.",
    tags: ["theatre", "phrase", "classic"],
    year: "1603"
  },
  {
    id: "querylight",
    title: "Querylight Positioning Draft",
    body: "Querylight mixes boolean logic, BM25 ranking, phrase search, prefix search, term aggregations, and vector search in one client side package.",
    tags: ["search", "bm25", "library"],
    year: "2026"
  },
  {
    id: "offline",
    title: "Offline Search Guide",
    body: "Fuse style fuzzy matching is useful, but filtering, exact phrases, and explainable ranking matter when your data model grows.",
    tags: ["search", "offline", "guide"],
    year: "2025"
  },
  {
    id: "catalog",
    title: "Science Fiction Catalog",
    body: "Douglas Adams sits next to Philip K. Dick in a tiny local catalogue indexed in the browser with no server involved.",
    tags: ["books", "science fiction", "catalog"],
    year: "2024"
  },
  {
    id: "ops",
    title: "Incident Review 42",
    body: "Prefix search helped the team find monitor names, while range and tag filters narrowed the result set quickly.",
    tags: ["ops", "prefix", "filtering"],
    year: "2023"
  }
];

function toDoc(record: DemoRecord): Document {
  return {
    id: record.id,
    fields: {
      title: [record.title],
      body: [record.body],
      tags: record.tags,
      year: [record.year]
    }
  };
}

const tagAnalyzer = new Analyzer([], {
  tokenize(text: string) {
    return [text];
  }
});

const index = new DocumentIndex({
  title: new TextFieldIndex(undefined, undefined, RankingAlgorithm.BM25),
  body: new TextFieldIndex(undefined, undefined, RankingAlgorithm.BM25),
  tags: new TextFieldIndex(tagAnalyzer, tagAnalyzer),
  year: new TextFieldIndex()
});

records.map(toDoc).forEach((doc) => index.index(doc));

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found");
}

app.innerHTML = `
  <main class="shell">
    <section class="hero">
      <p class="eyebrow">Pure TypeScript Search</p>
      <h1>Querylight TS</h1>
      <p class="lede">A browser and Node.js search library with BM25, boolean queries, phrase search, prefix matching, aggregations, range filtering, and vector support.</p>
      <div class="hero-grid">
        <label class="field">
          <span>Search</span>
          <input id="query" value="search library" placeholder="Try: to be, science fiction, prefix, 2026" />
        </label>
        <label class="field">
          <span>Mode</span>
          <select id="mode">
            <option value="match">Match</option>
            <option value="phrase">Phrase</option>
            <option value="or">Boolean OR</option>
            <option value="all">Match All</option>
          </select>
        </label>
        <label class="field checkbox">
          <input id="prefix" type="checkbox" />
          <span>Prefix matching</span>
        </label>
      </div>
      <div class="chips">
        <button data-tag="search">search</button>
        <button data-tag="science fiction">science fiction</button>
        <button data-tag="theatre">theatre</button>
        <button data-tag="2026">2026</button>
      </div>
    </section>
    <section class="panel">
      <div class="panel-header">
        <h2>Results</h2>
        <p id="summary"></p>
      </div>
      <div id="results" class="results"></div>
    </section>
    <section class="panel aside">
      <h2>Why this is broader than fuzzy-only search</h2>
      <ul>
        <li>Structured boolean queries across multiple fields.</li>
        <li>Phrase search and prefix matching from the same index.</li>
        <li>BM25 ranking instead of pure edit-distance style matching.</li>
        <li>Term aggregations and significance analysis for faceting and discovery.</li>
        <li>Optional vector and geo search under the same library surface.</li>
      </ul>
    </section>
  </main>
`;

const queryInput = document.querySelector<HTMLInputElement>("#query")!;
const modeSelect = document.querySelector<HTMLSelectElement>("#mode")!;
const prefixInput = document.querySelector<HTMLInputElement>("#prefix")!;
const resultsNode = document.querySelector<HTMLDivElement>("#results")!;
const summaryNode = document.querySelector<HTMLParagraphElement>("#summary")!;

function runSearch(): void {
  const queryText = queryInput.value.trim();
  const mode = modeSelect.value;
  const prefix = prefixInput.checked;

  const query =
    mode === "all"
      ? new MatchAll()
      : mode === "phrase"
        ? new BoolQuery([
            new MatchPhrase("body", queryText),
            new MatchPhrase("title", queryText, 1, 1.5)
          ])
        : mode === "or"
          ? new BoolQuery([
              new MatchQuery("title", queryText, OP.OR, prefix, 2.5),
              new MatchQuery("body", queryText, OP.OR, prefix, 1.5),
              new MatchQuery("tags", queryText, OP.OR, prefix, 2.0),
              new MatchQuery("year", queryText, OP.OR, prefix, 1.2)
            ])
          : new BoolQuery([
              new MatchQuery("title", queryText, OP.AND, prefix, 2.5),
              new MatchQuery("body", queryText, OP.AND, prefix, 1.5),
              new MatchQuery("tags", queryText, OP.OR, prefix, 2.0),
              new MatchQuery("year", queryText, OP.OR, prefix, 1.2)
            ]);

  const hits = index.searchRequest({ query });

  summaryNode.textContent = `${hits.length} results`;
  resultsNode.innerHTML = hits
    .map(([id, score]) => {
      const record = records.find((item) => item.id === id)!;
      return `
        <article class="result">
          <div class="meta">
            <span>${record.year}</span>
            <span>${record.tags.join(" · ")}</span>
          </div>
          <h3>${record.title}</h3>
          <p>${record.body}</p>
          <div class="score">score ${score.toFixed(4)}</div>
        </article>
      `;
    })
    .join("");
}

queryInput.addEventListener("input", runSearch);
modeSelect.addEventListener("change", runSearch);
prefixInput.addEventListener("change", runSearch);
document.querySelectorAll<HTMLButtonElement>("[data-tag]").forEach((button) => {
  button.addEventListener("click", () => {
    queryInput.value = button.dataset.tag ?? "";
    runSearch();
  });
});

runSearch();
