import Fuse from "fuse.js";
import {
  Store, NormalizationProfile, Operator, KeywordSearch, DictionaryTrie, QueryInterpreter,
  createCondition, defineSchema, textField, numberField, booleanField, longField, enumField,
} from "@kapoorlabs/kiara-ts";
import { createHash } from "node:crypto";
import { LIST_TYPES, RANGE_LIST_TYPES, RANGE_TYPES, fuzzyPrecision, prefixPrecision } from "./datasets.mjs";

function timed(phases, name, action) {
  const start = performance.now();
  const value = action();
  phases[name] = performance.now() - start;
  return value;
}

const fieldMap = (dataset) => Object.fromEntries(dataset.fields.map((field) => [field.name, field]));

// ---------------------------------------------------------------------------
// Reference semantics (plain JavaScript, no index), matching KiaraDB's documented behavior.
// ---------------------------------------------------------------------------

const isMissing = (value) => value === null || value === undefined;
const fold = (field, value) => (typeof value === "string" && (field.type === "text" || field.type === "list") ? value.toLowerCase() : value);

function containsPoint(field, range, point) {
  if (field.prefixLength) {
    const text = String(point);
    const number = Number(text.slice(field.prefixLength));
    return range.prefix === text.slice(0, field.prefixLength) && range.low <= number && number <= range.high;
  }
  // Numbers compare numerically; same-format date and date-time strings compare lexicographically.
  return range.low <= point && point <= range.high;
}

export function createMatcher(dataset) {
  const fields = fieldMap(dataset);
  return (row, clause) => {
    const field = fields[clause.field];
    const value = row[clause.field];
    if (RANGE_TYPES.has(field.type) || RANGE_LIST_TYPES.has(field.type)) {
      const ranges = isMissing(value) ? [] : RANGE_TYPES.has(field.type) ? [value] : value;
      const inside = (point) => ranges.some((range) => containsPoint(field, range, point));
      if (clause.op === "any") return clause.values.some(inside);
      if (clause.op === "all") return clause.values.every(inside);
      // Range NOT_CONTAINS excludes records without ranges.
      if (clause.op === "none") return ranges.length > 0 && !clause.values.some(inside);
      throw new Error(`Unsupported range operator ${clause.op}`);
    }
    if (LIST_TYPES.has(field.type)) {
      const items = isMissing(value) ? null : value.map((item) => fold(field, item));
      const has = (item) => items !== null && items.includes(fold(field, item));
      if (clause.op === "any") return clause.values.some(has);
      if (clause.op === "all") return clause.values.every(has);
      // List NOT_CONTAINS keeps records whose list is missing.
      if (clause.op === "none") return !clause.values.some(has);
      if (clause.op === "anyOrNull") {
        return (clause.values.includes(null) && items === null) || clause.values.some((item) => item !== null && has(item));
      }
      throw new Error(`Unsupported list operator ${clause.op}`);
    }
    const equals = () => clause.values.some((candidate) => (candidate === null
      ? isMissing(value)
      : !isMissing(value) && fold(field, value) === fold(field, candidate)));
    switch (clause.op) {
      case "eq": return equals();
      case "ne": return !equals();
      case "lt": return !isMissing(value) && value < clause.value;
      case "lte": return !isMissing(value) && value <= clause.value;
      case "gt": return !isMissing(value) && value > clause.value;
      case "gte": return !isMissing(value) && value >= clause.value;
      case "between": return !isMissing(value) && value >= clause.low && value <= clause.high;
      default: throw new Error(`Unsupported scalar operator ${clause.op}`);
    }
  };
}

