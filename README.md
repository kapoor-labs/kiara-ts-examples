# Kiara TS Examples Playground

Interactive local playground for [`@kapoorlabs/kiara-ts`](https://www.npmjs.com/package/@kapoorlabs/kiara-ts).

When you start this repo locally, it opens a browser portal where you can:

- pick a built-in test corpus dataset from a menu,
- write a search script and run it immediately,
- inspect the result payload,
- upload your own dataset JSON and run the same scripting flow.

## Quick start

```bash
npm install
npm run dev
```

Open the local URL shown by Vite (usually `http://localhost:5173`).

## Playground workflow

1. Select a dataset from the left menu.
2. Edit the script in **Search script**.
3. Click **Run script**.
4. View formatted JSON output in the **Result** panel.

The script receives `Operator` from Kiara and must `return` an object (or an
array of conditions).

## Script format

### Structured search

```js
return {
  operation: "search",
  limit: 10,
  conditions: [
    {
      field: "year",
      operator: Operator.BETWEEN,
      lowerValue: 1990,
      upperValue: 2010,
    },
    {
      field: "tags",
      operator: Operator.CONTAINS_EITHER,
      values: ["survival"],
    },
  ],
};
```

### Projection

```js
return {
  operation: "projection",
  fields: ["title", "rating"],
  conditions: [
    {
      field: "tags",
      operator: Operator.CONTAINS_EITHER,
      values: ["space"],
    },
  ],
};
```

### Keyword search

```js
return {
  operation: "keywordBestMatch",
  input: "apolo mission",
  keywordFields: ["title", "summary"],
  limit: 5,
};
```

## Bring your own data (upload)

Use the **Bring your own data** button and upload a JSON file in this format:

```json
{
  "name": "Custom dataset",
  "description": "Optional description",
  "normalizationProfile": "native",
  "fields": [
    {
      "name": "title",
      "kind": "text",
      "options": {
        "caseInsensitive": true
      }
    },
    {
      "name": "year",
      "kind": "number"
    },
    {
      "name": "tags",
      "kind": "text",
      "options": {
        "secondaryType": "commaSeparatedStrings",
        "caseInsensitive": true
      }
    }
  ],
  "rows": [
    {
      "title": "Cast Away",
      "year": 2000,
      "tags": "survival,island"
    }
  ],
  "defaultScript": "return { operation: \"queryAll\", limit: 20 };"
}
```

### Supported field kinds

- `text`
- `number`
- `long`
- `boolean`
- `enum` (requires `enumValues`)

### Supported operations in script

- `queryAll`
- `search`
- `projection`
- `legacyProjection`
- `keywordBestMatch`
- `keywordMinimumMatch`

## Build

```bash
npm run build
```
