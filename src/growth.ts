// Plant growth: wellness is the main path; timed tasks are a small bonus.
// 7 stages for the default idle look only. Caps so it stays special.

export const GROWTH_MAX_POINTS = 12;
export const GROWTH_WELLNESS_POINTS = 2; // stretch / water / walk
export const GROWTH_TASK_BONUS_POINTS = 1; // timed / important task only

/** 1 = tiny sprouts … 7 = full bushy bloom for the day */
export type GrowthStage = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export function growthStageFor(points: number): GrowthStage {
  const p = Math.max(0, Math.min(GROWTH_MAX_POINTS, Math.floor(points)));
  if (p >= 12) return 7;
  if (p >= 10) return 6;
  if (p >= 8) return 5;
  if (p >= 6) return 4;
  if (p >= 4) return 3;
  if (p >= 2) return 2;
  return 1;
}

/** Friendly labels for UI (never shaming). */
export const GROWTH_LABEL: Record<GrowthStage, string> = {
  1: "tiny paddles",
  2: "little leaves",
  3: "filling out",
  4: "looking lush",
  5: "flower bud",
  6: "pink bloom",
  7: "in full bloom",
};

export const GROWTH_EMOJI: Record<GrowthStage, string> = {
  1: "🌱",
  2: "🌿",
  3: "🪴",
  4: "💚",
  5: "🌷",
  6: "🌸",
  7: "💐",
};

export const GROWTH_STAGE_COUNT = 7;

/** One growth-stage slice of the continuous idle growth clip. */
export interface GrowthStageBand {
  /** Inclusive band start (level-up may scrub from previous end → here). */
  start: number;
  /** Inclusive rest frame / band end (stable plant after pause). */
  end: number;
  /** Idle loop: open eyes + blinks + pause — not the growth morph. */
  loopFrom: number;
  loopTo: number;
  /** Baked full-blink windows (0-based inclusive) inside this stage. */
  blinks: Array<{ from: number; to: number }>;
}

/**
 * Stage bands for the 24fps growth clip (job ee782a48, ~121 frames).
 * Cut on pause-after-blink / growth beats so each stage's idle loop stays
 * smooth (blink + hold) without scrubbing leaf size.
 */
function bands121(n: number): Record<GrowthStage, GrowthStageBand> {
  const last = n - 1;
  const clamp = (a: number, b: number): [number, number] => [
    Math.max(0, Math.min(last, a)),
    Math.max(0, Math.min(last, b)),
  ];
  const mk = (
    start: number,
    end: number,
    loopFrom: number,
    blinks: Array<[number, number]>,
  ): GrowthStageBand => {
    const [s, e] = clamp(start, end);
    const [lf, lt] = clamp(loopFrom, e);
    return {
      start: s,
      end: e,
      loopFrom: Math.min(lf, lt),
      loopTo: Math.max(lf, lt),
      blinks: blinks
        .map(([from, to]) => {
          const f = Math.max(s, from);
          const t = Math.min(e, to);
          return t - f >= 2 ? { from: f, to: t } : null;
        })
        .filter((b): b is { from: number; to: number } => !!b),
    };
  };
  return {
    // tiny paddles → blink → pause
    1: mk(0, 29, 11, [[14, 22]]),
    // little leaves → blink → pause
    2: mk(30, 61, 49, [[52, 58]]),
    // filling out (pause hold; soft lids — no baked blink)
    3: mk(62, 76, 68, []),
    // looking lush
    4: mk(77, 88, 81, []),
    // peak / bud → blink → pause
    5: mk(89, 100, 89, [[92, 98]]),
    // pink bloom hold
    6: mk(101, last, 108, []),
    // full bloom has its own clip (growth7); legacy clip reuses the bloom hold
    7: mk(101, last, 108, []),
  };
}

/** Equal fallback when the clip isn't the 24fps growth take. */
function bandsEqual(n: number, stage: GrowthStage): GrowthStageBand {
  const band = n / GROWTH_STAGE_COUNT;
  const start = Math.min(n - 1, Math.floor((stage - 1) * band));
  let end = Math.min(n - 1, Math.max(start, Math.floor(stage * band) - 1));
  if (stage >= 6) end = n - 1;
  const loopFrom = start + Math.floor((end - start) * 0.4);
  return { start, end, loopFrom, loopTo: end, blinks: [] };
}

export function growthStageBand(
  stage: GrowthStage,
  frameCount: number,
): GrowthStageBand {
  const n = Math.max(1, frameCount);
  if (n >= 100) return bands121(n)[stage];
  // Older ~61-frame 12fps takes — coarse sixths.
  if (n >= 50) {
    const edges = [0, 10, 20, 30, 40, 50, n - 1];
    const st = Math.min(stage, 6);
    const start = edges[st - 1];
    const end = edges[st];
    const loopFrom = start + Math.floor((end - start) * 0.35);
    return { start, end, loopFrom, loopTo: end, blinks: [] };
  }
  return bandsEqual(n, stage);
}

export function growthFrameRange(
  stage: GrowthStage,
  frameCount: number,
): { start: number; end: number } {
  const b = growthStageBand(stage, frameCount);
  return { start: b.start, end: b.end };
}

/**
 * First baked blink in the stage, if any (legacy helper).
 * Prefer growthStageBand(...).blinks for double-blink idle loops.
 */
export function growthBlinkRange(
  stage: GrowthStage,
  frameCount: number,
): { from: number; to: number } | null {
  return growthStageBand(stage, frameCount).blinks[0] ?? null;
}

/** Week key at the 4am day boundary (same as today()). */
export function weekKey(d = new Date()): string {
  const shifted = new Date(d.getTime() - 4 * 60 * 60 * 1000);
  // ISO-ish: year + week number
  const tmp = new Date(Date.UTC(shifted.getFullYear(), shifted.getMonth(), shifted.getDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export interface WeekStats {
  key: string;
  wellness: number; // wellness growth actions
  taskBonus: number; // timed-task bonuses
  stagePeak: GrowthStage;
}

export function emptyWeekStats(): WeekStats {
  return { key: weekKey(), wellness: 0, taskBonus: 0, stagePeak: 1 };
}

export function ensureWeek(stats: WeekStats | undefined | null): WeekStats {
  const key = weekKey();
  if (!stats || stats.key !== key) return emptyWeekStats();
  const peak = Math.min(7, Math.max(1, Math.round(Number(stats.stagePeak) || 1)));
  return {
    key: stats.key,
    wellness: Number(stats.wellness) || 0,
    taskBonus: Number(stats.taskBonus) || 0,
    stagePeak: peak as GrowthStage,
  };
}
