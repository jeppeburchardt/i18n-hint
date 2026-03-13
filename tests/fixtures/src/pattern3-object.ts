// Pattern 3: object binding
import { useI18n as useMyI18n } from "@/plugins/i18n"

const translater = useMyI18n()

export function getAge(): string {
  return translater.t('feature.age')
}
