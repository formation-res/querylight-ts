import * as echarts from "echarts";
import {
  Analyzer,
  BoolQuery,
  DateFieldIndex,
  DocumentIndex,
  GeoFieldIndex,
  KeywordTokenizer,
  NumericFieldIndex,
  RangeQuery,
  TermQuery,
  TermsQuery,
  TextFieldIndex
} from "@tryformation/querylight-ts";
import packageMeta from "../../../packages/querylight/package.json";
import type {
  DashboardDataPayload,
  EarthquakeRecord,
  WeatherRecord,
  WorldBankRecord
} from "../build/dashboard-data";

type Cleanup = () => void;
type ChartMap = Map<string, echarts.ECharts>;

type SourceMetadata = DashboardDataPayload["datasets"]["worldBank"]["source"];

type WorldBankRuntime = {
  builtAt: string;
  index: DocumentIndex;
  records: WorldBankRecord[];
  byId: Map<string, WorldBankRecord>;
};

type EarthquakeRuntime = {
  builtAt: string;
  index: DocumentIndex;
  records: EarthquakeRecord[];
  byId: Map<string, EarthquakeRecord>;
};

type WeatherRuntime = {
  builtAt: string;
  index: DocumentIndex;
  records: WeatherRecord[];
  byId: Map<string, WeatherRecord>;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const tagAnalyzer = new Analyzer([], new KeywordTokenizer());
const DASHBOARD_DATA_CACHE_KEY = `querylight-dashboard:data:${packageMeta.version}`;

let dashboardDataPromise: Promise<DashboardDataPayload> | null = null;

function readCachedDashboardPayload(): DashboardDataPayload | null {
  try {
    const raw = window.sessionStorage.getItem(DASHBOARD_DATA_CACHE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as DashboardDataPayload;
  } catch {
    return null;
  }
}

function writeCachedDashboardPayload(payload: DashboardDataPayload): void {
  try {
    window.sessionStorage.setItem(DASHBOARD_DATA_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures and fall back to network fetches.
  }
}

function readCachedDashboardRuntime(): DashboardDataPayload | null {
  return readCachedDashboardPayload();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function formatCompactNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "n/a";
  }
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 2
  }).format(value);
}

function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) {
    return "n/a";
  }
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: digits
  }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function toHitsSubset(index: DocumentIndex, filters: Array<TermQuery | TermsQuery | RangeQuery>): Set<string> {
  if (filters.length === 0) {
    return index.ids();
  }
  return new Set(index.search(new BoolQuery({ filter: filters })).map(([id]) => id));
}

function getNumericField(index: DocumentIndex, field: string): NumericFieldIndex {
  const fieldIndex = index.getFieldIndex(field);
  if (!(fieldIndex instanceof NumericFieldIndex)) {
    throw new Error(`expected numeric field ${field}`);
  }
  return fieldIndex;
}

function getDateField(index: DocumentIndex, field: string): DateFieldIndex {
  const fieldIndex = index.getFieldIndex(field);
  if (!(fieldIndex instanceof DateFieldIndex)) {
    throw new Error(`expected date field ${field}`);
  }
  return fieldIndex;
}

function getTextField(index: DocumentIndex, field: string): TextFieldIndex {
  const fieldIndex = index.getFieldIndex(field);
  if (!(fieldIndex instanceof TextFieldIndex)) {
    throw new Error(`expected text field ${field}`);
  }
  return fieldIndex;
}

function recordsForSubset<T extends { id: string }>(subset: Set<string>, byId: Map<string, T>): T[] {
  return [...subset].map((id) => byId.get(id)).filter((value): value is T => Boolean(value));
}

function renderAttribution(source: SourceMetadata): string {
  return `
    <div class="dashboard-source-card">
      <p class="dashboard-source-label">Data source</p>
      <h3 class="dashboard-source-title">${escapeHtml(source.name)}</h3>
      <p class="dashboard-source-copy">${escapeHtml(source.attribution)}</p>
      <dl class="dashboard-source-meta">
        <div><dt>Snapshot</dt><dd>${escapeHtml(formatDate(source.retrievedAt))}</dd></div>
        <div><dt>License</dt><dd>${escapeHtml(source.license)}</dd></div>
      </dl>
      <div class="dashboard-source-links">
        <a href="${escapeHtml(source.upstreamUrl)}" target="_blank" rel="noreferrer">Upstream docs</a>
        <a href="${escapeHtml(source.datasetUrl)}" target="_blank" rel="noreferrer">Dataset/API</a>
      </div>
      <p class="dashboard-source-note">${escapeHtml(source.note)}</p>
    </div>
  `;
}

function renderMetricCards(metrics: Array<{ label: string; value: string; hint: string }>): string {
  return metrics
    .map(
      (metric) => `
        <article class="dashboard-metric">
          <p class="dashboard-metric-label">${escapeHtml(metric.label)}</p>
          <p class="dashboard-metric-value">${escapeHtml(metric.value)}</p>
          <p class="dashboard-metric-hint">${escapeHtml(metric.hint)}</p>
        </article>
      `
    )
    .join("");
}

function upsertChart(charts: ChartMap, id: string, option: echarts.EChartsOption): void {
  const element = document.getElementById(id);
  if (!element) {
    return;
  }
  const chart = charts.get(id) ?? echarts.init(element, undefined, { renderer: "canvas" });
  chart.setOption(option, true);
  charts.set(id, chart);
}

function setSectionLoaded(section: HTMLElement, builtAt: string): void {
  const badge = section.querySelector<HTMLElement>("[data-lazy-status]");
  if (badge) {
    badge.textContent = `Index built lazily at ${new Intl.DateTimeFormat(undefined, { timeStyle: "medium" }).format(new Date(builtAt))}`;
  }
}

class DashboardIndexRegistry {
  private worldBankRuntime: WorldBankRuntime | null = null;
  private earthquakeRuntime: EarthquakeRuntime | null = null;
  private weatherRuntime: WeatherRuntime | null = null;

  constructor(private readonly payload: DashboardDataPayload) {}

