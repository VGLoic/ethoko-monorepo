# Hardhat Ethoko - Example - Deploy Counter

This is an example of integration between [Foundry](https://getfoundry.sh/) and [Ethoko](https://github.com/VGLoic/ethoko-monorepo).

The static compilation artifacts from `Ethoko` are used to deploy a simple `Counter` contract, see [Counter.sol](./src/Counter.sol).

The [Hardhat-Deploy](https://rocketh.dev/hardhat-deploy/) (`hardhat-deploy@2.0.0-next.76` i.e. `v2`) plugin is used to manage deployments.

## Workflow

### Content

In this example, we implement a a simple `Counter` contract, see [Counter.sol](./src/Counter.sol).

### Development phase

Development is done as usual, with as many tests or else.

### Release phase

Once the development is considered done, one can create the compilation artifacts:

```bash
forge build --skip test --skip script --force
```

Note that it is important to ignore the `test` and `script` folders, otherwise, the generated artifacts will contain all the non-relevant contracts from these folders.

The compilation artifacts will be pushed to `Ethoko`, hence freezing them for later use.

```bash
# The tag 2026-02-04 is arbitrary, it can be any string identifying the release
npx hardhat ethoko push --artifact-path ./out --tag 2026-02-04
```

### Deployment phase

Later on, the same developper or another one wants to deploy the contracts for the `2026-02-04` release.
It will first pull the compilation artifacts from `Ethoko`:

```bash
npx hardhat ethoko pull
```

Then, generates the typings in order to write a type-safe deployment script:

```bash
npx hardhat ethoko typings
```

Finally, the deployer can write a deployment script, e.g. [00-deploy-counter-2026-02-04.ts](./deploy/00-deploy-counter-2026-02-04.ts), that will retrieve the compilation artifacts from `Ethoko` and deploy the contract accordingly.

```ts
import { deployScript } from "../rocketh/deploy.js";
import { project } from "../.ethoko-typings";

const TARGET_RELEASE = "2026-02-04";

export default deployScript(
  async ({ deploy, namedAccounts }) => {
    const { deployer } = namedAccounts;

    // Get project utilities for the target release
    const projectUtils = project("forge-counter").tag(TARGET_RELEASE);

    const counterArtifact = await projectUtils.getContractArtifact(
      "src/Counter.sol:Counter",
    );

    const metadata = counterArtifact.metadata;
    if (!metadata) {
      throw new Error(
        "Metadata is required for deployment, but was not found in the artifact",
      );
    }

    await deploy(`Counter@${TARGET_RELEASE}`, {
      account: deployer,
      artifact: {
        // Hardhat Deploy works with the abitype dependency, strongly typing the ABI. It is not yet available here.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        abi: counterArtifact.abi as any,
        bytecode: `0x${counterArtifact.evm.bytecode.object}`,
        metadata,
      },
    });
  },
  { tags: ["Counter", "Counter_deploy", TARGET_RELEASE] },
);
```

The deployment script can be executed using the Hardhat-Deploy plugin:

```bash
npx hardhat deploy --network <network-name>
```

No additional compilation step is needed since the deployment script directly uses the static artifacts from `Ethoko`.

The deployment is by nature idempotent, this is guaranteed by the fact that the used artifacts are static and the Hardhat-Deploy plugin.
