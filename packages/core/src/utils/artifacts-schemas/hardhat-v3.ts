import z from "zod";
import { SolcJsonInputSchema } from "./solc-v0.8.33/input-json";
import { SolcJsonOutputSchema } from "./solc-v0.8.33/output-json";
import { JsonSchema } from "./json";

export const HARDHAT_V3_COMPILER_INPUT_FORMAT = "hh3-sol-build-info-1";
export const HARDHAT_V3_COMPILER_OUTPUT_FORMAT = "hh3-sol-build-info-output-1";

export const HardhatV3CompilerInputPieceSchema = z.object({
  _format: z.literal(HARDHAT_V3_COMPILER_INPUT_FORMAT),
  id: z.string(),
  solcVersion: z.string().optional(),
  solcLongVersion: z.string(),
  userSourceNameMap: JsonSchema.optional(),
  input: SolcJsonInputSchema,
});

export const HardhatV3CompilerOutputPieceSchema = z.object({
  _format: z.literal(HARDHAT_V3_COMPILER_OUTPUT_FORMAT),
  id: z.string(),
  output: SolcJsonOutputSchema,
});

// This is a smaller schema used for format inference
export const FormatInferenceHardhatV3CompilerInputPieceSchema = z.object({
  _format: z.literal(HARDHAT_V3_COMPILER_INPUT_FORMAT),
  input: z.any(),
});

// This is a smaller schema used for format inference
export const FormatInferenceHardhatV3CompilerOutputPieceSchema = z.object({
  _format: z.literal(HARDHAT_V3_COMPILER_OUTPUT_FORMAT),
  output: z.any(),
});
