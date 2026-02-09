# Contributing to Soko

Thank you for your interest in contributing to Soko! We welcome contributions from the community to help improve and enhance the project. Below are some guidelines to help you get started.

### Prerequisites

This repository is a monorepo managed with [Turborepo](https://turborepo.dev/).

A [.nvmrc](https://github.com/nvm-sh/nvm) file is provided to ensure a consistent `Node.js` version accross the monorepo.

```bash
nvm use
```

### Apps and Packages

- `apps/`: integration example of Soko with Hardhat v2, Hardhat v3 and Foundry with Soko,
- `@soko/eslint-config`: `eslint` configurations,
- `@soko/typescript-config`: `tsconfig.json`s used throughout the monorepo,
- `@soko/hardhat-v2-soko`: Hardhat Plugin to integrate Soko with Hardhat V2.

### Scripts

Check the available scripts in the root `package.json` file. The most used ones are:

- `build`: build all packages,
- `lint`: lint all packages,
- `format`: format all packages,
- `check-format`: check code formatting for all packages,
- `check-types`: typecheck all packages,
- `test:e2e`: run end-to-end tests.
