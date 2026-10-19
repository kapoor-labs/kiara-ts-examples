import "./style.css";
import {
  KeywordSearch,
  NormalizationProfile,
  Operator,
  Store,
  booleanField,
  createCondition,
  defineSchema,
  enumField,
  longField,
  numberField,
  textField,
  type Condition,
  type FieldOptions,
  type OperatorType,
  type SchemaFieldInput,
} from "@kapoorlabs/kiara-ts";

type AnyRow = Record<string, unknown>;
type FieldKind = "text" | "number" | "boolean" | "long" | "enum";
type NormalizationProfileValue = (typeof NormalizationProfile)[keyof typeof NormalizationProfile];

interface PlaygroundField {
  readonly name: string;
  readonly kind: FieldKind;
  readonly enumValues?: readonly string[];
  readonly options?: FieldOptions;
}

interface PlaygroundDataset {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly normalizationProfile: NormalizationProfileValue;
  readonly fields: readonly PlaygroundField[];
  readonly rows: readonly AnyRow[];
  readonly defaultScript: string;
}

type Operation =
  | "search"
  | "projection"
  | "legacyProjection"
  | "keywordBestMatch"
  | "keywordMinimumMatch"
  | "queryAll";

interface RawCondition {
  readonly field: string;
  readonly operator?: string;
  readonly values?: readonly unknown[];
  readonly lowerValue?: unknown;
  readonly upperValue?: unknown;
}

interface ScriptRequest {
  readonly operation?: Operation;
  readonly conditions?: readonly RawCondition[];
  readonly fields?: readonly string[];
  readonly limit?: number;
  readonly input?: string | readonly string[];
  readonly keywordFields?: readonly string[];
}

const BUILT_IN_DATASETS: readonly PlaygroundDataset[] = [
  {
    id: "catalog-basic",
    label: "Catalog basics",
    description:
      "Structured filters + keyword correction against a general catalog with tags and summary text.",
    normalizationProfile: NormalizationProfile.NATIVE,
    fields: [
      { name: "title", kind: "text", options: { caseInsensitive: true } },
      { name: "year", kind: "number" },
      {
        name: "tags",
        kind: "text",
        options: { caseInsensitive: true, secondaryType: "commaSeparatedStrings" },
      },
      { name: "rating", kind: "number" },
      { name: "summary", kind: "text", options: { caseInsensitive: true, stemmedIndex: true } },
    ],
    rows: [
      {
        title: "Cast Away",
        year: 2000,
        tags: "survival,adventure,island",
        rating: 8.1,
        summary: "A stranded engineer adapts to isolation and survives on an island.",
      },
      {
        title: "Apollo 13",
        year: 1995,
        tags: "space,mission,survival",
        rating: 7.6,
        summary: "A damaged spacecraft crew and support teams coordinate a safe return.",
      },
      {
        title: "Big",
        year: 1988,
        tags: "family,comedy,growth",
        rating: 7.3,
        summary: "A sudden life change pushes a child to navigate an adult world.",
      },
    ],
    defaultScript: `return {
  operation: "search",
  limit: 10,
  conditions: [
    {
      field: "year",
      operator: Operator.BETWEEN,
      lowerValue: 1990,
      upperValue: 2005,
    },
    {
      field: "tags",
      operator: Operator.CONTAINS_EITHER,
      values: ["survival"],
    },
  ],
};`,
  },
  {
    id: "travel-ranges",
    label: "Travel windows",
    description:
      "Date and date-time range indexing with point-in-range search and exclusion filters.",
    normalizationProfile: NormalizationProfile.JAVA,
    fields: [
      { name: "route", kind: "text", options: { caseInsensitive: true } },
      { name: "active", kind: "boolean" },
      { name: "validDate", kind: "text", options: { secondaryType: "dateRange" } },
      {
        name: "timeWindows",
        kind: "text",
        options: { secondaryType: "commaSeparatedDateTimeRanges" },
      },
      { name: "seats", kind: "number" },
    ],
    rows: [
      {
        route: "A to B",
        active: true,
        validDate: "2026-10-01->2026-10-15",
        timeWindows:
          "2026-10-01 08:00:00->2026-10-01 12:00:00,2026-10-02 08:00:00->2026-10-02 12:00:00",
        seats: 180,
      },
      {
        route: "B to C",
        active: true,
        validDate: "2026-10-10->2026-10-20",
        timeWindows: "2026-10-12 10:00:00->2026-10-12 13:00:00",
        seats: 150,
      },
      {
        route: "D to E",
        active: false,
        validDate: "2026-10-05->2026-10-07",
        timeWindows: "2026-10-06 09:00:00->2026-10-06 11:00:00",
        seats: 90,
      },
    ],
    defaultScript: `return {
  operation: "search",
  conditions: [
    {
      field: "validDate",
      operator: Operator.CONTAINS_EITHER,
      values: ["2026-10-12"],
    },
    {
      field: "active",
      values: [true],
    },
  ],
};`,
  },
  {
    id: "accounts-enum",
    label: "Accounts and tiers",
    description: "Enum, long, nullable fields, and typed projection in one dataset.",
    normalizationProfile: NormalizationProfile.JAVA,
    fields: [
      { name: "accountId", kind: "text" },
      {
        name: "tier",
        kind: "enum",
        enumValues: ["bronze", "silver", "gold", "platinum"],
        options: { caseInsensitive: true },
      },
      { name: "credits", kind: "long" },
      { name: "enabled", kind: "boolean" },
      { name: "notes", kind: "text", options: { nullable: true, caseInsensitive: true } },
    ],
    rows: [
      { accountId: "acct-100", tier: "silver", credits: "9007199254740993", enabled: true, notes: null },
      { accountId: "acct-200", tier: "gold", credits: 1250, enabled: true, notes: "priority onboarding" },
      { accountId: "acct-300", tier: "bronze", credits: 300, enabled: false, notes: "paused" },
    ],
    defaultScript: `return {
  operation: "projection",
  fields: ["accountId", "tier", "credits"],
  conditions: [
    {
      field: "enabled",
      values: [true],
    },
    {
      field: "tier",
      operator: Operator.CONTAINS_EITHER,
      values: ["gold", "silver"],
    },
  ],
};`,
  },
];

