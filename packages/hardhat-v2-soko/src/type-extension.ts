import { z } from "zod";
import { SokoHardhatConfigSchema, type SokoHardhatUserConfig } from "./config";

declare module "hardhat/types/config" {
  export interface HardhatUserConfig {
    soko?: SokoHardhatUserConfig;
  }

  export interface HardhatConfig {
    soko?: z.infer<typeof SokoHardhatConfigSchema>;
  }
}
