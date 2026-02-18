import fs from "fs/promises";
import path from "node:path";
import { toAsyncResult } from "@/utils/result";
import { ForgeCompilerContractOutputSchema } from "@/utils/artifacts-schemas/forge-v1";
import z from "zod";
import { lookForContractArtifactPath } from "./look-for-contract-artifact-path";

/**
 * When using the --build-info option, Forge artifacts have the usual Build Info input and output
 * But they also output contract artifacts directly, this function is in charge of retrieving their paths
 * Additionally, we check that we have every contracts of the build info
 * @returns The paths of the contract artifacts
 */
export async function retrieveForgeContractArtifactsPaths(
  buildInfoPath: string,
  sourceIdToPath: Record<string, string>,
  debug: boolean,
): Promise<string[]> {
  const expectedSourceIdToPath = new Map(Object.entries(sourceIdToPath));

  const buildInfoFolder = path.dirname(buildInfoPath);
  const rootArtifactsFolder = path.dirname(buildInfoFolder);

  // We keep track of the additional artifacts paths to return them at the end
  const additionalArtifactsPaths: string[] = [];

  const rebuiltSourceIdToPath = new Map<string, string>();

  for await (const {
    fullyQualifiedName,
    localArtifactPath,
    contract,
  } of lookForForgeContractArtifactPath(
    rootArtifactsFolder,
    expectedSourceIdToPath,
    debug,
  )) {
    // We register the visiter contract path with the ID
    rebuiltSourceIdToPath.set(contract.id.toString(), fullyQualifiedName.path);
    additionalArtifactsPaths.push(localArtifactPath);
  }

  // We verify that all contract paths have been visited
  if (rebuiltSourceIdToPath.size !== expectedSourceIdToPath.size) {
    const pathsNotVisited: string[] = [];
    for (const [id, path] of expectedSourceIdToPath.entries()) {
      if (!rebuiltSourceIdToPath.has(id)) {
        pathsNotVisited.push(`${path} (ID: ${id})`);
      }
    }

    throw new Error(
      `The number of visited contract paths (${rebuiltSourceIdToPath.size}) does not match the number of expected contract paths (${expectedSourceIdToPath.size}). Missing contract paths:\n${pathsNotVisited.join(",\n")}.`,
    );
  }

  return additionalArtifactsPaths;
}

export async function* lookForForgeContractArtifactPath(
  rootArtifactsFolderPath: string,
  buildInfoContractPaths: Map<string, string>,
  debug: boolean,
): AsyncIterable<{
  localArtifactPath: string; // Relative path in artifacts output
  fullyQualifiedName: {
    path: string;
    name: string;
  };
  contract: z.infer<typeof ForgeCompilerContractOutputSchema>;
}> {
  for await (const contractArtifactPath of lookForContractArtifactPath(
    rootArtifactsFolderPath,
  )) {
    const contractContentResult = await toAsyncResult(
      fs.readFile(contractArtifactPath, "utf-8").then((content) => {
        const rawParsing = JSON.parse(content);
        return ForgeCompilerContractOutputSchema.parse(rawParsing);
      }),
      { debug },
    );
    if (!contractContentResult.success) {
      if (debug) {
        console.warn(
          `Failed to parse contract artifact at path "${contractArtifactPath}". Skipping it. Error: ${contractContentResult.error}`,
        );
      }
      continue;
    }
    const contract = contractContentResult.value;

    const compilationTargetEntries = Object.entries(
      contract.metadata.settings.compilationTarget || {},
    );
    const targetEntry = compilationTargetEntries.at(0);
    if (!targetEntry || compilationTargetEntries.length > 1) {
      if (debug) {
        console.warn(
          `No compilation target found or too many targets for contract "${contractArtifactPath}". Skipping it.`,
        );
      }
      continue;
    }

    // E.g "contracts/MyContract.sol" and "MyContract"
    const [contractPath, contractName] = targetEntry;

    // We verify that the couple (ID, contractPath) matches the one in the `contractPathToVisit`
    const expectedContractPath = buildInfoContractPaths.get(
      contract.id.toString(),
    );
    if (expectedContractPath != contractPath) {
      if (debug) {
        console.warn(
          `Found an artifact belonging to another compilation for contract "${contractArtifactPath}". Skipping it.`,
        );
      }
      continue;
    }
    yield {
      fullyQualifiedName: {
        name: contractName,
        path: contractPath,
      },
      localArtifactPath: contractArtifactPath,
      contract,
    };
  }
}
