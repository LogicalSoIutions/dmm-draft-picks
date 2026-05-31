"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  SnakeDraftBoard,
  useSnakeDraftBoard,
} from "@/components/snake-draft-board";
import { captains, type CaptainAssignments } from "@/data/participants";
import { buildSlotAssignments, slotToCaptainIndex } from "@/lib/snake-draft";

type AdminDraftEditorProps = {
  initialOrder: string[];
  initialCaptainAssignments: CaptainAssignments;
  initialMatches: OfficialMatch[];
  hasOfficialDraft: boolean;
  allDrafts: {
    picksOrder: string[];
    captainAssignments: CaptainAssignments;
  }[];
};

type OfficialMatch = {
  publicId: string;
  kickUsername: string;
  updatedAt: string;
};

type SaveState =
  | { kind: "idle"; message: string }
  | { kind: "saving"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ok"; message: string };

const toAbsoluteUrl = (path: string): string => {
  if (typeof window === "undefined") {
    return path;
  }
  return new URL(path, window.location.origin).toString();
};

export function AdminDraftEditor({
  initialOrder,
  initialCaptainAssignments,
  initialMatches,
  hasOfficialDraft,
  allDrafts,
}: AdminDraftEditorProps) {
  const board = useSnakeDraftBoard(initialOrder, initialCaptainAssignments);
  const [saveState, setSaveState] = useState<SaveState>({
    kind: "idle",
    message: "",
  });
  const [matches, setMatches] = useState<OfficialMatch[]>(initialMatches);
  const [hasSaved, setHasSaved] = useState<boolean>(hasOfficialDraft);

  const userDraftSlotAssignmentsList = useMemo(() => {
    return allDrafts.map((d) => buildSlotAssignments(d.picksOrder, d.captainAssignments));
  }, [allDrafts]);

  const slotCounters = useMemo(() => {
    const currentAssignments = board.boardProps.slotAssignments;
    const exactCounters = new Array<number | null>(board.slotCount).fill(null);
    const teamCounters = new Array<number | null>(board.slotCount).fill(null);
    for (let i = 0; i < board.slotCount; i++) {
      if (currentAssignments[i] === null) {
        exactCounters[i] = null;
        teamCounters[i] = null;
        continue;
      }

      const slotsToMatch: { index: number; pickId: string; captainId: string }[] = [];
      for (let j = 0; j <= i; j++) {
        const pId = currentAssignments[j];
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
  }, [board.boardProps.slotAssignments, board.slotCount, userDraftSlotAssignmentsList, allDrafts]);

  const { exactCounters, teamCounters } = slotCounters;

  const saveOfficialDraft = async () => {
    if (!board.apiPayload) {
      setSaveState({
        kind: "error",
        message: `Place all ${board.slotCount} picks before saving.`,
      });
      return;
    }
    setSaveState({ kind: "saving", message: "Saving official draft..." });
    const response = await fetch("/api/admin/official-draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        order: board.apiPayload.order,
        captainAssignments: board.apiPayload.captainAssignments,
      }),
    });
    const payload = (await response.json()) as {
      error?: string;
      message?: string;
      matches?: OfficialMatch[];
    };
    if (!response.ok) {
      setSaveState({
        kind: "error",
        message: payload.error ?? "Failed to save official draft",
      });
      return;
    }
    setMatches(payload.matches ?? []);
    setHasSaved(true);
    setSaveState({
      kind: "ok",
      message: payload.message ?? "Official draft saved",
    });
  };

  const matchesView = useMemo(() => {
    return matches.map((match) => {
      const sharePath = `/d/${match.publicId}`;
      return {
        ...match,
        sharePath,
        absoluteUrl: toAbsoluteUrl(sharePath),
      };
    });
  }, [matches]);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <SnakeDraftBoard
        {...board.boardProps}
        slotCounters={exactCounters}
        slotTeamCounters={teamCounters}
      />
      <div className="row">
        <button
          className="button"
          type="button"
          onClick={saveOfficialDraft}
          disabled={saveState.kind === "saving" || !board.allAssigned}
          title={
            !board.allAssigned
              ? `Place all ${board.slotCount} picks before saving`
              : undefined
          }
        >
          {hasSaved ? "Update Official Draft" : "Set Official Draft"}
        </button>
        <span
          className={`status ${saveState.kind === "error" ? "error" : saveState.kind === "ok" ? "ok" : ""}`}
        >
          {saveState.message}
        </span>
      </div>
      {hasSaved ? (
        <div className="card">
          <h2>1000% Identical Drafts</h2>
          {matchesView.length === 0 ? (
            <p>No drafts match the official draft yet.</p>
          ) : (
            <>
              <p>
                {matchesView.length} draft{matchesView.length === 1 ? "" : "s"} match the official draft exactly.
              </p>
              <ul className="match-list">
                {matchesView.map((match) => (
                  <li key={match.publicId}>
                    <strong>{match.kickUsername}</strong>
                    {" — "}
                    <Link href={match.sharePath}>{match.absoluteUrl}</Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
