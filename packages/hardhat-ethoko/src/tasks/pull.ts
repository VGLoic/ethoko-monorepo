import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { z } from "zod";
import {
  boxHeader,
  error as cliError,
  displayPullResults,
} from "@ethoko/core/cli-ui";
import { CliError, pull } from "@ethoko/core/cli-client";
import {
  LocalStorageProvider,
  S3BucketProvider,
} from "@ethoko/core/storage-provider";
import { LocalStorage } from "@ethoko/core/local-storage";

interface PullTaskArguments {
  id?: string;
  tag?: string;
  project?: string;
  force?: boolean;
  debug?: boolean;
  silent?: boolean;
}

export default async function (
  taskArguments: PullTaskArguments,
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
      id: z.string().optional(),
      tag: z.string().optional(),
      project: z.string().optional().default(ethokoConfig.project),
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

  if (optsParsingResult.data.id && optsParsingResult.data.tag) {
    cliError("The ID and tag parameters can not be used together");
    process.exitCode = 1;
    return;
  }

  if (optsParsingResult.data.id || optsParsingResult.data.tag) {
    boxHeader(
      `Pulling artifact "${optsParsingResult.data.project}:${optsParsingResult.data.id || optsParsingResult.data.tag}"`,
      optsParsingResult.data.silent,
    );
  } else {
    boxHeader(
      `Pulling artifacts for "${optsParsingResult.data.project}"`,
      optsParsingResult.data.silent,
    );
  }

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
  const localStorage = new LocalStorage(ethokoConfig.pulledArtifactsPath);
  await pull(
    optsParsingResult.data.project,
    optsParsingResult.data.id || optsParsingResult.data.tag,
    storageProvider,
    localStorage,
    {
      force: optsParsingResult.data.force,
      debug: ethokoConfig.debug || optsParsingResult.data.debug,
      silent: optsParsingResult.data.silent,
    },
  )
    .then((result) =>
      displayPullResults(
        optsParsingResult.data.project,
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
