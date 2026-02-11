import { z } from "zod";
import { EthokoHardhatConfigSchema, EthokoHardhatUserConfig } from "./config";

declare module "hardhat/types/config" {
  export interface HardhatUserConfig {
    soko?: EthokoHardhatUserConfig;
  }

  export interface HardhatConfig {
    soko?: z.infer<typeof EthokoHardhatConfigSchema>;
  }
}