const app = requireElement<HTMLDivElement>("#app");
app.innerHTML = `
  <div class="layout">
    <aside class="sidebar">
      <h1>Kiara TS Examples</h1>
      <p class="muted">Choose a dataset, run a script, and inspect results instantly.</p>
      <nav id="dataset-menu" class="dataset-menu" aria-label="Dataset menu"></nav>
      <button id="upload-dataset" class="secondary-button" type="button">Bring your own data</button>
      <input id="upload-file" type="file" accept="application/json,.json" hidden />
      <div class="byod-note">
        Upload JSON with <code>fields</code> and <code>rows</code>. See README for format.
      </div>
    </aside>
    <main class="content">
      <section class="card">
        <h2 id="dataset-title"></h2>
        <p id="dataset-description"></p>
        <p id="dataset-stats" class="muted"></p>
      </section>
      <section class="card">
        <div class="card-title-row">
          <h2>Search script</h2>
          <button id="reset-script" class="secondary-button" type="button">Reset script</button>
        </div>
        <p class="muted">Use JavaScript with a return statement. <code>Operator</code> is available.</p>
        <textarea id="script-editor" spellcheck="false"></textarea>
        <div class="actions">
          <button id="run-script" class="primary-button" type="button">Run script</button>
          <span id="status-text" class="status" role="status" aria-live="polite"></span>
        </div>
      </section>
      <section class="card">
        <h2>Result</h2>
        <pre id="result-output"></pre>
      </section>
    </main>
  </div>
`;

const datasetMenu = requireElement<HTMLElement>("#dataset-menu");
const uploadDatasetButton = requireElement<HTMLButtonElement>("#upload-dataset");
const uploadFileInput = requireElement<HTMLInputElement>("#upload-file");
const datasetTitle = requireElement<HTMLElement>("#dataset-title");
const datasetDescription = requireElement<HTMLElement>("#dataset-description");
const datasetStats = requireElement<HTMLElement>("#dataset-stats");
const scriptEditor = requireElement<HTMLTextAreaElement>("#script-editor");
const runScriptButton = requireElement<HTMLButtonElement>("#run-script");
const resetScriptButton = requireElement<HTMLButtonElement>("#reset-script");
const statusText = requireElement<HTMLElement>("#status-text");
const resultOutput = requireElement<HTMLElement>("#result-output");

