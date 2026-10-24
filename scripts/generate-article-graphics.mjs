import { mkdir, writeFile } from "node:fs/promises";

const directory = new URL("../articles/images/", import.meta.url);
const palette = {
  background: "#081426", panel: "#11243b", line: "#304963",
  ink: "#f2f6fc", muted: "#afc2d7", mint: "#64e0bf",
};
const escape = (value) => String(value).replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const text = (x, y, value, size = 26, color = palette.ink, weight = 400, width = 1440) =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}" data-max-width="${width}">${escape(value)}</text>`;
const rect = (x, y, width, height, fill = palette.panel, stroke = palette.line, radius = 20) =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
const card = (x, y, width, height, body, stroke = palette.line) =>
  `<g data-box="${x} ${y} ${width} ${height}">${rect(x, y, width, height, palette.panel, stroke)}${body}</g>`;
const line = (x1, y1, x2, y2, color = palette.mint, arrow = false) =>
  `<path d="M${x1} ${y1} L${x2} ${y2}" fill="none" stroke="${color}" stroke-width="3"${arrow ? ' marker-end="url(#arrow)"' : ""}/>`;
const dot = (x, y, radius, color) => `<circle cx="${x}" cy="${y}" r="${radius}" fill="${color}"/>`;
const chip = (x, y, width, label, color = palette.mint) =>
  `<g data-box="${x} ${y} ${width} 52">${rect(x, y, width, 52, "#132b3c", color, 12)}${text(x + 18, y + 35, label, 25, color, 600, width - 36)}</g>`;