  worldBank(): WorldBankRuntime {
    if (this.worldBankRuntime) {
      return this.worldBankRuntime;
    }

    const index = new DocumentIndex({
      country: new TextFieldIndex(tagAnalyzer, tagAnalyzer),
      region: new TextFieldIndex(tagAnalyzer, tagAnalyzer),
      incomeLevel: new TextFieldIndex(tagAnalyzer, tagAnalyzer),
      indicatorId: new TextFieldIndex(tagAnalyzer, tagAnalyzer),
      indicatorName: new TextFieldIndex(tagAnalyzer, tagAnalyzer),
      year: new NumericFieldIndex(),
      value: new NumericFieldIndex(),
      corpus: new TextFieldIndex()
    });

    for (const record of this.payload.datasets.worldBank.records) {
      index.index({
        id: record.id,
        fields: {
          country: [record.countryName],
          region: [record.region],
          incomeLevel: [record.incomeLevel],
          indicatorId: [record.indicatorId],
          indicatorName: [record.indicatorName],
          year: [String(record.year)],
          value: [String(record.value)],
          corpus: [`${record.countryName} ${record.region} ${record.incomeLevel} ${record.indicatorName}`]
        }
      });
    }

    this.worldBankRuntime = {
      builtAt: new Date().toISOString(),
      index,
      records: this.payload.datasets.worldBank.records,
      byId: new Map(this.payload.datasets.worldBank.records.map((record) => [record.id, record]))
    };
    return this.worldBankRuntime;
  }

  earthquakes(): EarthquakeRuntime {
    if (this.earthquakeRuntime) {
      return this.earthquakeRuntime;
    }

    const index = new DocumentIndex({
      placeText: new TextFieldIndex(),
      placeCategory: new TextFieldIndex(tagAnalyzer, tagAnalyzer),
      eventType: new TextFieldIndex(tagAnalyzer, tagAnalyzer),
      magnitude: new NumericFieldIndex(),
      depthKm: new NumericFieldIndex(),
      significance: new NumericFieldIndex(),
      occurredAt: new DateFieldIndex(),
      geometry: new GeoFieldIndex()
    });

    for (const record of this.payload.datasets.earthquakes.records) {
      index.index({
        id: record.id,
        fields: {
          placeText: [record.place],
          placeCategory: [record.placeCategory],
          eventType: [record.eventType],
          magnitude: [String(record.magnitude)],
          depthKm: [String(record.depthKm)],
          significance: [String(record.significance)],
          occurredAt: [record.occurredAt],
          geometry: [record.geometry]
        }
      });
    }

    this.earthquakeRuntime = {
      builtAt: new Date().toISOString(),
      index,
      records: this.payload.datasets.earthquakes.records,
      byId: new Map(this.payload.datasets.earthquakes.records.map((record) => [record.id, record]))
    };
    return this.earthquakeRuntime;
  }

  weather(): WeatherRuntime {
    if (this.weatherRuntime) {
      return this.weatherRuntime;
    }

    const index = new DocumentIndex({
      city: new TextFieldIndex(tagAnalyzer, tagAnalyzer),
      country: new TextFieldIndex(tagAnalyzer, tagAnalyzer),
      day: new TextFieldIndex(tagAnalyzer, tagAnalyzer),
      hourOfDay: new TextFieldIndex(tagAnalyzer, tagAnalyzer),
      dayOfWeek: new TextFieldIndex(tagAnalyzer, tagAnalyzer),
      weatherCode: new TextFieldIndex(tagAnalyzer, tagAnalyzer),
      observedAt: new DateFieldIndex(),
      temperatureC: new NumericFieldIndex(),
      precipitationMm: new NumericFieldIndex(),
      windSpeedKmh: new NumericFieldIndex(),
      humidity: new NumericFieldIndex(),
      narrative: new TextFieldIndex(),
      geometry: new GeoFieldIndex()
    });

    for (const record of this.payload.datasets.weather.records) {
      index.index({
        id: record.id,
        fields: {
          city: [record.city],
          country: [record.country],
          day: [record.day],
          hourOfDay: [record.hourOfDay],
          dayOfWeek: [record.dayOfWeek],
          weatherCode: [record.weatherCode],
          observedAt: [record.observedAt],
          temperatureC: [String(record.temperatureC)],
          precipitationMm: [String(record.precipitationMm)],
          windSpeedKmh: [String(record.windSpeedKmh)],
          humidity: [String(record.humidity)],
          narrative: [`${record.city} ${record.country} weather ${record.weatherCode}`],
          geometry: [record.geometry]
        }
      });
    }

    this.weatherRuntime = {
      builtAt: new Date().toISOString(),
      index,
      records: this.payload.datasets.weather.records,
      byId: new Map(this.payload.datasets.weather.records.map((record) => [record.id, record]))
    };
    return this.weatherRuntime;
  }
}

