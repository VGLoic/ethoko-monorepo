import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { z } from "zod";
import {
  boxHeader,
  error as cliError,
  displayDifferences,
} from "@soko/core/cli-ui";
import { CliError, generateDiffWithTargetRelease } from "@soko/core/cli-client";
import { LocalStorage } from "@soko/core/local-storage";

interface DiffTaskArguments {
  artifactPath?: string;
  id?: string;
  tag?: string;
  debug?: boolean;
}

export default async function (
  taskArguments: DiffTaskArguments,
  hre: HardhatRuntimeEnvironment,
) {
  const sokoConfig = hre.config.ethoko;
  if (!sokoConfig) {
    cliError("Soko is not configured");
    process.exitCode = 1;
    return;
  }

  const paramParsingResult = z
    .object({
      artifactPath: z.string().min(1).optional(),
      id: z.string().optional(),
      tag: z.string().optional(),
      debug: z.boolean().default(sokoConfig.debug),
    })
    .safeParse(taskArguments);
  if (!paramParsingResult.success) {
    cliError("Invalid arguments");
    if (sokoConfig.debug) {
      console.error(paramParsingResult.error);
    }
    process.exitCode = 1;
    return;
  }
  if (paramParsingResult.data.id && paramParsingResult.data.tag) {
    cliError("The ID and tag parameters can not be used together");
    process.exitCode = 1;
    return;
  }

  if (!paramParsingResult.data.id && !paramParsingResult.data.tag) {
    cliError("The artifact must be identified by a tag or an ID");
    process.exitCode = 1;
    return;
  }

  const finalArtifactPath =
    paramParsingResult.data.artifactPath || sokoConfig.compilationOutputPath;

  if (!finalArtifactPath) {
    cliError(
      "Artifact path must be provided either via --artifact-path flag or compilationOutputPath in config",
    );
    process.exitCode = 1;
    return;
  }

  const tagOrId = paramParsingResult.data.id || paramParsingResult.data.tag;
  if (!tagOrId) {
    cliError("The artifact must be identified by a tag or an ID");
    process.exitCode = 1;
    return;
  }

  boxHeader(`Comparing with artifact "${sokoConfig.project}:${tagOrId}"`);

  const localStorage = new LocalStorage(sokoConfig.pulledArtifactsPath);

  await generateDiffWithTargetRelease(
    finalArtifactPath,
    { project: sokoConfig.project, tagOrId },
    localStorage,
    {
      debug: paramParsingResult.data.debug,
      isCI: process.env.CI === "true" || process.env.CI === "1",
    },
  )
    .then(displayDifferences)
    .catch((err) => {
      if (err instanceof CliError) {
        cliError(err.message);
      } else {
        cliError(
          "An unexpected error occurred, please fill an issue with the error details if the problem persists",
        );
        console.error(err);
      }
      process.exitCode = 1;
    });
}