const artwork = [
  {
    file: "seven-features-linkedin", accent: "#64e0bf", number: "01",
    heading: ["New filter combinations.", "No new composite index."],
    sub: "Prepare once. Compose conditions over searchable fields.",
    title: "Automatic indexing supports changing filter combinations",
    description: "Status, score, tags, and window fields feed a prepared store with internal indexes. Several different queries use that same store.",
    footer: "Automatic indexing is not index-free storage. Records and indexes occupy memory.",
    draw: () => {
      const fields = ["status", "score", "tags", "window"];
      return fields.map((field, i) => chip(80, 326 + i * 84, 245, field)).join("")
        + fields.map((_, i) => line(325, 352 + i * 84, 465, 478, palette.mint)).join("")
        + line(465, 478, 515, 478, palette.mint, true)
        + card(525, 330, 440, 300,
          text(560, 382, "PREPARED STORE", 23, palette.mint, 700, 370)
          + [0, 1, 2, 3].map(i => rect(565, 416 + i * 38, 355 - i * 24, 20, "#25445a", "#25445a", 6)).join("")
          + text(560, 592, "Internal indexes built for you", 25, palette.ink, 500, 370), palette.mint)
        + line(965, 478, 1100, 478, palette.mint, true)
        + card(1118, 330, 402, 300,
          text(1150, 382, "COMPOSE A QUERY", 23, palette.mint, 700, 335)
          + text(1150, 443, "status", 28, palette.ink, 500, 335)
          + text(1150, 502, "status + score", 28, palette.ink, 500, 335)
          + text(1150, 561, "status + score + tags", 28, palette.ink, 500, 335))
        + text(80, 703, "Same dataset. Different questions.", 32, palette.muted, 500);
    },
  },
  {
    file: "seven-features-medium", accent: "#7eb9ff", number: "02",
    heading: ["Not every filter", "is an equality check."],
    sub: "Combine membership, numeric bands, and stored intervals.",
    title: "Tags, dates, and ranges combined with AND",
    description: "Three cards show required tags audited and export, a score from 80 to 95, and October 24 inside an October interval. All three feed one matching record.",
    footer: "Collections of disjoint intervals can contain both endpoints and still leave a gap.",
    draw: () => card(80, 330, 450, 255,
      text(110, 375, "REQUIRE BOTH TAGS", 23, "#7eb9ff", 700, 390)
      + chip(110, 413, 165, "audited", "#7eb9ff")
      + chip(292, 413, 170, "export", "#7eb9ff")
      + text(110, 546, "CONTAINS_ALL", 27, palette.ink, 600, 390))
      + card(575, 330, 450, 255,
        text(605, 375, "SCORE BAND", 23, "#7eb9ff", 700, 390)
        + line(615, 450, 975, 450, "#47617e")
        + line(680, 450, 910, 450, "#7eb9ff")
        + dot(680, 450, 9, "#7eb9ff") + dot(910, 450, 9, "#7eb9ff")
        + text(663, 492, "80", 28) + text(893, 492, "95", 28)
        + text(605, 546, "BETWEEN", 27, palette.ink, 600, 390))
      + card(1070, 330, 450, 255,
        text(1100, 375, "DATE IN A WINDOW", 23, "#7eb9ff", 700, 390)
        + line(1110, 450, 1475, 450, "#7eb9ff")
        + dot(1380, 450, 11, palette.mint)
        + text(1110, 490, "Oct 1", 22, palette.muted)
        + text(1408, 490, "Oct 31", 22, palette.muted)
        + text(1308, 421, "Oct 24", 23, palette.mint)
        + text(1100, 546, "CONTAINS_EITHER", 27, palette.ink, 600, 390))
      + [305, 800, 1295].map(x => line(x, 585, 800, 643, "#7eb9ff")).join("")
      + card(530, 644, 540, 72, text(561, 690, "AND  /  one qualifying record", 29, palette.ink, 600, 478), "#7eb9ff"),
  },
  {
    file: "query-interpretation-linkedin", accent: "#f6bd70", number: "03",
    heading: ["Know the value?", "Skip the field hunt."],
    sub: "Whole-value discovery turns familiar input into explicit conditions.",
    title: "Bare values resolve to field conditions",
    description: "The query active emea is separated into status equals active and region equals emea. If active occurs in two fields, the interface asks for a choice.",
    footer: "Whole-value discovery is schema-aware, not unrestricted natural-language understanding.",
    draw: () => card(80, 338, 600, 205,
      text(115, 387, "WHAT THE USER TYPES", 23, "#f6bd70", 700, 525)
      + text(115, 477, "active emea", 60, palette.ink, 600, 525), "#f6bd70")
      + line(680, 438, 895, 438, "#f6bd70", true)
      + card(915, 320, 605, 120,
        text(945, 365, "STATUS", 21, "#f6bd70", 700, 540)
        + text(945, 411, "= active", 38, palette.ink, 600, 540))
      + card(915, 463, 605, 120,
        text(945, 508, "REGION", 21, "#f6bd70", 700, 540)
        + text(945, 554, "= emea", 38, palette.ink, 600, 540))
      + text(80, 627, "If two fields contain the same value:", 27, palette.muted)
      + chip(80, 658, 180, "status?", "#f6bd70")
      + chip(280, 658, 180, "label?", "#f6bd70")
      + text(497, 694, "Ask. Then make the condition explicit.", 30, palette.ink, 600),
  },
  {
    file: "query-interpretation-medium", accent: "#bfabff", number: "04",
    heading: ["Different units.", "The same requirement."],
    sub: "Configured conversions produce the same canonical condition.",
    title: "Equivalent units produce equivalent duration queries",
    description: "time less than or equal to 500 milliseconds and duration less than or equal to 0.5 seconds both compile to duration less than or equal to 0.5 canonical seconds.",
    footer: "Declare units and aliases. Store canonical values. Ask when more than one field fits.",
    draw: () => card(80, 338, 560, 140,
      text(110, 379, "MILLISECONDS", 22, "#bfabff", 700, 495)
      + text(110, 439, "time<=500ms", 43, palette.ink, 600, 495))
      + card(80, 522, 560, 140,
        text(110, 563, "SECONDS", 22, "#bfabff", 700, 495)
        + text(110, 623, "duration<=0.5s", 43, palette.ink, 600, 495))
      + line(640, 408, 780, 500, "#bfabff")
      + line(640, 592, 780, 500, "#bfabff")
      + dot(780, 500, 10, "#bfabff")
      + line(790, 500, 930, 500, "#bfabff", true)
      + card(950, 362, 570, 276,
        text(985, 412, "ONE CANONICAL CONDITION", 22, "#bfabff", 700, 495)
        + text(985, 493, "duration <= 0.5", 47, palette.ink, 600, 495)
        + text(985, 548, "stored in seconds", 29, palette.muted, 400, 495)
        + text(985, 600, "same matching records", 28, "#bfabff", 600, 495), "#bfabff"),
  },
  {
    file: "typeahead", accent: "#66dfd7", number: "05",
    heading: ["Fix the typo.", "Keep every requirement."],
    sub: "Forgiving words should never mean forgiving a failed filter.",
    title: "Typo correction preserves exact filtering",
    description: "The misspelling serch is corrected to search. Active status and score of at least 80 are still required. One record passes; an archived and a lower-score record do not.",
    footer: "Autocomplete suggests words. KeywordSearch retrieves records. Conditions enforce requirements.",
    draw: () => card(80, 334, 595, 150,
      text(110, 378, "LEXICAL CORRECTION", 22, "#66dfd7", 700, 530)
      + text(110, 445, "serch", 47, palette.muted, 500, 180)
      + line(302, 428, 397, 428, "#66dfd7", true)
      + text(429, 445, "search", 47, "#66dfd7", 600, 210))
      + card(80, 515, 595, 163,
        text(110, 558, "HARD REQUIREMENTS", 22, "#66dfd7", 700, 530)
        + text(110, 605, "status = active", 31, palette.ink, 500, 530)
        + text(110, 649, "score >= 80", 31, palette.ink, 500, 530))
      + line(675, 409, 812, 500, "#66dfd7")
      + line(675, 597, 812, 500, "#66dfd7")
      + line(812, 500, 910, 500, "#66dfd7", true)
      + card(930, 334, 590, 344,
        text(965, 379, "RESULTS AFTER FILTERING", 22, "#66dfd7", 700, 520)
        + rect(960, 412, 530, 62, "#193d43", "#66dfd7", 10)
        + text(985, 454, "r1   active     90     MATCH", 29, palette.ink, 600, 480)
        + text(985, 538, "r2   archived   95", 29, palette.muted, 400, 480)
        + text(985, 615, "r3   active     70", 29, palette.muted, 400, 480)),
  },
  {
    file: "runtime-config", accent: "#f5bd78", number: "06",
    heading: ["Know which rule wins.", "Keep the last good snapshot."],
    sub: "Query candidates. Define precedence. Prepare before activation.",
    title: "Explainable rule selection and snapshot replacement",
    description: "Four candidate rules have specificity zero, one, one, and two. The exact rule wins. A separate pair of cards shows an active value of 40 and a prepared value of 50 before activation.",
    footer: "KiaraDB finds candidates. Your application owns ranking, validation, and activation.",
    draw: () => card(80, 328, 680, 369,
      text(115, 374, "CANDIDATES / SPECIFICITY", 23, "#f5bd78", 700, 610)
      + [["default", "0"], ["production", "1"], ["team", "1"], ["exact", "2  WINNER"]].map(([name, score], i) =>
        (i === 3 ? rect(105, 604, 630, 63, "#39362d", "#f5bd78", 10) : "")
        + text(130, 439 + i * 69, name, 30, palette.ink, i === 3 ? 700 : 400, 320)
        + text(525, 439 + i * 69, score, 27, i === 3 ? "#f5bd78" : palette.muted, 600, 190)).join(""))
      + card(835, 328, 685, 170,
        text(870, 375, "ACTIVE SNAPSHOT", 23, "#f5bd78", 700, 605)
        + text(870, 459, "40", 66, palette.ink, 700, 170)
        + text(1045, 451, "continues answering", 29, palette.muted, 400, 435))
      + card(835, 527, 685, 170,
        text(870, 574, "PREPARED REPLACEMENT", 23, "#f5bd78", 700, 605)
        + text(870, 658, "50", 66, "#f5bd78", 700, 170)
        + text(1045, 650, "activate when valid", 29, palette.muted, 400, 435))
      + text(80, 737, "Equal top scores? Report a tie, not a guess.", 25, palette.muted),
  },
  {
    file: "field-agnostic-java-ts", accent: "#9caaff", number: "07",
    heading: ["Your users choose the filters.", "KiaraDB prepares the indexes."],
    sub: "Search field combinations without manually managing composite indexes.",
    title: "Schema-driven indexing and advanced filters in KiaraDB",
    description: "A typed schema is prepared into internal indexes. Status, numeric bands, and collection requirements are composed in one query. Java and TypeScript are implementation options.",
    footer: "Java + TypeScript implementations. Prepared, in-memory data. No universal latency claim.",
    draw: () => card(80, 335, 405, 335,
      text(115, 382, "01 / DEFINE FIELDS", 23, "#9caaff", 700, 335)
      + text(115, 450, "status     text", 29, palette.ink, 500, 335)
      + text(115, 510, "score      number", 29, palette.ink, 500, 335)
      + text(115, 570, "tags       collection", 29, palette.ink, 500, 335)
      + text(115, 631, "one schema", 25, palette.muted, 400, 335))
      + line(485, 499, 564, 499, "#9caaff", true)
      + card(585, 335, 400, 335,
        text(620, 382, "02 / PREPARE", 23, "#9caaff", 700, 330)
        + [0, 1, 2].map(i =>
          rect(623, 427 + i * 48, 320, 29, "#283b66", "#475894", 6)
          + [0, 1, 2, 3].map(j => dot(646 + j * 63, 441 + i * 48, 5, "#9caaff")).join("")).join("")
        + text(620, 631, "internal indexes", 25, palette.muted, 400, 330), "#9caaff")
      + line(985, 499, 1064, 499, "#9caaff", true)
      + card(1085, 335, 435, 335,
        text(1120, 382, "03 / COMPOSE", 23, "#9caaff", 700, 365)
        + text(1120, 450, "status = active", 28, palette.ink, 500, 365)
        + text(1120, 510, "score BETWEEN 80..95", 28, palette.ink, 500, 365)
        + text(1120, 570, "tags CONTAINS_ALL", 28, palette.ink, 500, 365)
        + text(1120, 631, "one query", 25, palette.muted, 400, 365)),
  },
  {
    file: "hackernoon-trie-bounds", accent: "#64e0bf", number: "08",
    heading: ["Paris hotels with free cancellation.", "No index for that pair. Just two lookups."],
    sub: "Simplified to two levels: city, then cancellation policy.",
    title: "DFS bounds combine two per-attribute lookups in a shared trie",
    description: "Root spans 0 to 11. Paris spans 1 to 6, containing free 2 to 3 for hotels h1 and h2, and none 4 to 5 for h3 and h5. Rome spans 7 to 10, containing free 8 to 9 for h4. The cancellation index returns both free nodes; only the one inside Paris is kept.",
    footer: "Original schematic. Bracketed numbers come from a depth-first walk, not from the data.",
    draw: () => line(515, 390, 310, 430)
      + line(515, 390, 765, 430, palette.line)
      + line(310, 515, 202, 590)
      + line(310, 515, 472, 590, palette.line)
      + line(765, 515, 787, 590, palette.line)
      + card(425, 330, 180, 60, text(445, 370, "root [0, 11]", 25, palette.muted, 500, 140))
      + card(160, 430, 300, 85,
        text(190, 483, "Paris [1, 6]", 32, palette.mint, 600, 240), palette.mint)
      + card(615, 430, 300, 85,
        text(645, 483, "Rome [7, 10]", 29, palette.muted, 500, 240))
      + card(80, 590, 245, 95,
        text(105, 631, "free [2, 3]", 29, palette.mint, 600, 195)
        + text(105, 666, "h1, h2 / keep", 23, palette.ink, 500, 195), palette.mint)
      + card(350, 590, 245, 95,
        text(375, 631, "none [4, 5]", 29, palette.muted, 500, 195)
        + text(375, 666, "h3, h5", 23, palette.muted, 400, 195))
      + card(665, 590, 245, 95,
        text(690, 631, "free [8, 9]", 29, palette.muted, 500, 195)
        + text(690, 666, "h4 / skip", 23, palette.muted, 400, 195))
      + card(990, 330, 530, 355,
        text(1025, 379, "TWO PER-ATTRIBUTE LOOKUPS", 23, palette.mint, 700, 460)
        + text(1025, 434, "city = Paris", 29, palette.ink, 600, 460)
        + text(1025, 476, "[1, 6]", 28, palette.mint, 600, 460)
        + text(1025, 537, "cancellation = free", 29, palette.ink, 600, 460)
        + text(1025, 579, "[2, 3]     [8, 9]", 28, palette.ink, 500, 460)
        + text(1025, 644, "Only [2, 3] is inside [1, 6].", 26, palette.mint, 600, 460))
      + text(80, 733, "Is [2, 3] inside [1, 6]? Yes. Is [8, 9]? No. A few comparisons, no ID sets.", 27, palette.muted),
  },
  {
    file: "hackernoon-index-explosion", accent: "#f6bd70", number: "09",
    heading: ["Your data has 100 attributes.", "How many indexes do you need?"],
    sub: "A direct lookup for every attribute combination grows as 2ⁿ − 1.",
    title: "Combination lookups explode while per-attribute indexes grow linearly",
    description: "Left: one lookup per attribute combination needs 1,023 lookups for 10 attributes, 1,048,575 for 20, 1,073,741,823 for 30, and about 1.27 times 10 to the 30th for 100. Right: one index per attribute needs 10, 20, 30, and 100.",
    footer: "Counts nonempty attribute subsets. Per-attribute indexes still use memory.",
    draw: () => {
      const rows = [["10", "1,023", "10"], ["20", "1,048,575", "20"], ["30", "1,073,741,823", "30"], ["100", "≈ 1.27 × 10³⁰", "100"]];
      return card(80, 330, 680, 390,
        text(115, 378, "ONE LOOKUP PER COMBINATION", 23, "#f6bd70", 700, 610)
        + text(115, 425, "attributes", 22, palette.muted, 500, 160)
        + text(330, 425, "lookups", 22, palette.muted, 500, 380)
        + rows.map(([n, combos], i) => text(115, 487 + i * 62, n, 34, palette.ink, 600, 160)
          + text(330, 487 + i * 62, combos, 34, "#f6bd70", 700, 400)).join(""), "#f6bd70")
        + line(760, 525, 830, 525, palette.mint, true)
        + card(840, 330, 680, 390,
          text(875, 378, "ONE INDEX PER ATTRIBUTE", 23, palette.mint, 700, 610)
          + text(875, 425, "attributes", 22, palette.muted, 500, 160)
          + text(1090, 425, "indexes", 22, palette.muted, 500, 380)
          + rows.map(([n, , indexes], i) => text(875, 487 + i * 62, n, 34, palette.ink, 600, 160)
            + text(1090, 487 + i * 62, indexes, 34, palette.mint, 700, 380)).join(""), palette.mint);
    },
  },
  {
    file: "devto-filter-combinations", accent: "#7eb9ff", number: "10",
    heading: ["Your filter UI has 10 fields.", "That's 1,023 possible queries."],
    sub: "Index each field once. Combine the indexes at query time.",
    title: "Ten filter fields allow 1,023 combinations but need only ten per-field indexes",
    description: "A filter panel lists ten fields, with status, score, and tags selected. Users can pick 1,023 nonempty combinations of those fields, while the application maintains only ten per-field indexes.",
    footer: "2¹⁰ − 1 nonempty field subsets. Per-field indexes still use memory.",
    draw: () => {
      const fields = ["status", "score", "tags", "window", "city", "brand", "stars", "price", "region", "type"];
      const picked = new Set(["status", "score", "tags"]);
      return card(80, 330, 620, 390,
        text(110, 378, "FILTER PANEL", 23, "#7eb9ff", 700, 560)
        + fields.map((field, i) => {
          const x = 110 + Math.floor(i / 5) * 290;
          const y = 402 + (i % 5) * 62;
          const color = picked.has(field) ? palette.mint : palette.muted;
          return `<g data-box="${x} ${y} 260 52">${rect(x, y, 260, 52, "#132b3c", color, 12)}`
            + rect(x + 20, y + 16, 20, 20, picked.has(field) ? palette.mint : "none", color, 4)
            + text(x + 56, y + 35, field, 25, color, 600, 186) + "</g>";
        }).join(""))
        + line(700, 525, 790, 525, "#7eb9ff", true)
        + card(810, 330, 710, 390,
          text(845, 378, "COMBINATIONS A USER CAN PICK", 23, "#7eb9ff", 700, 640)
          + text(845, 470, "1,023", 84, "#f6bd70", 700, 640)
          + text(845, 560, "INDEXES YOU MAINTAIN, ONE PER FIELD", 23, "#7eb9ff", 700, 640)
          + text(845, 652, "10", 84, palette.mint, 700, 640), "#7eb9ff");
    },
  },
];

