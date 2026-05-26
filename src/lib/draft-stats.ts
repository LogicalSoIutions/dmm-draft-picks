import {
  captains,
  picks,
  type CaptainAssignments,
} from "@/data/participants";
import {
  CAPTAIN_COUNT,
  SLOT_COUNT,
  buildSlotAssignments,
  slotToCaptainIndex,
} from "@/lib/snake-draft";

export type DraftInput = {
  picksOrder: string[];
  captainAssignments: CaptainAssignments;
};

export type SlotConsensusEntry = {
  pickId: string;
  count: number;
  percent: number;
};

export type SlotConsensus = {
  slotNumber: number;
  captainIndex: number;
  topEntries: SlotConsensusEntry[];
  filledCount: number;
};

export type PickSlotBucket = {
  slotNumber: number;
  count: number;
  percent: number;
};

export type PickCaptainBucket = {
  captainId: string;
  count: number;
  percent: number;
};

export type PickStats = {
  pickId: string;
  totalAppearances: number;
  modeSlotNumber: number | null;
  modeSlotCount: number;
  modeSlotPercent: number;
  averageSlot: number | null;
  minSlot: number | null;
  maxSlot: number | null;
  slotBuckets: PickSlotBucket[];
  captainBuckets: PickCaptainBucket[];
};

export type CaptainAffinityPick = {
  pickId: string;
  count: number;
  percent: number;
};

export type CaptainAffinity = {
  captainId: string;
  totalAssignments: number;
  topPicks: CaptainAffinityPick[];
};

export type OfficialMatchLeaderEntry = {
  publicId: string;
  ownerKickUsername: string;
  correctSlots: number;
  updatedAt: string;
};

export type OfficialMatchHistogramBucket = {
  correctSlots: number;
  count: number;
  percent: number;
};

export type OfficialMatchStats = {
  totalDrafts: number;
  averageCorrect: number;
  bestCorrect: number;
  histogram: OfficialMatchHistogramBucket[];
  leaderboard: OfficialMatchLeaderEntry[];
};

export type DraftStatsSummary = {
  totalDrafts: number;
  totalUniqueOwners: number;
  lastUpdatedAt: string | null;
};

type SortableEntry = {
  key: string;
  count: number;
};

const TOP_SLOT_ENTRIES = 3;
const TOP_CAPTAIN_PICKS = 4;
const LEADERBOARD_LIMIT = 10;

const safePercent = (count: number, total: number): number => {
  if (total <= 0) {
    return 0;
  }
  return (count / total) * 100;
};

const sortByCountDesc = (a: SortableEntry, b: SortableEntry): number => {
  if (b.count !== a.count) {
    return b.count - a.count;
  }
  return a.key.localeCompare(b.key);
};

const toBucketEntries = <T extends string>(
  counts: Map<T, number>,
  total: number,
): Array<{ key: T; count: number; percent: number }> => {
  const entries: Array<{ key: T; count: number; percent: number }> = [];
  for (const [key, count] of counts.entries()) {
    entries.push({ key, count, percent: safePercent(count, total) });
  }
  entries.sort((a, b) => sortByCountDesc({ key: a.key, count: a.count }, { key: b.key, count: b.count }));
  return entries;
};

export const buildAllSlotAssignments = (
  drafts: DraftInput[],
): (string | null)[][] =>
  drafts.map((draft) =>
    buildSlotAssignments(draft.picksOrder, draft.captainAssignments),
  );

export const computeSummary = (
  drafts: Array<DraftInput & { ownerUserId?: number; updatedAt?: string }>,
): DraftStatsSummary => {
  const owners = new Set<number>();
  let lastUpdated: string | null = null;
  for (const draft of drafts) {
    if (typeof draft.ownerUserId === "number") {
      owners.add(draft.ownerUserId);
    }
    if (draft.updatedAt) {
      if (lastUpdated === null || draft.updatedAt > lastUpdated) {
        lastUpdated = draft.updatedAt;
      }
    }
  }
  return {
    totalDrafts: drafts.length,
    totalUniqueOwners: owners.size,
    lastUpdatedAt: lastUpdated,
  };
};