let uploadedDataset: PlaygroundDataset | undefined;
let activeDataset: PlaygroundDataset = BUILT_IN_DATASETS[0];
let activeStore: Store<AnyRow> = buildStore(activeDataset);

renderDatasetMenu();
applyDataset(activeDataset, true);

runScriptButton.addEventListener("click", () => {
  try {
    const request = evaluateScript(scriptEditor.value);
    const response = executeScriptRequest(activeStore, request);
    resultOutput.textContent = JSON.stringify(response, null, 2);
    setStatus("Script executed successfully.", false);
  } catch (error) {
    resultOutput.textContent = formatError(error);
    setStatus("Script failed. Review the error details.", true);
  }
});

resetScriptButton.addEventListener("click", () => {
  scriptEditor.value = activeDataset.defaultScript;
  setStatus("Script reset to dataset default.", false);
});

uploadDatasetButton.addEventListener("click", () => uploadFileInput.click());

uploadFileInput.addEventListener("change", async () => {
  const [file] = uploadFileInput.files ?? [];
  if (file === undefined) {
    return;
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as unknown;
    uploadedDataset = toUploadedDataset(parsed);
    applyDataset(uploadedDataset, true);
    renderDatasetMenu();
    setStatus(`Loaded custom dataset from ${file.name}.`, false);
  } catch (error) {
    setStatus("Upload failed. Verify JSON structure and field definitions.", true);
    resultOutput.textContent = formatError(error);
  } finally {
    uploadFileInput.value = "";
  }
});

function renderDatasetMenu(): void {
  datasetMenu.innerHTML = "";
  const datasets = uploadedDataset === undefined
    ? [...BUILT_IN_DATASETS]
    : [...BUILT_IN_DATASETS, uploadedDataset];

  for (const dataset of datasets) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = dataset.id === activeDataset.id ? "menu-item active" : "menu-item";
    button.textContent = dataset.label;
    button.addEventListener("click", () => applyDataset(dataset, true));
    datasetMenu.append(button);
  }
}

function applyDataset(dataset: PlaygroundDataset, resetScript: boolean): void {
  activeDataset = dataset;
  activeStore = buildStore(dataset);
  datasetTitle.textContent = dataset.label;
  datasetDescription.textContent = dataset.description;
  datasetStats.textContent = `${dataset.rows.length} rows · ${dataset.fields.length} fields · normalization profile: ${dataset.normalizationProfile}`;
  if (resetScript) {
    scriptEditor.value = dataset.defaultScript;
  }
  resultOutput.textContent = "";
  renderDatasetMenu();
}

function buildStore(dataset: PlaygroundDataset): Store<AnyRow> {
  const schemaFields = dataset.fields.map(createSchemaField);
  const schema = defineSchema<AnyRow>(schemaFields);
  const store = new Store(schema, { normalizationProfile: dataset.normalizationProfile });
  store.loadRows(dataset.rows);
  store.prepare();
  return store;
}

function createSchemaField(field: PlaygroundField): SchemaFieldInput<AnyRow, string> {
  const options = field.options ?? {};
  switch (field.kind) {
    case "text":
      return textField<AnyRow, string>(field.name, options);
    case "number":
      return numberField<AnyRow, string>(field.name, options);
    case "boolean":
      return booleanField<AnyRow, string>(field.name, options);
    case "long":
      return longField<AnyRow, string>(field.name, options);
    case "enum": {
      if (field.enumValues === undefined || field.enumValues.length === 0) {
        throw new Error(`Enum field "${field.name}" must include enumValues.`);
      }
      return enumField<AnyRow, string>(field.name, field.enumValues, options);
    }
    default:
      throw new Error(`Unsupported field kind: ${(field as { kind: string }).kind}`);
  }
}