function renderDashboard(payload: DashboardDataPayload): string {
  const worldBankSample = JSON.stringify(payload.datasets.worldBank.records[0], null, 2);
  const earthquakeSample = JSON.stringify(payload.datasets.earthquakes.records[0], null, 2);
  const weatherSample = JSON.stringify(payload.datasets.weather.records[0], null, 2);

  return `
    <main class="dashboard-shell mx-auto w-[min(1560px,calc(100vw-24px))] py-6 lg:py-8">
      <section class="surface dashboard-hero p-6 sm:p-8">
        <div class="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div class="max-w-4xl">
            <p class="dashboard-kicker">Querylight TS Dashboard Demo</p>
            <h1 class="dashboard-title">Slice raw API payloads into exploratory dashboards without shipping them to another analytics backend.</h1>
            <p class="dashboard-lead">
              This route turns three pre-downloaded open datasets into charts with lazy in-browser indexes, subset filters, and aggregation calls. The point is not that Querylight TS is a chart library. The point is that it gives raw records enough search structure to become one.
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <a href="/" class="chip-button">Docs Search</a>
            <a href="/docs/" class="chip-button">Documentation</a>
            <a href="/docs/api/" class="chip-button">API Reference</a>
            <a href="/dashboard/" class="chip-button nav-result-active">Dashboard</a>
          </div>
        </div>
        <div class="dashboard-hero-grid mt-8">
          <article class="dashboard-hero-card">
            <p class="dashboard-hero-label">Build pattern</p>
            <p class="dashboard-hero-value">Download snapshot</p>
            <p class="dashboard-hero-copy">Normalize records at build time, not chart series.</p>
          </article>
          <article class="dashboard-hero-card">
            <p class="dashboard-hero-label">Runtime pattern</p>
            <p class="dashboard-hero-value">Lazy index build</p>
            <p class="dashboard-hero-copy">Each section builds only the indexes it needs when you scroll it into view.</p>
          </article>
          <article class="dashboard-hero-card">
            <p class="dashboard-hero-label">Package</p>
            <p class="dashboard-hero-value">${escapeHtml(packageMeta.version)}</p>
            <p class="dashboard-hero-copy">Charts powered by Apache ECharts, slicing powered by Querylight TS.</p>
          </article>
        </div>
      </section>

      <section class="dashboard-grid mt-5">
        <section class="surface p-6">
          <p class="dashboard-section-kicker">How It Works</p>
          <h2 class="dashboard-section-title">Raw API payloads in, filtered aggregations out.</h2>
          <div class="dashboard-copy-grid mt-5">
            <div>
              <p class="dashboard-copy">
                Each dataset is downloaded during the demo build, stored as a small snapshot, then loaded into the browser as ordinary JSON. The dashboard builds Querylight indexes on first reveal and keeps them warm for the session.
              </p>
              <p class="dashboard-copy">
                Filters become Querylight queries. Charts read back subset doc ids, numeric stats, histograms, date histograms, terms aggregations, and significant terms. ECharts only renders the result.
              </p>
            </div>
            <div class="dashboard-code-stack">
              <pre class="dashboard-code-block"><code>const index = new DocumentIndex({
  city: new TextFieldIndex(tagAnalyzer, tagAnalyzer),
  observedAt: new DateFieldIndex(),
  temperatureC: new NumericFieldIndex()
});</code></pre>
              <pre class="dashboard-code-block"><code>const subset = new Set(
  index.search(new BoolQuery({ filter: filters })).map(([id]) =&gt; id)
);
const buckets = temperatureField.histogram(2, subset);</code></pre>
            </div>
          </div>
        </section>

        <section class="surface p-6">
          <p class="dashboard-section-kicker">Demo Disclaimer</p>
          <h2 class="dashboard-section-title">This is a toy analytics showcase, not a production-grade BI tool.</h2>
          <p class="dashboard-copy">
            The datasets on this page are intentionally small toy snapshots chosen to show what Querylight TS can do when an API gives you raw records. The filtering, categorization, and chart logic in this demo may contain simplifications or bugs.
          </p>
          <p class="dashboard-copy">
            The point is to highlight the potential of the library: local indexing, subset queries, and aggregations that let you slice and dice raw API payloads directly in the browser.
          </p>
          <p class="dashboard-copy">
            The visualizations are rendered with the excellent <a href="https://echarts.apache.org/" target="_blank" rel="noreferrer">Apache ECharts</a> library.
          </p>
        </section>

        <section class="surface p-6">
          <p class="dashboard-section-kicker">From Payload To Chart</p>
          <h2 class="dashboard-section-title">The data stays visible.</h2>
          <p class="dashboard-copy">These are normalized records, not precomputed chart series. The charts lower on the page are derived from these shapes.</p>
          <div class="dashboard-sample-grid mt-5">
            <details class="dashboard-sample">
              <summary>World Bank sample record</summary>
              <pre>${escapeHtml(worldBankSample)}</pre>
            </details>
            <details class="dashboard-sample">
              <summary>USGS earthquake sample record</summary>
              <pre>${escapeHtml(earthquakeSample)}</pre>
            </details>
            <details class="dashboard-sample">
              <summary>Open-Meteo sample record</summary>
              <pre>${escapeHtml(weatherSample)}</pre>
            </details>
          </div>
        </section>
      </section>

      <section id="worldbank-section" data-dashboard-section="worldbank" class="surface dashboard-section mt-5 p-6 sm:p-7">
        <div class="dashboard-section-header">
          <div>
            <p class="dashboard-section-kicker">Global Indicators</p>
            <h2 class="dashboard-section-title">Economic and environmental series from the World Bank API.</h2>
            <p class="dashboard-copy">Use exact-match filters over countries and indicators, then aggregate the filtered records into trend lines, comparison bars, and indicator matrices.</p>
          </div>
          <p class="dashboard-lazy-badge" data-lazy-status>Index not built yet. Scroll-triggered lazy init pending.</p>
        </div>
        <div class="dashboard-controls">
          <label>
            <span>Indicator</span>
            <select id="worldbank-indicator" class="control-input"></select>
          </label>
          <label>
            <span>Start year</span>
            <select id="worldbank-start" class="control-input"></select>
          </label>
          <label>
            <span>End year</span>
            <select id="worldbank-end" class="control-input"></select>
          </label>
        </div>
        <div id="worldbank-countries" class="dashboard-chip-row"></div>
        <div id="worldbank-filters" class="dashboard-active-filters"></div>
        <div id="worldbank-metrics" class="dashboard-metric-grid"></div>
        <div class="dashboard-chart-grid mt-5">
          <div>
            <div id="worldbank-line" class="dashboard-chart"></div>
            <p class="dashboard-chart-caption">Line chart built from the current filtered subset, grouped back into yearly country series.</p>
          </div>
          <div>
            <div id="worldbank-bar" class="dashboard-chart"></div>
            <p class="dashboard-chart-caption">Latest-year country comparison for the active indicator.</p>
          </div>
        </div>
        <div class="dashboard-chart-grid mt-5">
          <div>
            <div id="worldbank-pie" class="dashboard-chart"></div>
            <p class="dashboard-chart-caption">Latest-year country share for the active indicator, shown as a composition view.</p>
          </div>
          <div>
            <div id="worldbank-heatmap" class="dashboard-chart dashboard-chart-tall"></div>
            <p class="dashboard-chart-caption">Country-by-indicator matrix for the latest year inside the selected range.</p>
          </div>
        </div>
        <div class="dashboard-ops-grid mt-5">
          <article class="dashboard-ops-card">
            <p class="dashboard-ops-label">Querylight operations used</p>
            <p class="dashboard-copy"><code>TermQuery(indicatorId)</code> + <code>TermsQuery(country)</code> + <code>RangeQuery(year)</code> define the subset.</p>
            <p class="dashboard-copy"><code>NumericFieldIndex.stats(value)</code> powers summary cards and <code>TextFieldIndex.significantTermsAggregation(corpus)</code> explains the slice.</p>
          </article>
          <article class="dashboard-ops-card">
            <p class="dashboard-ops-label">Significant terms in this slice</p>
            <div id="worldbank-significant" class="dashboard-term-list"></div>
          </article>
        </div>
        ${renderAttribution(payload.datasets.worldBank.source)}
      </section>

      <section id="earthquake-section" data-dashboard-section="earthquakes" class="surface dashboard-section mt-5 p-6 sm:p-7">
        <div class="dashboard-section-header">
          <div>
            <p class="dashboard-section-kicker">Earthquakes As Raw Events</p>
            <h2 class="dashboard-section-title">Recent USGS event data becomes a faceted incident board.</h2>
            <p class="dashboard-copy">Range filters reshape the corpus into bucketed activity, temporal clustering, and positional scatter plots.</p>
          </div>
          <p class="dashboard-lazy-badge" data-lazy-status>Index not built yet. Scroll-triggered lazy init pending.</p>
        </div>
        <div class="dashboard-controls">
          <label>
            <span>Min magnitude</span>
            <input id="earthquake-magnitude" class="control-input" type="range" min="1" max="7" step="0.5" value="3.5" />
          </label>
          <label>
            <span>Max depth (km)</span>
            <input id="earthquake-depth" class="control-input" type="range" min="20" max="400" step="10" value="180" />
          </label>
          <label>
            <span>Place category</span>
            <select id="earthquake-place" class="control-input">
              <option value="all">All places</option>
              <option value="Offshore">Offshore</option>
              <option value="Coastal">Coastal</option>
              <option value="Named place">Named place</option>
              <option value="Region">Region</option>
            </select>
          </label>
        </div>
        <div id="earthquake-filters" class="dashboard-active-filters"></div>
        <div id="earthquake-metrics" class="dashboard-metric-grid"></div>
        <div class="dashboard-chart-grid mt-5">
          <div>
            <div id="earthquake-histogram" class="dashboard-chart"></div>
            <p class="dashboard-chart-caption"><code>NumericFieldIndex.histogram(1)</code> over the filtered magnitude field.</p>
          </div>
          <div>
            <div id="earthquake-timeline" class="dashboard-chart"></div>
            <p class="dashboard-chart-caption"><code>DateFieldIndex.dateHistogram(1 day)</code> over the filtered event timestamps.</p>
          </div>
        </div>
        <div class="dashboard-chart-grid mt-5">
          <div>
            <div id="earthquake-scatter" class="dashboard-chart"></div>
            <p class="dashboard-chart-caption">Depth vs magnitude, sourced from the active subset records.</p>
          </div>
          <div>
            <div id="earthquake-map" class="dashboard-chart"></div>
            <p class="dashboard-chart-caption">Longitude/latitude scatter using the same filtered records and stored point geometries.</p>
          </div>
        </div>
        <div class="dashboard-chart-grid dashboard-chart-grid-single mt-5">
          <div>
            <div id="earthquake-pie" class="dashboard-chart"></div>
            <p class="dashboard-chart-caption">Place-category mix for the current earthquake slice.</p>
          </div>
        </div>
        <div class="dashboard-ops-grid mt-5">
          <article class="dashboard-ops-card">
            <p class="dashboard-ops-label">Querylight operations used</p>
            <p class="dashboard-copy"><code>RangeQuery(magnitude)</code> + <code>RangeQuery(depthKm)</code> + optional <code>TermQuery(placeCategory)</code> define the event subset.</p>
            <p class="dashboard-copy"><code>TextFieldIndex.significantTermsAggregation(placeText)</code> surfaces the place words that dominate the current slice.</p>
          </article>
          <article class="dashboard-ops-card">
            <p class="dashboard-ops-label">Significant place terms</p>
            <div id="earthquake-significant" class="dashboard-term-list"></div>
          </article>
        </div>
        ${renderAttribution(payload.datasets.earthquakes.source)}
      </section>

      <section id="weather-section" data-dashboard-section="weather" class="surface dashboard-section mt-5 p-6 sm:p-7">
        <div class="dashboard-section-header">
          <div>
            <p class="dashboard-section-kicker">Weather As Facetable Telemetry</p>
            <h2 class="dashboard-section-title">Hourly city snapshots become filterable time series and distributions.</h2>
            <p class="dashboard-copy">This section keeps the raw hourly rows intact and asks Querylight TS for subsets, averages, histograms, and hour-by-hour summaries on demand.</p>
          </div>
          <p class="dashboard-lazy-badge" data-lazy-status>Index not built yet. Scroll-triggered lazy init pending.</p>
        </div>
        <div class="dashboard-controls">
          <label>
            <span>Metric</span>
            <select id="weather-metric" class="control-input">
              <option value="temperatureC">Temperature (C)</option>
              <option value="precipitationMm">Precipitation (mm)</option>
              <option value="windSpeedKmh">Wind speed (km/h)</option>
              <option value="humidity">Humidity (%)</option>
            </select>
          </label>
          <label>
            <span>Start day</span>
            <select id="weather-start" class="control-input"></select>
          </label>
          <label>
            <span>End day</span>
            <select id="weather-end" class="control-input"></select>
          </label>
        </div>
        <div id="weather-cities" class="dashboard-chip-row"></div>
        <div id="weather-filters" class="dashboard-active-filters"></div>
        <div id="weather-metrics" class="dashboard-metric-grid"></div>
        <div class="dashboard-chart-grid mt-5">
          <div>
            <div id="weather-line" class="dashboard-chart"></div>
            <p class="dashboard-chart-caption">City series from the filtered subset records.</p>
          </div>
          <div>
            <div id="weather-histogram" class="dashboard-chart"></div>
            <p class="dashboard-chart-caption">Metric histogram from the active numeric field index.</p>
          </div>
        </div>
        <div class="dashboard-chart-grid mt-5">
          <div>
            <div id="weather-heatmap" class="dashboard-chart dashboard-chart-tall"></div>
            <p class="dashboard-chart-caption">Average metric by city and hour, computed by combining exact-match subset queries with numeric averages.</p>
          </div>
          <div>
            <div id="weather-weather-codes" class="dashboard-chart dashboard-chart-tall"></div>
            <p class="dashboard-chart-caption">Terms aggregation over weather codes in the active slice.</p>
          </div>
        </div>
        <div class="dashboard-chart-grid dashboard-chart-grid-single mt-5">
          <div>
            <div id="weather-pie" class="dashboard-chart"></div>
            <p class="dashboard-chart-caption">Weather-code composition for the selected cities and time window.</p>
          </div>
        </div>
        <div class="dashboard-ops-grid mt-5">
          <article class="dashboard-ops-card">
            <p class="dashboard-ops-label">Querylight operations used</p>
            <p class="dashboard-copy"><code>TermsQuery(city)</code> + <code>RangeQuery(observedAt)</code> define the slice. Grouped hour panels are built from repeated subset queries plus <code>NumericFieldIndex.avg(...)</code>.</p>
          </article>
          <article class="dashboard-ops-card">
            <p class="dashboard-ops-label">What this proves</p>
            <p class="dashboard-copy">If an API gives you rows instead of chart endpoints, Querylight TS gives you just enough local indexing and aggregation to build exploratory analytics directly in the client.</p>
          </article>
        </div>
        ${renderAttribution(payload.datasets.weather.source)}
      </section>

      <footer class="surface dashboard-footer mt-5 p-6">
        <p class="dashboard-section-kicker">Data Provenance</p>
        <h2 class="dashboard-section-title">Every chart on this route comes from pre-downloaded open-data snapshots.</h2>
        <p class="dashboard-copy">
          No runtime API calls are used after the page loads. This keeps the demo deterministic while still showing a realistic workflow: take raw API responses, normalize them once, build local indexes lazily, and let users explore subsets and aggregations entirely in the browser.
        </p>
        <p class="dashboard-copy">
          Treat the results as illustrative. These are toy datasets and lightweight demo transformations meant to showcase Querylight TS and Apache ECharts together, not to make authoritative claims about the underlying data.
        </p>
        <div class="dashboard-footer-grid mt-5">
          ${renderAttribution(payload.datasets.worldBank.source)}
          ${renderAttribution(payload.datasets.earthquakes.source)}
          ${renderAttribution(payload.datasets.weather.source)}
        </div>
      </footer>
    </main>
  `;
}

