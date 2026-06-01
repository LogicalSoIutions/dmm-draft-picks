"use client";

import { useMemo, useState, useEffect } from "react";

import { SnakeDraftBoard } from "@/components/snake-draft-board";
import { captains, type CaptainAssignments } from "@/data/participants";
import { buildSlotAssignments, slotToCaptainIndex } from "@/lib/snake-draft";

type OfficialDraftViewProps = {
  officialOrder: string[];
  officialCaptainAssignments: CaptainAssignments;
  allDrafts: {
    picksOrder: string[];
    captainAssignments: CaptainAssignments;
    ownerKickUsername: string;
    publicId: string;
  }[];
};

type ActiveModalState = {
  slotNumber: number;
  type: "exact" | "team";
} | null;

export function OfficialDraftView({
  officialOrder,
  officialCaptainAssignments,
  allDrafts,
}: OfficialDraftViewProps) {
  const [activeModal, setActiveModal] = useState<ActiveModalState>(null);
  const [currentPage, setCurrentPage] = useState<number>(0);

  // Reset page when activeModal changes
  useEffect(() => {
    setCurrentPage(0);
  }, [activeModal]);

  // Handle escape key to close modal
  useEffect(() => {
    if (!activeModal) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveModal(null);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [activeModal]);

  const officialSlotAssignments = useMemo(() => {
    return buildSlotAssignments(officialOrder, officialCaptainAssignments);
  }, [officialOrder, officialCaptainAssignments]);

  const userDraftSlotAssignmentsList = useMemo(() => {
    return allDrafts.map((d) => buildSlotAssignments(d.picksOrder, d.captainAssignments));
  }, [allDrafts]);

  const slotCount = officialOrder.length;

  const slotCounters = useMemo(() => {
    const exactCounters = new Array<number | null>(slotCount).fill(null);
    const teamCounters = new Array<number | null>(slotCount).fill(null);

    for (let i = 0; i < slotCount; i++) {
      if (officialSlotAssignments[i] === null) {
        exactCounters[i] = null;
        teamCounters[i] = null;
        continue;
      }

      const slotsToMatch: { index: number; pickId: string; captainId: string }[] = [];
      for (let j = 0; j <= i; j++) {
        const pId = officialSlotAssignments[j];
        if (pId !== null) {
          const captainIndex = slotToCaptainIndex(j + 1);
          const captainId = captains[captainIndex].id;
          slotsToMatch.push({ index: j, pickId: pId, captainId });
        }
      }

      if (slotsToMatch.length === 0) {
        exactCounters[i] = 0;
        teamCounters[i] = 0;
        continue;
      }

      let exactMatchCount = 0;
      let teamMatchCount = 0;
      for (let dIndex = 0; dIndex < allDrafts.length; dIndex++) {
        const draft = allDrafts[dIndex];
        const userSlots = userDraftSlotAssignmentsList[dIndex];

        let exactMatchesAll = true;
        for (const { index, pickId } of slotsToMatch) {
          if (userSlots[index] !== pickId) {
            exactMatchesAll = false;
            break;
          }
        }
        if (exactMatchesAll) {
          exactMatchCount++;
        }

        let teamMatchesAll = true;
        for (const { pickId, captainId } of slotsToMatch) {
          if (draft.captainAssignments[pickId] !== captainId) {
            teamMatchesAll = false;
            break;
          }
        }
        if (teamMatchesAll) {
          teamMatchCount++;
        }
      }
      exactCounters[i] = exactMatchCount;
      teamCounters[i] = teamMatchCount;
    }
    return { exactCounters, teamCounters };
  }, [officialSlotAssignments, slotCount, userDraftSlotAssignmentsList, allDrafts]);

  const { exactCounters, teamCounters } = slotCounters;

  const matchingDrafts = useMemo(() => {
    if (!activeModal) return [];
    const { slotNumber, type } = activeModal;
    const slotIndex = slotNumber - 1;

    const slotsToMatch: { index: number; pickId: string; captainId: string }[] = [];
    for (let j = 0; j <= slotIndex; j++) {
      const pId = officialSlotAssignments[j];
      if (pId !== null) {
        const captainIndex = slotToCaptainIndex(j + 1);
        const captainId = captains[captainIndex].id;
        slotsToMatch.push({ index: j, pickId: pId, captainId });
      }
    }

    return allDrafts.filter((draft, dIndex) => {
      if (type === "exact") {
        const userSlots = userDraftSlotAssignmentsList[dIndex];
        for (const { index, pickId } of slotsToMatch) {
          if (userSlots[index] !== pickId) {
            return false;
          }
        }
        return true;
      } else {
        for (const { pickId, captainId } of slotsToMatch) {
          if (draft.captainAssignments[pickId] !== captainId) {
            return false;
          }
        }
        return true;
      }
    });
  }, [activeModal, officialSlotAssignments, allDrafts, userDraftSlotAssignmentsList]);

  const handleCounterClick = (slotNumber: number, type: "exact" | "team") => {
    setActiveModal({ slotNumber, type });
  };

  const paginatedDrafts = useMemo(() => {
    const start = currentPage * 15;
    return matchingDrafts.slice(start, start + 15);
  }, [matchingDrafts, currentPage]);

  const prevPage = () => {
    setCurrentPage((p) => Math.max(0, p - 1));
  };

  const nextPage = () => {
    setCurrentPage((p) => Math.min(Math.floor((matchingDrafts.length - 1) / 15), p + 1));
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <SnakeDraftBoard
        slotAssignments={officialSlotAssignments}
        visiblePool={[]}
        activePickId={null}
        filledCount={slotCount}
        slotCount={slotCount}
        slotCounters={exactCounters}
        slotTeamCounters={teamCounters}
        readOnly
        onCounterClick={handleCounterClick}
      />
      <div className="card">
        <h2>Legend / Key</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              className="snake-slot-counter-team is-clickable"
              style={{ position: "static", display: "inline-block", width: "40px", textAlign: "center" }}
            >
              265
            </span>
            <span style={{ fontSize: "14px", color: "var(--osrs-parchment-muted)" }}>
              <strong>Team Match</strong>: Click to view guessers who assigned all picks up to this slot to the same captains (ignoring draft order).
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              className="snake-slot-counter is-clickable"
              style={{ position: "static", display: "inline-block", width: "40px", textAlign: "center" }}
            >
              258
            </span>
            <span style={{ fontSize: "14px", color: "var(--osrs-parchment-muted)" }}>
              <strong>Exact Match</strong>: Click to view guessers who got all picks correct in exact order up to this slot.
            </span>
          </div>
        </div>
      </div>

      {activeModal && (
        <div className="osrs-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="osrs-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="osrs-modal-header">
              <h3 className="osrs-modal-title">
                Slot #{activeModal.slotNumber} {activeModal.type === "exact" ? "Exact Match" : "Team Match"} ({matchingDrafts.length})
              </h3>
              <button
                type="button"
                className="osrs-modal-close"
                onClick={() => setActiveModal(null)}
                aria-label="Close dialog"
              >
                &#x2715;
              </button>
            </div>
            <div className="osrs-modal-content">
              {matchingDrafts.length === 0 ? (
                <p style={{ textAlign: "center", color: "var(--osrs-text-dim)" }}>
                  No matching drafts found.
                </p>
              ) : (
                <ul className="osrs-modal-list">
                  {paginatedDrafts.map((draft) => (
                    <li key={draft.publicId} className="osrs-modal-list-item">
                      <span style={{ fontSize: "14px", color: "var(--osrs-parchment)", fontWeight: 700 }}>
                        {draft.ownerKickUsername}
                      </span>
                      <a
                        href={`/d/${draft.publicId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="carousel-link"
                        style={{ fontSize: "12px", textDecoration: "underline" }}
                      >
                        View Draft
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {matchingDrafts.length > 15 && (
              <div className="osrs-modal-actions" style={{ justifyContent: "center", gap: "16px" }}>
                <button
                  type="button"
                  className="button"
                  style={{ padding: "6px 16px", minWidth: "80px" }}
                  onClick={prevPage}
                  disabled={currentPage === 0}
                >
                  {"< Prev"}
                </button>
                <button
                  type="button"
                  className="button"
                  style={{ padding: "6px 16px", minWidth: "80px" }}
                  onClick={nextPage}
                  disabled={(currentPage + 1) * 15 >= matchingDrafts.length}
                >
                  {"Next >"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
