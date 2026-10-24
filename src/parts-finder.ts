import {
  NormalizationProfile, QueryInterpreter, editQueryFragment,
  Operator, type Condition, type OperatorType, type QueryInterpretation, type Store,
} from "@kapoorlabs/kiara-ts";
import type { AnyRow } from "./query.ts";
import type { DatasetDefinition, PlaygroundField } from "./datasets.ts";

const text = (name: string, indexed = true): PlaygroundField => ({
  name, kind: "text", csvColumn: name,
  options: { nullable: true, caseInsensitive: true, ignoreIndex: !indexed },
});
const number = (name: string): PlaygroundField => ({
  name, kind: "number", csvColumn: name, options: { nullable: true },
});
export const PARTS_DEFINITION: DatasetDefinition = {
  id: "capacitors", label: "Electronic components",
  description: "All 16,802 records in the February 23, 2024 JLCParts MLCC snapshot, including missing specifications and source outliers.",
  normalizationProfile: NormalizationProfile.NATIVE,
  csvFile: "capacitors.csv", recordCount: 16802,
  sourceUrl: "https://github.com/dougy83/jlcparts/tree/169e24011b0832d236a76f9a2504016373505db0/data",
  fields: [
    text("id"), text("partNumber"), text("manufacturer"), text("package"), text("category"),
    number("capacitance"), number("voltage"), number("ratedVoltage"), number("acVoltage"),
    number("stock"), text("dielectric"), text("tolerance"), text("status"), text("library"),
    text("temperatureRange"), text("subclass"), text("packaging"), number("minimumOrderQuantity"),
    text("description", false), text("datasheet", false), text("sourceCapacitance", false), text("sourceVoltage", false),
  ],
  defaultScript: 'return { conditions: [{ field: "package", values: ["0603"] }], limit: 25 };',
};

export const PARTS_PRESETS = [
  { label: "Values only", input: "ceramic samsung X7R" },
  { label: "Units", input: "cap:10uF voltage>=25V" },
  { label: "Equivalent units", input: "cap:10000nF voltage>=25V" },
  { label: "Range", input: "cap:1uF..10uF voltage>=25V" },
  { label: "Choose a field", input: "25V" },
  { label: "No matches", input: "stock<0" },
  { label: "Clear all", input: "" },
] as const;

export type PartsSelections = Readonly<Record<string, string>>;
export type PartsResult =
  | { readonly status: "blocked"; readonly interpretation: QueryInterpretation<AnyRow> }
  | { readonly status: "ready"; readonly interpretation: QueryInterpretation<AnyRow>; readonly total: number; readonly rows: readonly AnyRow[] };

export class PartsFinder {
  readonly interpreter: QueryInterpreter<AnyRow>;

  constructor(store: Store<AnyRow>) {
    this.interpreter = new QueryInterpreter(store, {
      fields: {
        capacitance: {
          aliases: ["cap"], canonicalUnit: "F", units: { F: 1, mF: 1e-3, uF: 1e-6, nF: 1e-9, pF: 1e-12 },
        },
        voltage: { aliases: ["v", "allowable voltage"], canonicalUnit: "V", units: { V: 1, kV: 1000, mV: 0.001 } },
        ratedVoltage: { aliases: ["rated"], canonicalUnit: "V", units: { V: 1, kV: 1000, mV: 0.001 } },
        acVoltage: { aliases: ["ac"], canonicalUnit: "V", units: { V: 1, kV: 1000, mV: 0.001 } },
        stock: { aliases: ["inventory", "qty"] },
        manufacturer: { aliases: ["maker"], valueAliases: { samsung: "Samsung Electro-Mechanics", murata: "Murata Electronics" } },
        category: { valueAliases: { ceramic: "Multilayer Ceramic Capacitors MLCC - SMD/SMT", mlcc: "Multilayer Ceramic Capacitors MLCC - SMD/SMT" } },
      },
    });
  }

  evaluate(input: string, selections: PartsSelections = {}): PartsResult {
    const interpretation = this.interpreter.interpret(input, selections);
    if (interpretation.issues.length) return { status: "blocked", interpretation };
    const matches = this.interpreter.search(input, selections);
    return { status: "ready", interpretation, total: matches.length, rows: matches.slice(0, 50) };
  }
}

export function replacePartsField(
  interpretation: QueryInterpretation<AnyRow>, field: string, expression: string,
): string {
  let input = interpretation.input;
  const filters = interpretation.filters.filter((filter) => filter.condition.field === field);
  for (const filter of [...filters].reverse()) {
    input = editQueryFragment({ ...interpretation, input }, filter.id, "");
  }
  return [input.trim(), expression].filter(Boolean).join(" ");
}

const symbols: Partial<Record<OperatorType, string>> = {
  EQUAL: "=", NOT_EQUAL: "!=", LESS_THAN: "<", LESS_THAN_EQUAL: "<=",
  GREATER_THAN: ">", GREATER_THAN_EQUAL: ">=",
};
export function partsExpression(condition: Condition<AnyRow>): string {
  const encode = (value: unknown): string => {
    if (typeof value === "string" || typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))) return JSON.stringify(value);
    throw new Error("A parts filter must contain a finite number, string, or boolean.");
  };
  if (condition.operator === Operator.BETWEEN) {
    return `${condition.field}:${encode(condition.lowerValue)}..${encode(condition.upperValue)}`;
  }
  const symbol = symbols[condition.operator];
  if (!symbol) throw new Error(`Unsupported parts filter operator: ${condition.operator}`);
  return condition.field + symbol + encode(condition.values?.[0]);
}
