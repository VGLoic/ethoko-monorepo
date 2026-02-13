import fs from "fs/promises";

import { LocalStorage } from "../local-storage";
import { toAsyncResult } from "../utils/result";
import { CliError } from "./error";
import type { EthokoArtifact } from "../utils/artifacts-schemas/ethoko-v0";

export type InspectResult = {
  project: string;
  tag: string | null;
  id: string;
  fileSize: number;
  origin: {
    id: string;
    format: string;
    outputFormat?: string;
  };
  compiler: {
    solcLongVersion: string;
    evmVersion: string;
    optimizer: {
      enabled: boolean;
      runs: number;
    };
    remappings: string[];
  };
  sourceFiles: string[];
  contractsBySource: Array<{
    sourcePath: string;
    contracts: string[];
  }>;
};

/**
 * Inspect a locally pulled artifact to identify contracts and metadata.
 *
 * @throws CliError if the artifact cannot be found or read.
 */
export async function inspectArtifact(
  artifact: { project: string; tagOrId: string },
  localStorage: LocalStorage,
  opts: { debug: boolean; silent?: boolean },
): Promise<InspectResult> {
  const ensureResult = await toAsyncResult(
    localStorage.ensureProjectSetup(artifact.project),
    { debug: opts.debug },
  );
  if (!ensureResult.success) {
    throw new CliError(
      "Error setting up local storage, is the script not allowed to write to the filesystem? Run with debug mode for more info",
    );
  }

  let type: "tag" | "id" | undefined = undefined;
  const isIdResult = await toAsyncResult(
    localStorage.hasId(artifact.project, artifact.tagOrId),
    { debug: opts.debug },
  );
  if (!isIdResult.success) {
    throw new CliError(
      "Error checking local storage, is the script not allowed to read from the filesystem? Run with debug mode for more info",
    );
  }
  if (isIdResult.value) {
    type = "id";
  }

  const isTagResult = await toAsyncResult(
    localStorage.hasTag(artifact.project, artifact.tagOrId),
    { debug: opts.debug },
  );
  if (!isTagResult.success) {
    throw new CliError(
      "Error checking local storage, is the script not allowed to read from the filesystem? Run with debug mode for more info",
    );
  }
  if (isTagResult.value) {
    type = "tag";
  }

  if (!type) {
    throw new CliError(
      `The artifact "${artifact.project}:${artifact.tagOrId}" has not been found locally. Please, make sure to have the artifact locally before running the inspect command. Run with debug mode for more info`,
    );
  }

  const artifactResult = await toAsyncResult(
    type === "tag"
      ? localStorage.retrieveArtifactByTag(artifact.project, artifact.tagOrId)
      : localStorage.retrieveArtifactById(artifact.project, artifact.tagOrId),
    { debug: opts.debug },
  );
  if (!artifactResult.success) {
    throw new CliError(
      "Unable to retrieve the artifact content, please ensure it exists locally. Run with debug mode for more info",
    );
  }

  const artifactPath =
    type === "tag"
      ? `${localStorage.rootPath}/${artifact.project}/tags/${artifact.tagOrId}.json`
      : `${localStorage.rootPath}/${artifact.project}/ids/${artifact.tagOrId}.json`;

  const fileStatResult = await toAsyncResult(fs.stat(artifactPath), {
    debug: opts.debug,
  });
  if (!fileStatResult.success) {
    throw new CliError(
      "Unable to read the artifact file size, please ensure it exists locally. Run with debug mode for more info",
    );
  }

  const compilerSettings = deriveCompilerSettings(artifactResult.value);

  return {
    project: artifact.project,
    tag: type === "tag" ? artifact.tagOrId : null,
    id: artifactResult.value.id,
    fileSize: fileStatResult.value.size,
    origin: artifactResult.value.origin,
    compiler: compilerSettings,
    sourceFiles: Object.keys(artifactResult.value.input.sources).sort(),
    contractsBySource: deriveContractsBySource(artifactResult.value),
  };
}

function deriveCompilerSettings(
  artifact: EthokoArtifact,
): InspectResult["compiler"] {
  const settings = artifact.input.settings;
  const optimizer = settings?.optimizer;

  return {
    solcLongVersion: artifact.solcLongVersion,
    evmVersion: settings?.evmVersion ?? "default",
    optimizer: {
      enabled: optimizer?.enabled ?? false,
      runs: optimizer?.runs ?? 200,
    },
    remappings: settings?.remappings ?? [],
  };
}

function deriveContractsBySource(
  artifact: EthokoArtifact,
): InspectResult["contractsBySource"] {
  const entries: InspectResult["contractsBySource"] = [];
  for (const sourcePath of Object.keys(artifact.output.contracts).sort()) {
    const contracts = artifact.output.contracts[sourcePath];
    if (!contracts) {
      continue;
    }
    entries.push({
      sourcePath,
      contracts: Object.keys(contracts).sort(),
    });
  }
  return entries;
}
