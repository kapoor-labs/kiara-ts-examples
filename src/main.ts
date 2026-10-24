import "./style.css";
import { NormalizationProfile, type FieldOptions, type Store } from "@kapoorlabs/kiara-ts";
import { createScriptEditor } from "./editor.ts";
import { EXAMPLES, exampleScript } from "./examples.ts";
import { evaluateScript, executeScriptRequest, type AnyRow } from "./query.ts";
import { createApplicationExamples, type ApplicationExample } from "./application-examples.ts";
import { PARTS_DEFINITION } from "./parts-finder.ts";
import { FEATURE_DEMOS, RETAIL_DEFINITION } from "./business-demos.ts";
import {
  BUILT_IN_DATASETS, buildStore, parseDatasetCsv,
  type DatasetDefinition, type FieldKind, type NormalizationProfileValue,
  type PlaygroundDataset, type PlaygroundField,
} from "./datasets.ts";

const app = requireElement<HTMLDivElement>("#app");
app.innerHTML = `
  <div class="layout">
    <aside class="sidebar">
      <h1>Kiara TS Examples</h1>
      <p class="muted">Explore thousands of real CSV records with guided Kiara queries.</p>
      <nav id="dataset-menu" class="dataset-menu" aria-label="Dataset menu"></nav>
      <h2 class="sidebar-heading">Application examples</h2>
      <nav id="application-menu" class="dataset-menu" aria-label="Application examples">
        <button class="menu-item" type="button" data-example="typeahead">Airport type-ahead</button>
        <button class="menu-item" type="button" data-example="runtime-config">Runtime configuration</button>
        <button class="menu-item" type="button" data-example="parts-finder">Filterless Parts Finder</button>
        ${FEATURE_DEMOS.map((demo) => `<button class="menu-item" type="button" data-example="${demo.id}">${demo.title}</button>`).join("")}
      </nav>
      <button id="upload-dataset" class="secondary-button" type="button">Import dataset JSON</button>
      <input id="upload-file" type="file" accept="application/json,.json" hidden />
      <div class="byod-note">Upload JSON with <code>fields</code> and <code>rows</code>. See README for format.</div>
    </aside>
    <main class="content">
      <div id="query-playground" class="playground-panels">
      <section class="card">
        <h2 id="dataset-title">Loading Movies...</h2>
        <p id="dataset-description"></p>
        <p id="dataset-stats" class="muted"></p>
        <p id="dataset-source"></p>
        <details>
          <summary>Field schema and sample data (first 3 rows only)</summary>
          <pre id="schema-output"></pre>
          <pre id="sample-output"></pre>
        </details>
      </section>
      <section class="card">
        <div class="card-title-row">
          <h2>Search script</h2>
          <button id="reset-script" class="secondary-button" type="button">Reset script</button>
        </div>
        <label for="example-select">Guided query examples</label>
        <select id="example-select"></select>
        <p id="example-description"></p>
        <p id="example-expected" class="muted"></p>
        <p class="editor-help muted">Return a request object or conditions array. <code>Operator</code> is available.
          Press Ctrl+Space for suggestions and Ctrl+Enter (Cmd+Enter on Mac) to run. Selecting an example replaces the script.</p>
        <div id="script-editor"></div>
        <div class="actions">
          <button id="run-script" class="primary-button" type="button">Run script</button>
          <span id="status-text" class="status" role="status" aria-live="polite"></span>
        </div>
      </section>
      <section class="card">
        <h2>Result</h2>
        <pre id="result-output"></pre>
      </section>
      </div>
      <div id="application-examples" class="application-panels" hidden></div>
    </main>
  </div>
`;

const datasetMenu = requireElement<HTMLElement>("#dataset-menu");
const uploadDatasetButton = requireElement<HTMLButtonElement>("#upload-dataset");
const uploadFileInput = requireElement<HTMLInputElement>("#upload-file");
const datasetTitle = requireElement<HTMLElement>("#dataset-title");
const datasetDescription = requireElement<HTMLElement>("#dataset-description");
const datasetStats = requireElement<HTMLElement>("#dataset-stats");
const datasetSource = requireElement<HTMLElement>("#dataset-source");
const schemaOutput = requireElement<HTMLElement>("#schema-output");
const sampleOutput = requireElement<HTMLElement>("#sample-output");
const exampleSelect = requireElement<HTMLSelectElement>("#example-select");
const exampleDescription = requireElement<HTMLElement>("#example-description");
const exampleExpected = requireElement<HTMLElement>("#example-expected");
const scriptEditor = createScriptEditor(requireElement<HTMLElement>("#script-editor"));
const runScriptButton = requireElement<HTMLButtonElement>("#run-script");
const resetScriptButton = requireElement<HTMLButtonElement>("#reset-script");
const statusText = requireElement<HTMLElement>("#status-text");
const resultOutput = requireElement<HTMLElement>("#result-output");
const queryPlayground = requireElement<HTMLElement>("#query-playground");
const applicationMenu = requireElement<HTMLElement>("#application-menu");