await mkdir(directory, { recursive: true });
const sources = [];
for (const item of artwork) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="840" viewBox="0 0 1600 840" role="img" aria-labelledby="title desc">
<title id="title">${escape(item.title)}</title><desc id="desc">${escape(item.description)}</desc>
<defs><marker id="arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L9 4.5 L0 9Z" fill="${item.accent}"/></marker></defs>
<rect width="1600" height="840" fill="${palette.background}"/>
<g font-family="Segoe UI, Arial, sans-serif">
${text(80, 65, "KiaraDB  /  QUERY NOTES", 22, item.accent, 700)}
${text(1444, 65, item.number, 24, palette.muted, 600, 80)}
${text(80, 150, item.heading[0], 62, palette.ink, 700, 1440)}
${text(80, 224, item.heading[1], 62, palette.ink, 700, 1440)}
${text(80, 278, item.sub, 28, palette.muted, 400, 1440)}
${item.draw()}
${line(80, 766, 1520, 766, palette.line)}
${text(80, 807, item.footer, 22, palette.muted, 400, 1440)}
</g></svg>`;
  sources.push(svg);
  await writeFile(new URL(`${item.file}.svg`, directory), svg + "\n");
}
const sheetHeight = 190 + Math.ceil(sources.length / 2) * 445 + 50;
const contactSheet = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="${sheetHeight}" viewBox="0 0 1600 ${sheetHeight}" role="img" aria-labelledby="sheet-title sheet-desc">
<title id="sheet-title">KiaraDB campaign contact sheet</title><desc id="sheet-desc">All ${artwork.length} article graphics arranged in a two-column grid.</desc>
<rect width="1600" height="${sheetHeight}" fill="${palette.background}"/>
<g font-family="Segoe UI, Arial, sans-serif">${text(60, 82, "KiaraDB / campaign graphics", 46, palette.ink, 700)}
${text(60, 133, "Article covers and an engine explainer.", 27, palette.muted)}</g>
${sources.map((svg, i) => svg.replace('width="1600" height="840"', `x="${60 + i % 2 * 760}" y="${190 + Math.floor(i / 2) * 445}" width="720" height="378"`)
    .replaceAll('id="title"', `id="title-${i}"`).replaceAll('id="desc"', `id="desc-${i}"`)
    .replace('aria-labelledby="title desc"', `aria-labelledby="title-${i} desc-${i}"`)
    .replaceAll('id="arrow"', `id="arrow-${i}"`).replaceAll("url(#arrow)", `url(#arrow-${i})`)).join("\n")}
</svg>`;
await writeFile(new URL("campaign-contact-sheet.svg", directory), contactSheet + "\n");
const gallery = `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>KiaraDB campaign graphics</title>
<style>
body{margin:0;padding:48px;background:#081426;color:#f2f6fc;font:18px "Segoe UI",sans-serif}
h1{margin:0 0 8px;font-size:38px}p{color:#afc2d7}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px}
figure{margin:0}img{display:block;width:100%;height:auto;border:1px solid #304963;border-radius:12px}
figcaption{padding:12px 0}a{color:#9caaff}@media(max-width:800px){main{grid-template-columns:1fr}}
</style><h1>KiaraDB / campaign graphics</h1><p>${artwork.length} original diagrams. 1600 x 840 PNG exports and editable SVG sources.</p><main>
${artwork.map(item => `<figure><img src="../images/${item.file}.png" alt="${escape(item.description)}"><figcaption>${item.number} / ${escape(item.title)} &middot; <a href="../images/${item.file}.png">PNG</a> &middot; <a href="../images/${item.file}.svg">SVG</a></figcaption></figure>`).join("\n")}
</main></html>`;
await writeFile(new URL("../articles/campaign/graphics.html", import.meta.url), gallery + "\n");
console.log(`Generated ${artwork.length} SVG graphics, a contact sheet, and the campaign gallery.`);
