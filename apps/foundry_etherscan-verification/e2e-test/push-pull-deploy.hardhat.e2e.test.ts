import { beforeAll, describe } from "vitest";
import fs from "fs/promises";
import crypto from "crypto";
import { E2E_FOLDER_PATH } from "./config.js";
import { testPushPullDeploy } from "./test-push-pull-deploy.js";

describe("[Foundry - Etherscan Verification] - Default compilation without test - Push artifact, pull artifact, deploy - Hardhat Plugin", () => {
  const testId = crypto.randomBytes(16).toString("hex");
  const tag = testId;

  const ignitionDeployPath = `./ignition/modules/release-${tag}.ts`;
  const hardhatConfigPath = `${E2E_FOLDER_PATH}/hardhat.config.e2e.${testId}.ts`;

  const ethokoCommand = `pnpm hardhat --config ${hardhatConfigPath} ethoko`;

  beforeAll(async () => {
    // paths
    const typingsPath = `${E2E_FOLDER_PATH}/typings-${testId}`;
    const storagePath = `${E2E_FOLDER_PATH}/storage-${testId}`;
    const pulledArtifactsPath = `${E2E_FOLDER_PATH}/pulled-artifacts-${testId}`;

    // Hardhat config
    const hardhatConfigTemplate = await fs.readFile(
      "e2e-test/templates/hardhat.config.e2e.template.ts",
      "utf-8",
    );
    const hardhatConfigContent = hardhatConfigTemplate
      .replaceAll("PULLED_ARTIFACTS_PATH", pulledArtifactsPath)
      .replaceAll("TYPINGS_PATH", typingsPath)
      .replaceAll("STORAGE_PATH", storagePath);
    await fs.writeFile(hardhatConfigPath, hardhatConfigContent);

    // Ignition deployment script
    const deploymentScriptContent = await fs.readFile(
      "ignition/modules/release-2026-02-02.ts",
      "utf-8",
    );
    const updatedScriptContent = deploymentScriptContent
      .replaceAll("2026-02-02", tag)
      .replaceAll(".ethoko-typings", typingsPath);

    await fs.writeFile(ignitionDeployPath, updatedScriptContent);

    return async () => {
      await fs.rm(hardhatConfigPath);
      await fs.rm(ignitionDeployPath);
      for (const folder of [pulledArtifactsPath, typingsPath, storagePath]) {
        await fs.rm(folder, { recursive: true, force: true });
      }
    };
  });

  testPushPullDeploy({
    ethokoCommand,
    tag,
    ignitionDeployPath,
    hardhatConfigPath,
  });
});
