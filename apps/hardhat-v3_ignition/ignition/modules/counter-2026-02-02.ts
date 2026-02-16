import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { project } from "../../.ethoko-typings";

const TARGET_RELEASE_TAG = "2026-02-02";
// Hardhat Ignition likes alphanumeric and underscores
const MODULE_SUFFIX = TARGET_RELEASE_TAG.replaceAll("-", "_");

export default buildModule(`CounterModule_${MODULE_SUFFIX}`, (m) => {
  const projectUtils = project("ignited-counter");
  const counterArtifact = projectUtils
    .tag("2026-02-02")
    .getContractArtifactSync("project/contracts/Counter.sol:Counter");
  const counter = m.contract("Counter", {
    _format: "hh3-artifact-1",
    contractName: "Counter",
    sourceName: "contracts/Counter.sol",
    bytecode: `0x${counterArtifact.evm.bytecode.object}`,
    deployedBytecode: `0x${counterArtifact.evm.deployedBytecode?.object}`,
    linkReferences: counterArtifact.evm.bytecode.linkReferences,
    deployedLinkReferences:
      counterArtifact.evm.deployedBytecode?.linkReferences ?? {},
    abi: counterArtifact.abi,
  });

  m.call(counter, "incBy", [5n]);

  return { counter };
});
