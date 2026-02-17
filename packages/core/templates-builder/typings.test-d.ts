import { assertType, test } from "vitest";
import type { EthokoBuildInfo } from "./typings";
import type { EthokoArtifact } from "@/utils/artifacts-schemas/ethoko-v0";

test("EthokoBuildInfo in generated typings is ok with EthokoArtifact", () => {
  assertType<EthokoBuildInfo>({} as unknown as EthokoArtifact);
});
