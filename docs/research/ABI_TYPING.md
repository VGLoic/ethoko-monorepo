# ABI Typing Research

## Problem Statement

When a developer calls `getContractArtifact()` or `getArtifact()`, the returned `EthokoContractArtifact` has `abi: readonly unknown[]` by default. The goal is to **automatically resolve the ABI type** at the TypeScript level, so the developer gets typed ABI without manually importing and passing a generic parameter.

### Current State

1. **Manual generic approach** (current `templates-builder/typings.ts`): Developer must `import type { ABI as CounterAbi }` from a generated `.d.ts` file and pass it as `getContractArtifact<CounterAbi>(...)`. Works but clunky.
2. **WIP `summary-abis` approach** (current `templates/typings.txt`): The built template references `import type { ABIS } from "./summary-abis"` and uses overloaded function signatures with `AbiForContract<TProject, TTag, TContract>` to auto-resolve. However, the `summary-abis` file is **not yet generated** by `generate-typings.ts`.

The core tension: **completeness vs. TypeScript performance**. Embedding every ABI literal (project x tag x contract) in a single type structure can produce a massive type, potentially slowing down the compiler.

---

## Options

### Option 1: Single `summary-abis.d.ts` with All ABIs (Full Centralized Map)

Generate one `summary-abis.d.ts` that maps `project -> tag -> contractKey -> ABI literal`:

```typescript
// .ethoko-typings/summary-abis.d.ts
export interface ABIS {
  "my-project": {
    "v1.0.1": {
      "src/Counter.sol:Counter": readonly [
        { type: "function"; name: "increment"; inputs: readonly []; ... },
        ...
      ];
      "src/Oracle.sol:Oracle": readonly [...];
    };
    "v2.0.0": { ... };
  };
}
```

The template's `AbiForContract<TProject, TTag, TContract>` conditional type resolves the ABI automatically at every call site.

**Pros:**

- Every combination of project/tag/contract is dynamically typed
- Zero manual imports needed by the developer
- Already partially designed in the built template (`typings.txt` lines 37-83)
- Single file, simple generation logic

**Cons:**

- File size grows as `O(projects * tags * contracts * avg_abi_size)`. A project with 50 contracts across 20 tags means 1,000 ABI literals in one type structure.
- TypeScript must parse and intern the entire type on first access. While the compiler caches named types, the sheer size of the interface can increase memory and `checkSourceFile` time.
- Editor performance may degrade when hovering/autocompleting on the file itself.
- ABIs are often duplicated across tags when contracts don't change between releases.

**Performance estimate:** Likely acceptable for small-to-medium setups (< ~200 contract-tag combinations). May become problematic at 500+ combinations.

**When to choose:** Small-to-medium projects with few tags.

---

### Option 2: Per-File ABI Imports via Re-exports (Distributed Map with Lazy Resolution)

Keep the existing per-contract `.d.ts` files (`abis/{project}/{tag}/{sourceName}/{contract}.d.ts`) and generate a `summary-abis.d.ts` that re-exports/references them via `import()` types:

```typescript
// .ethoko-typings/summary-abis.d.ts
export interface ABIS {
  "my-project": {
    "v1.0.1": {
      "src/Counter.sol:Counter": import("./abis/my-project/v1.0.1/src/Counter.sol/Counter").ABI;
      "src/Oracle.sol:Oracle": import("./abis/my-project/v1.0.1/src/Oracle.sol/Oracle").ABI;
    };
  };
}
```

TypeScript resolves `import()` types lazily -- the ABI literal is only loaded when the specific contract/tag combination is accessed in type position.

**Pros:**

- Every combination of project/tag/contract is dynamically typed (same DX as Option 1)
- The `summary-abis.d.ts` stays small -- it only contains `import()` references, not ABI literals
- TypeScript lazily resolves `import()` types, so unused ABIs never get loaded
- Individual `.d.ts` files benefit from `skipLibCheck` and incremental builds
- Files are already being generated (`writeAbiTypings` in `generate-typings.ts`)

**Cons:**

- More generated files on disk (already the case today)
- Module resolution overhead: each `import()` type triggers a module resolve. For hundreds of entries, this adds up.
- Slightly more complex generation logic (must ensure paths are correct)
- The `summary-abis.d.ts` still contains one entry per project/tag/contract combination (the structure is large, just not the values)

