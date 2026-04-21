import {
  FilesystemStorageProvider,
  S3BucketProvider,
} from "@/storage-provider";

import type { EthokoStorageConfig } from "../../config";
import { DebugLogger } from "@/utils/debug-logger";

export function createStorageProvider(
  storageConfig: EthokoStorageConfig,
  logger: DebugLogger,
  debug?: boolean,
) {
  if (storageConfig.type === "aws") {
    return new S3BucketProvider({
      bucketName: storageConfig.bucketName,
      bucketRegion: storageConfig.region,
      credentials: storageConfig.credentials,
      debug,
      logger,
    });
  }

  return new FilesystemStorageProvider({
    path: storageConfig.path,
    debug,
    logger,
  });
}