export const computeSlotConsensus = (
  slotAssignmentsList: (string | null)[][],
): SlotConsensus[] => {
  const result: SlotConsensus[] = [];
  for (let slotIndex = 0; slotIndex < SLOT_COUNT; slotIndex += 1) {
    const counts = new Map<string, number>();
    let filledCount = 0;
    for (const assignments of slotAssignmentsList) {
      const pickId = assignments[slotIndex];
      if (!pickId) {
        continue;
      }
      filledCount += 1;
      counts.set(pickId, (counts.get(pickId) ?? 0) + 1);
    }
    const buckets = toBucketEntries(counts, filledCount);
    const topEntries: SlotConsensusEntry[] = buckets
      .slice(0, TOP_SLOT_ENTRIES)
      .map((entry) => ({
        pickId: entry.key,
        count: entry.count,
        percent: entry.percent,
      }));
    result.push({
      slotNumber: slotIndex + 1,
      captainIndex: slotToCaptainIndex(slotIndex + 1),
      topEntries,
      filledCount,
    });
  }
  return result;
};

const buildPickSlotStats = (
  pickId: string,
  slotAssignmentsList: (string | null)[][],
): {
  totalAppearances: number;
  slotCounts: Map<number, number>;
  slotSum: number;
  minSlot: number | null;
  maxSlot: number | null;
} => {
  const slotCounts = new Map<number, number>();
  let totalAppearances = 0;
  let slotSum = 0;
  let minSlot: number | null = null;
  let maxSlot: number | null = null;
  for (const assignments of slotAssignmentsList) {
    for (let slotIndex = 0; slotIndex < assignments.length; slotIndex += 1) {
      if (assignments[slotIndex] !== pickId) {
        continue;
      }
      const slotNumber = slotIndex + 1;
      totalAppearances += 1;
      slotSum += slotNumber;
      slotCounts.set(slotNumber, (slotCounts.get(slotNumber) ?? 0) + 1);
      if (minSlot === null || slotNumber < minSlot) {
        minSlot = slotNumber;
      }
      if (maxSlot === null || slotNumber > maxSlot) {
        maxSlot = slotNumber;
      }
      break;
    }
  }
  return { totalAppearances, slotCounts, slotSum, minSlot, maxSlot };
};

const buildPickCaptainBuckets = (
  pickId: string,
  slotAssignmentsList: (string | null)[][],
): { captainCounts: Map<string, number>; total: number } => {
  const captainCounts = new Map<string, number>();
  let total = 0;
  for (const assignments of slotAssignmentsList) {
    for (let slotIndex = 0; slotIndex < assignments.length; slotIndex += 1) {
      if (assignments[slotIndex] !== pickId) {
        continue;
      }
      const captainIndex = slotToCaptainIndex(slotIndex + 1);
      const captainId = captains[captainIndex]?.id;
      if (!captainId) {
        break;
      }
      total += 1;
      captainCounts.set(captainId, (captainCounts.get(captainId) ?? 0) + 1);
      break;
    }
  }
  return { captainCounts, total };
};

export const computePickStats = (
  slotAssignmentsList: (string | null)[][],
): PickStats[] => {
  const stats: PickStats[] = [];
  for (const pick of picks) {
    const { totalAppearances, slotCounts, slotSum, minSlot, maxSlot } =
      buildPickSlotStats(pick.id, slotAssignmentsList);
    const slotBucketsRaw = toBucketEntries(
      new Map(
        Array.from(slotCounts.entries()).map(
          ([slot, count]) => [String(slot), count] as const,
        ),
      ),
      totalAppearances,
    );
    const slotBuckets: PickSlotBucket[] = slotBucketsRaw.map((entry) => ({
      slotNumber: Number(entry.key),
      count: entry.count,
      percent: entry.percent,
    }));
    const modeBucket = slotBuckets[0] ?? null;
    const { captainCounts, total: captainTotal } = buildPickCaptainBuckets(
      pick.id,
      slotAssignmentsList,
    );
    const captainBuckets: PickCaptainBucket[] = toBucketEntries(
      captainCounts,
      captainTotal,
    ).map((entry) => ({
      captainId: entry.key,
      count: entry.count,
      percent: entry.percent,
    }));
    stats.push({
      pickId: pick.id,
      totalAppearances,
      modeSlotNumber: modeBucket?.slotNumber ?? null,
      modeSlotCount: modeBucket?.count ?? 0,
      modeSlotPercent: modeBucket?.percent ?? 0,
      averageSlot:
        totalAppearances > 0 ? slotSum / totalAppearances : null,
      minSlot,
      maxSlot,
      slotBuckets,
      captainBuckets,
    });
  }
  return stats;
};

