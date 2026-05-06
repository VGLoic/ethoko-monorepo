export type ArtifactReference =
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

export type ResolvedArtifactReference = {
  project: string;
  id: string;
  tag: string | null;
};
