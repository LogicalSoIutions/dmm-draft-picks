import {
  captains,
  picks,
  type CaptainAssignments,
} from "@/data/participants";

export const SLOT_COUNT = picks.length;
export const CAPTAIN_COUNT = captains.length;

export const slotToCaptainIndex = (slotNumber: number): number => {
  const rowIndex = Math.floor((slotNumber - 1) / CAPTAIN_COUNT);
  const positionInRow = (slotNumber - 1) % CAPTAIN_COUNT;
  if (rowIndex % 2 === 1) {
    return CAPTAIN_COUNT - 1 - positionInRow;
  }
  return positionInRow;
};

export const buildSnakeSlotsByCaptain = (): number[][] => {
  const grouped: number[][] = captains.map(() => []);
  for (let slot = 1; slot <= SLOT_COUNT; slot += 1) {
    grouped[slotToCaptainIndex(slot)].push(slot);
  }
  return grouped;
};

export const snakeSlotsByCaptain = buildSnakeSlotsByCaptain();

const pickIdSet = new Set(picks.map((pick) => pick.id));
const captainIdSet = new Set(captains.map((captain) => captain.id));
const captainIndexById = new Map(
  captains.map((captain, index) => [captain.id, index] as const),
);

export const buildSlotAssignments = (
  order: string[],
  captainAssignments: CaptainAssignments,
): (string | null)[] => {
  const slots: (string | null)[] = new Array(SLOT_COUNT).fill(null);
  const availableByCaptain = snakeSlotsByCaptain.map((slotNumbers) => [
    ...slotNumbers,
  ]);
  for (const pickId of order) {
    if (!pickIdSet.has(pickId)) {
      continue;
    }
    const captainId = captainAssignments[pickId];
    if (!captainId || !captainIdSet.has(captainId)) {
      continue;
    }
    const captainIndex = captainIndexById.get(captainId);
    if (captainIndex === undefined) {
      continue;
    }
    const nextSlot = availableByCaptain[captainIndex].shift();
    if (nextSlot === undefined) {
      continue;
    }
    slots[nextSlot - 1] = pickId;
  }
  return slots;
};
