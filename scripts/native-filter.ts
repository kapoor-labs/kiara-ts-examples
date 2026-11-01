import { createMatcher } from "./fuse-benchmark/engines.mjs";

type Row = Record<string, unknown> & { id: string };
type Clause = {
  field: string;
  op: string;
  values?: unknown[];
  value?: unknown;
  low?: unknown;
  high?: unknown;
};
type Dataset = {
  rows: Row[];
  fields: { name: string; type: string; prefixLength?: number }[];
};
type Workload = {
  kind: string;
  interpret?: string;
  where?: Clause[];
  limit?: number;
  projection?: string[];
};

export function buildNativeFilter(dataset: Dataset) {
  const start = performance.now();
  const matches = createMatcher(dataset);
  const phases = { matcher: performance.now() - start };
  return {
    phases,
    run(workload: Workload) {
      if (workload.kind !== "exact" || workload.interpret) return null;
      if (!workload.where) throw new Error("An exact filter workload requires conditions");
      const where = workload.where;
      const filtered = dataset.rows.filter((row) => where.every((clause) => matches(row, clause)));
      const limited = workload.limit === undefined ? filtered : filtered.slice(0, workload.limit);
      const projection = workload.projection;
      const rows = projection
        ? limited.map((row) => Object.fromEntries(projection.map((field) => [field, row[field]])))
        : limited;
      return { ids: rows.map((row) => row.id) };
    },
  };
}
