// Compares KiaraDB with Fuse.js on every KiaraDB search feature and the scenarios Fuse.js can express.
// Usage: npm run bench:fuse
// Env: BENCH_DATASETS (comma list), BENCH_RUNS (default 3), BENCH_BUDGET_MS (default 1000).
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { loadDataset } from "./fuse-benchmark/datasets.mjs";
import { ENGINES, createMatcher, describe } from "./fuse-benchmark/engines.mjs";

const DEFAULT_DATASETS = "retail-3788,catalog-10000,catalog-100000,schedule-10000,schedule-100000";

// Fuse.js 7.5.0 capabilities with no KiaraDB equivalent (not benchmarked).
const FUSE_ONLY_FEATURES = [
  { category: "Text search", feature: "Adjustable fuzzy matching: several typos, swapped letters, partial words" },
  { category: "Text search", feature: "Matching inside words, at the start or end of a field, and their negations" },
  { category: "Text search", feature: "Ignoring accents (ignoreDiacritics)" },
  { category: "Text search", feature: "Relevance scores and word-frequency (BM25-style) ranking" },
  { category: "Text search", feature: "Weighted fields" },
  { category: "Text search", feature: "Match highlighting (character positions)" },
  { category: "Text search", feature: "Custom word splitting, including Chinese, Japanese, and Thai" },
  { category: "Query structure", feature: "OR across fields and nested AND/OR" },
  { category: "Data and lifecycle", feature: "Add and remove records without rebuilding" },
  { category: "Data and lifecycle", feature: "Save a built index and reload it" },
  { category: "Data and lifecycle", feature: "Nested fields and computed values" },
  { category: "Data and lifecycle", feature: "Search split across several Web Workers" },
];
const WARMUP = 3;
const MIN_ITERATIONS = 5;
const MAX_ITERATIONS = 200;

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const geometricMean = (values) => Math.exp(values.reduce((sum, value) => sum + Math.log(value), 0) / values.length);

function heapMb() {
  globalThis.gc?.();
  return process.memoryUsage().heapUsed / 1024 / 1024;
}

function worker(datasetName, engineName, budgetMs) {
  const dataset = loadDataset(datasetName);
  const matches = createMatcher(dataset);
  const baseline = heapMb();
  const engine = ENGINES[engineName].build(dataset);
  const retainedMb = heapMb() - baseline;
  const workloads = {};
  for (const workload of dataset.workloads) {
    const first = engine.run(workload);
    if (!first) {
      workloads[workload.id] = { supported: false };
      continue;
    }
    for (let i = 1; i < WARMUP; i++) engine.run(workload);
    const durations = [];
    const started = performance.now();
    while (durations.length < MAX_ITERATIONS
      && (durations.length < MIN_ITERATIONS || performance.now() - started < budgetMs)) {
      const start = performance.now();
      engine.run(workload);
      durations.push(performance.now() - start);
    }
    durations.sort((a, b) => a - b);
    workloads[workload.id] = {
      supported: true,
      iterations: durations.length,
      p50: percentile(durations, 0.5),
      p95: percentile(durations, 0.95),
      result: describe(workload, first, dataset, matches),
    };
  }
  return { phases: engine.phases, retainedMb, workloads };
}

function packageVersion(name) {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`../node_modules/${name}/package.json`, import.meta.url)), "utf8")).version;
}

function formatMs(value) {
  if (value === undefined) return "—";
  return value < 1 ? value.toFixed(3) : value < 100 ? value.toFixed(2) : value.toFixed(0);
}

const formatRatio = (value) => (value === undefined ? "—" : value >= 10 ? `${value.toFixed(0)}×` : `${value.toFixed(1)}×`);
const percent = (value) => `${Math.round(value * 100)}%`;

