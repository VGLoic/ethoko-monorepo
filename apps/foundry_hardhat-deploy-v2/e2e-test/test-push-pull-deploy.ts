import { test } from "vitest";
import { asyncExec } from "./async-exec.js";
import { E2E_FOLDER_PATH } from "./config.js";

export function testPushPullDeploy(payload: {
  ethokoCommand: string;
  tag: string;
  hardhatConfigPath: string;
  outputArtifactsPath: string;
}) {
  // We allow for retries because the newly created artifacts are not always discoverable by the plugin on the first try, which causes the push command to fail.
  // This is likely due to some eventual consistency in the file system, but we haven't investigated further as allowing for retries is a simple workaround.
  test("it pushes the tag", () =>
    asyncExec(
      `${payload.ethokoCommand} push --tag ${payload.tag} --artifact-path ${payload.outputArtifactsPath}`,
    ));

  test("it pulls the tag", () => asyncExec(`${payload.ethokoCommand} pull`));

  test("it generates the typings", () =>
    asyncExec(`${payload.ethokoCommand} typings`));

  test("it checks types", () => asyncExec("pnpm tsc --noEmit"));

  // We allow for three retries as recognition of the fresh typings might take a bit of time, especially on CI
  test("it deploys", { retry: 3 }, () =>
    asyncExec(
      `pnpm hardhat --config ${payload.hardhatConfigPath} deploy --tags ${payload.tag}`,
    ),
  );

  test("it restores the original artifacts", async () => {
    await asyncExec(
      `${payload.ethokoCommand} restore --tag ${payload.tag} --output ./${E2E_FOLDER_PATH}/restored-artifacts-${payload.tag}`,
    );
    await asyncExec(
      `ls -la ./${E2E_FOLDER_PATH}/restored-artifacts-${payload.tag}`,
    );
  });
}
