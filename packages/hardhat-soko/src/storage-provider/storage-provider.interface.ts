import { Stream } from "stream";
import { SokoArtifact } from "../utils/artifacts-schemas/soko-v0";

export interface StorageProvider {
  listTags(project: string): Promise<string[]>;
  listIds(project: string): Promise<string[]>;
  hasArtifactByTag(project: string, tag: string): Promise<boolean>;
  hasArtifactById(project: string, id: string): Promise<boolean>;
  uploadArtifact(
    project: string,
    artifact: SokoArtifact,
    tag: string | undefined,
    originalContentPaths: {
      buildInfoPath: string;
      additionalArtifactsPaths: string[];
    },
  ): Promise<void>;
  downloadArtifactById(project: string, id: string): Promise<Stream>;
  downloadArtifactByTag(project: string, tag: string): Promise<Stream>;
}
