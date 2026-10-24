import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import Papa from "papaparse";

const revision = "169e24011b0832d236a76f9a2504016373505db0";
const licenseRevision = "bb27194fdddd416b951a467bff0aa90e54c378ba";
const base = `https://raw.githubusercontent.com/dougy83/jlcparts/${revision}/data/CapacitorsMultilayer_Ceramic_Capacitors_MLCC___SMDakaSMT`;
async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}
const [compressed, inventory, license] = await Promise.all([
  download(`${base}.json.gz`), download(`${base}.stock.json`),
  download(`https://raw.githubusercontent.com/dougy83/jlcparts/${licenseRevision}/LICENSE`),
]);
const catalog = JSON.parse(gunzipSync(compressed));
const stock = JSON.parse(inventory);
if (catalog.components.length !== 16802) throw new Error("Unexpected source component count.");
if (JSON.stringify(catalog.schema) !== JSON.stringify([
  "lcsc", "mfr", "joints", "description", "datasheet", "price", "img", "url", "attributes",
])) throw new Error("The source schema has changed.");

const missing = (value) => value === undefined || value === null || value === "" || value === "-" || value === "null";
function numeric(value, field) {
  if (missing(value)) return null;
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error(`Invalid ${field}: ${value}`);
  return result;
}
function voltage(value) {
  if (missing(value)) return null;
  const match = /^(\d+(?:\.\d+)?)(k|K|m)?V$/.exec(value);
  if (!match) throw new Error(`Unrecognized source voltage: ${value}`);
  return Number(match[1]) * (match[2] === "m" ? 0.001 : match[2] ? 1000 : 1);
}
const rows = catalog.components.map(([id, partNumber, , description, datasheet, , , , attributes]) => {
  const attr = (key) => {
    const entry = attributes[key];
    return entry?.values[entry.primary]?.[0] ?? null;
  };
  if (!Number.isSafeInteger(stock[id]) || stock[id] < 0) throw new Error(`Invalid or absent stock for ${id}.`);
  const sourceCapacitance = attr("Capacitance");
  if (sourceCapacitance === "NaN" && id !== "C710944") throw new Error(`Unexpected non-finite capacitance: ${id}.`);
  const capacitance = numeric(sourceCapacitance === "NaN" ? null : sourceCapacitance, "capacitance");
  return {
    id, partNumber, manufacturer: attr("Manufacturer"), package: attr("Package"),
    category: catalog.subcategory,
    // The upstream unit conversion contains binary multiplication noise.
    capacitance: capacitance === null ? null : Number(capacitance.toPrecision(15)),
    voltage: voltage(attr("Allowable voltage")),
    ratedVoltage: voltage(attr("Voltage - rated")),
    acVoltage: voltage(attr("Voltage(ac)")),
    stock: stock[id], dielectric: attr("Temperature coefficient"),
    tolerance: attr("Tolerance"), status: attr("Status"), library: attr("Basic/Extended"),
    temperatureRange: attr("Operating temperature") ?? attr("Operating temperature range"),
    subclass: attr("Subclass"), packaging: attr("Packaging"),
    minimumOrderQuantity: numeric(attr("MOQ"), "MOQ"),
    description, datasheet,
    sourceCapacitance: attr("Capacitance"), sourceVoltage: attr("Allowable voltage"),
  };
});
if (new Set(rows.map((row) => row.id)).size !== rows.length) throw new Error("Duplicate source IDs.");
console.warn('Source C710944 has capacitance "NaN": retained as sourceCapacitance; searchable capacitance is null.');
const csv = Papa.unparse(rows, { newline: "\n" }) + "\n";
const directory = new URL("../public/data/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL("capacitors.csv", directory), csv);
await writeFile(new URL("LICENSE-jlcparts.txt", directory), license);
console.log(JSON.stringify({
  records: rows.length, fields: Object.keys(rows[0]).length,
  csvSha256: createHash("sha256").update(csv).digest("hex"),
  sourceSha256: createHash("sha256").update(compressed).digest("hex"),
  stockSha256: createHash("sha256").update(inventory).digest("hex"),
}, null, 2));
