import { FilesystemStorageProvider, S3BucketProvider } from "@/storage-provider";

import type { EthokoCliConfig } from "../../config/config.js";

export function createStorageProvider(config: EthokoCliConfig) {
  if (config.storage.type === "aws") {
    return new S3BucketProvider({
      bucketName: config.storage.bucketName,
      bucketRegion: config.storage.region,
      credentials: config.storage.credentials,
      debug: config.debug,
    });
  }

  return new FilesystemStorageProvider({
    path: config.storage.path,
    debug: config.debug,
  });
}
