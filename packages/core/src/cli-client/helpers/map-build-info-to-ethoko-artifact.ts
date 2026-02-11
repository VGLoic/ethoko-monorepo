import {
  SokoArtifact,
  SokoArtifactSchema,
} from "@/utils/artifacts-schemas/ethoko-v0";
import fs from "fs/promises";
import { CliError } from "../error";
import { toAsyncResult, toResult } from "@/utils/result";
import { HardhatV2CompilerOutputSchema } from "@/utils/artifacts-schemas/hardhat-v2";
import {
  FORGE_COMPILER_DEFAULT_OUTPUT_FORMAT,
  ForgeCompilerContractOutputSchema,
  ForgeCompilerDefaultOutputSchema,
  ForgeCompilerOutputWithBuildInfoOptionSchema,
} from "@/utils/artifacts-schemas/forge-v1";
import { deriveSokoArtifactId } from "@/utils/derive-ethoko-artifact-id";
import z from "zod";
import path from "path";
import { SettingsSchema } from "@/utils/artifacts-schemas/solc-v0.8.33/input-json";
import {
  SolcContractSchema,
  SolcJsonOutputSchema,
} from "@/utils/artifacts-schemas/solc-v0.8.33/output-json";
import { BuildInfoPath } from "@/utils/build-info-path";
import {
  HardhatV3CompilerInputPieceSchema,
  HardhatV3CompilerOutputPieceSchema,
} from "@/utils/artifacts-schemas/hardhat-v3";

/**
 * Given a path to a candidate build info JSON file, try to output a SokoArtifact.
 *
 * This function is meant to be used in other CLI client methods, since it throws a CliError, it can be used without any wrapping, i.e.
 * ```ts
 * const {artifact, originalContentPaths} = await mapBuildInfoToSokoArtifact(buildInfoPath);
 * ```
 *
 * The format of the build info has already been detected previously by the caller.
 * According to the detected format, this function will fully satisfy the build info content, validate it and map it to the SokoArtifact format.
 *
 * @param buildInfoPath The candidate build info path to parse and map to a SokoArtifact, it contains both the format and the path to the build info JSON files
 * @param debug Whether to enable debug logging
 * @return The SokoArtifact mapped from the build info JSON file and the paths to the original content files
 * @throws A CliError if the file cannot be parsed, if the build info is not valid or if the mapping fails
 */
