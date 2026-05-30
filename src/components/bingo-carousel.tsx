"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { BingoCardView } from "@/components/bingo-board";
import type { BingoTile } from "@/lib/bingo";
import { formatEasternDateTime } from "@/lib/format-date";

export type CarouselBingoCard = {
  ownerUserId: number;
  ownerKickUsername: string;
  layout: string[];
  updatedAt: string;
};

type BingoCarouselProps = {
  cards: CarouselBingoCard[];
  tiles: BingoTile[];
};

const wrapIndex = (index: number, length: number): number => {
  if (length <= 0) {
    return 0;
  }
  return ((index % length) + length) % length;
};

const formatUpdatedAt = (isoString: string): string => {
  return formatEasternDateTime(isoString);
};

export function BingoCarousel({ cards, tiles }: BingoCarouselProps) {
  const [index, setIndex] = useState(0);
  const total = cards.length;

  const goPrev = useCallback(() => {
    setIndex((current) => wrapIndex(current - 1, total));
  }, [total]);

  const goNext = useCallback(() => {
    setIndex((current) => wrapIndex(current + 1, total));
  }, [total]);

  useEffect(() => {
    if (total === 0) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        goPrev();
      } else if (event.key === "ArrowRight") {
        goNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goPrev, goNext, total]);

  if (total === 0) {
    return (
      <div className="card">
        <p>No bingo boards have been submitted yet.</p>
      </div>
    );
  }

  const current = cards[wrapIndex(index, total)];

  return (
    <div className="carousel">
      <div className="carousel-header">
        <button
          type="button"
          className="button carousel-arrow"
          onClick={goPrev}
          aria-label="Previous board"
        >
          {"<"}
        </button>
        <div className="carousel-meta">
          <h2 className="carousel-owner">{current.ownerKickUsername}</h2>
          <div className="carousel-sub">
            <span>
              {wrapIndex(index, total) + 1} / {total}
            </span>
            <span className="carousel-dot">.</span>
            <span>Updated {formatUpdatedAt(current.updatedAt)}</span>
            <span className="carousel-dot">.</span>
            <Link
              className="carousel-link"
              href={`/bingo/boards/${current.ownerUserId}`}
            >
              Permalink
            </Link>
          </div>
        </div>
        <button
          type="button"
          className="button carousel-arrow"
          onClick={goNext}
          aria-label="Next board"
        >
          {">"}
        </button>
      </div>
      <div className="card">
        <BingoCardView tiles={tiles} layout={current.layout} />
      </div>
    </div>
  );
}