function createWorldBankSection(
  payload: DashboardDataPayload["datasets"]["worldBank"],
  registry: DashboardIndexRegistry,
  charts: ChartMap,
  signal: AbortSignal
): Cleanup {
  const section = document.getElementById("worldbank-section");
  const indicatorSelect = document.getElementById("worldbank-indicator") as HTMLSelectElement | null;
  const startSelect = document.getElementById("worldbank-start") as HTMLSelectElement | null;
  const endSelect = document.getElementById("worldbank-end") as HTMLSelectElement | null;
  const countriesNode = document.getElementById("worldbank-countries");
  const filtersNode = document.getElementById("worldbank-filters");
  const metricsNode = document.getElementById("worldbank-metrics");
  const significantNode = document.getElementById("worldbank-significant");

  if (!section || !indicatorSelect || !startSelect || !endSelect || !countriesNode || !filtersNode || !metricsNode || !significantNode) {
    throw new Error("world bank dashboard nodes not found");
  }

  const countryNames = [...new Set(payload.records.map((record) => record.countryName))];
  const indicators = [...new Map(payload.records.map((record) => [record.indicatorId, record.indicatorName])).entries()];
  const years = [...new Set(payload.records.map((record) => record.year))].sort((left, right) => left - right);
  const selectedCountries = new Set(countryNames.slice(0, 4));

  indicatorSelect.innerHTML = indicators
    .map(([indicatorId, indicatorName]) => `<option value="${escapeHtml(indicatorId)}">${escapeHtml(indicatorName)}</option>`)
    .join("");
  startSelect.innerHTML = years.map((year) => `<option value="${year}">${year}</option>`).join("");
  endSelect.innerHTML = years.map((year) => `<option value="${year}">${year}</option>`).join("");
  startSelect.value = String(years[0]);
  endSelect.value = String(years[years.length - 1]);

  const renderCountryChips = () => {
    countriesNode.innerHTML = countryNames
      .map((country) => `
        <button type="button" class="chip-button ${selectedCountries.has(country) ? "nav-result-active" : ""}" data-country-chip="${escapeHtml(country)}">
          ${escapeHtml(country)}
        </button>
      `)
      .join("");
  };

  const update = () => {
    const runtime = registry.worldBank();
    setSectionLoaded(section, runtime.builtAt);
    const activeCountries = [...selectedCountries];

    const startYear = Number(startSelect.value);
    const endYear = Number(endSelect.value);
    const filters = [
      new TermQuery({ field: "indicatorId", text: indicatorSelect.value }),
      new TermsQuery({ field: "country", terms: activeCountries }),
      new RangeQuery({ field: "year", range: { gte: String(Math.min(startYear, endYear)), lte: String(Math.max(startYear, endYear)) } })
    ];
    const subset = toHitsSubset(runtime.index, filters);
    const records = recordsForSubset(subset, runtime.byId).sort((left, right) => left.year - right.year);
    const valueField = getNumericField(runtime.index, "value");
    const countryField = getTextField(runtime.index, "country");
    const corpusField = getTextField(runtime.index, "corpus");
    const stats = valueField.stats(subset);
    const countryAgg = countryField.termsAggregation(6, subset);
    const significantTerms = corpusField.significantTermsAggregation(6, subset);
    const latestYear = records.length > 0 ? Math.max(...records.map((record) => record.year)) : Math.max(startYear, endYear);
    const indicatorName = indicators.find(([id]) => id === indicatorSelect.value)?.[1] ?? indicatorSelect.value;

    filtersNode.innerHTML = `
      <span class="dashboard-filter-pill">Indicator: ${escapeHtml(indicatorName)}</span>
      <span class="dashboard-filter-pill">Countries: ${escapeHtml(activeCountries.join(", "))}</span>
      <span class="dashboard-filter-pill">Years: ${Math.min(startYear, endYear)}-${Math.max(startYear, endYear)}</span>
    `;

    metricsNode.innerHTML = renderMetricCards([
      { label: "Records in slice", value: formatNumber(records.length, 0), hint: "One record per country / indicator / year combination." },
      { label: "Average value", value: formatCompactNumber(stats.avg), hint: "NumericFieldIndex.stats over the filtered subset." },
      { label: "Largest group", value: escapeHtml(Object.entries(countryAgg)[0]?.[0] ?? "n/a"), hint: "Terms aggregation over exact-match country values." }
    ]);

    significantNode.innerHTML = significantTerms
      .map((bucket) => `<span class="dashboard-term-pill">${escapeHtml(bucket.key)} · ${formatNumber(bucket.score)}x · ${bucket.subsetDocCount}</span>`)
      .join("");

    const activeYears = years.filter((year) => year >= Math.min(startYear, endYear) && year <= Math.max(startYear, endYear));
    const lineSeries = activeCountries.map((country) => ({
      name: country,
      type: "line",
      smooth: true,
      data: activeYears.map((year) => records.find((record) => record.countryName === country && record.year === year)?.value ?? null)
    }));

    upsertChart(charts, "worldbank-line", {
      tooltip: { trigger: "axis" },
      legend: { top: 0 },
      grid: { left: 56, right: 18, top: 44, bottom: 34 },
      xAxis: { type: "category", data: activeYears },
      yAxis: { type: "value" },
      series: lineSeries
    });

    const latestRecords = records.filter((record) => record.year === latestYear);
    upsertChart(charts, "worldbank-bar", {
      tooltip: { trigger: "axis" },
      grid: { left: 56, right: 18, top: 28, bottom: 34 },
      xAxis: { type: "category", data: latestRecords.map((record) => record.countryName), axisLabel: { interval: 0, rotate: 20 } },
      yAxis: { type: "value" },
      series: [
        {
          type: "bar",
          itemStyle: { color: "#b45309" },
          data: latestRecords.map((record) => record.value)
        }
      ]
    });

    upsertChart(charts, "worldbank-pie", {
      tooltip: { trigger: "item" },
      legend: { top: 0 },
      series: [
        {
          type: "pie",
          radius: ["28%", "72%"],
          top: 28,
          label: {
            formatter: "{b}\n{d}%"
          },
          data: latestRecords.map((record) => ({
            name: record.countryName,
            value: record.value
          }))
        }
      ]
    });

    const heatmapRecords = runtime.records.filter((record) =>
      selectedCountries.has(record.countryName) &&
      record.year === latestYear
    );
    const heatmapIndicators = [...new Set(heatmapRecords.map((record) => record.indicatorName))];
    const heatmapValues = heatmapRecords.map((record) => record.value);
    upsertChart(charts, "worldbank-heatmap", {
      tooltip: {
        formatter: (params: unknown) => {
          const value = (params as { value: [number, number, number] }).value;
          return `${activeCountries[value[1]!] ?? ""}<br />${heatmapIndicators[value[0]!] ?? ""}: ${formatCompactNumber(value[2])}`;
        }
      },
      grid: { left: 120, right: 18, top: 18, bottom: 44 },
      xAxis: { type: "category", data: heatmapIndicators, axisLabel: { interval: 0, rotate: 15 } },
      yAxis: { type: "category", data: activeCountries },
      visualMap: {
        min: heatmapValues.length > 0 ? Math.min(...heatmapValues) : 0,
        max: heatmapValues.length > 0 ? Math.max(...heatmapValues) : 1,
        orient: "horizontal",
        left: "center",
        bottom: 0
      },
      series: [
        {
          type: "heatmap",
          data: heatmapRecords.map((record) => [
            heatmapIndicators.indexOf(record.indicatorName),
            activeCountries.indexOf(record.countryName),
            record.value
          ]),
          label: { show: false }
        }
      ]
    });
  };

  renderCountryChips();
  countriesNode.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-country-chip]");
    if (!target) {
      return;
    }
    const country = target.dataset.countryChip;
    if (!country) {
      return;
    }
    if (selectedCountries.has(country) && selectedCountries.size > 1) {
      selectedCountries.delete(country);
    } else {
      selectedCountries.add(country);
    }
    renderCountryChips();
    update();
  }, { signal });

  indicatorSelect.addEventListener("change", update, { signal });
  startSelect.addEventListener("change", update, { signal });
  endSelect.addEventListener("change", update, { signal });
  update();

  return () => {};
}

