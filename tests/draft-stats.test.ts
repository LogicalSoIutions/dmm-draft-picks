import { describe, expect, it } from "vitest";

import {
  captains,
  createDefaultCaptainAssignments,
  defaultPickOrder,
  picks,
} from "@/data/participants";
import {
  buildAllSlotAssignments,
  computeCaptainAffinity,
  computeOfficialMatchStats,
  computePickStats,
  computeSlotConsensus,
  computeSummary,
  type DraftInput,
  type OfficialMatchDraftInput,
} from "@/lib/draft-stats";
import { SLOT_COUNT, buildSlotAssignments } from "@/lib/snake-draft";

const makeDraft = (order: string[]): DraftInput => ({
  picksOrder: order,
  captainAssignments: createDefaultCaptainAssignments(order),
});

const swap = <T>(input: T[], a: number, b: number): T[] => {
  const next = [...input];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
};

describe("computeSummary", () => {
  it("counts drafts, unique owners and last-updated", () => {
    const summary = computeSummary([
      { ...makeDraft(defaultPickOrder), ownerUserId: 1, updatedAt: "2026-05-01T00:00:00Z" },
      { ...makeDraft(defaultPickOrder), ownerUserId: 2, updatedAt: "2026-05-03T00:00:00Z" },
      { ...makeDraft(defaultPickOrder), ownerUserId: 1, updatedAt: "2026-05-02T00:00:00Z" },
    ]);
    expect(summary.totalDrafts).toBe(3);
    expect(summary.totalUniqueOwners).toBe(2);
    expect(summary.lastUpdatedAt).toBe("2026-05-03T00:00:00Z");
  });

  it("handles empty input", () => {
    const summary = computeSummary([]);
    expect(summary.totalDrafts).toBe(0);
    expect(summary.totalUniqueOwners).toBe(0);
    expect(summary.lastUpdatedAt).toBeNull();
  });
});

describe("computeSlotConsensus", () => {
  it("returns the most common pick per slot with percentages", () => {
    const baseline = makeDraft(defaultPickOrder);
    const swapped = makeDraft(swap(defaultPickOrder, 0, 1));
    const slotAssignmentsList = buildAllSlotAssignments([
      baseline,
      baseline,
      baseline,
      swapped,
    ]);
    const consensus = computeSlotConsensus(slotAssignmentsList);
    expect(consensus).toHaveLength(SLOT_COUNT);
    const slotOne = consensus[0];
    expect(slotOne.slotNumber).toBe(1);
    expect(slotOne.filledCount).toBe(4);
    expect(slotOne.topEntries[0]).toMatchObject({
      pickId: defaultPickOrder[0],
      count: 3,
    });
    expect(slotOne.topEntries[0].percent).toBeCloseTo(75);
    expect(slotOne.topEntries[1]).toMatchObject({
      pickId: defaultPickOrder[1],
      count: 1,
    });
  });

  it("returns empty entries when no drafts exist", () => {
    const consensus = computeSlotConsensus([]);
    expect(consensus).toHaveLength(SLOT_COUNT);
    for (const slot of consensus) {
      expect(slot.topEntries).toEqual([]);
      expect(slot.filledCount).toBe(0);
    }
  });
});

describe("computePickStats", () => {
  it("computes modal slot, average and captain breakdown per pick", () => {
    const baseline = makeDraft(defaultPickOrder);
    const swapped = makeDraft(swap(defaultPickOrder, 0, 1));
    const slotAssignmentsList = buildAllSlotAssignments([
      baseline,
      baseline,
      swapped,
    ]);
    const baselineSlots = slotAssignmentsList[0];
    const swappedSlots = slotAssignmentsList[2];
    const baselineSlot = baselineSlots.indexOf(defaultPickOrder[0]) + 1;
    const swappedSlot = swappedSlots.indexOf(defaultPickOrder[0]) + 1;
    expect(baselineSlot).toBeGreaterThan(0);
    expect(swappedSlot).toBeGreaterThan(0);
    expect(swappedSlot).not.toBe(baselineSlot);

    const stats = computePickStats(slotAssignmentsList);
    expect(stats).toHaveLength(picks.length);
    const firstPick = stats.find((entry) => entry.pickId === defaultPickOrder[0]);
    expect(firstPick).toBeDefined();
    if (!firstPick) {
      return;
    }
    expect(firstPick.totalAppearances).toBe(3);
    expect(firstPick.modeSlotNumber).toBe(baselineSlot);
    expect(firstPick.modeSlotCount).toBe(2);
    expect(firstPick.modeSlotPercent).toBeCloseTo((2 / 3) * 100);
    expect(firstPick.minSlot).toBe(Math.min(baselineSlot, swappedSlot));
    expect(firstPick.maxSlot).toBe(Math.max(baselineSlot, swappedSlot));
    expect(firstPick.captainBuckets.length).toBeGreaterThan(0);
  });

  it("returns zero stats for picks that never appear", () => {
    const stats = computePickStats([]);
    for (const entry of stats) {
      expect(entry.totalAppearances).toBe(0);
      expect(entry.modeSlotNumber).toBeNull();
      expect(entry.averageSlot).toBeNull();
      expect(entry.slotBuckets).toEqual([]);
      expect(entry.captainBuckets).toEqual([]);
    }
  });
});