let uploadedDataset: PlaygroundDataset | undefined;
let activeDataset: PlaygroundDataset | undefined;
let activeStore: Store<AnyRow> | undefined;
let selectedId = BUILT_IN_DATASETS[0].id;
let loading = false;
let loadController: AbortController | undefined;
let selectedApplication: ApplicationExample | undefined;
interface PreparedDataset {
  readonly dataset: PlaygroundDataset;
  readonly store: Store<AnyRow>;
  readonly milliseconds: number;
}
const cache = new Map<string, PreparedDataset>();
const applications = createApplicationExamples(requireElement("#application-examples"), async (signal) => {
  const definition = BUILT_IN_DATASETS.find((dataset) => dataset.id === "airports");
  if (!definition) throw new Error("The airport CSV dataset is not configured.");
  return (await getPreparedDataset(definition, signal)).store;
}, async (signal) => (await getPreparedDataset(PARTS_DEFINITION, signal)).store,
async (signal) => (await getPreparedDataset(RETAIL_DEFINITION, signal)).store,
selectDataset);

import.meta.hot?.dispose(() => {
  loadController?.abort();
  applications.dispose();
  scriptEditor.dispose();
});

for (const example of ["typeahead", "runtime-config", "parts-finder", ...FEATURE_DEMOS.map((demo) => demo.id)] as const) {
  requireElement<HTMLButtonElement>(`[data-example="${example}"]`).addEventListener("click", () => {
    loadController?.abort();
    selectedApplication = example;
    setLoading(false);
    queryPlayground.hidden = true;
    applications.show(example);
    renderDatasetMenu();
    renderApplicationMenu();
  });
}

runScriptButton.addEventListener("click", () => {
  if (loading || !activeStore) return;
  try {
    const started = performance.now();
    const response = executeScriptRequest(activeStore, evaluateScript(scriptEditor.getValue()));
    const elapsed = performance.now() - started;
    resultOutput.textContent = JSON.stringify(response, null, 2);
    setStatus(`Script executed successfully in ${elapsed.toFixed(1)} ms against ${activeStore.getLoadedRowCount().toLocaleString()} indexed records.`, false);
  } catch (error) {
    resultOutput.textContent = formatError(error);
    setStatus("Script failed. Review the error details.", true);
  }
});

scriptEditor.onRun(() => runScriptButton.click());
exampleSelect.addEventListener("change", loadSelectedExample);
resetScriptButton.addEventListener("click", loadSelectedExample);
uploadDatasetButton.addEventListener("click", () => uploadFileInput.click());
uploadFileInput.addEventListener("change", async () => {
  const [file] = uploadFileInput.files ?? [];
  if (!file) return;
  try {
    const dataset = toUploadedDataset(JSON.parse(await file.text()));
    await selectDataset(dataset);
  } catch (error) {
    setStatus("Upload failed. Verify JSON structure and field definitions.", true);
    resultOutput.textContent = formatError(error);
  } finally {
    uploadFileInput.value = "";
  }
});

renderDatasetMenu();
void selectDataset(BUILT_IN_DATASETS[0]);

function renderDatasetMenu(): void {
  datasetMenu.replaceChildren();
  const datasets = uploadedDataset ? [...BUILT_IN_DATASETS, uploadedDataset] : BUILT_IN_DATASETS;
  for (const dataset of datasets) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = !selectedApplication && dataset.id === selectedId ? "menu-item active" : "menu-item";
    button.textContent = `${dataset.label}${dataset.recordCount ? ` (${dataset.recordCount.toLocaleString()})` : ""}`;
    button.addEventListener("click", () => void selectDataset(dataset));
    datasetMenu.append(button);
  }
}

