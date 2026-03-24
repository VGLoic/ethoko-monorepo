import { styleText } from "node:util";
import { Command } from "commander";
import { CommandLogger } from "@/ui/index.js";
import { CliError } from "@/client/error.js";
import { toAsyncResult } from "@/utils/result.js";
import { PulledArtifactStore } from "@/pulled-artifact-store/index.js";
import { ArtifactKeySchema } from "./utils/parse-artifact-key.js";
import type { EthokoCliConfig } from "../config";

type GetConfig = () => Promise<EthokoCliConfig>;

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)}GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(2)}MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(2)}KB`;
  return `${bytes}B`;
}

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
      const dryRun = options.dryRun as boolean;

      logger.intro("Ethoko Prune");
      logger.info(
        `Pulled artifacts location: ${config.pulledArtifactsPath.resolvedPath}`,
      );

      const runResult = await toAsyncResult(
        (async () => {
          if (!artifactKey) {
            await pruneOrphaned(store, config, logger, dryRun, debug);
          } else {
            const parsed = ArtifactKeySchema.safeParse(artifactKey);
            if (!parsed.success) {
              throw new CliError(
                `Invalid artifact argument:\nThe artifact argument must be a string in the format PROJECT[:TAG|@ID]`,
              );
            }
            const key = parsed.data;
            if (!key.artifact) {
              await pruneProject(
                store,
                config,
                key.project,
                logger,
                dryRun,
                debug,
              );
            } else if (key.artifact.type === "tag") {
              await pruneTag(
                store,
                key.project,
                key.artifact.tag,
                logger,
                dryRun,
                debug,
              );
            } else {
              await pruneId(
                store,
                key.project,
                key.artifact.id,
                logger,
                dryRun,
                debug,
              );
            }
          }
        })(),
        { debug },
      );

      if (!runResult.success) {
        logger.error(
          runResult.error instanceof Error
            ? runResult.error.message
            : String(runResult.error),
        );
        process.exitCode = 1;
        return;
      }

      logger.outro();
    });
}

async function pruneOrphaned(
  store: PulledArtifactStore,
  config: EthokoCliConfig,
  logger: CommandLogger,
  dryRun: boolean,
  debug: boolean,
): Promise<void> {
  const storedProjectsResult = await toAsyncResult(store.listProjects(), {
    debug,
  });
  if (!storedProjectsResult.success) {
    throw new CliError("Failed to read pulled artifacts store.");
  }

  const orphanedProjects: string[] = [];
  const configuredStoredProjects: string[] = [];
  for (const p of storedProjectsResult.value) {
    if (config.localProjectNames.has(p) || config.globalProjectNames.has(p)) {
      configuredStoredProjects.push(p);
    } else {
      orphanedProjects.push(p);
    }
  }

  const orphanedWithSizes = await Promise.all(
    orphanedProjects.map(async (project) => ({
      project,
      size: await store.getProjectSize(project),
    })),
  );

  type UntaggedEntry = { project: string; id: string; size: number };
  const untaggedEntries: UntaggedEntry[] = [];

  for (const project of configuredStoredProjects) {
    const idsResult = await toAsyncResult(store.listIds(project), { debug });
    if (!idsResult.success) continue;
    const tagsResult = await toAsyncResult(store.listTags(project), { debug });
    if (!tagsResult.success) continue;
    const idWithTag: Set<string> = new Set(
      tagsResult.value.map(({ id }) => id),
    );
    const projectUntaggedEntries = await Promise.all(
      idsResult.value
        .filter(({ id }) => !idWithTag.has(id))
        .map(({ id }) =>
          store.getIdSize(project, id).then((size) => ({ project, id, size })),
        ),
    );
    untaggedEntries.push(...projectUntaggedEntries);
  }

  if (orphanedWithSizes.length === 0 && untaggedEntries.length === 0) {
    logger.success("Nothing to prune.");
    return;
  }

  const lines: string[] = [""];
  let totalBytes = 0;

  if (orphanedWithSizes.length > 0) {
    lines.push(styleText("dim", "  Orphaned projects (not in any config):"));
    for (const { project, size } of orphanedWithSizes) {
      totalBytes += size;
      lines.push(
        `  • ${project} ${styleText("dim", `(${formatBytes(size)})`)} `,
      );
    }
    lines.push("");
  }

  if (untaggedEntries.length > 0) {
    lines.push(styleText("dim", "  Untagged artifact IDs:"));
    for (const { project, id, size } of untaggedEntries) {
      totalBytes += size;
      lines.push(
        `  • ${project}@${id} ${styleText("dim", `(${formatBytes(size)})`)}`,
      );
    }
    lines.push("");
  }

  lines.push(`  Total: ${formatBytes(totalBytes)}`);
  lines.push("");

  logger.note(lines.join("\n"), "To be removed");

  if (dryRun) {
    logger.info("No changes made (dry-run mode)");
    return;
  }

  for (const { project } of orphanedWithSizes) {
    await store.deleteProject(project);
    logger.success(`Removed orphaned project "${project}"`);
  }

  for (const { project, id } of untaggedEntries) {
    await store.deleteId(project, id);
    logger.success(`Removed untagged ID "${id}" from "${project}"`);
  }

  logger.info(`Total space freed: ${formatBytes(totalBytes)}`);
}

async function pruneProject(
  store: PulledArtifactStore,
  config: EthokoCliConfig,
  project: string,
  logger: CommandLogger,
  dryRun: boolean,
  debug: boolean,
): Promise<void> {
  const storedProjectsResult = await toAsyncResult(store.listProjects(), {
    debug,
  });
  if (!storedProjectsResult.success) {
    throw new CliError("Failed to read pulled artifacts store.");
  }
  if (!storedProjectsResult.value.includes(project)) {
    throw new CliError(
      `Project "${project}" has no pulled artifacts in the local cache.`,
    );
  }

  if (config.getProjectConfig(project)) {
    logger.warn(
      `"${project}" is defined in your config. Its artifacts will be removed from the local cache but the project configuration will remain.`,
    );
  }

  const [tagsResult, idsResult] = await Promise.all([
    toAsyncResult(store.listTags(project), { debug }),
    toAsyncResult(store.listIds(project), { debug }),
  ]);

  const tagCount = tagsResult.success ? tagsResult.value.length : 0;
  const idCount = idsResult.success ? idsResult.value.length : 0;
  const size = await store.getProjectSize(project);

  const lines = [
    "",
    `  Project: ${project}`,
    `  Tags: ${tagCount}`,
    `  IDs: ${idCount}`,
    `  Size: ${formatBytes(size)}`,
    "",
  ];
  logger.note(lines.join("\n"), "To be removed");

  if (dryRun) {
    logger.info("No changes made (dry-run mode)");
    return;
  }

  await store.deleteProject(project);
  logger.success(
    `Removed all artifacts for "${project}" (${formatBytes(size)} freed)`,
  );
}

async function pruneTag(
  store: PulledArtifactStore,
  project: string,
  tag: string,
  logger: CommandLogger,
  dryRun: boolean,
  debug: boolean,
): Promise<void> {
  const tagExistsResult = await toAsyncResult(store.hasTag(project, tag), {
    debug,
  });
  if (!tagExistsResult.success || !tagExistsResult.value) {
    throw new CliError(`Tag "${tag}" not found for project "${project}".`);
  }

  const idResult = await toAsyncResult(store.retrieveArtifactId(project, tag), {
    debug,
  });
  if (!idResult.success) {
    throw new CliError(
      `Failed to resolve tag "${tag}" for project "${project}".`,
    );
  }
  const id = idResult.value;

  const tagsResult = await toAsyncResult(store.listTags(project), { debug });
  if (!tagsResult.success) {
    throw new CliError(
      `Failed to list tags for project "${project}". Cannot proceed with pruning tag "${tag}".`,
    );
  }
  const remainingTags = tagsResult.value.filter(
    ({ id: tagId, tag: tagName }) => tagId === id && tagName !== tag,
  );
  const idWillBeRemoved = remainingTags.length === 0;

  const idSize = idWillBeRemoved ? await store.getIdSize(project, id) : 0;

  const lines = ["", `  Tag: ${tag}`, `  Resolves to ID: ${id}`];
  if (idWillBeRemoved) {
    lines.push(
      `  ID ${id} will also be removed ${styleText("dim", "(no other tags reference it)")}`,
    );
    lines.push(`  Size freed: ${formatBytes(idSize)}`);
  } else {
    lines.push(
      styleText(
        "dim",
        `  ID ${id} will be kept (also referenced by: ${remainingTags.join(", ")})`,
      ),
    );
  }
  lines.push("");

  logger.note(lines.join("\n"), "To be removed");

  if (dryRun) {
    logger.info("No changes made (dry-run mode)");
    return;
  }

  await store.deleteTag(project, tag);
  logger.success(`Removed tag "${tag}"`);

  if (idWillBeRemoved) {
    await store.deleteId(project, id);
    logger.success(`Removed ID "${id}" (${formatBytes(idSize)} freed)`);
  }
}

async function pruneId(
  store: PulledArtifactStore,
  project: string,
  id: string,
  logger: CommandLogger,
  dryRun: boolean,
  debug: boolean,
): Promise<void> {
  const idExistsResult = await toAsyncResult(store.hasId(project, id), {
    debug,
  });
  if (!idExistsResult.success || !idExistsResult.value) {
    throw new CliError(`ID "${id}" not found for project "${project}".`);
  }

  const tagsResult = await toAsyncResult(store.listTags(project), { debug });
  if (!tagsResult.success) {
    throw new CliError(
      `Failed to list tags for project "${project}". Cannot proceed with pruning ID "${id}".`,
    );
  }
  const referencingTags = tagsResult.value
    .filter(({ id: tagId }) => tagId === id)
    .map(({ tag }) => tag);

  const size = await store.getIdSize(project, id);

  const lines = [
    "",
    `  Project: ${project}`,
    `  ID: ${id}`,
    `  Size: ${formatBytes(size)}`,
  ];
  if (referencingTags.length > 0) {
    lines.push(
      `  Tags that will also be removed: ${referencingTags.join(", ")}`,
    );
  }
  lines.push("");

  logger.note(lines.join("\n"), "To be removed");

  if (referencingTags.length > 0) {
    logger.warn(
      `This will also remove ${referencingTags.length} tag(s): ${referencingTags.join(", ")}`,
    );
  }

  if (dryRun) {
    logger.info("No changes made (dry-run mode)");
    return;
  }

  for (const tag of referencingTags) {
    await store.deleteTag(project, tag);
  }
  await store.deleteId(project, id);
  logger.success(`Removed ID "${id}" (${formatBytes(size)} freed)`);
}
