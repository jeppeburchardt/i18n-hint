// Pattern 1: standard destructure
import { useI18n } from "@/plugins/i18n"

const { t } = useI18n()

export function getTitle(): string {
  return t('feature.component.title')
}

export function getGreeting(): string {
  return t('greeting')
}
