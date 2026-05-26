"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  SnakeDraftBoard,
  useSnakeDraftBoard,
} from "@/components/snake-draft-board";
import type { CaptainAssignments } from "@/data/participants";

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

const toAbsoluteUrl = (path: string): string => {
  if (typeof window === "undefined") {
    return path;
  }
  return new URL(path, window.location.origin).toString();
};

export function DraftEditor({
  initialOrder,
  initialCaptainAssignments,
  publicId,
  editKey,
}: DraftEditorProps) {
  const board = useSnakeDraftBoard(initialOrder, initialCaptainAssignments);
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
  const isEditing = Boolean(publicId && editKey);

  const saveDraft = async () => {
    if (!board.apiPayload) {
      setSaveState({
        kind: "error",
        message: `Place all ${board.slotCount} picks before saving.`,
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
      body: JSON.stringify({
        order: board.apiPayload.order,
        captainAssignments: board.apiPayload.captainAssignments,
      }),
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
      <SnakeDraftBoard {...board.boardProps} />
      <div className="row">
        <button
          className="button"
          type="button"
          onClick={saveDraft}
          disabled={saveState.kind === "saving" || !board.allAssigned}
          title={
            !board.allAssigned
              ? `Place all ${board.slotCount} picks before saving`
              : undefined
          }
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