function main() {
  const datasets = (process.env.BENCH_DATASETS ?? DEFAULT_DATASETS).split(",");
  const runs = Number(process.env.BENCH_RUNS ?? 3);
  const budgetMs = Number(process.env.BENCH_BUDGET_MS ?? 1000);
  const engineNames = Object.keys(ENGINES);
  const raw = {};
  for (let run = 0; run < runs; run++) {
    for (const datasetName of datasets) {
      // Rotate engine order per run so no engine always runs first or last.
      for (const engineName of engineNames.map((_, i) => engineNames[(i + run) % engineNames.length])) {
        const child = spawnSync(process.execPath, ["--expose-gc", fileURLToPath(import.meta.url), "--worker", datasetName, engineName, String(budgetMs)], {
          encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
        });
        if (child.status !== 0) throw new Error(`${datasetName}/${engineName} failed:\n${child.stderr}`);
        ((raw[datasetName] ??= {})[engineName] ??= []).push(JSON.parse(child.stdout));
        process.stderr.write(`run ${run + 1}/${runs} ${datasetName} ${engineName} done\n`);
      }
    }
  }

  const failures = [];
  const summary = {};
  for (const datasetName of datasets) {
    const dataset = loadDataset(datasetName);
    const engines = {};
    for (const engineName of engineNames) {
      const samples = raw[datasetName][engineName];
      const phases = Object.fromEntries(Object.keys(samples[0].phases).map((name) => [name, median(samples.map((s) => s.phases[name]))]));
      const workloads = {};
      for (const workload of dataset.workloads) {
        const perRun = samples.map((s) => s.workloads[workload.id]);
        if (!perRun[0].supported) {
          workloads[workload.id] = { supported: false };
          continue;
        }
        if (new Set(perRun.map((r) => JSON.stringify(r.result))).size !== 1) {
          failures.push(`${datasetName}/${engineName}/${workload.id}: results differ between runs`);
        }
        const result = perRun[0].result;
        if (workload.kind === "exact" && !result.valid) {
          failures.push(`${datasetName}/${engineName}/${workload.id}: returned records that do not match the reference semantics`);
        }
        if (workload.kind === "exact" && engineName === "kiara" && !result.sourceOrder) {
          failures.push(`${datasetName}/kiara/${workload.id}: results are not in source order`);
        }
        workloads[workload.id] = {
          supported: true,
          p50: median(perRun.map((r) => r.p50)),
          p95: median(perRun.map((r) => r.p95)),
          iterations: perRun.map((r) => r.iterations),
          result,
        };
      }
      engines[engineName] = {
        phases,
        buildMs: Object.values(phases).reduce((sum, ms) => sum + ms, 0),
        retainedMb: Math.max(0, median(samples.map((s) => s.retainedMb))),
        workloads,
      };
    }
    summary[datasetName] = { description: dataset.description, records: dataset.rows.length, workloads: dataset.workloads, engines };
  }

  const environment = {
    node: process.version,
    platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    cpu: os.cpus()[0]?.model.trim() ?? "unknown",
    kiara: packageVersion("@kapoorlabs/kiara-ts"),
    fuse: packageVersion("fuse.js"),
    runs,
    budgetMs,
    date: new Date().toISOString(),
  };
  const outDir = fileURLToPath(new URL("../benchmarks/", import.meta.url));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(`${outDir}fuse-comparison.json`, `${JSON.stringify({ environment, summary, raw, failures }, null, 2)}\n`);
  writeFileSync(fileURLToPath(new URL("../docs/fuse-comparison.md", import.meta.url)), renderMarkdown(environment, summary, engineNames));
  console.log("Wrote benchmarks/fuse-comparison.json and docs/fuse-comparison.md");
  if (failures.length) {
    console.error(`Agreement failures:\n${failures.join("\n")}`);
    process.exitCode = 1;
  }
}

/** Geometric-mean p50 speedup of KiaraDB over another engine across workloads both support. */
function speedup(data, other, kinds) {
  const ratios = data.workloads
    .filter((workload) => kinds.includes(workload.kind))
    .map((workload) => [data.engines.kiara.workloads[workload.id], data.engines[other].workloads[workload.id]])
    .filter(([kiara, peer]) => kiara.supported && peer.supported)
    .map(([kiara, peer]) => peer.p50 / kiara.p50);
  return ratios.length ? { ratio: geometricMean(ratios), count: ratios.length } : undefined;
}

function resultText(workload, data, engineNames) {
  const engines = data.engines;
  const supported = engineNames.filter((name) => engines[name].workloads[workload.id].supported);
  if (workload.kind === "exact") {
    const { total, count } = engines.kiara.workloads[workload.id].result;
    if (!workload.limit || total <= workload.limit) {
      return `${count.toLocaleString("en-US")} records, verified for ${supported.length === 1 ? "KiaraDB" : "every engine"}`;
    }
    const fuse = supported.includes("fuse") ? "; Fuse.js: valid matches in score order" : "";
    return `first ${count} of ${total.toLocaleString("en-US")}, KiaraDB in source order${fuse}`;
  }
  return supported.map((name) => {
    const result = engines[name].workloads[workload.id].result;
    const label = ENGINES[name].label;
    if (workload.kind === "correction") return `${label}: "${result.word}" ${result.correct ? "(expected)" : `(expected "${workload.expected}")`}`;
    if (workload.kind === "prefix") return `${label}: ${result.count} ${result.count === 1 ? result.unit.replace(/s$/, "") : result.unit}, ${percent(result.precision)}`;
    const quality = [
      result.precision !== undefined ? percent(result.precision) : null,
      result.filterRespected !== undefined ? `filters ${percent(result.filterRespected)}` : null,
    ].filter(Boolean).join(", ");
    return `${label}: ${result.count}${quality ? ` (${quality})` : ""}`;
  }).join("; ");
}

