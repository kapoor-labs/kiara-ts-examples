import { readFileSync } from "node:fs";
import Papa from "papaparse";

// Field types map to KiaraDB schema options in engines.mjs:
// text, enum, boolean, number, long, date, datetime,
// list (strings), numberList, dateList, datetimeList,
// numericRange (optionally prefixed), dateRange, datetimeRange,
// numericRangeList, dateRangeList, datetimeRangeList.
export const LIST_TYPES = new Set(["list", "numberList", "dateList", "datetimeList"]);
export const RANGE_TYPES = new Set(["numericRange", "dateRange", "datetimeRange"]);
export const RANGE_LIST_TYPES = new Set(["numericRangeList", "dateRangeList", "datetimeRangeList"]);

// Deterministic PRNG so every engine and every run sees identical records.
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generator(seed) {
  const random = mulberry32(seed);
  const int = (min, max) => min + Math.floor(random() * (max - min + 1));
  const pick = (values) => values[Math.floor(random() * values.length)];
  const some = (values, min, max) => [...new Set(Array.from({ length: int(min, max) }, () => pick(values)))];
  return { random, int, pick, some };
}

const DAY = 86_400_000;
const BASE = Date.UTC(2026, 0, 1);
const pad = (value, width = 2) => String(value).padStart(width, "0");
export const dateAt = (offset) => new Date(BASE + offset * DAY).toISOString().slice(0, 10);
const timeAt = (date, hour, minute = 0) => `${date} ${pad(hour)}:${pad(minute)}:00`;

const ADJECTIVES = [
  "wireless", "wired", "smart", "compact", "portable", "vintage", "modern", "classic",
  "rustic", "ceramic", "wooden", "metal", "glass", "leather", "cotton", "solar",
  "rechargeable", "waterproof", "foldable", "ergonomic",
];
const COLORS = ["black", "white", "silver", "blue", "green", "red", "oak", "grey"];
const NOUNS = [
  "lamp", "speaker", "chair", "desk", "mug", "kettle", "lantern", "clock", "charger", "keyboard",
  "mouse", "backpack", "bottle", "blanket", "pillow", "headphones", "camera", "router", "monitor", "shelf",
];
const TAGS = [
  "wireless", "eco", "gift", "bestseller", "new", "clearance", "premium", "bundle",
  "outdoor", "kids", "office", "travel", "handmade", "imported", "limited",
];
const STATUSES = ["active", "active", "active", "active", "active", "active", "active", "archived", "archived", "draft"];
const REGIONS = ["emea", "amer", "apac", "latam", "mena"];
const SUPPLIERS = Array.from({ length: 10 }, (_, i) => `supplier-${pad(i)}`);

const CATALOG_FIELDS = [
  { name: "status", type: "text" },
  { name: "region", type: "text" },
  { name: "tier", type: "enum", values: ["basic", "plus", "pro"] },
  { name: "onSale", type: "boolean" },
  { name: "category", type: "text" },
  { name: "brand", type: "text" },
  { name: "supplier", type: "text", nullable: true },
  { name: "stars", type: "number" },
  { name: "rating", type: "number" },
  { name: "price", type: "number" },
  { name: "views", type: "long" },
  { name: "tags", type: "list", nullable: true },
  { name: "sizes", type: "numberList" },
  { name: "title", type: "text", stemmed: true },
  { name: "id", type: "text", indexed: false },
];

