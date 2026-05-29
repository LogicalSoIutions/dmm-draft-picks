"use client";

import { useMemo, useState } from "react";

import { formatEasternDateTime } from "@/lib/format-date";
import type { BingoTile } from "@/lib/bingo";

type WinnerView = {
  kickUsername: string;
  updatedAt: string;
};

type BingoAdminProgressProps = {
  tiles: BingoTile[];
  initialCompletedTileIds: string[];
  initialWinners: WinnerView[];
};

type SaveState =
  | { kind: "idle"; message: string }
  | { kind: "saving"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ok"; message: string };

export function BingoAdminProgress({
  tiles,
  initialCompletedTileIds,
  initialWinners,
}: BingoAdminProgressProps) {
  const [completedTileIds, setCompletedTileIds] = useState<string[]>(
    initialCompletedTileIds,
  );
  const [winners, setWinners] = useState<WinnerView[]>(initialWinners);
  const [saveState, setSaveState] = useState<SaveState>({
    kind: "idle",
    message: "",
  });

  const completedSet = useMemo(
    () => new Set(completedTileIds),
    [completedTileIds],
  );

  const toggleTile = async (tileId: string, checked: boolean) => {
    const previous = completedTileIds;
    const optimistic = checked
      ? Array.from(new Set([...completedTileIds, tileId]))
      : completedTileIds.filter((id) => id !== tileId);
    setCompletedTileIds(optimistic);
    setSaveState({ kind: "saving", message: "Updating..." });
    const response = await fetch("/api/admin/bingo/progress", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tileId, completed: checked }),
    });
    const payload = (await response.json()) as {
      error?: string;
      completedTileIds?: string[];
      winners?: WinnerView[];
    };
    if (!response.ok) {
      setCompletedTileIds(previous);
      setSaveState({
        kind: "error",
        message: payload.error ?? "Failed to update tile status",
      });
      return;
    }
    setCompletedTileIds(payload.completedTileIds ?? optimistic);
    setWinners(payload.winners ?? []);
    setSaveState({ kind: "ok", message: "Updated" });
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <h2>Track Completed Tiles</h2>
        <p>
          Toggle <strong>Done</strong> as results happen. Each toggle instantly
          checks all saved cards for bingo (rows, columns, and diagonals with the
          free center).
        </p>
        <div className="bingo-progress-list">
          {tiles.map((tile, index) => {
            const checked = completedSet.has(tile.id);
            return (
              <label className="bingo-progress-row" key={tile.id}>
                <span className="bingo-admin-number">{index + 1}</span>
                <span className="bingo-progress-label">{tile.label}</span>
                <span className="bingo-progress-toggle">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => toggleTile(tile.id, event.target.checked)}
                  />
                  <span>Done</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>
      <div className="row">
        <span
          className={`status ${saveState.kind === "error" ? "error" : saveState.kind === "ok" ? "ok" : ""}`}
        >
          {saveState.message}
        </span>
      </div>
      <div className="card">
        <h2>Bingo Winners</h2>
        {winners.length === 0 ? (
          <p>No bingos yet.</p>
        ) : (
          <ul className="match-list">
            {winners.map((winner) => (
              <li key={`${winner.kickUsername}-${winner.updatedAt}`}>
                <strong>{winner.kickUsername}</strong>
                {" — card updated "}
                {formatEasternDateTime(winner.updatedAt)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
