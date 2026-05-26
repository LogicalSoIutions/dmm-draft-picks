import Image from "next/image";

import {
  captains,
  picks,
  type CaptainAssignments,
  type Participant,
} from "@/data/participants";
import { buildSlotAssignments, snakeSlotsByCaptain } from "@/lib/snake-draft";

type DraftViewerProps = {
  order: string[];
  captainAssignments: CaptainAssignments;
};

const pickMap = new Map(picks.map((pick) => [pick.id, pick]));

type ReadOnlySlotProps = {
  slotNumber: number;
  pickId: string | null;
};

function ReadOnlySlot({ slotNumber, pickId }: ReadOnlySlotProps) {
  const pick = pickId ? pickMap.get(pickId) ?? null : null;
  const empty = pick === null;
  return (
    <div className={`snake-slot${empty ? " is-empty" : ""}`}>
      {empty ? (
        <span className="snake-slot-number">{slotNumber}</span>
      ) : (
        <div className="participant-card pick-card pick-card-readonly">
          <Image
            src={pick.imagePath}
            alt={pick.label}
            width={64}
            height={64}
            className="participant-image"
          />
          <strong>{pick.label}</strong>
          <span className="pick-card-slot">#{slotNumber}</span>
        </div>
      )}
    </div>
  );
}

type ReadOnlyCaptainColumnProps = {
  captain: Participant;
  slotNumbers: number[];
  slotAssignments: (string | null)[];
};

function ReadOnlyCaptainColumn({
  captain,
  slotNumbers,
  slotAssignments,
}: ReadOnlyCaptainColumnProps) {
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
          <ReadOnlySlot
            key={slotNumber}
            slotNumber={slotNumber}
            pickId={slotAssignments[slotNumber - 1]}
          />
        ))}
      </div>
    </div>
  );
}

export function DraftViewer({ order, captainAssignments }: DraftViewerProps) {
  const slotAssignments = buildSlotAssignments(order, captainAssignments);
  return (
    <div className="card">
      <h2>Captain Table</h2>
      <p>
        Snake-draft order: pick #1 goes to the first captain, then the order
        reverses across each row.
      </p>
      <div className="captain-table-scroll">
        <div className="captain-table">
          {captains.map((captain, captainIndex) => (
            <ReadOnlyCaptainColumn
              key={captain.id}
              captain={captain}
              slotNumbers={snakeSlotsByCaptain[captainIndex]}
              slotAssignments={slotAssignments}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