export function catalog(size, seed = 20261027) {
  const { random, int, pick, some } = generator(seed);
  const rows = Array.from({ length: size }, (_, i) => ({
    status: pick(STATUSES),
    region: pick(REGIONS),
    tier: pick(["basic", "basic", "plus", "pro"]),
    onSale: random() < 0.25,
    category: `category-${pad(int(0, 19))}`,
    brand: `brand-${pad(int(0, 49))}`,
    supplier: random() < 0.1 ? null : pick(SUPPLIERS),
    stars: int(1, 5),
    rating: int(10, 50) / 10,
    price: int(5, 500),
    views: int(0, 5_000_000),
    tags: random() < 0.1 ? null : some(TAGS, 1, 3),
    sizes: some([5, 6, 7, 8, 9, 10, 11, 12, 13], 1, 4).sort((a, b) => a - b),
    title: random() < 0.3
      ? `${pick(ADJECTIVES)} ${pick(ADJECTIVES)} ${pick(COLORS)} ${pick(NOUNS)}`
      : `${pick(ADJECTIVES)} ${pick(COLORS)} ${pick(NOUNS)}`,
    id: `p${i}`,
  }));
  return {
    name: `catalog-${size}`,
    description: `${size.toLocaleString("en-US")} deterministic synthetic products with ${CATALOG_FIELDS.length} fields (seed ${seed})`,
    fields: CATALOG_FIELDS,
    textField: "title",
    interpreter: { fields: { price: { canonicalUnit: "usd", units: { usd: 1, cents: 0.01 } } } },
    rows,
    workloads: [
      { id: "eq", category: "Equality", feature: "EQUAL on text", label: "brand = brand-07", kind: "exact", where: [{ field: "brand", op: "eq", values: ["brand-07"] }] },
      { id: "in", category: "Equality", feature: "EQUAL with several values (IN)", label: "region in (emea, apac)", kind: "exact", where: [{ field: "region", op: "eq", values: ["emea", "apac"] }], limit: 100 },
      {
        id: "and-3", category: "Equality", feature: "AND across fields", label: "status = active AND region = emea AND brand = brand-07", kind: "exact",
        where: [{ field: "status", op: "eq", values: ["active"] }, { field: "region", op: "eq", values: ["emea"] }, { field: "brand", op: "eq", values: ["brand-07"] }],
      },
      { id: "ne", category: "Equality", feature: "NOT_EQUAL", label: "status != archived, first 100", kind: "exact", where: [{ field: "status", op: "ne", values: ["archived"] }], limit: 100 },
      { id: "enum", category: "Typed scalars", feature: "Enum equality", label: "tier = pro AND status = active", kind: "exact", where: [{ field: "tier", op: "eq", values: ["pro"] }, { field: "status", op: "eq", values: ["active"] }] },
      { id: "boolean", category: "Typed scalars", feature: "Boolean equality", label: "onSale = true AND category = category-03", kind: "exact", where: [{ field: "onSale", op: "eq", values: [true] }, { field: "category", op: "eq", values: ["category-03"] }] },
      { id: "is-null", category: "Missing values", feature: "EQUAL null", label: "supplier is missing AND region = emea", kind: "exact", where: [{ field: "supplier", op: "eq", values: [null] }, { field: "region", op: "eq", values: ["emea"] }] },
      { id: "not-null", category: "Missing values", feature: "NOT_EQUAL null", label: "supplier is known AND brand = brand-07", kind: "exact", where: [{ field: "supplier", op: "ne", values: [null] }, { field: "brand", op: "eq", values: ["brand-07"] }] },
      { id: "lt", category: "Numeric", feature: "LESS_THAN", label: "price < 8", kind: "exact", where: [{ field: "price", op: "lt", value: 8 }] },
      { id: "gt", category: "Numeric", feature: "GREATER_THAN", label: "price > 495", kind: "exact", where: [{ field: "price", op: "gt", value: 495 }] },
      { id: "lte-gte", category: "Numeric", feature: "LESS_THAN_EQUAL and GREATER_THAN_EQUAL on decimals", label: "rating >= 4.9 AND stars <= 2", kind: "exact", where: [{ field: "rating", op: "gte", value: 4.9 }, { field: "stars", op: "lte", value: 2 }] },
      { id: "between", category: "Numeric", feature: "BETWEEN", label: "status = active AND price between 20 and 40", kind: "exact", where: [{ field: "status", op: "eq", values: ["active"] }, { field: "price", op: "between", low: 20, high: 40 }] },
      { id: "long", category: "Numeric", feature: "Long comparison", label: "views > 4,990,000", kind: "exact", where: [{ field: "views", op: "gt", value: 4_990_000 }] },
      { id: "list-any", category: "Lists", feature: "CONTAINS_EITHER on strings", label: "tags contain gift or premium, first 100", kind: "exact", where: [{ field: "tags", op: "any", values: ["gift", "premium"] }], limit: 100 },
      { id: "list-all", category: "Lists", feature: "CONTAINS_ALL on strings", label: "tags contain wireless and premium", kind: "exact", where: [{ field: "tags", op: "all", values: ["wireless", "premium"] }] },
      { id: "list-none", category: "Lists", feature: "NOT_CONTAINS on strings", label: "status = active AND tags exclude clearance, first 100", kind: "exact", where: [{ field: "status", op: "eq", values: ["active"] }, { field: "tags", op: "none", values: ["clearance"] }], limit: 100 },
      { id: "list-or-null", category: "Lists", feature: "CONTAINS_EITHER_INCLUDING_NULL", label: "tags missing or contain eco, AND brand = brand-07", kind: "exact", where: [{ field: "tags", op: "anyOrNull", values: [null, "eco"] }, { field: "brand", op: "eq", values: ["brand-07"] }] },
      { id: "number-list-any", category: "Lists", feature: "CONTAINS_EITHER on numbers", label: "sizes contain 13 AND region = emea", kind: "exact", where: [{ field: "sizes", op: "any", values: [13] }, { field: "region", op: "eq", values: ["emea"] }] },
      { id: "number-list-all", category: "Lists", feature: "CONTAINS_ALL on numbers", label: "sizes contain 9 and 10 AND category = category-03", kind: "exact", where: [{ field: "sizes", op: "all", values: [9, 10] }, { field: "category", op: "eq", values: ["category-03"] }] },
      { id: "limit", category: "Results", feature: "Result limit (source order)", label: "status = active, first 20", kind: "exact", where: [{ field: "status", op: "eq", values: ["active"] }], limit: 20 },
      { id: "projection", category: "Results", feature: "Typed projection", label: "brand = brand-07, return id and price only", kind: "exact", where: [{ field: "brand", op: "eq", values: ["brand-07"] }], projection: ["id", "price"] },
      { id: "interpret-values", category: "Query interpretation", feature: "Value discovery (no field names)", label: "\"active emea\"", kind: "exact", interpret: "active emea", where: [{ field: "status", op: "eq", values: ["active"] }, { field: "region", op: "eq", values: ["emea"] }], limit: 100 },
      { id: "interpret-explicit", category: "Query interpretation", feature: "Explicit field and numeric comparison", label: "\"brand:brand-07 price<=40\"", kind: "exact", interpret: "brand:brand-07 price<=40", where: [{ field: "brand", op: "eq", values: ["brand-07"] }, { field: "price", op: "lte", value: 40 }] },
      { id: "interpret-units", category: "Query interpretation", feature: "Unit conversion", label: "\"brand-07 price<=4000cents\"", kind: "exact", interpret: "brand-07 price<=4000cents", where: [{ field: "brand", op: "eq", values: ["brand-07"] }, { field: "price", op: "lte", value: 40 }] },
      { id: "typo", category: "Text search", feature: "Keyword best match with typo correction", label: "\"wireles lamp\", top 10", kind: "fuzzy", input: "wireles lamp", intended: ["wireless", "lamp"], limit: 10 },
      {
        id: "typo-filtered", category: "Text search", feature: "Keyword search with hard filters", label: "\"wireles lamp\" with status = active AND region = emea, top 10", kind: "fuzzy",
        input: "wireles lamp", intended: ["wireless", "lamp"], limit: 10,
        where: [{ field: "status", op: "eq", values: ["active"] }, { field: "region", op: "eq", values: ["emea"] }],
      },
      { id: "stemming", category: "Text search", feature: "English stemming", label: "\"chargers\", top 10", kind: "fuzzy", input: "chargers", intended: ["charger"], limit: 10 },
      { id: "minimum", category: "Text search", feature: "Keyword minimum match", label: "\"wireless lamp\" minimum match, top 10", kind: "fuzzy", mode: "minimum", input: "wireless lamp", limit: 10 },
      { id: "prefix", category: "Text search", feature: "As-you-type completion", label: "\"wirel\" typed so far, top 10", kind: "prefix", input: "wirel", limit: 10 },
      { id: "correction", category: "Text search", feature: "One-edit spelling correction", label: "\"keybord\" -> keyboard", kind: "correction", input: "keybord", expected: "keyboard" },
    ],
  };
}

