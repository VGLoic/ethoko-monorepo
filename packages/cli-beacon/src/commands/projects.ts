import { styleText } from "node:util";
import { Command } from "commander";
import { LOG_COLORS, CommandLogger } from "@/ui/index.js";
import { toAsyncResult } from "@/utils/result.js";

import type { EthokoCliConfig } from "../config";
import type { ProjectConfig } from "../config/projects";

type GetConfig = () => Promise<EthokoCliConfig>;

export function registerProjectsCommand(
  program: Command,
  getConfig: GetConfig,
): void {
  program
    .command("projects")
    .description("List available projects")
    .option("--silent", "Suppress output", false)
    .action(async (options) => {
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
      const { projects, localProjectNames, globalProjectNames } = config;

      if (projects.length === 0) {
        logger
          .intro("Projects")
          .info(
            'No projects defined. Add a "projects" array to your ethoko.config.json or global config.',
          )
          .outro();
        return;
      }

      logger.intro(`Projects (${projects.length} total)`);

      const lines: string[] = [""];
      for (const project of projects) {
        const sourceLabel = getSourceLabel(
          project.name,
          localProjectNames,
          globalProjectNames,
        );
        lines.push(
          styleText(
            ["bold", LOG_COLORS.log],
            `  • ${project.name} ${styleText("dim", sourceLabel)}`,
          ),
        );
        lines.push(
          styleText(LOG_COLORS.log, `    Storage: ${storageLabel(project)}`),
        );
        lines.push("");
      }

      logger.note(lines.join("\n")).outro();
    });
}

function getSourceLabel(
  name: string,
  localNames: ReadonlySet<string>,
  globalNames: ReadonlySet<string>,
): string {
  const inLocal = localNames.has(name);
  const inGlobal = globalNames.has(name);
  if (inLocal && inGlobal) return "[local - overrides global]";
  if (inLocal) return "[local]";
  return "[global]";
}

function storageLabel(project: ProjectConfig): string {
  const { storage } = project;
  if (storage.type === "aws") {
    return `AWS S3 (${storage.region}, bucket: ${storage.bucketName})`;
  }
  return `Filesystem (${storage.path})`;
}
