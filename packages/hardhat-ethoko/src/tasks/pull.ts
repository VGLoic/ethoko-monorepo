import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { z } from "zod";
import {
  boxHeader,
  error as cliError,
  displayPullResults,
} from "@soko/core/cli-ui";
import { CliError, pull } from "@soko/core/cli-client";
import {
  LocalStorageProvider,
  S3BucketProvider,
} from "@soko/core/storage-provider";
import { LocalStorage } from "@soko/core/local-storage";

interface PullTaskArguments {
  id?: string;
  tag?: string;
  project?: string;
  force?: boolean;
  debug?: boolean;
}

export default async function (
  taskArguments: PullTaskArguments,
  hre: HardhatRuntimeEnvironment,
) {
  const sokoConfig = hre.config.soko;
  if (!sokoConfig) {
    cliError("Soko is not configured");
    process.exitCode = 1;
    return;
  }

  const optsParsingResult = z
    .object({
      id: z.string().optional(),
      tag: z.string().optional(),
      project: z.string().optional().default(sokoConfig.project),
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

  if (optsParsingResult.data.id && optsParsingResult.data.tag) {
    cliError("The ID and tag parameters can not be used together");
    process.exitCode = 1;
    return;
  }

  if (optsParsingResult.data.id || optsParsingResult.data.tag) {
    boxHeader(
      `Pulling artifact "${optsParsingResult.data.project}:${optsParsingResult.data.id || optsParsingResult.data.tag}"`,
    );
  } else {
    boxHeader(`Pulling artifacts for "${optsParsingResult.data.project}"`);
  }

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
  const localStorage = new LocalStorage(sokoConfig.pulledArtifactsPath);
  await pull(
    optsParsingResult.data.project,
    optsParsingResult.data.id || optsParsingResult.data.tag,
    storageProvider,
    localStorage,
    {
      force: optsParsingResult.data.force,
      debug: sokoConfig.debug || optsParsingResult.data.debug,
    },
  )
    .then((result) =>
      displayPullResults(optsParsingResult.data.project, result),
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
