import fs from "fs/promises";
import { Stream } from "stream";
import {
  EthokoContractArtifact,
  EthokoContractArtifactSchema,
  EthokoInputArtifact,
  EthokoInputArtifactSchema,
  EthokoOutputArtifact,
  EthokoOutputArtifactSchema,
  TagManifest,
  TagManifestSchema,
} from "./utils/artifacts-schemas/ethoko-v0";
type CompilerOutput = EthokoOutputArtifact["output"];

/**
 * Local storage implementation for storing artifacts on the local filesystem.
 *
 * Storage layout (relative to rootPath)
 * - {project}/ids/{id}/input.json
 * - {project}/ids/{id}/output.json
 * - {project}/tags/{tag}.json (manifest: { id })
 */
export class LocalStorage {
  public readonly rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
  }

  /**
   * Checks if an ID exists for a given project in the local storage.
   * @param project The project name.
   * @param id The artifact ID.
   * @returns True if the ID exists, false otherwise.
   */
  public async hasId(project: string, id: string): Promise<boolean> {
    return this.exists(`${this.rootPath}/${project}/ids/${id}`);
  }

  /**
   * Checks if a tag exists for a given project in the local storage.
   * @param project The project name.
   * @param tag The tag name.
   * @returns True if the tag exists, false otherwise.
   */
  public async hasTag(project: string, tag: string): Promise<boolean> {
    return this.exists(`${this.rootPath}/${project}/tags/${tag}.json`);
  }

  /**
   * Lists all projects in the local storage.
   * @returns The list of project names.
   */
  public async listProjects(): Promise<string[]> {
    const entries = await fs.readdir(this.rootPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  }

  /**
   * Lists all IDs for a given project in the local storage.
   * @param project The project name.
   * @returns The list of IDs with their last modified timestamps.
   */
  public async listIds(project: string): Promise<
    {
      id: string;
      lastModifiedAt: string;
    }[]
  > {
    const entries = await fs.readdir(`${this.rootPath}/${project}/ids`, {
      withFileTypes: true,
    });
    const ids = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    const statsPromises = ids.map((id) =>
      fs
        .stat(`${this.rootPath}/${project}/ids/${id}`)
        .then((stat) => ({ id, stat })),
    );
    const allStats = await Promise.all(statsPromises);

    return allStats.map(({ id, stat }) => ({
      id,
      lastModifiedAt: stat.mtime.toISOString(),
    }));
  }

  /**
   * Lists all tags for a given project in the local storage.
   * @param project The project name.
   * @returns The list of tags with their last modified timestamps.
   */
  public async listTags(project: string): Promise<
    {
      tag: string;
      lastModifiedAt: string;
    }[]
  > {
    const entries = await fs.readdir(`${this.rootPath}/${project}/tags`, {
      withFileTypes: true,
    });
    const tags = [];
    for (const entry of entries) {
      if (entry.isFile()) {
        tags.push(entry.name.replace(".json", ""));
      }
    }
    const statsPromises = tags.map((tag) =>
      fs
        .stat(`${this.rootPath}/${project}/tags/${tag}.json`)
        .then((stat) => ({ tag, stat })),
    );
    const allStats = await Promise.all(statsPromises);
    return allStats.map(({ tag, stat }) => ({
      tag,
      lastModifiedAt: stat.mtime.toISOString(),
    }));
  }

  /**
   * Creates an artifact associated with the given ID.
   * @param project The project name.
   * @param id The artifact ID.
   * @param inputArtifact The input artifact content.
   * @param outputArtifact The output artifact content.
   */
  public async createArtifactById(
    project: string,
    id: string,
    inputArtifact: Stream,
    outputArtifact: Stream,
  ): Promise<void> {
    const idDir = `${this.rootPath}/${project}/ids/${id}`;
    await fs.mkdir(idDir, { recursive: true });
    await Promise.all([
      fs.writeFile(`${idDir}/input.json`, inputArtifact),
      fs.writeFile(`${idDir}/output.json`, outputArtifact),
    ]);
  }

  /**
   * Creates an artifact associated with the given tag.
   * @param project The project name.
   * @param tag The tag name.
   * @param id The artifact ID.
   * @param inputArtifact The input artifact content.
   * @param outputArtifact The output artifact content.
   */
  public async createArtifactByTag(
    project: string,
    tag: string,
    id: string,
    inputArtifact: Stream,
    outputArtifact: Stream,
  ): Promise<void> {
    await this.createArtifactById(project, id, inputArtifact, outputArtifact);
    const manifest: TagManifest = { id };
    await fs.writeFile(
      `${this.rootPath}/${project}/tags/${tag}.json`,
      JSON.stringify(manifest),
    );
  }

  /**
   * Retrieves the input artifact associated with the given tag.
   * @param project The project name.
   * @param tag The tag name.
   * @returns The input artifact.
   */
  public async retrieveInputArtifactByTag(
    project: string,
    tag: string,
  ): Promise<EthokoInputArtifact> {
    const id = await this.retrieveArtifactId(project, tag);
    return this.retrieveInputArtifactById(project, id);
  }

  /**
   * Retrieves the output artifact associated with the given tag.
   * @param project The project name.
   * @param tag The tag name.
   * @returns The output artifact.
   */
  public async retrieveOutputArtifactByTag(
    project: string,
    tag: string,
  ): Promise<EthokoOutputArtifact> {
    const id = await this.retrieveArtifactId(project, tag);
    return this.retrieveOutputArtifactById(project, id);
  }

  /**
   * Retrieves the input artifact associated with the given ID.
   * @param project The project name.
   * @param id The artifact ID.
   * @returns The input artifact.
   */
  public async retrieveInputArtifactById(
    project: string,
    id: string,
  ): Promise<EthokoInputArtifact> {
    const artifactContent = await fs.readFile(
      `${this.rootPath}/${project}/ids/${id}/input.json`,
      "utf-8",
    );
    const rawArtifact = JSON.parse(artifactContent);
    return EthokoInputArtifactSchema.parse(rawArtifact);
  }

  /**
   * Retrieves the output artifact associated with the given ID.
   * @param project The project name.
   * @param id The artifact ID.
   * @returns The output artifact.
   */
  public async retrieveOutputArtifactById(
    project: string,
    id: string,
  ): Promise<EthokoOutputArtifact> {
    const artifactContent = await fs.readFile(
      `${this.rootPath}/${project}/ids/${id}/output.json`,
      "utf-8",
    );
    const rawArtifact = JSON.parse(artifactContent);
    return EthokoOutputArtifactSchema.parse(rawArtifact);
  }

  /**
   * Retrieve the artifact ID from the content of the artifact associated with the given tag.
   * @param project The project name.
   * @param tag The tag name.
   * @returns The retrieved artifact ID.
   */
  public async retrieveArtifactId(
    project: string,
    tag: string,
  ): Promise<string> {
    const artifactContent = await fs.readFile(
      `${this.rootPath}/${project}/tags/${tag}.json`,
      "utf-8",
    );
    const rawArtifact = JSON.parse(artifactContent);
    const manifest = TagManifestSchema.parse(rawArtifact);
    return manifest.id;
  }

  /**
   * Ensures that the root path for local storage exists by creating it if necessary.
   */
  public async ensureSetup(): Promise<void> {
    const doesRootPathExist = await this.exists(this.rootPath);
    if (!doesRootPathExist) {
      await fs.mkdir(this.rootPath, { recursive: true });
    }
  }

  /**
   * Ensures that the necessary directories for a given project exist by creating them if necessary.
   * @param project The project name.
   */
  public async ensureProjectSetup(project: string): Promise<void> {
    const pathsToEnsure = [
      this.rootPath,
      `${this.rootPath}/${project}`,
      `${this.rootPath}/${project}/ids`,
      `${this.rootPath}/${project}/tags`,
    ];
    for (const path of pathsToEnsure) {
      const doesPathExist = await this.exists(path);
      if (!doesPathExist) {
        await fs.mkdir(path, { recursive: true });
      }
    }
  }

  private exists(path: string): Promise<boolean> {
    return fs
      .stat(path)
      .then(() => true)
      .catch(() => false);
  }

  /**
   * Creates per-contract artifacts for a given compilation output.
   * @param project The project name.
   * @param id The artifact ID.
   * @param outputArtifact The output artifact.
   */
  public async createContractArtifacts(
    project: string,
    id: string,
    outputArtifact: EthokoOutputArtifact,
  ): Promise<void> {
    const artifacts = buildContractArtifacts(outputArtifact.output);
    for (const [contractKey, artifact] of artifacts) {
      const contractPieces = contractKey.split(":");
      const contractName = contractPieces.at(-1);
      const contractPath = contractPieces.slice(0, -1).join(":");
      if (!contractName || !contractPath) {
        continue;
      }
      const contractDir = `${this.rootPath}/${project}/ids/${id}/contracts/${contractPath}`;
      await fs.mkdir(contractDir, { recursive: true });
      await fs.writeFile(
        `${contractDir}/${contractName}.json`,
        JSON.stringify(artifact, null, 2),
      );
    }
  }

  /**
   * Retrieves a per-contract artifact for a given compilation output.
   * @param project The project name.
   * @param id The artifact ID.
   * @param contractKey The contract key in format "path/to/Contract.sol:Contract".
   * @returns The contract artifact.
   */
  public async retrieveContractArtifact(
    project: string,
    id: string,
    contractKey: string,
  ): Promise<EthokoContractArtifact> {
    const contractPieces = contractKey.split(":");
    const contractName = contractPieces.at(-1);
    const contractPath = contractPieces.slice(0, -1).join(":");
    if (!contractName || !contractPath) {
      throw new Error(
        `Invalid contract key: ${contractKey}. Expected format: "path/to/Contract.sol:Contract"`,
      );
    }
    const artifactPath = `${this.rootPath}/${project}/ids/${id}/contracts/${contractPath}/${contractName}.json`;
    const artifactContent = await fs.readFile(artifactPath, "utf-8");
    const rawArtifact = JSON.parse(artifactContent);
    return EthokoContractArtifactSchema.parse(rawArtifact);
  }

  /**
   * Lists all contract keys for a given compilation output.
   * @param project The project name.
   * @param id The artifact ID.
   * @returns The list of contract keys.
   */
  public async listContractArtifacts(
    project: string,
    id: string,
  ): Promise<string[]> {
    const contractsDir = `${this.rootPath}/${project}/ids/${id}/contracts`;
    const contractKeys: string[] = [];
    const exists = await this.exists(contractsDir);
    if (!exists) {
      return contractKeys;
    }

    const walkDir = async (dir: string, basePath = ""): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = `${dir}/${entry.name}`;
        const relativePath = basePath
          ? `${basePath}/${entry.name}`
          : entry.name;
        if (entry.isDirectory()) {
          await walkDir(fullPath, relativePath);
        } else if (entry.isFile() && entry.name.endsWith(".json")) {
          const contractName = entry.name.replace(".json", "");
          const contractPath = basePath;
          contractKeys.push(`${contractPath}:${contractName}`);
        }
      }
    };

    await walkDir(contractsDir);
    return contractKeys;
  }
}

