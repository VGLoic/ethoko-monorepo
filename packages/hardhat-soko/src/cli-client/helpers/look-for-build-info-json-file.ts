import fs from "fs/promises";
import { createInterface } from "node:readline/promises";
import { styleText } from "util";
import type { StepTracker } from "@/cli-ui";
import { LOG_COLORS } from "@/utils/colors";
import { toAsyncResult } from "@/utils/result";
import { CliError } from "../error";
import { FormatInferenceHardhatV2CompilerOutputSchema } from "@/utils/artifacts-schemas/hardhat-v2";
import {
  FormatInferenceHardhatV3CompilerInputPieceSchema,
  FormatInferenceHardhatV3CompilerOutputPieceSchema,
} from "@/utils/artifacts-schemas/hardhat-v3";
import {
  FormatInferenceForgeCompilerOutputDefaultFormatSchema,
  FormatInferenceForgeCompilerOutputWithBuildInfoOptionSchema,
} from "@/utils/artifacts-schemas/forge-v1";
import { BuildInfoPath } from "@/utils/build-info-path";

type SupportedFormatPerFile =
  | "hardhat-v2"
  | "hardhat-v3-input"
  | "hardhat-v3-output"
  | "forge-default"
  | "forge-with-build-info-option";

type SupportedBuildInfoFormat = BuildInfoPath["format"];

/**
 * Given the input path, look for a build info JSON file
 *
 * This function is meant to be used in other CLI client methods, since it throws a CliError, it can be used without any wrapping, i.e.
 * ```ts
 * const buildInfoPath = await lookForBuildInfo(inputPath);
 * ```
 *
 * If the inputPath is directly a JSON file, return it.
 * If the inputPath is a directory:
 *  - if it contains a `build-info` directory, look for JSON files in it,
 *  - otherwise, look for JSON files in the inputPath directory.
 * In both cases:
 *  - if it contains a single JSON file, return that file,
 *  - if it doesn't contain any JSON file, throw an error,
 *  - if it contains multiple JSON files, prompt the user to select one (unless in CI mode, where it throws an error).
 * @param inputPath The path to look for the build info JSON file
 * @param steps Step tracker to stop spinner during prompts
 * @param opts Options for the function
 * @param opts.debug Enable debug mode
 * @param opts.isCI Whether running in CI environment (disables prompts)
 * @returns The path to the build info JSON file
 * @throws A CliError
 */