export async function mapBuildInfoToSokoArtifact(
  buildInfoPath: BuildInfoPath,
  debug: boolean,
): Promise<{ artifact: SokoArtifact; originalContentPaths: string[] }> {
  if (buildInfoPath.format === "hardhat-v3") {
    // @dev readJsonFile throws a CliError so it is safe to use it directly without wrapping it in a try catch block
    const inputJsonContent = await readJsonFile(
      buildInfoPath.inputPath,
      "build info input",
      debug,
    );

    const inputParsingResult =
      HardhatV3CompilerInputPieceSchema.safeParse(inputJsonContent);
    if (!inputParsingResult.success) {
      if (debug) {
        console.error(
          `Failed to parse the build info input file "${buildInfoPath.inputPath}" as a Hardhat V3 compiler input piece. Error: ${inputParsingResult.error}`,
        );
      }
      throw new CliError(
        `The provided build info input file "${buildInfoPath.inputPath}" seems to be in the Hardhat V3 compiler input piece format but we failed to validate it. Please provide a valid Hardhat V3 compiler input piece JSON file. Run with debug mode for more info.`,
      );
    }

    // @dev readJsonFile throws a CliError so it is safe to use it directly without wrapping it in a try catch block
    const outputJsonContent = await readJsonFile(
      buildInfoPath.outputPath,
      "build info output",
      debug,
    );

    const outputParsingResult =
      HardhatV3CompilerOutputPieceSchema.safeParse(outputJsonContent);
    if (!outputParsingResult.success) {
      if (debug) {
        console.error(
          `Failed to parse the build info output file "${buildInfoPath.outputPath}" as a Hardhat V3 compiler output piece. Error: ${outputParsingResult.error}`,
        );
      }
      throw new CliError(
        `The provided build info output file "${buildInfoPath.outputPath}" seems to be in the Hardhat V3 compiler output piece format but we failed to validate it. Please provide a valid Hardhat V3 compiler output piece JSON file. Run with debug mode for more info.`,
      );
    }

    if (inputParsingResult.data.id !== outputParsingResult.data.id) {
      if (debug) {
        console.error(
          `The input and output files provided do not seem to belong together, their ids are different. Input id: "${inputParsingResult.data.id}", output id: "${outputParsingResult.data.id}". Please provide matching input and output files. Run with debug mode for more info.`,
        );
      }
      throw new CliError(
        `The input and output files provided do not seem to belong together, their ids are different. Please provide matching input and output files. Run with debug mode for more info.`,
      );
    }

    return {
      artifact: {
        id: deriveSokoArtifactId(outputParsingResult.data.output),
        origin: {
          id: inputParsingResult.data.id,
          format: inputParsingResult.data._format,
          outputFormat: outputParsingResult.data._format,
        },
        input: inputParsingResult.data.input,
        output: outputParsingResult.data.output,
        solcLongVersion: inputParsingResult.data.solcLongVersion,
      },
      originalContentPaths: [buildInfoPath.inputPath, buildInfoPath.outputPath],
    };
  }

  // @dev readJsonFile throws a CliError so it is safe to use it directly without wrapping it in a try catch block
  const jsonContent = await readJsonFile(
    buildInfoPath.path,
    "build info",
    debug,
  );

  // We validate the content and map it to the SokoArtifact format based on the previously detected format

  if (buildInfoPath.format === "hardhat-v2") {
    const parsingResult = HardhatV2CompilerOutputSchema.safeParse(jsonContent);
    if (!parsingResult.success) {
      if (debug) {
        console.error(
          `Failed to parse the build info file "${buildInfoPath.path}" as a Hardhat V2 build info format. Error: ${parsingResult.error}`,
        );
      }
      throw new CliError(
        `The provided build info file "${buildInfoPath.path}" seems to be in the Hardhat V2 format but we failed to validate it. Please provide a valid Hardhat V2 build info JSON file. Run with debug mode for more info.`,
      );
    }
    return {
      artifact: {
        id: deriveSokoArtifactId(parsingResult.data.output),
        origin: {
          id: parsingResult.data.id,
          format: parsingResult.data._format,
        },
        solcLongVersion: parsingResult.data.solcLongVersion,
        input: parsingResult.data.input,
        output: parsingResult.data.output,
      },
      originalContentPaths: [buildInfoPath.path],
    };
  }

  if (buildInfoPath.format === "forge-with-build-info-option") {
    const parsingResult =
      ForgeCompilerOutputWithBuildInfoOptionSchema.safeParse(jsonContent);
    if (!parsingResult.success) {
      if (debug) {
        console.error(
          `Failed to parse the build info file "${buildInfoPath.path}" as a Forge build info format with the build info option. Error: ${parsingResult.error}`,
        );
      }
      throw new CliError(
        `The provided build info file "${buildInfoPath.path}" seems to be in the Forge format with the build info option but we failed to validate it. Please provide a valid Forge build info JSON file with the build info option. Run with debug mode for more info.`,
      );
    }
    return {
      artifact: {
        id: deriveSokoArtifactId(parsingResult.data.output),
        origin: {
          id: parsingResult.data.id,
          format: parsingResult.data._format,
        },
        solcLongVersion: parsingResult.data.solcLongVersion,
        input: parsingResult.data.input,
        output: parsingResult.data.output,
      },
      originalContentPaths: [buildInfoPath.path],
    };
  }

  if (buildInfoPath.format === "forge-default") {
    const parsingResult =
      ForgeCompilerDefaultOutputSchema.safeParse(jsonContent);
    if (!parsingResult.success) {
      if (debug) {
        console.error(
          `Failed to parse the build info file "${buildInfoPath.path}" as a Forge build info format without the build info option. Error: ${parsingResult.error}`,
        );
      }
      throw new CliError(
        `The provided build info file "${buildInfoPath.path}" seems to be in the Forge format without the build info option but we failed to validate it. Please provide a valid Forge build info JSON file without the build info option. Run with debug mode for more info.`,
      );
    }
    // The mapping is not straightforward as we need to reconstruct the input and output from the scattered contract pieces
    const mappingResult = await toAsyncResult(
      forgeDefaultBuildInfoToSokoArtifact(
        buildInfoPath.path,
        parsingResult.data,
        debug,
      ),
      { debug },
    );
    if (!mappingResult.success) {
      throw new CliError(
        `The provided build info file "${buildInfoPath.path}" seems to be in the Foundry default format but we failed to validate it, please try to build with the "--build-info" option or file an issue with the error details.`,
      );
    }
    return {
      artifact: mappingResult.value.artifact,
      originalContentPaths: mappingResult.value.additionalArtifactsPaths.concat(
        buildInfoPath.path,
      ),
    };
  }

  buildInfoPath.format satisfies never; // to ensure we covered all the cases

  throw new CliError(
    `The provided build info file "${buildInfoPath.path}" does not match any of the supported formats. Please provide a valid build info JSON file. Run with debug mode for more info.`,
  );
}

