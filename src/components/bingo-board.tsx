"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import {
  BINGO_CELL_COUNT,
  BINGO_FREE_CELL_INDEX,
  BINGO_TILE_COUNT,
  bingoTierLabels,
  bingoTierOrder,
  bingoTierRequiredCounts,
  bingoTileCellIndices,
  getRequiredTierForLayoutIndex,
  resolveBingoTileImage,
  type BingoTier,
  type BingoTile,
} from "@/lib/bingo";

const TIER_POOL_PREFIX = "__bingo_pool_";
const CELL_DROPPABLE_PREFIX = "bingo-cell-";

const tierPoolDropId = (tier: BingoTier): string => `${TIER_POOL_PREFIX}${tier}`;

const parseTierPoolDropId = (dropId: string): BingoTier | null => {
  if (!dropId.startsWith(TIER_POOL_PREFIX)) {
    return null;
  }
  const tier = dropId.slice(TIER_POOL_PREFIX.length) as BingoTier;
  return bingoTierOrder.includes(tier) ? tier : null;
};

const layoutIndexByCellIndex = new Map<number, number>(
  bingoTileCellIndices.map((cellIndex, layoutIndex) => [cellIndex, layoutIndex]),
);

const UINT32_MAX_PLUS_ONE = 0x1_0000_0000;

const randomInt = (maxExclusive: number): number => {
  if (maxExclusive <= 1) {
    return 0;
  }
  const cryptoApi =
    typeof globalThis !== "undefined" && "crypto" in globalThis
      ? globalThis.crypto
      : null;
  if (!cryptoApi || typeof cryptoApi.getRandomValues !== "function") {
    return Math.floor(Math.random() * maxExclusive);
  }
  const limit =
    UINT32_MAX_PLUS_ONE - (UINT32_MAX_PLUS_ONE % Math.floor(maxExclusive));
  const bucket = new Uint32Array(1);
  while (true) {
    cryptoApi.getRandomValues(bucket);
    const value = bucket[0];
    if (value < limit) {
      return value % maxExclusive;
    }
  }
};

const shuffle = <T,>(input: T[]): T[] => {
  const values = [...input];
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
};

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

type BingoPoolByTier = Record<BingoTier, string[]>;

const makeEmptyPoolByTier = (): BingoPoolByTier => ({
  easy: [],
  medium: [],
  hard: [],
  insane: [],
  legendary: [],
});

const makeEmptyCellIndexBuckets = (): Record<BingoTier, number[]> => ({
  easy: [],
  medium: [],
  hard: [],
  insane: [],
  legendary: [],
});

export type BingoBoardController = {
  filledCount: number;
  tileCount: number;
  allPlaced: boolean;
  layout: string[] | null;
  cellAssignments: (string | null)[];
  poolByTier: BingoPoolByTier;
  selectedTierCounts: Record<BingoTier, number>;
  autoFillPulseCellIndices: number[];
  isAutoFilling: boolean;
  activeTileId: string | null;
  autoFillRandomly: () => Promise<void>;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragCancel: () => void;
};

const buildInitialCells = (
  tiles: BingoTile[],
  initialLayout: string[],
): (string | null)[] => {
  const tileById = new Map(tiles.map((tile) => [tile.id, tile]));
  const cells: (string | null)[] = Array.from(
    { length: BINGO_TILE_COUNT },
    () => null,
  );
  if (initialLayout.length === BINGO_TILE_COUNT) {
    const seen = new Set<string>();
    let valid = true;
    for (let index = 0; index < BINGO_TILE_COUNT; index += 1) {
      const tileId = initialLayout[index];
      const tile = tileById.get(tileId);
      if (!tile || seen.has(tileId)) {
        valid = false;
        break;
      }
      const requiredTier = getRequiredTierForLayoutIndex(index);
      if (tile.tier !== requiredTier) {
        valid = false;
        break;
      }
      seen.add(tileId);
      cells[index] = tileId;
    }
    if (valid) {
      return cells;
    }
  }
  return cells;
};

