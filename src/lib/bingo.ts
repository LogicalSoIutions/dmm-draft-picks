/**
 * Bingo domain types and validation.
 *
 * A bingo card is a 5x5 grid (25 cells). The center cell is a permanent FREE
 * space, so players place exactly 24 tiered tiles around it.
 */

export const BINGO_GRID_DIMENSION = 5;
export const BINGO_CELL_COUNT = BINGO_GRID_DIMENSION * BINGO_GRID_DIMENSION;
export const BINGO_FREE_CELL_INDEX = Math.floor(BINGO_CELL_COUNT / 2);
export const BINGO_TILE_COUNT = BINGO_CELL_COUNT - 1;

export type BingoTier = "easy" | "medium" | "hard" | "insane" | "legendary";

export const bingoTierOrder: BingoTier[] = [
  "easy",
  "medium",
  "hard",
  "insane",
  "legendary",
];

export const bingoTierLabels: Record<BingoTier, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  insane: "Insane",
  legendary: "Legendary",
};

export const bingoTierRequiredCounts: Record<BingoTier, number> = {
  easy: 8,
  medium: 7,
  hard: 5,
  insane: 3,
  legendary: 1,
};

export const bingoTierPoolBounds: Record<
  BingoTier,
  { min: number; max: number }
> = {
  easy: { min: 8, max: 17 },
  medium: { min: 7, max: 14 },
  hard: { min: 5, max: 10 },
  insane: { min: 3, max: 8 },
  legendary: { min: 1, max: 6 },
};

const tierTemplateByCellIndex: Array<BingoTier | "free"> = [
  "hard",
  "medium",
  "hard",
  "easy",
  "hard",
  "medium",
  "insane",
  "easy",
  "hard",
  "medium",
  "medium",
  "easy",
  "free",
  "insane",
  "easy",
  "medium",
  "easy",
  "insane",
  "medium",
  "easy",
  "hard",
  "medium",
  "easy",
  "easy",
  "legendary",
];

export type BingoTile = {
  id: string;
  label: string;
  tier: BingoTier;
};

export type BingoTileInput = {
  id?: unknown;
  label?: unknown;
  tier?: unknown;
};

const MAX_LABEL_LENGTH = 80;

export const tileIdForIndex = (index: number): string => `tile-${index + 1}`;

/**
 * Grid cell indices (0..24) that hold a draggable tile, in row-major order,
 * excluding the FREE center cell. The position in this array is the layout
 * index (0..23) used by stored card layouts.
 */
export const bingoTileCellIndices: number[] = Array.from(
  { length: BINGO_CELL_COUNT },
  (_, cellIndex) => cellIndex,
).filter((cellIndex) => cellIndex !== BINGO_FREE_CELL_INDEX);

export const bingoTierTemplateByLayoutIndex: BingoTier[] = bingoTileCellIndices.map(
  (cellIndex) => {
    const tier = tierTemplateByCellIndex[cellIndex];
    if (tier === "free") {
      throw new Error("Tier template unexpectedly includes free center");
    }
    return tier;
  },
);

export const getRequiredTierForLayoutIndex = (layoutIndex: number): BingoTier =>
  bingoTierTemplateByLayoutIndex[layoutIndex];

export const bingoLineCellIndices: number[][] = [
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24],
  [0, 5, 10, 15, 20],
  [1, 6, 11, 16, 21],
  [2, 7, 12, 17, 22],
  [3, 8, 13, 18, 23],
  [4, 9, 14, 19, 24],
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
];

const parseTier = (value: unknown): BingoTier | null => {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (bingoTierOrder.includes(normalized as BingoTier)) {
    return normalized as BingoTier;
  }
  return null;
};

export const makeTierCountMap = (
  seed = 0,
): Record<BingoTier, number> => ({
  easy: seed,
  medium: seed,
  hard: seed,
  insane: seed,
  legendary: seed,
});

const countTiers = (tiles: BingoTile[]): Record<BingoTier, number> => {
  const counts = makeTierCountMap();
  for (const tile of tiles) {
    counts[tile.tier] += 1;
  }
  return counts;
};

