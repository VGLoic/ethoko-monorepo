import { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { z } from "zod";
import {
  boxHeader,
  displayInspectResult,
  displayInspectResultJson,
  error as cliError,
} from "@ethoko/core/cli-ui";
import { CliError, inspectArtifact } from "@ethoko/core/cli-client";
import { LocalStorage } from "@ethoko/core/local-storage";

interface InspectTaskArguments {
  id?: string;
  tag?: string;
  project?: string;
  json?: boolean;
  debug?: boolean;
  silent?: boolean;
}

export default async function (
  taskArguments: InspectTaskArguments,
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
      json: z.boolean().default(false),
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

  let search: { type: "tag"; tag: string } | { type: "id"; id: string };
  if (optsParsingResult.data.id) {
    search = { type: "id", id: optsParsingResult.data.id };
  } else if (optsParsingResult.data.tag) {
    search = { type: "tag", tag: optsParsingResult.data.tag! };
  } else {
    cliError("The artifact must be identified by a tag or an ID");
    process.exitCode = 1;
    return;
  }

  boxHeader(
    `Inspecting artifact "${optsParsingResult.data.project}:${search.type === "tag" ? search.tag : search.id}"`,
    optsParsingResult.data.silent,
  );

  const localStorage = new LocalStorage(ethokoConfig.pulledArtifactsPath);

  await inspectArtifact(
    { project: optsParsingResult.data.project, search },
    localStorage,
    {
      debug: optsParsingResult.data.debug,
      silent: optsParsingResult.data.silent,
    },
  )
    .then((result) => {
      if (optsParsingResult.data.json) {
        displayInspectResultJson(result, optsParsingResult.data.silent);
      } else {
        displayInspectResult(result, optsParsingResult.data.silent);
      }
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
