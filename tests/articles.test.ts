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
    const opening = article.slice(article.indexOf("\n") + 1, image.index).trim();
    if (file.includes("hackernoon")) {
      assert.doesNotMatch(`${title}\n${opening}`, /KiaraDB/, "Lead with the problem, not the product.");
    } else {
      assert.ok(opening.includes("KiaraDB"), "Explain the mechanism before the image.");
    }
    assert.ok(opening.split(/\s+/).length <= 70, "The opening must earn attention quickly.");
    assert.ok(article.split("\n").slice(0, 10).join("\n").includes(opening));
    const proseWords = article.replace(/```[\s\S]*?```/g, "").trim().split(/\s+/).length;
    const limit = file.includes("linkedin") ? 420 : file.includes("hackernoon") ? 1300 : 1050;
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

test("HackerNoon works backward from the indexing problem to the algorithm and code", () => {
  const article = readFileSync(resolve(articlesDirectory, "kiaradb-local-search-hackernoon.md"), "utf8");
  const order = [
    "## I kept hitting the same wall",
    "## Why one lookup per combination doesn't scale",
    "## The obvious fix, and why it still hurts",
    "## The idea in two sentences",
    "## In Java",
    "## In TypeScript",
    "## Under the hood: the algorithm",
    "## Is it actually faster than intersecting indexes?",
    "## Where it fits, and where it doesn't",
  ].map((heading) => article.indexOf(heading));
  assert.ok(order.every((position, i) => position > 0 && (i === 0 || position > order[i - 1])));
  assert.doesNotMatch(article, /\bRedis\b/i);
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
