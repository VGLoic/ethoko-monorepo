import { foundryDescribe } from "./foundry-describe.js";

const outputArtifactsPath = "./ethoko-e2e/out-2026-forge-build-info";

foundryDescribe(
  "[Foundry Hardhat-deploy v2] - Compilation WITH --build-info WITHOUT test and scripts - Push artifact, pull artifact, deploy",
  `forge build --force --skip test --skip script --build-info --out ${outputArtifactsPath}`,
  "2026-forge-build-info",
  outputArtifactsPath,
);
