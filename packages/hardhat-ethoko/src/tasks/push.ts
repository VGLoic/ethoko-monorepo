import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { z } from "zod";
import {
  boxHeader,
  error as cliError,
  displayPushResult,
} from "@ethoko/core/cli-ui";
import { CliError, push } from "@ethoko/core/cli-client";
import {
  LocalStorageProvider,
  S3BucketProvider,
} from "@ethoko/core/storage-provider";

interface PushTaskArguments {
  artifactPath?: string;
  tag?: string;
  force?: boolean;
  debug?: boolean;
  silent?: boolean;
}

export default async function (
  taskArguments: PushTaskArguments,
  hre: HardhatRuntimeEnvironment,
) {
  const ethokoConfig = hre.config.ethoko;
  if (!ethokoConfig) {
    cliError("Ethoko is not configured");
    process.exitCode = 1;
    return;
  }

  const optsParsingResult = z
    .object({
      artifactPath: z.string().min(1).optional(),
      tag: z.string().optional(),
      force: z.boolean().default(false),
      debug: z.boolean().default(ethokoConfig.debug),
      silent: z.boolean().default(false),
    })
    .safeParse(taskArguments);

  if (!optsParsingResult.success) {
    cliError("Invalid arguments");
    if (ethokoConfig.debug) {
      console.error(optsParsingResult.error);
    }
    process.exitCode = 1;
    return;
  }

  const finalArtifactPath =
    optsParsingResult.data.artifactPath || ethokoConfig.compilationOutputPath;

  if (!finalArtifactPath) {
    cliError(
      "Artifact path must be provided either via --artifact-path flag or compilationOutputPath in config",
    );
    process.exitCode = 1;
    return;
  }

  boxHeader(
    `Pushing artifact to "${ethokoConfig.project}"${optsParsingResult.data.tag ? ` with tag "${optsParsingResult.data.tag}"` : ""}`,
    optsParsingResult.data.silent,
  );

  const storageProvider =
    ethokoConfig.storageConfiguration.type === "aws"
      ? new S3BucketProvider({
          bucketName: ethokoConfig.storageConfiguration.awsBucketName,
          bucketRegion: ethokoConfig.storageConfiguration.awsRegion,
          accessKeyId: ethokoConfig.storageConfiguration.awsAccessKeyId,
          secretAccessKey: ethokoConfig.storageConfiguration.awsSecretAccessKey,
          role: ethokoConfig.storageConfiguration.awsRole,
          debug: optsParsingResult.data.debug,
        })
      : new LocalStorageProvider({
          path: ethokoConfig.storageConfiguration.path,
          debug: optsParsingResult.data.debug,
        });

  await push(
    finalArtifactPath,
    ethokoConfig.project,
    optsParsingResult.data.tag,
    storageProvider,
    {
      force: optsParsingResult.data.force,
      debug: ethokoConfig.debug || optsParsingResult.data.debug,
      isCI: process.env.CI === "true" || process.env.CI === "1",
      silent: optsParsingResult.data.silent,
    },
  )
    .then((result) =>
      displayPushResult(
        ethokoConfig.project,
        optsParsingResult.data.tag,
        result,
        optsParsingResult.data.silent,
      ),
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
