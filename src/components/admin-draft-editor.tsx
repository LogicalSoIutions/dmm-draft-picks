"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  SnakeDraftBoard,
  useSnakeDraftBoard,
} from "@/components/snake-draft-board";
import type { CaptainAssignments } from "@/data/participants";

type AdminDraftEditorProps = {
  initialOrder: string[];
  initialCaptainAssignments: CaptainAssignments;
  initialMatches: OfficialMatch[];
  hasOfficialDraft: boolean;
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
}: AdminDraftEditorProps) {
  const board = useSnakeDraftBoard(initialOrder, initialCaptainAssignments);
  const [saveState, setSaveState] = useState<SaveState>({
    kind: "idle",
    message: "",
  });
  const [matches, setMatches] = useState<OfficialMatch[]>(initialMatches);
  const [hasSaved, setHasSaved] = useState<boolean>(hasOfficialDraft);

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
      <SnakeDraftBoard {...board.boardProps} />
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
