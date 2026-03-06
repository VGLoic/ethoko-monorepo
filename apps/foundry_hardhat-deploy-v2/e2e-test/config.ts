import fs from "fs/promises";

export const E2E_FOLDER_PATH = ".ethoko-e2e";

const withBuildInfoWithTestPath = `${E2E_FOLDER_PATH}/with-build-info-with-test`;
const withBuildInfoWithoutTestPath = `${E2E_FOLDER_PATH}/with-build-info-without-test`;
const withoutBuildInfoWithTestPath = `${E2E_FOLDER_PATH}/without-build-info-with-test`;
const withoutBuildInfoWithoutTestPath = `${E2E_FOLDER_PATH}/without-build-info-without-test`;
export const BUILDS = {
  WITH_BUILD_INFO_WITH_TEST: {
    command: `forge build --build-info --out ${withBuildInfoWithTestPath} --cache-path ${withBuildInfoWithTestPath}-cache`,
    outputPath: withBuildInfoWithTestPath,
  },
  WITH_BUILD_INFO_WITHOUT_TEST: {
    command: `forge build --build-info --skip test/**/* --skip src/test/**/* --out ${withBuildInfoWithoutTestPath} --cache-path ${withBuildInfoWithoutTestPath}-cache`,
    outputPath: withBuildInfoWithoutTestPath,
  },
  WITHOUT_BUILD_INFO_WITH_TEST: {
    command: `forge build --use-literal-content --out ${withoutBuildInfoWithTestPath} --cache-path ${withoutBuildInfoWithTestPath}-cache`,
    outputPath: withoutBuildInfoWithTestPath,
  },
  WITHOUT_BUILD_INFO_WITHOUT_TEST: {
    command: `forge build --use-literal-content --skip test/**/* --skip src/test/**/* --out ${withoutBuildInfoWithoutTestPath} --cache-path ${withoutBuildInfoWithoutTestPath}-cache`,
    outputPath: withoutBuildInfoWithoutTestPath,
  },
};

export const PROJECT_NAME = "forge-counter";

export class ConfigSetup {
  public testId: string;
  public storagePath: string;
  public pulledArtifactsPath: string;
  public typingsPath: string;

  constructor(testId: string) {
    this.testId = testId;
    this.storagePath = `${E2E_FOLDER_PATH}/storage-${testId}`;
    this.pulledArtifactsPath = `${E2E_FOLDER_PATH}/pulled-artifacts-${testId}`;
    this.typingsPath = `${E2E_FOLDER_PATH}/typings-${testId}`;
  }

  async cleanup(): Promise<void> {
    for (const folder of [
      this.pulledArtifactsPath,
      this.storagePath,
      this.typingsPath,
    ]) {
      await fs.rm(folder, { recursive: true, force: true });
    }
  }
}

export class CliConfigSetup {
  public cliConfigPath: string;
  private config: ConfigSetup;

  constructor(config: ConfigSetup) {
    this.config = config;
    this.cliConfigPath = `${E2E_FOLDER_PATH}/ethoko.config.e2e.${config.testId}.json`;
  }

  async setup(): Promise<() => Promise<void>> {
    // paths
    const storagePath = `${E2E_FOLDER_PATH}/storage-${this.config.testId}`;
    const pulledArtifactsPath = `${E2E_FOLDER_PATH}/pulled-artifacts-${this.config.testId}`;
    // CLI config
    const cliConfigTemplate = await fs.readFile(
      "e2e-test/templates/ethoko.config.e2e.template.json",
      "utf-8",
    );
    const cliConfigContent = cliConfigTemplate
      .replace("PROJECT_NAME", PROJECT_NAME)
      .replace("PULLED_ARTIFACTS_PATH", `./../${pulledArtifactsPath}`)
      .replace("TYPINGS_PATH", `./../${this.config.typingsPath}`)
      .replace("STORAGE_PATH", `./../${storagePath}`);
    await fs.writeFile(this.cliConfigPath, cliConfigContent);

    return async () => {
      await fs.rm(this.cliConfigPath);
    };
  }
}

export class HardhatConfigSetup {
  public hardhatConfigPath: string;
  private config: ConfigSetup;

  constructor(config: ConfigSetup) {
    this.config = config;
    this.hardhatConfigPath = `${E2E_FOLDER_PATH}/hardhat.config.e2e.${config.testId}.ts`;
  }

  async setup(): Promise<() => Promise<void>> {
    const pulledArtifactsPath = `${E2E_FOLDER_PATH}/pulled-artifacts-${this.config.testId}`;
    const hardhatConfigTemplate = await fs.readFile(
      "e2e-test/templates/hardhat.config.e2e.template.ts",
      "utf-8",
    );
    const hardhatConfigContent = hardhatConfigTemplate
      .replace("PROJECT_NAME", PROJECT_NAME)
      .replace("PULLED_ARTIFACTS_PATH", pulledArtifactsPath)
      .replace(
        "ARTIFACTS_PATH",
        `${E2E_FOLDER_PATH}/generated-artifacts-${this.config.testId}`,
      )
      .replace("TYPINGS_PATH", this.config.typingsPath)
      .replace(
        "STORAGE_PATH",
        `${E2E_FOLDER_PATH}/storage-${this.config.testId}`,
      );
    await fs.writeFile(this.hardhatConfigPath, hardhatConfigContent);

    return async () => {
      await fs.rm(this.hardhatConfigPath);
    };
  }
}

export class HardhatDeployScriptSetup {
  private config: ConfigSetup;

  constructor(config: ConfigSetup) {
    this.config = config;
  }

  async setup(): Promise<() => Promise<void>> {
    const deploymentScriptContent = await fs.readFile(
      "deploy/00-deploy-counter-2026-02-04.ts",
      "utf-8",
    );
    const updatedScriptContent = deploymentScriptContent
      .replaceAll("2026-02-04", this.config.testId)
      .replaceAll(".ethoko-typings", this.config.typingsPath);

    const deploymentScriptPath = `deploy/00-deploy-counter-${this.config.testId}.ts`;
    await fs.writeFile(deploymentScriptPath, updatedScriptContent);

    return async () => {
      await fs.rm(deploymentScriptPath);
    };
  }
}