export const validateTileOptions = (
  input: unknown,
  options: { allowPartial?: boolean } = {},
):
  | { valid: true; tiles: BingoTile[] }
  | { valid: false; message: string } => {
  const allowPartial = options.allowPartial ?? false;
  if (!Array.isArray(input)) {
    return { valid: false, message: "Tiles must be an array" };
  }
  if (!allowPartial && input.length === 0) {
    return { valid: false, message: "Provide at least one tile" };
  }
  const tiles: BingoTile[] = [];
  const seenIds = new Set<string>();
  for (let index = 0; index < input.length; index += 1) {
    const entry = input[index] as BingoTileInput;
    if (typeof entry !== "object" || entry === null) {
      return { valid: false, message: `Tile ${index + 1} is invalid` };
    }
    const providedId =
      typeof entry.id === "string" ? entry.id.trim() : "";
    const id = providedId || tileIdForIndex(index);
    if (seenIds.has(id)) {
      return { valid: false, message: `Duplicate tile id: ${id}` };
    }
    seenIds.add(id);
    const label = typeof entry.label === "string" ? entry.label.trim() : "";
    if (label.length === 0) {
      return { valid: false, message: `Tile ${index + 1} needs a label` };
    }
    if (label.length > MAX_LABEL_LENGTH) {
      return {
        valid: false,
        message: `Tile ${index + 1} label is too long (max ${MAX_LABEL_LENGTH} characters)`,
      };
    }
    const tier = parseTier(entry.tier);
    if (!tier) {
      return { valid: false, message: `Tile ${index + 1} needs a valid tier` };
    }
    tiles.push({
      id,
      label,
      tier,
    });
  }
  const tierCounts = countTiers(tiles);
  for (const tier of bingoTierOrder) {
    const { min, max } = bingoTierPoolBounds[tier];
    const count = tierCounts[tier];
    const belowMin = count < min;
    const aboveMax = count > max;
    if (aboveMax || (!allowPartial && belowMin)) {
      return {
        valid: false,
        message: `${bingoTierLabels[tier]} options must be between ${min} and ${max}`,
      };
    }
  }
  return { valid: true, tiles };
};

export const isBingoTilePoolReady = (
  tiles: BingoTile[],
):
  | { ready: true }
  | { ready: false; message: string } => {
  const tierCounts = countTiers(tiles);
  for (const tier of bingoTierOrder) {
    const required = bingoTierRequiredCounts[tier];
    if (tierCounts[tier] < required) {
      return {
        ready: false,
        message: `Waiting for more ${bingoTierLabels[tier]} options before cards can be built.`,
      };
    }
  }
  return { ready: true };
};

export const validateCardLayout = (
  layout: unknown,
  tiles: BingoTile[],
):
  | { valid: true; layout: string[] }
  | { valid: false; message: string } => {
  if (!Array.isArray(layout)) {
    return { valid: false, message: "Layout must be an array" };
  }
  if (layout.length !== BINGO_TILE_COUNT) {
    return {
      valid: false,
      message: `Layout must have exactly ${BINGO_TILE_COUNT} entries`,
    };
  }
  const tilesById = new Map(tiles.map((tile) => [tile.id, tile]));
  const seen = new Set<string>();
  for (const entry of layout) {
    if (typeof entry !== "string") {
      return { valid: false, message: "Layout entries must be strings" };
    }
    if (entry === "") {
      continue;
    }
    const tile = tilesById.get(entry);
    if (!tile) {
      return { valid: false, message: `Unknown tile id: ${entry}` };
    }
    if (seen.has(entry)) {
      return { valid: false, message: "A tile was placed more than once" };
    }
    seen.add(entry);
  }
  for (let layoutIndex = 0; layoutIndex < layout.length; layoutIndex += 1) {
    const tileId = layout[layoutIndex];
    if (tileId === "") {
      continue;
    }
    const tile = tilesById.get(tileId);
    if (!tile) {
      return { valid: false, message: `Unknown tile id: ${tileId}` };
    }
    const requiredTier = getRequiredTierForLayoutIndex(layoutIndex);
    if (tile.tier !== requiredTier) {
      return {
        valid: false,
        message: `Slot ${layoutIndex + 1} requires ${bingoTierLabels[requiredTier]}`,
      };
    }
  }
  return { valid: true, layout: layout as string[] };
};

export const validateCompletedTileIds = (
  completedTileIds: unknown,
  tiles: BingoTile[],
):
  | { valid: true; completedTileIds: string[] }
  | { valid: false; message: string } => {
  if (!Array.isArray(completedTileIds)) {
    return { valid: false, message: "Completed tile ids must be an array" };
  }
  const tileIds = new Set(tiles.map((tile) => tile.id));
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const entry of completedTileIds) {
    if (typeof entry !== "string") {
      return { valid: false, message: "Completed tile ids must be strings" };
    }
    if (!tileIds.has(entry)) {
      return { valid: false, message: `Unknown tile id: ${entry}` };
    }
    if (seen.has(entry)) {
      continue;
    }
    seen.add(entry);
    normalized.push(entry);
  }
  return { valid: true, completedTileIds: normalized };
};

export const hasBingo = (layout: string[], completedTileIds: ReadonlySet<string>): boolean => {
  const completedCellIndices = new Set<number>([BINGO_FREE_CELL_INDEX]);
  for (const tileId of completedTileIds) {
    const layoutIndex = layout.indexOf(tileId);
    if (layoutIndex < 0) {
      continue;
    }
    const cellIndex = bingoTileCellIndices[layoutIndex];
    completedCellIndices.add(cellIndex);
  }
  for (const line of bingoLineCellIndices) {
    const fullLine = line.every((cellIndex) => completedCellIndices.has(cellIndex));
    if (fullLine) {
      return true;
    }
  }
  return false;
};

