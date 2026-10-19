import Papa from "papaparse";
import {
  NormalizationProfile, Store, defineSchema, booleanField, enumField, longField,
  numberField, textField, type FieldOptions, type SchemaFieldInput,
} from "@kapoorlabs/kiara-ts";
import type { AnyRow } from "./query.ts";

export type FieldKind = "text" | "number" | "boolean" | "long" | "enum";
export type NormalizationProfileValue = (typeof NormalizationProfile)[keyof typeof NormalizationProfile];

export interface PlaygroundField {
  readonly name: string;
  readonly kind: FieldKind;
  readonly enumValues?: readonly string[];
  readonly options?: FieldOptions;
  readonly csvColumn?: string;
}

export interface DatasetDefinition {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly normalizationProfile: NormalizationProfileValue;
  readonly fields: readonly PlaygroundField[];
  readonly defaultScript: string;
  readonly csvFile?: string;
  readonly recordCount?: number;
  readonly sourceUrl?: string;
}

export interface PlaygroundDataset extends DatasetDefinition {
  readonly rows: readonly AnyRow[];
}

export const SOURCE_REVISION = "37b36c4031c8163a27293d044ca57fc84f53b8d7";
const sourceRoot = `https://github.com/kapoorlabs/kiara-demo/blob/${SOURCE_REVISION}/src/main/resources`;
const nullable = { nullable: true };
const textOptions = { ...nullable, caseInsensitive: true };

function column(name: string, csvColumn: string, kind: FieldKind, options: FieldOptions = nullable): PlaygroundField {
  return { name, csvColumn, kind, options };
}

export const BUILT_IN_DATASETS: readonly DatasetDefinition[] = [
  {
    id: "movie-basic",
    label: "Movies",
    description: "5,043 real movie records from the Java Kiara demo CSV. All source rows are loaded, including missing values and duplicates. Calendar and review-range helper fields are derived, not additional source facts.",
    normalizationProfile: NormalizationProfile.NATIVE,
    csvFile: "movie_metadata.csv",
    recordCount: 5043,
    sourceUrl: `${sourceRoot}/movie_metadata.csv`,
    fields: [
      column("title", "movie_title", "text", { ...textOptions, predictable: true, oneEditAway: true }),
      column("year", "title_year", "number"),
      column("tags", "genres", "text", { ...textOptions, secondaryType: "commaSeparatedStrings" }),
      column("rating", "imdb_score", "number"),
      column("keywords", "plot_keywords", "text", { ...textOptions, secondaryType: "commaSeparatedStrings", stemmedIndex: true }),
      column("actors", "actors", "text", { ...textOptions, secondaryType: "commaSeparatedStrings" }),
      column("director", "director_name", "text", textOptions),
      column("country", "country", "text", textOptions),
      column("language", "language", "text", textOptions),
      { ...column("color", "color", "enum", textOptions), enumValues: ["Color", "Black and White"] },
      column("contentRating", "content_rating", "text", textOptions),
      column("duration", "duration", "number"),
      column("gross", "gross", "long"),
      column("budget", "budget", "long"),
      column("votes", "num_voted_users", "long"),
      column("criticReviews", "num_critic_for_reviews", "long"),
      column("userReviews", "num_user_for_reviews", "long"),
      column("directorLikes", "director_facebook_likes", "long"),
      column("castLikes", "cast_total_facebook_likes", "long"),
      column("faces", "facenumber_in_poster", "number"),
      column("aspectRatio", "aspect_ratio", "number"),
      column("likes", "movie_facebook_likes", "long"),
      column("imdbLink", "movie_imdb_link", "text", { ...nullable, ignoreIndex: true }),
      { name: "isColor", kind: "boolean", options: nullable },
      { name: "calendarYearStart", kind: "text", options: { ...nullable, secondaryType: "dateFormat" } },
      { name: "calendarYearStartTime", kind: "text", options: { ...nullable, secondaryType: "dateTimeFormat", format: "yyyy-MM-dd'T'HH:mm:ss" } },
      { name: "calendarYearDates", kind: "text", options: { ...nullable, secondaryType: "commaSeparatedDates" } },
      { name: "calendarYearTimes", kind: "text", options: { ...nullable, secondaryType: "commaSeparatedDateTimes" } },
      { name: "calendarYearRange", kind: "text", options: { ...nullable, secondaryType: "dateRange" } },
      { name: "calendarYearTimeRange", kind: "text", options: { ...nullable, secondaryType: "dateTimeRange" } },
      { name: "calendarHalfYearRanges", kind: "text", options: { ...nullable, secondaryType: "commaSeparatedDateRanges" } },
      { name: "calendarHalfYearTimeRanges", kind: "text", options: { ...nullable, secondaryType: "commaSeparatedDateTimeRanges" } },
      { name: "reviewCounts", kind: "text", options: { ...nullable, secondaryType: "commaSeparatedNumbers" } },
      { name: "reviewCountRange", kind: "text", options: { ...nullable, secondaryType: "numericRange" } },
      { name: "reviewCountRanges", kind: "text", options: { ...nullable, secondaryType: "commaSeparatedNumericRanges" } },
      { name: "yearBand", kind: "text", options: { ...nullable, secondaryType: "numericRange", numericStartPos: 1 } },
    ],
    defaultScript: `return {
  operation: "projection",
  fields: ["title", "year", "rating", "tags"],
  conditions: [
    { field: "year", operator: Operator.BETWEEN, lowerValue: 1990, upperValue: 2010 },
    { field: "rating", operator: Operator.GREATER_THAN_EQUAL, values: [8] },
  ],
  limit: 20,
};`,
  },
  {
    id: "airports",
    label: "Airports",
    description: "7,698 real airport records from the Java Kiara demo CSV: airport name, country, and IATA code. No generated records or sampling.",
    normalizationProfile: NormalizationProfile.JAVA,
    csvFile: "airports.csv",
    recordCount: 7698,
    sourceUrl: `${sourceRoot}/airports.csv`,
    fields: [
      column("airportName", "airportName", "text", { ...textOptions, predictable: true, oneEditAway: true }),
      column("countryName", "country", "text", { ...textOptions, predictable: true }),
      column("airportCode", "airportCode", "text", { ...textOptions, predictable: true }),
    ],
    defaultScript: `return {
  operation: "search",
  conditions: [{ field: "countryName", values: ["India"] }],
  limit: 20,
};`,
  },
];

