import { InMemoryWorkerAdapter, attachBrowserWorkerHost } from "@kapoorlabs/kiara-ts";
import { RETAIL_DEFINITION, isRecord, validateRetailRows } from "./business-demos.ts";
import { buildStore } from "./datasets.ts";
import type { AnyRow } from "./query.ts";

function initialize(event: MessageEvent<unknown>): void {
  if (!isRecord(event.data) || event.data.type !== "initialize") return;
  try {
    const rows = validateRetailRows(event.data.rows);
    const store = buildStore({ ...RETAIL_DEFINITION, rows });
    attachBrowserWorkerHost(self, new InMemoryWorkerAdapter<AnyRow>(new Map([["retail", store]])));
    self.removeEventListener("message", initialize);
    self.postMessage({ type: "ready", rows: store.getLoadedRowCount() });
  } catch (error) {
    self.postMessage({ type: "initialization-error", message: error instanceof Error ? error.message : String(error) });
  }
}
self.addEventListener("message", initialize);
