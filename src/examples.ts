import type { ScriptRequest } from "./query.ts";

export interface QueryExample {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly request: ScriptRequest;
  readonly expected: string;
  readonly error?: boolean;
}

export const EXAMPLES: Readonly<Record<string, readonly QueryExample[]>> = {
  "movie-basic": [
    {
      id: "browse", title: "01 - Browse a real CSV",
      description: "All 5,043 CSV records are indexed. limit only caps the output; source order and duplicate source rows are preserved.",
      request: { operation: "queryAll", limit: 20 }, expected: "20 movies, starting with Avatar.",
    },
    {
      id: "equal", title: "02 - Default equality and case folding",
      description: "Omitting operator means EQUAL. title is a case-insensitive alias for the CSV's movie_title column.",
      request: { conditions: [{ field: "title", values: ["CAST AWAY"] }] }, expected: "Cast Away, with its source IMDb rating of 7.7.",
    },
    {
      id: "not-equal", title: "03 - Exclude a scalar",
      description: "NOT_EQUAL excludes a scalar value. A result limit avoids rendering thousands of matching records.",
      request: { conditions: [{ field: "title", operator: "NOT_EQUAL", values: ["Big"] }], limit: 20 }, expected: "20 movies, none titled Big.",
    },
    {
      id: "less", title: "04 - Strict numeric upper bound",
      description: "LESS_THAN is exclusive. Missing source years are normalized as null rather than zero.",
      request: { conditions: [{ field: "year", operator: "LESS_THAN", values: [1995] }], limit: 20 }, expected: "Up to 20 movies released before 1995.",
    },
    {
      id: "less-equal", title: "05 - Inclusive numeric upper bound",
      description: "LESS_THAN_EQUAL includes movies from the boundary year.",
      request: { conditions: [{ field: "year", operator: "LESS_THAN_EQUAL", values: [1995] }], limit: 20 }, expected: "Up to 20 movies from 1995 or earlier.",
    },
    {
      id: "greater", title: "06 - Native decimal comparisons",
      description: "The native normalization profile preserves fractional IMDb scores. GREATER_THAN excludes the threshold.",
      request: { conditions: [{ field: "rating", operator: "GREATER_THAN", values: [8.5] }], limit: 20 }, expected: "Movies whose source IMDb score is strictly above 8.5.",
    },
    {
      id: "greater-equal", title: "07 - Inclusive numeric lower bound",
      description: "GREATER_THAN_EQUAL also includes movies rated exactly 8.5.",
      request: { conditions: [{ field: "rating", operator: "GREATER_THAN_EQUAL", values: [8.5] }], limit: 20 }, expected: "Movies rated 8.5 or higher.",
    },
    {
      id: "between", title: "08 - BETWEEN and AND",
      description: "BETWEEN is inclusive. Conditions are ANDed: the year must match and the actors collection must contain Tom Hanks.",
      request: { conditions: [{ field: "year", operator: "BETWEEN", lowerValue: 1990, upperValue: 2000 }, { field: "actors", operator: "CONTAINS_EITHER", values: ["Tom Hanks"] }], limit: 20 },
      expected: "Tom Hanks movies from 1990-2000, including Cast Away and Apollo 13.",
    },
    {
      id: "either", title: "09 - Match any collection member",
      description: "tags maps to the real genres column. CONTAINS_EITHER is OR within this one condition.",
      request: { conditions: [{ field: "tags", operator: "CONTAINS_EITHER", values: ["Adventure", "Comedy"] }], limit: 20 }, expected: "20 movies with Adventure or Comedy among their genres.",
    },
    {
      id: "all", title: "10 - Require every collection member",
      description: "CONTAINS_ALL requires both genres on the same movie.",
      request: { conditions: [{ field: "tags", operator: "CONTAINS_ALL", values: ["Drama", "History"] }], limit: 20 }, expected: "Movies tagged with both Drama and History.",
    },
    {
      id: "not-contains", title: "11 - Exclude collection members",
      description: "NOT_CONTAINS excludes matching genre members, rather than comparing an entire serialized genre key.",
      request: { conditions: [{ field: "tags", operator: "NOT_CONTAINS", values: ["Comedy"] }], limit: 20 }, expected: "20 movies without Comedy in their genres.",
    },
    {
      id: "null-collection", title: "12 - Null or matching collections",
      description: "Source blanks become null. This operator matches null keywords or the actual keyword island.",
      request: { conditions: [{ field: "keywords", operator: "CONTAINS_EITHER_INCLUDING_NULL", values: [null, "island"] }], limit: 20 }, expected: "Movies with unknown keywords or an island keyword.",
    },
    {
      id: "projection", title: "13 - Typed projection",
      description: "Projection preserves original types. imdbLink is ignored by the search index but can still be projected.",
      request: { operation: "projection", fields: ["title", "rating", "imdbLink"], conditions: [{ field: "title", values: ["Cast Away"] }] },
      expected: "Cast Away with numeric rating 7.7 and its source IMDb link.",
    },
    {
      id: "legacy", title: "14 - Legacy projection",
      description: "Legacy projection uses uppercase keys and string/null values.",
      request: { operation: "legacyProjection", fields: ["title", "rating"], conditions: [{ field: "title", values: ["Cast Away"] }] },
      expected: 'TITLE is "Cast Away"; RATING is the string "7.7".',
    },
    {
      id: "typo", title: "15 - Keyword typo correction",
      description: "Keyword bestMatch corrects one-edit typos and selects the highest positive score. Inspect correctedKeywords.",
      request: { operation: "keywordBestMatch", input: "apolo", keywordFields: ["title"], limit: 10 }, expected: 'Apollo titles; correctedKeywords maps "apolo" to "apollo".',
    },
    {
      id: "keyword-best", title: "16 - Best keyword score",
      description: "Input may be an array of phrases. bestMatch returns rows matching the highest number of query tokens.",
      request: { operation: "keywordBestMatch", input: ["Adventure", "History"], keywordFields: ["tags"], limit: 10 }, expected: "Movies matching both genre keywords.",
    },
    {
      id: "keyword-minimum", title: "17 - Minimum positive keyword score",
      description: "minimumMatch selects the lowest positive score, not a minimum-count threshold. Zero-match rows are excluded.",
      request: { operation: "keywordMinimumMatch", input: ["Adventure", "History"], keywordFields: ["tags"], limit: 10 }, expected: "Movies matching just one of the two genre keywords.",
    },
    {
      id: "stemming", title: "18 - Stem real plot keywords",
      description: "keywords enables stemmedIndex. A title filter isolates the lesson: surviving can match the source keyword survival.",
      request: { operation: "keywordBestMatch", input: "surviving", keywordFields: ["keywords"], conditions: [{ field: "title", values: ["Cast Away"] }] }, expected: "Cast Away via the shared English stem.",
    },
    {
      id: "keyword-filter", title: "19 - Keywords and structured filters",
      description: "Structured conditions restrict the candidate records before keyword scoring.",
      request: { operation: "keywordBestMatch", input: "Adventure", keywordFields: ["tags"], conditions: [{ field: "year", operator: "GREATER_THAN", values: [1998] }], limit: 10 }, expected: "Adventure movies from after 1998.",
    },
    {
      id: "keyword-cap", title: "20 - Keyword caps and truncation",
      description: "maxKeywords is passed to the KeywordSearch constructor. Inspect truncated and usedKeywords.",
      request: { operation: "keywordBestMatch", input: "Adventure Drama Comedy", keywordFields: ["tags"], maxKeywords: 2, limit: 10 }, expected: "truncated is true; only adventure and drama are considered.",
    },
    {
      id: "predict", title: "21 - Dictionary prefix completion",
      description: "Build a DictionaryTrie from all movie titles, then call predict. These are words, not movie records; predictable is metadata.",
      request: { operation: "predict", input: "apo", keywordFields: ["title"], limit: 5 }, expected: "Up to five title words beginning with apo, including apollo.",
    },
    {
      id: "one-edit", title: "22 - Dictionary correction",
      description: "DictionaryTrie.getOneEditCandidate handles insertion, deletion, or substitution and returns a word or null.",
      request: { operation: "oneEditAway", input: "apolo", keywordFields: ["title"] }, expected: '"apollo".',
    },
    {
      id: "ignore-index", title: "23 - Understand ignored-index errors",
      description: "imdbLink is returned in records and projections but intentionally excluded from filtering. This example should fail.",
      request: { conditions: [{ field: "imdbLink", values: ["https://www.imdb.com/"] }] }, expected: "A QueryValidationError identifying the ignored field.", error: true,
    },
    {
      id: "diagnostics", title: "24 - Inspect thousands of indexed rows",
      description: "Inspect prepared state, source row count, schema, and a bounded trie preview. trieTruncated and trieLength make preview truncation explicit. This is not a persistence format.",
      request: { operation: "diagnostics" }, expected: "rowCount is 5043; the trie preview is limited to 10,000 characters.",
    },
    {
      id: "enum", title: "25 - Enums and derived booleans",
      description: "color is a source enum; isColor is derived from it. Scalars use equality rather than CONTAINS_EITHER.",
      request: { operation: "projection", fields: ["title", "color", "isColor"], conditions: [{ field: "color", values: ["Black and White"] }, { field: "isColor", values: [false] }], limit: 20 }, expected: "Black-and-white films with isColor false.",
    },
    {
      id: "long", title: "26 - Long-valued box office",
      description: "gross is a long field from the CSV. These source values are safe integers; do not infer arbitrary-precision search from the long field name.",
      request: { operation: "projection", fields: ["title", "gross"], conditions: [{ field: "gross", operator: "GREATER_THAN", values: [500000000] }], limit: 20 }, expected: "Films with recorded gross above 500 million, including Avatar.",
    },
    {
      id: "null", title: "27 - Actual missing CSV values",
      description: "Blank director_name cells are normalized to null. Use the null value rather than the string \"null\".",
      request: { operation: "projection", fields: ["title", "director"], conditions: [{ field: "director", values: [null] }], limit: 20 }, expected: "Source records with missing directors.",
    },
    {
      id: "not-null", title: "28 - Exclude missing values",
      description: "NOT_EQUAL with null selects populated source values.",
      request: { operation: "projection", fields: ["title", "country"], conditions: [{ field: "country", operator: "NOT_EQUAL", values: [null] }], limit: 20 }, expected: "20 movies whose source country is known.",
    },
    {
      id: "date-between", title: "29 - Derived scalar dates",
      description: "calendarYearStart is January 1 of the source title_year, NOT an actual release date. dateFormat supports ordered comparisons.",
      request: { conditions: [{ field: "calendarYearStart", operator: "BETWEEN", lowerValue: "2000-01-01", upperValue: "2000-12-31" }], limit: 20 }, expected: "Movies whose source year is 2000.",
    },
    {
      id: "date-range", title: "30 - Derived calendar range containment",
      description: "calendarYearRange spans the source year. CONTAINS_EITHER tests a date point against this derived interval.",
      request: { conditions: [{ field: "calendarYearRange", operator: "CONTAINS_EITHER", values: ["2000-06-15"] }], limit: 20 }, expected: "Movies from 2000; this is a calendar-year query, not a release-date query.",
    },
    {
      id: "datetime-range", title: "31 - Scalar date-times and intervals",
      description: "calendarYearStartTime uses the supported ISO format. The year time range contains points and uses the default space-separated timestamp format.",
      request: { conditions: [{ field: "calendarYearStartTime", operator: "GREATER_THAN_EQUAL", values: ["2000-01-01T00:00:00"] }, { field: "calendarYearTimeRange", operator: "CONTAINS_EITHER", values: ["2000-06-15 12:00:00"] }], limit: 20 }, expected: "Movies from 2000.",
    },
    {
      id: "date-list", title: "32 - Date collection membership",
      description: "calendarYearDates contains the two calendar endpoints derived from title_year, not a list of actual release dates.",
      request: { conditions: [{ field: "calendarYearDates", operator: "CONTAINS_ALL", values: ["2000-01-01", "2000-12-31"] }], limit: 20 }, expected: "Movies from 2000 matching both endpoints.",
    },
    {
      id: "datetime-list", title: "33 - Date-time collections",
      description: "calendarYearTimes contains the start/end timestamps of the source year.",
      request: { conditions: [{ field: "calendarYearTimes", operator: "CONTAINS_EITHER", values: ["2000-01-01 00:00:00"] }], limit: 20 }, expected: "Movies from 2000.",
    },
    {
      id: "date-ranges", title: "34 - Collections of date ranges",
      description: "calendarHalfYearRanges splits the source year into two intervals. All requested points must be covered by that row's range collection.",
      request: { conditions: [{ field: "calendarHalfYearRanges", operator: "CONTAINS_ALL", values: ["2000-02-01", "2000-09-01"] }], limit: 20 }, expected: "Movies from 2000; the two points fall in different half-year intervals.",
    },
    {
      id: "datetime-ranges", title: "35 - Collections of date-time ranges",
      description: "calendarHalfYearTimeRanges is the timestamp equivalent of the two derived calendar half-year ranges.",
      request: { conditions: [{ field: "calendarHalfYearTimeRanges", operator: "CONTAINS_ALL", values: ["2000-02-01 12:00:00", "2000-09-01 12:00:00"] }], limit: 20 }, expected: "Movies from 2000.",
    },
    {
      id: "numeric-ranges", title: "36 - Numeric collections and ranges",
      description: "reviewCounts stores critic/user counts; reviewCountRange spans their min/max; reviewCountRanges holds singleton intervals. yearBand prefixes the source year with Y. These are explicitly derived representations.",
      request: { conditions: [
        { field: "reviewCounts", operator: "CONTAINS_EITHER", values: [3054] },
        { field: "reviewCountRange", operator: "CONTAINS_EITHER", values: [1000] },
        { field: "reviewCountRanges", operator: "CONTAINS_ALL", values: [723, 3054] },
        { field: "yearBand", operator: "CONTAINS_EITHER", values: ["Y2009"] },
      ] }, expected: "Avatar, whose critic/user review counts are 723 and 3054.",
    },
  ],
  airports: [
    {
      id: "browse", title: "01 - Browse 7,698 airports",
      description: "queryAll runs against the entire real airport CSV. A limit affects output only.",
      request: { operation: "queryAll", limit: 20 }, expected: "20 airport records, starting with Goroka.",
    },
    {
      id: "code", title: "02 - Exact airport code",
      description: "Use case-insensitive scalar equality on a real IATA code.",
      request: { conditions: [{ field: "airportCode", values: ["jfk"] }] }, expected: "The source record names JFK as New York, United States.",
    },
    {
      id: "country", title: "03 - Filter by country",
      description: "countryName maps to the CSV country column. No generated travel schedules are used.",
      request: { conditions: [{ field: "countryName", values: ["India"] }], limit: 20 }, expected: "20 airport records in India.",
    },
    {
      id: "and", title: "04 - Combine airport filters",
      description: "Both conditions must match the same airport record.",
      request: { conditions: [{ field: "airportCode", values: ["LHR"] }, { field: "countryName", values: ["United Kingdom"] }] }, expected: "The source record names LHR as London, United Kingdom.",
    },
    {
      id: "projection", title: "05 - Project airport fields",
      description: "Return only the properties needed for a country-specific selector.",
      request: { operation: "projection", fields: ["airportName", "airportCode"], conditions: [{ field: "countryName", values: ["United States"] }], limit: 20 }, expected: "20 US records with only airportName and airportCode.",
    },
    {
      id: "exclude", title: "06 - Exclude a country",
      description: "NOT_EQUAL excludes scalar values. JAVA is the numeric profile on this store; it does not change case-insensitive text equality.",
      request: { conditions: [{ field: "countryName", operator: "NOT_EQUAL", values: ["United States"] }], limit: 20 }, expected: "20 records outside the United States.",
    },
    {
      id: "keyword", title: "07 - Search real airport names",
      description: "Restrict keyword scoring to airportName rather than countries or codes.",
      request: { operation: "keywordBestMatch", input: "london", keywordFields: ["airportName"], limit: 5 }, expected: "Records whose source airportName contains London (the CSV uses city names for some airports).",
    },
    {
      id: "predict", title: "08 - Airport-name autocomplete",
      description: "Dictionary predictions are words extracted from all airport names. They are not airport records.",
      request: { operation: "predict", input: "san", keywordFields: ["airportName"], limit: 10 }, expected: "Up to ten airport-name words beginning with san.",
    },
  ],
};

export function exampleScript(example: QueryExample): string {
  const request = JSON.stringify(example.request, null, 2)
    .replace(/"operator": "([A-Z_]+)"/g, '"operator": Operator.$1');
  return `// ${example.description}\nreturn ${request};`;
}
