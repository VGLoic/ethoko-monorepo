import fs from "fs/promises";

import { LocalStorage } from "../local-storage";
import { toAsyncResult } from "../utils/result";
import { CliError } from "./error";
import type { EthokoArtifact } from "../utils/artifacts-schemas/ethoko-v0";
import { HARDHAT_V3_COMPILER_INPUT_FORMAT } from "@/utils/artifacts-schemas/hardhat-v3";
import { HARDHAT_V2_COMPILER_OUTPUT_FORMAT } from "@/utils/artifacts-schemas/hardhat-v2";

export type InspectResult = {
  project: string;
  tag: string | null;
  id: string;
  fileSize: number;
  origin: {
    id: string;
    format: "forge" | "hardhat-v2" | "hardhat-v3";
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
  artifactPath: string;
};

/**
 * Inspect a locally pulled artifact to identify contracts and metadata.
 *
 * @throws CliError if the artifact cannot be found or read.
 */
export async function inspectArtifact(
  artifact: {
    project: string;
    search: { type: "tag"; tag: string } | { type: "id"; id: string };
  },
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

  const artifactResult = await toAsyncResult(
    artifact.search.type === "tag"
      ? Promise.all([
          localStorage.retrieveArtifactByTag(
            artifact.project,
            artifact.search.tag,
          ),
          Promise.resolve(
            `${localStorage.rootPath}/${artifact.project}/tags/${artifact.search.tag}.json`,
          ),
        ])
      : Promise.all([
          localStorage.retrieveArtifactById(
            artifact.project,
            artifact.search.id,
          ),
          Promise.resolve(
            `${localStorage.rootPath}/${artifact.project}/ids/${artifact.search.id}.json`,
          ),
        ]),
    { debug: opts.debug },
  );
  if (!artifactResult.success) {
    throw new CliError(
      "Unable to retrieve the artifact content, please ensure it exists locally. Run with debug mode for more info",
    );
  }
  const [ethokoArtifact, artifactPath] = artifactResult.value;

  const fileStatResult = await toAsyncResult(fs.stat(artifactPath), {
    debug: opts.debug,
  });
  if (!fileStatResult.success) {
    throw new CliError(
      "Unable to read the artifact file size, please ensure it exists locally. Run with debug mode for more info",
    );
  }

  const compilerSettings = deriveCompilerSettings(ethokoArtifact);

  const originFormat =
    ethokoArtifact.origin.format === HARDHAT_V3_COMPILER_INPUT_FORMAT
      ? "hardhat-v3"
      : ethokoArtifact.origin.format === HARDHAT_V2_COMPILER_OUTPUT_FORMAT
        ? "hardhat-v2"
        : "forge";

  return {
    project: artifact.project,
    tag: artifact.search.type === "tag" ? artifact.search.tag : null,
    id: ethokoArtifact.id,
    fileSize: fileStatResult.value.size,
    origin: {
      id: ethokoArtifact.origin.id,
      format: originFormat,
    },
    compiler: compilerSettings,
    sourceFiles: Object.keys(ethokoArtifact.input.sources).sort(),
    contractsBySource: deriveContractsBySource(ethokoArtifact),
    artifactPath,
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