describe("computeCaptainAffinity", () => {
  it("builds a full predicted roster for each captain", () => {
    const drafts = [
      makeDraft(defaultPickOrder),
      makeDraft(defaultPickOrder),
    ];
    const affinity = computeCaptainAffinity(drafts);
    expect(affinity).toHaveLength(captains.length);
    const rosteredPickIds = affinity.flatMap((entry) =>
      entry.roster.map((row) => row.pickId),
    );
    expect(rosteredPickIds).toHaveLength(picks.length);
    expect(new Set(rosteredPickIds).size).toBe(picks.length);
    for (const entry of affinity) {
      expect(entry.roster).toHaveLength(picks.length / captains.length);
      expect(entry.roster[0].percent).toBeGreaterThan(0);
    }
  });

  it("matches unanimous drafts exactly", () => {
    const draft = makeDraft(defaultPickOrder);
    const affinity = computeCaptainAffinity([draft, draft, draft]);
    for (const entry of affinity) {
      for (const row of entry.roster) {
        expect(row.percent).toBeCloseTo(100);
        expect(row.count).toBe(3);
      }
    }
  });

  it("returns empty rosters when no drafts exist", () => {
    const affinity = computeCaptainAffinity([]);
    expect(affinity).toHaveLength(captains.length);
    for (const entry of affinity) {
      expect(entry.roster).toEqual([]);
    }
  });
});

describe("computeOfficialMatchStats", () => {
  const buildLeaderEntry = (
    suffix: string,
    order: string[],
  ): OfficialMatchDraftInput => ({
    publicId: `draft-${suffix}`,
    ownerKickUsername: `user-${suffix}`,
    updatedAt: `2026-05-0${suffix}T00:00:00Z`,
    picksOrder: order,
    captainAssignments: createDefaultCaptainAssignments(order),
  });

  it("counts correct slots and builds a histogram + leaderboard", () => {
    const officialOrder = defaultPickOrder;
    const official = buildSlotAssignments(
      officialOrder,
      createDefaultCaptainAssignments(officialOrder),
    );
    const drafts: OfficialMatchDraftInput[] = [
      buildLeaderEntry("1", officialOrder),
      buildLeaderEntry("2", swap(officialOrder, 0, 1)),
      buildLeaderEntry("3", swap(officialOrder, 2, 3)),
    ];
    const result = computeOfficialMatchStats(drafts, official);
    expect(result.totalDrafts).toBe(3);
    expect(result.bestCorrect).toBe(SLOT_COUNT);
    expect(result.leaderboard[0]).toMatchObject({
      publicId: "draft-1",
      correctSlots: SLOT_COUNT,
    });
    const histogramBucket = result.histogram.find(
      (bucket) => bucket.correctSlots === SLOT_COUNT,
    );
    expect(histogramBucket?.count).toBe(1);
    const lowerBucket = result.histogram.find(
      (bucket) => bucket.correctSlots === SLOT_COUNT - 2,
    );
    expect(lowerBucket?.count).toBe(2);
  });

  it("returns zeros when no drafts are provided", () => {
    const result = computeOfficialMatchStats(
      [],
      buildSlotAssignments(
        defaultPickOrder,
        createDefaultCaptainAssignments(defaultPickOrder),
      ),
    );
    expect(result.totalDrafts).toBe(0);
    expect(result.averageCorrect).toBe(0);
    expect(result.bestCorrect).toBe(0);
    expect(result.histogram).toEqual([]);
    expect(result.leaderboard).toEqual([]);
  });
});
