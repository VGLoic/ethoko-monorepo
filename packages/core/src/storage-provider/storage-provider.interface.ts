import { Stream } from "stream";
import {
  EthokoInputArtifact,
  EthokoOutputArtifact,
} from "../utils/artifacts-schemas/ethoko-v0";

export interface StorageProvider {
  listTags(project: string): Promise<string[]>;
  listIds(project: string): Promise<string[]>;
  listOriginalContent(project: string, id: string): Promise<string[]>;
  hasArtifactByTag(project: string, tag: string): Promise<boolean>;
  hasArtifactById(project: string, id: string): Promise<boolean>;
  uploadArtifact(
    project: string,
    inputArtifact: EthokoInputArtifact,
    outputArtifact: EthokoOutputArtifact,
    tag: string | undefined,
    originalContentPaths: string[],
  ): Promise<void>;
  downloadArtifactById(
    project: string,
    id: string,
  ): Promise<{ input: Stream; output: Stream }>;
  downloadArtifactByTag(
    project: string,
    tag: string,
  ): Promise<{ id: string; input: Stream; output: Stream }>;
  downloadOriginalContent(
    project: string,
    id: string,
    relativePath: string,
  ): Promise<Stream>;
}
