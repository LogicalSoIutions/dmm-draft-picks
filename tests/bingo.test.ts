import { describe, expect, it } from "vitest";

import {
  BINGO_TILE_COUNT,
  bingoTierLabels,
  bingoTierOrder,
  bingoTierRequiredCounts,
  bingoTierTemplateByLayoutIndex,
  bingoTileCellIndices,
  getRequiredTierForLayoutIndex,
  hasBingo,
  isBingoTilePoolReady,
  type BingoTier,
  validateCardLayout,
  validateCompletedTileIds,
  validateTileOptions,
  type BingoTile,
} from "@/lib/bingo";

const makeTieredInputs = (counts: Record<BingoTier, number>) => {
  const result: Array<{ label: string; tier: BingoTier }> = [];
  for (const tier of bingoTierOrder) {
    for (let index = 0; index < counts[tier]; index += 1) {
      result.push({ label: `${bingoTierLabels[tier]} ${index + 1}`, tier });
    }
  }
  return result;
};

const validatedTiles = (
  counts: Record<BingoTier, number> = {
    easy: 8,
    medium: 7,
    hard: 5,
    insane: 3,
    legendary: 1,
  },
  options: { allowPartial?: boolean } = {},
): BingoTile[] => {
  const result = validateTileOptions(makeTieredInputs(counts), options);
  if (!result.valid) {
    throw new Error(result.message);
  }
  return result.tiles;
};

const cellIndexToTileId = (layout: string[], cellIndex: number): string => {
  const layoutIndex = bingoTileCellIndices.indexOf(cellIndex);
  if (layoutIndex < 0) {
    throw new Error(`Cell ${cellIndex} is the FREE center`);
  }
  return layout[layoutIndex];
};

const buildValidLayout = (tiles: BingoTile[]): string[] => {
  const byTier: Record<BingoTier, string[]> = {
    easy: [],
    medium: [],
    hard: [],
    insane: [],
    legendary: [],
  };
  for (const tile of tiles) {
    byTier[tile.tier].push(tile.id);
  }
  return Array.from({ length: BINGO_TILE_COUNT }, (_, layoutIndex) => {
    const tier = getRequiredTierForLayoutIndex(layoutIndex);
    const next = byTier[tier].shift();
    if (!next) {
      throw new Error(`Missing tile for ${tier}`);
    }
    return next;
  });
};

const countTemplateTiers = (): Record<BingoTier, number> => {
  const counts: Record<BingoTier, number> = {
    easy: 0,
    medium: 0,
    hard: 0,
    insane: 0,
    legendary: 0,
  };
  for (const tier of bingoTierTemplateByLayoutIndex) {
    counts[tier] += 1;
  }
  return counts;
};

describe("validateTileOptions", () => {
  it("accepts bounded tier pools", () => {
    const result = validateTileOptions(
      makeTieredInputs({
        easy: 10,
        medium: 8,
        hard: 6,
        insane: 3,
        legendary: 1,
      }),
    );
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.tiles).toHaveLength(28);
      expect(result.tiles.every((tile) => bingoTierOrder.includes(tile.tier))).toBe(
        true,
      );
    }
  });

  it("rejects missing minimum required tier options", () => {
    const result = validateTileOptions(
      makeTieredInputs({
        easy: 7,
        medium: 7,
        hard: 5,
        insane: 3,
        legendary: 1,
      }),
    );
    expect(result.valid).toBe(false);
  });

  it("accepts partial pools in partial mode", () => {
    const result = validateTileOptions(
      makeTieredInputs({
        easy: 8,
        medium: 2,
        hard: 0,
        insane: 0,
        legendary: 0,
      }),
      { allowPartial: true },
    );
    expect(result.valid).toBe(true);
  });

  it("rejects options exceeding tier max", () => {
    const result = validateTileOptions(
      makeTieredInputs({
        easy: 8,
        medium: 7,
        hard: 5,
        insane: 3,
        legendary: 3,
      }),
    );
    expect(result.valid).toBe(false);
  });

  it("rejects tiles with empty labels", () => {
    const inputs = makeTieredInputs({
      easy: 8,
      medium: 7,
      hard: 5,
      insane: 3,
      legendary: 1,
    });
    inputs[5] = { label: "   ", tier: "easy" };
    const result = validateTileOptions(inputs);
    expect(result.valid).toBe(false);
  });

});

