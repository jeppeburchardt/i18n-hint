// Pattern 2: renamed import + renamed destructure
import { useI18n as useMyI18n } from "@/plugins/i18n"

const { t: translate } = useMyI18n()

export function getName(): string {
  return translate('feature.component.name')
}
