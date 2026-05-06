import { styleText } from "node:util";
import { Command } from "commander";
import { z } from "zod";
import { LOG_COLORS, CommandLogger } from "@/ui";
import {
  CliError,
  inspectArtifact,
  InspectResult,
  pullArtifact,
  resolveLocalArtifact,
} from "@/client";
import { LocalArtifactStore } from "@/local-artifact-store";
import type { EthokoCliConfig } from "@/config";
import { toAsyncResult } from "@/utils/result";
import { ProjectOrArtifactReferenceSchema } from "./utils/parse-project-or-artifact-ref";
import { createStorageProvider } from "./utils/storage-provider";
import { ArtifactReference } from "@/utils/artifact-reference";
import { StorageProvider } from "@/storage-provider";

type GetConfig = (configPath?: string) => Promise<EthokoCliConfig>;

export function registerInspectCommand(
  program: Command,
  getConfig: GetConfig,
): void {
  program
    .command("inspect")
    .description("Inspect a pulled artifact")
    .argument(
      "<PROJECT[:TAG|@ID]>",
      "Target project and artifact identifier (tag or ID)",
    )
    .option("--json", "Output JSON", false)
    .option("--debug", "Enable debug logging", false)
    .option("--silent", "Suppress output", false)
    .action(async (projectArg, options) => {
      const logger = new CommandLogger(options.silent);

      const configResult = await toAsyncResult(getConfig());
      if (!configResult.success) {
        logger.error(
          configResult.error instanceof Error
            ? configResult.error.message
            : String(configResult.error),
        );
        process.exitCode = 1;
        return;
      }
      const config = configResult.value;

      const artifactRefParsingResult =
        ProjectOrArtifactReferenceSchema.transform((projectOrArtifactRef) => {
          if (projectOrArtifactRef.type === "project") {
            return z.NEVER;
          }
          return projectOrArtifactRef;
        }).safeParse(projectArg);
      if (!artifactRefParsingResult.success) {
        logger.error(
          `Invalid artifact argument:\nThe artifact argument must be a string in the format PROJECT[:TAG|@ID]`,
        );
        process.exitCode = 1;
        return;
      }
      const projectConfig = config.getProjectConfig(
        artifactRefParsingResult.data.project,
      );
      if (!projectConfig) {
        logger.error(
          `Project "${artifactRefParsingResult.data.project}" not found in configuration`,
        );
        process.exitCode = 1;
        return;
      }

      const optsParsingResult = z
        .object({
          json: z.boolean('The "json" option must be a boolean').default(false),
          debug: z
            .boolean('The "debug" option must be a boolean')
            .default(config.debug),
        })
        .safeParse(options);
      if (!optsParsingResult.success) {
        logger.error(
          `Invalid command arguments:\n${z.prettifyError(optsParsingResult.error)}`,
        );
        process.exitCode = 1;
        return;
      }

      if (!optsParsingResult.data.json) {
        logger.intro(
          `Inspecting artifact "${projectConfig.name}${artifactRefParsingResult.data.type === "tag" ? `:${artifactRefParsingResult.data.tag}` : `@${artifactRefParsingResult.data.id}`}"`,
        );
      }

      const localArtifactStore = new LocalArtifactStore(
        config.localArtifactStorePath,
      );

      const storageProvider = createStorageProvider(
        projectConfig.storage,
        logger.toDebugLogger(),
        optsParsingResult.data.debug,
      );

      await runInspectCommand(
        artifactRefParsingResult.data,
        {
          storageProvider,
          localArtifactStore,
          logger,
        },
        {
          debug: optsParsingResult.data.debug,
        },
      ).catch((err) => {
        if (err instanceof CliError) {
          logger.error(err.message);
        } else {
          logger.error(
            "An unexpected error occurred, please fill an issue with the error details if the problem persists",
          );
          console.error(err);
        }
        process.exitCode = 1;
      });
    });
}

