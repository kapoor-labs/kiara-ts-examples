import {
  BrowserWorkerClient, InMemoryWorkerAdapter, KeywordSearch, Operator,
  type Condition, type OperatorType, type Store,
} from "@kapoorlabs/kiara-ts";
import {
  CAPABILITIES, CSV_MAX_BYTES, CatalogSnapshots, RETAIL_DEFINITION, benchmarkRequest,
  connectorStore, discoverProducts, importCsv, inspectCsv, isRecord,
  matchConnectors, matchOperatingRange, operatingStore, validateIterations,
  type CsvInspection, type CsvMapping, type FeatureDemoId,
} from "./business-demos.ts";
import { buildStore, type PlaygroundDataset } from "./datasets.ts";
import type { AnyRow } from "./query.ts";

interface DemoDescription { title: string; description: string; boundary: string; controls: string; code: string }
const DESCRIPTIONS: Record<FeatureDemoId, DemoDescription> = {
  "product-discovery": {
    title: "Find the product, not the filter",
    description: "Discover 3,788 real gift products with lexical title search, strict specification filters, and an optional market facet.",
    boundary: "Historical UCI data, 2010-2011. Prices are observed GBP minima, not current offers. Units sold are not stock; observed markets are not shipping promises.",
    controls: `<div class="feature-form">
      <label>Product keywords<input id="product-keywords" value="bag" maxlength="256" /></label>
      <label>Strict filters<input id="product-filters" value="price&lt;5GBP sold&gt;=100" maxlength="4096" /></label>
      <label>Observed market<select id="product-market"><option value="">All observed markets</option></select></label>
      <label>Display order<select id="product-order"><option value="source">Source order within best matches</option><option value="price">Lowest observed price</option></select></label>
      </div><div class="actions"><button id="product-bags" type="button" class="secondary-button">Bags under GBP 5</button>
      <button id="product-lanterns" type="button" class="secondary-button">Lantern typo</button>
      <button id="product-clear" type="button" class="secondary-button">Browse all</button></div>
      <div id="product-chips" class="filter-chips"></div>`,
    code: `const interpretation = interpreter.interpret(filters);
// Block unresolved filters; never ignore a clause.
const conditions = interpretation.filters.map(f => f.condition);
const matches = keywordSearch.bestMatch(keywords, {
  fields: ["title"], conditions, limit: store.getLoadedRowCount()
});
// The application renders cards and optionally sorts the matching records.`,
  },
  "keyword-discovery": {
    title: "Useful search without a search server",
    description: "Search every product title with one-edit correction and English stemming. Inspect the actual tokens and corrections.",
    boundary: "Lexical bestMatch returns the highest positive token-match group. This is not semantic search, a chatbot, or general spell checking. The corpus is the real 3,788-product catalog.",
    controls: `<label>Title keywords<input id="keyword-input" value="latern" maxlength="256" /></label>
      <div class="actions"><button id="keyword-typo" type="button" class="secondary-button">Typo: latern</button>
      <button id="keyword-stem" type="button" class="secondary-button">Stem: decorating / decoration</button>
      <button id="keyword-none" type="button" class="secondary-button">No matching token</button></div>`,
    code: `// title is configured with stemmedIndex: true and oneEditAway: true.
const result = new KeywordSearch(store).bestMatch(input, {
  fields: ["title"], limit: store.getLoadedRowCount()
});
// Inspect result.usedKeywords, correctedKeywords, matchedKeywords, and results.`,
  },
  compatibility: {
    title: "Can this integration meet every requirement?",
    description: "Compare ALL vs ANY set membership, then exclude capabilities you cannot accept.",
    boundary: "Eight deliberately small, authored fixtures with fictional connector names. These are executable teaching scenarios, not real vendor claims or a scale benchmark.",
    controls: `<div class="feature-form"><div><h3>Required capabilities</h3><div id="required-capabilities"></div></div>
      <div><h3>Excluded capabilities</h3><div id="excluded-capabilities"></div></div>
      <label>Requirement logic<select id="capability-mode"><option value="all">ALL selected capabilities</option><option value="any">ANY selected capability</option></select></label></div>`,
    code: `store.search([
  { field: "capabilities", operator: Operator.CONTAINS_ALL, values: required },
  { field: "capabilities", operator: Operator.NOT_CONTAINS, values: excluded }
]);
// Switch CONTAINS_ALL to CONTAINS_EITHER for ANY semantics.`,
  },
  "operating-ranges": {
    title: "Search specifications that are ranges",
    description: "Find real components whose stored operating-temperature interval covers a point or your complete requested interval.",
    boundary: "Uses all 16,802 JLCParts source records. Supported source temperature notation is explicitly converted into Celsius intervals; missing or unrecognized values remain null and cannot qualify. Results are not engineering certification.",
    controls: `<div class="feature-form">
      <label>Match mode<select id="range-mode"><option value="interval">Cover the entire interval</option><option value="point">Operate at one temperature</option></select></label>
      <label>Minimum / point (Celsius)<input id="range-lower" type="number" value="-40" step="any" /></label>
      <label id="range-upper-label">Maximum (Celsius)<input id="range-upper" type="number" value="125" step="any" /></label>
      </div><div class="actions"><button id="range-boundary" type="button" class="secondary-button">Try 150 Celsius</button>
      <button id="range-outside" type="button" class="secondary-button">Try outside all ranges</button></div>`,
    code: `// operatingRange is text with secondaryType: "numericRange".
// The original source string is retained alongside the canonical interval.
store.search([{
  field: "operatingRange", operator: Operator.CONTAINS_ALL,
  values: [minimumCelsius, maximumCelsius]
}]);
// For a single contiguous stored range, covering both endpoints covers the interval.`,
  },
  "catalog-refresh": {
    title: "Refresh the catalog without half-loaded data",
    description: "Prepare a complete replacement, keep querying the current snapshot, then explicitly activate the validated store.",
    boundary: "Price edits below are local demonstration changes to the historical catalog, not upstream updates. StoreLoader creates a new prepared store; the application owns activation and revision labels. This is not a transaction or synchronization service.",
    controls: `<p id="refresh-revision"></p><label>Replacement first-product price (GBP)<input id="refresh-price" type="number" value="1.25" min="0.01" step="0.01" /></label>
      <div class="actions"><button id="refresh-stage" type="button" class="primary-button">Prepare valid replacement</button>
      <button id="refresh-broken" type="button" class="secondary-button">Try broken replacement</button>
      <button id="refresh-activate" type="button" class="secondary-button" disabled>Activate prepared snapshot</button>
      <button id="refresh-query" type="button" class="secondary-button">Query active snapshot</button></div>`,
    code: `const rows = validateRetailRows(replacement);
const next = new StoreLoader(activeStore).replaceAll(rows);
const nextInterpreter = productInterpreter(next);
// Only after preparation succeeds:
activeStore = next;
activeInterpreter = nextInterpreter;
// Old store references still refer to the old snapshot.`,
  },
  "worker-comparison": {
    title: "Keep the interface responsive",
    description: "Run the same repeated projection query through Kiara's in-memory adapter or a real BrowserWorkerClient.",
    boundary: "Both modes use the same 3,788 products, conditions, 25-row projection, and repetition count. Measurements include adapter/messaging overhead, exclude worker preparation, and are not universal performance claims. Animation frames may pause in background tabs. No rows are padded.",
    controls: `<div class="feature-form"><label>Query repetitions (1-2,000)<input id="worker-iterations" type="number" value="500" min="1" max="2000" /></label>
      <div class="heartbeat" aria-label="Main-thread animation counter">UI animation frames: <strong id="worker-frames">0</strong></div></div>
      <div class="actions"><button id="worker-main" type="button" class="primary-button">Run on main thread</button>
      <button id="worker-background" type="button" class="secondary-button">Run in Web Worker</button>
      <button id="worker-cancel" type="button" class="secondary-button" disabled>Cancel worker run</button></div>
      <p id="worker-progress" role="status"></p>`,
    code: `const client = new BrowserWorkerClient(worker);
const response = await client.execute({
  requestId, storeId: "retail", operation: "searchProjection",
  payload: { conditions, fields: ["sku", "unitPrice"], limit: 25 }
}, { signal, onProgress });
// The worker uses attachBrowserWorkerHost and InMemoryWorkerAdapter.`,
  },
  "csv-workbench": {
    title: "Try Kiara with your own CSV",
    description: "Drop a CSV, review inferred types, prepare a store, and query it locally. Open the full query editor for multiple conditions and IntelliSense.",
    boundary: "Files stay in this page's memory: no upload or persistence. Limits: 10 MiB, 50,000 rows, 100 columns. Numeric guesses preserve leading-zero and unsafe-integer identifiers as text. Empty, null, and \\N cells become null.",
    controls: `<div id="csv-drop" class="csv-drop"><label>Choose a comma-separated CSV<input id="csv-file" type="file" accept=".csv,text/csv" /></label>
      <p>Or drop a CSV here.</p></div>
      <button id="csv-sample" type="button" class="secondary-button">Try the real 3,788-product CSV</button>
      <div id="csv-mapping"></div><button id="csv-prepare" type="button" class="primary-button" disabled>Validate and prepare store</button>
      <div id="csv-query-panel" hidden><h3>Query your store</h3>
      <div class="feature-form"><label>Field<select id="csv-field"></select></label>
      <label>Operator<select id="csv-operator"></select></label><label>Value (null means missing)<input id="csv-value" /></label></div>
      <div class="actions"><button id="csv-search" type="button" class="primary-button">Search</button>
      <button id="csv-all" type="button" class="secondary-button">All records</button>
      <button id="csv-export" type="button" class="secondary-button">Export matching projection</button>
      <button id="csv-editor" type="button" class="secondary-button">Open with IntelliSense</button></div>
      <details open><summary>Projected columns</summary><div id="csv-projection" class="projection-options"></div></details></div>`,
    code: `// The application parses and validates the CSV, then creates typed fields.
const dataset = importCsv(inspection, reviewedColumnMappings, fileName);
const store = buildStore(dataset);
const result = store.searchProjection(conditions, selectedFields);
// CSV parsing/mapping and export are application code; querying is Kiara.`,
  },
};

