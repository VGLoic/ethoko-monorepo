import {
  EthokoInputArtifact,
  EthokoOutputArtifact,
} from "@/utils/ethoko-artifacts-schemas/v0";
import { CliError } from "../error";
import { toAsyncResult } from "@/utils/result";
import type { BuildInfoPath } from "./look-for-build-info-json-file";
import { mapOriginalArtifactToEthokoArtifact } from "@/utils/supported-origins/map-original-artifact-to-ethoko-artifact";

// REMIND ME: delete this

/**
 * Given a path to a candidate build info JSON file, try to output Ethoko artifacts.
 *
 * This function is meant to be used in other CLI client methods, since it throws a CliError, it can be used without any wrapping, i.e.
 * ```ts
 * const {inputArtifact, outputArtifact, originalContentPaths} = await mapBuildInfoToEthokoArtifact(buildInfoPath);
 * ```
 *
 * The format of the build info has already been detected previously by the caller.
 * According to the detected format, this function will fully satisfy the build info content, validate it and map it to the Ethoko artifact format.
 *
 * @param buildInfoPath The candidate build info path to parse and map to Ethoko artifacts, it contains both the format and the path to the build info JSON files
 * @param debug Whether to enable debug logging
 * @return The Ethoko artifacts mapped from the build info JSON file and the paths to the original content files
 * @throws A CliError if the file cannot be parsed, if the build info is not valid or if the mapping fails
 */
export async function mapBuildInfoToEthokoArtifact(
  buildInfoPath: BuildInfoPath,
  debug: boolean,
): Promise<{
  inputArtifact: EthokoInputArtifact;
  outputArtifact: EthokoOutputArtifact;
  originalContentPaths: string[];
}> {
  const mappingResult = await toAsyncResult(
    mapOriginalArtifactToEthokoArtifact(buildInfoPath, debug),
    { debug },
  );
  if (!mappingResult.success) {
    const errorMessage =
      FORMAT_TO_ERROR_MESSAGE[buildInfoPath.format] ||
      `An error occurred while mapping the build info to Ethoko artifacts. Please provide valid build info JSON files or contact us. Run with debug mode for more info.`;
    throw new CliError(errorMessage);
  }

  return {
    inputArtifact: mappingResult.value.inputArtifact,
    outputArtifact: mappingResult.value.outputArtifact,
    originalContentPaths: mappingResult.value.originalContentPaths,
  };
}

const FORMAT_TO_ERROR_MESSAGE: Record<BuildInfoPath["format"], string> = {
  "hardhat-v3":
    "Hardhat v3 compilation artifacts have been identified but the mapping to Ethoko artifact format failed. Please provide valid Hardhat v3 compilation files or contact us. Run with debug mode for more info.",
  "hardhat-v2":
    "Hardhat v2 compilation artifacts have been identified but the mapping to Ethoko artifact format failed. Please provide a valid Hardhat v2 build info JSON file or contact us. Run with debug mode for more info.",
  "forge-v1-with-build-info-option":
    "Forge v1 compilation artifacts with the build info option have been identified but the mapping to Ethoko artifact format failed. Please provide a valid Forge v1 build info JSON file or contact us. Run with debug mode for more info.",
  "forge-v1-default":
    "Forge v1 compilation artifacts have been identified but the mapping to Ethoko artifact format failed. Please provide a valid Forge v1 build info JSON file or contact us. Run with debug mode for more info.",
};
