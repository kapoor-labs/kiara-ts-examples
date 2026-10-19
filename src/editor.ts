import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import TypeScriptWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import { Operator, type FieldOptions } from "@kapoorlabs/kiara-ts";
import type { Operation } from "./query.ts";

self.MonacoEnvironment = {
  getWorker(_workerId, label) {
    return label === "typescript" || label === "javascript"
      ? new TypeScriptWorker() : new EditorWorker();
  },
};

interface EditorField {
  readonly name: string;
  readonly kind: string;
  readonly options?: FieldOptions;
}

const operations: Record<Operation, string> = {
  queryAll: "Return full rows in load order.",
  search: "AND together structured conditions.",
  projection: "Select fields and preserve original value types.",
  legacyProjection: "Uppercase keys with string/null values.",
  keywordBestMatch: "Return rows with the highest positive keyword score.",
  keywordMinimumMatch: "Return rows with the lowest positive keyword score.",
  predict: "Dictionary prefix predictions (words, not records).",
  oneEditAway: "One-edit dictionary candidate or null.",
  diagnostics: "Inspect store state, schema, and trie diagnostics.",
};

export function createScriptEditor(container: HTMLElement) {
  const defaults = monaco.typescript.javascriptDefaults;
  defaults.setEagerModelSync(true);
  defaults.setDiagnosticsOptions({
    noSemanticValidation: false, noSyntaxValidation: false, diagnosticCodesToIgnore: [1108],
  });
  defaults.setCompilerOptions({
    target: monaco.typescript.ScriptTarget.ESNext,
    allowNonTsExtensions: true,
    checkJs: true,
    allowJs: true,
    noLib: false,
  });
  const model = monaco.editor.createModel("", "javascript", monaco.Uri.parse("inmemory://kiara/query.js"));
  const editor = monaco.editor.create(container, {
    model,
    theme: "vs-dark",
    automaticLayout: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    tabSize: 2,
    fontSize: 14,
    ariaLabel: "Kiara query script",
    fixedOverflowWidgets: true,
    quickSuggestions: { other: true, comments: false, strings: true },
    suggest: { showWords: false },
  });
  let fields: readonly EditorField[] = [];
  let types: monaco.IDisposable | undefined;

  const completions = monaco.languages.registerCompletionItemProvider("javascript", {
    triggerCharacters: ['"', "'", ".", " "],
    provideCompletionItems(currentModel, position) {
      if (currentModel !== model) return { suggestions: [] };
      const before = model.getValueInRange({
        startLineNumber: 1, startColumn: 1,
        endLineNumber: position.lineNumber, endColumn: position.column,
      });
      const word = model.getWordUntilPosition(position);
      const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
      const items: monaco.languages.CompletionItem[] = [];
      const add = (label: string, detail: string, kind = monaco.languages.CompletionItemKind.Value) => {
        items.push({ label, insertText: label, detail, kind, range, sortText: `0-${label}` });
      };
      if (/Operator\.\w*$/.test(before)) {
        for (const name of Object.keys(Operator)) add(name, `Kiara ${name} operator`, monaco.languages.CompletionItemKind.EnumMember);
      } else if (/\boperation["']?\s*:\s*["'][^"']*$/.test(before)) {
        for (const [operation, description] of Object.entries(operations)) add(operation, description);
      } else if (/\bfield["']?\s*:\s*["'][^"']*$/.test(before)) {
        for (const field of fields.filter((field) => !field.options?.ignoreIndex)) {
          add(field.name, fieldDetail(field), monaco.languages.CompletionItemKind.Field);
        }
      } else if (/\b(fields|keywordFields)["']?\s*:\s*\[[^\]]*["'][^"']*$/.test(before)) {
        const keyword = /\bkeywordFields["']?\s*:\s*\[[^\]]*$/.test(before);
        for (const field of fields.filter((field) => !keyword ||
          (!field.options?.ignoreIndex && (field.kind === "text" || field.kind === "enum")))) {
          add(field.name, fieldDetail(field), monaco.languages.CompletionItemKind.Field);
        }
      } else if (/(?:[{,]\s*|\n\s*)\w*$/.test(before)) {
        const condition = /\bconditions["']?\s*:\s*\[[\s\S]*$/.test(before) &&
          before.lastIndexOf("{") > before.lastIndexOf("]");
        const properties = condition
          ? ["field", "operator", "values", "lowerValue", "upperValue"]
          : ["operation", "conditions", "fields", "limit", "input", "keywordFields", "maxKeywords"];
        for (const name of properties) {
          items.push({
            label: name, insertText: `${name}: `, range,
            kind: monaco.languages.CompletionItemKind.Property,
            detail: condition ? "Kiara condition property" : "Kiara request property",
          });
        }
      }
      return { suggestions: items };
    },
  });

  // Validate a virtual function body: top-level return is intentional in the visible script.
  const validationUri = monaco.Uri.parse("inmemory://kiara/validation.js");
  const validationModel = monaco.editor.createModel("", "javascript", validationUri);
  const updateValidation = () => validationModel.setValue(
    `/** @returns {KiaraRequest | KiaraCondition[]} */\nfunction query() {\n${model.getValue()}\n}`,
  );
  model.onDidChangeContent(updateValidation);
  const markerListener = monaco.editor.onDidChangeMarkers((uris) => {
    if (!uris.some((uri) => uri.toString() === validationUri.toString())) return;
    const markers = monaco.editor.getModelMarkers({ resource: validationUri })
      .filter((marker) => marker.startLineNumber > 2 && marker.startLineNumber <= model.getLineCount() + 2)
      .map((marker) => ({
        ...marker,
        startLineNumber: marker.startLineNumber - 2,
        endLineNumber: Math.min(marker.endLineNumber - 2, model.getLineCount()),
      }));
    monaco.editor.setModelMarkers(model, "kiara", markers);
  });

  return {
    getValue: () => editor.getValue(),
    setValue(value: string) {
      editor.setValue(value);
      editor.setScrollTop(0);
    },
    setFields(nextFields: readonly EditorField[]) {
      fields = nextFields;
      types?.dispose();
      const names = (selection: readonly EditorField[]) =>
        selection.map((field) => JSON.stringify(field.name)).join(" | ") || "never";
      types = defaults.addExtraLib(`
type KiaraField = ${names(fields)};
type KiaraIndexedField = ${names(fields.filter((field) => !field.options?.ignoreIndex))};
type KiaraKeywordField = ${names(fields.filter((field) => !field.options?.ignoreIndex && (field.kind === "text" || field.kind === "enum")))};
declare const Operator: { ${Object.keys(Operator).map((key) => `readonly ${key}: "${key}";`).join("\n")} };
interface KiaraCondition {
  /** Indexed field to filter. Conditions are ANDed. */
  field: KiaraIndexedField;
  /** Defaults to EQUAL. */
  operator?: typeof Operator[keyof typeof Operator];
  /** Values for equality, comparison, or containment. Use null for nulls. */
  values?: unknown[];
  /** Inclusive lower bound for BETWEEN. */
  lowerValue?: unknown;
  /** Inclusive upper bound for BETWEEN. */
  upperValue?: unknown;
}
interface KiaraRequest {
  /** Choose a Kiara operation; omitted means search. */
  operation?: ${Object.keys(operations).map((name) => JSON.stringify(name)).join(" | ")};
  conditions?: KiaraCondition[];
  /** Projection fields. Types are preserved unless using legacyProjection. */
  fields?: KiaraField[];
  /** Maximum returned rows or dictionary predictions. */
  limit?: number;
  /** Keyword sentence/phrases or dictionary input. */
  input?: string | string[];
  keywordFields?: KiaraKeywordField[];
  /** Keyword cap (default 10). Inspect truncated in the result. */
  maxKeywords?: number;
}
`, "inmemory://kiara/api.d.ts");
      updateValidation();
    },
    onRun(run: () => void) {
      editor.addAction({
        id: "kiara.run", label: "Run Kiara query",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
        run,
      });
    },
    dispose() {
      markerListener.dispose();
      completions.dispose();
      types?.dispose();
      editor.dispose();
      model.dispose();
      validationModel.dispose();
    },
  };
}

function fieldDetail(field: EditorField): string {
  return `${field.kind}${field.options?.secondaryType ? ` / ${field.options.secondaryType}` : ""}${field.options?.ignoreIndex ? " (projection only)" : ""}`;
}