const CITIES = Array.from({ length: 30 }, (_, i) => `city-${pad(i)}`);
const KINDS = ["concert", "workshop", "tour", "class", "match", "expo"];
const OPEN_DATE_POOL = Array.from({ length: 40 }, (_, i) => dateAt(i * 9));
const SESSION_POOL = Array.from({ length: 24 }, (_, i) => timeAt(dateAt(120 + (i % 6) * 7), 10 + Math.floor(i / 6) * 3));
const SLOT_DAYS = Array.from({ length: 20 }, (_, i) => dateAt(90 + i * 5));

const SCHEDULE_FIELDS = [
  { name: "kind", type: "text" },
  { name: "city", type: "text" },
  { name: "venue", type: "text" },
  { name: "startDate", type: "date" },
  { name: "startTime", type: "datetime" },
  { name: "openDates", type: "dateList" },
  { name: "sessionTimes", type: "datetimeList" },
  { name: "capacity", type: "numericRange" },
  { name: "ageBand", type: "numericRange", prefixLength: 1 },
  { name: "durations", type: "numericRangeList" },
  { name: "season", type: "dateRange", nullable: true },
  { name: "window", type: "datetimeRange" },
  { name: "closures", type: "dateRangeList" },
  { name: "bookingSlots", type: "datetimeRangeList" },
  { name: "id", type: "text", indexed: false },
];

