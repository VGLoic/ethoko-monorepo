import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { z } from "zod";
import { boxHeader, error as cliError } from "@soko/core/cli-ui";
import {
  CliError,
  generateArtifactsSummariesAndTypings,
} from "@soko/core/cli-client";
import { LocalStorage } from "@soko/core/local-storage";

interface TypingsTaskArguments {
  debug?: boolean;
}

export default async function (
  taskArguments: TypingsTaskArguments,
  hre: HardhatRuntimeEnvironment,
) {
  const sokoConfig = hre.config.ethoko;
  if (!sokoConfig) {
    cliError("Ethoko is not configured");
    process.exitCode = 1;
    return;
  }

  const parsingResult = z
    .object({
      debug: z.boolean().default(sokoConfig.debug),
    })
    .safeParse(taskArguments);

  if (!parsingResult.success) {
    cliError("Invalid arguments");
    if (sokoConfig.debug) {
      console.error(parsingResult.error);
    }
    process.exitCode = 1;
    return;
  }

  boxHeader("Generating typings");

  const localStorage = new LocalStorage(sokoConfig.pulledArtifactsPath);

  await generateArtifactsSummariesAndTypings(
    sokoConfig.typingsPath,
    localStorage,
    {
      debug: parsingResult.data.debug,
    },
  )
    .then(() => {
      console.error("");
    })
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
