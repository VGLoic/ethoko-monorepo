import { deployScript } from "../rocketh/deploy.js";
import { project } from "../.soko-typings/index.js"


export default deployScript(
  async ({ deploy, namedAccounts }) => {
    const { deployer } = namedAccounts;

    const projectUtils = project("curious-counter")

    const counterArtifact = await projectUtils.contract("project/contracts/Counter.sol:Counter").getArtifact("2026-02-02");

    const metadata = counterArtifact.metadata;
    if (!metadata) {
      throw new Error("Metadata is required for deployment, but was not found in the artifact");
    }

    await deploy("Counter", {
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
  { tags: ["Counter", "Counter_deploy", "2026-02-02"] },
);

