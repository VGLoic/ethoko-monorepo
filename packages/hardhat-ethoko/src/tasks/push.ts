import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { z } from "zod";
import {
  boxHeader,
  error as cliError,
  displayPushResult,
} from "@soko/core/cli-ui";
import { CliError, push } from "@soko/core/cli-client";
import {
  LocalStorageProvider,
  S3BucketProvider,
} from "@soko/core/storage-provider";

interface PushTaskArguments {
  artifactPath?: string;
  tag?: string;
  force?: boolean;
  debug?: boolean;
}

export default async function (
  taskArguments: PushTaskArguments,
  hre: HardhatRuntimeEnvironment,
) {
  const sokoConfig = hre.config.ethoko;
  if (!sokoConfig) {
    cliError("Ethoko is not configured");
    process.exitCode = 1;
    return;
  }

  const optsParsingResult = z
    .object({
      artifactPath: z.string().min(1).optional(),
      tag: z.string().optional(),
      force: z.boolean().default(false),
      debug: z.boolean().default(sokoConfig.debug),
    })
    .safeParse(taskArguments);

  if (!optsParsingResult.success) {
    cliError("Invalid arguments");
    if (sokoConfig.debug) {
      console.error(optsParsingResult.error);
    }
    process.exitCode = 1;
    return;
  }

  const finalArtifactPath =
    optsParsingResult.data.artifactPath || sokoConfig.compilationOutputPath;

  if (!finalArtifactPath) {
    cliError(
      "Artifact path must be provided either via --artifact-path flag or compilationOutputPath in config",
    );
    process.exitCode = 1;
    return;
  }

  boxHeader(
    `Pushing artifact to "${sokoConfig.project}"${optsParsingResult.data.tag ? ` with tag "${optsParsingResult.data.tag}"` : ""}`,
  );

  const storageProvider =
    sokoConfig.storageConfiguration.type === "aws"
      ? new S3BucketProvider({
          bucketName: sokoConfig.storageConfiguration.awsBucketName,
          bucketRegion: sokoConfig.storageConfiguration.awsRegion,
          accessKeyId: sokoConfig.storageConfiguration.awsAccessKeyId,
          secretAccessKey: sokoConfig.storageConfiguration.awsSecretAccessKey,
          role: sokoConfig.storageConfiguration.awsRole,
          debug: optsParsingResult.data.debug,
        })
      : new LocalStorageProvider({
          path: sokoConfig.storageConfiguration.path,
          debug: optsParsingResult.data.debug,
        });

  await push(
    finalArtifactPath,
    sokoConfig.project,
    optsParsingResult.data.tag,
    storageProvider,
    {
      force: optsParsingResult.data.force,
      debug: sokoConfig.debug || optsParsingResult.data.debug,
      isCI: process.env.CI === "true" || process.env.CI === "1",
    },
  )
    .then((result) =>
      displayPushResult(sokoConfig.project, optsParsingResult.data.tag, result),
    )
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
