# @ethoko/cli-beacon

This package contains the source code for the CLI commands and core logic, and is published to npm as `@ethoko/cli-beacon`. This package can be executed in Node.js environments using `npx @ethoko/cli-beacon ...`, which is especially useful for development and testing purposes.

This package serves as a beacon for the generated `@ethoko/cli` package, which is a thin wrapper that resolves the correct platform-specific binary. The `@ethoko/cli` package is generated at publish time by the script `packages/cli-beacon/scripts/publish-cli.ts` and is not committed to the repository. See the [CLI Delivery Strategy](./../../docs/CLI_DELIVERY.md) documentation for more details on the relationship between these packages and the overall distribution strategy.