export function schedule(size, seed = 20261028) {
  const { random, int, pick, some } = generator(seed);
  const rows = Array.from({ length: size }, (_, i) => {
    const start = int(0, 364);
    const startDate = dateAt(start);
    const capacityLow = 50 * int(1, 10);
    const ageLow = int(0, 30);
    const seasonStart = int(0, 300);
    const windowDay = pick(SLOT_DAYS);
    const windowStart = int(8, 12);
    const slotDay = pick(SLOT_DAYS);
    const eveningDay = pick(SLOT_DAYS);
    return {
      kind: pick(KINDS),
      city: pick(CITIES),
      venue: `venue-${pad(int(0, 39))}`,
      startDate,
      startTime: timeAt(startDate, int(8, 22), pick([0, 15, 30, 45])),
      openDates: some(OPEN_DATE_POOL, 1, 3).sort(),
      sessionTimes: some(SESSION_POOL, 1, 3).sort(),
      capacity: { low: capacityLow, high: capacityLow + 50 * int(1, 20) },
      ageBand: { prefix: pick(["A", "T"]), low: ageLow, high: ageLow + int(10, 60) },
      durations: Array.from({ length: int(1, 2) }, () => {
        const low = 15 * int(1, 8);
        return { low, high: low + 15 * int(1, 4) };
      }),
      season: random() < 0.2 ? null : { low: dateAt(seasonStart), high: dateAt(seasonStart + int(30, 120)) },
      window: { low: timeAt(windowDay, windowStart), high: timeAt(windowDay, windowStart + int(2, 8)) },
      closures: Array.from({ length: int(1, 2) }, () => {
        const day = int(0, 360);
        return { low: dateAt(day), high: dateAt(day + int(0, 6)) };
      }),
      bookingSlots: [
        ...(random() < 0.6 ? [{ low: timeAt(slotDay, 9), high: timeAt(slotDay, 12) }] : []),
        ...(random() < 0.6 ? [{ low: timeAt(slotDay, 13), high: timeAt(slotDay, 17) }] : []),
        { low: timeAt(eveningDay, 18), high: timeAt(eveningDay, 21) },
      ],
      id: `e${i}`,
    };
  });
  const slotDay = SLOT_DAYS[3];
  return {
    name: `schedule-${size}`,
    description: `${size.toLocaleString("en-US")} deterministic synthetic events with ${SCHEDULE_FIELDS.length} date, time, and range fields (seed ${seed})`,
    fields: SCHEDULE_FIELDS,
    rows,
    workloads: [
      { id: "date-eq", category: "Dates and times", feature: "EQUAL on a date", label: "startDate = 2026-03-15", kind: "exact", where: [{ field: "startDate", op: "eq", values: ["2026-03-15"] }] },
      { id: "date-between", category: "Dates and times", feature: "BETWEEN on a date", label: "city = city-03 AND startDate in March 2026", kind: "exact", where: [{ field: "city", op: "eq", values: ["city-03"] }, { field: "startDate", op: "between", low: "2026-03-01", high: "2026-03-31" }] },
      { id: "date-gt", category: "Dates and times", feature: "GREATER_THAN on a date", label: "startDate > 2026-12-29", kind: "exact", where: [{ field: "startDate", op: "gt", value: "2026-12-29" }] },
      { id: "datetime-window", category: "Dates and times", feature: "GREATER_THAN_EQUAL and LESS_THAN on a date-time", label: "startTime on 2026-06-01, 08:00-12:00", kind: "exact", where: [{ field: "startTime", op: "gte", value: "2026-06-01 08:00:00" }, { field: "startTime", op: "lt", value: "2026-06-01 12:00:00" }] },
      { id: "date-list-any", category: "Date and time lists", feature: "CONTAINS_EITHER on dates", label: "openDates contain the 10th pool date AND kind = concert", kind: "exact", where: [{ field: "openDates", op: "any", values: [OPEN_DATE_POOL[10]] }, { field: "kind", op: "eq", values: ["concert"] }] },
      { id: "date-list-all", category: "Date and time lists", feature: "CONTAINS_ALL on dates", label: "openDates contain two pool dates", kind: "exact", where: [{ field: "openDates", op: "all", values: [OPEN_DATE_POOL[10], OPEN_DATE_POOL[20]] }] },
      { id: "datetime-list-any", category: "Date and time lists", feature: "CONTAINS_EITHER on date-times", label: "sessionTimes contain one slot AND city = city-03", kind: "exact", where: [{ field: "sessionTimes", op: "any", values: [SESSION_POOL[5]] }, { field: "city", op: "eq", values: ["city-03"] }] },
      { id: "range-any", category: "Stored ranges", feature: "Numeric range contains a point", label: "capacity range contains 250 AND kind = expo", kind: "exact", where: [{ field: "capacity", op: "any", values: [250] }, { field: "kind", op: "eq", values: ["expo"] }] },
      { id: "range-all", category: "Stored ranges", feature: "Numeric range contains every point", label: "capacity range contains 100 and 900", kind: "exact", where: [{ field: "capacity", op: "all", values: [100, 900] }] },
      { id: "range-none", category: "Stored ranges", feature: "Numeric range excludes a point", label: "capacity range excludes 1000, first 100", kind: "exact", where: [{ field: "capacity", op: "none", values: [1000] }], limit: 100 },
      { id: "range-prefixed", category: "Stored ranges", feature: "Prefix-partitioned numeric range", label: "ageBand contains A21 AND city = city-03", kind: "exact", where: [{ field: "ageBand", op: "any", values: ["A21"] }, { field: "city", op: "eq", values: ["city-03"] }] },
      { id: "range-list-any", category: "Stored ranges", feature: "List of numeric ranges contains a point", label: "durations contain 125 AND city = city-03", kind: "exact", where: [{ field: "durations", op: "any", values: [125] }, { field: "city", op: "eq", values: ["city-03"] }] },
      { id: "range-list-all", category: "Stored ranges", feature: "List of numeric ranges contains every point", label: "durations contain 20 and 170", kind: "exact", where: [{ field: "durations", op: "all", values: [20, 170] }] },
      { id: "date-range-any", category: "Stored ranges", feature: "Date range contains a date", label: "season contains 2026-07-15 AND kind = tour", kind: "exact", where: [{ field: "season", op: "any", values: ["2026-07-15"] }, { field: "kind", op: "eq", values: ["tour"] }] },
      { id: "date-range-none", category: "Stored ranges", feature: "Date range excludes a date (missing excluded)", label: "season excludes 2026-07-15, first 100", kind: "exact", where: [{ field: "season", op: "none", values: ["2026-07-15"] }], limit: 100 },
      { id: "datetime-range-any", category: "Stored ranges", feature: "Date-time range contains a time", label: `window contains ${slotDay} 09:30`, kind: "exact", where: [{ field: "window", op: "any", values: [`${slotDay} 09:30:00`] }] },
      { id: "date-range-list-any", category: "Stored ranges", feature: "List of date ranges contains a date", label: "closures contain 2026-12-25", kind: "exact", where: [{ field: "closures", op: "any", values: ["2026-12-25"] }] },
      { id: "datetime-range-list-all", category: "Stored ranges", feature: "List of date-time ranges contains every time", label: `bookingSlots contain ${slotDay} 10:00 and 14:00`, kind: "exact", where: [{ field: "bookingSlots", op: "all", values: [timeAt(slotDay, 10), timeAt(slotDay, 14)] }] },
      {
        id: "mixed", category: "Combined", feature: "Text, date, and range conditions together", label: "kind = concert AND city = city-03 AND season contains 2026-07-15 AND capacity contains 250", kind: "exact",
        where: [
          { field: "kind", op: "eq", values: ["concert"] }, { field: "city", op: "eq", values: ["city-03"] },
          { field: "season", op: "any", values: ["2026-07-15"] }, { field: "capacity", op: "any", values: [250] },
        ],
      },
    ],
  };
}

