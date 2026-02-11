import "hardhat/types/config";
import { extendConfig, scope } from "hardhat/config";
import { HardhatConfig, HardhatUserConfig } from "hardhat/types/config";
import { z } from "zod";
import { styleText } from "node:util";
import { LocalStorage } from "@ethoko/core/local-storage";
import {
  LocalStorageProvider,
  S3BucketProvider,
} from "@ethoko/core/storage-provider";
import {
  boxHeader,
  error as cliError,
  info as cliInfo,
  displayListResults,
  displayPullResults,
  displayPushResult,
  displayDifferences,
} from "@ethoko/core/cli-ui";
import {
  CliError,
  generateArtifactsSummariesAndTypings,
  generateDiffWithTargetRelease,
  listPulledArtifacts,
  pull,
  push,
} from "@ethoko/core/cli-client";
import { EthokoHardhatConfigSchema, EthokoHardhatUserConfig } from "./config";

export { type EthokoHardhatUserConfig };

declare module "hardhat/types/config" {
  export interface HardhatUserConfig {
    ethoko?: EthokoHardhatUserConfig;
  }

  export interface HardhatConfig {
    ethoko?: z.infer<typeof EthokoHardhatConfigSchema>;
  }
}

extendConfig(
  (config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
    if (userConfig.ethoko === undefined) {
      config.ethoko = undefined;
      return;
    }

    const ethokoParsingResult = EthokoHardhatConfigSchema.safeParse(
      userConfig.ethoko,
    );

    if (!ethokoParsingResult.success) {
      console.error(
        styleText(
          LOG_COLORS.warn,
          `Configuration for Ethoko has been found but seems invalid. Please consult the below errors: \n${ethokoParsingResult.error.errors.map(
            (error) => {
              return `  - ${error.path.join(".")}: ${error.message} (${error.code})`;
            },
          )}`,
        ),
      );
      return;
    }

    config.ethoko = ethokoParsingResult.data;
  },
);

const ethokoScope = scope("ethoko", "Ethoko Hardhat tasks");

ethokoScope
  .task("pull", "Pull one or many artifacts of a project.")
  .setDescription(
    `Pull one or many artifacts of a project.

By default, the project is the one configured in the Hardhat configuration.

One artifact can be pulled by tag
  npx hardhat ethoko pull --tag v1.2.3
or by ID
  npx hardhat ethoko pull --id dcauXtavGLxC

All artifacts for a project can be downloaded
  npx hardhat ethoko pull

A different project can be specified
  npx hardhat ethoko pull --project another-project

Already downloaded artifacts are not downloaded again by default, enable the force flag to force the download.


`,
  )
  .addOptionalParam(
    "id",
    "The ID of the artifact to pull, can not be used with the `tag` parameter",
  )
  .addOptionalParam(
    "tag",
    "The tag of the artifact to pull, can not be used with the `id` parameter",
  )
  .addOptionalParam(
    "project",
    "The project to pull the artifacts from, defaults to the configured project",
  )
  .addFlag(
    "force",
    "Force the pull of the artifacts, replacing previously downloaded ones",
  )
  .addFlag("debug", "Enable debug mode")
  .setAction(async (opts, hre) => {
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
      })
      .safeParse(opts);
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
      );
    } else {
      boxHeader(`Pulling artifacts for "${optsParsingResult.data.project}"`);
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
  });