const buildInitialPoolByTier = (
  tiles: BingoTile[],
  cells: (string | null)[],
): BingoPoolByTier => {
  const poolByTier = makeEmptyPoolByTier();
  const assignedIds = new Set(cells.filter((value): value is string => value !== null));
  for (const tile of tiles) {
    if (!assignedIds.has(tile.id)) {
      poolByTier[tile.tier].push(tile.id);
    }
  }
  return poolByTier;
};

export function useBingoBoard(
  tiles: BingoTile[],
  initialLayout: string[],
): BingoBoardController {
  const tilesById = useMemo(
    () => new Map(tiles.map((tile) => [tile.id, tile])),
    [tiles],
  );
  const tileIdSet = useMemo(
    () => new Set(tiles.map((tile) => tile.id)),
    [tiles],
  );
  const [cellAssignments, setCellAssignments] = useState<(string | null)[]>(
    () => buildInitialCells(tiles, initialLayout),
  );
  const [poolByTier, setPoolByTier] = useState<BingoPoolByTier>(() =>
    buildInitialPoolByTier(tiles, buildInitialCells(tiles, initialLayout)),
  );
  const [autoFillPulseCellIndices, setAutoFillPulseCellIndices] = useState<
    number[]
  >([]);
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [activeTileId, setActiveTileId] = useState<string | null>(null);

  const filledCount = useMemo(
    () => cellAssignments.filter((value) => value !== null).length,
    [cellAssignments],
  );
  const allPlaced = filledCount === BINGO_TILE_COUNT;
  const selectedTierCounts = useMemo(() => {
    const counts: Record<BingoTier, number> = {
      easy: 0,
      medium: 0,
      hard: 0,
      insane: 0,
      legendary: 0,
    };
    for (const tileId of cellAssignments) {
      if (!tileId) {
        continue;
      }
      const tile = tilesById.get(tileId);
      if (tile) {
        counts[tile.tier] += 1;
      }
    }
    return counts;
  }, [cellAssignments, tilesById]);

  const onDragStart = (event: DragStartEvent) => {
    if (isAutoFilling) {
      return;
    }
    setActiveTileId(String(event.active.id));
  };

  const onDragCancel = () => {
    if (isAutoFilling) {
      return;
    }
    setActiveTileId(null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    if (isAutoFilling) {
      return;
    }
    const { active, over } = event;
    setActiveTileId(null);
    if (!over) {
      return;
    }
    const activeId = String(active.id);
    if (!tileIdSet.has(activeId)) {
      return;
    }
    const activeTile = tilesById.get(activeId);
    if (!activeTile) {
      return;
    }
    const overId = String(over.id);
    const overPoolTier = parseTierPoolDropId(overId);
    const sourceCellIndex = cellAssignments.findIndex((value) => value === activeId);
    const sourceFromPool = sourceCellIndex < 0;
    const activeTier = activeTile.tier;
    if (
      sourceFromPool &&
      !poolByTier[activeTier].includes(activeId)
    ) {
      return;
    }

    if (overPoolTier) {
      if (overPoolTier !== activeTier) {
        return;
      }
      if (sourceFromPool) {
        return;
      }
      const nextCells = [...cellAssignments];
      nextCells[sourceCellIndex] = null;
      setCellAssignments(nextCells);
      setPoolByTier((current) => {
        if (current[activeTier].includes(activeId)) {
          return current;
        }
        return {
          ...current,
          [activeTier]: [...current[activeTier], activeId],
        };
      });
      return;
    }

    if (!overId.startsWith(CELL_DROPPABLE_PREFIX)) {
      return;
    }
    const targetCellIndex = Number(overId.slice(CELL_DROPPABLE_PREFIX.length));
    if (
      !Number.isInteger(targetCellIndex) ||
      targetCellIndex < 0 ||
      targetCellIndex >= BINGO_TILE_COUNT
    ) {
      return;
    }
    if (targetCellIndex === sourceCellIndex) {
      return;
    }
    const requiredTier = getRequiredTierForLayoutIndex(targetCellIndex);
    if (requiredTier !== activeTier) {
      return;
    }
    const occupant = cellAssignments[targetCellIndex];
    const nextCells = [...cellAssignments];
    nextCells[targetCellIndex] = activeId;
    if (!sourceFromPool) {
      nextCells[sourceCellIndex] = occupant;
      setCellAssignments(nextCells);
      return;
    }
    setCellAssignments(nextCells);
    setPoolByTier((current) => {
      const next: BingoPoolByTier = {
        easy: [...current.easy],
        medium: [...current.medium],
        hard: [...current.hard],
        insane: [...current.insane],
        legendary: [...current.legendary],
      };
      next[activeTier] = next[activeTier].filter((tileId) => tileId !== activeId);
      if (occupant) {
        const occupantTier = tilesById.get(occupant)?.tier;
        if (occupantTier) {
          next[occupantTier] = [...next[occupantTier], occupant];
        }
      }
      return next;
    });
  };

  const autoFillRandomly = async () => {
    if (isAutoFilling) {
      return;
    }
    const emptyByTier = makeEmptyCellIndexBuckets();
    for (let index = 0; index < cellAssignments.length; index += 1) {
      if (cellAssignments[index] !== null) {
        continue;
      }
      const tier = getRequiredTierForLayoutIndex(index);
      emptyByTier[tier].push(index);
    }
    const pendingSteps: Array<{ tier: BingoTier; cellIndex: number; tileId: string }> =
      [];
    for (const tier of bingoTierOrder) {
      const emptyCells = shuffle(emptyByTier[tier]);
      const availableTiles = shuffle(poolByTier[tier]);
      const stepCount = Math.min(emptyCells.length, availableTiles.length);
      for (let index = 0; index < stepCount; index += 1) {
        pendingSteps.push({
          tier,
          cellIndex: emptyCells[index],
          tileId: availableTiles[index],
        });
      }
    }
    if (pendingSteps.length === 0) {
      return;
    }
    const orderedSteps = shuffle(pendingSteps);
    let nextCells = [...cellAssignments];
    let nextPoolByTier: BingoPoolByTier = {
      easy: [...poolByTier.easy],
      medium: [...poolByTier.medium],
      hard: [...poolByTier.hard],
      insane: [...poolByTier.insane],
      legendary: [...poolByTier.legendary],
    };
    setIsAutoFilling(true);
    setActiveTileId(null);
    setAutoFillPulseCellIndices([]);
    try {
      for (const step of orderedSteps) {
        if (nextCells[step.cellIndex] !== null) {
          continue;
        }
        if (!nextPoolByTier[step.tier].includes(step.tileId)) {
          continue;
        }
        nextPoolByTier = {
          ...nextPoolByTier,
          [step.tier]: nextPoolByTier[step.tier].filter(
            (tileId) => tileId !== step.tileId,
          ),
        };
        nextCells[step.cellIndex] = step.tileId;
        setCellAssignments([...nextCells]);
        setPoolByTier({
          easy: [...nextPoolByTier.easy],
          medium: [...nextPoolByTier.medium],
          hard: [...nextPoolByTier.hard],
          insane: [...nextPoolByTier.insane],
          legendary: [...nextPoolByTier.legendary],
        });
        setAutoFillPulseCellIndices((current) =>
          current.includes(step.cellIndex)
            ? current
            : [...current, step.cellIndex],
        );
        await wait(90 + randomInt(130));
        setAutoFillPulseCellIndices((current) =>
          current.filter((index) => index !== step.cellIndex),
        );
      }
    } finally {
      setAutoFillPulseCellIndices([]);
      setIsAutoFilling(false);
    }
  };

  const layout = useMemo<string[] | null>(() => {
    if (!allPlaced) {
      return null;
    }
    const result: string[] = [];
    for (let index = 0; index < BINGO_TILE_COUNT; index += 1) {
      const tileId = cellAssignments[index];
      if (!tileId) {
        return null;
      }
      result.push(tileId);
    }
    return result;
  }, [cellAssignments, allPlaced]);

  return {
    filledCount,
    tileCount: BINGO_TILE_COUNT,
    allPlaced,
    layout,
    cellAssignments,
    poolByTier,
    selectedTierCounts,
    autoFillPulseCellIndices,
    isAutoFilling,
    activeTileId,
    autoFillRandomly,
    onDragStart,
    onDragEnd,
    onDragCancel,
  };
}

type BingoTileCardProps = {
  tile: BingoTile;
  variant?: "default" | "overlay";
};

function BingoTileCard({ tile, variant = "default" }: BingoTileCardProps) {
  return (
    <div
      className={`bingo-tile tier-${tile.tier}${variant === "overlay" ? " bingo-tile-overlay" : ""}`}
    >
      {tile.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolveBingoTileImage(tile.image)}
          alt=""
          className="bingo-tile-image"
        />
      ) : null}
      <span className="bingo-tile-label">{tile.label}</span>
    </div>
  );
}