function evaluateScript(script: string): ScriptRequest {
  const runner = new Function(
    "ctx",
    `"use strict"; const { Operator } = ctx; ${script}`,
  ) as (ctx: { readonly Operator: typeof Operator }) => unknown;
  const rawResult = runner({ Operator });
  if (Array.isArray(rawResult)) {
    return { operation: "search", conditions: rawResult as RawCondition[] };
  }
  if (isObject(rawResult)) {
    return rawResult as ScriptRequest;
  }
  throw new Error("Script must return an object or an array of conditions.");
}

function executeScriptRequest(store: Store<AnyRow>, request: ScriptRequest): unknown {
  const operation = request.operation ?? "search";
  switch (operation) {
    case "queryAll":
      return store.queryAll(request.limit);
    case "search": {
      const conditions = normalizeConditions(request.conditions ?? []);
      return store.search(conditions, request.limit);
    }
    case "projection": {
      const fields = assertStringArray(request.fields, "fields");
      const conditions = normalizeConditions(request.conditions ?? []);
      return store.searchProjection(conditions, fields, request.limit);
    }
    case "legacyProjection": {
      const fields = request.fields === undefined ? undefined : assertStringArray(request.fields, "fields");
      const conditions = normalizeConditions(request.conditions ?? []);
      return store.searchLegacyProjection(conditions, fields, request.limit);
    }
    case "keywordBestMatch":
    case "keywordMinimumMatch": {
      if (request.input === undefined) {
        throw new Error("Keyword operations require input.");
      }
      const keywordSearch = new KeywordSearch(store);
      const keywordFields = request.keywordFields === undefined
        ? undefined
        : assertStringArray(request.keywordFields, "keywordFields");
      const keywordOptions = {
        conditions: request.conditions === undefined ? undefined : normalizeConditions(request.conditions),
        fields: keywordFields,
        limit: request.limit,
      };
      return operation === "keywordBestMatch"
        ? keywordSearch.bestMatch(request.input, keywordOptions)
        : keywordSearch.minimumMatch(request.input, keywordOptions);
    }
    default:
      throw new Error(`Unsupported operation: ${String(operation)}`);
  }
}

function normalizeConditions(rawConditions: readonly RawCondition[]): readonly Condition<AnyRow>[] {
  return rawConditions.map((raw) => {
    const operator = parseOperator(raw.operator);
    if (operator === Operator.BETWEEN) {
      return createCondition<AnyRow, string>({
        field: raw.field,
        operator: Operator.BETWEEN,
        lowerValue: raw.lowerValue,
        upperValue: raw.upperValue,
      });
    }
    return createCondition<AnyRow, string>({
      field: raw.field,
      operator,
      values: raw.values ?? [],
    });
  });
}

function parseOperator(raw: string | undefined): OperatorType | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (Object.values(Operator).includes(raw as OperatorType)) {
    return raw as OperatorType;
  }
  throw new Error(`Unknown operator "${raw}".`);
}

function toUploadedDataset(raw: unknown): PlaygroundDataset {
  if (!isObject(raw)) {
    throw new Error("Uploaded JSON must be an object.");
  }
  const fieldsRaw = raw.fields;
  if (!Array.isArray(fieldsRaw) || fieldsRaw.length === 0) {
    throw new Error("Uploaded JSON requires a non-empty fields array.");
  }
  const rowsRaw = raw.rows;
  if (!Array.isArray(rowsRaw)) {
    throw new Error("Uploaded JSON requires rows array.");
  }

  const fields = fieldsRaw.map(normalizeUploadedField);
  const rows = rowsRaw.map((row, index) => {
    if (!isObject(row) || Array.isArray(row)) {
      throw new Error(`rows[${index}] must be an object.`);
    }
    return row as AnyRow;
  });

  const label = typeof raw.name === "string" && raw.name.trim().length > 0
    ? raw.name.trim()
    : "Uploaded dataset";
  const description = typeof raw.description === "string" && raw.description.trim().length > 0
    ? raw.description.trim()
    : "User-provided dataset loaded from local JSON.";

  const defaultScript = typeof raw.defaultScript === "string" && raw.defaultScript.trim().length > 0
    ? raw.defaultScript
    : createDefaultScript(fields);

  return {
    id: "uploaded-dataset",
    label,
    description,
    normalizationProfile: normalizeProfile(raw.normalizationProfile),
    fields,
    rows,
    defaultScript,
  };
}