export async function lookForBuildInfoJsonFile(
  inputPath: string,
  steps: StepTracker,
  opts: { debug: boolean; isCI?: boolean },
): Promise<BuildInfoPath> {
  const { debug, isCI = false } = opts;
  const statResult = await toAsyncResult(fs.stat(inputPath), { debug });
  if (!statResult.success) {
    throw new CliError(
      `The provided path "${inputPath}" does not exist or is not accessible. Please provide a valid path to a compilation artifact (build info) or a directory containing it.`,
    );
  }

  if (statResult.value.isFile()) {
    if (!inputPath.endsWith(".json")) {
      throw new CliError(
        `The provided path "${inputPath}" is a file but does not have a .json extension. Please provide a valid path to a JSON compilation artifact (build info).`,
      );
    }
    const contentResult = await toAsyncResult(
      fs.readFile(inputPath, "utf-8").then((v) => JSON.parse(v)),
      { debug },
    );
    if (!contentResult.success) {
      throw new CliError(
        `The provided file "${inputPath}" could not be read or is not a valid JSON file. Please check the file and try again. Run with debug mode for more info.`,
      );
    }

    const format = inferSingleJsonFileFormat(contentResult.value);
    if (format === "unknown") {
      throw new CliError(
        `The provided file "${inputPath}" does not seem to be a valid build info JSON file in a supported format. Please provide a valid build info JSON file. Run with debug mode for more info.`,
      );
    }
    if (format === "hardhat-v3-input") {
      // We verify that the corresponding output file exists
      const matchingOutputPath = inputPath.replace(".json", ".output.json");
      const outputCheckResult = await toAsyncResult(
        fs.stat(matchingOutputPath).then((stat) => {
          stat.isFile();
          return fs
            .readFile(matchingOutputPath, "utf-8")
            .then((v) => JSON.parse(v))
            .then((json) => {
              if (inferSingleJsonFileFormat(json) !== "hardhat-v3-output") {
                throw new Error(
                  "Output file does not seem to be in hardhat v3 output format",
                );
              }
            });
        }),
        { debug },
      );
      if (!outputCheckResult.success) {
        throw new CliError(
          `The provided file "${inputPath}" seems to be in Hardhat V3 input format, but the corresponding output file "${matchingOutputPath}" is missing or not valid. Please make sure both files are present and valid. Run with debug mode for more info.`,
        );
      }
      return {
        format: "hardhat-v3",
        inputPath,
        outputPath: matchingOutputPath,
      };
    }
    if (format === "hardhat-v3-output") {
      // We verify that the corresponding input file exists
      const matchingInputPath = inputPath.replace(".output.json", ".json");
      const inputCheckResult = await toAsyncResult(
        fs.stat(matchingInputPath).then((stat) => {
          stat.isFile();
          return fs
            .readFile(matchingInputPath, "utf-8")
            .then((v) => JSON.parse(v))
            .then((json) => {
              if (inferSingleJsonFileFormat(json) !== "hardhat-v3-input") {
                throw new Error(
                  "Input file does not seem to be in hardhat v3 input format",
                );
              }
            });
        }),
        { debug },
      );
      if (!inputCheckResult.success) {
        throw new CliError(
          `The provided file "${inputPath}" seems to be in Hardhat V3 output format, but the corresponding input file "${matchingInputPath}" is missing or not valid. Please make sure both files are present and valid. Run with debug mode for more info.`,
        );
      }
      return {
        format: "hardhat-v3",
        inputPath: matchingInputPath,
        outputPath: inputPath,
      };
    }

    return {
      path: inputPath,
      format,
    };
  }

  if (!statResult.value.isDirectory()) {
    throw new CliError(
      `The provided path "${inputPath}" is neither a file nor a directory. Please provide a valid path to a compilation artifact (build info) or a directory containing it.`,
    );
  }

  const entriesResult = await toAsyncResult(
    fs.readdir(inputPath, { withFileTypes: true }),
    {
      debug,
    },
  );
  if (!entriesResult.success) {
    throw new CliError(
      `The provided path "${inputPath}" is a directory but could not be read. Please check the permissions and try again. Run with debug mode for more info.`,
    );
  }

  let finalEntries = entriesResult.value;
  let finalFolderPath = inputPath;

  // If it contains a `build-info` directory, look for JSON files in it
  const buildInfoDirEntry = entriesResult.value.find(
    (entry) => entry.isDirectory() && entry.name === "build-info",
  );
  if (buildInfoDirEntry) {
    const buildInfoDirPath = `${inputPath}/build-info`;
    const buildInfoEntriesResult = await toAsyncResult(
      fs.readdir(buildInfoDirPath, { withFileTypes: true }),
      { debug },
    );
    if (!buildInfoEntriesResult.success) {
      throw new CliError(
        `The "build-info" directory in the provided path "${inputPath}" could not be read. Please check the permissions and try again. Run with debug mode for more info.`,
      );
    }
    finalFolderPath = buildInfoDirPath;
    finalEntries = buildInfoEntriesResult.value;
  }

  // We consider the JSON files
  const jsonFiles = finalEntries.filter(
    (entry) => entry.isFile() && entry.name.endsWith(".json"),
  );

  if (jsonFiles.length > 1) {
    if (isCI) {
      throw new CliError(
        `Multiple JSON files found in "${finalFolderPath}". In CI environments, please make sure to have a unique JSON file in the directory. Alternatively, please specify a direct path to the build info file instead of a directory to avoid ambiguity.`,
      );
    }

    steps.stop();

    const jsonFilesWithStats = await Promise.all(
      jsonFiles.map(async (file) => {
        const filePath = `${finalFolderPath}/${file.name}`;
        const statsResult = await toAsyncResult(fs.stat(filePath), {
          debug,
        });
        if (!statsResult.success) {
          if (debug) {
            console.error(
              `Failed to get stats for file "${filePath}". Error: ${statsResult.error}`,
            );
          }
          return {
            ignored: true as const,
            name: file.name,
          };
        }

        const formatResult = await toAsyncResult(
          fs
            .readFile(filePath, "utf-8")
            .then((v) => JSON.parse(v))
            .then(inferSingleJsonFileFormat),
          { debug },
        );
        if (!formatResult.success) {
          if (debug) {
            console.error(
              `Failed to infer format for file "${filePath}". Error: ${formatResult.error}`,
            );
          }
          return {
            ignored: true as const,
            name: file.name,
          };
        }
        if (formatResult.value === "unknown") {
          if (debug) {
            console.error(
              `File "${filePath}" is not a valid build info JSON file (format inferred as "unknown"). It will be ignored.`,
            );
          }
          return {
            ignored: true as const,
            name: file.name,
          };
        }

        if (
          formatResult.value === "hardhat-v3-input" ||
          formatResult.value === "hardhat-v3-output"
        ) {
          throw new CliError("REMIND ME: not implemented yet");
        }

        return {
          ignored: false,
          name: file.name,
          filePath,
          mtime: statsResult.value.mtime,
          size: statsResult.value.size,
          format: formatResult.value,
        };
      }),
    );

    let ignoredFilesCount = 0;
    const files = [];
    for (const file of jsonFilesWithStats) {
      if (file.ignored) {
        ignoredFilesCount++;
        continue;
      }
      files.push(file);
    }

    files.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    const options: SelectionOption[] = files.map((file) => ({
      display: `${truncateFilename(file.name)} (${formatBuildInfoFormat(file.format)}, ${formatTimeAgo(file.mtime)}, ${formatFileSize(file.size)})`,
      value: {
        path: file.filePath,
        format: file.format,
      },
    }));

    if (options.length === 0) {
      throw new CliError(
        `No valid JSON files found in "${finalFolderPath}". Please make sure the directory contains valid build info JSON files. Run with debug mode for more info.`,
      );
    }

    const selectedBuildInfo = await promptUserSelection(
      `Multiple JSON files found in "${finalFolderPath}" (${ignoredFilesCount} ignored). Please select which build info file to use:`,
      options,
    );
    return selectedBuildInfo;
  }

  const targetFile = jsonFiles[0];

  if (!targetFile) {
    throw new CliError(
      `No JSON file found in the provided path "${inputPath}". Please provide a valid path to a JSON compilation artifact (build info) or a directory containing it.`,
    );
  }

  const targetFilePath = `${finalFolderPath}/${targetFile.name}`;

  const contentResult = await toAsyncResult(
    fs.readFile(targetFilePath, "utf-8").then((v) => JSON.parse(v)),
    { debug },
  );
  if (!contentResult.success) {
    throw new CliError(
      `The file "${targetFilePath}" could not be read or is not a valid JSON file. Please check the file and try again. Run with debug mode for more info.`,
    );
  }

  const format = inferSingleJsonFileFormat(contentResult.value);
  if (format === "unknown") {
    throw new CliError(
      `No valid build info JSON file found in the provided path "${inputPath}". Please provide a valid path to a JSON compilation artifact (build info) or a directory containing it. Run with debug mode for more info.`,
    );
  }

  if (format === "hardhat-v3-input") {
    throw new CliError(
      `A JSON file in Hardhat V3 input format was found at "${targetFilePath}", but the corresponding output file is missing. Please make sure to provide both the input and output JSON files for Hardhat V3 artifacts. Run with debug mode for more info.`,
    );
  }
  if (format === "hardhat-v3-output") {
    throw new CliError(
      `A JSON file in Hardhat V3 output format was found at "${targetFilePath}", but the corresponding input file is missing. Please make sure to provide both the input and output JSON files for Hardhat V3 artifacts. Run with debug mode for more info.`,
    );
  }

  return {
    format,
    path: targetFilePath,
  };
}

