import fs from "fs/promises";
import { createInterface } from "node:readline/promises";
import { styleText } from "util";
import type { StepTracker } from "@/cli-ui";
import { LOG_COLORS } from "@/utils/colors";
import { toAsyncResult } from "@/utils/result";
import { CliError } from "../error";

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
): Promise<string> {
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
    return inputPath;
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
          throw new CliError(
            `Failed to read build info file "${filePath}". Please check the permissions and try again. Run with debug mode for more info.`,
          );
        }

        return {
          name: file.name,
          mtime: statsResult.value.mtime,
          size: statsResult.value.size,
        };
      }),
    );

    jsonFilesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    const options: SelectionOption[] = jsonFilesWithStats.map((file) => ({
      display: `${truncateFilename(file.name)} (${formatTimeAgo(file.mtime)}, ${formatFileSize(file.size)})`,
      value: file.name,
    }));

    const selectedFileName = await promptUserSelection(
      `Multiple JSON files found in "${finalFolderPath}". Please select which build info file to use:`,
      options,
    );
    return `${finalFolderPath}/${selectedFileName}`;
  }

  const targetFile = jsonFiles[0];

  if (!targetFile) {
    throw new CliError(
      `No JSON file found in the provided path "${inputPath}". Please provide a valid path to a JSON compilation artifact (build info) or a directory containing it.`,
    );
  }

  return `${finalFolderPath}/${targetFile.name}`;
}

type SelectionOption = {
  display: string;
  value: string;
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
): Promise<string> {
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