function normalizeUploadedField(raw: unknown): PlaygroundField {
  if (!isObject(raw)) {
    throw new Error("Each field must be an object.");
  }
  const name = expectString(raw.name, "field.name");
  const kind = expectFieldKind(raw.kind);
  const options = normalizeFieldOptions(raw.options);
  if (kind !== "enum") {
    return { name, kind, options };
  }
  const enumValues = assertStringArray(raw.enumValues, `enumValues for field "${name}"`);
  if (enumValues.length === 0) {
    throw new Error(`Enum field "${name}" requires at least one enum value.`);
  }
  return { name, kind, enumValues, options };
}

function normalizeFieldOptions(raw: unknown): FieldOptions {
  if (raw === undefined) {
    return {};
  }
  if (!isObject(raw)) {
    throw new Error("field.options must be an object.");
  }
  const options: Record<string, unknown> = {};
  for (const key of [
    "nullable",
    "caseInsensitive",
    "ignoreIndex",
    "oneEditAway",
    "predictable",
    "stemmedIndex",
  ] as const) {
    const value = raw[key];
    if (value !== undefined) {
      if (typeof value !== "boolean") {
        throw new Error(`field.options.${key} must be boolean.`);
      }
      options[key] = value;
    }
  }

  if (raw.secondaryType !== undefined) {
    if (typeof raw.secondaryType !== "string") {
      throw new Error("field.options.secondaryType must be a string.");
    }
    options.secondaryType = raw.secondaryType;
  }

  if (raw.format !== undefined) {
    if (typeof raw.format !== "string") {
      throw new Error("field.options.format must be a string.");
    }
    options.format = raw.format;
  }

  if (raw.numericStartPos !== undefined) {
    if (typeof raw.numericStartPos !== "number") {
      throw new Error("field.options.numericStartPos must be a number.");
    }
    options.numericStartPos = raw.numericStartPos;
  }
  return options as FieldOptions;
}

function createDefaultScript(fields: readonly PlaygroundField[]): string {
  const firstField = fields[0];
  if (firstField === undefined) {
    return `return { operation: "queryAll", limit: 50 };`;
  }

  if (firstField.kind === "number" || firstField.kind === "long") {
    return `return {
  operation: "search",
  conditions: [
    {
      field: "${firstField.name}",
      operator: Operator.GREATER_THAN,
      values: [0],
    },
  ],
  limit: 50,
};`;
  }

  return `return {
  operation: "search",
  conditions: [
    {
      field: "${firstField.name}",
      values: ["sample"],
    },
  ],
  limit: 50,
};`;
}

function normalizeProfile(raw: unknown): NormalizationProfileValue {
  if (raw === undefined) {
    return NormalizationProfile.NATIVE;
  }
  if (typeof raw !== "string") {
    throw new Error("normalizationProfile must be a string.");
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === NormalizationProfile.JAVA || normalized === "java") {
    return NormalizationProfile.JAVA;
  }
  if (normalized === NormalizationProfile.NATIVE || normalized === "native") {
    return NormalizationProfile.NATIVE;
  }
  throw new Error(`Unsupported normalizationProfile "${raw}". Use "java" or "native".`);
}

function expectString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function expectFieldKind(value: unknown): FieldKind {
  if (
    value === "text" ||
    value === "number" ||
    value === "boolean" ||
    value === "long" ||
    value === "enum"
  ) {
    return value;
  }
  throw new Error(`Unsupported field kind "${String(value)}".`);
}

function assertStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${label} must be an array of strings.`);
  }
  return [...value];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return `Unknown error: ${String(error)}`;
}

function setStatus(message: string, isError: boolean): void {
  statusText.textContent = message;
  statusText.className = isError ? "status error" : "status";
}

function requireElement<TElement extends Element>(selector: string): TElement {
  const element = document.querySelector<TElement>(selector);
  if (element === null) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}
