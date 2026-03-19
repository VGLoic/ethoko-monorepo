import os from "node:os";
import fs from "node:fs/promises";
import z from "zod";
import { AbsolutePath, RelativePathSchema } from "@/utils/path";
import { toAsyncResult, toResult } from "@/utils/result";

function getEthokoGlobalPath(): AbsolutePath {
  return AbsolutePath.from(os.homedir(), ".ethoko");
}

function getEthokoGlobalConfigPath(): AbsolutePath {
  return getEthokoGlobalPath().join("config.json");
}

const GlobalEthokoConfigSchema = z.object({
  pulledArtifactsPath: z
    .string('"pulledArtifactsPath" field must be a string or left empty')
    .min(
      1,
      '"pulledArtifactsPath" cannot be an empty string. Provide a valid relative path to "~/.ethoko" or leave it empty to use the default path.',
    )
    .refine(
      (value) => value !== "config.json",
      '"pulledArtifactsPath" cannot be equal to "config.json". Please choose a different name for the pulled artifacts directory.',
    )
    .optional()
    .transform((value) => {
      if (!value) {
        return getEthokoGlobalPath().join("pulled-artifacts");
      }
      // If the path is relative, resolve it against the global config directory.
      // Else, return the path as is
      const relativePathResult = RelativePathSchema.safeParse(value);
      if (!relativePathResult.success) {
        return AbsolutePath.from(value);
      }
      return getEthokoGlobalPath().join(relativePathResult.data);
    }),
});

export type GlobalEthokoConfig = z.infer<typeof GlobalEthokoConfigSchema> & {
  configPath: AbsolutePath | undefined;
};

export async function loadGlobalConfig(
  configPath?: string,
): Promise<GlobalEthokoConfig> {
  const resolvedConfigPath = configPath
    ? AbsolutePath.from(configPath)
    : getEthokoGlobalConfigPath();
  const configExists = await fs
    .stat(resolvedConfigPath.resolvedPath)
    .then(() => true)
    .catch(() => false);
  if (!configExists) {
    // If the config file doesn't exist, return the default configuration
    return { ...GlobalEthokoConfigSchema.parse({}), configPath: undefined };
  }
  const configContentResult = await toAsyncResult(
    fs.readFile(resolvedConfigPath.resolvedPath, "utf-8"),
  );
  if (!configContentResult.success) {
    throw new Error(
      `Failed to read global config file at ${resolvedConfigPath.resolvedPath}: ${configContentResult.error.message}`,
    );
  }

  const jsonContentResult = toResult(() =>
    JSON.parse(configContentResult.value),
  );
  if (!jsonContentResult.success) {
    throw new Error(
      `Failed to parse global config file at ${resolvedConfigPath.resolvedPath} as JSON: ${jsonContentResult.error.message}`,
    );
  }

  const configResult = GlobalEthokoConfigSchema.safeParse(
    jsonContentResult.value,
  );
  if (!configResult.success) {
    throw new Error(
      `Global config file at ${resolvedConfigPath.resolvedPath} is invalid: ${z.prettifyError(configResult.error)}`,
    );
  }

  return { ...configResult.data, configPath: resolvedConfigPath };
}
