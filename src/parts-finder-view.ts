import { editQueryFragment, type QueryInterpretation, type Store } from "@kapoorlabs/kiara-ts";
import { PARTS_DEFINITION, PARTS_PRESETS, PartsFinder, partsExpression, replacePartsField } from "./parts-finder.ts";
import type { AnyRow } from "./query.ts";

export function createPartsFinderView(
  container: HTMLElement, loadParts: (signal: AbortSignal) => Promise<Store<AnyRow>>,
): (signal: AbortSignal) => void {
  let finder: PartsFinder | undefined;
  return (signal) => {
    container.innerHTML = `
      <section class="card">
        <h2>Filterless Parts Finder</h2>
        <p>Find the right component without finding the right filter. Kiara 1.1.0 turns typed values,
          aliases, quantities, and comparisons into explicit filters.</p>
        <label for="parts-input">Search the component catalog</label>
        <input id="parts-input" class="parts-input" type="search" maxlength="4096" disabled
          aria-describedby="parts-help parts-status" value="ceramic cap:10uF voltage>=25V" />
        <p id="parts-help" class="muted">Separate expressions with spaces. Keep quantities and operators together:
          <code>cap:10uF</code>, <code>voltage&gt;=25V</code>, <code>stock&gt;1000</code>.
          Quote multiword values. Bare values mean equality, not an assumed minimum.</p>
        <div id="parts-presets" class="example-controls" aria-label="Search examples"></div>
        <h3>Active filters</h3>
        <div id="parts-chips" class="filter-chips" aria-label="Active filters"></div>
        <div id="parts-issues" aria-live="polite"></div>
        <p id="parts-status" class="status" role="status">Loading the full component CSV...</p>
        <button id="parts-retry" class="secondary-button" type="button" hidden>Retry component loading</button>
      </section>
      <section class="card">
        <details>
          <summary>Traditional filters — the same query state</summary>
          <p class="muted">These controls mirror the search box. Editing a field replaces all of its existing
            constraints; other fields and unresolved input are preserved. Numeric values use canonical F/V units
            unless you type a unit. A range uses <code>lower..upper</code>, with units on both bounds.</p>
          <form id="parts-traditional" class="traditional-filters"></form>
        </details>
      </section>
      <section class="card">
        <h2>Matching components</h2>
        <p id="parts-count" class="muted"></p>
        <div class="parts-table-scroll"><table class="parts-table">
          <thead><tr><th>Part</th><th>Manufacturer</th><th>Package</th><th>Capacitance (F)</th>
            <th>Allowable voltage (V)</th><th>Stock snapshot</th><th>Dielectric</th></tr></thead>
          <tbody id="parts-rows"></tbody>
        </table></div>
        <details><summary>Generated Kiara conditions and unresolved fragments</summary><pre id="parts-query" class="example-output"></pre></details>
      </section>
      <section class="card">
        <h2>Real data, explicit boundaries</h2>
        <p id="parts-data-status" class="muted"></p>
        <p>This is a historical <strong>February 23, 2024</strong> JLCParts category snapshot, not live inventory,
          purchasing advice, or a guarantee that a part meets an engineering requirement.
          Source outliers and missing specifications are retained, never filled with invented values.
          One source capacitance is the literal <code>NaN</code>; its searchable value is null.</p>
        <p>All 16,802 source records are loaded. There are 22 fields, 18 searchable — not 100 fabricated
          specifications. The same schema-aware pattern can support more fields.</p>
        <p><a id="parts-download">Download the complete CSV</a> ·
          <a href="${PARTS_DEFINITION.sourceUrl}" target="_blank" rel="noopener noreferrer">Pinned source</a> ·
          <a id="parts-license">Source MIT license</a></p>
        <p class="muted">Capacitance is canonicalized to 15 significant digits to remove upstream conversion noise;
          original capacitance and allowable-voltage text remain in source columns. Units and aliases are declared
          metadata, not unrestricted natural-language inference.</p>
      </section>
    `;
    const element = <T extends Element>(selector: string): T => {
      const found = container.querySelector<T>(selector);
      if (!found) throw new Error(`Missing parts finder element: ${selector}`);
      return found;
    };
    const input = element<HTMLInputElement>("#parts-input");
    const status = element<HTMLElement>("#parts-status");
    const chips = element<HTMLElement>("#parts-chips");
    const issues = element<HTMLElement>("#parts-issues");
    const rows = element<HTMLElement>("#parts-rows");
    const count = element<HTMLElement>("#parts-count");
    const query = element<HTMLElement>("#parts-query");
    const form = element<HTMLFormElement>("#parts-traditional");
    const retry = element<HTMLButtonElement>("#parts-retry");
    const presets = element<HTMLElement>("#parts-presets");
    element<HTMLAnchorElement>("#parts-download").href = `${import.meta.env.BASE_URL}data/capacitors.csv`;
    element<HTMLAnchorElement>("#parts-license").href = `${import.meta.env.BASE_URL}data/LICENSE-jlcparts.txt`;
    let interpretation: QueryInterpretation<AnyRow> | undefined;

    const operators = [":", "!=", "<", "<=", ">", ">="];
    for (const field of PARTS_DEFINITION.fields.filter((field) => !field.options?.ignoreIndex)) {
      const row = document.createElement("div");
      row.className = "traditional-field";
      row.dataset.field = field.name;
      const label = document.createElement("label");
      label.htmlFor = `parts-field-${field.name}`;
      label.textContent = field.name;
      const operator = document.createElement("select");
      operator.setAttribute("aria-label", `${field.name} operator`);
      for (const symbol of field.kind === "number" ? operators : operators.slice(0, 2)) {
        operator.add(new Option(symbol === ":" ? "equals / range" : symbol, symbol));
      }
      const value = document.createElement("input");
      value.id = label.htmlFor;
      value.setAttribute("aria-label", `${field.name} value`);
      value.placeholder = field.kind === "number" ? "e.g. 10uF or 1uF..10uF" : "Any value";
      row.append(label, operator, value);
      form.append(row);
    }
    form.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select").forEach((control) => {
      control.disabled = true;
    });
    for (const [index, preset] of PARTS_PRESETS.entries()) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary-button";
      button.textContent = preset.label;
      button.dataset.preset = String(index);
      button.disabled = true;
      presets.append(button);
    }

    const fail = (error: unknown) => {
      status.className = "status error";
      status.textContent = error instanceof Error ? error.message : String(error);
      rows.replaceChildren();
      chips.replaceChildren();
      issues.replaceChildren();
      interpretation = undefined;
      query.textContent = status.textContent;
      count.textContent = "Search is unavailable; no partial results are shown.";
    };
    const update = () => {
      if (!finder) return;
      try {
        const started = performance.now();
        const result = finder.evaluate(input.value);
        interpretation = result.interpretation;
        chips.replaceChildren();
        issues.replaceChildren();
        rows.replaceChildren();
        for (const filter of interpretation.filters) {
          const chip = document.createElement("span");
          chip.className = "filter-chip";
          const label = document.createElement("span");
          label.textContent = `${filter.condition.field}: ${filter.text}`;
          chip.append(label);
          for (const action of ["Edit", "Remove"]) {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = action;
            button.dataset.action = action;
            button.dataset.id = filter.id;
            button.setAttribute("aria-label", `${action} ${filter.condition.field} filter`);
            chip.append(button);
          }
          chips.append(chip);
        }
        if (!interpretation.filters.length) chips.textContent = "No resolved filters.";
        for (const issue of interpretation.issues) {
          const block = document.createElement("div");
          block.className = "filter-issue";
          const label = document.createElement("p");
          label.textContent = `${issue.text}: ${issue.message}`;
          block.append(label);
          if (issue.kind === "ambiguous") {
            for (const candidate of issue.candidates) {
              const choice = document.createElement("button");
              choice.type = "button";
              choice.className = "secondary-button";
              choice.textContent = candidate.field;
              choice.dataset.id = issue.id;
              choice.dataset.field = candidate.field;
              block.append(choice);
            }
          }
          issues.append(block);
        }
        form.querySelectorAll<HTMLElement>("[data-field]").forEach((row) => {
          const filter = result.interpretation.filters.find((filter) => filter.condition.field === row.dataset.field);
          const operator = row.querySelector("select")!;
          const value = row.querySelector("input")!;
          if (!filter) { operator.value = ":"; value.value = ""; return; }
          const expression = partsExpression(filter.condition);
          const match = /^[^:<>!=]+(:|>=|<=|!=|=|>|<)(.*)$/.exec(expression)!;
          operator.value = match[1] === "=" ? ":" : match[1];
          value.value = typeof filter.condition.values?.[0] === "string"
            ? String(filter.condition.values[0]) : match[2];
        });
        query.textContent = JSON.stringify({
          conditions: interpretation.filters.map((filter) => filter.condition),
          issues: interpretation.issues,
        }, null, 2);
        if (result.status === "blocked") {
          status.className = "status error";
          status.textContent = "Resolve every highlighted fragment before searching. No partial query was executed.";
          count.textContent = "Results withheld until the complete query is resolved.";
          return;
        }
        for (const part of result.rows) {
          const row = document.createElement("tr");
          for (const field of ["partNumber", "manufacturer", "package", "capacitance", "voltage", "stock", "dielectric"]) {
            const cell = document.createElement("td");
            cell.textContent = part[field] === null ? "Unknown" : String(part[field]);
            row.append(cell);
          }
          rows.append(row);
        }
        status.className = "status";
        status.textContent = `${result.total.toLocaleString()} matches in ${(performance.now() - started).toFixed(1)} ms.`;
        count.textContent = `Showing ${result.rows.length} of ${result.total.toLocaleString()} matches from all 16,802 indexed records.`;
      } catch (error) {
        fail(error);
      }
    };
    const setInput = (value: string) => { input.value = value; update(); };
    input.addEventListener("input", update, { signal });
    presets.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-preset]") : null;
      if (button) setInput(PARTS_PRESETS[Number(button.dataset.preset)].input);
    }, { signal });
    chips.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-action]") : null;
      const filter = interpretation?.filters.find((filter) => filter.id === button?.dataset.id);
      if (!button || !filter || !interpretation) return;
      if (button.dataset.action === "Edit") {
        input.focus();
        input.setSelectionRange(filter.start, filter.end);
      } else {
        setInput(editQueryFragment(interpretation, filter.id, "").trim());
      }
    }, { signal });
    issues.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-field]") : null;
      const issue = interpretation?.issues.find((issue) => issue.id === button?.dataset.id);
      const candidate = issue?.candidates.find((candidate) => candidate.field === button?.dataset.field);
      if (candidate && issue && interpretation) setInput(editQueryFragment(interpretation, issue.id, partsExpression(candidate)));
    }, { signal });
    form.addEventListener("submit", (event) => event.preventDefault(), { signal });
    form.addEventListener("change", (event) => {
      if (!interpretation || !(event.target instanceof Element)) return;
      const row = event.target.closest<HTMLElement>("[data-field]");
      if (!row) return;
      const field = PARTS_DEFINITION.fields.find((field) => field.name === row.dataset.field)!;
      const value = row.querySelector("input")!.value.trim();
      const operator = row.querySelector("select")!.value;
      const expression = !value ? "" : field.name + operator + (field.kind === "number" ? value : JSON.stringify(value));
      setInput(replacePartsField(interpretation, field.name, expression));
    }, { signal });
    const load = async () => {
      retry.hidden = true;
      input.disabled = true;
      container.setAttribute("aria-busy", "true");
      status.className = "status";
      status.textContent = "Loading and preparing all component records...";
      try {
        if (!finder) {
          const store = await loadParts(signal);
          if (signal.aborted) return;
          finder = new PartsFinder(store);
          const missing = store.queryAll().filter((row) => row.capacitance === null).length;
          element<HTMLElement>("#parts-data-status").textContent =
            `${missing.toLocaleString()} records have unknown/unavailable capacitance and do not satisfy numeric capacitance filters.`;
        } else {
          element<HTMLElement>("#parts-data-status").textContent = "Prepared store and value dictionaries reused from this page's cache.";
        }
        input.disabled = false;
        form.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select").forEach((control) => {
          control.disabled = false;
        });
        presets.querySelectorAll("button").forEach((button) => { button.disabled = false; });
        update();
      } catch (error) {
        if (signal.aborted) return;
        fail(new Error(`Component loading failed: ${error instanceof Error ? error.message : String(error)} Use Retry to try again.`));
        retry.hidden = false;
      } finally {
        if (!signal.aborted) container.setAttribute("aria-busy", "false");
      }
    };
    retry.addEventListener("click", () => void load(), { signal });
    void load();
  };
}