function inferSingleJsonFileFormat(
  jsonContent: unknown,
): SupportedFormatPerFile | "unknown" {
  const hardhatV3ParsingResult =
    FormatInferenceHardhatV3CompilerInputPieceSchema.safeParse(jsonContent);
  if (hardhatV3ParsingResult.success) {
    return "hardhat-v3-input";
  }

  const hardhatV3OutputParsingResult =
    FormatInferenceHardhatV3CompilerOutputPieceSchema.safeParse(jsonContent);
  if (hardhatV3OutputParsingResult.success) {
    return "hardhat-v3-output";
  }

  const forgeDefaultParsingResult =
    FormatInferenceForgeCompilerOutputDefaultFormatSchema.safeParse(
      jsonContent,
    );
  if (forgeDefaultParsingResult.success) {
    return "forge-default";
  }

  const forgeWithBuildInfoOptionParsingResult =
    FormatInferenceForgeCompilerOutputWithBuildInfoOptionSchema.safeParse(
      jsonContent,
    );
  if (forgeWithBuildInfoOptionParsingResult.success) {
    return "forge-with-build-info-option";
  }

  const hardhatV2ParsingResult =
    FormatInferenceHardhatV2CompilerOutputSchema.safeParse(jsonContent);
  if (hardhatV2ParsingResult.success) {
    return "hardhat-v2";
  }

  return "unknown";
}

