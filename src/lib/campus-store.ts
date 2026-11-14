import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { CampusDataset } from "@/lib/campus";
import { assertCampusDatasetSize, parseCampusDataset } from "./campus-dataset.mjs";

const datasetPath = path.join(process.cwd(), "data", "campus", "current.json");
let cached: { stamp: string; data: CampusDataset } | undefined;

export async function readCampusDataset() {
  try {
    const info = await stat(datasetPath);
    assertCampusDatasetSize(info.size);
    const stamp = `${info.mtimeMs}:${info.size}`;
    if (cached?.stamp === stamp) return cached.data;
    const data = parseCampusDataset(await readFile(datasetPath, "utf8"));
    cached = { stamp, data };
    return data;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      cached = undefined;
      return null;
    }
    throw error;
  }
}