function buildContractArtifacts(
  output: CompilerOutput,
): Map<string, EthokoContractArtifact> {
  const artifacts = new Map<string, EthokoContractArtifact>();
  for (const contractPath in output.contracts) {
    const contracts = output.contracts[contractPath];
    if (!contracts) {
      continue;
    }
    for (const contractName in contracts) {
      const contract = contracts[contractName];
      if (!contract) {
        continue;
      }
      const contractKey = `${contractPath}:${contractName}`;
      artifacts.set(contractKey, {
        _format: "ethoko-contract-artifact-v0",
        abi: contract.abi,
        metadata: contract.metadata || "",
        bytecode: prefixWith0x(contract.evm.bytecode.object),
        deployedBytecode: contract.evm.deployedBytecode?.object
          ? prefixWith0x(contract.evm.deployedBytecode.object)
          : "0x",
        linkReferences: contract.evm.bytecode.linkReferences,
        deployedLinkReferences: contract.evm.deployedBytecode
          ? contract.evm.deployedBytecode.linkReferences
          : {},
        contractName,
        sourceName: contractPath,
        userdoc: contract.userdoc,
        devdoc: contract.devdoc,
        storageLayout: contract.storageLayout,
        evm: {
          assembly: contract.evm.assembly,
          bytecode: {
            functionDebugData: contract.evm.bytecode.functionDebugData,
            object: contract.evm.bytecode.object,
            opcodes: contract.evm.bytecode.opcodes,
            sourceMap: contract.evm.bytecode.sourceMap,
            generatedSources: contract.evm.bytecode.generatedSources,
            linkReferences: contract.evm.bytecode.linkReferences,
          },
          deployedBytecode: contract.evm.deployedBytecode
            ? {
                functionDebugData:
                  contract.evm.deployedBytecode.functionDebugData,
                object: contract.evm.deployedBytecode.object,
                opcodes: contract.evm.deployedBytecode.opcodes,
                sourceMap: contract.evm.deployedBytecode.sourceMap,
                generatedSources:
                  contract.evm.deployedBytecode.generatedSources,
                linkReferences: contract.evm.deployedBytecode.linkReferences,
              }
            : undefined,
          gasEstimates: contract.evm.gasEstimates,
          methodIdentifiers: contract.evm.methodIdentifiers,
        },
      });
    }
  }
  return artifacts;
}

function prefixWith0x(s: string): `0x${string}` {
  if (s.startsWith("0x")) return s as `0x${string}`;
  return `0x${s}`;
}
