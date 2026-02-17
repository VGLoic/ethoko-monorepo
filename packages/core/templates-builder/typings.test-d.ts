import { assertType, test } from "vitest";
import type { EthokoBuildInfo } from "./typings";
import type { EthokoArtifact } from "@/utils/artifacts-schemas/ethoko-v0";

test("my types work properly", () => {
  assertType<EthokoBuildInfo>({} as unknown as EthokoArtifact);
});
