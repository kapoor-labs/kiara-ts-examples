import Papa from "papaparse";
import {
  KeywordSearch, NormalizationProfile, Operator, QueryInterpreter, StoreLoader,
  type Condition, type Store, type WorkerRequest,
} from "@kapoorlabs/kiara-ts";
import {
  buildStore, parseDatasetCsv, type DatasetDefinition, type PlaygroundDataset, type PlaygroundField,
} from "./datasets.ts";
import type { AnyRow } from "./query.ts";

export const FEATURE_DEMOS = [
  { id: "product-discovery", title: "E-commerce discovery" },
  { id: "keyword-discovery", title: "Typo-tolerant keyword search" },
  { id: "compatibility", title: "Integration compatibility" },
  { id: "operating-ranges", title: "Operating-envelope finder" },
  { id: "catalog-refresh", title: "Safe catalog refresh" },
  { id: "worker-comparison", title: "Main thread vs Web Worker" },
  { id: "csv-workbench", title: "Bring your own CSV" },
] as const;
export type FeatureDemoId = (typeof FEATURE_DEMOS)[number]["id"];
export function isFeatureDemo(id: string): id is FeatureDemoId {
  return FEATURE_DEMOS.some((demo) => demo.id === id);
}

function field(name: string, kind: PlaygroundField["kind"] = "text", options: PlaygroundField["options"] = {}): PlaygroundField {
  return { name, kind, csvColumn: name, options: { nullable: true, caseInsensitive: kind === "text", ...options } };
}
export const RETAIL_DEFINITION: DatasetDefinition = {
  id: "retail-products", label: "Historical gift catalog",
  description: "3,788 genuine product codes derived from all 541,909 UCI Online Retail transactions (2010-2011). Prices are historical observed GBP amounts, not live offers. Units sold are not stock.",
  normalizationProfile: NormalizationProfile.NATIVE,
  csvFile: "retail-products.csv", recordCount: 3788,
  sourceUrl: "https://doi.org/10.24432/C5BW33",
  fields: [
    field("sku"), field("title", "text", { stemmedIndex: true, oneEditAway: true }),
    field("unitPrice", "number"), field("maxUnitPrice", "number"),
    field("salesRows", "number"), field("unitsSold", "number"),
    field("markets", "text", { secondaryType: "commaSeparatedStrings" }),
  ],
  defaultScript: 'return { conditions: [{ field: "unitPrice", operator: Operator.LESS_THAN, values: [5] }], limit: 25 };',
};
const productInterpreters = new WeakMap<Store<AnyRow>, QueryInterpreter<AnyRow>>();
export function productInterpreter(store: Store<AnyRow>): QueryInterpreter<AnyRow> {
  const cached = productInterpreters.get(store);
  if (cached) return cached;
  const interpreter = new QueryInterpreter(store, {
    fields: {
      unitPrice: { aliases: ["price"], canonicalUnit: "GBP", units: { GBP: 1 } },
      unitsSold: { aliases: ["sold"] },
    },
  });
  productInterpreters.set(store, interpreter);
  return interpreter;
}
export function discoverProducts(store: Store<AnyRow>, keywords: string, input: string, market = "") {
  const interpreter = productInterpreter(store);
  const interpretation = interpreter.interpret(input);
  if (interpretation.issues.length) return { status: "blocked", interpretation } as const;
  const conditions: Condition<AnyRow>[] = interpretation.filters.map((filter) => filter.condition);
  if (market) conditions.push({ field: "markets", operator: Operator.CONTAINS_EITHER, values: [market] });
  const keywordResult = keywords.trim()
    ? new KeywordSearch(store).bestMatch(keywords, { fields: ["title"], conditions, limit: store.getLoadedRowCount() })
    : undefined;
  if (keywordResult?.truncated) throw new Error("Use at most 10 distinct title keywords; no truncated query is displayed.");
  const rows = keywordResult?.results ?? (conditions.length ? store.search(conditions) : store.queryAll());
  return { status: "ready", interpretation, conditions, rows, keywordResult } as const;
}

