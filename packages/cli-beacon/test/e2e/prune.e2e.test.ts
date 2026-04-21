import { describe, expect } from "vitest";
import { ARTIFACTS_STRATEGIES } from "@test/helpers/artifacts-strategy";
import {
  STORAGE_PROVIDER_STRATEGIES,
  storageProviderTest,
} from "@test/helpers/storage-provider-test";
import { createTestProjectName } from "@test/helpers/test-utils";
import { CommandLogger } from "@/ui";
import { runPushCommand } from "@/commands/push";
import { runPruneCommand } from "@/commands/prune";
import { runPullCommand } from "@/commands/pull";

const logger = new CommandLogger(true);
const [, artifactFixture] = ARTIFACTS_STRATEGIES[0];
const [, artifactFixture2] = ARTIFACTS_STRATEGIES[1];

describe.for(STORAGE_PROVIDER_STRATEGIES)(
  "Prune E2E Tests (%s)",
  ([, storageProviderFactory]) => {
    storageProviderTest.scoped({ storageProviderFactory });

    // ── pruneOrphanedAndUntaggedArtifacts ────────────────────────────────────

    storageProviderTest(
      "pruneOrphanedAndUntaggedArtifacts - prunes orphaned project",
      async ({ storageProvider, pulledArtifactStore }) => {
        const project = createTestProjectName("prune-orphaned");
        await pulledArtifactStore.ensureProjectSetup(project);
        const tag = "orphaned-tag";
        const artifactId = await runPushCommand(
          artifactFixture.folderPath,
          {
            project,
            tag,
          },
          {
            storageProvider,
            logger,
          },
          {
            force: false,
            debug: false,
          },
        );
        await runPullCommand(
          { project, type: "tag", tag },
          { storageProvider, pulledArtifactStore, logger },
          { force: false, debug: false },
        );

        const result = await runPruneCommand(
          { type: "all", projects: new Set([]) },
          { pulledArtifactStore, logger },
          { dryRun: false, debug: false },
        );

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          project,
          id: artifactId,
          tag,
        });
        expect(await pulledArtifactStore.hasId(project, artifactId)).toBe(
          false,
        );
        expect(await pulledArtifactStore.hasTag(project, tag)).toBe(false);
      },
    );

    storageProviderTest(
      "pruneOrphanedAndUntaggedArtifacts - preserves tagged artifact in configured project",
      async ({ storageProvider, pulledArtifactStore }) => {
        const project = createTestProjectName("prune-configured-tagged");
        await pulledArtifactStore.ensureProjectSetup(project);
        const tag = "v1.0.0";
        const artifactId = await runPushCommand(
          artifactFixture.folderPath,
          {
            project,
            tag,
          },
          {
            storageProvider,
            logger,
          },
          {
            force: false,
            debug: false,
          },
        );
        await runPullCommand(
          { project, type: "tag", tag },
          { storageProvider, pulledArtifactStore, logger },
          { force: false, debug: false },
        );

        const result = await runPruneCommand(
          { type: "all", projects: new Set([project]) },
          { pulledArtifactStore, logger },
          { dryRun: false, debug: false },
        );

        expect(result).toHaveLength(0);
        expect(await pulledArtifactStore.hasId(project, artifactId)).toBe(true);
        expect(await pulledArtifactStore.hasTag(project, tag)).toBe(true);
      },
    );

    storageProviderTest(
      "pruneOrphanedAndUntaggedArtifacts - prunes untagged artifact from configured project",
      async ({ storageProvider, pulledArtifactStore }) => {
        const project = createTestProjectName("prune-configured-untagged");
        await pulledArtifactStore.ensureProjectSetup(project);
        const artifactId = await runPushCommand(
          artifactFixture.folderPath,
          { project, tag: undefined },
          { storageProvider, logger },
          {
            force: false,
            debug: false,
          },
        );
        await runPullCommand(
          { project, type: "id", id: artifactId },
          { storageProvider, pulledArtifactStore, logger },
          { force: false, debug: false },
        );

        const result = await runPruneCommand(
          { type: "all", projects: new Set([project]) },
          { pulledArtifactStore, logger },
          { dryRun: false, debug: false },
        );

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ project, id: artifactId, tag: null });
        expect(await pulledArtifactStore.hasId(project, artifactId)).toBe(
          false,
        );
      },
    );

    storageProviderTest(
      "pruneOrphanedAndUntaggedArtifacts - dry run does not delete",
      async ({ storageProvider, pulledArtifactStore }) => {
        const project = createTestProjectName("prune-ota-dry");
        await pulledArtifactStore.ensureProjectSetup(project);
        const artifactId = await runPushCommand(
          artifactFixture.folderPath,
          { project, tag: undefined },
          { storageProvider, logger },
          {
            force: false,
            debug: false,
          },
        );
        await runPullCommand(
          { project, type: "id", id: artifactId },
          { storageProvider, pulledArtifactStore, logger },
          { force: false, debug: false },
        );

        const result = await runPruneCommand(
          { type: "all", projects: new Set([]) },
          { pulledArtifactStore, logger },
          { dryRun: true, debug: false },
        );

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ project, id: artifactId, tag: null });
        expect(await pulledArtifactStore.hasId(project, artifactId)).toBe(true);
      },
    );

    storageProviderTest(
      "pruneOrphanedAndUntaggedArtifacts - empty store returns empty list",
      async ({ pulledArtifactStore }) => {
        const result = await runPruneCommand(
          { type: "all", projects: new Set([]) },
          { pulledArtifactStore, logger },
          { dryRun: false, debug: false },
        );
        expect(result).toHaveLength(0);
      },
    );

    // ── pruneProjectArtifacts ────────────────────────────────────────────────

    storageProviderTest(
      "pruneProjectArtifacts - deletes all artifacts",
      async ({ storageProvider, pulledArtifactStore }) => {
        const project = createTestProjectName("prune-project");
        await pulledArtifactStore.ensureProjectSetup(project);
        const tag = "v1.0.0";

        // tagged artifact
        const taggedId = await runPushCommand(
          artifactFixture.folderPath,
          { project, tag },
          { storageProvider, logger },
          { force: false, debug: false },
        );

        // untagged artifact (different content to produce a different ID)
        const untaggedId = await runPushCommand(
          artifactFixture2.folderPath,
          { project, tag: undefined },
          { storageProvider, logger },
          { force: false, debug: false },
        );
        await runPullCommand(
          { type: "project", project },
          { storageProvider, pulledArtifactStore, logger },
          {
            force: false,
            debug: false,
          },
        );

        const result = await runPruneCommand(
          { type: "specific", artifactKey: { type: "project", project } },
          { pulledArtifactStore, logger },
          {
            dryRun: false,
            debug: false,
          },
        );

        expect(result.map((r) => r.id)).toEqual(
          expect.arrayContaining([taggedId, untaggedId]),
        );
        // tagged artifact - both tag and ID should be deleted
        expect(await pulledArtifactStore.hasTag(project, tag)).toBe(false);
        expect(await pulledArtifactStore.hasId(project, taggedId)).toBe(false);
        // untagged artifact - only ID should be deleted
        expect(await pulledArtifactStore.hasId(project, untaggedId)).toBe(
          false,
        );
      },
    );

    storageProviderTest(
      "pruneProjectArtifacts - dry run does not delete",
      async ({ storageProvider, pulledArtifactStore }) => {
        const project = createTestProjectName("prune-project-dry");
        await pulledArtifactStore.ensureProjectSetup(project);
        const artifactId = await runPushCommand(
          artifactFixture.folderPath,
          { project, tag: undefined },
          { storageProvider, logger },
          {
            force: false,
            debug: false,
          },
        );
        await runPullCommand(
          { project, type: "id", id: artifactId },
          { storageProvider, pulledArtifactStore, logger },
          { force: false, debug: false },
        );

        const result = await runPruneCommand(
          { type: "specific", artifactKey: { type: "project", project } },
          { pulledArtifactStore, logger },
          {
            dryRun: true,
            debug: false,
          },
        );

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ project, id: artifactId, tag: null });
        expect(await pulledArtifactStore.hasId(project, artifactId)).toBe(true);
      },
    );

    // ── pruneArtifactById ────────────────────────────────────────────────────

    storageProviderTest(
      "pruneArtifact - by ID - deletes artifact",
      async ({ storageProvider, pulledArtifactStore }) => {
        const project = createTestProjectName("prune-by-id");
        await pulledArtifactStore.ensureProjectSetup(project);
        const artifactId = await runPushCommand(
          artifactFixture.folderPath,
          { project, tag: undefined },
          { storageProvider, logger },
          {
            force: false,
            debug: false,
          },
        );
        await runPullCommand(
          { project, type: "id", id: artifactId },
          { storageProvider, pulledArtifactStore, logger },
          { force: false, debug: false },
        );

        const result = await runPruneCommand(
          {
            type: "specific",
            artifactKey: { project, type: "id", id: artifactId },
          },
          { pulledArtifactStore, logger },
          { dryRun: false, debug: false },
        );

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ project, id: artifactId, tag: null });
        expect(await pulledArtifactStore.hasId(project, artifactId)).toBe(
          false,
        );
      },
    );

    storageProviderTest(
      "pruneArtifact - by ID - dry run does not delete",
      async ({ storageProvider, pulledArtifactStore }) => {
        const project = createTestProjectName("prune-by-id-dry");
        await pulledArtifactStore.ensureProjectSetup(project);
        const artifactId = await runPushCommand(
          artifactFixture.folderPath,
          { project, tag: undefined },
          { storageProvider, logger },
          {
            force: false,
            debug: false,
          },
        );
        await runPullCommand(
          { project, type: "id", id: artifactId },
          { storageProvider, pulledArtifactStore, logger },
          { force: false, debug: false },
        );

        const result = await runPruneCommand(
          {
            type: "specific",
            artifactKey: { project, type: "id", id: artifactId },
          },
          { pulledArtifactStore, logger },
          { dryRun: true, debug: false },
        );

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ project, id: artifactId, tag: null });
        expect(await pulledArtifactStore.hasId(project, artifactId)).toBe(true);
      },
    );

    storageProviderTest(
      "pruneArtifact - by ID - throws when ID not found",
      async ({ pulledArtifactStore }) => {
        const project = createTestProjectName("prune-by-id-missing");
        await pulledArtifactStore.ensureProjectSetup(project);

        await expect(
          runPruneCommand(
            {
              type: "specific",
              artifactKey: { project, type: "id", id: "nonexistentid" },
            },
            { pulledArtifactStore, logger },
            {
              dryRun: false,
              debug: false,
            },
          ),
        ).rejects.toThrow();
      },
    );

    // ── pruneArtifactByTag ───────────────────────────────────────────────────

    storageProviderTest(
      "pruneArtifact - by tag - deletes artifact",
      async ({ storageProvider, pulledArtifactStore }) => {
        const project = createTestProjectName("prune-by-tag");
        await pulledArtifactStore.ensureProjectSetup(project);
        const tag = "v1.0.0";
        const artifactId = await runPushCommand(
          artifactFixture.folderPath,
          { project, tag },
          { storageProvider, logger },
          { force: false, debug: false },
        );
        await runPullCommand(
          { project, type: "tag", tag },
          { storageProvider, pulledArtifactStore, logger },
          { force: false, debug: false },
        );

        const result = await runPruneCommand(
          { type: "specific", artifactKey: { project, type: "tag", tag } },
          { pulledArtifactStore, logger },
          { dryRun: false, debug: false },
        );

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ project, id: artifactId, tag });
        expect(await pulledArtifactStore.hasId(project, artifactId)).toBe(
          false,
        );
      },
    );

    storageProviderTest(
      "pruneArtifact - by tag - dry run does not delete",
      async ({ storageProvider, pulledArtifactStore }) => {
        const project = createTestProjectName("prune-by-tag-dry");
        await pulledArtifactStore.ensureProjectSetup(project);
        const tag = "v1.0.0";
        const artifactId = await runPushCommand(
          artifactFixture.folderPath,
          { project, tag },
          { storageProvider, logger },
          { force: false, debug: false },
        );
        await runPullCommand(
          { project, type: "tag", tag },
          { storageProvider, pulledArtifactStore, logger },
          { force: false, debug: false },
        );

        const result = await runPruneCommand(
          { type: "specific", artifactKey: { project, type: "tag", tag } },
          { pulledArtifactStore, logger },
          { dryRun: true, debug: false },
        );

        expect(result).toHaveLength(1);
        expect(await pulledArtifactStore.hasTag(project, tag)).toBe(true);
        expect(await pulledArtifactStore.hasId(project, artifactId)).toBe(true);
      },
    );

    storageProviderTest(
      "pruneArtifact - by tag - throws when tag not found",
      async ({ pulledArtifactStore }) => {
        const project = createTestProjectName("prune-by-tag-missing");
        await pulledArtifactStore.ensureProjectSetup(project);

        await expect(
          runPruneCommand(
            {
              type: "specific",
              artifactKey: { project, type: "tag", tag: "nonexistent-tag" },
            },
            { pulledArtifactStore, logger },
            {
              dryRun: false,
              debug: false,
            },
          ),
        ).rejects.toThrow();
      },
    );
  },
);
