/**
 * model-profile.ts — pick the brain by the laptop's RAM (SQ2-8).
 *
 * Correctness lives in the deterministic tools, so a 3B and a 14B return identical numbers —
 * only narration quality + speed differ. This auto-selects the largest model that runs
 * comfortably on the available RAM, unless STATION_MODEL pins one explicitly.
 *
 * Tiers (from Gate 0 + the RAM headroom Windows needs):
 *   >= 30 GB → qwen2.5:14b   (32 GB tier — best narration)
 *   >= 15 GB → qwen2.5:7b    (16 GB tier — the recommended pin)
 *   >=  7 GB → qwen2.5:3b    (8 GB floor — snappy, reliable)
 *   <   7 GB → qwen2.5:3b    (below floor — may be slow; flagged)
 */

export interface ModelProfile {
  model: string;
  tier: string;
  belowFloor: boolean;
}

export function selectModelForRam(totalBytes: number): ModelProfile {
  const gb = totalBytes / 1024 ** 3;
  if (gb >= 30) return { model: "qwen2.5:14b", tier: "32GB+", belowFloor: false };
  if (gb >= 15) return { model: "qwen2.5:7b", tier: "16GB", belowFloor: false };
  if (gb >= 7) return { model: "qwen2.5:3b", tier: "8GB", belowFloor: false };
  return { model: "qwen2.5:3b", tier: "below-floor", belowFloor: true };
}
