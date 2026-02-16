# Hardhat Ethoko - Example - Deploy Counter

This is an example of integration between [Hardhat V3](https://hardhat.org/docs/getting-started) and [Ethoko](https://github.com/VGLoic/ethoko-monorepo).

Deployments are managed using [Hardhat Ignition](https://hardhat.org/docs/guides/deployment/using-ignition).

## Workflow

### Content

In this example, we implement a a simple `Counter` contract, see [Counter.sol](./artifacts/Counter.sol).

### Development phase

Development is done as usual, with as many tests or else.

### Release phase

Once the development is considered done, one can create the compilation artifacts:

```bash
npx hardhat build --build-profile production --force --no-tests
```

The compilation artifacts will be pushed to `Ethoko`, hence freezing them for later use.

```bash
# The tag 2026-02-02 is arbitrary, it can be any string identifying the release
npx hardhat ethoko push --tag 2026-02-02
```

### Deployment phase

Later on, the same developper or another one wants to deploy the contracts for the `2026-02-02` release.
It will first pull the compilation artifacts from `Ethoko`:

```bash
npx hardhat ethoko pull
```

Then, generates the typings in order to write a type-safe deployment script:

```bash
npx hardhat ethoko typings
```

REMIND ME: TO BE COMPLETED