/** Correct answer for an exact workload: matching ids in source order, up to the limit. Not timed. */
export function referenceIds(dataset, workload, matches = createMatcher(dataset)) {
  const ids = [];
  const limit = workload.limit ?? Infinity;
  for (const row of dataset.rows) {
    if (ids.length >= limit) break;
    if (workload.where.every((clause) => matches(row, clause))) ids.push(row.id);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// KiaraDB
// ---------------------------------------------------------------------------

const SECONDARY = {
  list: "commaSeparatedStrings", numberList: "commaSeparatedNumbers",
  dateList: "commaSeparatedDates", datetimeList: "commaSeparatedDateTimes",
  date: "dateFormat", datetime: "dateTimeFormat",
  numericRange: "numericRange", dateRange: "dateRange", datetimeRange: "dateTimeRange",
  numericRangeList: "commaSeparatedNumericRanges", dateRangeList: "commaSeparatedDateRanges",
  datetimeRangeList: "commaSeparatedDateTimeRanges",
};

function kiaraField(field) {
  const common = { nullable: field.nullable === true, ignoreIndex: field.indexed === false };
  switch (field.type) {
    case "number": return numberField(field.name, common);
    case "long": return longField(field.name, common);
    case "boolean": return booleanField(field.name, common);
    case "enum": return enumField(field.name, field.values, common);
    default: return textField(field.name, {
      ...common,
      ...(field.type === "text" || field.type === "list" ? { caseInsensitive: true } : {}),
      ...(SECONDARY[field.type] ? { secondaryType: SECONDARY[field.type] } : {}),
      ...(field.prefixLength ? { numericStartPos: field.prefixLength } : {}),
      ...(field.stemmed ? { stemmedIndex: true } : {}),
    });
  }
}

const rangeText = (range) => `${range.prefix ?? ""}${range.low}->${range.high}`;

function kiaraValue(field, value) {
  if (isMissing(value)) return null;
  if (LIST_TYPES.has(field.type)) return value.join(",");
  if (RANGE_TYPES.has(field.type)) return rangeText(value);
  if (RANGE_LIST_TYPES.has(field.type)) return value.map(rangeText).join(",");
  return value;
}

const OPERATORS = {
  eq: Operator.EQUAL, ne: Operator.NOT_EQUAL,
  lt: Operator.LESS_THAN, lte: Operator.LESS_THAN_EQUAL,
  gt: Operator.GREATER_THAN, gte: Operator.GREATER_THAN_EQUAL,
  any: Operator.CONTAINS_EITHER, all: Operator.CONTAINS_ALL, none: Operator.NOT_CONTAINS,
  anyOrNull: Operator.CONTAINS_EITHER_INCLUDING_NULL,
};

function kiaraCondition(clause) {
  if (clause.op === "between") {
    return { field: clause.field, operator: Operator.BETWEEN, lowerValue: clause.low, upperValue: clause.high };
  }
  if (clause.op === "eq") return createCondition({ field: clause.field, values: clause.values });
  return { field: clause.field, operator: OPERATORS[clause.op], values: clause.values ?? [clause.value] };
}

function buildKiara(dataset) {
  const phases = {};
  const store = timed(phases, "prepare", () => {
    const prepared = new Store(defineSchema(dataset.fields.map(kiaraField)), { normalizationProfile: NormalizationProfile.NATIVE });
    prepared.loadRows(dataset.rows.map((row) => Object.fromEntries(dataset.fields.map((field) => [field.name, kiaraValue(field, row[field.name])]))));
    prepared.prepare();
    return prepared;
  });
  let keywords;
  let dictionary;
  if (dataset.textField) {
    // Keyword postings are built lazily on first use; measure that cost explicitly.
    keywords = timed(phases, "keywordIndex", () => {
      const search = new KeywordSearch(store);
      search.bestMatch("warmup", { fields: [dataset.textField], limit: 1 });
      return search;
    });
    dictionary = timed(phases, "typeaheadTrie", () => {
      const trie = new DictionaryTrie();
      for (const row of dataset.rows) trie.addText(row[dataset.textField]);
      return trie;
    });
  }
  const interpreter = dataset.interpreter
    ? timed(phases, "interpreter", () => new QueryInterpreter(store, dataset.interpreter))
    : null;

  return {
    phases,
    run(workload) {
      if (workload.kind === "exact") {
        if (workload.interpret) return { ids: interpreter.search(workload.interpret, {}, workload.limit).map((row) => row.id) };
        const conditions = workload.where.map(kiaraCondition);
        const rows = workload.projection
          ? store.searchProjection(conditions, workload.projection, workload.limit)
          : store.search(conditions, workload.limit);
        return { ids: rows.map((row) => row.id) };
      }
      if (workload.kind === "fuzzy") {
        const options = {
          fields: [dataset.textField], limit: workload.limit,
          ...(workload.where ? { conditions: workload.where.map(kiaraCondition) } : {}),
        };
        const found = (workload.mode === "minimum"
          ? keywords.minimumMatch(workload.input, options)
          : keywords.bestMatch(workload.input, options)).results;
        return { ids: found.map((row) => row.id), items: found.map((row) => row[dataset.textField]) };
      }
      if (workload.kind === "prefix") return { items: dictionary.predict(workload.input, workload.limit), unit: "words" };
      return { items: [dictionary.getOneEditCandidate(workload.input) ?? ""] };
    },
  };
}

// ---------------------------------------------------------------------------
// Fuse.js
// ---------------------------------------------------------------------------

// Fuse.js matches strings, so numbers, booleans, and ranges are not searchable keys.
const FUSE_TYPES = new Set(["text", "enum", "list", "date", "datetime", "dateList", "datetimeList"]);

function fuseClauses(clause, fields) {
  const field = fields[clause.field];
  if (!field || field.indexed === false || !FUSE_TYPES.has(field.type)) return null;
  if (!["eq", "any", "all"].includes(clause.op) || clause.values.some((value) => typeof value !== "string")) return null;
  // Quoted extended-search exact match; an array key matches when any element matches.
  const exact = (value) => ({ [clause.field]: `="${value}"` });
  if (clause.op === "all") return clause.values.map(exact);
  return [clause.values.length === 1 ? exact(clause.values[0]) : { $or: clause.values.map(exact) }];
}

function fuseFilter(where, fields) {
  const parts = [];
  for (const clause of where) {
    const mapped = fuseClauses(clause, fields);
    if (!mapped) return null;
    parts.push(...mapped);
  }
  return parts;
}

function buildFuse(dataset, { tuned = false } = {}) {
  const phases = {};
  const fields = fieldMap(dataset);
  const keys = dataset.fields.filter((field) => field.indexed !== false && FUSE_TYPES.has(field.type)).map((field) => field.name);
  // Tuned: ignore match position, and (for text search) AND whitespace-separated fuzzy tokens.
  const location = tuned ? { ignoreLocation: true } : {};
  const structured = timed(phases, "structuredIndex", () => new Fuse(dataset.rows, { keys, useExtendedSearch: true, ...location }));
  const text = dataset.textField
    ? timed(phases, "textIndex", () => new Fuse(dataset.rows, {
      keys: [dataset.textField], ...location, ...(tuned ? { useExtendedSearch: true } : {}),
    }))
    : null;
  const options = (workload) => (workload.limit ? { limit: workload.limit } : {});
  return {
    phases,
    run(workload) {
      if (workload.kind === "exact") {
        if (workload.interpret) return null;
        const filter = fuseFilter(workload.where, fields);
        if (!filter) return null;
        return { ids: structured.search({ $and: filter }, options(workload)).map((result) => result.item.id) };
      }
      if (workload.kind === "fuzzy") {
        if (workload.mode === "minimum") return null;
        let found;
        if (workload.where) {
          const filter = fuseFilter(workload.where, fields);
          if (!filter) return null;
          found = structured.search({ $and: [...filter, { [dataset.textField]: workload.input }] }, options(workload));
        } else {
          found = text.search(workload.input, options(workload));
        }
        const rows = found.map((result) => result.item);
        return { ids: rows.map((row) => row.id), items: rows.map((row) => row[dataset.textField]) };
      }
      if (workload.kind === "prefix") {
        return { items: text.search(workload.input, options(workload)).map((result) => result.item[dataset.textField]), unit: "records" };
      }
      return null;
    },
  };
}

export const ENGINES = {
  kiara: { label: "KiaraDB", build: buildKiara },
  fuse: { label: "Fuse.js (defaults)", build: (dataset) => buildFuse(dataset) },
  "fuse-tuned": { label: "Fuse.js (tuned)", build: (dataset) => buildFuse(dataset, { tuned: true }) },
};

/** Summarizes one engine's output and checks it against the reference semantics. */
export function describe(workload, output, dataset, matches) {
  if (workload.kind === "exact") {
    const ordered = dataset.rows.filter((row) => workload.where.every((clause) => matches(row, clause))).map((row) => row.id);
    const all = new Set(ordered);
    const ids = [...output.ids].sort();
    const expectedCount = Math.min(workload.limit ?? Infinity, all.size);
    return {
      count: ids.length,
      total: all.size,
      fingerprint: createHash("sha1").update(ids.join(",")).digest("hex").slice(0, 12),
      valid: ids.length === expectedCount && new Set(ids).size === ids.length && ids.every((id) => all.has(id)),
      // KiaraDB promises source order; Fuse.js orders by score.
      sourceOrder: output.ids.every((id, i) => id === ordered[i]) && output.ids.length === expectedCount,
    };
  }
  if (workload.kind === "fuzzy") {
    const result = { count: output.ids.length, top: output.items.slice(0, 3) };
    if (workload.intended) result.precision = fuzzyPrecision(output.items, workload.intended);
    if (workload.where) {
      const rows = new Map(dataset.rows.map((row) => [row.id, row]));
      const respected = output.ids.filter((id) => workload.where.every((clause) => matches(rows.get(id), clause)));
      result.filterRespected = output.ids.length ? respected.length / output.ids.length : 1;
    }
    return result;
  }
  if (workload.kind === "prefix") {
    return { count: output.items.length, unit: output.unit, precision: prefixPrecision(output.items, workload.input), top: output.items.slice(0, 3) };
  }
  return { word: output.items[0], correct: output.items[0] === workload.expected };
}