function createEarthquakeSection(
  payload: DashboardDataPayload["datasets"]["earthquakes"],
  registry: DashboardIndexRegistry,
  charts: ChartMap,
  signal: AbortSignal
): Cleanup {
  const section = document.getElementById("earthquake-section");
  const magnitudeInput = document.getElementById("earthquake-magnitude") as HTMLInputElement | null;
  const depthInput = document.getElementById("earthquake-depth") as HTMLInputElement | null;
  const placeSelect = document.getElementById("earthquake-place") as HTMLSelectElement | null;
  const filtersNode = document.getElementById("earthquake-filters");
  const metricsNode = document.getElementById("earthquake-metrics");
  const significantNode = document.getElementById("earthquake-significant");

  if (!section || !magnitudeInput || !depthInput || !placeSelect || !filtersNode || !metricsNode || !significantNode) {
    throw new Error("earthquake dashboard nodes not found");
  }

  const update = () => {
    const runtime = registry.earthquakes();
    setSectionLoaded(section, runtime.builtAt);

    const filters = [
      new RangeQuery({ field: "magnitude", range: { gte: magnitudeInput.value } }),
      new RangeQuery({ field: "depthKm", range: { lte: depthInput.value } })
    ];
    if (placeSelect.value !== "all") {
      filters.push(new TermQuery({ field: "placeCategory", text: placeSelect.value }));
    }

    const subset = toHitsSubset(runtime.index, filters);
    const records = recordsForSubset(subset, runtime.byId);
    const magnitudeField = getNumericField(runtime.index, "magnitude");
    const depthField = getNumericField(runtime.index, "depthKm");
    const dateField = getDateField(runtime.index, "occurredAt");
    const placeField = getTextField(runtime.index, "placeText");
    const placeCategoryField = getTextField(runtime.index, "placeCategory");
    const stats = magnitudeField.stats(subset);
    const depthStats = depthField.stats(subset);
    const significantTerms = placeField.significantTermsAggregation(8, subset);
    const placeCategoryTerms = placeCategoryField.termsAggregation(8, subset);

    filtersNode.innerHTML = `
      <span class="dashboard-filter-pill">Min magnitude: ${escapeHtml(magnitudeInput.value)}</span>
      <span class="dashboard-filter-pill">Max depth: ${escapeHtml(depthInput.value)} km</span>
      <span class="dashboard-filter-pill">Place: ${escapeHtml(placeSelect.value)}</span>
    `;
    metricsNode.innerHTML = renderMetricCards([
      { label: "Events in slice", value: formatNumber(records.length, 0), hint: "Filtered event count." },
      { label: "Average magnitude", value: formatNumber(stats.avg), hint: "NumericFieldIndex.stats on magnitude." },
      { label: "Average depth", value: `${formatNumber(depthStats.avg)} km`, hint: "Depth statistics over the same subset." }
    ]);
    significantNode.innerHTML = significantTerms
      .map((bucket) => `<span class="dashboard-term-pill">${escapeHtml(bucket.key)} · ${formatNumber(bucket.score)}x · ${bucket.subsetDocCount}</span>`)
      .join("");

    const magnitudeBuckets = magnitudeField.histogram(1, subset);
    upsertChart(charts, "earthquake-histogram", {
      tooltip: { trigger: "axis" },
      grid: { left: 42, right: 18, top: 24, bottom: 30 },
      xAxis: { type: "category", data: magnitudeBuckets.map((bucket) => String(bucket.key)) },
      yAxis: { type: "value" },
      series: [{ type: "bar", itemStyle: { color: "#dc2626" }, data: magnitudeBuckets.map((bucket) => bucket.docCount) }]
    });

    const dateBuckets = dateField.dateHistogram(ONE_DAY_MS, subset);
    upsertChart(charts, "earthquake-timeline", {
      tooltip: { trigger: "axis" },
      grid: { left: 42, right: 18, top: 24, bottom: 42 },
      xAxis: { type: "category", data: dateBuckets.map((bucket) => bucket.keyAsString.slice(5, 10)) },
      yAxis: { type: "value" },
      series: [{ type: "line", smooth: true, itemStyle: { color: "#7c2d12" }, data: dateBuckets.map((bucket) => bucket.docCount) }]
    });

    upsertChart(charts, "earthquake-scatter", {
      tooltip: {
        formatter: (params: unknown) => {
          const value = (params as { value: [number, number, string] }).value;
          return `${escapeHtml(String(value[2]))}<br />Depth: ${value[0]} km<br />Magnitude: ${value[1]}`;
        }
      },
      grid: { left: 48, right: 18, top: 24, bottom: 30 },
      xAxis: { type: "value", name: "Depth (km)" },
      yAxis: { type: "value", name: "Magnitude" },
      series: [{
        type: "scatter",
        itemStyle: { color: "#ea580c" },
        data: records.slice(0, 180).map((record) => [record.depthKm, record.magnitude, record.place])
      }]
    });

    upsertChart(charts, "earthquake-map", {
      tooltip: {
        formatter: (params: unknown) => {
          const value = (params as { value: [number, number, number, string] }).value;
          return `${escapeHtml(String(value[3]))}<br />Lon: ${formatNumber(value[0])}<br />Lat: ${formatNumber(value[1])}<br />Mag: ${formatNumber(value[2])}`;
        }
      },
      grid: { left: 42, right: 18, top: 24, bottom: 42 },
      xAxis: { type: "value", name: "Longitude", min: -180, max: 180 },
      yAxis: { type: "value", name: "Latitude", min: -90, max: 90 },
      series: [{
        type: "scatter",
        symbolSize: (value: unknown) => 4 + ((value as number[])[2] ?? 0) * 1.5,
        itemStyle: { color: "#b91c1c", opacity: 0.7 },
        data: records.slice(0, 180).map((record) => [record.longitude, record.latitude, record.magnitude, record.place])
      }]
    });

    upsertChart(charts, "earthquake-pie", {
      tooltip: { trigger: "item" },
      legend: { top: 0 },
      series: [
        {
          type: "pie",
          radius: ["30%", "72%"],
          top: 28,
          label: {
            formatter: "{b}\n{d}%"
          },
          data: Object.entries(placeCategoryTerms).map(([name, value]) => ({
            name,
            value
          }))
        }
      ]
    });
  };

  magnitudeInput.addEventListener("input", update, { signal });
  depthInput.addEventListener("input", update, { signal });
  placeSelect.addEventListener("change", update, { signal });
  update();

  return () => {};
}

