# Hardhat Soko - Example - Deploy Counter

This is an example of integration between [Hardhat V3](https://hardhat.org/docs/getting-started) and [Soko](https://github.com/VGLoic/soko-monorepo).

## Workflow

### Content

In this example, we implement a a simple `Counter` contract, see [Counter.sol](./artifacts/Counter.sol).

### Development phase

Development is done as usual, with as many tests or else.

### Release phase

Once the development is considered done, one can create the compilation artifacts:

```bash
npx hardhat compile --force --no-tests
```

The compilation artifacts will be pushed to `Soko`, hence freezing them for later use.

```bash
# The tag 2026-02-04 is arbitrary, it can be any string identifying the release
npx hardhat soko push --tag 2026-02-04
```

### Deployment phase

To be defined, stay tuned!
