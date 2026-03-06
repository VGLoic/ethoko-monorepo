import { beforeAll, describe } from "vitest";
import fs from "fs/promises";
import crypto from "crypto";
import { E2E_FOLDER_PATH } from "./config.js";
import { testPushPullDeploy } from "./test-push-pull-deploy.js";

describe("[Foundry - Etherscan Verification] - Default compilation without test - Push artifact, pull artifact, deploy - CLI", () => {
  const testId = crypto.randomBytes(16).toString("hex");
  const tag = testId;

  const cliConfigPath = `${E2E_FOLDER_PATH}/ethoko.config.e2e.${testId}.json`;
  const ignitionDeployPath = `./ignition/modules/release-${tag}.ts`;
  const hardhatConfigPath = `${E2E_FOLDER_PATH}/hardhat.config.e2e.${testId}.ts`;

  const ethokoCommand = `pnpm ethoko --config ${cliConfigPath}`;

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
    // We do not need to replace any placeholder as we only care about Hardhat Ignition
    const hardhatConfigContent = hardhatConfigTemplate;
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

    // CLI config
    const cliConfigTemplate = await fs.readFile(
      "e2e-test/templates/ethoko.config.e2e.template.json",
      "utf-8",
    );
    const cliConfigContent = cliConfigTemplate
      .replace("PULLED_ARTIFACTS_PATH", `./../${pulledArtifactsPath}`)
      .replace("TYPINGS_PATH", `./../${typingsPath}`)
      .replace("STORAGE_PATH", `./../${storagePath}`);
    await fs.writeFile(cliConfigPath, cliConfigContent);

    return async () => {
      await fs.rm(cliConfigPath);
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
