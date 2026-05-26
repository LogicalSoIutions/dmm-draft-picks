import Image from "next/image";
import type { CSSProperties } from "react";

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
  colorPicksByCaptain?: boolean;
};

const pickMap = new Map(picks.map((pick) => [pick.id, pick]));

type ReadOnlySlotProps = {
  slotNumber: number;
  pickId: string | null;
  captainColor?: string;
};

function ReadOnlySlot({ slotNumber, pickId, captainColor }: ReadOnlySlotProps) {
  const pick = pickId ? pickMap.get(pickId) ?? null : null;
  const empty = pick === null;
  const colored = !empty && Boolean(captainColor);
  const cardClassName = `participant-card pick-card pick-card-readonly${
    colored ? " pick-card-captain-bordered" : ""
  }`;
  const cardStyle: CSSProperties | undefined = colored
    ? ({ "--captain-color": captainColor } as CSSProperties)
    : undefined;
  return (
    <div className={`snake-slot${empty ? " is-empty" : ""}`}>
      {empty ? (
        <span className="snake-slot-number">{slotNumber}</span>
      ) : (
        <div className={cardClassName} style={cardStyle}>
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
  pickBorderColor?: string;
};

function ReadOnlyCaptainColumn({
  captain,
  slotNumbers,
  slotAssignments,
  pickBorderColor,
}: ReadOnlyCaptainColumnProps) {
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
          <ReadOnlySlot
            key={slotNumber}
            slotNumber={slotNumber}
            pickId={slotAssignments[slotNumber - 1]}
            captainColor={pickBorderColor}
          />
        ))}
      </div>
    </div>
  );
}

export function DraftViewer({
  order,
  captainAssignments,
  colorPicksByCaptain = false,
}: DraftViewerProps) {
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
              pickBorderColor={
                colorPicksByCaptain ? captain.color : undefined
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
