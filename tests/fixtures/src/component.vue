<script setup lang="ts">
import { useI18n } from "@/plugins/i18n"
const { t } = useI18n()
</script>
<template>
  <div>
    <h1>{{ t('feature.component.title') }}</h1>
    <p :aria-label="t('feature.name')">{{ t('title') }}</p>
  </div>
</template>