function metricConfig(metric: string): { label: string; interval: number; field: keyof WeatherRecord } {
  switch (metric) {
    case "precipitationMm":
      return { label: "Precipitation (mm)", interval: 2, field: "precipitationMm" };
    case "windSpeedKmh":
      return { label: "Wind speed (km/h)", interval: 5, field: "windSpeedKmh" };
    case "humidity":
      return { label: "Humidity (%)", interval: 10, field: "humidity" };
    default:
      return { label: "Temperature (C)", interval: 2, field: "temperatureC" };
  }
}

function createWeatherSection(
  payload: DashboardDataPayload["datasets"]["weather"],
  registry: DashboardIndexRegistry,
  charts: ChartMap,
  signal: AbortSignal
): Cleanup {
  const section = document.getElementById("weather-section");
  const metricSelect = document.getElementById("weather-metric") as HTMLSelectElement | null;
  const startSelect = document.getElementById("weather-start") as HTMLSelectElement | null;
  const endSelect = document.getElementById("weather-end") as HTMLSelectElement | null;
  const citiesNode = document.getElementById("weather-cities");
  const filtersNode = document.getElementById("weather-filters");
  const metricsNode = document.getElementById("weather-metrics");

  if (!section || !metricSelect || !startSelect || !endSelect || !citiesNode || !filtersNode || !metricsNode) {
    throw new Error("weather dashboard nodes not found");
  }

  const cities = [...new Set(payload.records.map((record) => record.city))];
  const selectedCities = new Set(cities);
  const days = [...new Set(payload.records.map((record) => record.day))].sort();
  startSelect.innerHTML = days.map((day) => `<option value="${day}">${day}</option>`).join("");
  endSelect.innerHTML = days.map((day) => `<option value="${day}">${day}</option>`).join("");
  startSelect.value = days[0]!;
  endSelect.value = days[days.length - 1]!;

  const renderCityChips = () => {
    citiesNode.innerHTML = cities
      .map((city) => `
        <button type="button" class="chip-button ${selectedCities.has(city) ? "nav-result-active" : ""}" data-city-chip="${escapeHtml(city)}">
          ${escapeHtml(city)}
        </button>
      `)
      .join("");
  };

  const update = () => {
    const runtime = registry.weather();
    setSectionLoaded(section, runtime.builtAt);
    const metric = metricConfig(metricSelect.value);
    const activeCities = [...selectedCities];
    const start = `${startSelect.value}T00:00:00.000Z`;
    const end = `${endSelect.value}T23:59:59.000Z`;
    const filters = [
      new TermsQuery({ field: "city", terms: activeCities }),
      new RangeQuery({ field: "observedAt", range: { gte: start, lte: end } })
    ];
    const subset = toHitsSubset(runtime.index, filters);
    const records = recordsForSubset(subset, runtime.byId).sort((left, right) => left.observedAt.localeCompare(right.observedAt));
    const numericField = getNumericField(runtime.index, metric.field);
    const weatherCodeField = getTextField(runtime.index, "weatherCode");
    const stats = numericField.stats(subset);
    const codeTerms = weatherCodeField.termsAggregation(8, subset);

    filtersNode.innerHTML = `
      <span class="dashboard-filter-pill">Metric: ${escapeHtml(metric.label)}</span>
      <span class="dashboard-filter-pill">Cities: ${escapeHtml(activeCities.join(", "))}</span>
      <span class="dashboard-filter-pill">Window: ${escapeHtml(startSelect.value)} to ${escapeHtml(endSelect.value)}</span>
    `;
    metricsNode.innerHTML = renderMetricCards([
      { label: "Rows in slice", value: formatNumber(records.length, 0), hint: "Hourly raw records after filtering." },
      { label: "Average", value: formatNumber(stats.avg), hint: "NumericFieldIndex.avg over the selected metric." },
      { label: "Peak", value: formatNumber(stats.max), hint: "Maximum observed value in the active slice." }
    ]);

    const timeline = [...new Set(records.map((record) => record.observedAt.slice(5, 16).replace("T", " ")))];
    const groupedByCity = activeCities.map((city) => ({
      name: city,
      type: "line",
      showSymbol: false,
      data: timeline.map((timestamp) => {
        const value = records.find((record) => record.city === city && record.observedAt.slice(5, 16).replace("T", " ") === timestamp)?.[metric.field];
        return typeof value === "number" ? value : null;
      })
    }));

    upsertChart(charts, "weather-line", {
      tooltip: { trigger: "axis" },
      legend: { top: 0 },
      grid: { left: 56, right: 18, top: 42, bottom: 48 },
      xAxis: { type: "category", data: timeline, axisLabel: { hideOverlap: true } },
      yAxis: { type: "value", name: metric.label },
      series: groupedByCity
    });

    const histogram = numericField.histogram(metric.interval, subset);
    upsertChart(charts, "weather-histogram", {
      tooltip: { trigger: "axis" },
      grid: { left: 44, right: 18, top: 24, bottom: 30 },
      xAxis: { type: "category", data: histogram.map((bucket) => String(bucket.key)) },
      yAxis: { type: "value" },
      series: [{ type: "bar", itemStyle: { color: "#1d4ed8" }, data: histogram.map((bucket) => bucket.docCount) }]
    });

    const hours = [...new Set(runtime.records.map((record) => record.hourOfDay))].sort();
    const heatmapData = activeCities.flatMap((city, cityIndex) =>
      hours.map((hour, hourIndex) => {
        const cellSubset = toHitsSubset(runtime.index, [
          ...filters,
          new TermQuery({ field: "city", text: city }),
          new TermQuery({ field: "hourOfDay", text: hour })
        ]);
        return [hourIndex, cityIndex, getNumericField(runtime.index, metric.field).avg(cellSubset) ?? 0];
      })
    );

    upsertChart(charts, "weather-heatmap", {
      tooltip: { trigger: "item" },
      grid: { left: 88, right: 18, top: 22, bottom: 44 },
      xAxis: { type: "category", data: hours },
      yAxis: { type: "category", data: activeCities },
      visualMap: {
        min: Math.min(...heatmapData.map((entry) => entry[2] as number)),
        max: Math.max(...heatmapData.map((entry) => entry[2] as number)),
        orient: "horizontal",
        left: "center",
        bottom: 0
      },
      series: [{ type: "heatmap", data: heatmapData }]
    });

    upsertChart(charts, "weather-weather-codes", {
      tooltip: { trigger: "axis" },
      grid: { left: 48, right: 18, top: 22, bottom: 68 },
      xAxis: {
        type: "category",
        data: Object.keys(codeTerms),
        axisLabel: { interval: 0, rotate: 25 }
      },
      yAxis: { type: "value" },
      series: [{ type: "bar", itemStyle: { color: "#0f766e" }, data: Object.values(codeTerms) }]
    });

    upsertChart(charts, "weather-pie", {
      tooltip: { trigger: "item" },
      legend: { top: 0 },
      series: [
        {
          type: "pie",
          radius: ["30%", "72%"],
          top: 28,
          label: {
            formatter: "{b}\n{d}%"
          },
          data: Object.entries(codeTerms).map(([name, value]) => ({
            name,
            value
          }))
        }
      ]
    });
  };

  renderCityChips();
  citiesNode.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-city-chip]");
    if (!target) {
      return;
    }
    const city = target.dataset.cityChip;
    if (!city) {
      return;
    }
    if (selectedCities.has(city) && selectedCities.size > 1) {
      selectedCities.delete(city);
    } else {
      selectedCities.add(city);
    }
    renderCityChips();
    update();
  }, { signal });

  metricSelect.addEventListener("change", update, { signal });
  startSelect.addEventListener("change", update, { signal });
  endSelect.addEventListener("change", update, { signal });
  update();

  return () => {};
}