**Performance estimate:** Significantly better than Option 1 for large setups because ABI literals are not interned until needed. The structural overhead of the interface itself (keys and `import()` references) is lightweight.

**When to choose:** Medium-to-large projects. Best general-purpose option.

---

### Option 3: Deduplicated ABIs by Content Hash

Many tags share the same ABI for a given contract (e.g., "v1.0.1" and "latest" point to the same compilation). Instead of duplicating the ABI type per tag, generate deduplicated ABI files keyed by content hash:

```
.ethoko-typings/
  abis/
    _hashes/
      a1b2c3d4.d.ts    # export type ABI = readonly [...]
      e5f6g7h8.d.ts
  summary-abis.d.ts     # references _hashes/ files
```

```typescript
// summary-abis.d.ts
export interface ABIS {
  "my-project": {
    "v1.0.1": {
      "src/Counter.sol:Counter": import("./abis/_hashes/a1b2c3d4").ABI;
    };
    latest: {
      "src/Counter.sol:Counter": import("./abis/_hashes/a1b2c3d4").ABI; // same hash
    };
  };
}
```

**Pros:**

- Reduces disk space and number of unique ABI files
- TypeScript caches type identities by declaration location -- two `import()` references to the same file resolve to the same type, reducing comparison cost
- All combinations still dynamically typed

**Cons:**

- More complex generation logic (hash computation, deduplication)
- Hash filenames are opaque -- the individual files are no longer human-navigable
- The `summary-abis.d.ts` still has one entry per project/tag/contract
- Marginal benefit if contracts rarely share ABIs across tags

**When to choose:** When many tags share the same compilation output (common with alias tags like `latest`, `stable`, etc.).

---

### Option 4: Latest-Tag-Only Dynamic ABI (Partial Linking)

Only generate dynamic ABI types for one "primary" tag per contract (e.g., the most recent or a configured default). Other tags fall back to the generic `TAbi` parameter:

```typescript
// summary-abis.d.ts
export interface ABIS {
  "my-project": {
    latest: {
      "src/Counter.sol:Counter": import("./abis/my-project/latest/src/Counter.sol/Counter").ABI;
    };
    // "v1.0.1", "v2.0.0" etc. are NOT listed -- they fall back to unknown[]
  };
}
```

The overloaded signatures in the template still allow `<TAbi>` manual override for non-primary tags:

```typescript
// Auto-resolved:
const artifact = await project("my-project")
  .tag("latest")
  .getContractArtifact("src/Counter.sol:Counter");
// ^? EthokoContractArtifact<readonly [{type: "function", ...}, ...]>

// Manual override for older tags:
const oldArtifact = await project("my-project")
  .tag("v1.0.1")
  .getContractArtifact<MyAbi>("src/Counter.sol:Counter");
// ^? EthokoContractArtifact<MyAbi>
```

**Pros:**

- Minimal type surface: one ABI per contract (not per tag)
- Fastest TypeScript performance of any dynamic option
- Covers the most common case (latest/active contracts)
- Developer can still manually specify ABI for older tags

**Cons:**

- Only a subset of contracts are dynamically typed
- Requires a heuristic or configuration to decide which tag is "primary"
- Inconsistent DX -- some calls are auto-typed, others require manual generics
- If the developer deploys from an older tag, they don't get auto-typing

**When to choose:** Very large projects where performance is critical and most deployment work uses the latest tag.

---

### Option 5: Per-Contract Aggregated ABI Module (One File Per Contract, All Tags)

Instead of organizing by tag, generate one file per contract that exports all its ABI versions:

```typescript
// .ethoko-typings/abis/my-project/src/Counter.sol/Counter.d.ts
export interface TaggedAbis {
  "v1.0.1": readonly [{ type: "function"; name: "increment"; ... }, ...];
  "v2.0.0": readonly [{ type: "function"; name: "increment"; ... }, { type: "function"; name: "decrement"; ... }, ...];
  "latest": readonly [/* same as v2.0.0 */];
}
```

```typescript
// summary-abis.d.ts
export interface ABIS {
  "my-project": {
    [TTag in string]: {
      "src/Counter.sol:Counter": TTag extends keyof import("./abis/my-project/src/Counter.sol/Counter").TaggedAbis
        ? import("./abis/my-project/src/Counter.sol/Counter").TaggedAbis[TTag]
        : readonly unknown[];
    };
  };
}
```

**Pros:**

