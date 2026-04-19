import crypto from "crypto";
import { S3BucketProvider } from "@/storage-provider/s3-bucket-provider";
import { PulledArtifactStore } from "@/pulled-artifact-store";
import { TestSession } from "./test-session";

export function createTestProjectName(baseName: string): string {
  const sessionProject = TestSession.getInstance().getProjectName(baseName);
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${sessionProject}-${suffix}`;
}

export async function inspectS3Bucket(
  s3Provider: S3BucketProvider,
  project: string,
): Promise<void> {
  console.log("\n=== S3 Bucket Contents ===");

  try {
    const tags = await s3Provider.listTags(project);
    const ids = await s3Provider.listIds(project);

    console.log(`Project: ${project}`);
    console.log(`  Tags: ${tags.length > 0 ? tags.join(", ") : "(none)"}`);
    console.log(`  IDs: ${ids.length > 0 ? ids.join(", ") : "(none)"}`);
  } catch (error) {
    console.log(`Error inspecting S3: ${String(error)}`);
  }

  console.log("=========================\n");
}

export async function inspectPulledArtifactStore(
  pulledArtifactStore: PulledArtifactStore,
  project?: string,
): Promise<void> {
  console.log("\n=== Pulled Artifact Store Contents ===");

  try {
    if (project) {
      const tags = await pulledArtifactStore.listTags(project);
      const ids = await pulledArtifactStore.listIds(project);

      console.log(`Project: ${project}`);
      console.log(
        `  Tags: ${
          tags.length > 0 ? tags.map((tag) => tag.tag).join(", ") : "(none)"
        }`,
      );
      console.log(
        `  IDs: ${
          ids.length > 0 ? ids.map((id) => id.id).join(", ") : "(none)"
        }`,
      );
    } else {
      const projects = await pulledArtifactStore.listProjects();
      console.log(
        `Projects: ${projects.length > 0 ? projects.join(", ") : "(none)"}`,
      );
    }
  } catch (error) {
    console.log(`Error inspecting pulled artifact store: ${String(error)}`);
  }

  console.log("==============================\n");
}
