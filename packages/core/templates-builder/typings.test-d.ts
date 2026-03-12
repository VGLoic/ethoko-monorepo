import { assertType, test } from "vitest";
import type * as EthokoTypings from "./typings";
import type {
  EthokoContractOutputArtifact,
  EthokoInputArtifact,
} from "@/utils/ethoko-artifacts-schemas/v0";
import { ExportContractArtifactResult } from "@/cli-client";

test("EthokoInputArtifact in generated typings is ok with Ethoko artifacts", () => {
  assertType<EthokoTypings.EthokoInputArtifact>(
    {} as unknown as EthokoInputArtifact,
  );
});
test("EthokoContractOutputArtifact in generated typings is ok with Ethoko artifacts", () => {
  assertType<EthokoTypings.EthokoOutputContractArtifact>(
    {} as unknown as EthokoContractOutputArtifact,
  );
});

test("ExportContractArtifactResult matches EthokoContractArtifact in typings", () => {
  assertType<EthokoTypings.EthokoContractArtifact>(
    {} as unknown as ExportContractArtifactResult,
  );
});