function DraggableTile({
  tile,
  disabled,
}: {
  tile: BingoTile;
  disabled?: boolean;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: tile.id,
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      className="bingo-tile-draggable"
      style={{ opacity: isDragging ? 0 : 1 }}
      aria-label={`Drag ${tile.label}`}
      {...attributes}
      {...listeners}
    >
      <BingoTileCard tile={tile} />
    </div>
  );
}

function BingoCell({
  cellIndex,
  layoutIndex,
  requiredTier,
  tile,
  isAutoFillPulse,
  dragDisabled,
}: {
  cellIndex: number;
  layoutIndex: number;
  requiredTier: BingoTier;
  tile: BingoTile | null;
  isAutoFillPulse: boolean;
  dragDisabled: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${CELL_DROPPABLE_PREFIX}${layoutIndex}`,
  });
  const empty = tile === null;
  return (
    <div
      ref={setNodeRef}
      className={`bingo-cell tier-${requiredTier}${empty ? " is-empty" : ""}${isOver ? " is-over" : ""}${
        isAutoFillPulse ? " is-autofill-pulse" : ""
      }`}
    >
      {empty ? (
        <div className="bingo-cell-empty">
          <span className="bingo-cell-index">{cellIndex + 1}</span>
          <span className="bingo-cell-tier">{bingoTierLabels[requiredTier]}</span>
        </div>
      ) : (
        <DraggableTile tile={tile} disabled={dragDisabled} />
      )}
    </div>
  );
}

function FreeCell() {
  return (
    <div className="bingo-cell bingo-cell-free">
      <span className="bingo-free-label">FREE</span>
    </div>
  );
}

function SidePool({
  tier,
  selectedCount,
  tiles,
  dragDisabled,
}: {
  tier: BingoTier;
  selectedCount: number;
  tiles: BingoTile[];
  dragDisabled: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: tierPoolDropId(tier) });
  const requiredCount = bingoTierRequiredCounts[tier];
  return (
    <section
      ref={setNodeRef}
      className={`bingo-tier-lane tier-${tier}${isOver ? " is-over" : ""}`}
    >
      <header className="bingo-tier-lane-header">
        <h3>{bingoTierLabels[tier]}</h3>
        <span>
          {selectedCount} / {requiredCount}
        </span>
      </header>
      <div className="bingo-tier-lane-tiles">
        {tiles.length === 0 ? (
          <p className="bingo-tier-empty">None left</p>
        ) : (
          tiles.map((tile) => (
            <DraggableTile key={tile.id} tile={tile} disabled={dragDisabled} />
          ))
        )}
      </div>
    </section>
  );
}

export type BingoBoardProps = {
  tiles: BingoTile[];
  controller: BingoBoardController;
};

export function BingoBoard({ tiles, controller }: BingoBoardProps) {
  const tileMap = useMemo(
    () => new Map(tiles.map((tile) => [tile.id, tile])),
    [tiles],
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const laneTilesByTier: Record<BingoTier, BingoTile[]> = {
    easy: controller.poolByTier.easy
      .map((tileId) => tileMap.get(tileId))
      .filter((tile): tile is BingoTile => Boolean(tile)),
    medium: controller.poolByTier.medium
      .map((tileId) => tileMap.get(tileId))
      .filter((tile): tile is BingoTile => Boolean(tile)),
    hard: controller.poolByTier.hard
      .map((tileId) => tileMap.get(tileId))
      .filter((tile): tile is BingoTile => Boolean(tile)),
    insane: controller.poolByTier.insane
      .map((tileId) => tileMap.get(tileId))
      .filter((tile): tile is BingoTile => Boolean(tile)),
    legendary: controller.poolByTier.legendary
      .map((tileId) => tileMap.get(tileId))
      .filter((tile): tile is BingoTile => Boolean(tile)),
  };
  const activeTile = controller.activeTileId
    ? tileMap.get(controller.activeTileId) ?? null
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={controller.onDragStart}
      onDragEnd={controller.onDragEnd}
      onDragCancel={controller.onDragCancel}
    >
      <div className="card">
        <h2 className="bingo-card-title">Your Bingo Card</h2>
        <p className="bingo-card-subtitle">
          Drag each tile into a slot that matches its tier. Center is FREE.
          {` ${controller.filledCount} / ${controller.tileCount} `}tiles placed.
        </p>
        <div className="bingo-grid">
          {Array.from({ length: BINGO_CELL_COUNT }, (_, cellIndex) => {
            if (cellIndex === BINGO_FREE_CELL_INDEX) {
              return <FreeCell key="free" />;
            }
            const layoutIndex = layoutIndexByCellIndex.get(cellIndex) ?? 0;
            const tileId = controller.cellAssignments[layoutIndex];
            const tile = tileId ? tileMap.get(tileId) ?? null : null;
            const requiredTier = getRequiredTierForLayoutIndex(layoutIndex);
            return (
              <BingoCell
                key={cellIndex}
                cellIndex={cellIndex}
                layoutIndex={layoutIndex}
                requiredTier={requiredTier}
                tile={tile}
                dragDisabled={controller.isAutoFilling}
                isAutoFillPulse={controller.autoFillPulseCellIndices.includes(
                  layoutIndex,
                )}
              />
            );
          })}
        </div>
        <div className="bingo-tier-lanes">
          {bingoTierOrder.map((tier) => (
            <SidePool
              key={tier}
              tier={tier}
              selectedCount={controller.selectedTierCounts[tier]}
              tiles={laneTilesByTier[tier]}
              dragDisabled={controller.isAutoFilling}
            />
          ))}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTile ? <BingoTileCard tile={activeTile} variant="overlay" /> : null}
      </DragOverlay>
    </DndContext>
  );
}

export function BingoCardView({
  tiles,
  layout,
}: {
  tiles: BingoTile[];
  layout: string[];
}) {
  const tileMap = useMemo(
    () => new Map(tiles.map((tile) => [tile.id, tile])),
    [tiles],
  );
  return (
    <div className="bingo-grid">
      {Array.from({ length: BINGO_CELL_COUNT }, (_, cellIndex) => {
        if (cellIndex === BINGO_FREE_CELL_INDEX) {
          return <FreeCell key="free" />;
        }
        const layoutIndex = layoutIndexByCellIndex.get(cellIndex) ?? 0;
        const tile = tileMap.get(layout[layoutIndex] ?? "") ?? null;
        const requiredTier = getRequiredTierForLayoutIndex(layoutIndex);
        return (
          <div
            key={cellIndex}
            className={`bingo-cell tier-${requiredTier}${tile ? "" : " is-empty"}`}
          >
            {tile ? (
              <BingoTileCard tile={tile} />
            ) : (
              <div className="bingo-cell-empty">
                <span className="bingo-cell-index">{cellIndex + 1}</span>
                <span className="bingo-cell-tier">
                  {bingoTierLabels[requiredTier]}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