const RETAIL_FIELDS = [
  { name: "markets", type: "list" },
  { name: "unitPrice", type: "number" },
  { name: "unitsSold", type: "number" },
  { name: "title", type: "text", stemmed: true },
  { name: "id", type: "text", indexed: false },
];

export function retailCatalog(path = new URL("../../public/data/retail-products.csv", import.meta.url)) {
  const parsed = Papa.parse(readFileSync(path, "utf8"), { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(`Invalid retail CSV: ${parsed.errors[0].message}`);
  const rows = parsed.data.map((row) => ({
    markets: row.markets.split(",").map((market) => market.trim()).filter(Boolean),
    unitPrice: Number(row.unitPrice),
    unitsSold: Number(row.unitsSold),
    title: row.title,
    id: row.sku,
  }));
  if (rows.length !== 3788) throw new Error(`Expected 3,788 retail products, received ${rows.length}.`);
  return {
    name: "retail-3788",
    description: "3,788 real products from the UCI Online Retail dataset (CC BY 4.0)",
    fields: RETAIL_FIELDS,
    textField: "title",
    rows,
    workloads: [
      { id: "list-any", category: "Lists", feature: "CONTAINS_EITHER on strings", label: "markets contain Japan or Australia", kind: "exact", where: [{ field: "markets", op: "any", values: ["Japan", "Australia"] }] },
      { id: "list-all", category: "Lists", feature: "CONTAINS_ALL on strings", label: "markets contain Japan and France", kind: "exact", where: [{ field: "markets", op: "all", values: ["Japan", "France"] }] },
      { id: "list-none", category: "Lists", feature: "NOT_CONTAINS on strings", label: "markets exclude United Kingdom", kind: "exact", where: [{ field: "markets", op: "none", values: ["United Kingdom"] }] },
      { id: "lt", category: "Numeric", feature: "LESS_THAN", label: "unitPrice < 0.2", kind: "exact", where: [{ field: "unitPrice", op: "lt", value: 0.2 }] },
      { id: "gte", category: "Numeric", feature: "GREATER_THAN_EQUAL", label: "unitsSold >= 20000", kind: "exact", where: [{ field: "unitsSold", op: "gte", value: 20_000 }] },
      { id: "between", category: "Numeric", feature: "BETWEEN", label: "markets contain Japan AND unitPrice between 1 and 2", kind: "exact", where: [{ field: "markets", op: "any", values: ["Japan"] }, { field: "unitPrice", op: "between", low: 1, high: 2 }] },
      { id: "typo", category: "Text search", feature: "Keyword best match with typo correction", label: "\"candle holdr\", top 10", kind: "fuzzy", input: "candle holdr", intended: ["candle", "holder"], limit: 10 },
      { id: "stemming", category: "Text search", feature: "English stemming", label: "\"lanterns\", top 10", kind: "fuzzy", input: "lanterns", intended: ["lantern"], limit: 10 },
      { id: "minimum", category: "Text search", feature: "Keyword minimum match", label: "\"candle holder\" minimum match, top 10", kind: "fuzzy", mode: "minimum", input: "candle holder", limit: 10 },
      { id: "prefix", category: "Text search", feature: "As-you-type completion", label: "\"lant\" typed so far, top 10", kind: "prefix", input: "lant", limit: 10 },
      { id: "correction", category: "Text search", feature: "One-edit spelling correction", label: "\"lanern\" -> lantern", kind: "correction", input: "lanern", expected: "lantern" },
    ],
  };
}

export function loadDataset(name) {
  if (name === "retail-3788") return retailCatalog();
  const match = /^(catalog|schedule)-(\d+)$/.exec(name);
  if (match) return match[1] === "catalog" ? catalog(Number(match[2])) : schedule(Number(match[2]));
  throw new Error(`Unknown dataset "${name}".`);
}

export function words(text) {
  return String(text).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/** Fraction of returned records whose title contains every intended word (substring, so "CANDLEHOLDER" counts). */
export function fuzzyPrecision(titles, intended) {
  if (!titles.length) return 0;
  return titles.filter((title) => intended.every((word) => String(title).toLowerCase().includes(word))).length / titles.length;
}

/** Fraction of returned items (words or record titles) containing a word that starts with the prefix. */
export function prefixPrecision(items, prefix) {
  if (!items.length) return 0;
  const lower = prefix.toLowerCase();
  return items.filter((item) => words(item).some((word) => word.startsWith(lower))).length / items.length;
}
