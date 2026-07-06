import path from "node:path";

function parseCsvRows(source) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((value) => value.trim() !== ""));
}

export function parseCsv(source) {
  const rows = parseCsvRows(String(source).replace(/^\uFEFF/, ""));
  if (rows.length === 0) return [];
  const headers = rows[0].map((header) => header.trim());
  if (headers.some((header) => !header)) throw new Error("CSV headers cannot be blank.");
  if (new Set(headers).size !== headers.length) throw new Error("CSV headers must be unique.");
  return rows.slice(1).map((values) => Object.fromEntries(
    headers.map((header, index) => [header, values[index] ?? ""]),
  ));
}

export function parseCatalogImport(source, filename = "catalog.json") {
  const extension = path.extname(filename).toLowerCase();
  if (extension === ".csv") return parseCsv(source);
  if (extension !== ".json") throw new Error("Import input must be a .csv or .json file.");
  const parsed = JSON.parse(String(source).replace(/^\uFEFF/, ""));
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.records)) return parsed.records;
  throw new Error("JSON input must be an array or an object with a records array.");
}