export const computeCaptainAffinity = (
  slotAssignmentsList: (string | null)[][],
): CaptainAffinity[] => {
  const captainPickCounts: Map<string, number>[] = captains.map(
    () => new Map<string, number>(),
  );
  const captainTotals: number[] = new Array(CAPTAIN_COUNT).fill(0);
  for (const assignments of slotAssignmentsList) {
    for (let slotIndex = 0; slotIndex < assignments.length; slotIndex += 1) {
      const pickId = assignments[slotIndex];
      if (!pickId) {
        continue;
      }
      const captainIndex = slotToCaptainIndex(slotIndex + 1);
      const bucket = captainPickCounts[captainIndex];
      if (!bucket) {
        continue;
      }
      bucket.set(pickId, (bucket.get(pickId) ?? 0) + 1);
      captainTotals[captainIndex] += 1;
    }
  }
  return captains.map((captain, captainIndex) => {
    const bucket = captainPickCounts[captainIndex];
    const total = captainTotals[captainIndex];
    const entries = toBucketEntries(bucket, total);
    const topPicks: CaptainAffinityPick[] = entries
      .slice(0, TOP_CAPTAIN_PICKS)
      .map((entry) => ({
        pickId: entry.key,
        count: entry.count,
        percent: entry.percent,
      }));
    return {
      captainId: captain.id,
      totalAssignments: total,
      topPicks,
    };
  });
};

export type OfficialMatchDraftInput = DraftInput & {
  publicId: string;
  ownerKickUsername: string;
  updatedAt: string;
};

export const computeOfficialMatchStats = (
  drafts: OfficialMatchDraftInput[],
  officialAssignments: (string | null)[],
): OfficialMatchStats => {
  const totalDrafts = drafts.length;
  if (totalDrafts === 0) {
    return {
      totalDrafts: 0,
      averageCorrect: 0,
      bestCorrect: 0,
      histogram: [],
      leaderboard: [],
    };
  }
  const correctCounts = new Array<number>(SLOT_COUNT + 1).fill(0);
  const perDraft: OfficialMatchLeaderEntry[] = [];
  let totalCorrect = 0;
  let bestCorrect = 0;
  for (const draft of drafts) {
    const assignments = buildSlotAssignments(
      draft.picksOrder,
      draft.captainAssignments,
    );
    let correct = 0;
    for (let slotIndex = 0; slotIndex < SLOT_COUNT; slotIndex += 1) {
      if (
        assignments[slotIndex] !== null &&
        assignments[slotIndex] === officialAssignments[slotIndex]
      ) {
        correct += 1;
      }
    }
    correctCounts[correct] += 1;
    totalCorrect += correct;
    if (correct > bestCorrect) {
      bestCorrect = correct;
    }
    perDraft.push({
      publicId: draft.publicId,
      ownerKickUsername: draft.ownerKickUsername,
      correctSlots: correct,
      updatedAt: draft.updatedAt,
    });
  }
  const histogram: OfficialMatchHistogramBucket[] = correctCounts.map(
    (count, correctSlots) => ({
      correctSlots,
      count,
      percent: safePercent(count, totalDrafts),
    }),
  );
  perDraft.sort((a, b) => {
    if (b.correctSlots !== a.correctSlots) {
      return b.correctSlots - a.correctSlots;
    }
    return a.updatedAt.localeCompare(b.updatedAt);
  });
  return {
    totalDrafts,
    averageCorrect: totalCorrect / totalDrafts,
    bestCorrect,
    histogram,
    leaderboard: perDraft.slice(0, LEADERBOARD_LIMIT),
  };
};
