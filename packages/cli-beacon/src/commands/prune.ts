import { Command } from "commander";
import { CommandLogger } from "@/ui";
import { toAsyncResult } from "@/utils/result";
import { PulledArtifactStore } from "@/pulled-artifact-store";
import { ArtifactKeySchema } from "./utils/parse-artifact-key";
import type { EthokoCliConfig } from "../config";
import {
  CliError,
  pruneArtifactById,
  pruneArtifactByTag,
  pruneOrphanedAndUntaggedArtifacts,
  pruneProjectArtifacts,
} from "@/client";

type GetConfig = () => Promise<EthokoCliConfig>;

export function registerPruneCommand(
  program: Command,
  getConfig: GetConfig,
): void {
  program
    .command("prune")
    .description("Remove pulled artifacts from the local cache")
    .argument("[artifact-key]", "PROJECT, PROJECT:TAG, or PROJECT@ID to prune")
    .option(
      "--dry-run",
      "Preview what would be removed without deleting",
      false,
    )
    .option("--debug", "Enable debug logging", false)
    .option("--silent", "Suppress output", false)
    .action(async (artifactKey: string | undefined, options) => {
      const debug = options.debug as boolean;
      const logger = new CommandLogger(options.silent);

      const configResult = await toAsyncResult(getConfig(), { debug });
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
      const store = new PulledArtifactStore(config.pulledArtifactsPath);
      const dryRun = Boolean(options.dryRun);

      if (!artifactKey) {
        logger.intro("Pruning orphaned and untagged artifacts");
        await pruneOrphanedAndUntaggedArtifacts(store, config, {
          logger,
          dryRun,
          debug,
        })
          .then((prunedArtifacts) => {
            displayPrunedArtifacts(prunedArtifacts, logger, dryRun);
            logger.outro();
          })
          .catch((error) => {
            if (error instanceof CliError) {
              logger.error(error.message);
            } else {
              logger.error(
                "An unexpected error occurred, please fill an issue with the error details if the problem persists",
              );
              console.error(error);
            }
            process.exitCode = 1;
          });
        return;
      }

      const parsedKeyResult = ArtifactKeySchema.safeParse(artifactKey);
      if (!parsedKeyResult.success) {
        logger.error(
          `Invalid artifact argument:\nThe artifact argument must be a string in the format PROJECT[:TAG|@ID]`,
        );
        process.exitCode = 1;
        return;
      }

      if (!parsedKeyResult.data.artifact) {
        logger.intro(
          `Pruning all artifacts for project "${parsedKeyResult.data.project}"`,
        );
        await pruneProjectArtifacts(store, parsedKeyResult.data.project, {
          logger,
          dryRun,
          debug,
        })
          .then((prunedArtifacts) => {
            displayPrunedArtifacts(prunedArtifacts, logger, dryRun);
            logger.outro();
          })
          .catch((error) => {
            if (error instanceof CliError) {
              logger.error(error.message);
            } else {
              logger.error(
                "An unexpected error occurred, please fill an issue with the error details if the problem persists",
              );
              console.error(error);
            }
            process.exitCode = 1;
          });
        return;
      }

      if (parsedKeyResult.data.artifact.type === "tag") {
        logger.intro(
          `Pruning "${parsedKeyResult.data.project}:${parsedKeyResult.data.artifact.tag}"`,
        );
        await pruneArtifactByTag(
          store,
          parsedKeyResult.data.project,
          parsedKeyResult.data.artifact.tag,
          {
            logger,
            dryRun,
            debug,
          },
        )
          .then((prunedArtifacts) => {
            displayPrunedArtifacts(prunedArtifacts, logger, dryRun);
            logger.outro();
          })
          .catch((error) => {
            if (error instanceof CliError) {
              logger.error(error.message);
            } else {
              logger.error(
                "An unexpected error occurred, please fill an issue with the error details if the problem persists",
              );
              console.error(error);
            }
            process.exitCode = 1;
          });
        return;
      }

      logger.intro(
        `Pruning "${parsedKeyResult.data.project}@${parsedKeyResult.data.artifact.id}"`,
      );
      await pruneArtifactById(
        store,
        parsedKeyResult.data.project,
        parsedKeyResult.data.artifact.id,
        { logger, dryRun, debug },
      )
        .then((prunedArtifacts) => {
          displayPrunedArtifacts(prunedArtifacts, logger, dryRun);
          logger.outro();
        })
        .catch((error) => {
          if (error instanceof CliError) {
            logger.error(error.message);
          } else {
            logger.error(
              "An unexpected error occurred, please fill an issue with the error details if the problem persists",
            );
            console.error(error);
          }
          process.exitCode = 1;
        });
    });
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)}GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(2)}MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(2)}KB`;
  return `${bytes}B`;
}

function displayPrunedArtifacts(
  prunedArtifacts: {
    project: string;
    id: string;
    tag: string | null;
    size: number;
  }[],
  logger: CommandLogger,
  dryRun: boolean,
): void {
  if (prunedArtifacts.length === 0) {
    logger.success(
      dryRun ? "No artifacts would be pruned." : "No artifacts found to prune.",
    );
    return;
  }

  const lines = prunedArtifacts.map(({ project, id, tag, size }) =>
    tag
      ? `• ${project}:${tag} (ID: ${id}, ${formatBytes(size)})`
      : `• ${project}@${id} (${formatBytes(size)})`,
  );

  logger.note(
    lines.join("\n"),
    dryRun ? "Artifacts that would be pruned" : "Pruned artifacts",
  );
}
