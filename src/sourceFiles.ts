import { readdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Recursively yields all .ts and .vue file paths under `dir`,
 * skipping node_modules directories.
 */
export async function* walkFiles(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === "node_modules") continue;

    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      yield* walkFiles(fullPath);
    } else if (entry.isFile() && /\.(ts|vue)$/.test(entry.name)) {
      yield fullPath;
    }
  }
}
