import { foundryDescribe } from "./foundry-describe.js";

const outputArtifactsPath = "./ethoko-e2e/out-2026-forge-build-info-full";

foundryDescribe(
  "[Foundry Hardhat-deploy v2] - Compilation WITH --build-info WITH test and scripts - Push artifact, pull artifact, deploy",
  `forge build --force --build-info --out ${outputArtifactsPath}`,
  "2026-forge-build-info-full",
  outputArtifactsPath,
);
