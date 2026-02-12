import { styleText } from "node:util";
import type {
  Difference,
  PullResult,
  ListArtifactsResult,
} from "./../cli-client";
import { LOG_COLORS, success, boxSummary, warn } from "./utils";

// ##########################################
// ########### CLI RESULT DISPLAY ###########
// ##########################################

export function displayPullResults(project: string, data: PullResult): void {
  if (data.remoteTags.length === 0 && data.remoteIds.length === 0) {
    success("No artifacts to pull yet");
  } else if (
    data.failedTags.length === 0 &&
    data.failedIds.length === 0 &&
    data.pulledTags.length === 0 &&
    data.pulledIds.length === 0
  ) {
    success(`You're up to date with project "${project}"`);
  } else {
    const summaryLines: string[] = [];

    if (data.pulledTags.length > 0) {
      summaryLines.push(
        styleText(["bold", LOG_COLORS.success], "✔ Pulled Tags:"),
      );
      data.pulledTags.forEach((tag) => {
        summaryLines.push(styleText(LOG_COLORS.success, `  • ${tag}`));
      });
    }
    if (data.pulledIds.length > 0) {
      if (summaryLines.length > 0) summaryLines.push("");
      summaryLines.push(
        styleText(["bold", LOG_COLORS.success], "✔ Pulled IDs:"),
      );
      data.pulledIds.forEach((id) => {
        summaryLines.push(styleText(LOG_COLORS.success, `  • ${id}`));
      });
    }
    if (data.failedTags.length > 0) {
      if (summaryLines.length > 0) summaryLines.push("");
      summaryLines.push(
        styleText(["bold", LOG_COLORS.error], "✖ Failed Tags:"),
      );
      data.failedTags.forEach((tag) => {
        summaryLines.push(styleText(LOG_COLORS.error, `  • ${tag}`));
      });
    }
    if (data.failedIds.length > 0) {
      if (summaryLines.length > 0) summaryLines.push("");
      summaryLines.push(styleText(["bold", LOG_COLORS.error], "✖ Failed IDs:"));
      data.failedIds.forEach((id) => {
        summaryLines.push(styleText(LOG_COLORS.error, `  • ${id}`));
      });
    }

    if (summaryLines.length > 0) {
      boxSummary("Summary", summaryLines);
    }
  }
}

export function displayPushResult(
  project: string,
  tag: string | undefined,
  artifactId: string,
): void {
  console.error("");
  success(`Artifact "${project}:${tag || artifactId}" pushed successfully`);
  console.error(styleText(LOG_COLORS.log, `  ID: ${artifactId}`));
  console.error("");
}

export function displayListArtifactsResults(data: ListArtifactsResult): void {
  if (data.length === 0) {
    warn("No artifacts found");
    return;
  }

  const structuredData = data.map((item) => ({
    Project: item.project,
    Tag: item.tag,
    ID: item.id,
    "Pull date": deriveTimeAgo(item.lastModifiedAt),
  }));

  colorTableHeaders(structuredData, ["Project", "Tag", "ID", "Pull date"]);
}

function deriveTimeAgo(time: string): string {
  const now = new Date();
  const then = new Date(time);
  const diff = now.getTime() - then.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ago`;
  }
  if (hours > 0) {
    return `${hours}h ago`;
  }
  if (minutes > 0) {
    return `${minutes}m ago`;
  }
  return `Less than a minute ago`;
}

export function displayDifferences(differences: Difference[]): void {
  if (differences.length === 0) {
    console.error("");
    success("No differences found");
    console.error("");
    return;
  }

  const added = differences.filter((d) => d.status === "added");
  const removed = differences.filter((d) => d.status === "removed");
  const changed = differences.filter((d) => d.status === "changed");

  const summaryLines: string[] = [];

  if (changed.length > 0) {
    summaryLines.push(styleText(["bold", LOG_COLORS.warn], "Changed:"));
    changed.forEach((diff) => {
      summaryLines.push(
        styleText(LOG_COLORS.warn, `  • ${diff.name} (${diff.path})`),
      );
    });
  }

  if (added.length > 0) {
    if (summaryLines.length > 0) summaryLines.push("");
    summaryLines.push(styleText(["bold", LOG_COLORS.success], "Added:"));
    added.forEach((diff) => {
      summaryLines.push(
        styleText(LOG_COLORS.success, `  • ${diff.name} (${diff.path})`),
      );
    });
  }

  if (removed.length > 0) {
    if (summaryLines.length > 0) summaryLines.push("");
    summaryLines.push(styleText(["bold", LOG_COLORS.error], "Removed:"));
    removed.forEach((diff) => {
      summaryLines.push(
        styleText(LOG_COLORS.error, `  • ${diff.name} (${diff.path})`),
      );
    });
  }

  boxSummary("Differences Found", summaryLines);
}

/**
 * Creates a colored table header row with fixed column widths
 */
function colorTableHeaders(
  data: Record<string, unknown>[],
  headers: string[],
): void {
  if (data.length === 0) {
    return;
  }

  // Calculate the maximum width for each column
  const columnWidths: Record<string, number> = {};
  for (const header of headers) {
    // Start with header length
    columnWidths[header] = header.length;

    // Check all data rows for maximum width
    for (const row of data) {
      const value = row[header];
      const valueLength = String(value).length;
      if (valueLength > columnWidths[header]) {
        columnWidths[header] = valueLength;
      }
    }
  }

  // Pad a string to a specific width
  const pad = (str: string, width: number): string => {
    return str + " ".repeat(Math.max(0, width - str.length));
  };

  // Create header row with fixed widths
  const headerRow = headers
    .map((h) => styleText(["bold", LOG_COLORS.log], pad(h, columnWidths[h]!)))
    .join(" │ ");
  console.error(`\n ${headerRow}`);

  // Create separator row
  const separatorRow = headers
    .map((h) => "─".repeat(columnWidths[h]!))
    .join("─┼─");
  console.error(` ${separatorRow}`);

  // Print data rows with fixed widths
  for (const row of data) {
    const values = headers.map((h) => {
      const value = row[h];
      const strValue = String(value);
      const paddedValue = pad(strValue, columnWidths[h]!);

      // Color the padded value
      if (typeof value === "string") {
        // Color tags (strings that look like versions)
        if (h === "Tag" && value) {
          return styleText(LOG_COLORS.success, paddedValue);
        }
        // Color IDs
        if (h === "ID" && value) {
          return styleText(LOG_COLORS.warn, paddedValue);
        }
        // Color projects
        if (h === "Project" && value) {
          return styleText("magenta", paddedValue);
        }
      }
      return paddedValue;
    });
    console.error(` ${values.join(" │ ")}`);
  }
  console.error();
}
