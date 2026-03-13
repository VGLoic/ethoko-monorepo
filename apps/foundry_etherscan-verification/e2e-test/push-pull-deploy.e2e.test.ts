import { beforeAll, describe } from "vitest";
import crypto from "crypto";
import {
  CliConfigSetup,
  ConfigSetup,
  DeployScriptSetup,
} from "./helpers/test-setup.js";
import { testPushPullDeploy } from "./test-push-pull-deploy.js";

describe("[Foundry - Etherscan Verification] - Default compilation without test - Push artifact, pull artifact, deploy - CLI", () => {
  const testId = crypto.randomBytes(16).toString("hex");
  const tag = testId;

  const config = new ConfigSetup(testId);
  const cliConfigSetup = new CliConfigSetup(config);
  const deployScriptSetup = new DeployScriptSetup(config);

  const ethokoCommand = `pnpm ethoko --config ${cliConfigSetup.cliConfigPath}`;

  beforeAll(async () => {
    const configCleanup = await config.setup();
    const cliCleanup = await cliConfigSetup.setup();
    const deployScriptCleanup = await deployScriptSetup.setup();

    return async () => {
      await deployScriptCleanup();
      await cliCleanup();
      await configCleanup();
    };
  });

  testPushPullDeploy({
    ethokoCommand,
    tag,
    ignitionDeployPath: deployScriptSetup.ignitionDeployPath,
    hardhatConfigPath: deployScriptSetup.hardhatConfigPath,
  });
});