type SelectionOption = {
  display: string;
  value: BuildInfoPath;
};

/**
 * Prompts the user to select one option from a list
 * @param message The message to display to the user
 * @param options The list of options to choose from
 * @param timeoutMs Optional timeout in milliseconds (default: 30000ms = 30s). Set to 0 to disable timeout.
 * @returns The selected option
 * @throws CliError when timeout is reached
 */
async function promptUserSelection(
  message: string,
  options: SelectionOption[],
  timeoutMs: number = 30_000,
): Promise<BuildInfoPath> {
  const readline = createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  let timeoutId: NodeJS.Timeout | null = null;
  let isTimedOut = false;
  let isClosed = false;

  const timeoutPromise =
    timeoutMs > 0
      ? new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            isTimedOut = true;
            if (!isClosed) {
              isClosed = true;
              readline.close();
            }
            reject(
              new CliError(
                `User selection timed out after ${timeoutMs / 1_000}s.`,
              ),
            );
          }, timeoutMs);
        })
      : new Promise<never>(() => {}); // Never resolves if timeout is disabled

  async function selectionPromise() {
    console.error("");
    console.error(styleText(LOG_COLORS.log, message));
    options.forEach((option, index) => {
      console.error(
        styleText(LOG_COLORS.log, `  ${index + 1}. ${option.display}`),
      );
    });
    console.error("");

    let selectedIndex: number | null = null;
    let warningLinesCount = 0;
    let promptLinesCount = 0;

    while (selectedIndex === null && !isTimedOut) {
      promptLinesCount++;
      const answer = await readline.question(
        styleText(LOG_COLORS.log, "Enter your choice (number): "),
      );

      const parsed = parseInt(answer.trim(), 10);

      if (isNaN(parsed) || parsed < 1 || parsed > options.length) {
        console.error(
          styleText(
            LOG_COLORS.warn,
            `⚠️  Invalid selection. Please enter a number between 1 and ${options.length}`,
          ),
        );
        warningLinesCount++;
      } else {
        selectedIndex = parsed - 1;
      }
    }

    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    if (!isClosed) {
      isClosed = true;
      readline.close();
    }

    const baseLinesCount = 2 + options.length + 1;
    const linesToClear = baseLinesCount + promptLinesCount + warningLinesCount;

    for (let i = 0; i < linesToClear; i++) {
      process.stderr.write("\x1b[1A");
      process.stderr.write("\x1b[2K");
    }
    process.stderr.write("\r");

    if (selectedIndex === null) {
      throw new Error("Selection was interrupted");
    }

    const selected = options[selectedIndex];
    if (!selected) {
      throw new Error(
        `Failed to get selected option at index ${selectedIndex}`,
      );
    }

    return selected.value;
  }

  return await Promise.race([selectionPromise(), timeoutPromise]).catch(
    (error) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (!isClosed) {
        isClosed = true;
        readline.close();
      }
      throw error;
    },
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function truncateFilename(filename: string, maxLength: number = 60): string {
  if (filename.length <= maxLength) return filename;

  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === filename.length - 1) {
    return `${filename.slice(0, Math.max(1, maxLength - 3))}...`;
  }

  const extension = filename.slice(dotIndex);
  const baseMaxLength = Math.max(1, maxLength - extension.length - 3);
  const base = filename.slice(0, baseMaxLength);
  return `${base}...${extension}`;
}

const BUILD_INFO_FORMAT_TO_HUMAN_READABLE: Record<
  SupportedBuildInfoFormat,
  string
> = {
  "hardhat-v2": "Hardhat v2",
  "hardhat-v3": "Hardhat v3",
  "forge-default": "Forge",
  "forge-with-build-info-option": "Forge",
};
function formatBuildInfoFormat(format: SupportedBuildInfoFormat): string {
  return BUILD_INFO_FORMAT_TO_HUMAN_READABLE[format];
}
