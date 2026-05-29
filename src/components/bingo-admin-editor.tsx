"use client";

import { useState } from "react";

import {
  bingoTierLabels,
  bingoTierOrder,
  bingoTierPoolBounds,
  type BingoTier,
  type BingoTile,
} from "@/lib/bingo";

type BingoAdminEditorProps = {
  initialTiles: BingoTile[];
};

type TileDraft = { label: string; image: string };
type TierDrafts = Record<BingoTier, TileDraft[]>;

type SaveState =
  | { kind: "idle"; message: string }
  | { kind: "saving"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ok"; message: string };

const buildInitialTierDrafts = (initialTiles: BingoTile[]): TierDrafts => {
  const byTier: TierDrafts = {
    easy: [],
    medium: [],
    hard: [],
    insane: [],
    legendary: [],
  };
  for (const tile of initialTiles) {
    if (!bingoTierOrder.includes(tile.tier)) {
      continue;
    }
    byTier[tile.tier].push({
      label: tile.label,
      image: tile.image ?? "",
    });
  }
  for (const tier of bingoTierOrder) {
    const min = bingoTierPoolBounds[tier].min;
    while (byTier[tier].length < min) {
      byTier[tier].push({ label: "", image: "" });
    }
  }
  return byTier;
};

export function BingoAdminEditor({ initialTiles }: BingoAdminEditorProps) {
  const [draftsByTier, setDraftsByTier] = useState<TierDrafts>(() =>
    buildInitialTierDrafts(initialTiles),
  );
  const [saveState, setSaveState] = useState<SaveState>({
    kind: "idle",
    message: "",
  });

  const updateDraft = (
    tier: BingoTier,
    index: number,
    patch: Partial<TileDraft>,
  ) => {
    setDraftsByTier((current) => ({
      ...current,
      [tier]: current[tier].map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, ...patch } : draft,
      ),
    }));
  };

  const addDraft = (tier: BingoTier) => {
    setDraftsByTier((current) => {
      if (current[tier].length >= bingoTierPoolBounds[tier].max) {
        return current;
      }
      return {
        ...current,
        [tier]: [...current[tier], { label: "", image: "" }],
      };
    });
  };

  const removeDraft = (tier: BingoTier, index: number) => {
    setDraftsByTier((current) => {
      if (current[tier].length <= bingoTierPoolBounds[tier].min) {
        return current;
      }
      return {
        ...current,
        [tier]: current[tier].filter((_, draftIndex) => draftIndex !== index),
      };
    });
  };

  const allDrafts = bingoTierOrder.flatMap((tier) =>
    draftsByTier[tier].map((draft) => ({ ...draft, tier })),
  );
  const labeledDrafts = allDrafts.filter((draft) => draft.label.trim().length > 0);

  const saveTiles = async () => {
    setSaveState({ kind: "saving", message: "Saving tiles..." });
    const response = await fetch("/api/admin/bingo/options", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tiles: labeledDrafts.map((draft) => ({
          label: draft.label.trim(),
          tier: draft.tier,
          image: draft.image.trim() || undefined,
        })),
      }),
    });
    const payload = (await response.json()) as {
      error?: string;
      message?: string;
    };
    if (!response.ok) {
      setSaveState({
        kind: "error",
        message: payload.error ?? "Failed to save tiles",
      });
      return;
    }
    setSaveState({ kind: "ok", message: payload.message ?? "Tiles saved" });
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <h2>Bingo Tiles</h2>
        <p>
          Build option pools by tier. Players will still place exactly 24 tiles
          (8 Easy, 7 Medium, 5 Hard, 3 Insane, 1 Legendary) into fixed tier slots.
          Each option needs a label; image is optional.
        </p>
        {bingoTierOrder.map((tier) => {
          const drafts = draftsByTier[tier];
          const { min, max } = bingoTierPoolBounds[tier];
          return (
            <section className={`bingo-tier-group tier-${tier}`} key={tier}>
              <div className="row bingo-tier-header">
                <h3>{bingoTierLabels[tier]}</h3>
                <span className="bingo-tier-count">
                  {drafts.length} options ({min}-{max})
                </span>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => addDraft(tier)}
                  disabled={drafts.length >= max}
                >
                  Add
                </button>
              </div>
              <div className="bingo-admin-list">
                {drafts.map((draft, index) => (
                  <div className="bingo-admin-row" key={`${tier}-${index}`}>
                    <span className="bingo-admin-number">{index + 1}</span>
                    <input
                      className="bingo-admin-input"
                      type="text"
                      value={draft.label}
                      placeholder={`${bingoTierLabels[tier]} option`}
                      maxLength={80}
                      onChange={(event) =>
                        updateDraft(tier, index, { label: event.target.value })
                      }
                    />
                    <input
                      className="bingo-admin-input"
                      type="text"
                      value={draft.image}
                      placeholder="Image filename or URL (optional)"
                      maxLength={300}
                      onChange={(event) =>
                        updateDraft(tier, index, { image: event.target.value })
                      }
                    />
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => removeDraft(tier, index)}
                      disabled={drafts.length <= min}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
      <div className="row">
        <button
          className="button"
          type="button"
          onClick={saveTiles}
          disabled={saveState.kind === "saving"}
        >
          Save Progress
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
