import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mock, test } from "node:test";
import { Operator, createCondition } from "@kapoorlabs/kiara-ts";
import { buildStore, parseDatasetCsv } from "../src/datasets.ts";
import {
  PARTS_DEFINITION, PARTS_PRESETS, PartsFinder, partsExpression, replacePartsField,
} from "../src/parts-finder.ts";
import type { AnyRow } from "../src/query.ts";

const csv = readFileSync(new URL("../public/data/capacitors.csv", import.meta.url));
const data = parseDatasetCsv(PARTS_DEFINITION, csv.toString("utf8"));
const finder = new PartsFinder(buildStore(data));

test("the component CSV retains every source record, provenance hash and missing specifications", () => {
  assert.equal(data.rows.length, 16802);
  assert.equal(new Set(data.rows.map((row) => row.id)).size, 16802);
  assert.equal(PARTS_DEFINITION.fields.length, 22);
  assert.equal(PARTS_DEFINITION.fields.filter((field) => !field.options?.ignoreIndex).length, 18);
  assert.equal(createHash("sha256").update(csv).digest("hex"), "90081bc3bc9b597473ad7dda63b703acedbe1344a5aa095acb566d4d1d2c208c");
  const malformedSource = data.rows.find((row) => row.id === "C710944");
  assert.equal(malformedSource?.capacitance, null);
  assert.equal(malformedSource?.sourceCapacitance, "NaN");
  assert.ok(data.rows.some((row) => row.capacitance === null));
  assert.ok(data.rows.every((row) => typeof row.stock === "number" && row.stock >= 0));
  assert.ok(data.rows.some((row) => row.package === "0603"));
});

test("all presets resolve to real queries or deliberate explicit ambiguity", () => {
  for (const preset of PARTS_PRESETS) {
    const result = finder.evaluate(preset.input);
    if (preset.label === "Choose a field") {
      assert.equal(result.status, "blocked");
      assert.equal(result.interpretation.issues[0].kind, "ambiguous");
    } else {
      assert.equal(result.status, "ready", preset.label);
    }
  }
  const values = finder.evaluate("ceramic samsung X7R");
  assert.equal(values.status, "ready");
  if (values.status === "ready") {
    assert.ok(values.total > 50);
    assert.ok(values.rows.every((row) => row.manufacturer === "Samsung Electro-Mechanics" && row.dielectric === "X7R"));
  }
});

test("equivalent capacitance units give the same 272 exact matches and preserve generated conditions", () => {
  const first = finder.evaluate("cap:10uF voltage>=25V");
  const second = finder.evaluate("cap:10000nF voltage>=25V");
  assert.equal(first.status, "ready");
  assert.equal(second.status, "ready");
  if (first.status === "ready" && second.status === "ready") {
    assert.equal(first.total, 272);
    assert.equal(second.total, first.total);
    assert.deepEqual(second.rows, first.rows);
    assert.equal(first.rows.length, 50);
    assert.ok(first.rows.every((row) => row.capacitance === 0.00001 && Number(row.voltage) >= 25));
  }
  const range = finder.evaluate("cap:1uF..10uF voltage>=25V");
  assert.equal(range.status, "ready");
  if (range.status === "ready") {
    assert.equal(range.total, 1233);
    assert.ok(range.rows.every((row) => Number(row.capacitance) >= 1e-6 && Number(row.capacitance) <= 1e-5));
  }
});

test("units identify several real voltage fields and confirmations use the selected field", () => {
  const unresolved = finder.evaluate("25V");
  assert.equal(unresolved.status, "blocked");
  assert.deepEqual(unresolved.interpretation.issues[0].candidates.map((candidate) => candidate.field), [
    "voltage", "ratedVoltage", "acVoltage",
  ]);
  const resolved = finder.evaluate("25V", { "0:3": "voltage" });
  assert.equal(resolved.status, "ready");
  if (resolved.status === "ready") assert.ok(resolved.rows.every((row) => row.voltage === 25));
  const packageChoice = finder.evaluate("0603", { "0:4": "package" });
  assert.equal(packageChoice.status, "ready");
  if (packageChoice.status === "ready") assert.ok(packageChoice.rows.every((row) => row.package === "0603"));
});

test("unresolved and malformed fragments never produce partial-success results", () => {
  const search = mock.method(finder.interpreter, "search");
  try {
    for (const input of ["cap:10uF unknownword", "cap:10V", "0603", "voltage >= 25V"]) {
      const result = finder.evaluate(input);
      assert.equal(result.status, "blocked");
      assert.equal("rows" in result, false);
      assert.equal("total" in result, false);
    }
    assert.equal(search.mock.callCount(), 0);
  } finally {
    search.mock.restore();
  }
  const noMatches = finder.evaluate("stock<0");
  assert.equal(noMatches.status, "ready");
  if (noMatches.status === "ready") {
    assert.equal(noMatches.total, 0);
    assert.deepEqual(noMatches.rows, []);
  }
  const all = finder.evaluate("");
  assert.equal(all.status, "ready");
  if (all.status === "ready") {
    assert.equal(all.total, 16802);
    assert.equal(all.rows.length, 50);
  }
});

test("traditional field updates replace every constraint for that field without discarding other input", () => {
  const initial = finder.interpreter.interpret("voltage>=25V X7R voltage<=50V");
  const updated = replacePartsField(initial, "voltage", "voltage>=100V");
  const next = finder.interpreter.interpret(updated);
  assert.equal(next.issues.length, 0);
  assert.equal(next.filters.filter((filter) => filter.condition.field === "voltage").length, 1);
  assert.ok(next.filters.some((filter) => filter.condition.field === "dielectric"));
  const removed = replacePartsField(initial, "voltage", "");
  assert.equal(finder.interpreter.interpret(removed).filters.length, 1);
  const added = replacePartsField(finder.interpreter.interpret(""), "stock", "stock>1000");
  assert.equal(added, "stock>1000");
  const unknown = replacePartsField(finder.interpreter.interpret("notaword"), "stock", "stock>1000");
  assert.equal(finder.evaluate(unknown).status, "blocked");
});

test("chip expressions serialize comparisons, quoted text, booleans and ranges without changing their meaning", () => {
  for (const input of [
    "stock=100", "stock!=100", "stock<100", "stock<=100", "stock>100", "stock>=100",
    "manufacturer:\"Samsung Electro-Mechanics\"", "cap:1uF..10uF",
  ]) {
    const condition = finder.interpreter.interpret(input).filters[0].condition;
    assert.deepEqual(finder.interpreter.interpret(partsExpression(condition)).filters[0].condition, condition);
  }
  assert.equal(partsExpression(createCondition<AnyRow, string>({ field: "available", values: [true] })), "available=true");
  for (const value of [undefined, null, Infinity, NaN]) {
    assert.throws(() => partsExpression(createCondition<AnyRow, string>({ field: "stock", values: [value] })), /finite/);
  }
  assert.throws(() => partsExpression(createCondition<AnyRow, string>({
    field: "stock", operator: Operator.CONTAINS_ALL, values: [1],
  })), /Unsupported/);
});
