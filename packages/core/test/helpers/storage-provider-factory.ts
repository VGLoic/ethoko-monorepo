import fs from "fs/promises";
import os from "os";
import path from "path";
import {
  LocalStorageProvider,
  StorageProvider,
  S3BucketProvider,
} from "@/storage-provider";
import { TEST_CONSTANTS } from "./test-constants";

export interface TestStorageProvider<
  T extends StorageProvider = StorageProvider,
> {
  storageProvider: T;
  cleanup: () => Promise<void>;
}

export async function createTestLocalStorageProvider(): Promise<TestStorageProvider> {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), TEST_CONSTANTS.PATHS.TEMP_DIR_PREFIX),
  );

  const storageProvider = new LocalStorageProvider({
    path: tempDir,
    debug: false,
  });

  const cleanup = async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  };

  return { storageProvider, cleanup };
}

export async function createTestS3StorageProvider(opts?: {
  debug?: boolean;
}): Promise<TestStorageProvider> {
  const storageProvider = new S3BucketProvider({
    bucketName: TEST_CONSTANTS.BUCKET_NAME,
    bucketRegion: TEST_CONSTANTS.LOCALSTACK.REGION,
    accessKeyId: TEST_CONSTANTS.LOCALSTACK.ACCESS_KEY_ID,
    secretAccessKey: TEST_CONSTANTS.LOCALSTACK.SECRET_ACCESS_KEY,
    endpoint: TEST_CONSTANTS.LOCALSTACK.ENDPOINT,
    forcePathStyle: true,
    debug: opts?.debug ?? false,
    rootPath: "projects",
  });

  const cleanup = async () => {
    // No cleanup needed for S3 provider in this test setup
  };

  return { storageProvider, cleanup };
}
