import { describe, it, expect } from "vitest";
import { analyzeVue } from "../src/analyzer/vueAnalyzer.js";
import type { FuncSpec } from "../src/analyzer/types.js";

const funcSpec: FuncSpec = {
  packagePath: "@/plugins/i18n",
  composableName: "useI18n",
  fnName: "t",
};

describe("analyzeVue", () => {
  it("collects keys from script setup", () => {
    const sfc = `
<script setup lang="ts">
import { useI18n } from "@/plugins/i18n"
const { t } = useI18n()
const title = t('feature.name')
</script>
<template><div></div></template>
`;
    const result = analyzeVue(sfc, "comp.vue", funcSpec);
    expect(result.usages.some((u) => u.key === "feature.name")).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("collects keys from template interpolation", () => {
    const sfc = `
<script setup lang="ts">
import { useI18n } from "@/plugins/i18n"
const { t } = useI18n()
</script>
<template>
  <div>{{ t('feature.component.title') }}</div>
</template>
`;
    const result = analyzeVue(sfc, "comp.vue", funcSpec);
    expect(result.usages.some((u) => u.key === "feature.component.title")).toBe(
      true
    );
  });

  it("collects keys from directive expressions", () => {
    const sfc = `
<script setup lang="ts">
import { useI18n } from "@/plugins/i18n"
const { t } = useI18n()
</script>
<template>
  <p :aria-label="t('feature.name')">text</p>
</template>
`;
    const result = analyzeVue(sfc, "comp.vue", funcSpec);
    expect(result.usages.some((u) => u.key === "feature.name")).toBe(true);
  });

  it("flags illegal keys in template", () => {
    const sfc = `
<script setup lang="ts">
import { useI18n } from "@/plugins/i18n"
const { t } = useI18n()
const prefix = 'feature'
</script>
<template>
  <div>{{ t(\`\${prefix}.name\`) }}</div>
</template>
`;
    const result = analyzeVue(sfc, "comp.vue", funcSpec);
    expect(result.issues.some((i) => i.type === "illegal-key")).toBe(true);
  });

  it("handles renamed import alias in Vue SFC", () => {
    const sfc = `
<script setup lang="ts">
import { useI18n as useMyI18n } from "@/plugins/i18n"
const { t: translate } = useMyI18n()
</script>
<template>
  <div>{{ translate('title') }}</div>
</template>
`;
    const result = analyzeVue(sfc, "comp.vue", funcSpec);
    expect(result.usages.some((u) => u.key === "title")).toBe(true);
  });
});