function renderApplicationMenu(): void {
  applicationMenu.querySelectorAll<HTMLButtonElement>("[data-example]").forEach((button) => {
    const active = button.dataset.example === selectedApplication;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

async function getPreparedDataset(
  definition: DatasetDefinition | PlaygroundDataset, signal: AbortSignal,
): Promise<PreparedDataset> {
  const prepared = definition.id === "uploaded-dataset" ? undefined : cache.get(definition.id);
  if (prepared) return prepared;
  const started = performance.now();
  let dataset: PlaygroundDataset;
  if ("rows" in definition) {
    dataset = definition;
  } else {
    if (!definition.csvFile) throw new Error(`No CSV file configured for ${definition.label}.`);
    const response = await fetch(`${import.meta.env.BASE_URL}data/${definition.csvFile}`, { signal });
    if (!response.ok) throw new Error(`Could not load ${definition.csvFile}: HTTP ${response.status}.`);
    const csv = await response.text();
    signal.throwIfAborted();
    dataset = parseDatasetCsv(definition, csv);
  }
  signal.throwIfAborted();
  const store = buildStore(dataset);
  const result = { dataset, store, milliseconds: performance.now() - started };
  cache.set(definition.id, result);
  return result;
}

async function selectDataset(definition: DatasetDefinition | PlaygroundDataset): Promise<void> {
  selectedApplication = undefined;
  applications.hide();
  queryPlayground.hidden = false;
  renderApplicationMenu();
  loadController?.abort();
  const controller = new AbortController();
  loadController = controller;
  selectedId = definition.id;
  setLoading(true);
  renderDatasetMenu();
  setStatus(`Loading and indexing ${definition.label}...`, false);
  try {
    const prepared = await getPreparedDataset(definition, controller.signal);
    if (controller.signal.aborted) return;
    if (definition.id === "uploaded-dataset") uploadedDataset = prepared.dataset;
    applyDataset(prepared.dataset, prepared.store, prepared.milliseconds);
  } catch (error) {
    if (controller.signal.aborted) return;
    selectedId = activeDataset?.id ?? definition.id;
    if (!activeDataset) datasetTitle.textContent = `${definition.label} could not be loaded`;
    resultOutput.textContent = formatError(error);
    setStatus(`Failed to load ${definition.label}. Select the dataset again to retry.`, true);
    renderDatasetMenu();
  } finally {
    if (loadController === controller) setLoading(false);
  }
}

function setLoading(value: boolean): void {
  loading = value;
  runScriptButton.disabled = value || !activeStore;
  resetScriptButton.disabled = value || !activeDataset;
  exampleSelect.disabled = value || !activeDataset;
  uploadDatasetButton.disabled = value;
  app.setAttribute("aria-busy", String(value));
}

function applyDataset(dataset: PlaygroundDataset, store: Store<AnyRow>, milliseconds: number): void {
  activeDataset = dataset;
  activeStore = store;
  datasetTitle.textContent = dataset.label;
  datasetDescription.textContent = dataset.description;
  datasetStats.textContent = `${dataset.rows.length.toLocaleString()} records indexed (all CSV rows) · ${dataset.fields.length} fields · normalization: ${dataset.normalizationProfile} · initial load + preparation: ${milliseconds.toFixed(0)} ms`;
  if (!dataset.csvFile) datasetStats.textContent = `${dataset.rows.length.toLocaleString()} uploaded records indexed · ${dataset.fields.length} fields`;
  datasetSource.replaceChildren();
  if (dataset.csvFile && dataset.sourceUrl) {
    const csvLink = document.createElement("a");
    csvLink.href = `${import.meta.env.BASE_URL}data/${dataset.csvFile}`;
    csvLink.textContent = `Download ${dataset.csvFile}`;
    csvLink.download = dataset.csvFile;
    const sourceLink = document.createElement("a");
    sourceLink.href = dataset.sourceUrl;
    sourceLink.textContent = "Java demo source";
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";
    datasetSource.append(csvLink, " · ", sourceLink);
  }
  schemaOutput.textContent = JSON.stringify(dataset.fields, null, 2);
  sampleOutput.textContent = JSON.stringify(dataset.rows.slice(0, 3), null, 2);
  scriptEditor.setFields(dataset.fields);
  exampleSelect.replaceChildren();
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Dataset starter script";
  exampleSelect.append(defaultOption);
  for (const example of EXAMPLES[dataset.id] ?? []) {
    const option = document.createElement("option");
    option.value = example.id;
    option.textContent = example.title;
    exampleSelect.append(option);
  }
  loadSelectedExample();
  renderDatasetMenu();
}

function loadSelectedExample(): void {
  if (!activeDataset) return;
  const example = EXAMPLES[activeDataset.id]?.find((item) => item.id === exampleSelect.value);
  scriptEditor.setValue(example ? exampleScript(example) : activeDataset.defaultScript);
  exampleDescription.textContent = example?.description ?? "The store contains the entire CSV. The result limit controls returned rows, not loaded records.";
  exampleExpected.textContent = example ? `Expected: ${example.expected}` : "";
  resultOutput.textContent = "";
  setStatus(example?.error ? "This example intentionally produces an error." : "Script ready to run.", false);
}

function toUploadedDataset(raw: unknown): PlaygroundDataset {
  if (!isObject(raw)) throw new Error("Uploaded JSON must be an object.");
  if (!Array.isArray(raw.fields) || raw.fields.length === 0) throw new Error("Uploaded JSON requires a non-empty fields array.");
  if (!Array.isArray(raw.rows)) throw new Error("Uploaded JSON requires rows array.");
  const fields = raw.fields.map(normalizeUploadedField);
  const rows = raw.rows.map((row, index) => {
    if (!isObject(row)) throw new Error(`rows[${index}] must be an object.`);
    return row;
  });
  return {
    id: "uploaded-dataset",
    label: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "Uploaded dataset",
    description: typeof raw.description === "string" && raw.description.trim() ? raw.description.trim() : "User-provided dataset loaded from local JSON.",
    normalizationProfile: normalizeProfile(raw.normalizationProfile),
    fields, rows,
    defaultScript: typeof raw.defaultScript === "string" && raw.defaultScript.trim()
      ? raw.defaultScript : 'return { operation: "queryAll", limit: 20 };',
  };
}

function normalizeUploadedField(raw: unknown): PlaygroundField {
  if (!isObject(raw)) throw new Error("Each field must be an object.");
  const name = expectString(raw.name, "field.name");
  const kind = expectFieldKind(raw.kind);
  const options = normalizeFieldOptions(raw.options);
  if (kind !== "enum") return { name, kind, options };
  const enumValues = assertStringArray(raw.enumValues, `enumValues for field "${name}"`);
  if (!enumValues.length) throw new Error(`Enum field "${name}" requires at least one enum value.`);
  return { name, kind, enumValues, options };
}

function normalizeFieldOptions(raw: unknown): FieldOptions {
  if (raw === undefined) return {};
  if (!isObject(raw)) throw new Error("field.options must be an object.");
  const options: Record<string, unknown> = {};
  for (const key of ["nullable", "caseInsensitive", "ignoreIndex", "oneEditAway", "predictable", "stemmedIndex"] as const) {
    const value = raw[key];
    if (value !== undefined) {
      if (typeof value !== "boolean") throw new Error(`field.options.${key} must be boolean.`);
      options[key] = value;
    }
  }
  for (const key of ["secondaryType", "format"] as const) {
    if (raw[key] !== undefined) {
      if (typeof raw[key] !== "string") throw new Error(`field.options.${key} must be a string.`);
      options[key] = raw[key];
    }
  }
  if (raw.numericStartPos !== undefined) {
    if (typeof raw.numericStartPos !== "number") throw new Error("field.options.numericStartPos must be a number.");
    options.numericStartPos = raw.numericStartPos;
  }
  return options as FieldOptions;
}

function normalizeProfile(raw: unknown): NormalizationProfileValue {
  if (raw === undefined) return NormalizationProfile.NATIVE;
  if (typeof raw !== "string") throw new Error("normalizationProfile must be a string.");
  const normalized = raw.trim().toLowerCase();
  if (normalized === NormalizationProfile.JAVA || normalized === "java") return NormalizationProfile.JAVA;
  if (normalized === NormalizationProfile.NATIVE || normalized === "native") return NormalizationProfile.NATIVE;
  throw new Error(`Unsupported normalizationProfile "${raw}". Use "java" or "native".`);
}

function expectString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value;
}

function expectFieldKind(value: unknown): FieldKind {
  if (value === "text" || value === "number" || value === "long" || value === "boolean" || value === "enum") return value;
  throw new Error(`Unsupported field kind "${String(value)}".`);
}

function assertStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) throw new Error(`${label} must be an array of strings.`);
  return [...value];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : `Unknown error: ${String(error)}`;
}

function setStatus(message: string, isError: boolean): void {
  statusText.textContent = message;
  statusText.className = isError ? "status error" : "status";
}

function requireElement<TElement extends Element>(selector: string): TElement {
  const element = document.querySelector<TElement>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}
