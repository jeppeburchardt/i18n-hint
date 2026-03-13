// Pattern 4: illegal key usages
import { useI18n } from "@/plugins/i18n"

const { t } = useI18n()

const prefix = 'feature'
const key = 'name'

// All of these should be flagged as illegal-key
export function illegalTemplateLiteral(): string {
  return t(`${prefix}.${key}`)
}

export function illegalVariableReference(): string {
  return t(key)
}

export function illegalConcatenation(): string {
  return t('feature.' + key)
}

export function illegalFunctionCall(): string {
  return t(getKey())
}

function getKey(): string {
  return 'feature.name'
}