export const CAPABILITIES = ["OAuth", "Webhooks", "Bulk export", "Audit logs", "On-prem agent"] as const;
export const CONNECTOR_FIXTURES: readonly AnyRow[] = [
  { name: "Aster", capabilities: "OAuth,Webhooks,Bulk export,Audit logs" },
  { name: "Birch", capabilities: "OAuth,Webhooks" },
  { name: "Cedar", capabilities: "OAuth,Bulk export,On-prem agent" },
  { name: "Delta", capabilities: "Webhooks,Audit logs" },
  { name: "Elm", capabilities: "Bulk export" },
  { name: "Fern", capabilities: "OAuth,Webhooks,Bulk export,On-prem agent" },
  { name: "Grove", capabilities: "OAuth,Audit logs" },
  { name: "Hazel", capabilities: null },
];
export function connectorStore(): Store<AnyRow> {
  return buildStore({
    id: "connectors", label: "Fictional integration fixtures", description: "Eight authored scenarios, not vendor claims or scale data.",
    normalizationProfile: NormalizationProfile.NATIVE, defaultScript: "",
    fields: [field("name"), field("capabilities", "text", { secondaryType: "commaSeparatedStrings" })],
    rows: CONNECTOR_FIXTURES,
  });
}
export function matchConnectors(store: Store<AnyRow>, required: readonly string[], mode: "all" | "any", excluded: readonly string[]) {
  if (mode !== "all" && mode !== "any") throw new Error("Choose ALL or ANY matching.");
  if ([...required, ...excluded].some((value) => !CAPABILITIES.some((capability) => capability === value))) {
    throw new Error("Choose a supported capability.");
  }
  const conditions: Condition<AnyRow>[] = [];
  if (required.length) conditions.push({
    field: "capabilities", operator: mode === "all" ? Operator.CONTAINS_ALL : Operator.CONTAINS_EITHER, values: required,
  });
  if (excluded.length) conditions.push({ field: "capabilities", operator: Operator.NOT_CONTAINS, values: excluded });
  return { conditions, rows: conditions.length ? store.search(conditions) : store.queryAll() };
}

export function operatingStore(source: readonly AnyRow[]) {
  let missing = 0;
  let unrecognized = 0;
  const rows = source.map((row) => {
    const raw = row.temperatureRange;
    const match = typeof raw === "string" ? /^([+-]?\d+(?:\.\d+)?)\u2103~([+-]?\d+(?:\.\d+)?)\u2103$/.exec(raw.trim()) : null;
    if (!raw) missing++;
    else if (!match) unrecognized++;
    if (match && Number(match[1]) > Number(match[2])) throw new Error(`Reversed source temperature range: ${row.id}`);
    return {
      id: row.id, partNumber: row.partNumber, manufacturer: row.manufacturer,
      sourceTemperature: raw, operatingRange: match ? `${Number(match[1])}->${Number(match[2])}` : null,
    };
  });
  const store = buildStore({
    id: "operating-ranges", label: "Actual component operating ranges", description: "", defaultScript: "",
    normalizationProfile: NormalizationProfile.NATIVE,
    fields: [
      field("id"), field("partNumber"), field("manufacturer"), field("sourceTemperature", "text", { ignoreIndex: true }),
      field("operatingRange", "text", { secondaryType: "numericRange" }),
    ], rows,
  });
  return { store, missing, unrecognized, parsed: rows.length - missing - unrecognized };
}
export function matchOperatingRange(store: Store<AnyRow>, lower: number, upper: number = lower) {
  if (!Number.isFinite(lower) || !Number.isFinite(upper) || lower > upper) {
    throw new Error("Enter finite temperatures with minimum no greater than maximum.");
  }
  const conditions: Condition<AnyRow>[] = [{
    field: "operatingRange", operator: Operator.CONTAINS_ALL, values: lower === upper ? [lower] : [lower, upper],
  }];
  return { conditions, rows: store.search(conditions) };
}

export function validateRetailRows(value: unknown): AnyRow[] {
  if (!Array.isArray(value) || !value.length) throw new Error("A replacement must contain at least one complete product.");
  const ids = new Set<string>();
  return value.map((row, index) => {
    if (!isRecord(row)) throw new Error(`Product ${index + 1} must be an object.`);
    for (const name of ["sku", "title", "markets"]) {
      if (typeof row[name] !== "string" || !row[name].trim()) throw new Error(`Product ${index + 1}: ${name} must be nonempty text.`);
    }
    const sku = String(row.sku);
    if (ids.has(sku)) throw new Error(`Duplicate SKU: ${sku}`);
    ids.add(sku);
    for (const name of ["unitPrice", "maxUnitPrice", "salesRows", "unitsSold"]) {
      if (typeof row[name] !== "number" || !Number.isFinite(row[name]) || row[name] <= 0) {
        throw new Error(`Product ${sku}: ${name} must be a positive finite number.`);
      }
    }
    if (!Number.isSafeInteger(row.salesRows) || !Number.isSafeInteger(row.unitsSold) ||
        Number(row.unitPrice) > Number(row.maxUnitPrice)) throw new Error(`Product ${sku}: invalid counts or reversed price bounds.`);
    return Object.fromEntries(RETAIL_DEFINITION.fields.map(({ name }) => [name, row[name]]));
  });
}
export class CatalogSnapshots {
  store: Store<AnyRow>;
  interpreter: QueryInterpreter<AnyRow>;
  revision = 1;
  private staged: { store: Store<AnyRow>; interpreter: QueryInterpreter<AnyRow> } | undefined;
  constructor(store: Store<AnyRow>) {
    this.store = store;
    this.interpreter = productInterpreter(store);
  }
  get hasStaged(): boolean { return this.staged !== undefined; }
  stage(rows: unknown): void {
    this.staged = undefined;
    const next = new StoreLoader(this.store).replaceAll(validateRetailRows(rows));
    this.staged = { store: next, interpreter: productInterpreter(next) };
  }
  activate(): void {
    if (!this.staged) throw new Error("Prepare a valid replacement before activating it.");
    this.store = this.staged.store;
    this.interpreter = this.staged.interpreter;
    this.staged = undefined;
    this.revision++;
  }
}

