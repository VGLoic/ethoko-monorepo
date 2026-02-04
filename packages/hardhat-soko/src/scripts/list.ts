import { LocalStorage } from "../local-storage";
import { ScriptError, toAsyncResult } from "../utils";

type ArtifactMetadata = {
  Project: string;
  ID: string;
  Tag: string;
  "Pull date": string;
};

export async function generateStructuredDataForArtifacts(
  localStorage: LocalStorage,
  opts: { debug?: boolean } = {},
): Promise<ArtifactMetadata[]> {
  const projectsResult = await toAsyncResult(localStorage.listProjects(), {
    debug: opts.debug,
  });
  if (!projectsResult.success) {
    throw new ScriptError("Error listing the projects");
  }

  const metadatas: ArtifactMetadata[] = [];
  const idsAlreadyVisited = new Set<string>();
  const projects = projectsResult.value;
  for (const project of projects) {
    const tagsResult = await toAsyncResult(localStorage.listTags(project), {
      debug: opts.debug,
    });
    if (!tagsResult.success) {
      throw new ScriptError(`Error listing the tags for project "${project}"`);
    }

    const artifactsPromises = tagsResult.value.map((metadata) =>
      localStorage
        .retrieveArtifactId(project, metadata.tag)
        .then((artifactId) => ({
          metadata,
          artifactId,
        })),
    );
    const artifactsResults = await toAsyncResult(
      Promise.all(artifactsPromises),
      {
        debug: opts.debug,
      },
    );
    if (!artifactsResults.success) {
      throw new ScriptError(
        `Error retrieving the content for project "${project}"`,
      );
    }

    for (const { metadata, artifactId } of artifactsResults.value) {
      metadatas.push({
        Project: project,
        ID: artifactId,
        Tag: metadata.tag,
        "Pull date": deriveTimeAgo(metadata.lastModifiedAt),
      });
      idsAlreadyVisited.add(artifactId);
    }

    const idsResult = await toAsyncResult(localStorage.listIds(project), {
      debug: opts.debug,
    });
    if (!idsResult.success) {
      throw new ScriptError(`Error listing the IDs for project "${project}"`);
    }
    for (const metadata of idsResult.value) {
      if (idsAlreadyVisited.has(metadata.id)) {
        continue;
      }
      metadatas.push({
        Project: project,
        ID: metadata.id,
        Tag: "",
        "Pull date": deriveTimeAgo(metadata.lastModifiedAt),
      });
      idsAlreadyVisited.add(metadata.id);
    }
  }

  return metadatas;
}

function deriveTimeAgo(time: string): string {
  const now = new Date();
  const then = new Date(time);
  const diff = now.getTime() - then.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ago`;
  }
  if (hours > 0) {
    return `${hours}h ago`;
  }
  if (minutes > 0) {
    return `${minutes}m ago`;
  }
  return `Less than a minute ago`;
}
