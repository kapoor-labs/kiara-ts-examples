import { DictionaryTrie, KeywordSearch, type Store } from "@kapoorlabs/kiara-ts";
import type { AnyRow } from "./query.ts";

export const AIRPORT_FIELDS = ["airportCode", "airportName", "countryName"] as const;
export type AirportField = (typeof AIRPORT_FIELDS)[number];
export type AirportScope = AirportField | "all";

export interface Prediction {
  readonly word: string;
  readonly value: string;
  readonly kind: "prefix" | "correction";
}

export class AirportTypeahead {
  private readonly dictionaries = new Map<AirportScope, DictionaryTrie>();
  private readonly keywords: KeywordSearch<AnyRow>;
  readonly recordCount: number;

  constructor(store: Store<AnyRow>) {
    for (const field of AIRPORT_FIELDS) {
      if (store.schema.fieldMap.get(field)?.kind !== "text") {
        throw new Error(`Airport type-ahead requires a text field named "${field}".`);
      }
    }
    for (const scope of ["all", ...AIRPORT_FIELDS] as const) {
      this.dictionaries.set(scope, new DictionaryTrie());
    }
    const rows = store.queryAll();
    for (const row of rows) {
      for (const field of AIRPORT_FIELDS) {
        const value = row[field];
        if (typeof value === "string") {
          this.dictionary(field).addText(value);
          this.dictionary("all").addText(value);
        }
      }
    }
    this.recordCount = rows.length;
    this.keywords = new KeywordSearch(store);
  }

  suggest(input: string, scope: AirportScope = "all", limit = 5): readonly Prediction[] {
    assertLimit(limit);
    const normalized = normalizeInput(input);
    const dictionary = this.dictionary(scope);
    if (!normalized) return [];
    const words = normalized.split(" ");
    const prefix = words.pop()!;
    const leading = words.length ? `${words.join(" ")} ` : "";
    const predictions = dictionary.predict(prefix, limit);
    if (predictions.length) {
      return predictions.map((word) => ({ word, value: leading + word, kind: "prefix" }));
    }
    const corrected = dictionary.getOneEditCandidate(prefix);
    return corrected === null ? [] : [{ word: corrected, value: leading + corrected, kind: "correction" }];
  }

  search(input: string, scope: AirportScope = "all", limit = 10) {
    assertLimit(limit);
    const normalized = normalizeInput(input);
    this.dictionary(scope);
    return this.keywords.bestMatch(normalized, {
      fields: scope === "all" ? [...AIRPORT_FIELDS] : [scope],
      limit,
    });
  }

  private dictionary(scope: AirportScope): DictionaryTrie {
    const dictionary = this.dictionaries.get(scope);
    if (!dictionary) throw new Error(`Unknown airport field scope: ${String(scope)}`);
    return dictionary;
  }
}

function normalizeInput(input: string): string {
  if (input.length > 128) throw new Error("Type-ahead input must be at most 128 characters.");
  const normalized = input.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
  if (normalized && normalized.split(" ").length > 10) {
    throw new Error("Type-ahead input must contain at most 10 whitespace-separated words.");
  }
  return normalized;
}

function assertLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
    throw new Error("Type-ahead limit must be an integer between 1 and 10.");
  }
}
