import SepoliaDeployedAddresses from "./../ignition/deployments/chain-11155111/deployed_addresses.json" with { type: "json" };
import { EthokoContractArtifact, project } from "./../.ethoko-typings/index.js";
import "dotenv/config";

const DEPLOYER_ADDRESS = "0x25371B936fD45e67F00dfEa1cd6A3e77105DD0FA";

async function main() {
  console.log("\nStarting Etherscan verification for release 2026-02-02...\n");

  console.log("Deployed addresses on Sepolia for release 2026-02-02:");
  for (const [key, address] of Object.entries(SepoliaDeployedAddresses)) {
    const [, contractName] = key.split("#");
    console.log(`- ${contractName}: ${address}`);
  }

  const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
  if (!ETHERSCAN_API_KEY) {
    console.error(
      "Error: ETHERSCAN_API_KEY is not set in the environment variables.",
    );
    process.exit(1);
  }
  const etherscanClient = new EtherscanVerificationClient(ETHERSCAN_API_KEY);

  const externalMathArtifact = await project("verified-forge-counter")
    .tag("2026-02-02")
    .getContractArtifact("src/ExternalMath.sol:ExternalMath");
  await etherscanClient.verifyContract({
    address: SepoliaDeployedAddresses["release_2026_02_02#ExternalMath"],
    constructorArguments: "", // No constructor arguments for this contract
    licenseType: "UNLICENSED",
    artifact: externalMathArtifact,
  });

  const oracleArtifact = await project("verified-forge-counter")
    .tag("2026-02-02")
    .getContractArtifact("src/Oracle.sol:Oracle");
  await etherscanClient.verifyContract({
    address: SepoliaDeployedAddresses["release_2026_02_02#Oracle"],
    constructorArguments: abiEncodeAddress(DEPLOYER_ADDRESS),
    licenseType: "UNLICENSED",
    artifact: oracleArtifact,
  });

  const counterArtifact = await project("verified-forge-counter")
    .tag("2026-02-02")
    .getContractArtifact("src/Counter.sol:Counter");
  await etherscanClient.verifyContract({
    address: SepoliaDeployedAddresses["release_2026_02_02#Counter"],
    constructorArguments: abiEncodeAddress(
      SepoliaDeployedAddresses["release_2026_02_02#Oracle"],
    ), // Address of the Oracle contract as constructor argument
    licenseType: "UNLICENSED",
    artifact: counterArtifact,
  });
}

function abiEncodeAddress(address: string): string {
  // Remove the "0x" prefix and left-pad with zeros to 32 bytes (64 hex characters)
  return address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

class EtherscanVerificationClient {
  constructor(private apiKey: string) {}

  async verifyContract(payload: {
    address: string;
    constructorArguments: string;
    licenseType: "UNLICENSED" | "MIT";
    artifact: EthokoContractArtifact;
  }): Promise<void> {
    const fullyQualifiedName = `${payload.artifact.sourceName}:${payload.artifact.contractName}`;

    /**
     * Etherscan API expects a few things, the few lines of code below reconstruct the expected input format.
     * This is from my understanding, happy to receive corrections if I'm wrong:
     * - the sources contain only the `content` field. Etherscan does not accept the `urls` and `license` fields that are present in the original input artifact, so we remove them,
     * - the `settings` field does match the one from the metadata, I picked the fields that I needed
     */
    const sources: Record<string, { content: string }> = {};
    for (const [key, source] of Object.entries(
      payload.artifact.expandedMetadata.sources,
    )) {
      const content = source.content;
      if (!content) {
        throw new Error(
          `Unexpected source format for ${key}: missing 'content' field`,
        );
      }
      sources[key] = { content };
    }
    const reconstructedInput = {
      language: payload.artifact.expandedMetadata.language,
      settings: {
        optimizer: payload.artifact.expandedMetadata.settings.optimizer,
        evmVersion: payload.artifact.expandedMetadata.settings.evmVersion,
        metadata: payload.artifact.expandedMetadata.settings.metadata,
        remappings: payload.artifact.expandedMetadata.settings.remappings,
      },
      sources,
    };

    // See Etherscan API docs: https://docs.etherscan.io/api-reference/endpoint/verifysourcecode
    const queryParams = new URLSearchParams({
      apikey: this.apiKey,
      chainId: "11155111", // Sepolia chain ID
      module: "contract",
      action: "verifysourcecode",
      contractaddress: payload.address,
      sourceCode: JSON.stringify(reconstructedInput),
      codeformat: "solidity-standard-json-input",
      contractname: fullyQualifiedName,
      compilerversion: appendCompilerVersion(
        payload.artifact.expandedMetadata.compiler.version,
      ),
      optimizationUsed: payload.artifact.expandedMetadata.settings.optimizer
        ?.enabled
        ? "1"
        : "0",
      runs: (
        payload.artifact.expandedMetadata.settings.optimizer?.runs ?? 0
      ).toString(),
      constructorArguments: payload.constructorArguments,
      evmVersion:
        payload.artifact.expandedMetadata.settings.evmVersion ?? "london",
      licenseType: payload.licenseType === "MIT" ? "3" : "2", // MIT License or UNLICENSED
    });
    const response = await fetch(
      `https://api.etherscan.io/v2/api?${queryParams.toString()}`,
      {
        method: "POST",
      },
    );

    const rawResponse = await response.text();
    try {
      const data = JSON.parse(rawResponse);
      if ("status" in data && data.status === "0") {
        if (
          "result" in data &&
          data.result === "Contract source code already verified"
        ) {
          console.log(`Contract ${fullyQualifiedName} already verified\n`);
        } else {
          console.error(`Verification failed for ${fullyQualifiedName}:`, data);
        }
      } else {
        console.log(
          `Verification submitted for ${fullyQualifiedName}:\n`,
          data,
        );
      }
    } catch (error) {
      console.error("Failed to parse Etherscan response as JSON:", error);
      console.error("Raw response from Etherscan:", rawResponse);
      return;
    }
  }
}

function appendCompilerVersion(version: string) {
  if (version.startsWith("v")) return version;
  return `v${version}`;
}

main();
