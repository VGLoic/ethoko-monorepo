import { beforeAll, describe } from "vitest";
import crypto from "crypto";
import {
  CliConfigSetup,
  ConfigSetup,
  DeployScriptSetup,
} from "./helpers/test-setup.js";
import { testPushPullDeploy } from "./test-push-pull-deploy.js";
import { COMPILATION_TARGETS } from "./compilation-targets.js";

describe("[Hardhat v3 - Etherscan Verification] Push artifact, pull artifact, deploy - CLI - Isolated Build", () => {
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
    outputArtifactsPath: COMPILATION_TARGETS.ISOLATED_BUILD.outputPath,
    ignitionDeployPath: deployScriptSetup.ignitionDeployPath,
    hardhatConfigPath: deployScriptSetup.hardhatConfigPath,
  });
});
