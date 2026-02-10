# Hardhat Soko - Example - Deploy Counter

This is an example of integration between [Hardhat V3](https://hardhat.org/docs/getting-started) and [Soko](https://github.com/VGLoic/soko-monorepo).

The [Hardhat-Deploy](https://rocketh.dev/hardhat-deploy/) (`hardhat-deploy@2.0.0-next.76` i.e. `v2`) plugin is used to manage deployments.

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

Later on, the same developper or another one wants to deploy the contracts for the `2026-02-02` release.
It will first pull the compilation artifacts from `Soko`:

```bash
npx hardhat soko pull
```

Then, generates the typings in order to write a type-safe deployment script:

```bash
npx hardhat soko typings
```

Finally, the deployer can write a deployment script, e.g. [00-deploy-counter-2026-02-02.ts](./deploy/deploy_counter-2026-02-02.ts), that will retrieve the compilation artifacts from `Soko` and deploy the contract accordingly.

```ts
import { deployScript } from "../rocketh/deploy.js";
import { project } from "../.soko-typings/index.js"


const TARGET_RELEASE_TAG = "2026-02-02";

export default deployScript(
  async ({ deploy, namedAccounts }) => {
    const { deployer } = namedAccounts;

    const projectUtils = project("curious-counter")

    const counterArtifact = await projectUtils.tag(TARGET_RELEASE_TAG).getContractArtifact("project/contracts/Counter.sol:Counter")

    const metadata = counterArtifact.metadata;
    if (!metadata) {
      throw new Error("Metadata is required for deployment, but was not found in the artifact");
    }

    await deploy(`Counter@${TARGET_RELEASE_TAG}`, {
      account: deployer,
      artifact: {
        // Hardhat Deploy works with the abitype dependency, strongly typing the ABI. It is not yet available here.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        abi: counterArtifact.abi as any,
        bytecode: `0x${counterArtifact.evm.bytecode.object}`,
        metadata
      },
    });
  },
  { tags: ["Counter", "Counter_deploy", TARGET_RELEASE_TAG] },
);



```

The deployment script can be executed using the Hardhat-Deploy plugin:

```bash
npx hardhat deploy --network <network-name>
```

No additional compilation step is needed since the deployment script directly uses the static artifacts from `Soko`.

The deployment is by nature idempotent, this is guaranteed by the fact that the used artifacts are static and the Hardhat-Deploy plugin.

