import type { Store } from "@kapoorlabs/kiara-ts";
import type { AnyRow } from "./query.ts";
import { AIRPORT_FIELDS, AirportTypeahead, type AirportScope, type Prediction } from "./typeahead.ts";
import { RuntimeConfigEngine, SAMPLE_CONFIG_RULES, type FlightContext } from "./runtime-config.ts";
import { createPartsFinderView } from "./parts-finder-view.ts";
import { isFeatureDemo, type FeatureDemoId } from "./business-demos.ts";
import { createBusinessDemoView } from "./business-demo-view.ts";
import type { PlaygroundDataset } from "./datasets.ts";

export type ApplicationExample = "typeahead" | "runtime-config" | "parts-finder" | FeatureDemoId;

export function createApplicationExamples(
  container: HTMLElement,
  loadAirports: (signal: AbortSignal) => Promise<Store<AnyRow>>,
  loadParts: (signal: AbortSignal) => Promise<Store<AnyRow>>,
  loadRetail: (signal: AbortSignal) => Promise<Store<AnyRow>>,
  openDataset: (dataset: PlaygroundDataset) => Promise<void>,
) {
  let controller: AbortController | undefined;
  let typeahead: AirportTypeahead | undefined;
  const configuration = new RuntimeConfigEngine();
  const showParts = createPartsFinderView(container, loadParts);
  const showBusiness = createBusinessDemoView(container, loadRetail, loadParts, openDataset);

  function element<T extends Element>(selector: string): T {
    const result = container.querySelector<T>(selector);
    if (!result) throw new Error(`Missing application example element: ${selector}`);
    return result;
  }

  function showTypeahead(signal: AbortSignal): void {
    container.innerHTML = `
      <section class="card">
        <h2>Airport type-ahead engine</h2>
        <p>Complete words from all 7,698 airport records: codes, airport names, and countries.
          Suggestions complete the last whitespace-separated word, not an entire airport record.</p>
        <p class="muted">A prepared DictionaryTrie is reused as you type. If no prefix matches,
          try a one-edit correction (for words longer than three characters).</p>
        <p><a href="https://kapoorconsciousnes.medium.com/make-a-type-ahead-engine-with-kiara-in-5-minutes-456717441b40"
          target="_blank" rel="noopener noreferrer">Original Java article</a></p>
        <div class="example-controls">
          <label>Search field
            <select id="typeahead-scope">
              <option value="all">Codes, names, and countries</option>
              <option value="airportCode">Airport code</option>
              <option value="airportName">Airport name</option>
              <option value="countryName">Country name</option>
            </select>
          </label>
          <label>Maximum suggestions
            <select id="typeahead-limit"><option>3</option><option selected>5</option><option>10</option></select>
          </label>
        </div>
        <label for="typeahead-input">Airport search</label>
        <input id="typeahead-input" type="text" role="combobox" aria-autocomplete="list"
          aria-expanded="false" aria-controls="typeahead-options" autocomplete="off"
          maxlength="128" value="lon" disabled />
        <div id="typeahead-options" role="listbox" aria-label="Airport word suggestions" hidden></div>
        <p class="muted">Try <code>lon</code>, <code>jfk</code>, <code>united</code>, <code>united sta</code>,
          or the typo <code>londn</code>. Use Up/Down and Enter, or click a suggestion. Escape closes the list.</p>
        <p id="typeahead-status" class="status" role="status" aria-live="polite">Loading the complete airport CSV...</p>
        <button id="typeahead-retry" class="secondary-button" type="button" hidden>Retry airport loading</button>
      </section>
      <section class="card">
        <h2>Matching airport records</h2>
        <p class="muted">Selecting a word runs a separate KeywordSearch.bestMatch over the selected fields.
          Matching is token-scored, not an exact phrase filter. Some source airport names are city labels.</p>
        <pre id="typeahead-results" class="example-output">Choose a suggestion to search the airport records.</pre>
      </section>
    `;
    const input = element<HTMLInputElement>("#typeahead-input");
    const scopeSelect = element<HTMLSelectElement>("#typeahead-scope");
    const limitSelect = element<HTMLSelectElement>("#typeahead-limit");
    const options = element<HTMLElement>("#typeahead-options");
    const status = element<HTMLElement>("#typeahead-status");
    const results = element<HTMLElement>("#typeahead-results");
    const retry = element<HTMLButtonElement>("#typeahead-retry");
    let predictions: readonly Prediction[] = [];
    let activeIndex = -1;

    const scope = (): AirportScope => {
      if (scopeSelect.value === "all") return "all";
      const field = AIRPORT_FIELDS.find((name) => name === scopeSelect.value);
      if (!field) throw new Error("Select a valid airport field.");
      return field;
    };
    const close = () => {
      options.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      activeIndex = -1;
    };
    const fail = (error: unknown) => {
      close();
      status.className = "status error";
      status.textContent = message(error);
    };
    const choose = (index: number) => {
      if (!typeahead || !predictions[index]) return;
      try {
        input.value = predictions[index].value;
        close();
        const response = typeahead.search(input.value, scope());
        results.textContent = JSON.stringify(response, null, 2);
        status.className = "status";
        status.textContent = `${response.results.length} matching records shown from ${typeahead.recordCount.toLocaleString()} indexed airports.`;
      } catch (error) {
        fail(error);
      }
    };
    const update = () => {
      if (!typeahead) return;
      try {
        predictions = typeahead.suggest(input.value, scope(), Number(limitSelect.value));
        close();
        options.replaceChildren();
        results.textContent = "Choose a suggestion to search the airport records.";
        predictions.forEach((prediction, index) => {
          const option = document.createElement("button");
          option.type = "button";
          option.tabIndex = -1;
          option.id = `airport-option-${index}`;
          option.dataset.index = String(index);
          option.className = "prediction-option";
          option.setAttribute("role", "option");
          option.setAttribute("aria-selected", "false");
          option.textContent = prediction.value + (prediction.kind === "correction" ? " (one-edit correction)" : "");
          options.append(option);
        });
        options.hidden = !predictions.length;
        input.setAttribute("aria-expanded", String(predictions.length > 0));
        status.className = "status";
        status.textContent = `${typeahead.recordCount.toLocaleString()} airports indexed. ${
          predictions.length ? `${predictions.length} suggestions.` : input.value.trim()
            ? "No prefix or one-edit candidates." : "Type to get suggestions."
        }`;
      } catch (error) {
        fail(error);
      }
    };
    input.addEventListener("input", update, { signal });
    options.addEventListener("pointerdown", (event) => event.preventDefault(), { signal });
    options.addEventListener("click", (event) => {
      const option = event.target instanceof Element ? event.target.closest<HTMLElement>("[role=option]") : null;
      if (option && options.contains(option)) choose(Number(option.dataset.index));
    }, { signal });
    scopeSelect.addEventListener("change", update, { signal });
    limitSelect.addEventListener("change", update, { signal });
    input.addEventListener("blur", close, { signal });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key === "Enter" && activeIndex >= 0 && !options.hidden) {
        event.preventDefault();
        choose(activeIndex);
      } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && predictions.length) {
        event.preventDefault();
        options.hidden = false;
        input.setAttribute("aria-expanded", "true");
        activeIndex = event.key === "ArrowDown"
          ? (activeIndex + 1) % predictions.length
          : (activeIndex <= 0 ? predictions.length : activeIndex) - 1;
        options.querySelectorAll<HTMLElement>("[role=option]").forEach((option, index) => {
          option.setAttribute("aria-selected", String(index === activeIndex));
        });
        input.setAttribute("aria-activedescendant", `airport-option-${activeIndex}`);
      }
    }, { signal });

    const load = async () => {
      retry.hidden = true;
      input.disabled = true;
      container.setAttribute("aria-busy", "true");
      status.className = "status";
      status.textContent = "Loading and preparing airport type-ahead...";
      try {
        if (!typeahead) {
          const store = await loadAirports(signal);
          if (signal.aborted) return;
          typeahead = new AirportTypeahead(store);
        }
        input.disabled = false;
        update();
      } catch (error) {
        if (signal.aborted) return;
        fail(new Error(`Airport loading failed: ${message(error)} Use Retry to try again.`));
        retry.hidden = false;
      } finally {
        if (!signal.aborted) container.setAttribute("aria-busy", "false");
      }
    };
    retry.addEventListener("click", () => void load(), { signal });
    void load();
  }

  function showConfiguration(signal: AbortSignal): void {
    container.innerHTML = `
      <section class="card">
        <h2>Runtime hierarchical configuration engine</h2>
        <p>Resolve the article's country / city / airline surcharge rules for each flight.
          A rule's <code>null</code> dimension is a wildcard. A non-null dimension must match exactly.</p>
        <p class="muted">The most non-null dimensions wins. Equal-specificity winners are reported as ambiguous,
          never chosen by row order. Surcharge units are application-defined; this demo assigns none.</p>
        <p><a href="https://kapoorconsciousnes.medium.com/make-a-runtime-config-engine-with-kiara-in-5-minutes-fb2686dfd848"
          target="_blank" rel="noopener noreferrer">Original Java article</a></p>
        <form id="config-context" class="example-controls">
          <label>Country <input name="country" value="us" required /></label>
          <label>Origin city <input name="originCity" value="nyc" placeholder="Optional" /></label>
          <label>Airline <input name="airline" value="dl" placeholder="Optional" /></label>
        </form>
        <div class="example-controls">
          <button id="config-exact" class="secondary-button" type="button">Exact: US / NYC / DL</button>
          <button id="config-fallback" class="secondary-button" type="button">Fallback: US / BOS / DL</button>
          <button id="config-global" class="secondary-button" type="button">Global: GB / LHR / DL</button>
          <button id="config-missing" class="secondary-button" type="button">No match: GB / LHR / BA</button>
        </div>
        <p id="config-status" class="status" role="status" aria-live="polite"></p>
        <pre id="config-result" class="example-output"></pre>
      </section>
      <section class="card">
        <h2>Edit and replace the active rules</h2>
        <p>The six rules in the article's code plus its prose example of a worldwide Delta rule.
          These are deliberate configuration examples, not fabricated bulk CSV records.</p>
        <label for="config-rules">Rules JSON</label>
        <textarea id="config-rules" class="rules-editor" spellcheck="false"></textarea>
        <div class="example-controls">
          <button id="config-apply" class="primary-button" type="button">Apply rules atomically</button>
          <button id="config-reset" class="secondary-button" type="button">Reset article rules</button>
          <button id="config-ambiguity" class="secondary-button" type="button">Demonstrate a tie</button>
        </div>
        <p id="config-revision" class="muted"></p>
        <p class="muted">Invalid updates keep the last good store and revision. Missing city/airline inputs only
          match wildcard dimensions. Country identifiers such as <code>us</code> follow the article;
          the airport CSV's country labels are separate data.
          Changes live only in this page's memory and reset on reload.</p>
      </section>
    `;
    const form = element<HTMLFormElement>("#config-context");
    const editor = element<HTMLTextAreaElement>("#config-rules");
    const status = element<HTMLElement>("#config-status");
    const result = element<HTMLElement>("#config-result");
    const revision = element<HTMLElement>("#config-revision");
    const input = (name: string) => element<HTMLInputElement>(`#config-context [name="${name}"]`);
    const context = (): FlightContext => ({
      country: input("country").value, originCity: input("originCity").value, airline: input("airline").value,
    });
    const resolve = () => {
      try {
        const response = configuration.resolve(context());
        result.textContent = JSON.stringify(response, null, 2);
        status.className = response.status === "matched" ? "status" : "status error";
        status.textContent = response.status === "matched"
          ? `Surcharge ${response.winner.surcharge.toFixed(2)} from ${response.winner.id}.`
          : response.status === "ambiguous" ? "Ambiguous rules: resolve the highest-specificity tie before applying a surcharge."
            : "No matching rule. No surcharge has been selected.";
      } catch (error) {
        status.className = "status error";
        status.textContent = message(error);
        result.textContent = message(error);
      }
    };
    const refresh = () => {
      editor.value = JSON.stringify(configuration.rules, null, 2);
      revision.textContent = `Active revision ${configuration.revision}: ${configuration.rules.length} prepared rules.`;
      resolve();
    };
    const setContext = (country: string, city: string, airline: string) => {
      input("country").value = country;
      input("originCity").value = city;
      input("airline").value = airline;
      resolve();
    };
    form.addEventListener("input", resolve, { signal });
    form.addEventListener("submit", (event) => { event.preventDefault(); resolve(); }, { signal });
    element("#config-exact").addEventListener("click", () => setContext("us", "nyc", "dl"), { signal });
    element("#config-fallback").addEventListener("click", () => setContext("us", "bos", "dl"), { signal });
    element("#config-global").addEventListener("click", () => setContext("gb", "lhr", "dl"), { signal });
    element("#config-missing").addEventListener("click", () => setContext("gb", "lhr", "ba"), { signal });
    element("#config-apply").addEventListener("click", () => {
      try {
        configuration.replaceRules(JSON.parse(editor.value) as unknown);
        refresh();
      } catch (error) {
        status.className = "status error";
        status.textContent = `Update rejected: ${message(error)} Active revision ${configuration.revision} is unchanged.`;
      }
    }, { signal });
    element("#config-reset").addEventListener("click", () => {
      configuration.replaceRules(SAMPLE_CONFIG_RULES);
      setContext("us", "nyc", "dl");
      refresh();
    }, { signal });
    element("#config-ambiguity").addEventListener("click", () => {
      configuration.replaceRules(SAMPLE_CONFIG_RULES.filter((rule) => rule.id !== "us-nyc-delta"));
      setContext("us", "nyc", "dl");
      refresh();
    }, { signal });
    refresh();
  }

  return {
    show(example: ApplicationExample) {
      controller?.abort();
      controller = new AbortController();
      container.hidden = false;
      container.setAttribute("aria-busy", "false");
      if (example === "typeahead") showTypeahead(controller.signal);
      else if (example === "parts-finder") showParts(controller.signal);
      else if (isFeatureDemo(example)) void showBusiness(example, controller.signal);
      else showConfiguration(controller.signal);
    },
    hide() {
      controller?.abort();
      container.hidden = true;
      container.setAttribute("aria-busy", "false");
    },
    dispose() {
      controller?.abort();
    },
  };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
