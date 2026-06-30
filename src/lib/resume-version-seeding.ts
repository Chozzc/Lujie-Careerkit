export function shouldSeedSampleResumeVersion(input: {
  versionId: string;
  existingVersionIds: Set<string>;
  deletedSeedVersionIds: Set<string>;
}) {
  return !input.existingVersionIds.has(input.versionId) && !input.deletedSeedVersionIds.has(input.versionId);
}