async function loadDashboardPayload(): Promise<DashboardDataPayload> {
  dashboardDataPromise ??= (async () => {
    const cached = readCachedDashboardRuntime();
    if (cached) {
      return cached;
    }
    const response = await fetch("/data/dashboard-data.json");
    if (!response.ok) {
      throw new Error(`failed to load dashboard data: ${response.status} ${response.statusText}`);
    }
    const payload = await response.json() as DashboardDataPayload;
    writeCachedDashboardPayload(payload);
    return payload;
  })();
  return await dashboardDataPromise;
}

function renderLoading(app: HTMLDivElement): void {
  app.innerHTML = `
    <main class="mx-auto min-h-screen w-[min(1200px,calc(100vw-32px))] py-8">
      <section class="surface p-8">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Loading</p>
        <h1 class="mt-3 font-serif text-4xl text-stone-950">Preparing dashboard snapshots</h1>
        <p class="mt-4 text-sm leading-7 text-stone-600">Fetching the prebuilt open-data payload and waiting to lazily construct the first section indexes.</p>
      </section>
    </main>
  `;
}

export async function mountDashboardApp(app: HTMLDivElement): Promise<Cleanup> {
  const cachedPayload = readCachedDashboardRuntime();
  if (!cachedPayload) {
    renderLoading(app);
  }
  const payload = cachedPayload ?? await loadDashboardPayload();
  app.innerHTML = renderDashboard(payload);

  const charts: ChartMap = new Map();
  const controller = new AbortController();
  const { signal } = controller;
  const registry = new DashboardIndexRegistry(payload);
  const cleanups: Cleanup[] = [];
  const initialized = new Set<string>();

  const initSection = (key: string) => {
    if (initialized.has(key)) {
      return;
    }
    initialized.add(key);
    if (key === "worldbank") {
      cleanups.push(createWorldBankSection(payload.datasets.worldBank, registry, charts, signal));
      return;
    }
    if (key === "earthquakes") {
      cleanups.push(createEarthquakeSection(payload.datasets.earthquakes, registry, charts, signal));
      return;
    }
    if (key === "weather") {
      cleanups.push(createWeatherSection(payload.datasets.weather, registry, charts, signal));
    }
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }
      const sectionKey = (entry.target as HTMLElement).dataset.dashboardSection;
      if (!sectionKey) {
        return;
      }
      initSection(sectionKey);
      observer.unobserve(entry.target);
    });
  }, { rootMargin: "160px 0px" });

  document.querySelectorAll<HTMLElement>("[data-dashboard-section]").forEach((section) => observer.observe(section));
  window.addEventListener("resize", () => {
    charts.forEach((chart) => chart.resize());
  }, { signal });

  return () => {
    controller.abort();
    observer.disconnect();
    cleanups.forEach((cleanup) => cleanup());
    charts.forEach((chart) => chart.dispose());
    charts.clear();
  };
}
