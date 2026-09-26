import { MatterEvidenceService } from './evidence-service';

export type { CreateMatterInput, UpdateMatterInput } from './core-service';

/** Stable facade for matter capabilities split across focused service modules. */
export class MatterService extends MatterEvidenceService {}

let matterServiceInstance: MatterService | null = null;

export function getMatterService(): MatterService {
  if (!matterServiceInstance) matterServiceInstance = new MatterService();
  return matterServiceInstance;
}
