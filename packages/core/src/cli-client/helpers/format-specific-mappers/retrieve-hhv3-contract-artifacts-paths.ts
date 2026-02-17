/**
 * Hardhat v3 artifacts have the usual Build Info input and output
 * But they also output contract artifacts directly, this function is in charge of retrieving their paths
 * @returns The paths of the contract artifacts
 */
export async function retrieveHardhatv3ContractArtifactsPaths(
  buildInfoPath: string,
  compilationId: string,
): Promise<string[]> {
  return [];
}
