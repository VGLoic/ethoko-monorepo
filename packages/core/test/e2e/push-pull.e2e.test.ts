import fs from "fs/promises";
import path from "path";
import { beforeEach, describe, expect, test } from "vitest";
import { pull, push } from "@/cli-client/index";
import { createTestLocalStorage } from "@test/helpers/local-storage-factory";
import {
  createTestLocalStorageProvider,
  createTestS3StorageProvider,
} from "@test/helpers/storage-provider-factory";
import { TEST_CONSTANTS } from "@test/helpers/test-constants";
import { createTestProjectName } from "@test/helpers/test-utils";
import type { LocalStorage } from "@/local-storage";
import { LocalStorageProvider, StorageProvider } from "@/storage-provider";

describe.each([
  ["Local Storage Provider", "local" as const, createTestLocalStorageProvider],
  ["Amazon S3 Storage Provider", "s3" as const, createTestS3StorageProvider],
])("Push-Pull E2E Tests (%s)", (_, providerType, createStorageProvider) => {
  let storageProvider: StorageProvider;
  let localStorage: LocalStorage;

  beforeEach(async () => {
    const providerSetup = await createStorageProvider();
    storageProvider = providerSetup.storageProvider;

    const localStorageSetup = await createTestLocalStorage();
    localStorage = localStorageSetup.localStorage;

    return async () => {
      await localStorageSetup.cleanup();
      await providerSetup.cleanup();
    };
  });

  test("push artifact [Hardhat V2 Counter] without tag → pull by ID", async () => {
    const project = createTestProjectName(TEST_CONSTANTS.PROJECTS.DEFAULT);
    const artifactPath =
      TEST_CONSTANTS.PATHS.SAMPLE_ARTIFACT.HARDHAT_V2_COUNTER;

    await localStorage.ensureProjectSetup(project);

    const artifactId = await push(
      artifactPath,
      project,
      undefined,
      storageProvider,
      {
        force: false,
        debug: false,
      },
    );

    expect(artifactId).toBeTruthy();
    expect(artifactId).toHaveLength(12);

    const hasArtifact = await storageProvider.hasArtifactById(
      project,
      artifactId,
    );
    expect(hasArtifact).toBe(true);

    const pullResult = await pull(
      project,
      artifactId,
      storageProvider,
      localStorage,
      {
        force: false,
        debug: false,
      },
    );

    expect(pullResult.pulledIds).toContain(artifactId);
    expect(pullResult.failedIds).toHaveLength(0);

    const hasLocal = await localStorage.hasId(project, artifactId);
    expect(hasLocal).toBe(true);

    const localArtifact = await localStorage.retrieveArtifactById(
      project,
      artifactId,
    );
    const originalContent = await fs.readFile(artifactPath, "utf-8");
    const originalJson = JSON.parse(originalContent) as { id: string };

    expect(localArtifact.origin.id).toBe(originalJson.id);
  });

  test("push artifact [Foundry Counter] without tag → pull by ID", async () => {
    const project = createTestProjectName(TEST_CONSTANTS.PROJECTS.DEFAULT);
    const artifactPath = TEST_CONSTANTS.PATHS.SAMPLE_ARTIFACT.FOUNDRY_COUNTER;

    await localStorage.ensureProjectSetup(project);

    const artifactId = await push(
      artifactPath,
      project,
      undefined,
      storageProvider,
      {
        force: false,
        debug: false,
      },
    );

    expect(artifactId).toBeTruthy();
    expect(artifactId).toHaveLength(12);

    const hasArtifact = await storageProvider.hasArtifactById(
      project,
      artifactId,
    );
    expect(hasArtifact).toBe(true);

    const pullResult = await pull(
      project,
      artifactId,
      storageProvider,
      localStorage,
      {
        force: false,
        debug: false,
      },
    );

    expect(pullResult.pulledIds).toContain(artifactId);
    expect(pullResult.failedIds).toHaveLength(0);

    const hasLocal = await localStorage.hasId(project, artifactId);
    expect(hasLocal).toBe(true);

    const localArtifact = await localStorage.retrieveArtifactById(
      project,
      artifactId,
    );
    const originalContent = await fs.readFile(artifactPath, "utf-8");
    const originalJson = JSON.parse(originalContent) as { id: string };

    expect(localArtifact.origin.id).toBe(originalJson.id);
  });

  test("push artifact [Hardhat V3 Counter] without tag -> pull by ID", async () => {
    const project = createTestProjectName(TEST_CONSTANTS.PROJECTS.DEFAULT);
    const artifactPath =
      TEST_CONSTANTS.PATHS.SAMPLE_ARTIFACT.HARDHAT_V3_COUNTER;

    await localStorage.ensureProjectSetup(project);

    const artifactId = await push(
      artifactPath,
      project,
      undefined,
      storageProvider,
      {
        force: false,
        debug: false,
      },
    );

    expect(artifactId).toBeTruthy();
    expect(artifactId).toHaveLength(12);

    const hasArtifact = await storageProvider.hasArtifactById(
      project,
      artifactId,
    );
    expect(hasArtifact).toBe(true);

    const pullResult = await pull(
      project,
      artifactId,
      storageProvider,
      localStorage,
      {
        force: false,
        debug: false,
      },
    );

    expect(pullResult.pulledIds).toContain(artifactId);
    expect(pullResult.failedIds).toHaveLength(0);

    const hasLocal = await localStorage.hasId(project, artifactId);
    expect(hasLocal).toBe(true);

    const localArtifact = await localStorage.retrieveArtifactById(
      project,
      artifactId,
    );
    const originalContent = await fs.readFile(artifactPath, "utf-8");
    const originalJson = JSON.parse(originalContent) as { id: string };

    expect(localArtifact.origin.id).toBe(originalJson.id);
  });

  test("push artifact with tag → pull by tag", async () => {
    const project = createTestProjectName(TEST_CONSTANTS.PROJECTS.DEFAULT);
    const tag = TEST_CONSTANTS.TAGS.V1;
    const artifactPath =
      TEST_CONSTANTS.PATHS.SAMPLE_ARTIFACT.HARDHAT_V2_COUNTER;

    await localStorage.ensureProjectSetup(project);

    const artifactId = await push(artifactPath, project, tag, storageProvider, {
      force: false,
      debug: false,
    });

    const hasTag = await storageProvider.hasArtifactByTag(project, tag);
    const hasId = await storageProvider.hasArtifactById(project, artifactId);
    expect(hasTag).toBe(true);
    expect(hasId).toBe(true);

    const pullResult = await pull(project, tag, storageProvider, localStorage, {
      force: false,
      debug: false,
    });

    expect(pullResult.pulledTags).toContain(tag);
    expect(pullResult.failedTags).toHaveLength(0);

    const hasLocalTag = await localStorage.hasTag(project, tag);
    expect(hasLocalTag).toBe(true);

    const localArtifact = await localStorage.retrieveArtifactByTag(
      project,
      tag,
    );
    expect(localArtifact).toBeTruthy();
  });

  test("pull all artifacts for a project", async () => {
    const project = createTestProjectName(
      TEST_CONSTANTS.PROJECTS.MULTI_ARTIFACT,
    );
    const artifactPath =
      TEST_CONSTANTS.PATHS.SAMPLE_ARTIFACT.HARDHAT_V2_COUNTER;

    await localStorage.ensureProjectSetup(project);

    const tag1 = TEST_CONSTANTS.TAGS.V1;
    const tag2 = TEST_CONSTANTS.TAGS.V2;

    await push(artifactPath, project, tag1, storageProvider, {
      force: false,
      debug: false,
    });
    await push(artifactPath, project, tag2, storageProvider, {
      force: true,
      debug: false,
    });

    const pullResult = await pull(
      project,
      undefined,
      storageProvider,
      localStorage,
      { force: false, debug: false },
    );

    expect(pullResult.pulledTags).toHaveLength(2);
    expect(pullResult.pulledTags).toContain(tag1);
    expect(pullResult.pulledTags).toContain(tag2);
  });

  test("force push overwrites existing tag", async () => {
    const project = createTestProjectName(TEST_CONSTANTS.PROJECTS.FORCE_TEST);
    const tag = TEST_CONSTANTS.TAGS.LATEST;
    const artifactPath =
      TEST_CONSTANTS.PATHS.SAMPLE_ARTIFACT.HARDHAT_V2_COUNTER;

    await localStorage.ensureProjectSetup(project);

    const id1 = await push(artifactPath, project, tag, storageProvider, {
      force: false,
      debug: false,
    });

    await expect(
      push(artifactPath, project, tag, storageProvider, {
        force: false,
        debug: false,
      }),
    ).rejects.toThrow(/already exists/);

    const id2 = await push(artifactPath, project, tag, storageProvider, {
      force: true,
      debug: false,
    });

    expect(id1).toBe(id2);

    const hasTag = await storageProvider.hasArtifactByTag(project, tag);
    expect(hasTag).toBe(true);
  });

  test("pull with force re-downloads existing artifacts", async () => {
    const project = createTestProjectName(TEST_CONSTANTS.PROJECTS.DEFAULT);
    const tag = TEST_CONSTANTS.TAGS.V1;
    const artifactPath =
      TEST_CONSTANTS.PATHS.SAMPLE_ARTIFACT.HARDHAT_V2_COUNTER;

    await localStorage.ensureProjectSetup(project);

    await push(artifactPath, project, tag, storageProvider, {
      force: false,
      debug: false,
    });
    await pull(project, tag, storageProvider, localStorage, {
      force: false,
      debug: false,
    });

    const result1 = await pull(project, tag, storageProvider, localStorage, {
      force: false,
      debug: false,
    });
    expect(result1.pulledTags).toHaveLength(0);

    const result2 = await pull(project, tag, storageProvider, localStorage, {
      force: true,
      debug: false,
    });
    expect(result2.pulledTags).toContain(tag);
  });

  test("pull non-existent artifact returns error", async () => {
    const project = createTestProjectName(TEST_CONSTANTS.PROJECTS.DEFAULT);

    await localStorage.ensureProjectSetup(project);

    await expect(
      pull(project, "non-existent-tag", storageProvider, localStorage, {
        force: false,
        debug: false,
      }),
    ).rejects.toThrow();
  });

  test("list operations work correctly", async () => {
    const project = createTestProjectName(TEST_CONSTANTS.PROJECTS.DEFAULT);
    const artifactPath =
      TEST_CONSTANTS.PATHS.SAMPLE_ARTIFACT.HARDHAT_V2_COUNTER;

    await localStorage.ensureProjectSetup(project);

    const tag1 = TEST_CONSTANTS.TAGS.V1;
    const tag2 = TEST_CONSTANTS.TAGS.V2;

    const id1 = await push(artifactPath, project, tag1, storageProvider, {
      force: false,
      debug: false,
    });
    await push(artifactPath, project, tag2, storageProvider, {
      force: true,
      debug: false,
    });

    const remoteTags = await storageProvider.listTags(project);
    expect(remoteTags).toHaveLength(2);
    expect(remoteTags).toContain(tag1);
    expect(remoteTags).toContain(tag2);

    const remoteIds = await storageProvider.listIds(project);
    expect(remoteIds).toHaveLength(1);
    expect(remoteIds).toContain(id1);
  });

  test.runIf(providerType === "local")(
    "stores original content files",
    async () => {
      const localStorageProvider = storageProvider as LocalStorageProvider;
      const project = createTestProjectName(TEST_CONSTANTS.PROJECTS.DEFAULT);
      const artifactPath =
        TEST_CONSTANTS.PATHS.SAMPLE_ARTIFACT.HARDHAT_V2_COUNTER;

      await localStorage.ensureProjectSetup(project);

      const artifactId = await push(
        artifactPath,
        project,
        undefined,
        storageProvider,
        {
          force: false,
          debug: false,
        },
      );

      const providerRoot = localStorageProvider.getPath();
      const storedBuildInfo = path.join(
        providerRoot,
        project,
        "ids",
        artifactId,
        "original-content",
        artifactPath.replace(/^\.\//, ""),
      );

      const stored = await fs.stat(storedBuildInfo);
      expect(stored.isFile()).toBe(true);
    },
  );
});
