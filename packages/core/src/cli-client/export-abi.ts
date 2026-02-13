import { LocalStorage } from "../local-storage";
import { toAsyncResult } from "../utils/result";
import { CliError } from "./error";

export type ExportAbiResult = {
  project: string;
  tag: string | null;
  id: string;
  contract: {
    path: string;
    name: string;
    abi: unknown[];
  };
};

export async function exportContractAbi(
  artifact: {
    project: string;
    search: { type: "tag"; tag: string } | { type: "id"; id: string };
  },
  shortOrFullyQualifiedContractName: string,
  localStorage: LocalStorage,
  opts: { debug: boolean; silent?: boolean },
): Promise<ExportAbiResult> {
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
      ? localStorage.retrieveArtifactByTag(
          artifact.project,
          artifact.search.tag,
        )
      : localStorage.retrieveArtifactById(artifact.project, artifact.search.id),
    { debug: opts.debug },
  );
  if (!artifactResult.success) {
    throw new CliError(
      "Unable to retrieve the artifact content, please ensure it exists locally. Run with debug mode for more info",
    );
  }

  const contracts = artifactResult.value.output.contracts;

  if (shortOrFullyQualifiedContractName.split(":").length === 1) {
    // Short name, find the contract with that name, if multiple are found, throw an error
    const matchingSourcePaths = [];
    for (const [sourcePath, contractsByName] of Object.entries(contracts)) {
      if (shortOrFullyQualifiedContractName in contractsByName) {
        matchingSourcePaths.push(sourcePath);
      }
    }
    const matchingSourcePath = matchingSourcePaths[0];
    if (!matchingSourcePath) {
      throw new CliError(
        `No contract found with name ${shortOrFullyQualifiedContractName} in artifact ${deriveDisplayArtifactName(artifact.project, artifact.search)}`,
      );
    }
    if (matchingSourcePaths.length > 1) {
      throw new CliError(
        `Multiple contracts found with name ${shortOrFullyQualifiedContractName} in artifact ${deriveDisplayArtifactName(artifact.project, artifact.search)}, please specify the fully qualified contract name (i.e. <sourcePath>:${shortOrFullyQualifiedContractName}).\nMatching source paths: ${matchingSourcePaths.join(", ")}`,
      );
    }
    const abi =
      contracts[matchingSourcePath]?.[shortOrFullyQualifiedContractName]?.abi;
    if (!abi) {
      throw new CliError(
        `No ABI found for contract ${shortOrFullyQualifiedContractName} in artifact ${deriveDisplayArtifactName(artifact.project, artifact.search)}`,
      );
    }
    return {
      project: artifact.project,
      tag: artifact.search.type === "tag" ? artifact.search.tag : null,
      id: artifactResult.value.id,
      contract: {
        path: matchingSourcePath,
        name: shortOrFullyQualifiedContractName,
        abi,
      },
    };
  }

  // Else, we should be in the fully qualified contract name case, so we should have a string in the format <sourcePath>:<contractName>
  const elements = shortOrFullyQualifiedContractName.split(":");
  if (elements.length !== 2) {
    throw new CliError(
      `Invalid contract name ${shortOrFullyQualifiedContractName}, expected format is <contractName> or <sourcePath>:<contractName>`,
    );
  }
  const [sourcePath, contractName] = elements as [string, string];
  const sourceContracts = contracts[sourcePath];
  if (!sourceContracts) {
    throw new CliError(
      `No contracts found for source path ${sourcePath} in artifact ${deriveDisplayArtifactName(artifact.project, artifact.search)}`,
    );
  }
  const contract = sourceContracts[contractName];
  if (!contract) {
    throw new CliError(
      `No contract found with name ${contractName} in source path ${sourcePath} in artifact ${deriveDisplayArtifactName(artifact.project, artifact.search)}`,
    );
  }
  if (!contract.abi) {
    throw new CliError(
      `No ABI found for contract ${contractName} in source path ${sourcePath} in artifact ${deriveDisplayArtifactName(artifact.project, artifact.search)}`,
    );
  }
  return {
    project: artifact.project,
    tag: artifact.search.type === "tag" ? artifact.search.tag : null,
    id: artifactResult.value.id,
    contract: {
      path: sourcePath,
      name: contractName,
      abi: contract.abi,
    },
  };
}

function deriveDisplayArtifactName(
  project: string,
  search: { type: "tag"; tag: string } | { type: "id"; id: string },
): string {
  if (search.type === "tag") {
    return `${project}:${search.tag}`;
  }
  return `${project}:${search.id}`;
}
