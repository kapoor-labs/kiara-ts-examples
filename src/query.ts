import {
  DictionaryTrie, KeywordSearch, Operator, Store, createCondition,
  type Condition, type OperatorType,
} from "@kapoorlabs/kiara-ts";

export type AnyRow = Record<string, unknown>;

export interface RawCondition {
  readonly field: string;
  readonly operator?: OperatorType;
  readonly values?: readonly unknown[];
  readonly lowerValue?: unknown;
  readonly upperValue?: unknown;
}

export type Operation =
  | "queryAll" | "search" | "projection" | "legacyProjection"
  | "keywordBestMatch" | "keywordMinimumMatch"
  | "predict" | "oneEditAway" | "diagnostics";

export interface ScriptRequest {
  readonly operation?: Operation;
  readonly conditions?: readonly RawCondition[];
  readonly fields?: readonly string[];
  readonly limit?: number;
  readonly input?: string | readonly string[];
  readonly keywordFields?: readonly string[];
  /** Maximum unique keywords considered. Kiara defaults to 10. */
  readonly maxKeywords?: number;
}

export function evaluateScript(script: string): ScriptRequest {
  const runner = new Function("Operator", `"use strict"; ${script}`) as
    (operators: typeof Operator) => unknown;
  const result = runner(Operator);
  if (Array.isArray(result)) {
    return { operation: "search", conditions: result };
  }
  if (typeof result === "object" && result !== null) {
    return result as ScriptRequest;
  }
  throw new Error("Script must return an object or an array of conditions.");
}

export function executeScriptRequest(store: Store<AnyRow>, request: ScriptRequest): unknown {
  const conditions = () => normalizeConditions(request.conditions ?? []);
  switch (request.operation ?? "search") {
    case "queryAll":
      return store.queryAll(request.limit);
    case "search":
      return store.search(conditions(), request.limit);
    case "projection":
      return store.searchProjection(conditions(), stringArray(request.fields, "fields"), request.limit);
    case "legacyProjection":
      return store.searchLegacyProjection(conditions(), request.fields === undefined
        ? undefined : stringArray(request.fields, "fields"), request.limit);
    case "keywordBestMatch":
    case "keywordMinimumMatch": {
      const input = typeof request.input === "string"
        ? request.input : stringArray(request.input, "input");
      const search = new KeywordSearch(store, request.maxKeywords);
      const options = {
        conditions: conditions(),
        fields: request.keywordFields === undefined
          ? undefined : stringArray(request.keywordFields, "keywordFields"),
        limit: request.limit,
      };
      return request.operation === "keywordBestMatch"
        ? search.bestMatch(input, options)
        : search.minimumMatch(input, options);
    }
    case "predict":
    case "oneEditAway": {
      if (typeof request.input !== "string") {
        throw new Error("Dictionary operations require a string input.");
      }
      const fields = request.keywordFields === undefined
        ? store.schema.fields.filter((field) =>
          (field.kind === "text" || field.kind === "enum") && !field.ignoreIndex
        ).map((field) => field.name)
        : stringArray(request.keywordFields, "keywordFields");
      for (const name of fields) {
        const field = store.schema.fieldMap.get(name);
        if (!field || field.ignoreIndex || (field.kind !== "text" && field.kind !== "enum")) {
          throw new Error(`Dictionary field "${name}" must be an indexed text or enum field.`);
        }
      }
      const dictionary = new DictionaryTrie();
      const filters = conditions();
      const rows = filters.length === 0 ? store.queryAll() : store.search(filters);
      for (const row of rows) {
        for (const field of fields) {
          if (typeof row[field] === "string") dictionary.addText(row[field]);
        }
      }
      return request.operation === "predict"
        ? dictionary.predict(request.input, request.limit)
        : dictionary.getOneEditCandidate(request.input);
    }
    case "diagnostics": {
      const trie = store.getDiagnosticTrieSerialization();
      return {
        state: store.getState(),
        rowCount: store.getLoadedRowCount(),
        normalizationProfile: store.normalizationProfile,
        schema: store.schema.fields,
        trie: trie.slice(0, 10_000),
        trieLength: trie.length,
        trieTruncated: trie.length > 10_000,
      };
    }
    default:
      throw new Error(`Unsupported operation: ${String(request.operation)}`);
  }
}

function normalizeConditions(rawConditions: readonly RawCondition[]): readonly Condition<AnyRow>[] {
  return rawConditions.map((raw) => {
    if (raw.operator !== undefined && !Object.values(Operator).includes(raw.operator)) {
      throw new Error(`Unknown operator "${raw.operator}".`);
    }
    return raw.operator === Operator.BETWEEN
      ? createCondition<AnyRow, string>({
        field: raw.field, operator: raw.operator,
        lowerValue: raw.lowerValue, upperValue: raw.upperValue,
      })
      : createCondition<AnyRow, string>({
        field: raw.field, operator: raw.operator, values: raw.values ?? [],
      });
  });
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be an array of strings.`);
  }
  return [...value];
}
