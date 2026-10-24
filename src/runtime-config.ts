import {
  NormalizationProfile, Store, StoreLoader, createCondition, defineSchema,
  numberField, textField,
} from "@kapoorlabs/kiara-ts";

export const CONFIG_DIMENSIONS = ["country", "originCity", "airline"] as const;
type Dimension = (typeof CONFIG_DIMENSIONS)[number];

export interface ConfigRule {
  readonly id: string;
  readonly country: string | null;
  readonly originCity: string | null;
  readonly airline: string | null;
  readonly surcharge: number;
}

export interface FlightContext {
  readonly country: string;
  readonly originCity: string;
  readonly airline: string;
}

export interface RankedRule {
  readonly rule: ConfigRule;
  readonly specificity: number;
}

export type ConfigResolution =
  | { readonly status: "matched"; readonly winner: ConfigRule; readonly candidates: readonly RankedRule[]; readonly revision: number }
  | { readonly status: "no-match"; readonly candidates: readonly RankedRule[]; readonly revision: number }
  | { readonly status: "ambiguous"; readonly tiedRules: readonly ConfigRule[]; readonly candidates: readonly RankedRule[]; readonly revision: number };

export const SAMPLE_CONFIG_RULES: readonly ConfigRule[] = [
  { id: "india-default", country: "in", originCity: null, airline: null, surcharge: 2 },
  { id: "us-default", country: "us", originCity: null, airline: null, surcharge: 1 },
  { id: "us-delta", country: "us", originCity: null, airline: "dl", surcharge: 3 },
  { id: "us-nyc", country: "us", originCity: "nyc", airline: null, surcharge: 2.5 },
  { id: "us-nyc-american", country: "us", originCity: "nyc", airline: "aa", surcharge: 4.5 },
  { id: "us-nyc-delta", country: "us", originCity: "nyc", airline: "dl", surcharge: 5.5 },
  { id: "worldwide-delta", country: null, originCity: null, airline: "dl", surcharge: 6 },
];

const ruleSchema = defineSchema<ConfigRule>([
  textField("id", { ignoreIndex: true }),
  ...CONFIG_DIMENSIONS.map((field) => textField<ConfigRule, Dimension>(field, {
    nullable: true, caseInsensitive: true,
  })),
  numberField("surcharge", { ignoreIndex: true }),
]);

export class RuntimeConfigEngine {
  private store: Store<ConfigRule>;
  private currentRevision = 1;

  constructor(rules: unknown = SAMPLE_CONFIG_RULES) {
    this.store = new Store(ruleSchema, { normalizationProfile: NormalizationProfile.NATIVE });
    this.store.loadRows(validateRules(rules));
    this.store.prepare();
  }

  get revision(): number {
    return this.currentRevision;
  }

  get rules(): readonly ConfigRule[] {
    return this.store.queryAll();
  }

  replaceRules(rules: unknown): void {
    const validated = validateRules(rules);
    const replacement = new StoreLoader(this.store).replaceAll(validated);
    this.store = replacement;
    this.currentRevision += 1;
  }

  resolve(context: FlightContext): ConfigResolution {
    const conditions = CONFIG_DIMENSIONS.map((field) => {
      const raw = context[field];
      if (typeof raw !== "string") throw new Error(`Flight ${field} must be a string.`);
      const value = raw.trim().toLocaleLowerCase("en-US");
      if (field === "country" && !value) throw new Error("Flight country is required.");
      return createCondition<ConfigRule, Dimension>({
        field,
        values: value ? [value, null] : [null],
      });
    });
    const candidates = this.store.search(conditions).map((rule) => ({
      rule,
      specificity: CONFIG_DIMENSIONS.filter((field) => rule[field] !== null).length,
    })).sort((left, right) =>
      right.specificity - left.specificity || left.rule.id.localeCompare(right.rule.id, "en-US"),
    );
    const revision = this.currentRevision;
    if (!candidates.length) return { status: "no-match", candidates, revision };
    const highest = candidates[0].specificity;
    const tiedRules = candidates.filter((candidate) => candidate.specificity === highest).map((candidate) => candidate.rule);
    if (tiedRules.length > 1) return { status: "ambiguous", tiedRules, candidates, revision };
    return { status: "matched", winner: candidates[0].rule, candidates, revision };
  }
}

function validateRules(raw: unknown): ConfigRule[] {
  if (!Array.isArray(raw)) throw new Error("Configuration must be an array of rules.");
  const ids = new Set<string>();
  return raw.map((value: unknown, index) => {
    const label = `Rule ${index + 1}`;
    if (!isRecord(value)) throw new Error(`${label} must be an object.`);
    const allowed = ["id", ...CONFIG_DIMENSIONS, "surcharge"];
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) throw new Error(`${label} has an unknown property "${key}".`);
    }

    if (typeof value.id !== "string" || !value.id.trim()) throw new Error(`${label} requires a non-empty id.`);
    const id = value.id.trim();
    if (ids.has(id)) throw new Error(`Duplicate rule id "${id}".`);
    ids.add(id);
    const dimension = (name: Dimension): string | null => {
      const field = value[name];
      if (field === null) return null;
      if (typeof field !== "string" || !field.trim()) {
        throw new Error(`${label}.${name} must be a non-empty string or null (wildcard).`);
      }
      return field.trim().toLocaleLowerCase("en-US");
    };
    if (typeof value.surcharge !== "number" || !Number.isFinite(value.surcharge) || value.surcharge < 0) {
      throw new Error(`${label}.surcharge must be a finite, non-negative number.`);
    }
    return {
      id, country: dimension("country"), originCity: dimension("originCity"),
      airline: dimension("airline"), surcharge: value.surcharge,
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
