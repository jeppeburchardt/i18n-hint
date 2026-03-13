import { describe, it, expect } from "vitest";
import { analyzeTsCode } from "../src/analyzer/tsAnalyzer.js";
import type { FuncSpec } from "../src/analyzer/types.js";

const funcSpec: FuncSpec = {
  packagePath: "@/plugins/i18n",
  composableName: "useI18n",
  fnName: "t",
};

describe("analyzeTsCode", () => {
  describe("Pattern 1 — standard destructure", () => {
    it("collects key usage from t('key')", () => {
      const code = `
import { useI18n } from "@/plugins/i18n"
const { t } = useI18n()
t('feature.component.name')
`;
      const result = analyzeTsCode(code, "test.ts", funcSpec);
      expect(result.usages).toHaveLength(1);
      expect(result.usages[0].key).toBe("feature.component.name");
      expect(result.issues).toHaveLength(0);
    });
  });

  describe("Pattern 2 — renamed import + renamed destructure", () => {
    it("tracks aliased composable and aliased fn", () => {
      const code = `
import { useI18n as useMyI18n } from "@/plugins/i18n"
const { t: translate } = useMyI18n()
translate('feature.component.name')
`;
      const result = analyzeTsCode(code, "test.ts", funcSpec);
      expect(result.usages).toHaveLength(1);
      expect(result.usages[0].key).toBe("feature.component.name");
    });
  });

  describe("Pattern 3 — object binding", () => {
    it("tracks member calls on composable result object", () => {
      const code = `
import { useI18n as useMyI18n } from "@/plugins/i18n"
const translater = useMyI18n()
translater.t('feature.age')
`;
      const result = analyzeTsCode(code, "test.ts", funcSpec);
      expect(result.usages).toHaveLength(1);
      expect(result.usages[0].key).toBe("feature.age");
    });
  });

  describe("Illegal keys", () => {
    it("flags template literals", () => {
      const code = `
import { useI18n } from "@/plugins/i18n"
const { t } = useI18n()
const prefix = 'feature'
t(\`\${prefix}.name\`)
`;
      const result = analyzeTsCode(code, "test.ts", funcSpec);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe("illegal-key");
      expect(result.issues[0].message).toContain("template literal");
    });

    it("flags variable references", () => {
      const code = `
import { useI18n } from "@/plugins/i18n"
const { t } = useI18n()
const key = 'feature.name'
t(key)
`;
      const result = analyzeTsCode(code, "test.ts", funcSpec);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe("illegal-key");
      expect(result.issues[0].message).toContain("variable reference");
    });

    it("flags string concatenation", () => {
      const code = `
import { useI18n } from "@/plugins/i18n"
const { t } = useI18n()
t('feature.' + 'name')
`;
      const result = analyzeTsCode(code, "test.ts", funcSpec);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe("illegal-key");
      expect(result.issues[0].message).toContain("string concatenation");
    });

    it("flags function calls as arguments", () => {
      const code = `
import { useI18n } from "@/plugins/i18n"
const { t } = useI18n()
function getKey() { return 'feature.name' }
t(getKey())
`;
      const result = analyzeTsCode(code, "test.ts", funcSpec);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe("illegal-key");
      expect(result.issues[0].message).toContain("function call");
    });
  });

  describe("Non-matching imports", () => {
    it("ignores t() from a different package", () => {
      const code = `
import { useI18n } from "some-other-package"
const { t } = useI18n()
t('feature.name')
`;
      const result = analyzeTsCode(code, "test.ts", funcSpec);
      expect(result.usages).toHaveLength(0);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe("Multiple usages", () => {
    it("collects all key usages in a file", () => {
      const code = `
import { useI18n } from "@/plugins/i18n"
const { t } = useI18n()
t('feature.name')
t('feature.age')
t('title')
`;
      const result = analyzeTsCode(code, "test.ts", funcSpec);
      expect(result.usages).toHaveLength(3);
      const keys = result.usages.map((u) => u.key);
      expect(keys).toContain("feature.name");
      expect(keys).toContain("feature.age");
      expect(keys).toContain("title");
    });
  });

  describe("Line and column reporting", () => {
    it("reports correct line numbers", () => {
      const code = `import { useI18n } from "@/plugins/i18n"
const { t } = useI18n()
t('feature.name')`;
      const result = analyzeTsCode(code, "test.ts", funcSpec);
      expect(result.usages[0].line).toBe(3);
    });
  });
});
