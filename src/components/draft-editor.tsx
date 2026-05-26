"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

type DraftEditorProps = {
  initialOrder: string[];
  initialCaptainAssignments: CaptainAssignments;
  publicId?: string;
  editKey?: string;
};

type SaveState =
  | { kind: "idle"; message: string }
  | { kind: "saving"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ok"; message: string; editUrl?: string; shareUrl?: string };

const POOL_DROPPABLE_ID = "__pool";
const SLOT_DROPPABLE_PREFIX = "slot-";

const pickMap = new Map(picks.map((pick) => [pick.id, pick]));

const buildInitialPool = (
  initialOrder: string[],
  slots: (string | null)[],
): string[] => {
  const assigned = new Set(slots.filter((value): value is string => value !== null));
  const ordered: string[] = [];
  for (const pickId of initialOrder) {
    if (pickMap.has(pickId) && !assigned.has(pickId) && !ordered.includes(pickId)) {
      ordered.push(pickId);
    }
  }
  for (const pick of picks) {
    if (!assigned.has(pick.id) && !ordered.includes(pick.id)) {
      ordered.push(pick.id);
    }
  }
  return ordered;
};

const toAbsoluteUrl = (path: string): string => {
  if (typeof window === "undefined") {
    return path;
  }
  return new URL(path, window.location.origin).toString();
};

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

type DraggablePickProps = {
  pickId: string;
};

function DraggablePick({ pickId }: DraggablePickProps) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: pickId,
  });
  return (
    <div
      ref={setNodeRef}
      className="pick-card-draggable"
      style={{ opacity: isDragging ? 0 : 1 }}
      aria-label={`Drag ${pickMap.get(pickId)?.label ?? pickId}`}
      {...attributes}
      {...listeners}
    >
      <PickCard pickId={pickId} />
    </div>
  );
}

type SnakeSlotProps = {
  slotNumber: number;
  pickId: string | null;
};

