import {
  EthokoArtifact,
  EthokoArtifactSchema,
} from "@/utils/artifacts-schemas/ethoko-v0";
import fs from "fs/promises";
import { toAsyncResult } from "@/utils/result";
import {
  FORGE_COMPILER_DEFAULT_OUTPUT_FORMAT,
  ForgeCompilerContractOutputSchema,
  ForgeCompilerDefaultOutputSchema,
} from "@/utils/artifacts-schemas/forge-v1";
import { deriveEthokoArtifactId } from "@/utils/derive-ethoko-artifact-id";
import z from "zod";
import path from "path";
import { SettingsSchema } from "@/utils/artifacts-schemas/solc-v0.8.33/input-json";
import {
  SolcContractSchema,
  SolcJsonOutputSchema,
} from "@/utils/artifacts-schemas/solc-v0.8.33/output-json";
import { lookForContractArtifactPath } from "./look-for-contract-artifact-path";

/**
 * The default Forge build info format splits the contract output into multiple files, the build info file contains only the mapping to these files.
 *
 * The organisation of the files is the following:
 * - build-info/
 *    - <build-info-id>.json (contains the mapping to the contract output files)
 * - <file-name-0.sol>:
 *   - <contract-name>.json (contains the output for the contract)
 * - <file-name-1.sol>:
 *   - <contract-name>.json (contains the output for the contract)
 * - ...
 *
 * To reconstruct the EthokoArtifact, we need to read the build info file, then read all the contract output files, and reconstruct the input and output in the EthokoArtifact format.
 *
 * For this:
 * - we place ourselves in the root folder (one level above the build-info folder),
 * - we recursively look for all the .json files (except the one in the build-info folder), each of them corresponds to a contract output, for each of them:
 *  - we look for the .json files, each of them corresponds to a contract output, for each of them:
 *    - we parse the content, we reconstruct the output and input parts
 * At the end, we compare the contracts we explored with the mapping in the build info file, if they match, we can be confident that we reconstructed the input and output correctly, and we can return the EthokoArtifact.
 * @param buildInfoPath The path to the Forge build info JSON file (the one in the build-info folder)
 * @param forgeBuildInfo The parsed content of the Forge build info JSON file
 */
