import { foundryDescribe } from "./foundry-describe.js";

const outputArtifactsPath = "./ethoko-e2e/out-2026-forge-default";

foundryDescribe(
  "[Foundry Hardhat-deploy v2] - Default compilation WITHOUT --build-info WITHOUT test and scripts - Push artifact, pull artifact, deploy",
  `forge build --force --skip test --skip script --out ${outputArtifactsPath}`,
  "2026-forge-default",
  outputArtifactsPath,
);
