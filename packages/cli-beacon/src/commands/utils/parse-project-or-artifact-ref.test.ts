import { describe, expect, test } from "vitest";
import { ProjectOrArtifactReferenceSchema } from "./parse-project-or-artifact-ref";

describe("ProjectOrArtifactReferenceSchema", () => {
  test("should parse valid artifact key with tag", () => {
    expect(
      ProjectOrArtifactReferenceSchema.safeParse("my-project:latest"),
    ).toEqual({
      success: true,
      data: {
        project: "my-project",
        type: "tag",
        tag: "latest",
      },
    });
  });
  test("should parse valid artifact key with id", () => {
    expect(
      ProjectOrArtifactReferenceSchema.safeParse("my-project@12345"),
    ).toEqual({
      success: true,
      data: {
        project: "my-project",
        type: "id",
        id: "12345",
      },
    });
  });

  test("should parse valid artifact key with project only", () => {
    expect(ProjectOrArtifactReferenceSchema.safeParse("my-project")).toEqual({
      success: true,
      data: {
        project: "my-project",
        type: "project",
      },
    });
  });

  const INVALID_KEYS = [
    "", // Empty string
    null, // Null value
    ":", // Missing project and tag/id
    "@", // Missing project and id
    "my-project:", // Missing tag
    "my-project@", // Missing id
    "my:project:latest", // Too many colons
    "my@project@12345", // Too many at symbols
    "my-project:latest@12345", // Both delimiters
    "my-project:my-tag/invalid", // Invalid characters in tag
    "my-project:my-tag\\invalid", // Invalid characters in tag
    "my-project:my-tag invalid", // Invalid characters in tag
  ];

  INVALID_KEYS.forEach((key) => {
    test(`should fail to parse invalid artifact key: ${key}`, () => {
      expect(ProjectOrArtifactReferenceSchema.safeParse(key).success).toBe(
        false,
      );
    });
  });
});
