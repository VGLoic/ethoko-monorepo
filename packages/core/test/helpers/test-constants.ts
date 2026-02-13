import path from "path";

export const TEST_CONSTANTS = {
  LOCALSTACK: {
    ENDPOINT: "http://localhost:4566",
    REGION: "us-east-1",
    ACCESS_KEY_ID: "test",
    SECRET_ACCESS_KEY: "test",
  },
  BUCKET_NAME: "ethoko-test-bucket",
  PROJECTS: {
    DEFAULT: "default-project",
    MULTI_ARTIFACT: "multi-artifact-project",
    FORCE_TEST: "force-test-project",
  },
  TAGS: {
    V1: "v1.0.0",
    V2: "v2.0.0",
    LATEST: "latest",
  },
  ARTIFACTS_FIXTURES: {
    HARDHAT_V2_COUNTER: {
      folderPath: path.resolve(
        process.cwd(),
        "test/fixtures/hardhat-v2-counter",
      ),
      buildInfoPath: path.resolve(
        process.cwd(),
        "test/fixtures/hardhat-v2-counter/build-info/sample-artifact.json",
      ),
      fullyQualifiedContractPaths: [
        "src/Counter.sol:Counter",
        "src/IncrementOracle.sol:IncrementOracle",
      ],
    },
    HARDHAT_V3_COUNTER: {
      folderPath: path.resolve(
        process.cwd(),
        "test/fixtures/hardhat-v3-counter",
      ),
      buildInfoPath: path.resolve(
        process.cwd(),
        "test/fixtures/hardhat-v3-counter/build-info/sample-artifact.json",
      ),
      fullyQualifiedContractPaths: ["project/contracts/Counter.sol:Counter"],
    },
    FOUNDRY_COUNTER: {
      folderPath: path.resolve(process.cwd(), "test/fixtures/foundry-counter"),
      buildInfoPath: path.resolve(
        process.cwd(),
        "test/fixtures/foundry-counter/build-info/sample-artifact.json",
      ),
      fullyQualifiedContractPaths: ["src/Counter.sol:Counter"],
    },
    FOUNDRY_BUILD_INFO_COUNTER: {
      folderPath: path.resolve(
        process.cwd(),
        "test/fixtures/foundry-build-info-counter",
      ),
      buildInfoPath: path.resolve(
        process.cwd(),
        "test/fixtures/foundry-build-info-counter/build-info/sample-artifact.json",
      ),
      fullyQualifiedContractPaths: ["src/Counter.sol:Counter"],
    },
  },
  PATHS: {
    TEMP_DIR_PREFIX: "ethoko-test-",
    FIXTURES: path.resolve(process.cwd(), "test/fixtures"),
  },
} as const;
