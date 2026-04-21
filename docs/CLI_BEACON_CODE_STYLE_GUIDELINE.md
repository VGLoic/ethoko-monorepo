# cli-beacon Code Style Guideline

Concise code style rules for `packages/cli-beacon/`. Intended for AI agents.

## Imports

**Order:** Built-in modules -> Third-party packages -> Internal modules. Separate each group with a blank line.

```typescript
import fs from "node:fs/promises";

import { z } from "zod";

import { LOG_COLORS } from "@/ui";
import { toAsyncResult } from "@/utils/result";
```

**Aliases:** Use `@/` path aliases for cross-directory imports. Use relative (`./`) for same-directory imports only.

## Naming

| Category                     | Convention                   | Example                                                |
| ---------------------------- | ---------------------------- | ------------------------------------------------------ |
| Variables / Functions        | camelCase                    | `projectName`, `pullProject()`                         |
| Types / Interfaces / Classes | PascalCase                   | `StorageProvider`, `EthokoCliConfig`                   |
| Zod schemas                  | PascalCase + `Schema` suffix | `TagManifestSchema`, `AbiSchema`                       |
| Types inferred from Zod      | `z.infer<typeof XSchema>`    | `type TagManifest = z.infer<typeof TagManifestSchema>` |
| Constants                    | SCREAMING_SNAKE_CASE         | `LOG_COLORS`, `VERSION`                                |
| Files                        | kebab-case                   | `artifact-key.ts`, `s3-bucket-provider.ts`             |

## Type Safety

- **Public APIs** must have explicit return types.
- **User input** must be validated with `safeParse`. Never use `parse` on untrusted data.
- **Trusted/internal data** may use `parse`.
- **Format Zod errors** with `z.prettifyError(result.error)`.
- **Use `z.NEVER`** in Zod transforms to signal invalid state.
- **Prefer discriminated unions** for result types:

```typescript
type Result<T> =
  | { status: "success"; value: T }
  | { status: "error"; reason: string };
```

## Error Handling

### Client methods (`src/client/*`)

All client methods MUST throw `CliError` (from `src/client/error.ts`). Never throw raw `Error` from client code.

Wrap async operations with `toAsyncResult` (from `src/utils/result.ts`), check `success`, then throw `CliError` on failure:

```typescript
const result = await toAsyncResult(someAsyncOp(), { debug: opts.debug });
if (!result.success) {
  steps.fail("User-visible spinner message");
  throw new CliError("User-friendly error explanation");
}
```

### Internal methods (`src/` outside `client/`)

Use standard `Error`.

### Command handlers (`src/commands/*`)

Export command handlers post-parsing logic as async functions to be used in tests, they MUST throw CliError on errors.
```typescript
export async function runInspectCommand(
  artifactKey: ArtifactKey,
  dependencies: {
    storageProvider: StorageProvider;
    pulledArtifactStore: PulledArtifactStore;
    logger: CommandLogger;
  },
  opts: { debug: boolean; json?: boolean },
): Promise<InspectResult> {
  ...
}
```

Use it in the command definition with error catching: distinguish `CliError` (show message) from unexpected errors (generic message + dump):

```typescript
await runInspectCommand(
    artifactKeyParsingResult.data,
    {
      storageProvider,
      pulledArtifactStore,
      logger,
    },
    {
      debug: optsParsingResult.data.debug,
    },
  ).catch((err) => {
    if (err instanceof CliError) {
      logger.error(err.message);
    } else {
      logger.error(
        "An unexpected error occurred, please fill an issue with the error details if the problem persists",
      );
      console.error(err);
    }
    process.exitCode = 1;
  });
```

Use `process.exitCode = 1` instead of `process.exit()`.


## Exhaustive Checks

Use `satisfies never` for exhaustive switch/if-else checks on discriminated unions:

```typescript
default:
  type satisfies never;
```

## Console Output

- Use `CommandLogger` (from `src/ui/index.ts`) in command handlers: `logger.success()`, `logger.error()`, `logger.warn()`, `logger.info()`.
- **All output goes to stderr.** Stdout is reserved exclusively for JSON output (e.g., `inspect` command).
- Use `DebugLogger` (from `src/utils/debug-logger.ts`) for debug logs in the rest of the codebase, controlled by `opts.debug` flags.

## Function Signatures

Use dependencies as positional params, options as a final `opts` object:

```typescript
async function pullProject(
  project: string,
  dependencies: {
    storageProvider: StorageProvider;
    pulledArtifactStore: PulledArtifactStore;
    logger: DebugLogger;
  },
  opts: { force: boolean; debug: boolean; },
): Promise<PullResult> {}
```

## Best Practices

1. Always validate user input with Zod before processing
2. Prefer explicit return types for public functions
3. Use the `opts` pattern for function options (better than multiple params)
4. Handle both `CliError` and unexpected errors in all command handlers
5. Use descriptive variable names - clarity over brevity
6. Avoid `!` non-null assertions - use strict null checks
7. Use `safeParse` over `parse` for graceful error handling on user input