describe("isBingoTilePoolReady", () => {
  it("returns not ready when any required tier is missing", () => {
    const partial = validatedTiles({
      easy: 8,
      medium: 7,
      hard: 4,
      insane: 3,
      legendary: 1,
    }, { allowPartial: true });
    const readiness = isBingoTilePoolReady(partial);
    expect(readiness.ready).toBe(false);
  });

  it("returns ready when minimum required tier counts are present", () => {
    const ready = validatedTiles({
      easy: 10,
      medium: 8,
      hard: 5,
      insane: 3,
      legendary: 1,
    });
    const readiness = isBingoTilePoolReady(ready);
    expect(readiness.ready).toBe(true);
  });
});

describe("validateCardLayout", () => {
  it("accepts a full layout matching tier slot requirements", () => {
    const tiles = validatedTiles();
    const layout = buildValidLayout(tiles);
    const result = validateCardLayout(layout, tiles);
    expect(result.valid).toBe(true);
  });

  it("rejects layouts that are not full", () => {
    const tiles = validatedTiles();
    const layout = buildValidLayout(tiles).slice(0, BINGO_TILE_COUNT - 1);
    const result = validateCardLayout(layout, tiles);
    expect(result.valid).toBe(false);
  });

  it("rejects duplicate tiles", () => {
    const tiles = validatedTiles();
    const layout = buildValidLayout(tiles);
    layout[1] = layout[0];
    const result = validateCardLayout(layout, tiles);
    expect(result.valid).toBe(false);
  });

  it("rejects tier/slot mismatches", () => {
    const tiles = validatedTiles();
    const layout = buildValidLayout(tiles);
    const swapIndex = layout.findIndex(
      (_, layoutIndex) => getRequiredTierForLayoutIndex(layoutIndex) === "medium",
    );
    const easyIndex = layout.findIndex(
      (_, layoutIndex) => getRequiredTierForLayoutIndex(layoutIndex) === "easy",
    );
    const temp = layout[swapIndex];
    layout[swapIndex] = layout[easyIndex];
    layout[easyIndex] = temp;
    const result = validateCardLayout(layout, tiles);
    expect(result.valid).toBe(false);
  });

  it("rejects unknown tile ids", () => {
    const tiles = validatedTiles();
    const layout = buildValidLayout(tiles);
    layout[0] = "tile-999";
    const result = validateCardLayout(layout, tiles);
    expect(result.valid).toBe(false);
  });
});

describe("validateCompletedTileIds", () => {
  it("accepts known tile ids and deduplicates", () => {
    const tiles = validatedTiles();
    const result = validateCompletedTileIds(
      [tiles[0].id, tiles[1].id, tiles[0].id],
      tiles,
    );
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.completedTileIds).toEqual([tiles[0].id, tiles[1].id]);
    }
  });

  it("rejects unknown ids", () => {
    const tiles = validatedTiles();
    const result = validateCompletedTileIds(["tile-999"], tiles);
    expect(result.valid).toBe(false);
  });
});

describe("hasBingo", () => {
  it("uses a slot template that matches required tier counts", () => {
    const templateCounts = countTemplateTiers();
    for (const tier of bingoTierOrder) {
      expect(templateCounts[tier]).toBe(bingoTierRequiredCounts[tier]);
    }
  });

  it("counts a horizontal row including the free center", () => {
    const tiles = validatedTiles();
    const layout = buildValidLayout(tiles);
    const completed = new Set([
      cellIndexToTileId(layout, 10),
      cellIndexToTileId(layout, 11),
      cellIndexToTileId(layout, 13),
      cellIndexToTileId(layout, 14),
    ]);
    expect(hasBingo(layout, completed)).toBe(true);
  });

  it("counts a vertical column including the free center", () => {
    const tiles = validatedTiles();
    const layout = buildValidLayout(tiles);
    const completed = new Set([
      cellIndexToTileId(layout, 2),
      cellIndexToTileId(layout, 7),
      cellIndexToTileId(layout, 17),
      cellIndexToTileId(layout, 22),
    ]);
    expect(hasBingo(layout, completed)).toBe(true);
  });

  it("counts diagonals including the free center", () => {
    const tiles = validatedTiles();
    const layout = buildValidLayout(tiles);
    const completed = new Set([
      cellIndexToTileId(layout, 0),
      cellIndexToTileId(layout, 6),
      cellIndexToTileId(layout, 18),
      cellIndexToTileId(layout, 24),
    ]);
    expect(hasBingo(layout, completed)).toBe(true);
  });

  it("does not mark incomplete lines as bingo", () => {
    const tiles = validatedTiles();
    const layout = buildValidLayout(tiles);
    const completed = new Set([
      cellIndexToTileId(layout, 0),
      cellIndexToTileId(layout, 1),
      cellIndexToTileId(layout, 2),
      cellIndexToTileId(layout, 3),
    ]);
    expect(hasBingo(layout, completed)).toBe(false);
  });
});

