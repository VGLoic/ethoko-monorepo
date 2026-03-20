import { AbsolutePath } from "@/utils/path";
import { generateProjectConfigSchema, type ProjectConfig } from "./projects";
import { GlobalEthokoConfig, loadGlobalConfig } from "./global-config";
import { loadLocalConfig, LocalEthokoConfig } from "./local-config";
import { toAsyncResult } from "@/utils/result";
import z from "zod";

export type EthokoStorageConfig = ProjectConfig["storage"];

export class EthokoCliConfig {
  public pulledArtifactsPath: AbsolutePath;
  public typingsPath: AbsolutePath;
  public compilationOutputPath: AbsolutePath | undefined;
  public projects: ProjectConfig[];
  public localConfigPath: AbsolutePath | undefined;
  public globalConfigPath: AbsolutePath | undefined;
  public debug: boolean;

  constructor(config: EthokoConfig) {
    this.pulledArtifactsPath = config.pulledArtifactsPath;
    this.typingsPath = config.typingsPath;
    this.compilationOutputPath = config.compilationOutputPath;
    this.debug = config.debug;
    this.projects = config.projects;
    this.localConfigPath = config.localConfigPath;
    this.globalConfigPath = config.globalConfigPath;
  }

  public getProjectConfig(project: string): ProjectConfig | undefined {
    return this.projects.find((p) => p.name === project);
  }
}

const AbsolutePathSchema = z.instanceof(AbsolutePath, {
  message: "Path must be an absolute path",
});

const MergedEthokoConfigSchema = z
  .object({
    pulledArtifactsPath: AbsolutePathSchema,
    typingsPath: AbsolutePathSchema,
    compilationOutputPath: AbsolutePathSchema.optional(),
    projects: z.array(
      generateProjectConfigSchema({ requireAbsolutePath: true }),
    ),
    debug: z.boolean(),
  })
  .superRefine((data, ctx) => {
    // Typings path and pulled artifacts path must not be a parent-child relationship
    if (
      data.pulledArtifactsPath.eq(data.typingsPath) ||
      data.pulledArtifactsPath.isChildOf(data.typingsPath) ||
      data.typingsPath.isChildOf(data.pulledArtifactsPath)
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          '"typingsPath" and "pulledArtifactsPath" cannot be in a parent-child relationship',
      });
    }
    // In case of storage type "filesystem", the storage path must not be a child or parent of typings path or pulled artifacts path
    for (const project of data.projects) {
      if (project.storage.type === "filesystem") {
        if (
          project.storage.path.isChildOf(data.typingsPath) ||
          data.typingsPath.isChildOf(project.storage.path) ||
          project.storage.path.eq(data.typingsPath)
        ) {
          ctx.addIssue({
            code: "custom",
            message: `For project "${project.name}", the "storage.path" cannot be a child or parent of "typingsPath".`,
            input: data,
          });
        }
        if (
          data.pulledArtifactsPath &&
          (project.storage.path.isChildOf(data.pulledArtifactsPath) ||
            data.pulledArtifactsPath.isChildOf(project.storage.path) ||
            project.storage.path.eq(data.pulledArtifactsPath))
        ) {
          ctx.addIssue({
            code: "custom",
            message: `For project "${project.name}", the "storage.path" cannot be a child or parent of "pulledArtifactsPath".`,
            input: data,
          });
        }
      }
    }
  });

interface EthokoConfig {
  pulledArtifactsPath: AbsolutePath;
  typingsPath: AbsolutePath;
  compilationOutputPath: AbsolutePath | undefined;
  projects: ProjectConfig[];
  debug: boolean;
  localConfigPath: AbsolutePath | undefined;
  globalConfigPath: AbsolutePath | undefined;
}

export async function loadConfig(
  args: {
    globalConfigPath?: string;
    localConfigPath?: string;
  } = {},
): Promise<EthokoCliConfig> {
  const globalConfigResult = await toAsyncResult(
    loadGlobalConfig(args.globalConfigPath),
  );
  if (!globalConfigResult.success) {
    throw new Error(
      `Failed to load global config: ${globalConfigResult.error.message}`,
    );
  }
  const localConfigResult = await toAsyncResult(
    loadLocalConfig(args.localConfigPath),
  );
  if (!localConfigResult.success) {
    throw new Error(
      `Failed to load local config: ${localConfigResult.error.message}`,
    );
  }

  const mergeConfig = mergeConfigs(
    globalConfigResult.value,
    localConfigResult.value,
  );

  const validationResult = MergedEthokoConfigSchema.safeParse(mergeConfig);
  if (!validationResult.success) {
    throw new Error(
      `Failed to merge config: ${z.prettifyError(validationResult.error)}`,
    );
  }

  return new EthokoCliConfig(mergeConfig);
}

function mergeConfigs(
  globalConfig: GlobalEthokoConfig,
  localConfig: LocalEthokoConfig,
): EthokoConfig {
  const mergedProjects = [...localConfig.projects];
  for (const globalProject of globalConfig.projects) {
    if (!localConfig.projects.some((p) => p.name === globalProject.name)) {
      mergedProjects.push(globalProject);
    }
  }
  return {
    pulledArtifactsPath:
      localConfig.pulledArtifactsPath || globalConfig.pulledArtifactsPath,
    typingsPath: localConfig.typingsPath,
    compilationOutputPath: localConfig.compilationOutputPath,
    projects: mergedProjects,
    debug: localConfig.debug,
    localConfigPath: localConfig.configPath,
    globalConfigPath: globalConfig.configPath,
  };
}
