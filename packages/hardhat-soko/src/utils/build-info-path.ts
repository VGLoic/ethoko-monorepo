export type BuildInfoPath =
  | {
      format: "hardhat-v2" | "forge-default" | "forge-with-build-info-option";
      path: string;
    }
  | {
      format: "hardhat-v3";
      inputPath: string;
      outputPath: string;
    };
