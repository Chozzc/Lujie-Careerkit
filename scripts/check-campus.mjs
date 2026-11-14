import { readFile, stat } from "node:fs/promises";
import { ZodError } from "zod";
import { assertCampusDatasetSize, parseCampusDataset } from "../src/lib/campus-dataset.mjs";

const [file = "data/campus/current.json", ...extra] = process.argv.slice(2);

try {
  if (extra.length) throw new Error("Usage: npm run check:campus -- [path-to-snapshot.json]");
  const info = await stat(file);
  if (!info.isFile()) throw new Error("Choose a JSON file");
  assertCampusDatasetSize(info.size);
  const dataset = parseCampusDataset(await readFile(file, "utf8"));
  console.log(`Valid campus snapshot (${dataset.preparedAt}): ${dataset.records.length} records`);
} catch (error) {
  console.error(`Campus snapshot check failed: ${file}`);
  if (error instanceof ZodError) {
    for (const { path, message } of error.issues) {
      const [field, index, ...rest] = path;
      const location = field === "records" && typeof index === "number"
        ? [`Record ${index + 1}`, ...rest].join(" · ")
        : path.join(".") || "Snapshot";
      console.error(`${location}: ${message}`);
    }
  } else {
    console.error(error instanceof Error ? error.message : error);
  }
  process.exitCode = 1;
}
