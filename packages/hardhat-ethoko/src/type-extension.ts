import { z } from "zod";
import { EthokoHardhatConfigSchema, EthokoHardhatUserConfig } from "./config";

declare module "hardhat/types/config" {
  export interface HardhatUserConfig {
    ethoko?: EthokoHardhatUserConfig;
  }

  export interface HardhatConfig {
    ethoko?: z.infer<typeof EthokoHardhatConfigSchema>;
  }
}