export async function runInspectCommand(
  artifactRef: ArtifactReference,
  dependencies: {
    storageProvider: StorageProvider;
    localArtifactStore: LocalArtifactStore;
    logger: CommandLogger;
  },
  opts: { debug: boolean; json?: boolean },
): Promise<InspectResult> {
  let resolvedArtifactRef = await resolveLocalArtifact(
    artifactRef,
    dependencies.localArtifactStore,
    { debug: opts.debug },
  );
  if (!resolvedArtifactRef) {
    const artifactLabel = `${artifactRef.project}${
      artifactRef.type === "id" ? `@${artifactRef.id}` : `:${artifactRef.tag}`
    }`;
    const pullSpinner = dependencies.logger.createSpinner(
      `Artifact "${artifactLabel}" not found locally, pulling...`,
    );
    const pulledArtifact = await pullArtifact(
      artifactRef,
      {
        storageProvider: dependencies.storageProvider,
        localArtifactStore: dependencies.localArtifactStore,
        logger: dependencies.logger.toDebugLogger(),
      },
      {
        force: false,
        debug: opts.debug,
      },
    ).catch((err) => {
      pullSpinner.fail("Failed to pull artifact");
      throw err;
    });
    pullSpinner.succeed(`Artifact "${artifactLabel}" pulled successfully`);
    resolvedArtifactRef = {
      project: artifactRef.project,
      id: pulledArtifact.id,
      tag: artifactRef.type === "tag" ? artifactRef.tag : null,
    };
  }

  const inspectResult = await inspectArtifact(
    resolvedArtifactRef,
    {
      localArtifactStore: dependencies.localArtifactStore,
      logger: dependencies.logger.toDebugLogger(),
    },
    { debug: opts.debug },
  );

  if (opts.json && !dependencies.logger.silent) {
    console.log(JSON.stringify(inspectResult, null, 2));
  } else {
    displayInspectResult(dependencies.logger, inspectResult);
  }

  return inspectResult;
}

function displayInspectResult(
  logger: CommandLogger,
  result: InspectResult,
): void {
  const summaryLines: string[] = [];
  const artifactLabel = result.tag
    ? `${result.project}:${result.tag}`
    : `${result.project}:${result.id}`;
  summaryLines.push(styleText(LOG_COLORS.log, `Artifact: ${artifactLabel}`));
  summaryLines.push(styleText(LOG_COLORS.log, `ID: ${result.id}`));
  summaryLines.push(
    styleText(LOG_COLORS.log, `Origin: ${originToLabel(result.origin)}`),
  );
  summaryLines.push("");
  summaryLines.push(styleText(["bold", LOG_COLORS.log], "Compiler Settings:"));
  summaryLines.push(
    styleText(
      LOG_COLORS.log,
      `  • Solidity: ${result.compiler.solcLongVersion}`,
    ),
  );
  summaryLines.push(
    styleText(
      LOG_COLORS.log,
      `  • Optimizer: ${result.compiler.optimizer.enabled ? "enabled" : "disabled"} (${result.compiler.optimizer.runs} runs)`,
    ),
  );
  summaryLines.push(
    styleText(LOG_COLORS.log, `  • EVM: ${result.compiler.evmVersion}`),
  );
  if (result.compiler.remappings.length > 0) {
    summaryLines.push(
      styleText(
        LOG_COLORS.log,
        `  • Remappings: ${result.compiler.remappings.join(", ")}`,
      ),
    );
  }
  summaryLines.push("");
  summaryLines.push(styleText(["bold", LOG_COLORS.log], "Source Files:"));
  for (const sourcePath of result.sourceFiles) {
    summaryLines.push(styleText(LOG_COLORS.log, `  • ${sourcePath}`));
  }
  summaryLines.push("");
  summaryLines.push(
    styleText(
      ["bold", LOG_COLORS.log],
      `Contracts (${countContracts(result)}):`,
    ),
  );
  for (const entry of result.contractsBySource) {
    for (const contractName of entry.contracts) {
      summaryLines.push(
        styleText(LOG_COLORS.log, `  • ${entry.sourcePath}:${contractName}`),
      );
    }
  }
  logger.note(summaryLines.join("\n"), "Artifact");
  logger.outro();
}

function countContracts(result: InspectResult): number {
  return result.contractsBySource.reduce(
    (total, entry) => total + entry.contracts.length,
    0,
  );
}

function originToLabel(origin: InspectResult["origin"]): string {
  if (origin.format === "hardhat-v3") {
    return `Hardhat v3 (${origin.ids.join(", ")})`;
  }
  if (origin.format === "hardhat-v2") {
    return `Hardhat v2 (${origin.id})`;
  }
  if (origin.format === "hardhat-v3-non-isolated-build") {
    return `Hardhat v3 (${origin.id})`;
  }
  return `Forge (${origin.id})`;
}
