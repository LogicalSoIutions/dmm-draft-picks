"use client";

import Image from "next/image";
import { useMemo, useState, type CSSProperties } from "react";
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
  captains,
  picks,
  type CaptainAssignments,
  type Participant,
} from "@/data/participants";
import {
  SLOT_COUNT,
  buildSlotAssignments,
  slotToCaptainIndex,
  snakeSlotsByCaptain,
} from "@/lib/snake-draft";

const POOL_DROPPABLE_ID = "__pool";
const SLOT_DROPPABLE_PREFIX = "slot-";

const pickMap = new Map(picks.map((pick) => [pick.id, pick]));
const alphabeticalPickIds = [...picks]
  .sort((left, right) =>
    left.label.localeCompare(right.label, undefined, { sensitivity: "base" }),
  )
  .map((pick) => pick.id);

export type SnakeDraftPayload = {
  order: string[];
  captainAssignments: CaptainAssignments;
};

export type SnakeDraftBoardProps = {
  slotAssignments: (string | null)[];
  visiblePool: string[];
  activePickId: string | null;
  filledCount: number;
  slotCount: number;
  onDragStart?: (event: DragStartEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  onDragCancel?: () => void;
  slotCounters?: (number | null)[];
  slotTeamCounters?: (number | null)[];
  readOnly?: boolean;
  onCounterClick?: (slotNumber: number, type: "exact" | "team") => void;
};

export type SnakeDraftBoardController = {
  filledCount: number;
  slotCount: number;
  allAssigned: boolean;
  apiPayload: SnakeDraftPayload | null;
  boardProps: SnakeDraftBoardProps;
};

export function useSnakeDraftBoard(
  initialOrder: string[],
  initialCaptainAssignments: CaptainAssignments,
): SnakeDraftBoardController {
  const [slotAssignments, setSlotAssignments] = useState<(string | null)[]>(() =>
    buildSlotAssignments(initialOrder, initialCaptainAssignments),
  );
  const [activePickId, setActivePickId] = useState<string | null>(null);

  const filledCount = useMemo(
    () => slotAssignments.filter((value) => value !== null).length,
    [slotAssignments],
  );
  const allAssigned = filledCount === SLOT_COUNT;
  const visiblePool = useMemo(() => {
    const assignedPickIds = new Set(
      slotAssignments.filter((pickId): pickId is string => pickId !== null),
    );
    return alphabeticalPickIds.filter((pickId) => !assignedPickIds.has(pickId));
  }, [slotAssignments]);

  const onDragStart = (event: DragStartEvent) => {
    setActivePickId(String(event.active.id));
  };

  const onDragCancel = () => {
    setActivePickId(null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActivePickId(null);
    if (!over) {
      return;
    }
    const activeId = String(active.id);
    if (!pickMap.has(activeId)) {
      return;
    }
    const overId = String(over.id);
    const sourceSlotIndex = slotAssignments.findIndex((value) => value === activeId);
    const sourceFromPool = sourceSlotIndex < 0;

    if (overId === POOL_DROPPABLE_ID) {
      if (sourceFromPool) {
        return;
      }
      const nextSlots = [...slotAssignments];
      nextSlots[sourceSlotIndex] = null;
      setSlotAssignments(nextSlots);
      return;
    }

    if (!overId.startsWith(SLOT_DROPPABLE_PREFIX)) {
      return;
    }
    const targetSlotNumber = Number(overId.slice(SLOT_DROPPABLE_PREFIX.length));
    if (!Number.isFinite(targetSlotNumber) || targetSlotNumber < 1 || targetSlotNumber > SLOT_COUNT) {
      return;
    }
    const targetSlotIndex = targetSlotNumber - 1;
    if (targetSlotIndex === sourceSlotIndex) {
      return;
    }
    const occupant = slotAssignments[targetSlotIndex];
    const nextSlots = [...slotAssignments];
    nextSlots[targetSlotIndex] = activeId;
    if (!sourceFromPool) {
      nextSlots[sourceSlotIndex] = occupant;
    }
    setSlotAssignments(nextSlots);
  };

  const apiPayload = useMemo<SnakeDraftPayload | null>(() => {
    if (!allAssigned) {
      return null;
    }
    const order: string[] = [];
    const assignments: CaptainAssignments = {};
    for (let index = 0; index < SLOT_COUNT; index += 1) {
      const pickId = slotAssignments[index];
      if (!pickId) {
        return null;
      }
      order.push(pickId);
      const captainIndex = slotToCaptainIndex(index + 1);
      assignments[pickId] = captains[captainIndex].id;
    }
    return { order, captainAssignments: assignments };
  }, [slotAssignments, allAssigned]);

  return {
    filledCount,
    slotCount: SLOT_COUNT,
    allAssigned,
    apiPayload,
    boardProps: {
      slotAssignments,
      visiblePool,
      activePickId,
      filledCount,
      slotCount: SLOT_COUNT,
      onDragStart,
      onDragEnd,
      onDragCancel,
    },
  };
}

type PickCardProps = {
  pickId: string;
  variant?: "default" | "overlay";
};

function PickCard({ pickId, variant = "default" }: PickCardProps) {
  const pick = pickMap.get(pickId);
  if (!pick) {
    return null;
  }
  return (
    <div className={`participant-card pick-card${variant === "overlay" ? " pick-card-overlay" : ""}`}>
      <Image
        src={pick.imagePath}
        alt={pick.label}
        width={64}
        height={64}
        className="participant-image"
      />
      <strong>{pick.label}</strong>
    </div>
  );
}

function DraggablePick({ pickId, readOnly }: { pickId: string; readOnly?: boolean }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: pickId,
    disabled: readOnly,
  });
  return (
    <div
      ref={readOnly ? undefined : setNodeRef}
      className={readOnly ? "pick-card-readonly" : "pick-card-draggable"}
      style={{ opacity: isDragging ? 0 : 1 }}
      aria-label={readOnly ? undefined : `Drag ${pickMap.get(pickId)?.label ?? pickId}`}
      {...(readOnly ? {} : attributes)}
      {...(readOnly ? {} : listeners)}
    >
      <PickCard pickId={pickId} />
    </div>
  );
}