export function benchmarkRequest(index: number, runId = "comparison"): WorkerRequest<AnyRow> {
  return {
    requestId: `${runId}-${index}`, storeId: "retail", operation: "searchProjection",
    payload: { conditions: [{ field: "unitPrice", operator: Operator.LESS_THAN, values: [5] }], fields: ["sku", "unitPrice"], limit: 25 },
  };
}
export function validateIterations(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 2000) throw new Error("Choose 1 to 2,000 query repetitions.");
  return value;
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type CsvColumnType = "text" | "number" | "boolean" | "strings";
export interface CsvMapping { readonly header: string; readonly type: CsvColumnType; readonly indexed: boolean }
export interface CsvInspection {
  readonly csv: string;
  readonly headers: readonly string[];
  readonly records: readonly string[][];
  readonly guesses: readonly CsvMapping[];
}
export const CSV_MAX_BYTES = 10 * 1024 * 1024;
const missingCell = (value: string) => value.trim() === "" || value.trim().toLowerCase() === "null" || value.trim() === "\\N";
const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
function safeNumber(value: string): boolean {
  const number = Number(value);
  return decimal.test(value) && Number.isFinite(number) && (!Number.isInteger(number) || Number.isSafeInteger(number));
}
export function inspectCsv(csv: string): CsvInspection {
  if (new TextEncoder().encode(csv).length > CSV_MAX_BYTES) throw new Error("CSV exceeds the 10 MiB limit.");
  const parsed = Papa.parse<string[]>(csv, { delimiter: ",", skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(`Invalid CSV: ${parsed.errors[0].message}`);
  const [headers, ...records] = parsed.data;
  if (!headers?.length || headers.length > 100 || headers.some((header) => !header.trim()) ||
      new Set(headers.map((header) => header.trim())).size !== headers.length) {
    throw new Error("Use 1-100 nonempty, unique CSV column names.");
  }
  if (headers.some((header) => ["__proto__", "constructor", "prototype"].includes(header.trim()))) {
    throw new Error("Rename reserved CSV column names: __proto__, constructor, prototype.");
  }
  if (!records.length || records.length > 50000) throw new Error("CSV must contain 1-50,000 data rows.");
  records.forEach((row, index) => {
    if (row.length !== headers.length) throw new Error(`CSV row ${index + 2} has ${row.length} columns; expected ${headers.length}.`);
  });
  const guesses = headers.map((header, index): CsvMapping => {
    const values = records.map((row) => row[index].trim()).filter((value) => !missingCell(value));
    const type = values.length && values.every((value) => /^(true|false)$/i.test(value)) ? "boolean"
      : values.length && values.every((value) => safeNumber(value) && !/^[+-]?0\d/.test(value)) ? "number" : "text";
    return { header, type, indexed: true };
  });
  return { csv, headers, records, guesses };
}
export function importCsv(inspection: CsvInspection, mappings: readonly CsvMapping[], label: string): PlaygroundDataset {
  if (mappings.length !== inspection.headers.length || mappings.some((mapping, index) =>
    mapping.header !== inspection.headers[index] || !["text", "number", "boolean", "strings"].includes(mapping.type) ||
    typeof mapping.indexed !== "boolean")) throw new Error("Provide one valid mapping for each CSV column, in source order.");
  const fields = mappings.map((mapping) => field(mapping.header, mapping.type === "strings" ? "text" : mapping.type, {
    ignoreIndex: !mapping.indexed, ...(mapping.type === "strings" ? { secondaryType: "commaSeparatedStrings" as const } : {}),
  }));
  const definition: DatasetDefinition = {
    id: "uploaded-dataset", label, description: "Local CSV. Empty, null, and \\N cells become null. Nothing is uploaded. Data is not persisted.",
    normalizationProfile: NormalizationProfile.NATIVE, fields, defaultScript: 'return { operation: "queryAll", limit: 25 };',
  };
  inspection.records.forEach((row, index) => mappings.forEach((mapping, column) => {
    const raw = row[column].trim();
    if (missingCell(raw)) return;
    if (mapping.type === "number" && !safeNumber(raw)) throw new Error(`CSV row ${index + 2}, ${mapping.header}: expected a finite, safely represented decimal number.`);
    if (mapping.type === "boolean" && !/^(true|false)$/i.test(raw)) throw new Error(`CSV row ${index + 2}, ${mapping.header}: use true or false.`);
  }));
  const dataset = parseDatasetCsv(definition, inspection.csv);
  return {
    ...dataset, rows: dataset.rows.map((row) => Object.fromEntries(fields.map((column) => [
      column.name, column.kind === "boolean" && row[column.name] !== null
        ? String(row[column.name]).toLowerCase() === "true" : row[column.name],
    ]))),
  };
}