function SnakeSlot({ slotNumber, pickId }: SnakeSlotProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${SLOT_DROPPABLE_PREFIX}${slotNumber}`,
  });
  const empty = pickId === null;
  return (
    <div
      ref={setNodeRef}
      className={`snake-slot${empty ? " is-empty" : ""}${isOver ? " is-over" : ""}`}
    >
      {empty ? (
        <span className="snake-slot-number">{slotNumber}</span>
      ) : (
        <DraggablePick pickId={pickId} />
      )}
    </div>
  );
}

type CaptainColumnProps = {
  captain: Participant;
  slotNumbers: number[];
  slotAssignments: (string | null)[];
};

function CaptainColumn({ captain, slotNumbers, slotAssignments }: CaptainColumnProps) {
  return (
    <div className="captain-column">
      <div className="captain-column-header">
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
          />
        ))}
      </div>
    </div>
  );
}

type PoolProps = {
  pickIds: string[];
};

function Pool({ pickIds }: PoolProps) {
  const { setNodeRef, isOver } = useDroppable({ id: POOL_DROPPABLE_ID });
  return (
    <div ref={setNodeRef} className={`pool${isOver ? " is-over" : ""}`}>
      {pickIds.length === 0 ? (
        <p className="pool-empty">All picks placed. Drag one back here to remove it from a slot.</p>
      ) : (
        pickIds.map((pickId) => <DraggablePick key={pickId} pickId={pickId} />)
      )}
    </div>
  );
}

export function DraftEditor({
  initialOrder,
  initialCaptainAssignments,
  publicId,
  editKey,
}: DraftEditorProps) {
  const [slotAssignments, setSlotAssignments] = useState<(string | null)[]>(() =>
    buildSlotAssignments(initialOrder, initialCaptainAssignments),
  );
  const [poolOrder, setPoolOrder] = useState<string[]>(() => {
    const slots = buildSlotAssignments(initialOrder, initialCaptainAssignments);
    return buildInitialPool(initialOrder, slots);
  });
  const [activePickId, setActivePickId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({
    kind: "idle",
    message: "",
  });
  const [latestEditUrl, setLatestEditUrl] = useState<string | undefined>(
    publicId && editKey ? `/d/${publicId}/${editKey}` : undefined,
  );
  const [latestShareUrl, setLatestShareUrl] = useState<string | undefined>(
    publicId ? `/d/${publicId}` : undefined,
  );
  const router = useRouter();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const isEditing = Boolean(publicId && editKey);
  const filledCount = useMemo(
    () => slotAssignments.filter((value) => value !== null).length,
    [slotAssignments],
  );
  const allAssigned = filledCount === SLOT_COUNT;
  const visiblePool = useMemo(
    () => poolOrder.filter((pickId) => !slotAssignments.includes(pickId)),
    [poolOrder, slotAssignments],
  );

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
      setPoolOrder((current) => (current.includes(activeId) ? current : [...current, activeId]));
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
    setPoolOrder((current) => {
      let updated = current.filter((pickId) => pickId !== activeId);
      if (sourceFromPool && occupant !== null && !updated.includes(occupant)) {
        updated = [...updated, occupant];
      }
      return updated;
    });
  };

  const apiPayload = useMemo(() => {
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

  const saveDraft = async () => {
    if (!apiPayload) {
      setSaveState({
        kind: "error",
        message: `Place all ${SLOT_COUNT} picks before saving.`,
      });
      return;
    }
    setSaveState({ kind: "saving", message: "Saving draft..." });
    const endpoint =
      isEditing && publicId && editKey
        ? `/api/drafts/${publicId}?editKey=${encodeURIComponent(editKey)}`
        : "/api/drafts";
    const method = isEditing ? "PATCH" : "POST";
    const response = await fetch(endpoint, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(apiPayload),
    });
    const payload = (await response.json()) as {
      error?: string;
      message?: string;
      editUrl?: string;
      shareUrl?: string;
    };
    if (!response.ok) {
      setSaveState({
        kind: "error",
        message: payload.error ?? payload.message ?? "Failed to save draft",
      });
      return;
    }
    if (payload.editUrl) {
      setLatestEditUrl(payload.editUrl);
    }
    if (payload.shareUrl) {
      setLatestShareUrl(payload.shareUrl);
    }
    setSaveState({
      kind: "ok",
      message: payload.message ?? "Draft saved",
      editUrl: payload.editUrl,
      shareUrl: payload.shareUrl,
    });
    if (!isEditing && payload.editUrl) {
      router.replace(payload.editUrl);
    }
  };

  const absoluteEditUrl = useMemo(
    () => (latestEditUrl ? toAbsoluteUrl(latestEditUrl) : null),
    [latestEditUrl],
  );
  const absoluteShareUrl = useMemo(
    () => (latestShareUrl ? toAbsoluteUrl(latestShareUrl) : null),
    [latestShareUrl],
  );

  return (
    <div className="grid" style={{ gap: 16 }}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className="card">
          <h2>Captain Table</h2>
          <p>
            Drag picks from the pool below into the numbered snake-draft slots. Pick #1 goes to the
            first captain, then snakes back across each row. {filledCount} / {SLOT_COUNT} slots filled.
          </p>
          <div className="captain-table-scroll">
            <div className="captain-table">
              {captains.map((captain, captainIndex) => (
                <CaptainColumn
                  key={captain.id}
                  captain={captain}
                  slotNumbers={snakeSlotsByCaptain[captainIndex]}
                  slotAssignments={slotAssignments}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="card">
          <h2>Unassigned Picks</h2>
          <p>
            {visiblePool.length === 0
              ? "Every pick is placed. Drag any pick here to free up a slot."
              : `${visiblePool.length} pick${visiblePool.length === 1 ? "" : "s"} left to place.`}
          </p>
          <Pool pickIds={visiblePool} />
        </div>
        <DragOverlay dropAnimation={null}>
          {activePickId ? <PickCard pickId={activePickId} variant="overlay" /> : null}
        </DragOverlay>
      </DndContext>
      <div className="row">
        <button
          className="button"
          type="button"
          onClick={saveDraft}
          disabled={saveState.kind === "saving" || !allAssigned}
          title={!allAssigned ? `Place all ${SLOT_COUNT} picks before saving` : undefined}
        >
          {isEditing ? "Update Draft" : "Save Draft"}
        </button>
        <span
          className={`status ${saveState.kind === "error" ? "error" : saveState.kind === "ok" ? "ok" : ""}`}
        >
          {saveState.message}
        </span>
      </div>
      {absoluteEditUrl || absoluteShareUrl ? (
        <div className="card">
          <h2>Draft Links</h2>
          {absoluteEditUrl ? (
            <p>
              Edit URL: <Link href={latestEditUrl ?? "#"}>{absoluteEditUrl}</Link>
            </p>
          ) : null}
          {absoluteShareUrl ? (
            <p>
              Share URL: <Link href={latestShareUrl ?? "#"}>{absoluteShareUrl}</Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
