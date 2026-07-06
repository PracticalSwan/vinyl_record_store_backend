import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseCatalogImport } from "../src/lib/catalog/parseImport.js";
import { connectMongoDB, disconnectMongoDB } from "../src/lib/db/mongodb.js";
import { VinylRecord } from "../src/models/VinylRecord.js";
import {
  applyCatalogImport,
  planCatalogImport,
  prepareCatalogImport,
  summarizeCatalogImport,
} from "../src/services/catalogImport.js";

function parseArguments(argv) {
  const options = { apply: false, dryRun: false, enrich: false, allowPartial: false, input: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") options.apply = true;
    else if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--enrich") options.enrich = true;
    else if (argument === "--allow-partial") options.allowPartial = true;
    else if (argument === "--input") options.input = argv[++index];
    else if (argument.startsWith("--input=")) options.input = argument.slice("--input=".length);
    else throw new Error(`Unsupported argument: ${argument}`);
  }
  if (!options.input) throw new Error("--input <catalog.csv|catalog.json> is required.");
  if (options.apply && options.dryRun) throw new Error("Choose either --apply or --dry-run, not both.");
  if (options.allowPartial && !options.apply) {
    throw new Error("--allow-partial is only valid together with --apply.");
  }
  return options;
}

function publicAction(action) {
  return {
    rowNumber: action.rowNumber,
    action: action.type,
    publicId: action.publicId ?? null,
    reason: action.reason || null,
    errors: action.errors || [],
    warnings: action.warnings || [],
  };
}

try {
  const options = parseArguments(process.argv.slice(2));
  const inputPath = path.resolve(options.input);
  const source = await readFile(inputPath, "utf8");
  const rows = parseCatalogImport(source, inputPath);
  const prepared = await prepareCatalogImport(rows, { enabled: options.enrich });
  const connection = await connectMongoDB();
  const existing = await VinylRecord.find({}).lean().exec();
  const previewActions = planCatalogImport(prepared, existing);
  const previewSummary = summarizeCatalogImport(previewActions);
  console.log(JSON.stringify({
    mode: options.apply ? "apply" : "dry-run",
    input: path.basename(inputPath),
    rows: rows.length,
    enrichment: options.enrich,
    partialMode: options.allowPartial,
    summary: previewSummary,
    actions: previewActions.map(publicAction),
  }, null, 2));

  if (!options.apply) {
    if (previewSummary.errors > 0 || previewSummary.conflicts > 0) process.exitCode = 1;
  } else {
    const result = await applyCatalogImport(prepared, {
      connection,
      allowPartial: options.allowPartial,
    });
    console.log(JSON.stringify({
      status: "applied",
      writes: result.writes,
      inserted: result.inserted,
      modified: result.modified,
      allocatedPublicIds: result.allocatedPublicIds,
    }, null, 2));
  }
} catch (error) {
  console.error(`Catalog import failed: ${error.message || error.name || "Error"}`);
  process.exitCode = 1;
} finally {
  await disconnectMongoDB();
}
