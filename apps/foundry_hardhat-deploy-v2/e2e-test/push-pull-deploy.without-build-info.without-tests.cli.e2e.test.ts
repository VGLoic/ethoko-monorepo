import { beforeAll, describe } from "vitest";
import crypto from "crypto";
import {
  BUILDS,
  CliConfigSetup,
  ConfigSetup,
  HardhatConfigSetup,
  HardhatDeployScriptSetup,
} from "./config.js";
import { testPushPullDeploy } from "./test-push-pull-deploy.js";

describe("[Foundry Hardhat-deploy v2] - Compilation WITHOUT --build-info WITHOUT test and scripts - Push artifact, pull artifact, deploy - CLI", () => {
  // The testId is used to create unique paths for the storage, pulled artifacts and typings for each test run
  const testId = crypto.randomBytes(16).toString("hex");
  const tag = testId;

  const config = new ConfigSetup(testId);
  const cliConfigSetup = new CliConfigSetup(config);
  const hardhatConfigSetup = new HardhatConfigSetup(config);
  const deploymentScriptSetup = new HardhatDeployScriptSetup(config);

  const ethokoCommand = `pnpm ethoko --config ${cliConfigSetup.cliConfigPath}`;

  beforeAll(async () => {
    const cliCleanup = await cliConfigSetup.setup();
    const hardhatCleanup = await hardhatConfigSetup.setup();
    const deploymentScriptCleanup = await deploymentScriptSetup.setup();

    return async () => {
      await config.cleanup();
      await cliCleanup();
      await hardhatCleanup();
      await deploymentScriptCleanup();
    };
  });

  testPushPullDeploy({
    ethokoCommand,
    tag,
    hardhatConfigPath: hardhatConfigSetup.hardhatConfigPath,
    outputArtifactsPath: BUILDS.WITHOUT_BUILD_INFO_WITHOUT_TEST.outputPath,
  });
});
