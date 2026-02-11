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
  PATHS: {
    TEMP_DIR_PREFIX: "ethoko-test-",
    FIXTURES: path.resolve(process.cwd(), "test/fixtures"),
    SAMPLE_ARTIFACT: {
      HARDHAT_V2_COUNTER: path.resolve(
        process.cwd(),
        "test/fixtures/hardhat-v2-counter/build-info/sample-artifact.json",
      ),
      HARDHAT_V3_COUNTER: path.resolve(
        process.cwd(),
        "test/fixtures/hardhat-v3-counter/build-info/sample-artifact.json",
      ),
      FOUNDRY_COUNTER: path.resolve(
        process.cwd(),
        "test/fixtures/foundry-counter/build-info/sample-artifact.json",
      ),
      FOUNDRY_BUILD_INFO_COUNTER: path.resolve(
        process.cwd(),
        "test/fixtures/foundry-build-info-counter/build-info/sample-artifact.json",
      ),
    },
  },
} as const;
