import type { ExportAbiResult } from "../cli-client/export-abi";

export function displayExportResult(result: ExportAbiResult): void {
  console.log(JSON.stringify(result.contract.abi, null, 2));
}
