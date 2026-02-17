import path from "node:path";
import fs from "fs/promises";
import { lookForContractArtifactPath } from "./look-for-contract-artifact-path";
import { toAsyncResult } from "@/utils/result";
import { HardhatV3CompilerContractOutputSchema } from "@/utils/artifacts-schemas/hardhat-v3";

/**
 * Hardhat v3 artifacts have the usual Build Info input and output
 * But they also output contract artifacts directly, this function is in charge of retrieving their paths
 * @returns The paths of the contract artifacts
 */
export async function retrieveHardhatv3ContractArtifactsPaths(
  buildInfoPath: string,
  buildInfoId: string,
  userSourceNameMap: Record<string, string>,
  debug: boolean,
): Promise<string[]> {
  const buildInfoFolder = path.dirname(buildInfoPath);
  const rootArtifactsFolder = path.dirname(buildInfoFolder);

  const expectedUserSourceNameMap = new Map(Object.entries(userSourceNameMap));

  const rebuiltSourceNameMap = new Map();
  const paths = [];

  for await (const contractArtifactPath of lookForContractArtifactPath(
    rootArtifactsFolder,
  )) {
    const contractContentResult = await toAsyncResult(
      fs.readFile(contractArtifactPath, "utf-8").then((content) => {
        const rawParsing = JSON.parse(content);
        return HardhatV3CompilerContractOutputSchema.parse(rawParsing);
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
    if (contract.buildInfoId != buildInfoId) {
      if (debug) {
        console.warn(
          `Found compilation artifact at path "${contractArtifactPath}" but does not have the same build info ID than the input/output. Skipping it.`,
        );
      }
      continue;
    }
    if (!expectedUserSourceNameMap.has(contract.sourceName)) {
      if (debug) {
        console.warn(
          `Found compilation artifact at path "${contractArtifactPath}" but does not belong to the expected user source name map. Skipping it.`,
        );
      }
      continue;
    }

    rebuiltSourceNameMap.set(contract.sourceName, contract.inputSourceName);
    paths.push(contractArtifactPath);
  }

  if (rebuiltSourceNameMap.size !== expectedUserSourceNameMap.size) {
    if (debug) {
      console.warn(
        `The number of visited contract artifacts (${rebuiltSourceNameMap.size}) does not match the number of expected contract artifacts (${expectedUserSourceNameMap.size})`,
      );
    }
    throw new Error(
      `The number of visited contract artifacts (${rebuiltSourceNameMap.size}) does not match the number of expected contract artifacts (${expectedUserSourceNameMap.size})`,
    );
  }

  return paths;
}
