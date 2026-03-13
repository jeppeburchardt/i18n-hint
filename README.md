# i18n-hint

A CLI auditing tool for detecting i18n translation key issues in Vue 3 and TypeScript projects. It validates that keys referenced in your code exist in your language files, keys defined in your language files are actually used, and that all language files are kept in sync.

## Installation

**Requirements:** Node.js 18+, npm

```bash
# Clone and install dependencies
git clone <repo>
cd i18n-hint
npm install

# Build the CLI
npm run build

# Link globally (optional)
npm link
```

After building, the CLI is available at `./dist/cli.js` or as `i18n-hint` if linked globally.

## Usage

```bash
i18n-hint --source <path> --lang <path> --func <spec>
```

### Arguments

All arguments are required.

| Argument | Format | Description |
|---|---|---|
| `--source` | `<path>` | Path to the directory containing source files to analyze |
| `--lang` | `<path>` | Path to the directory containing JSON language files |
| `--func` | `<spec>` | i18n function specification (see below) |

#### `--func` spec format

The `--func` argument takes a colon-separated spec string that identifies how your i18n composable is used:

```
<import-path>:<composable-name>:<translation-fn>
```

| Part | Description | Example |
|---|---|---|
| `import-path` | Exact import path to match in source files | `@/plugins/i18n` |
| `composable-name` | The composable function that is imported | `useI18n` |
| `translation-fn` | The translation function property on the composable's return value | `t` |

**Example:**

```bash
i18n-hint \
  --source ./src \
  --lang ./lang \
  --func "@/plugins/i18n:useI18n:t"
```

This would match code such as:

```typescript
import { useI18n } from "@/plugins/i18n"
const { t } = useI18n()
t('my.key')
```

## Rules

i18n-hint reports four categories of issues, all using an ESLint-style format:

```
/path/to/file.ts:12:5: error [rule-name] Message
```

### `missing-key`

A translation key is used in source code but is not defined in the language files.

```
/src/component.vue:8:9: error [missing-key] Key "dashboard.title" is not defined in language file "en"
```

### `unused-key`

A translation key is defined in a language file but never referenced in any source file.

```
: error [unused-key] Key "old.feature.name" is not used in any source file
```

### `illegal-key`

A non-string-literal value is passed as the translation key. Only static string literals are supported; dynamic keys (variables, template literals, expressions) cannot be statically analyzed.

```
/src/component.vue:14:5: error [illegal-key] Key argument is not a string literal
```

This includes:

- Template literals: `` t(`${prefix}.key`) ``
- Variable references: `t(myKey)`
- String concatenation: `t("prefix." + key)`
- Function call results: `t(getKey())`

### `lang-mismatch`

The set of keys in one language file does not match another. All language files must contain exactly the same keys.

```
: error [lang-mismatch] Key "only-in-da" is defined in "da" but not in "en"
```

## Scope

### Supported

- **TypeScript** (`.ts`) source files
- **Vue 3 Single File Components** (`.vue`) — both `<script>` and `<template>` sections
- Composable-style i18n usage (e.g., `useI18n().t`)
- Import aliases: `import { useI18n as useMyI18n }`
- Renamed destructuring: `const { t: translate } = useI18n()`
- Object binding: `const i18n = useI18n(); i18n.t('key')`
- Nested JSON language files — keys are flattened to dot-notation (e.g., `feature.component.title`)
- Multiple language files — cross-file key consistency is enforced

### Not Supported

- JavaScript (`.js`) files
- Direct function imports (only composable pattern)
- Dynamic translation keys — flagged as `illegal-key` and not further analyzed
- Nested language file directories (language files must be at the root of `--lang`)
- `node_modules` — always skipped during source traversal

## Language File Format

Language files must be JSON and placed directly (non-recursively) in the `--lang` directory. The filename (without `.json`) is used as the ISO language code.

```
lang/
  en.json   → "en"
  da.json   → "da"
```

Nested objects are supported and flattened to dot-notation keys internally:

```json
{
  "feature": {
    "component": {
      "title": "Component title"
    }
  },
  "greeting": "Hello"
}
```

Produces keys: `feature.component.title`, `greeting`

## Exit Codes

| Code | Meaning |
|---|---|
| `0` | No issues found |
| `1` | One or more issues detected |

## Development

```bash
npm test            # Run tests once
npm run test:watch  # Run tests in watch mode
npm run build       # Compile TypeScript to dist/
```

## Releases

Releases are fully automated via [semantic-release](https://github.com/semantic-release/semantic-release). Every push to `main` is analyzed; if it contains releasable commits a new version is published to npm automatically.

### Commit message format

This project follows the [Conventional Commits](https://www.conventionalcommits.org/) specification:

| Prefix | Triggers |
|---|---|
| `fix:` | Patch release (e.g. `1.0.1`) |
| `feat:` | Minor release (e.g. `1.1.0`) |
| `BREAKING CHANGE:` footer or `feat!:` / `fix!:` | Major release (e.g. `2.0.0`) |
| `chore:`, `docs:`, `test:`, `refactor:`, etc. | No release |

**Examples:**

```
feat: add support for .js source files
fix: correctly resolve aliased composable names
feat!: rename --func flag to --spec

BREAKING CHANGE: the --func argument has been renamed to --spec
```

### Required repository secret

Before the workflow can publish to npm, add your npm access token as a repository secret:

1. Generate a token at [npmjs.com → Access Tokens](https://www.npmjs.com/settings/~/tokens) (choose "Automation")
2. Add it to the repo at **Settings → Secrets and variables → Actions** as `NPM_TOKEN`

The `GITHUB_TOKEN` secret is provided automatically by GitHub Actions.
