import fs from "node:fs/promises";
import { PulledArtifactStore } from "@/pulled-artifact-store";
import { StorageProvider } from "@/storage-provider";
import { toAsyncResult } from "@/utils/result";
import { CliError } from "./error";
import { CommandLogger } from "@/ui";
import { AbsolutePath, RelativePath } from "@/utils/path";
import { ResolvedArtifactKey } from "@/utils/artifact-key";

export type RestoreResult = {
  project: string;
  tag: string | null;
  id: string;
  filesRestored: RelativePath[];
  outputPath: AbsolutePath;
};

/**
 * Restore original compilation artifacts to an input local destination
 * @param artifactKey Project, ID and optionally tag of the artifact
 * @param outputPath The local path where the artifacts will be restored
 * @param storageProvider The storage provider
 * @param pulledArtifactStore Pulled artifact store
 * @param opts Options
 * @param opts.force Whether or not the method should overwrite the output dir if existing
 * @param opts.debug Debug mode
 * @param opts.logger Command logger
 * @throws CliError in case of error
 */
export async function restore(
  artifactKey: ResolvedArtifactKey,
  outputPath: AbsolutePath,
  storageProvider: StorageProvider,
  pulledArtifactStore: PulledArtifactStore,
  opts: { force: boolean; debug: boolean; logger: CommandLogger },
): Promise<RestoreResult> {
  const ensureResult = await toAsyncResult(
    pulledArtifactStore.ensureProjectSetup(artifactKey.project),
    { debug: opts.debug },
  );
  if (!ensureResult.success) {
    throw new CliError(
      "Error setting up pulled artifact store, is the script not allowed to write to the filesystem? Run with debug mode for more info",
    );
  }

  const spinner2 = opts.logger.createSpinner("Checking output directory...");
  const outputStatResult = await toAsyncResult(
    fs.stat(outputPath.resolvedPath),
    {
      debug: opts.debug,
    },
  );
  if (outputStatResult.success) {
    if (!outputStatResult.value.isDirectory()) {
      spinner2.fail("Output path is not a directory");
      throw new CliError(
        `Output path "${outputPath}" exists but is not a directory`,
      );
    }
    const outputEntriesResult = await toAsyncResult(
      fs.readdir(outputPath.resolvedPath),
      {
        debug: opts.debug,
      },
    );
    if (!outputEntriesResult.success) {
      spinner2.fail("Failed to read output directory");
      throw new CliError(
        `Unable to read output directory "${outputPath}". Run with debug mode for more info`,
      );
    }
    if (outputEntriesResult.value.length > 0 && !opts.force) {
      spinner2.fail("Output directory is not empty");
      throw new CliError(
        `Output directory "${outputPath}" is not empty. Use the --force flag to overwrite`,
      );
    }
    if (outputEntriesResult.value.length > 0 && opts.force) {
      const removeResult = await toAsyncResult(
        fs.rm(outputPath.resolvedPath, { recursive: true, force: true }),
        { debug: opts.debug },
      );
      if (!removeResult.success) {
        spinner2.fail("Failed to clear output directory");
        throw new CliError(
          `Unable to clear output directory "${outputPath}". Run with debug mode for more info`,
        );
      }
    }
  } else if (
    !(
      outputStatResult.error &&
      typeof outputStatResult.error === "object" &&
      "code" in outputStatResult.error &&
      outputStatResult.error.code === "ENOENT"
    )
  ) {
    spinner2.fail("Failed to access output directory");
    throw new CliError(
      `Unable to access output directory "${outputPath}". Run with debug mode for more info`,
    );
  }
  const mkdirOutputResult = await toAsyncResult(
    fs.mkdir(outputPath.resolvedPath, { recursive: true }),
    { debug: opts.debug },
  );
  if (!mkdirOutputResult.success) {
    spinner2.fail("Failed to create output directory");
    throw new CliError(
      `Unable to create output directory "${outputPath}". Run with debug mode for more info`,
    );
  }
  spinner2.succeed("Output directory ready");

  const spinner3 = opts.logger.createSpinner("Listing original content...");
  const originalContentResult = await toAsyncResult(
    storageProvider.listOriginalContent(artifactKey.project, artifactKey.id),
    { debug: opts.debug },
  );
  if (!originalContentResult.success) {
    spinner3.fail("Failed to list original content");
    throw new CliError(
      "Unable to list original content files from the storage. Run with debug mode for more info",
    );
  }
  const originalContentPaths = originalContentResult.value;
  if (originalContentPaths.length === 0) {
    spinner3.fail("No original content files found");
    throw new CliError(
      "No original content files were found for this artifact. Run with debug mode for more info",
    );
  }
  spinner3.succeed(`Found ${originalContentPaths.length} files`);

  const spinner4 = opts.logger.createSpinner(
    `Downloading ${originalContentPaths.length} file${originalContentPaths.length > 1 ? "s" : ""}...`,
  );
  const downloadResults = await Promise.all(
    originalContentPaths.map(async (relativePath) => {
      const downloadResult = await toAsyncResult(
        storageProvider.downloadOriginalContent(
          artifactKey.project,
          artifactKey.id,
          relativePath,
        ),
        { debug: opts.debug },
      );
      if (!downloadResult.success) {
        throw new CliError(
          `Unable to download original content file "${relativePath}". Run with debug mode for more info`,
        );
      }

      const targetPath = outputPath.join(relativePath);
      const mkdirResult = await toAsyncResult(
        fs.mkdir(targetPath.dirname().resolvedPath, { recursive: true }),
        { debug: opts.debug },
      );
      if (!mkdirResult.success) {
        throw new CliError(
          `Unable to create directory for "${targetPath}". Run with debug mode for more info`,
        );
      }

      const writeResult = await toAsyncResult(
        fs.writeFile(targetPath.resolvedPath, downloadResult.value),
        { debug: opts.debug },
      );
      if (!writeResult.success) {
        throw new CliError(
          `Unable to write file "${targetPath}". Run with debug mode for more info`,
        );
      }

      return relativePath;
    }),
  );

  spinner4.succeed(
    `Downloaded ${downloadResults.length} file${downloadResults.length > 1 ? "s" : ""}`,
  );

  return {
    project: artifactKey.project,
    tag: artifactKey.tag,
    id: artifactKey.id,
    filesRestored: downloadResults,
    outputPath,
  };
}