export function parseDatasetCsv(definition: DatasetDefinition, csv: string): PlaygroundDataset {
  const parsed = Papa.parse<string[]>(csv, { delimiter: ",", skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    throw new Error(`Invalid ${definition.csvFile ?? "CSV"}: ${parsed.errors.map((error) =>
      `row ${error.row ?? "unknown"}: ${error.message}`).join("; ")}`);
  }
  const [headers, ...records] = parsed.data;
  if (!headers || new Set(headers).size !== headers.length) {
    throw new Error("CSV requires a header with unique column names.");
  }
  const sourceFields = definition.fields.filter(
    (field): field is PlaygroundField & { csvColumn: string } => field.csvColumn !== undefined,
  );
  const indices = sourceFields.map((field) => {
    const index = headers.indexOf(field.csvColumn);
    if (index < 0) throw new Error(`CSV is missing required column "${field.csvColumn}".`);
    return index;
  });
  if (definition.recordCount !== undefined && records.length !== definition.recordCount) {
    throw new Error(`Expected ${definition.recordCount} records in ${definition.csvFile}, received ${records.length}.`);
  }
  const rows = records.map((record, index) => {
    if (record.length !== headers.length) {
      throw new Error(`CSV row ${index + 2} has ${record.length} columns; expected ${headers.length}.`);
    }
    const row: AnyRow = {};
    sourceFields.forEach((field, fieldIndex) => {
      const raw = record[indices[fieldIndex]].trim();
      if (raw === "" || raw.toLowerCase() === "null" || raw === "\\N") {
        row[field.name] = null;
      } else if (field.kind === "number" || field.kind === "long") {
        const value = Number(raw);
        if (!Number.isFinite(value) || (field.kind === "long" && !Number.isSafeInteger(value))) {
          throw new Error(`Invalid ${field.kind} in CSV row ${index + 2}, column "${field.csvColumn}": ${raw}`);
        }
        row[field.name] = value;
      } else {
        row[field.name] = raw;
      }
    });
    if (definition.id === "movie-basic") addMovieHelpers(row);
    return row;
  });
  return { ...definition, rows };
}

function addMovieHelpers(row: AnyRow): void {
  row.isColor = row.color === null ? null : row.color === "Color";
  const calendarFields = [
    "calendarYearStart", "calendarYearStartTime", "calendarYearDates", "calendarYearTimes",
    "calendarYearRange", "calendarYearTimeRange", "calendarHalfYearRanges", "calendarHalfYearTimeRanges", "yearBand",
  ];
  if (typeof row.year === "number") {
    const year = String(row.year).padStart(4, "0");
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    row.calendarYearStart = start;
    row.calendarYearStartTime = `${start}T00:00:00`;
    row.calendarYearDates = `${start},${end}`;
    row.calendarYearTimes = `${start} 00:00:00,${end} 23:59:59`;
    row.calendarYearRange = `${start}->${end}`;
    row.calendarYearTimeRange = `${start} 00:00:00->${end} 23:59:59`;
    row.calendarHalfYearRanges = `${start}->${year}-06-30,${year}-07-01->${end}`;
    row.calendarHalfYearTimeRanges = `${start} 00:00:00->${year}-06-30 23:59:59,${year}-07-01 00:00:00->${end} 23:59:59`;
    row.yearBand = `Y${year}->${year}`;
  } else {
    for (const name of calendarFields) row[name] = null;
  }
  const reviews = [row.criticReviews, row.userReviews].filter((value): value is number => typeof value === "number");
  row.reviewCounts = reviews.length > 0 ? reviews.join(",") : null;
  row.reviewCountRange = reviews.length > 0 ? `${Math.min(...reviews)}->${Math.max(...reviews)}` : null;
  row.reviewCountRanges = reviews.length > 0 ? reviews.map((value) => `${value}->${value}`).join(",") : null;
}

export function buildStore(dataset: PlaygroundDataset): Store<AnyRow> {
  const schema = defineSchema<AnyRow>(dataset.fields.map(createSchemaField));
  const store = new Store(schema, { normalizationProfile: dataset.normalizationProfile });
  store.loadRows(dataset.rows);
  store.prepare();
  return store;
}

function createSchemaField(field: PlaygroundField): SchemaFieldInput<AnyRow, string> {
  const options = field.options ?? {};
  switch (field.kind) {
    case "text": return textField<AnyRow, string>(field.name, options);
    case "number": return numberField<AnyRow, string>(field.name, options);
    case "long": return longField<AnyRow, string>(field.name, options);
    case "boolean": return booleanField<AnyRow, string>(field.name, options);
    case "enum":
      if (!field.enumValues?.length) throw new Error(`Enum field "${field.name}" must include enumValues.`);
      return enumField<AnyRow, string>(field.name, field.enumValues, options);
  }
}