ethokoScope
  .task("push", "Push a compilation artifact.")
  .setDescription(
    `Push a compilation artifact.

The artifact will be stored in the configured project. An identifier is derived for the artifact.
  npx hardhat ethoko push --artifact-path ./path/to-my-artifact/artifact.json

If a compilationOutputPath is configured, the --artifact-path flag is optional:
  npx hardhat ethoko push --tag v1.2.3

If a tag is provided, the artifact will also be identified by it:
  npx hardhat ethoko push --artifact-path ./path/to-my-artifact/artifact.json --tag v1.2.3

If the provided tag already exists in the storage, the push will be aborted unless the force flag is enabled.
`,
  )
  .addOptionalParam("artifactPath", "The compilation artifact path to push")
  .addOptionalParam("tag", "Tag of the artifact")
  .addFlag(
    "force",
    "Force the push of the artifact even if it already exists in the storage",
  )
  .addFlag("debug", "Enable debug mode")
  .setAction(async (opts, hre) => {
    const ethokoConfig = hre.config.ethoko;
    if (!ethokoConfig) {
      cliError("Ethoko is not configured");
      process.exitCode = 1;
      return;
    }

    const optsParsingResult = z
      .object({
        artifactPath: z.string().min(1).optional(),
        tag: z.string().optional(),
        force: z.boolean().default(false),
        debug: z.boolean().default(ethokoConfig.debug),
      })
      .safeParse(opts);

    if (!optsParsingResult.success) {
      cliError("Invalid arguments");
      if (ethokoConfig.debug) {
        console.error(optsParsingResult.error);
      }
      process.exitCode = 1;
      return;
    }

    const finalArtifactPath =
      optsParsingResult.data.artifactPath || ethokoConfig.compilationOutputPath;

    if (!finalArtifactPath) {
      cliError(
        "Artifact path must be provided either via --artifact-path flag or compilationOutputPath in config",
      );
      process.exitCode = 1;
      return;
    }

    boxHeader(
      `Pushing artifact to "${ethokoConfig.project}"${optsParsingResult.data.tag ? ` with tag "${optsParsingResult.data.tag}"` : ""}`,
    );

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

    await push(
      finalArtifactPath,
      ethokoConfig.project,
      optsParsingResult.data.tag,
      storageProvider,
      {
        force: optsParsingResult.data.force,
        debug: ethokoConfig.debug || optsParsingResult.data.debug,
        isCI: process.env.CI === "true" || process.env.CI === "1",
      },
    )
      .then((result) =>
        displayPushResult(
          ethokoConfig.project,
          optsParsingResult.data.tag,
          result,
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
  });

ethokoScope
  .task("typings", "Generate typings based on the existing artifacts.")
  .setDescription(
    `Generate typings based on the existing artifacts.
The typings will be generated in the configured typings path.
`,
  )
  .addFlag("debug", "Enable debug mode")
  .setAction(async (opts, hre) => {
    const ethokoConfig = hre.config.ethoko;
    if (!ethokoConfig) {
      cliError("Ethoko is not configured");
      process.exitCode = 1;
      return;
    }

    const parsingResult = z
      .object({
        debug: z.boolean().default(ethokoConfig.debug),
      })
      .safeParse(opts);

    if (!parsingResult.success) {
      cliError("Invalid arguments");
      if (ethokoConfig.debug || opts.debug) {
        console.error(parsingResult.error);
      }
      process.exitCode = 1;
      return;
    }

    boxHeader("Generating typings");

    const localStorage = new LocalStorage(ethokoConfig.pulledArtifactsPath);

    await generateArtifactsSummariesAndTypings(
      ethokoConfig.typingsPath,
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
  });

ethokoScope
  .task(
    "list",
    "List the artifacts that have been pulled with their associated projects.",
  )
  .addFlag("debug", "Enable debug mode")
  .setAction(async (opts, hre) => {
    const ethokoConfig = hre.config.ethoko;
    if (!ethokoConfig) {
      cliError("Ethoko is not configured");
      process.exitCode = 1;
      return;
    }

    const parsingResult = z
      .object({
        debug: z.boolean().default(ethokoConfig.debug),
      })
      .safeParse(opts);

    if (!parsingResult.success) {
      cliError("Invalid arguments");
      if (ethokoConfig.debug) {
        console.error(parsingResult.error);
      }
      process.exitCode = 1;
      return;
    }

    boxHeader("Listing artifacts");

    const localStorage = new LocalStorage(ethokoConfig.pulledArtifactsPath);

    await listPulledArtifacts(localStorage, {
      debug: parsingResult.data.debug,
    })
      .then(displayListResults)
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
  });

ethokoScope
  .task(
    "diff",
    "Compare a local compilation artifacts with an existing release.",
  )
  .addOptionalParam("artifactPath", "The compilation artifact path to compare")
  .addOptionalParam(
    "id",
    "The ID of the artifact to compare with, can not be used with the `tag` parameter",
  )
  .addOptionalParam(
    "tag",
    "The tag of the artifact to compare with, can not be used with the `id` parameter",
  )
  .addFlag("debug", "Enable debug mode")
  .setAction(async (opts, hre) => {
    const ethokoConfig = hre.config.ethoko;
    if (!ethokoConfig) {
      cliError("Ethoko is not configured");
      process.exitCode = 1;
      return;
    }

    const paramParsingResult = z
      .object({
        artifactPath: z.string().min(1).optional(),
        id: z.string().optional(),
        tag: z.string().optional(),
        debug: z.boolean().default(ethokoConfig.debug),
      })
      .safeParse(opts);
    if (!paramParsingResult.success) {
      cliError("Invalid arguments");
      if (ethokoConfig.debug) {
        console.error(paramParsingResult.error);
      }
      process.exitCode = 1;
      return;
    }
    if (paramParsingResult.data.id && paramParsingResult.data.tag) {
      cliError("The ID and tag parameters can not be used together");
      process.exitCode = 1;
      return;
    }

    if (!paramParsingResult.data.id && !paramParsingResult.data.tag) {
      cliError("The artifact must be identified by a tag or an ID");
      process.exitCode = 1;
      return;
    }

    const finalArtifactPath =
      paramParsingResult.data.artifactPath || ethokoConfig.compilationOutputPath;

    if (!finalArtifactPath) {
      cliError(
        "Artifact path must be provided either via --artifact-path flag or compilationOutputPath in config",
      );
      process.exitCode = 1;
      return;
    }

    const tagOrId = paramParsingResult.data.id || paramParsingResult.data.tag;
    if (!tagOrId) {
      cliError("The artifact must be identified by a tag or an ID");
      process.exitCode = 1;
      return;
    }

    boxHeader(`Comparing with artifact "${ethokoConfig.project}:${tagOrId}"`);

    const localStorage = new LocalStorage(ethokoConfig.pulledArtifactsPath);

    await generateDiffWithTargetRelease(
      finalArtifactPath,
      { project: ethokoConfig.project, tagOrId },
      localStorage,
      {
        debug: paramParsingResult.data.debug,
        isCI: process.env.CI === "true" || process.env.CI === "1",
      },
    )
      .then(displayDifferences)
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
  });

ethokoScope
  .task("help", "Use `npx hardhat help ethoko` instead")
  .setAction(async () => {
    cliInfo(
      "This help format is not supported by Hardhat.\nPlease use `npx hardhat help ethoko` instead (change `npx` with what you use).\nHelp on a specific task can be obtained by using `npx hardhat help ethoko <command>`.",
    );
  });

const LOG_COLORS = {
  log: "cyan",
  success: "green",
  error: "red",
  warn: "yellow",
} as const;