- Number of files = number of unique contracts (not contracts x tags)
- All tags dynamically typed
- Natural grouping -- easy for developers to inspect a contract's ABI history
- Deduplication is visible (can use type aliases within the file)

**Cons:**

- Complex conditional type in `summary-abis.d.ts` (mapped + conditional + import)
- Individual contract files can still get large if there are many tags
- The `summary-abis.d.ts` structure uses mapped types which are harder for TypeScript to cache than simple interface properties
- More complex generation and template logic

**When to choose:** When the number of unique contracts is small relative to the number of tags.

---

### Option 6: Module Augmentation / Declaration Merging (Plugin Architecture)

Each contract's ABI is generated as a separate `.d.ts` that augments a shared interface:

```typescript
// .ethoko-typings/abis/my-project/v1.0.1/Counter.d.ts
declare module ".ethoko-typings/summary-abis" {
  interface ABIS {
    "my-project": {
      "v1.0.1": {
        "src/Counter.sol:Counter": readonly [{ type: "function"; ... }, ...];
      };
    };
  }
}
```

Each file adds its own piece to the `ABIS` interface through declaration merging.

**Pros:**

- Fully distributed -- no single large file
- Each file is independently typed
- Adding/removing contracts only touches individual files
- TypeScript handles declaration merging efficiently for interfaces

**Cons:**

- **Declaration merging does NOT deep-merge nested interfaces.** If two files both declare `ABIS["my-project"]["v1.0.1"]`, the second overwrites the first rather than merging the contract keys. This makes it **fundamentally incompatible** with the nested `project -> tag -> contract` structure unless each file declares a unique top-level key.
- Workaround (one file per project-tag combination) partially addresses this but still results in many augmentation files
- Ambient module declarations must reference the module by its full resolved path, which is fragile in generated code
- Complex and unusual pattern -- hard to debug and maintain

**When to choose:** Generally not recommended for this use case due to the deep-merge limitation.

---

## Comparison Matrix

| Criterion                 | Option 1 (Single File)        | Option 2 (Import References) | Option 3 (Dedup Hashes) | Option 4 (Latest Only) | Option 5 (Per-Contract) | Option 6 (Augmentation) |
| ------------------------- | ----------------------------- | ---------------------------- | ----------------------- | ---------------------- | ----------------------- | ----------------------- |
| **All combos typed**      | Yes                           | Yes                          | Yes                     | No (subset)            | Yes                     | Yes (with caveats)      |
| **TS parse cost**         | High (scales with total ABIs) | Low (lazy import resolution) | Low (lazy + dedup)      | Minimal                | Medium                  | Medium                  |
| **File count**            | 1                             | 1 + N per-contract files     | 1 + M unique hash files | 1 + subset of files    | 1 + C contract files    | N augmentation files    |
| **Generation complexity** | Simple                        | Simple (files already exist) | Medium (hashing)        | Simple                 | Medium                  | High                    |
| **DX consistency**        | Uniform                       | Uniform                      | Uniform                 | Mixed                  | Uniform                 | Uniform                 |
| **Deduplication**         | None                          | None                         | Built-in                | N/A                    | Manual                  | None                    |
| **Maintenance**           | Low                           | Low                          | Medium                  | Low                    | Medium                  | High                    |

Where N = projects x tags x contracts, M = unique ABIs, C = unique contracts.

---

## Recommendation

**Option 2 (Distributed Map with Lazy Resolution)** is the best general-purpose solution:

1. It provides complete dynamic ABI typing for every project/tag/contract combination.
2. It leverages TypeScript's lazy `import()` type resolution to avoid loading unused ABIs.
3. The per-contract `.d.ts` files are already being generated by `writeAbiTypings`.
4. The `summary-abis.d.ts` is small (just `import()` references).
5. It aligns with the architecture already partially designed in `templates/typings.txt`.

**For an immediate implementation**, the required changes are:

- Add a `writeSummaryAbis()` function in `generate-typings.ts` that generates `summary-abis.d.ts` with `import()` references pointing to existing `abis/` files.
- Sync `templates-builder/typings.ts` with the already-designed template in `templates/typings.txt` (the ABI type resolution layer at lines 37-83).

**If performance becomes an issue at scale**, upgrade to **Option 3** (add content-hash deduplication) as a pure optimization with no DX change.

**If performance is critical and completeness can be sacrificed**, **Option 4** (latest-tag-only) provides the lightest footprint while still covering the primary use case.
