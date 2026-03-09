import z from "zod";
import { SolcJsonInputSchema } from "../solc-artifacts-schemas/v0.8.33/input-json";
import { SolcJsonOutputSchema } from "../solc-artifacts-schemas/v0.8.33/output-json";
import { FORGE_COMPILER_OUTPUT_WITH_BUILD_INFO_OPTION_FORMAT } from "../supported-origins/forge-v1/schemas";
import { HARDHAT_V2_COMPILER_OUTPUT_FORMAT } from "../supported-origins/hardhat-v2/schemas";
import {
  HARDHAT_V3_COMPILER_OUTPUT_FORMAT,
  HARDHAT_V3_COMPILER_INPUT_FORMAT,
} from "../supported-origins/hardhat-v3/schemas";

const EthokoArtifactOriginSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("forge-v1-default"),
  }),
  z.object({
    id: z.string(),
    type: z.literal("forge-v1-with-build-info-option"),
    format: z.literal(FORGE_COMPILER_OUTPUT_WITH_BUILD_INFO_OPTION_FORMAT),
  }),
  z.object({
    id: z.string(),
    type: z.literal("hardhat-v2"),
    format: z.literal(HARDHAT_V2_COMPILER_OUTPUT_FORMAT),
  }),
  z.object({
    type: z.literal("hardhat-v3"),
    pairs: z.array(
      z.object({
        id: z.string(),
        inputFormat: z.literal(HARDHAT_V3_COMPILER_INPUT_FORMAT),
        outputFormat: z.literal(HARDHAT_V3_COMPILER_OUTPUT_FORMAT),
      }),
    ),
  }),
  z.object({
    type: z.literal("hardhat-v3-non-isolated-build"),
    id: z.string(),
    pair: z.object({
      inputFormat: z.literal(HARDHAT_V3_COMPILER_INPUT_FORMAT),
      outputFormat: z.literal(HARDHAT_V3_COMPILER_OUTPUT_FORMAT),
    }),
  }),
]);

export type EthokoArtifactOrigin = z.infer<typeof EthokoArtifactOriginSchema>;

/**
 * Input artifact schema for Ethoko storage
 */
export const EthokoInputArtifactSchema = z.object({
  id: z.string(),
  _format: z.literal("ethoko-input-v0"),
  origin: EthokoArtifactOriginSchema,
  solcLongVersion: z.string(),
  input: SolcJsonInputSchema,
});

/**
 * Output artifact schema for Ethoko storage
 */
export const EthokoOutputArtifactSchema = z.object({
  id: z.string(),
  _format: z.literal("ethoko-output-v0"),
  output: SolcJsonOutputSchema,
});

/**
 * Tag manifest schema for tag references
 */
export const TagManifestSchema = z.object({
  id: z.string(),
});

export type EthokoInputArtifact = z.infer<typeof EthokoInputArtifactSchema>;
export type EthokoOutputArtifact = z.infer<typeof EthokoOutputArtifactSchema>;
export type TagManifest = z.infer<typeof TagManifestSchema>;