function renderMarkdown(environment, summary, engineNames) {
  const labels = engineNames.map((name) => ENGINES[name].label);
  const lines = [
    "# KiaraDB and Fuse.js comparison benchmark",
    "",
    "Generated by `npm run bench:fuse` from [scripts/benchmark-fuse.mjs](../scripts/benchmark-fuse.mjs).",
    "Raw per-run results: [benchmarks/fuse-comparison.json](../benchmarks/fuse-comparison.json).",
    "",
    `Environment: Node ${environment.node}, ${environment.platform}, ${environment.cpu}. `
      + `KiaraDB ${environment.kiara}, Fuse.js ${environment.fuse}. `
      + `${environment.runs} isolated process runs per dataset and engine, ${environment.date.slice(0, 10)}.`,
    "",
    "## Summary",
    "",
    "Latency ratios are geometric means of Fuse.js p50 divided by KiaraDB p50, over the scenarios both can run (above 1× means KiaraDB answered faster).",
    "Ranked text search covers typo, filtered typo, and stemming queries; as-you-type is excluded because the engines return different things.",
    "",
    "| Dataset | Exact scenarios Fuse.js can run | Latency ratio, exact | Latency ratio, ranked text | Build: KiaraDB / Fuse.js | Retained heap: KiaraDB / Fuse.js |",
    "|---|---:|---:|---:|---:|---:|",
  ];
  for (const [name, data] of Object.entries(summary)) {
    const cell = (value) => (value ? `${formatRatio(value.ratio)} (${value.count})` : "—");
    const kiara = data.engines.kiara;
    const fuse = data.engines.fuse;
    const exact = data.workloads.filter((workload) => workload.kind === "exact");
    const runnable = exact.filter((workload) => fuse.workloads[workload.id].supported).length;
    lines.push(`| ${name} | ${runnable} of ${exact.length} | ${cell(speedup(data, "fuse", ["exact"]))} | `
      + `${cell(speedup(data, "fuse", ["fuzzy"]))} | ${formatMs(kiara.buildMs)} / ${formatMs(fuse.buildMs)} ms | `
      + `${kiara.retainedMb.toFixed(1)} / ${fuse.retainedMb.toFixed(1)} MB |`);
  }

  const features = new Map();
  for (const data of Object.values(summary)) {
    for (const workload of data.workloads) {
      const entry = features.get(workload.feature) ?? { category: workload.category, engines: new Set(), benchmarked: true };
      for (const name of ["kiara", "fuse"]) {
        if (data.engines[name].workloads[workload.id].supported) entry.engines.add(name);
      }
      features.set(workload.feature, entry);
    }
  }
  for (const { category, feature } of FUSE_ONLY_FEATURES) {
    features.set(feature, { category, engines: new Set(["fuse"]), benchmarked: false });
  }
  lines.push("", "## Feature coverage", "",
    "Benchmarked features come from the scenarios below. The remaining rows are Fuse.js 7.5.0 capabilities that KiaraDB",
    "does not offer, from the Fuse.js API; the text-matching ones are verified by `tests/fuse-benchmark.test.ts`.",
    "",
    "| Category | Feature | KiaraDB | Fuse.js | Benchmarked |", "|---|---|:---:|:---:|:---:|");
  for (const [feature, entry] of [...features].sort((a, b) => a[1].category.localeCompare(b[1].category))) {
    const mark = (name) => (entry.engines.has(name) ? "yes" : "no");
    lines.push(`| ${entry.category} | ${feature} | ${mark("kiara")} | ${mark("fuse")} | ${entry.benchmarked ? "yes" : "no"} |`);
  }
  lines.push("",
    "## Method",
    "",
    "- **Exact scenarios** have one correct answer, defined by an independent, untimed plain-JavaScript implementation of KiaraDB's",
    "  documented semantics (for example, list `NOT_CONTAINS` keeps missing lists; range `NOT_CONTAINS` excludes missing ranges).",
    "  The run fails if any engine returns a wrong record. With a result limit, KiaraDB must return exactly the first",
    "  matches in source order; Fuse.js returns its best-scored matches, which must be valid and complete in number.",
    "- **Fuse.js** runs a scenario only when it can express it exactly: quoted extended-search equality (`=\"value\"`),",
    "  several values through `$or`, list membership on array keys, and all-of through `$and`. Dates are matched as strings.",
    "  It has no numeric comparisons, ranges, null tests, exact list or range exclusions, query interpretation, minimum match, or dictionary correction.",
    "- **Text scenarios** rank differently in each engine. Quality is the share of returned records whose title contains every",
    "  intended word (case-insensitive substring). With hard filters, the share of results satisfying them is also reported.",
    "  As-you-type returns completed **words** from KiaraDB and matching **records** from Fuse.js.",
    "- **Fuse.js (tuned)** adds `ignoreLocation: true` and, for text search, extended search that ANDs whitespace-separated fuzzy tokens.",
    "- Latency is the median, across runs, of each run's p50 and p95 after three warmup queries.",
    "  Build time covers index construction only. KiaraDB's lazily built keyword postings are measured as their own phase.",
    "  Retained heap is the growth after building, measured with forced garbage collection.",
    "");

  for (const [name, data] of Object.entries(summary)) {
    lines.push(`## ${name}`, "", `${data.description}.`, "", "### Build", "",
      "| Engine | Build phases (ms) | Total build | Retained heap |", "|---|---|---:|---:|");
    for (const engineName of engineNames) {
      const engine = data.engines[engineName];
      const phases = Object.entries(engine.phases).map(([phase, ms]) => `${phase} ${formatMs(ms)}`).join(", ");
      lines.push(phases
        ? `| ${ENGINES[engineName].label} | ${phases} | ${formatMs(engine.buildMs)} ms | ${engine.retainedMb.toFixed(1)} MB |`
        : `| ${ENGINES[engineName].label} | no index | — | — |`);
    }
    const categories = [...new Set(data.workloads.map((workload) => workload.category))];
    lines.push("", "### Queries (p50 / p95, ms)");
    for (const category of categories) {
      lines.push("", `#### ${category}`, "", `| Scenario | ${labels.join(" | ")} | Result check |`, `|---|${labels.map(() => "---:").join("|")}|---|`);
      for (const workload of data.workloads.filter((w) => w.category === category)) {
        const cells = engineNames.map((engineName) => {
          const result = data.engines[engineName].workloads[workload.id];
          return result.supported ? `${formatMs(result.p50)} / ${formatMs(result.p95)}` : "—";
        });
        lines.push(`| ${workload.label} | ${cells.join(" | ")} | ${resultText(workload, data, engineNames)} |`);
      }
    }
    lines.push("");
  }

  const caveats = [
    "- One machine, synthetic and historical data, single-threaded Node.js. Measure your own data and queries.",
    "- `—` means the engine cannot express the scenario exactly; it is not counted in any latency ratio.",
    "- Fuse.js ranks by configurable fuzzy relevance; the text quality metric is deliberately simple.",
    "- KiaraDB's keyword score counts raw and stemmed token matches, so a plural query can rank exact plural titles above singular ones.",
    "- KiaraDB's one-edit correction picks the alphabetically first candidate, not the most frequent word.",
  ];
  const retailTypo = summary["retail-3788"]?.engines.kiara.workloads.typo;
  if (retailTypo?.supported && retailTypo.result.precision < 0.5) {
    caveats.push("  On the retail data, `holdr` is corrected to the source abbreviation `hldr` instead of `holder`, which lowers its typo-search score.");
  }
  lines.push("## Caveats", "", ...caveats, "");
  return `${lines.join("\n")}\n`;
}

if (process.argv[2] === "--worker") {
  const [, , , datasetName, engineName, budgetMs] = process.argv;
  process.stdout.write(JSON.stringify(worker(datasetName, engineName, Number(budgetMs))));
} else if (process.argv[2] === "--render") {
  // Regenerate the report from saved results without re-running the benchmark.
  const { environment, summary } = JSON.parse(readFileSync(fileURLToPath(new URL("../benchmarks/fuse-comparison.json", import.meta.url)), "utf8"));
  writeFileSync(fileURLToPath(new URL("../docs/fuse-comparison.md", import.meta.url)), renderMarkdown(environment, summary, Object.keys(ENGINES)));
  console.log("Rewrote docs/fuse-comparison.md from benchmarks/fuse-comparison.json");
} else {
  main();
}
