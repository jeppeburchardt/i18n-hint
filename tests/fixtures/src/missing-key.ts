// Missing key reference
import { useI18n } from "@/plugins/i18n"

const { t } = useI18n()

export function getMissing(): string {
  return t('this.key.does.not.exist')
}
