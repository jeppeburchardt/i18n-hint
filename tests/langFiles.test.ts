import { describe, it, expect } from "vitest";
import { parseLangFile, validateLangFiles } from "../src/langFiles.js";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesLang = join(__dirname, "fixtures/lang");

describe("parseLangFile", () => {
  it("flattens nested JSON to dot-notation keys", async () => {
    const keys = await parseLangFile(join(fixturesLang, "en.json"));
    expect(keys.has("feature.name")).toBe(true);
    expect(keys.has("feature.age")).toBe(true);
    expect(keys.has("feature.component.title")).toBe(true);
    expect(keys.has("feature.component.name")).toBe(true);
    expect(keys.has("title")).toBe(true);
    expect(keys.has("greeting")).toBe(true);
  });

  it("does not include intermediate object keys", async () => {
    const keys = await parseLangFile(join(fixturesLang, "en.json"));
    expect(keys.has("feature")).toBe(false);
    expect(keys.has("feature.component")).toBe(false);
  });
});

describe("validateLangFiles", () => {
  it("returns no issues when files are identical", async () => {
    const { discoverLangFiles } = await import("../src/langFiles.js");
    // Create mock lang files with same keys
    const issues = validateLangFiles([
      { isoCode: "en", filePath: "en.json", keys: new Set(["a", "b"]) },
      { isoCode: "da", filePath: "da.json", keys: new Set(["a", "b"]) },
    ]);
    expect(issues).toHaveLength(0);
  });

  it("reports keys missing in one file", () => {
    const issues = validateLangFiles([
      { isoCode: "en", filePath: "en.json", keys: new Set(["a", "b", "c"]) },
      { isoCode: "da", filePath: "da.json", keys: new Set(["a", "b"]) },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe("lang-mismatch");
    expect(issues[0].message).toContain('"c"');
    expect(issues[0].message).toContain("da");
  });

  it("reports keys extra in second file", () => {
    const issues = validateLangFiles([
      { isoCode: "en", filePath: "en.json", keys: new Set(["a"]) },
      { isoCode: "da", filePath: "da.json", keys: new Set(["a", "b"]) },
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('"b"');
  });

  it("returns no issues for a single file", () => {
    const issues = validateLangFiles([
      { isoCode: "en", filePath: "en.json", keys: new Set(["a"]) },
    ]);
    expect(issues).toHaveLength(0);
  });

  it("detects mismatch between da and en fixtures", async () => {
    const { discoverLangFiles } = await import("../src/langFiles.js");
    const langFiles = await discoverLangFiles(fixturesLang);
    const issues = validateLangFiles(langFiles);
    // da has "only-in-da" which en doesn't
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((i) => i.message.includes("only-in-da"))).toBe(true);
  });
});
