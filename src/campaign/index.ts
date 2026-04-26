/**
 * Campaign module barrel export.
 */

export { runCampaign, type RunCampaignOptions, type CampaignRunSummary } from "./run.js";
export {
  aggregateCampaign,
  type AggregateOptions,
  type CampaignReport,
  type CampaignArmReport,
  type NumericSummary,
  type Histogram,
} from "./aggregate.js";
export {
  loadCampaignManifest,
  CampaignManifestSchema,
  manifestPerturbationsToPatches,
  type CampaignManifest,
  type CampaignArm,
  type ForcePerturbationDecl,
} from "./manifest.js";