async function readJsonFile(
  path: string,
  displayName: string,
  debug: boolean,
): Promise<unknown> {
  const contentResult = await toAsyncResult(fs.readFile(path, "utf-8"), {
    debug,
  });
  if (!contentResult.success) {
    throw new CliError(
      `The provided ${displayName} path "${path}" could not be read. Please check the permissions and try again. Run with debug mode for more info.`,
    );
  }
  const jsonContentResult = await toResult(
    () => JSON.parse(contentResult.value),
    { debug },
  );
  if (!jsonContentResult.success) {
    throw new CliError(
      `The provided ${displayName} file "${path}" could not be parsed as JSON. Please provide a valid JSON file. Run with debug mode for more info.`,
    );
  }
  return jsonContentResult.value;
}

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
 * To reconstruct the SokoArtifact, we need to read the build info file, then read all the contract output files, and reconstruct the input and output in the SokoArtifact format.
 *
 * For this:
 * - we place ourselves in the root folder (one level above the build-info folder),
 * - we recursively look for all the .json files (except the one in the build-info folder), each of them corresponds to a contract output, for each of them:
 *  - we look for the .json files, each of them corresponds to a contract output, for each of them:
 *    - we parse the content, we reconstruct the output and input parts
 * At the end, we compare the contracts we explored with the mapping in the build info file, if they match, we can be confident that we reconstructed the input and output correctly, and we can return the SokoArtifact.
 * @param buildInfoPath The path to the Forge build info JSON file (the one in the build-info folder)
 * @param forgeBuildInfo The parsed content of the Forge build info JSON file
 */
async function forgeDefaultBuildInfoToSokoArtifact(
  buildInfoPath: string,
  forgeBuildInfo: z.infer<typeof ForgeCompilerDefaultOutputSchema>,
  debug: boolean,
): Promise<{ artifact: SokoArtifact; additionalArtifactsPaths: string[] }> {
  const expectedContractPaths = new Set(
    Object.values(forgeBuildInfo.source_id_to_path),
  );
  if (expectedContractPaths.size === 0) {
    throw new Error("Empty build info file");
  }

  const buildInfoFolder = path.dirname(buildInfoPath);
  const rootArtifactsFolder = path.dirname(buildInfoFolder);

  // We keep track of the additional artifacts paths to return them at the end
  const additionalArtifactsPaths: string[] = [];

  const exploredContractPaths = new Set<string>();
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
    additionalArtifactsPaths.push(contractArtifactPath);

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

    if (!solcLongVersion) {
      solcLongVersion = contract.metadata.compiler.version;
    }

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
          // The bytecode in the default Forge output is 0x-prefixed, but the SokoArtifact format expects it to be non-prefixed, so we strip the 0x prefix here.
          object: strip0xPrefix(contract.bytecode.object),
        },
        deployedBytecode: {
          ...contract.deployedBytecode,
          // The bytecode in the default Forge output is 0x-prefixed, but the SokoArtifact format expects it to be non-prefixed, so we strip the 0x prefix here.
          object: strip0xPrefix(contract.deployedBytecode.object),
        },
        methodIdentifiers: contract.methodIdentifiers,
        gasEstimates: undefined, // not handled
      },
    } satisfies z.infer<typeof SolcContractSchema>;

    exploredContractPaths.add(contractPath);
  }

  if (exploredContractPaths.size !== expectedContractPaths.size) {
    throw new Error(
      `The number of explored contract paths (${exploredContractPaths.size}) does not match the number of expected contract paths (${expectedContractPaths.size}). Explored contract paths: ${[
        ...exploredContractPaths,
      ].join(
        ", ",
      )}. Expected contract paths: ${[...expectedContractPaths].join(", ")}.`,
    );
  }

  input.settings.libraries = inputLibraries;
  input.sources = inputSources;

  const output = {
    errors: undefined, // not handled
    sources: undefined, // not handled
    contracts: outputContracts,
  } satisfies z.infer<typeof SolcJsonOutputSchema>;

  const sokoArtifact = {
    id: deriveSokoArtifactId(output),
    solcLongVersion,
    origin: {
      id: forgeBuildInfo.id,
      format: FORGE_COMPILER_DEFAULT_OUTPUT_FORMAT,
    },
    input,
    output,
  };

  const sokoArtifactResult = SokoArtifactSchema.safeParse(sokoArtifact);
  if (!sokoArtifactResult.success) {
    throw new Error(
      `Failed to parse the reconstructed SokoArtifact from the Forge build info default format. Error: ${sokoArtifactResult.error}`,
    );
  }

  return {
    artifact: sokoArtifactResult.data,
    additionalArtifactsPaths,
  };
}

function strip0xPrefix(bytecode: string): string {
  if (bytecode.startsWith("0x")) {
    return bytecode.slice(2);
  }
  return bytecode;
}

async function* lookForContractArtifactPath(
  path: string,
): AsyncIterable<string> {
  const entries = await fs.readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== "build-info") {
      yield* lookForContractArtifactPath(`${path}/${entry.name}`);
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      yield `${path}/${entry.name}`;
    }
  }
}
