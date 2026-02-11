import z from "zod";
import { SolcJsonInputSchema } from "./solc-v0.8.33/input-json";
import { SolcJsonOutputSchema } from "./solc-v0.8.33/output-json";
import {
  FORGE_COMPILER_DEFAULT_OUTPUT_FORMAT,
  FORGE_COMPILER_OUTPUT_WITH_BUILD_INFO_OPTION_FORMAT,
} from "./forge-v1";
import { HARDHAT_V2_COMPILER_OUTPUT_FORMAT } from "./hardhat-v2";
import {
  HARDHAT_V3_COMPILER_OUTPUT_FORMAT,
  HARDHAT_V3_COMPILER_INPUT_FORMAT,
} from "./hardhat-v3";

const OriginSchema = z.discriminatedUnion("format", [
  z.object({
    id: z.string(),
    format: z.enum([
      FORGE_COMPILER_DEFAULT_OUTPUT_FORMAT,
      FORGE_COMPILER_OUTPUT_WITH_BUILD_INFO_OPTION_FORMAT,
      HARDHAT_V2_COMPILER_OUTPUT_FORMAT,
    ]),
  }),
  z.object({
    id: z.string(),
    format: z.literal(HARDHAT_V3_COMPILER_INPUT_FORMAT),
    outputFormat: z.literal(HARDHAT_V3_COMPILER_OUTPUT_FORMAT),
  }),
]);

/**
 * This is the schema for an artifact stored on Ethoko
 */
export const EthokoArtifactSchema = z.object({
  // ID derived by Ethoko
  id: z.string(),
  // Origin of the artifact, can be used to revert to the original compiler output JSON structure if needed.
  origin: OriginSchema,
  solcLongVersion: z.string(),
  input: SolcJsonInputSchema,
  output: SolcJsonOutputSchema,
});

export type EthokoArtifact = z.infer<typeof EthokoArtifactSchema>;
