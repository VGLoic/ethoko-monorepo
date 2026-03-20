import { AbsolutePath } from "@/utils/path";
import type { ProjectConfig } from "./projects";
import { GlobalEthokoConfig, loadGlobalConfig } from "./global-config";
import { loadLocalConfig, LocalEthokoConfig } from "./local-config";
import { toAsyncResult } from "@/utils/result";

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