export async function forgeArtifactsToEthokoArtifact(
  buildInfoPath: string,
  forgeBuildInfo: z.infer<typeof ForgeCompilerDefaultOutputSchema>,
  debug: boolean,
): Promise<{ artifact: EthokoArtifact; additionalArtifactsPaths: string[] }> {
  const contractPathsToVisit = new Map(
    Object.entries(forgeBuildInfo.source_id_to_path),
  );
  if (contractPathsToVisit.size === 0) {
    throw new Error("Empty build info file");
  }

  const buildInfoFolder = path.dirname(buildInfoPath);
  const rootArtifactsFolder = path.dirname(buildInfoFolder);

  // We keep track of the additional artifacts paths to return them at the end
  const additionalArtifactsPaths: string[] = [];

  const visitedContractPaths = new Map<string, string>();
  let solcLongVersion: string | undefined = undefined;
  // Target input libraries are formatted as
  // "sourceFile" -> "libraryName" -> "libraryAddress"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputLibraries: Record<string, any> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputSources: Record<string, any> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const input: Record<string, any> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const outputContracts: Record<string, any> = {};
  for await (const contractArtifactPath of lookForContractArtifactPath(
    rootArtifactsFolder,
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
    const expectedContractPath = contractPathsToVisit.get(
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
    // We register the visiter contract path with the ID
    visitedContractPaths.set(contract.id.toString(), contractPath);
    additionalArtifactsPaths.push(contractArtifactPath);

    // Fill the solc version if not set
    if (!solcLongVersion) {
      solcLongVersion = contract.metadata.compiler.version;
    }

    // Fill the input language if not set
    if (!input.language) {
      input.language = contract.metadata.language;
    }
    // Fill the input settings if not set
    if (!input.settings) {
      // Libraries in contract
      input.settings = {
        remappings: contract.metadata.settings.remappings,
        optimizer: contract.metadata.settings.optimizer,
        evmVersion: contract.metadata.settings.evmVersion,
        eofVersion: contract.metadata.settings.eofVersion,
        viaIR: contract.metadata.settings.viaIR,
        metadata: contract.metadata.settings.metadata,
        outputSelection: undefined, // not handled
        modelChecker: undefined, // not handled
      } satisfies z.infer<typeof SettingsSchema>;
    }
    // Update the input settings libraries with the libraries found in the contract metadata
    const contractLibraries = contract.metadata.settings.libraries;
    if (contractLibraries) {
      for (const fullyQualifiedPath in contractLibraries) {
        const [filePath, libraryName] = fullyQualifiedPath.split(":");
        if (!filePath || !libraryName) {
          continue;
        }
        if (!inputLibraries[filePath]) {
          inputLibraries[filePath] = {};
        }
        inputLibraries[filePath][libraryName] =
          contractLibraries[fullyQualifiedPath];
      }
    }
    // Update the input sources with the source found in the contract metadata
    for (const sourcePath in contract.metadata.sources) {
      inputSources[sourcePath] = {
        ...inputSources[sourcePath],
        ...contract.metadata.sources[sourcePath],
      };
    }

    // Fill the output contracts
    if (!outputContracts[contractPath]) {
      outputContracts[contractPath] = {};
    }
    outputContracts[contractPath][contractName] = {
      abi: contract.abi,
      metadata: contract.rawMetadata,
      userdoc: contract.metadata.output.userdoc,
      devdoc: contract.metadata.output.devdoc,
      ir: undefined, // not handled
      irAst: undefined, // not handled
      irOptimized: undefined, // not handled
      irOptimizedAst: undefined, // not handled
      storageLayout: undefined, // not handled
      transientStorageLayout: undefined, // not handled
      evm: {
        assembly: undefined, // not handled
        legacyAssembly: undefined, // not handled
        bytecode: {
          ...contract.bytecode,
          // The bytecode in the default Forge output is 0x-prefixed, but the EthokoArtifact format expects it to be non-prefixed, so we strip the 0x prefix here.
          object: strip0xPrefix(contract.bytecode.object),
        },
        deployedBytecode: {
          ...contract.deployedBytecode,
          // The bytecode in the default Forge output is 0x-prefixed, but the EthokoArtifact format expects it to be non-prefixed, so we strip the 0x prefix here.
          object: strip0xPrefix(contract.deployedBytecode.object),
        },
        methodIdentifiers: contract.methodIdentifiers,
        gasEstimates: undefined, // not handled
      },
    } satisfies z.infer<typeof SolcContractSchema>;
  }

  // We verify that all contract paths have been visited
  if (visitedContractPaths.size !== contractPathsToVisit.size) {
    const pathsNotVisited: string[] = [];
    for (const [id, path] of contractPathsToVisit.entries()) {
      if (!visitedContractPaths.has(id)) {
        pathsNotVisited.push(`${path} (ID: ${id})`);
      }
    }

    throw new Error(
      `The number of visited contract paths (${visitedContractPaths.size}) does not match the number of expected contract paths (${contractPathsToVisit.size}). Missing contract paths:\n${pathsNotVisited.join(",\n")}.`,
    );
  }

  input.settings.libraries = inputLibraries;
  input.sources = inputSources;

  const output = {
    errors: undefined, // not handled
    sources: undefined, // not handled
    contracts: outputContracts,
  } satisfies z.infer<typeof SolcJsonOutputSchema>;

  const ethokoArtifact = {
    id: deriveEthokoArtifactId(output),
    solcLongVersion,
    origin: {
      id: forgeBuildInfo.id,
      format: FORGE_COMPILER_DEFAULT_OUTPUT_FORMAT,
    },
    input,
    output,
  };

  const ethokoArtifactResult = EthokoArtifactSchema.safeParse(ethokoArtifact);
  if (!ethokoArtifactResult.success) {
    throw new Error(
      `Failed to parse the reconstructed EthokoArtifact from the Forge build info default format. Error: ${ethokoArtifactResult.error}`,
    );
  }

  return {
    artifact: ethokoArtifactResult.data,
    additionalArtifactsPaths,
  };
}

function strip0xPrefix(bytecode: string): string {
  if (bytecode.startsWith("0x")) {
    return bytecode.slice(2);
  }
  return bytecode;
}