function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function display(value: unknown): string {
  return value === null || value === undefined ? "(missing)" : typeof value === "object" ? JSON.stringify(value) : String(value);
}
function download(name: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
export function createBusinessDemoView(
  container: HTMLElement,
  loadRetail: (signal: AbortSignal) => Promise<Store<AnyRow>>,
  loadParts: (signal: AbortSignal) => Promise<Store<AnyRow>>,
  openDataset: (dataset: PlaygroundDataset) => Promise<void>,
) {
  return async function show(id: FeatureDemoId, parentSignal: AbortSignal): Promise<void> {
    if (parentSignal.aborted) return;
    const controller = new AbortController();
    const signal = controller.signal;
    const abort = () => controller.abort();
    parentSignal.addEventListener("abort", abort, { once: true });
    signal.addEventListener("abort", () => parentSignal.removeEventListener("abort", abort), { once: true });
    const description = DESCRIPTIONS[id];
    container.innerHTML = `<section class="card feature-intro"><p class="feature-eyebrow">Kiara business lab</p>
      <h2>${description.title}</h2><p>${description.description}</p><p class="feature-boundary">${description.boundary}</p>
      <fieldset id="feature-controls" disabled>${description.controls}</fieldset>
      <p id="feature-status" class="status" role="status" aria-live="polite">Preparing example...</p>
      <button id="feature-retry" type="button" class="secondary-button" hidden>Retry loading</button></section>
      <section class="card"><h2>Live result</h2><div id="feature-results"></div></section>
      <section class="card"><details open><summary>Inspect the actual query and interpretation</summary><pre id="feature-inspect"></pre></details>
      <details><summary>How Kiara is used</summary><p>Contextual excerpt; see the example source for data preparation and UI code.</p><pre id="feature-code"></pre></details>
      <details><summary>Use Kiara in your application</summary><pre>npm install @kapoorlabs/kiara-ts</pre>
      <p>These examples use the published Kiara 1.1.0 API.
      <a href="https://www.npmjs.com/package/@kapoorlabs/kiara-ts" target="_blank" rel="noopener noreferrer">Install the package</a> ·
      <a href="https://github.com/kapoorlabs/kiara-ts" target="_blank" rel="noopener noreferrer">Library documentation</a> ·
      <a href="https://github.com/kapoor-labs/kiara-ts-examples" target="_blank" rel="noopener noreferrer">Companion repository</a></p></details></section>`;
    function element<T extends HTMLElement>(selector: string): T {
      const found = container.querySelector<T>(selector);
      if (!found) throw new Error(`Missing business demo element: ${selector}`);
      return found;
    }
    const results = element("#feature-results");
    const status = element("#feature-status");
    let onFailure = () => {};
    const inspect = (value: unknown) => { element("#feature-inspect").textContent = JSON.stringify(value, null, 2); };
    const setStatus = (text: string, error = false) => {
      status.textContent = text;
      status.className = error ? "status error" : "status";
    };
    const fail = (error: unknown) => {
      if (signal.aborted) return;
      onFailure();
      results.replaceChildren();
      setStatus(errorMessage(error), true);
      inspect({ error: errorMessage(error) });
    };
    const on = (selector: string, event: string, action: () => void | Promise<void>) => {
      element(selector).addEventListener(event, () => {
        try {
          const pending = action();
          if (pending) void pending.catch(fail);
        } catch (error) { fail(error); }
      }, { signal });
    };
    function showRows(rows: readonly AnyRow[], columns: readonly string[], limit = 30): void {
      results.replaceChildren();
      const caption = document.createElement("p");
      caption.textContent = `${rows.length.toLocaleString()} matches. Showing ${Math.min(limit, rows.length)}; counts cover the full store.`;
      const scroll = document.createElement("div");
      scroll.className = "parts-table-scroll";
      const table = document.createElement("table");
      table.className = "parts-table";
      const head = table.createTHead().insertRow();
      columns.forEach((column) => {
        const cell = document.createElement("th");
        cell.scope = "col";
        cell.textContent = column;
        head.append(cell);
      });
      const body = table.createTBody();
      rows.slice(0, limit).forEach((row) => {
        const line = body.insertRow();
        columns.forEach((column) => { line.insertCell().textContent = display(row[column]); });
      });
      scroll.append(table);
      results.append(caption, scroll);
    }
    element("#feature-code").textContent = description.code;
    on("#feature-retry", "click", () => { controller.abort(); return show(id, parentSignal); });
    try {
      if (id === "csv-workbench") {
        setupCsv();
        element<HTMLFieldSetElement>("#feature-controls").disabled = false;
        setStatus("Choose your CSV or try the bundled catalog. Review types before preparing.");
        return;
      }
      if (id === "compatibility") {
        setupCompatibility();
        element<HTMLFieldSetElement>("#feature-controls").disabled = false;
        return;
      }
      const store = await (id === "operating-ranges" ? loadParts(signal) : loadRetail(signal));
      if (signal.aborted) return;
      if (id === "product-discovery") setupProducts(store);
      else if (id === "keyword-discovery") setupKeywords(store);
      else if (id === "operating-ranges") setupRanges(store);
      else if (id === "catalog-refresh") setupRefresh(store);
      else await setupWorker(store);
      if (!signal.aborted) element<HTMLFieldSetElement>("#feature-controls").disabled = false;
    } catch (error) {
      if (!signal.aborted) {
        fail(error);
        element<HTMLButtonElement>("#feature-retry").hidden = false;
      }
    }

    function setupProducts(store: Store<AnyRow>): void {
      const keywords = element<HTMLInputElement>("#product-keywords");
      const filters = element<HTMLInputElement>("#product-filters");
      const market = element<HTMLSelectElement>("#product-market");
      const order = element<HTMLSelectElement>("#product-order");
      const markets = new Set(store.queryAll().flatMap((row) => String(row.markets).split(",")));
      [...markets].sort().forEach((name) => market.add(new Option(name, name)));
      const update = () => {
        const response = discoverProducts(store, keywords.value, filters.value, market.value);
        const chips = element("#product-chips");
        chips.replaceChildren();
        response.interpretation.filters.forEach((filter) => {
          const chip = document.createElement("span");
          chip.className = "filter-chip";
          chip.textContent = filter.text;
          chips.append(chip);
        });
        if (response.status === "blocked") {
          results.replaceChildren();
          setStatus("Resolve every strict-filter issue before searching. No partial filter search is executed.", true);
          inspect(response.interpretation);
          return;
        }
        const rows = [...response.rows];
        if (order.value === "price") rows.sort((a, b) => Number(a.unitPrice) - Number(b.unitPrice));
        else if (order.value !== "source") throw new Error("Choose a valid display order.");
        results.replaceChildren();
        const caption = document.createElement("p");
        caption.textContent = `${rows.length.toLocaleString()} matches across ${store.getLoadedRowCount().toLocaleString()} products. Showing the first 12.`;
        const cards = document.createElement("div");
        cards.className = "product-grid";
        rows.slice(0, 12).forEach((row) => {
          const card = document.createElement("article");
          card.className = "product-card";
          const name = document.createElement("h3");
          name.textContent = String(row.title);
          const price = document.createElement("strong");
          const formatPrice = (value: unknown) => Number(value).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
          price.textContent = `GBP ${formatPrice(row.unitPrice)} - ${formatPrice(row.maxUnitPrice)}`;
          const details = document.createElement("p");
          details.textContent = `SKU ${row.sku} | ${Number(row.unitsSold).toLocaleString()} units in included positive sales`;
          const countries = document.createElement("p");
          countries.className = "muted";
          countries.textContent = `Observed markets: ${row.markets}`;
          card.append(name, price, details, countries);
          cards.append(card);
        });
        results.append(caption, cards);
        inspect({
          conditions: response.conditions, total: rows.length,
          usedKeywords: response.keywordResult?.usedKeywords, correctedKeywords: response.keywordResult?.correctedKeywords,
        });
        setStatus("Keyword matching and strict filters are applied together. Display sorting is application code.");
      };
      [keywords, filters].forEach((input) => input.addEventListener("input", () => { try { update(); } catch (error) { fail(error); } }, { signal }));
      on("#product-market", "change", update);
      on("#product-order", "change", update);
      on("#product-bags", "click", () => { keywords.value = "bag"; filters.value = "price<5GBP sold>=100"; market.value = ""; update(); });
      on("#product-lanterns", "click", () => { keywords.value = "latern"; filters.value = "price<10GBP"; market.value = ""; update(); });
      on("#product-clear", "click", () => { keywords.value = ""; filters.value = ""; market.value = ""; update(); });
      update();
    }
    function setupKeywords(store: Store<AnyRow>): void {
      const search = new KeywordSearch(store);
      const input = element<HTMLInputElement>("#keyword-input");
      const update = () => {
        if (!input.value.trim()) throw new Error("Enter at least one title keyword.");
        const response = search.bestMatch(input.value, { fields: ["title"], limit: store.getLoadedRowCount() });
        showRows(response.results, ["sku", "title", "unitPrice"]);
        const { results: _rows, ...metadata } = response;
        inspect(metadata);
        setStatus(response.truncated
          ? "Keyword input exceeded 10 distinct tokens; only the first 10 were used. Inspect truncated and usedKeywords below."
          : `${store.getLoadedRowCount().toLocaleString()} titles searched. Corrections and used tokens are shown below.`);
      };
      on("#keyword-input", "input", update);
      on("#keyword-typo", "click", () => { input.value = "latern"; update(); });
      on("#keyword-stem", "click", () => { input.value = "decorating"; update(); });
      on("#keyword-none", "click", () => { input.value = "zzzzzzzx"; update(); });
      update();
    }
    function setupCompatibility(): void {
      const store = connectorStore();
      for (const group of ["required", "excluded"]) {
        CAPABILITIES.forEach((name) => {
          const label = document.createElement("label");
          label.className = "feature-check";
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.value = name;
          checkbox.checked = group === "required" ? name === "OAuth" || name === "Webhooks" : name === "On-prem agent";
          label.append(checkbox, document.createTextNode(name));
          element(`#${group}-capabilities`).append(label);
        });
      }
      const update = () => {
        const selected = (group: string) => [...element(`#${group}-capabilities`).querySelectorAll<HTMLInputElement>("input:checked")].map((input) => input.value);
        const mode = element<HTMLSelectElement>("#capability-mode").value;
        if (mode !== "all" && mode !== "any") throw new Error("Choose ALL or ANY.");
        const response = matchConnectors(store, selected("required"), mode, selected("excluded"));
        showRows(response.rows, ["name", "capabilities"]);
        inspect(response.conditions);
        setStatus("Eight fictional fixtures. Inspect the operators to see set semantics, not text-substring matching.");
      };
      on("#required-capabilities", "change", update);
      on("#excluded-capabilities", "change", update);
      on("#capability-mode", "change", update);
      update();
    }
    function setupRanges(source: Store<AnyRow>): void {
      const ranges = operatingStore(source.queryAll());
      const lower = element<HTMLInputElement>("#range-lower");
      const upper = element<HTMLInputElement>("#range-upper");
      const mode = element<HTMLSelectElement>("#range-mode");
      const update = () => {
        if (mode.value !== "point" && mode.value !== "interval") throw new Error("Choose a supported range mode.");
        element("#range-upper-label").hidden = mode.value === "point";
        const response = matchOperatingRange(ranges.store, lower.valueAsNumber, mode.value === "point" ? lower.valueAsNumber : upper.valueAsNumber);
        showRows(response.rows, ["id", "partNumber", "manufacturer", "sourceTemperature", "operatingRange"]);
        inspect(response.conditions);
        setStatus(`${ranges.parsed.toLocaleString()} parsed source ranges; ${ranges.missing.toLocaleString()} missing; ${ranges.unrecognized.toLocaleString()} unrecognized. Source rows retained: ${source.getLoadedRowCount().toLocaleString()}.`);
      };
      on("#range-lower", "input", update);
      on("#range-upper", "input", update);
      on("#range-mode", "change", update);
      on("#range-boundary", "click", () => { mode.value = "point"; lower.value = "150"; update(); });
      on("#range-outside", "click", () => { mode.value = "point"; lower.value = "200"; update(); });
      update();
    }
    function setupRefresh(store: Store<AnyRow>): void {
      const snapshots = new CatalogSnapshots(store);
      const original = store.queryAll();
      const firstSku = String(original[0].sku);
      const activate = element<HTMLButtonElement>("#refresh-activate");
      const query = () => {
        const rows = snapshots.interpreter.search(`sku:${JSON.stringify(firstSku)}`);
        showRows(rows, ["sku", "title", "unitPrice", "maxUnitPrice"]);
        element("#refresh-revision").textContent = `Active revision ${snapshots.revision}; ${snapshots.store.getLoadedRowCount().toLocaleString()} products. Prepared replacement: ${snapshots.hasStaged ? "ready" : "none"}.`;
        inspect({ revision: snapshots.revision, firstSku, hasStaged: snapshots.hasStaged, originalFirstPrice: original[0].unitPrice });
      };
      const stage = (broken: boolean) => {
        activate.disabled = true;
        const price = element<HTMLInputElement>("#refresh-price").valueAsNumber;
        const rows = original.map((row, index) => index === 0 ? {
          ...row, unitPrice: broken ? "not-a-number" : price, maxUnitPrice: Math.max(price, Number(row.maxUnitPrice)),
        } : row);
        try {
          snapshots.stage(rows);
          activate.disabled = false;
          setStatus("Replacement validated and prepared. Active search still uses the old snapshot. Activate when ready.");
        } catch (error) {
          setStatus(`Replacement rejected: ${errorMessage(error)} Active revision ${snapshots.revision} is unchanged.`, true);
        }
        query();
      };
      on("#refresh-stage", "click", () => stage(false));
      on("#refresh-broken", "click", () => stage(true));
      on("#refresh-query", "click", () => { query(); setStatus("Queried only the active, complete snapshot."); });
      on("#refresh-activate", "click", () => {
        snapshots.activate();
        activate.disabled = true;
        query();
        setStatus("Prepared snapshot activated with a new interpreter. The original shared catalog is unchanged.");
      });
      query();
      setStatus("Revision 1 is active. Try a broken replacement, then prepare and activate a valid one.");
    }
    async function setupWorker(store: Store<AnyRow>): Promise<void> {
      const worker = new Worker(new URL("./retail.worker.ts", import.meta.url), { type: "module" });
      const client = new BrowserWorkerClient<AnyRow>(worker);
      let frame = 0;
      let frameHandle = 0;
      let run: AbortController | undefined;
      let previousProjection: string | undefined;
      let workerFailed = false;
      let runSequence = 0;
      const records: AnyRow[] = [];
      const tick = () => {
        if (signal.aborted) return;
        element("#worker-frames").textContent = String(++frame);
        frameHandle = requestAnimationFrame(tick);
      };
      signal.addEventListener("abort", () => {
        run?.abort();
        cancelAnimationFrame(frameHandle);
        client.dispose();
        worker.terminate();
      }, { once: true });
      try {
        await new Promise<void>((resolve, reject) => {
          const cleanup = () => {
            clearTimeout(timeout);
            worker.removeEventListener("message", ready);
            worker.removeEventListener("error", failed);
            signal.removeEventListener("abort", aborted);
          };
          const ready = (event: MessageEvent<unknown>) => {
            if (!isRecord(event.data)) return;
            if (event.data.type === "ready") { cleanup(); resolve(); }
            else if (event.data.type === "initialization-error") { cleanup(); reject(new Error(String(event.data.message))); }
          };
          const failed = (event: ErrorEvent) => { cleanup(); reject(new Error(event.message || "Worker failed to initialize.")); };
          const aborted = () => { cleanup(); reject(new DOMException("View closed.", "AbortError")); };
          const timeout = setTimeout(() => { cleanup(); reject(new Error("Worker preparation exceeded 30 seconds. Retry loading.")); }, 30000);
          worker.addEventListener("message", ready);
          worker.addEventListener("error", failed);
          signal.addEventListener("abort", aborted, { once: true });
          worker.postMessage({ type: "initialize", rows: store.queryAll() });
        });
      } catch (error) {
        client.dispose();
        worker.terminate();
        throw error;
      }
      if (signal.aborted) return;
      const adapter = new InMemoryWorkerAdapter<AnyRow>(new Map([["retail", store]]));
      frameHandle = requestAnimationFrame(tick);
      const mainButton = element<HTMLButtonElement>("#worker-main");
      const workerButton = element<HTMLButtonElement>("#worker-background");
      const cancel = element<HTMLButtonElement>("#worker-cancel");
      worker.addEventListener("error", (event) => {
        workerFailed = true;
        run?.abort();
        mainButton.disabled = workerButton.disabled = true;
        fail(new Error(event.message || "Worker execution failed. Retry loading."));
        element<HTMLButtonElement>("#feature-retry").hidden = false;
      }, { signal });
      const benchmark = async (background: boolean) => {
        const iterations = validateIterations(element<HTMLInputElement>("#worker-iterations").valueAsNumber);
        run = new AbortController();
        const runId = `comparison-${++runSequence}`;
        mainButton.disabled = workerButton.disabled = true;
        cancel.disabled = !background;
        const started = performance.now();
        const startFrames = frame;
        let last = "";
        try {
          for (let index = 0; index < iterations; index++) {
            const response = background
              ? await client.execute(benchmarkRequest(index, runId), {
                signal: run.signal,
                onProgress: (event) => { element("#worker-progress").textContent = `Query ${index + 1}/${iterations}: ${event.phase}`; },
              })
              : await adapter.execute(benchmarkRequest(index, runId), { isCancelled: () => run?.signal.aborted === true });
            if (!response.ok) throw new Error(`${response.errorCode}: ${response.message}`);
            last = JSON.stringify(response.result);
          }
          signal.throwIfAborted();
          records.push({
            mode: background ? "Web Worker" : "Main thread", iterations,
            elapsedMs: Number((performance.now() - started).toFixed(2)), animationFramesDuringRun: frame - startFrames,
            lastProjectionMatchesPrevious: previousProjection === undefined ? "First run" : last === previousProjection,
          });
          previousProjection = last;
          showRows(records, ["mode", "iterations", "elapsedMs", "animationFramesDuringRun", "lastProjectionMatchesPrevious"]);
          inspect(benchmarkRequest(0, runId));
          setStatus("Completed. Compare actual timings and observed animation frames; worker timings include message overhead.");
        } catch (error) {
          if (!signal.aborted) {
            setStatus(`Run stopped: ${errorMessage(error)}`, true);
            element("#worker-progress").textContent = "Run stopped. Previous completed measurements are retained.";
            inspect({ cancelled: run.signal.aborted, message: errorMessage(error) });
          }
        } finally {
          if (!signal.aborted) { mainButton.disabled = workerButton.disabled = workerFailed; cancel.disabled = true; }
        }
      };
      on("#worker-main", "click", () => benchmark(false));
      on("#worker-background", "click", () => benchmark(true));
      on("#worker-cancel", "click", () => run?.abort());
      setStatus("Both stores are prepared. Run each mode with the same repetition count; watch the main-thread frame counter.");
    }
    function setupCsv(): void {
      let inspection: CsvInspection | undefined;
      let dataset: PlaygroundDataset | undefined;
      let store: Store<AnyRow> | undefined;
      let currentRows: readonly AnyRow[] = [];
      let lastConditions: readonly Condition<AnyRow>[] = [];
      let queryDirty = false;
      let fileName = "Local CSV";
      let fileRevision = 0;
      const prepare = element<HTMLButtonElement>("#csv-prepare");
      const panel = element("#csv-query-panel");
      const exportButton = element<HTMLButtonElement>("#csv-export");
      onFailure = () => { currentRows = []; queryDirty = true; exportButton.disabled = true; };
      const reset = () => { dataset = undefined; store = undefined; currentRows = []; lastConditions = []; exportButton.disabled = true; panel.hidden = true; results.replaceChildren(); };
      const review = (csv: string, name: string) => {
        reset();
        inspection = undefined;
        prepare.disabled = true;
        element("#csv-mapping").replaceChildren();
        element("#csv-mapping").replaceChildren();
        const parsed = inspectCsv(csv);
        inspection = parsed;
        fileName = name;
        const table = document.createElement("table");
        table.className = "parts-table";
        const head = table.createTHead().insertRow();
        ["Column", "Sample", "Type", "Index"].forEach((value) => { const cell = document.createElement("th"); cell.textContent = value; head.append(cell); });
        const body = table.createTBody();
        parsed.guesses.forEach((mapping, index) => {
          const row = body.insertRow();
          row.insertCell().textContent = mapping.header;
          row.insertCell().textContent = parsed.records[0][index];
          const type = document.createElement("select");
          type.dataset.column = String(index);
          type.setAttribute("aria-label", `Type for ${mapping.header}`);
          ["text", "number", "boolean", "strings"].forEach((value) => type.add(new Option(value === "strings" ? "Comma-separated text collection" : value, value)));
          type.value = mapping.type;
          row.insertCell().append(type);
          const indexed = document.createElement("input");
          indexed.type = "checkbox";
          indexed.checked = true;
          indexed.dataset.index = String(index);
          indexed.setAttribute("aria-label", `Index ${mapping.header}`);
          row.insertCell().append(indexed);
        });
        const scroll = document.createElement("div");
        scroll.className = "parts-table-scroll";
        scroll.append(table);
        element("#csv-mapping").append(scroll);
        prepare.disabled = false;
        inspect({ fileName, rows: parsed.records.length, columns: parsed.headers.length, inferredTypes: parsed.guesses });
        setStatus(`${name}: ${parsed.records.length.toLocaleString()} rows. Review all column types, then prepare. Data stays local.`);
      };
      const readFile = async (file: File) => {
        const revision = ++fileRevision;
        reset();
        inspection = undefined;
        prepare.disabled = true;
        if (file.size > CSV_MAX_BYTES) throw new Error("CSV exceeds the 10 MiB limit.");
        if (!file.name.toLowerCase().endsWith(".csv")) throw new Error("Choose a .csv file.");
        const csv = await file.text();
        if (!signal.aborted && revision === fileRevision) review(csv, file.name);
      };
      on("#csv-file", "change", () => {
        const file = element<HTMLInputElement>("#csv-file").files?.[0];
        if (file) return readFile(file);
      });
      element("#csv-drop").addEventListener("dragover", (event) => { event.preventDefault(); }, { signal });
      element("#csv-drop").addEventListener("drop", (event) => {
        event.preventDefault();
        const file = event.dataTransfer?.files[0];
        if (file) void readFile(file).catch(fail);
      }, { signal });
      on("#csv-sample", "click", async () => {
        const revision = ++fileRevision;
        reset();
        inspection = undefined;
        prepare.disabled = true;
        const response = await fetch(`${import.meta.env.BASE_URL}data/${RETAIL_DEFINITION.csvFile}`, { signal });
        if (!response.ok) throw new Error(`Could not load the sample CSV: HTTP ${response.status}`);
        const csv = await response.text();
        if (!signal.aborted && revision === fileRevision) review(csv, "retail-products.csv");
      });
      const mappings = (): CsvMapping[] => {
        if (!inspection) throw new Error("Inspect a CSV first.");
        return inspection.headers.map((header, index) => {
          const type = element<HTMLSelectElement>(`[data-column="${index}"]`).value;
          if (type !== "text" && type !== "number" && type !== "boolean" && type !== "strings") throw new Error("Choose a valid column type.");
          return { header, type, indexed: element<HTMLInputElement>(`[data-index="${index}"]`).checked };
        });
      };
      const updateOperators = () => {
        if (!dataset) return;
        const column = dataset.fields.find((field) => field.name === element<HTMLSelectElement>("#csv-field").value);
        if (!column) throw new Error("Choose an indexed column.");
        const select = element<HTMLSelectElement>("#csv-operator");
        select.replaceChildren();
        const operators: OperatorType[] = column.options?.secondaryType
          ? [Operator.CONTAINS_EITHER, Operator.CONTAINS_ALL, Operator.NOT_CONTAINS]
          : column.kind === "number"
            ? [Operator.EQUAL, Operator.NOT_EQUAL, Operator.LESS_THAN, Operator.LESS_THAN_EQUAL, Operator.GREATER_THAN, Operator.GREATER_THAN_EQUAL]
            : [Operator.EQUAL, Operator.NOT_EQUAL];
        operators.forEach((operator) => select.add(new Option(operator, operator)));
      };
      const project = (conditions: readonly Condition<AnyRow>[]) => {
        if (!store || !dataset) throw new Error("Prepare a valid CSV store first.");
        const fields = [...element("#csv-projection").querySelectorAll<HTMLInputElement>("input:checked")].map((input) => input.value);
        if (!fields.length) throw new Error("Select at least one projected column.");
        currentRows = conditions.length ? store.searchProjection(conditions, fields)
          : store.queryAll().map((row) => Object.fromEntries(fields.map((name) => [name, row[name]])));
        lastConditions = conditions;
        queryDirty = false;
        exportButton.disabled = false;
        showRows(currentRows, fields);
        inspect({ conditions, projectedFields: fields, matches: currentRows.length, schema: dataset.fields });
        setStatus(`${currentRows.length.toLocaleString()} matching records from ${store.getLoadedRowCount().toLocaleString()} local rows. Export uses this projection.`);
      };
      on("#csv-prepare", "click", () => {
        reset();
        if (!inspection) throw new Error("Inspect a CSV first.");
        const candidate = importCsv(inspection, mappings(), fileName);
        const prepared = buildStore(candidate);
        dataset = candidate;
        store = prepared;
        const fields = element<HTMLSelectElement>("#csv-field");
        fields.replaceChildren();
        const projection = element("#csv-projection");
        projection.replaceChildren();
        candidate.fields.forEach((column) => {
          if (!column.options?.ignoreIndex) fields.add(new Option(column.name, column.name));
          const label = document.createElement("label");
          label.className = "feature-check";
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox"; checkbox.checked = true; checkbox.value = column.name;
          label.append(checkbox, document.createTextNode(column.name));
          projection.append(label);
        });
        panel.hidden = false;
        element<HTMLButtonElement>("#csv-search").disabled = !fields.options.length;
        if (fields.options.length) updateOperators();
        project([]);
      });
      const markDirty = () => {
        queryDirty = true;
        currentRows = [];
        exportButton.disabled = true;
        results.replaceChildren();
        setStatus("Query controls changed. Run Search, or choose All records, before exporting.");
      };
      on("#csv-field", "change", () => { updateOperators(); markDirty(); });
      on("#csv-operator", "change", markDirty);
      on("#csv-value", "input", markDirty);
      on("#csv-search", "click", () => {
        if (!dataset) throw new Error("Prepare a store first.");
        const name = element<HTMLSelectElement>("#csv-field").value;
        const column = dataset.fields.find((field) => field.name === name);
        if (!column || column.options?.ignoreIndex) throw new Error("Choose an indexed column.");
        const raw = element<HTMLInputElement>("#csv-value").value.trim();
        if (!raw) throw new Error("Enter a value, or null for a missing value.");
        const operator = element<HTMLSelectElement>("#csv-operator").value;
        if (!Object.values(Operator).some((value) => value === operator)) throw new Error("Choose a supported operator.");
        const parse = (value: string): unknown => {
          if (value === "null") return null;
          if (column.kind === "number") {
            const number = Number(value);
            if (!value || !Number.isFinite(number) || (Number.isInteger(number) && !Number.isSafeInteger(number))) throw new Error("Enter a safely represented finite number.");
            return number;
          }
          if (column.kind === "boolean") {
            if (value !== "true" && value !== "false") throw new Error("Enter true, false, or null.");
            return value === "true";
          }
          return value;
        };
        const values = column.options?.secondaryType ? raw.split(",").map((value) => parse(value.trim())) : [parse(raw)];
        const typedOperator = Object.values(Operator).find((value) => value === operator);
        if (!typedOperator) throw new Error("Choose a supported operator.");
        project([{ field: name, operator: typedOperator, values }]);
      });
      on("#csv-all", "click", () => project([]));
      on("#csv-projection", "change", () => { if (queryDirty) markDirty(); else project(lastConditions); });
      on("#csv-export", "click", () => {
        if (!store || exportButton.disabled) throw new Error("Run a valid query before exporting.");
        download("kiara-matches.json", JSON.stringify(currentRows, null, 2));
        setStatus(`Exported the last successful projection: ${currentRows.length.toLocaleString()} matching rows.`);
      });
      on("#csv-editor", "click", () => {
        if (!dataset) throw new Error("Prepare a store first.");
        return openDataset(dataset);
      });
      on("#csv-mapping", "change", () => { reset(); setStatus("Mapping changed. Prepare again before searching."); });
    }
  };
}
