export type ArtifactKey =
  | {
      project: string;
      type: "tag";
      tag: string;
    }
  | {
      project: string;
      type: "id";
      id: string;
    };
