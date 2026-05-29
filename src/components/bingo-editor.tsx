"use client";

import { useState } from "react";

import { BingoBoard, useBingoBoard } from "@/components/bingo-board";
import type { BingoTile } from "@/lib/bingo";

type BingoEditorProps = {
  tiles: BingoTile[];
  initialLayout: string[];
  hasExistingCard: boolean;
};

type SaveState =
  | { kind: "idle"; message: string }
  | { kind: "saving"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ok"; message: string };

export function BingoEditor({
  tiles,
  initialLayout,
  hasExistingCard,
}: BingoEditorProps) {
  const controller = useBingoBoard(tiles, initialLayout);
  const [saveState, setSaveState] = useState<SaveState>({
    kind: "idle",
    message: "",
  });
  const [savedOnce, setSavedOnce] = useState<boolean>(hasExistingCard);

  const saveCard = async () => {
    if (!controller.layout) {
      setSaveState({
        kind: "error",
        message: `Place all ${controller.tileCount} tiles before saving.`,
      });
      return;
    }
    setSaveState({ kind: "saving", message: "Saving card..." });
    const response = await fetch("/api/bingo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ layout: controller.layout }),
    });
    const payload = (await response.json()) as {
      error?: string;
      message?: string;
    };
    if (!response.ok) {
      setSaveState({
        kind: "error",
        message: payload.error ?? "Failed to save card",
      });
      return;
    }
    setSavedOnce(true);
    setSaveState({ kind: "ok", message: payload.message ?? "Card saved" });
  };

  const autoFillCard = async () => {
    setSaveState({ kind: "idle", message: "" });
    await controller.autoFillRandomly();
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <BingoBoard tiles={tiles} controller={controller} />
      <div className="row">
        <button
          className={`button secondary autofill-button${
            controller.isAutoFilling ? " is-running" : ""
          }`}
          type="button"
          onClick={autoFillCard}
          disabled={controller.isAutoFilling || controller.allPlaced}
          title={
            controller.allPlaced
              ? "Your board is already full"
              : "Randomly fill remaining slots"
          }
        >
          {controller.isAutoFilling ? "Rolling..." : "Do my board for me"}
        </button>
        <button
          className="button"
          type="button"
          onClick={saveCard}
          disabled={
            saveState.kind === "saving" ||
            controller.isAutoFilling ||
            !controller.allPlaced
          }
          title={
            !controller.allPlaced
              ? `Place all ${controller.tileCount} tiles before saving`
              : undefined
          }
        >
          {savedOnce ? "Update Card" : "Save Card"}
        </button>
        <span
          className={`status ${saveState.kind === "error" ? "error" : saveState.kind === "ok" ? "ok" : ""}`}
        >
          {saveState.message}
        </span>
      </div>
    </div>
  );
}
