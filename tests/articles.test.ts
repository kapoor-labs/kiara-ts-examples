import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import {
  Store, NormalizationProfile, QueryInterpreter, defineSchema, textField, numberField,
} from "@kapoorlabs/kiara-ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const articlesDirectory = resolve(root, "articles");
const articles = readdirSync(articlesDirectory).filter((file) => file.endsWith(".md"));
const readme = readFileSync(resolve(root, "README.md"), "utf8");

for (const file of articles) {
  const articlePath = resolve(articlesDirectory, file);
  const article = readFileSync(articlePath, "utf8");
  const code = [...article.matchAll(/```javascript\r?\n([\s\S]*?)```/g)];

  if (code.length) {
    test(`article snippets reproduce the published output: ${file}`, () => {
      assert.equal(code.length, 1);
      const expected = article.match(/```json\r?\n([\s\S]*?)```/);
      assert.ok(expected, "Runnable examples must include expected JSON.");
      const result = spawnSync(process.execPath, ["--input-type=module"], {
        cwd: root, input: code[0][1], encoding: "utf8", timeout: 30_000,
      });
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), JSON.parse(expected[1]));
    });
  }

  test(`campaign structure and image output: ${file}`, () => {
    const title = article.match(/^# (.+)$/m)?.[1];
    assert.ok(title);
    assert.equal((article.match(/^# /gm) ?? []).length, 1);
    assert.ok(readme.includes(`${title}](./articles/${file})`), "README title must match.");
    assert.equal((article.match(/^```/gm) ?? []).length % 2, 0);

    const image = article.match(/!\[([^\]]+)\]\((\.\/images\/[^)]+\.png)\)/);
    assert.ok(image, "Every campaign article needs an accessible PNG cover.");
    const opening = article.slice(article.indexOf("\n") + 1, image.index).trim();
    assert.ok(opening.includes("KiaraDB"), "Explain the mechanism before the image.");
    assert.ok(opening.split(/\s+/).length <= 70, "The opening must earn attention quickly.");
    assert.ok(article.split("\n").slice(0, 10).join("\n").includes(opening));
    const proseWords = article.replace(/```[\s\S]*?```/g, "").trim().split(/\s+/).length;
    assert.ok(proseWords <= (file.includes("linkedin") ? 420 : 1050), "Keep the article concise.");

    const png = readFileSync(resolve(articlesDirectory, image[2]));
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), 1600);
    assert.equal(png.readUInt32BE(20), 840);
    const svg = readFileSync(resolve(articlesDirectory, image[2].replace(/\.png$/, ".svg")), "utf8");
    assert.match(svg, /<title\b/);
    assert.match(svg, /<desc\b/);
    assert.match(svg, /viewBox="0 0 1600 840"/);
  });
}

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
