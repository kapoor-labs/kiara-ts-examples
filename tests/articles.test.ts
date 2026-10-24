import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import {
  Store, NormalizationProfile, QueryInterpreter,
  defineSchema, textField, numberField,
} from "@kapoorlabs/kiara-ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const articlesDirectory = resolve(root, "articles");
const articles = readdirSync(articlesDirectory).filter((file) => file.endsWith(".md"));
const readme = readFileSync(resolve(root, "README.md"), "utf8");

for (const file of articles) {
  const articlePath = resolve(articlesDirectory, file);
  const article = readFileSync(articlePath, "utf8");
  const javascript = [...article.matchAll(/```javascript\r?\n([\s\S]*?)```/g)];
  const typescript = [...article.matchAll(/```typescript\r?\n([\s\S]*?)```/g)];
  const code = javascript.length ? javascript : typescript;

  if (code.length) {
    test(`article snippets reproduce the published output: ${file}`, () => {
      assert.ok(!(javascript.length && typescript.length), "Run one snippet language per article.");
      const expected = [...article.matchAll(/```json\r?\n([\s\S]*?)```/g)];
      assert.ok(expected.length, "Runnable examples must include expected JSON.");
      const args = typescript.length
        ? ["--experimental-strip-types", "--input-type=module-typescript"]
        : ["--input-type=module"];
      const result = spawnSync(process.execPath, args, {
        cwd: root, input: code.map((block) => block[1]).join("\n\n"),
        encoding: "utf8", timeout: 30_000,
      });
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(
        result.stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line)),
        expected.map((block) => JSON.parse(block[1])),
      );
    });
  }

  test(`campaign structure and image output: ${file}`, () => {
    const title = article.match(/^# (.+)$/m)?.[1];
    assert.ok(title);
    assert.equal((article.match(/^# /gm) ?? []).length, 1);
    assert.ok(readme.includes(`${title}](./articles/${file})`), "README title must match.");
    assert.equal((article.match(/^```/gm) ?? []).length % 2, 0);

    const images = [...article.matchAll(/!\[([^\]]+)\]\((\.\/images\/[^)]+\.png)\)/g)];
    const image = images[0];
    assert.ok(image, "Every campaign article needs an accessible PNG cover.");
    const story = article.slice(article.search(/^# /m));
    const opening = story.slice(story.indexOf("\n") + 1, story.indexOf(image[0])).trim();
    if (file.includes("hackernoon") || file.includes("devto")) {
      assert.doesNotMatch(`${title}\n${opening}`, /KiaraDB/, "Lead with the problem, not the product.");
    } else {
      assert.ok(opening.includes("KiaraDB"), "Explain the mechanism before the image.");
    }
    assert.ok(opening.split(/\s+/).length <= 70, "The opening must earn attention quickly.");
    assert.ok(story.split("\n").slice(0, 10).join("\n").includes(opening));
    const proseWords = story.replace(/```[\s\S]*?```/g, "").trim().split(/\s+/).length;
    const limit = file.includes("linkedin") ? 420 : file.includes("hackernoon") || file.includes("devto") ? 1300 : 1050;
    assert.ok(proseWords <= limit, "Keep the article concise.");

    for (const graphic of images) {
      const png = readFileSync(resolve(articlesDirectory, graphic[2]));
      assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
      assert.equal(png.readUInt32BE(16), 1600);
      assert.equal(png.readUInt32BE(20), 840);
      const svg = readFileSync(resolve(articlesDirectory, graphic[2].replace(/\.png$/, ".svg")), "utf8");
      assert.match(svg, /<title\b/);
      assert.match(svg, /<desc\b/);
      assert.match(svg, /viewBox="0 0 1600 840"/);
    }
  });
}

test("DEV tutorial works backward from the filter problem to a buildable algorithm", () => {
  const article = readFileSync(resolve(articlesDirectory, "kiaradb-composable-filters-devto.md"), "utf8");
  const order = [
    "## Same wall, two companies",
    "## How many indexes do 1,023 combinations need?",
    "## Why not just use the database, then?",
    "## The idea in two sentences",
    "## Run it: one prepared store, many filter combinations",
    "## Beyond filters: words, typos, and bare values",
    "## Build the core trick yourself",
    "## Does it beat intersecting ID sets?",
    "## When to reach for it",
  ].map((heading) => article.indexOf(heading));
  assert.ok(order.every((position, i) => position > 0 && (i === 0 || position > order[i - 1])));
  assert.match(article, /for three reasons:/);
  assert.match(article, /3\. \*\*Search features that live with the data\.\*\*/);
  assert.match(article, /Databases offer full-text search too/, "Do not imply databases lack text search.");
  assert.match(article, /\{"typeahead":\["wired","wireless"\],"stemmed":\["k1","k2"\],"typo":\["k1"\],"corrected":\{"wirelss":"wireless"\},"byValue":\["k1"\]\}/);
  assert.doesNotMatch(article, /\bRedis\b/i);
  assert.match(article, /\(https:\/\/www\.postgresql\.org\/docs\/current\/indexes-bitmap-scans\.html\)/);
  assert.match(article, /exact key lookup/, "Scope the explosion to exact-key designs.");
  assert.match(article, /not compressed bitmaps/, "Do not overstate the benchmark baseline.");
  const binomial = (n: number, k: number) => {
    let result = 1;
    for (let i = 1; i <= k; i++) result = (result * (n - k + i)) / i;
    return result;
  };
  // Prefix-only composite indexes: a symmetric chain decomposition covers every subset with C(n, n/2) chains.
  const prefixIndexes = (n: number) => {
    let chains: number[][][] = [[[]]];
    for (let field = 0; field < n; field++) {
      chains = chains.flatMap((chain) => {
        const extended = [...chain, [...chain[chain.length - 1], field]];
        return chain.length > 1 ? [extended, chain.slice(0, -1).map((set) => [...set, field])] : [extended];
      });
    }
    const covered = new Set(chains.flat().filter((set) => set.length).map((set) => set.join(",")));
    assert.equal(covered.size, 2 ** n - 1);
    return chains.length;
  };
  assert.equal(prefixIndexes(10), binomial(10, 5));
  assert.equal(binomial(10, 5), 252);
  assert.equal(binomial(20, 10), 184_756);
  for (const row of ["| 1,023 | 1,048,575 |", "| 252 | 184,756 |", "| 10 | 20 |"]) {
    assert.ok(article.includes(row), `Index-strategy table row: ${row}`);
  }
  assert.match(article, /global\s+travel\s+company/);
  assert.match(article, /global\s+e-commerce\s+company/);
  assert.match(article, /\*Disclosure: This article was drafted with AI assistance\.\*/);
  assert.ok(article.indexOf("KiaraDB") > order[2], "Introduce KiaraDB after the problem.");
  assert.match(article, /https:\/\/journal\.ut\.ac\.ir\/article_76227_7508c12200be2eb3f9f16a97aac23a44\.pdf/);
  assert.match(article, /\.\/images\/devto-filter-combinations\.png/);
  assert.match(article, /\.\/images\/hackernoon-trie-bounds\.png/);
  assert.match(article, /\{"paris":\[\[1,6\]\],"free":\[\[2,3\],\[8,9\]\],"result":\["h1","h2"\]\}/);
  const diagram = readFileSync(resolve(articlesDirectory, "images", "hackernoon-trie-bounds.svg"), "utf8");
  for (const label of ["Paris [1, 6]", "free [2, 3]", "free [8, 9]", "Rome [7, 10]"]) {
    assert.ok(diagram.includes(label), `The diagram must match the toy output: ${label}`);
  }
  assert.equal(2 ** 5 - 1, 31);
});

test("HackerNoon Story Settings fields fit the editor's guidance", () => {
  const article = readFileSync(resolve(articlesDirectory, "kiaradb-local-search-hackernoon.md"), "utf8");
  const title = article.search(/^# /m);
  const section = (heading: string) => {
    const start = article.indexOf(`## ${heading}\n`) >= 0 ? article.indexOf(`## ${heading}\n`) : article.indexOf(`## ${heading}\r\n`);
    assert.ok(start >= 0 && start < title, `${heading} must precede the story title.`);
    const end = article.slice(start + 3).search(/^(## |---)/m) + start + 3;
    return article.slice(start, end).split(/\r?\n/).slice(1)
      .filter((line) => line.trim() && !line.startsWith("*HackerNoon Story Settings")).join(" ").trim();
  };
  const meta = section("Meta description");
  assert.ok(meta.length >= 150 && meta.length <= 160, `Meta description is ${meta.length} characters.`);
  const tldr = section("TL;DR");
  assert.ok(tldr.length >= 300 && tldr.length <= 500, `TL;DR is ${tldr.length} characters.`);
  const tags = [...section("Story Tags").matchAll(/`([a-z0-9-]+)`/g)].map((match) => match[1]);
  assert.deepEqual(tags, [
    "database", "data-structures", "algorithms", "system-design",
    "software-architecture", "java", "typescript", "performance",
  ]);
  const indicators = section("Emoji Credibility Indicator");
  for (const required of ["Vested Interest", "AI-assisted", "Academic Research Paper"]) {
    assert.ok(indicators.includes(`**${required}**`), `Select ${required}.`);
  }
});

test("HackerNoon works backward from the indexing problem to the algorithm and code", () => {
  const article = readFileSync(resolve(articlesDirectory, "kiaradb-local-search-hackernoon.md"), "utf8")
    .replace(/^[\s\S]*?(?=^# )/m, "");
  const order = [
    "## I kept hitting the same wall",
    "## Why one lookup per combination doesn't scale",
    "## What databases do instead",
    "## The idea in two sentences",
    "## In Java",
    "## In TypeScript",
    "## Under the hood: the algorithm",
    "## Is it faster than intersecting ID sets?",
    "## Where it fits, and where it doesn't",
  ].map((heading) => article.indexOf(heading));
  assert.ok(order.every((position, i) => position > 0 && (i === 0 || position > order[i - 1])));
  assert.doesNotMatch(article, /\bRedis\b/i);
  for (const row of ["| 10 | 1,023 | 252 |", "| 20 | 1,048,575 | 184,756 |", "| 30 | 1,073,741,823 | 155,117,520 |"]) {
    assert.ok(article.includes(row), `Exact-key versus composite-index row: ${row}`);
  }
  assert.match(article, /\(https:\/\/www\.postgresql\.org\/docs\/current\/indexes-bitmap-scans\.html\)/);
  assert.match(article, /right answer/, "Concede that per-attribute indexes suit most applications.");
  assert.match(article, /not compressed bitmaps/, "Do not overstate the benchmark baseline.");
  assert.doesNotMatch(article, /a million IDs|hundreds of thousands of record IDs/);
  assert.equal((article.match(/400,000/g) ?? []).length >= 2, true);
  assert.match(article, /global travel company/);
  assert.match(article, /global e-commerce company/);
  assert.ok(article.indexOf("KiaraDB") > order[2], "Introduce KiaraDB after the problem.");
  assert.match(article, /```java\r?\n[\s\S]*?new StoreSearch\(\)/);
  assert.match(article, /```typescript\r?\n/);
  assert.match(article, /private String id;\r?\n\s+\/\/ constructors/, "Unique IDs belong in the last trie level.");
  assert.match(article, /https:\/\/journal\.ut\.ac\.ir\/article_76227_7508c12200be2eb3f9f16a97aac23a44\.pdf/);
  assert.match(article, /\.\/images\/hackernoon-trie-bounds\.png/);
  assert.equal(2 ** 10 - 1, 1023);
  assert.equal(2 ** 20 - 1, 1_048_575);
  assert.equal(2 ** 30 - 1, 1_073_741_823);
  assert.equal(100 + (100 * 99) / 2 + (100 * 99 * 98) / 6, 166_750);
  assert.equal((2 ** 100 / 1e30).toFixed(2), "1.27");

  const hotels = new Store(defineSchema([
    textField("city"), textField("brand"), numberField("stars"),
    numberField("price"), textField("cancellation"), textField("id"),
  ]), { normalizationProfile: NormalizationProfile.NATIVE });
  hotels.loadRows([
    { city: "Paris", brand: "Acme", stars: 4, price: 180, cancellation: "free", id: "h1" },
    { city: "Paris", brand: "Zenith", stars: 5, price: 320, cancellation: "free", id: "h2" },
    { city: "Paris", brand: "Acme", stars: 3, price: 120, cancellation: "none", id: "h3" },
    { city: "Rome", brand: "Acme", stars: 4, price: 150, cancellation: "free", id: "h4" },
    { city: "Paris", brand: "Zenith", stars: 4, price: 190, cancellation: "none", id: "h5" },
  ]);
  hotels.prepare();
  const walkthrough = hotels.search([
    { field: "city", operator: "EQUAL", values: ["Paris"] },
    { field: "cancellation", operator: "EQUAL", values: ["free"] },
  ]).map((hotel) => hotel.id);
  assert.deepEqual(walkthrough, ["h1", "h2"]);
  assert.match(article, /h1 and h2 are\r?\nreturned/);
});

test("short article queries discover values and preserve strict constraints", () => {
  const store = new Store(defineSchema([
    textField("id", { ignoreIndex: true }), textField("status"), textField("region"),
    numberField("score"),
  ]), { normalizationProfile: NormalizationProfile.NATIVE });
  store.loadRows([
    { id: "a", status: "active", region: "emea", score: 90 },
    { id: "b", status: "active", region: "amer", score: 70 },
    { id: "c", status: "archived", region: "emea", score: 95 },
  ]);
  store.prepare();
  const interpreter = new QueryInterpreter(store);
  for (const input of ["active emea", "active score>=80", "status:active score>=80"]) {
    assert.deepEqual(interpreter.search(input).map((row) => row.id), ["a"]);
  }
  assert.throws(() => interpreter.search("active unknownword"));
});

test("campaign local Markdown links resolve", () => {
  const documents = [
    resolve(root, "README.md"),
    ...articles.map((file) => resolve(articlesDirectory, file)),
    ...readdirSync(resolve(articlesDirectory, "campaign"))
      .filter((file) => file.endsWith(".md"))
      .map((file) => resolve(articlesDirectory, "campaign", file)),
  ];
  for (const document of documents) {
    const text = readFileSync(document, "utf8");
    for (const match of text.matchAll(/\]\((\.{1,2}\/[^)#]+)(?:#[^)]*)?\)/g)) {
      assert.ok(existsSync(resolve(dirname(document), match[1])), `${document}: ${match[1]}`);
    }
  }
});
