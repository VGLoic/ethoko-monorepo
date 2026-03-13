import { beforeAll, describe } from "vitest";
import crypto from "crypto";
import { COMPILATION_TARGETS } from "./compilation-targets.js";
import {
  ConfigSetup,
  CliConfigSetup,
  DeployScriptSetup,
} from "./helpers/test-setup.js";
import { testPushPullDeploy } from "./test-push-pull-deploy.js";

describe("[Hardhat v2 - Hardhat-deploy v0 - external lib] Push artifact, pull artifact, deploy - CLI", () => {
  const testId = crypto.randomBytes(16).toString("hex");
  const tag = testId;

  const config = new ConfigSetup(testId);
  const cliConfigSetup = new CliConfigSetup(config);
  const deploymentScriptSetup = new DeployScriptSetup(config);

  const ethokoCommand = `pnpm ethoko --config ${cliConfigSetup.cliConfigPath}`;

  beforeAll(async () => {
    const configCleanup = await config.setup();
    const cliCleanup = await cliConfigSetup.setup();
    const deploymentScriptCleanup = await deploymentScriptSetup.setup();

    return async () => {
      await deploymentScriptCleanup();
      await cliCleanup();
      await configCleanup();
    };
  });

  testPushPullDeploy({
    ethokoCommand,
    tag,
    hardhatConfigPath: deploymentScriptSetup.hardhatConfigPath,
    outputArtifactsPath: COMPILATION_TARGETS.DEFAULT.outputPath,
    deploymentScriptFolderPath:
      deploymentScriptSetup.deploymentScriptFolderPath,
  });
});
