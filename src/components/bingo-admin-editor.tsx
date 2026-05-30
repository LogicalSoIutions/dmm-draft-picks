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
  initialUpdatedAt: string | null;
};

type TileDraft = { id: string; label: string };
type TierDrafts = Record<BingoTier, TileDraft[]>;
type SavedTile = { id: string; label: string; tier: BingoTier };

type SaveState =
  | { kind: "idle"; message: string }
  | { kind: "saving"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ok"; message: string };

const createLocalTileId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `tile-local-${crypto.randomUUID()}`;
  }
  return `tile-local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

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
      id: tile.id,
      label: tile.label,
    });
  }
  for (const tier of bingoTierOrder) {
    const min = bingoTierPoolBounds[tier].min;
    while (byTier[tier].length < min) {
      byTier[tier].push({ id: createLocalTileId(), label: "" });
    }
  }
  return byTier;
};

const flattenLabeledDrafts = (draftsByTier: TierDrafts): SavedTile[] =>
  bingoTierOrder.flatMap((tier) =>
    draftsByTier[tier]
      .map((draft) => ({
        id: draft.id,
        label: draft.label.trim(),
        tier,
      }))
      .filter((draft) => draft.label.length > 0),
  );

const toSavedById = (tiles: SavedTile[]): Record<string, SavedTile> => {
  const byId: Record<string, SavedTile> = {};
  for (const tile of tiles) {
    byId[tile.id] = tile;
  }
  return byId;
};

export function BingoAdminEditor({
  initialTiles,
  initialUpdatedAt,
}: BingoAdminEditorProps) {
  const [draftsByTier, setDraftsByTier] = useState<TierDrafts>(() =>
    buildInitialTierDrafts(initialTiles),
  );
  const [savedTilesById, setSavedTilesById] = useState<Record<string, SavedTile>>(
    () =>
      toSavedById(
        initialTiles.map((tile) => ({
          id: tile.id,
          label: tile.label,
          tier: tile.tier,
        })),
      ),
  );
  const [saveState, setSaveState] = useState<SaveState>({
    kind: "idle",
    message: "",
  });
  const [optionsUpdatedAt, setOptionsUpdatedAt] = useState<string | null>(
    initialUpdatedAt,
  );

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
        [tier]: [
          ...current[tier],
          { id: createLocalTileId(), label: "" },
        ],
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

  const saveTiles = async () => {
    const currentLabeledTiles = flattenLabeledDrafts(draftsByTier);
    const currentById = toSavedById(currentLabeledTiles);
    const currentKeys = Object.keys(currentById).sort();
    const savedKeys = Object.keys(savedTilesById).sort();
    const hasSameKeys =
      currentKeys.length === savedKeys.length &&
      currentKeys.every((key, index) => key === savedKeys[index]);
    const hasChangedTiles =
      !hasSameKeys ||
      currentLabeledTiles.some((tile) => {
        const previous = savedTilesById[tile.id];
        return (
          !previous ||
          previous.label !== tile.label ||
          previous.tier !== tile.tier
        );
      });
    if (!hasChangedTiles) {
      setSaveState({ kind: "ok", message: "No changes to save" });
      return;
    }
    setSaveState({ kind: "saving", message: "Saving tiles..." });
    const response = await fetch("/api/admin/bingo/options", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tiles: currentLabeledTiles.map((tile) => ({
          id: tile.id,
          label: tile.label,
          tier: tile.tier,
        })),
        expectedUpdatedAt: optionsUpdatedAt,
      }),
    });
    const payload = (await response.json()) as {
      error?: string;
      tiles?: BingoTile[] | null;
      updatedAt?: string | null;
    };
    if (!response.ok) {
      if (response.status === 409) {
        setSaveState({
          kind: "error",
          message:
            payload.error ??
            "Another admin saved changes first. Refresh before saving again.",
        });
        return;
      }
      setSaveState({
        kind: "error",
        message: payload.error ?? "Failed to save bingo tiles",
      });
      return;
    }
    const latestTiles = Array.isArray(payload.tiles) ? payload.tiles : null;
    const latestSaved = latestTiles
      ? latestTiles.map((tile) => ({
          id: tile.id,
          label: tile.label,
          tier: tile.tier,
        }))
      : currentLabeledTiles;
    setSavedTilesById(toSavedById(latestSaved));
    if (latestTiles) {
      setDraftsByTier(buildInitialTierDrafts(latestTiles));
    }
    setOptionsUpdatedAt(
      typeof payload.updatedAt === "string" ? payload.updatedAt : optionsUpdatedAt,
    );
    setSaveState({ kind: "ok", message: "Saved changes" });
  };

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card">
        <h2>Bingo Tiles</h2>
        <p>
          Build option pools by tier. Players will still place exactly 24 tiles
          (8 Easy, 7 Medium, 5 Hard, 3 Insane, 1 Legendary) into fixed tier slots.
          Each option needs a label.
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
          Save Changes
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