function SnakeSlot({
  slotNumber,
  pickId,
  counter,
  teamCounter,
  readOnly,
  onCounterClick,
}: {
  slotNumber: number;
  pickId: string | null;
  counter?: number | null;
  teamCounter?: number | null;
  readOnly?: boolean;
  onCounterClick?: (slotNumber: number, type: "exact" | "team") => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${SLOT_DROPPABLE_PREFIX}${slotNumber}`,
    disabled: readOnly,
  });
  const empty = pickId === null;

  const handleTeamClick = (e: React.MouseEvent) => {
    if (onCounterClick) {
      e.stopPropagation();
      e.preventDefault();
      onCounterClick(slotNumber, "team");
    }
  };

  const handleExactClick = (e: React.MouseEvent) => {
    if (onCounterClick) {
      e.stopPropagation();
      e.preventDefault();
      onCounterClick(slotNumber, "exact");
    }
  };

  const handleTeamKeyDown = (e: React.KeyboardEvent) => {
    if (onCounterClick && (e.key === "Enter" || e.key === " ")) {
      e.stopPropagation();
      e.preventDefault();
      onCounterClick(slotNumber, "team");
    }
  };

  const handleExactKeyDown = (e: React.KeyboardEvent) => {
    if (onCounterClick && (e.key === "Enter" || e.key === " ")) {
      e.stopPropagation();
      e.preventDefault();
      onCounterClick(slotNumber, "exact");
    }
  };

  const clickable = Boolean(onCounterClick);

  return (
    <div
      ref={readOnly ? undefined : setNodeRef}
      className={`snake-slot${empty ? " is-empty" : ""}${!readOnly && isOver ? " is-over" : ""}`}
    >
      {empty ? (
        <span className="snake-slot-number">{slotNumber}</span>
      ) : (
        <>
          <DraggablePick pickId={pickId} readOnly={readOnly} />
          {teamCounter !== undefined && teamCounter !== null && (
            <span
              className={`snake-slot-counter-team${clickable ? " is-clickable" : ""}`}
              title={clickable ? undefined : `${teamCounter} guessers assigned all these picks to the same captains (ignoring draft order)`}
              onClick={clickable ? handleTeamClick : undefined}
              onKeyDown={clickable ? handleTeamKeyDown : undefined}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
            >
              {teamCounter}
            </span>
          )}
          {counter !== undefined && counter !== null && (
            <span
              className={`snake-slot-counter${clickable ? " is-clickable" : ""}`}
              title={clickable ? undefined : `${counter} guessers got all picks correct in exact order up to this slot`}
              onClick={clickable ? handleExactClick : undefined}
              onKeyDown={clickable ? handleExactKeyDown : undefined}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
            >
              {counter}
            </span>
          )}
        </>
      )}
    </div>
  );
}

function CaptainColumn({
  captain,
  slotNumbers,
  slotAssignments,
  slotCounters,
  slotTeamCounters,
  readOnly,
  onCounterClick,
}: {
  captain: Participant;
  slotNumbers: number[];
  slotAssignments: (string | null)[];
  slotCounters?: (number | null)[];
  slotTeamCounters?: (number | null)[];
  readOnly?: boolean;
  onCounterClick?: (slotNumber: number, type: "exact" | "team") => void;
}) {
  const headerStyle: CSSProperties | undefined = captain.color
    ? ({ "--captain-color": captain.color } as CSSProperties)
    : undefined;
  return (
    <div className="captain-column">
      <div className="captain-column-header" style={headerStyle}>
        <Image
          src={captain.imagePath}
          alt={captain.label}
          width={80}
          height={80}
          className="participant-image"
        />
        <strong>{captain.label}</strong>
      </div>
      <div className="captain-column-slots">
        {slotNumbers.map((slotNumber) => (
          <SnakeSlot
            key={slotNumber}
            slotNumber={slotNumber}
            pickId={slotAssignments[slotNumber - 1]}
            counter={slotCounters ? slotCounters[slotNumber - 1] : undefined}
            teamCounter={slotTeamCounters ? slotTeamCounters[slotNumber - 1] : undefined}
            readOnly={readOnly}
            onCounterClick={onCounterClick}
          />
        ))}
      </div>
    </div>
  );
}

function Pool({ pickIds }: { pickIds: string[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: POOL_DROPPABLE_ID });
  const availablePickIds = new Set(pickIds);
  return (
    <div ref={setNodeRef} className={`pool${isOver ? " is-over" : ""}`}>
      {alphabeticalPickIds.map((pickId) => (
        <div key={pickId} className="pool-slot">
          {availablePickIds.has(pickId) ? (
            <DraggablePick pickId={pickId} />
          ) : (
            <div className="pick-card-placeholder" aria-hidden="true">
              <PickCard pickId={pickId} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function SnakeDraftBoard({
  slotAssignments,
  visiblePool,
  activePickId,
  filledCount,
  slotCount,
  onDragStart,
  onDragEnd,
  onDragCancel,
  slotCounters,
  slotTeamCounters,
  readOnly = false,
  onCounterClick,
}: SnakeDraftBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const boardContent = (
    <>
      <div className="card">
        <h2>Captain Table</h2>
        <p>
          {readOnly
            ? "Snake-draft order: pick #1 goes to the first captain, then the order reverses across each row."
            : `Drag picks from the pool below into the numbered snake-draft slots. Pick #1 goes to the first captain, then snakes back across each row. ${filledCount} / ${slotCount} slots filled.`}
        </p>
        <div className="captain-table-scroll">
          <div className="captain-table">
            {captains.map((captain, captainIndex) => (
              <CaptainColumn
                key={captain.id}
                captain={captain}
                slotNumbers={snakeSlotsByCaptain[captainIndex]}
                slotAssignments={slotAssignments}
                slotCounters={slotCounters}
                slotTeamCounters={slotTeamCounters}
                readOnly={readOnly}
                onCounterClick={onCounterClick}
              />
            ))}
          </div>
        </div>
      </div>
      {!readOnly && (
        <div className="card">
          <h2>Unassigned Picks</h2>
          <p>
            {visiblePool.length === 0
              ? "Every pick is placed. Drag any pick here to free up a slot."
              : `${visiblePool.length} pick${visiblePool.length === 1 ? "" : "s"} left to place.`}
          </p>
          <Pool pickIds={visiblePool} />
        </div>
      )}
    </>
  );

  if (readOnly) {
    return boardContent;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      {boardContent}
      <DragOverlay dropAnimation={null}>
        {activePickId ? <PickCard pickId={activePickId} variant="overlay" /> : null}
      </DragOverlay>
    </DndContext>
  );
}
