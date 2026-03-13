import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Issue } from "./analyzer/types.js";

export interface LangFile {
  isoCode: string;
  filePath: string;
  keys: Set<string>;
}

/**
 * Discover all *.json files in `dir` (non-recursive, lang files are flat).
 */
export async function discoverLangFiles(dir: string): Promise<LangFile[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const results: LangFile[] = [];

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".json")) {
      const filePath = join(dir, entry.name);
      const isoCode = entry.name.replace(/\.json$/, "");
      const keys = await parseLangFile(filePath);
      results.push({ isoCode, filePath, keys });
    }
  }

  return results;
}

/**
 * Read a JSON language file and flatten nested objects into dot-notation keys.
 */
export async function parseLangFile(filePath: string): Promise<Set<string>> {
  const raw = await readFile(filePath, "utf-8");
  let json: unknown;

  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse lang file ${filePath}: ${String(err)}`);
  }

  const keys = new Set<string>();
  flattenKeys(json, "", keys);
  return keys;
}

function flattenKeys(obj: unknown, prefix: string, out: Set<string>): void {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    if (prefix) out.add(prefix);
    return;
  }

  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = record[key];

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      flattenKeys(value, fullKey, out);
    } else {
      out.add(fullKey);
    }
  }
}

/**
 * Validate that all lang files contain the exact same set of keys.
 * Returns an array of Issue objects for any discrepancies found.
 */
export function validateLangFiles(langFiles: LangFile[]): Issue[] {
  if (langFiles.length < 2) return [];

  const issues: Issue[] = [];
  const [reference, ...rest] = langFiles;

  for (const langFile of rest) {
    // Keys in reference but missing in langFile
    for (const key of reference.keys) {
      if (!langFile.keys.has(key)) {
        issues.push({
          type: "lang-mismatch",
          message: `Key "${key}" exists in ${reference.isoCode} but is missing in ${langFile.isoCode}`,
          file: langFile.filePath,
        });
      }
    }

    // Keys in langFile but missing in reference
    for (const key of langFile.keys) {
      if (!reference.keys.has(key)) {
        issues.push({
          type: "lang-mismatch",
          message: `Key "${key}" exists in ${langFile.isoCode} but is missing in ${reference.isoCode}`,
          file: langFile.filePath,
        });
      }
    }
  }

  return issues;
}

/**
 * Returns the union of all keys across all lang files.
 */
export function allLangKeys(langFiles: LangFile[]): Set<string> {
  const all = new Set<string>();
  for (const lf of langFiles) {
    for (const k of lf.keys) all.add(k);
  }
  return all;
}
