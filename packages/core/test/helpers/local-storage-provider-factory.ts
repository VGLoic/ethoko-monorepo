import fs from "fs/promises";
import os from "os";
import path from "path";
import { LocalStorageProvider } from "@/storage-provider/local-storage-provider";
import { TEST_CONSTANTS } from "./test-constants";

export async function createTestLocalStorageProvider(): Promise<{
  provider: LocalStorageProvider;
  cleanup: () => Promise<void>;
}> {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), TEST_CONSTANTS.PATHS.TEMP_DIR_PREFIX),
  );

  const provider = new LocalStorageProvider({
    path: tempDir,
    debug: false,
  });

  const cleanup = async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  };

  return { provider, cleanup };
}
