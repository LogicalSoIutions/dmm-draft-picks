"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { DraftViewer } from "@/components/draft-viewer";
import type { CaptainAssignments } from "@/data/participants";

export type CarouselDraft = {
  publicId: string;
  ownerKickUsername: string;
  picksOrder: string[];
  captainAssignments: CaptainAssignments;
  updatedAt: string;
};

type DraftCarouselProps = {
  drafts: CarouselDraft[];
};

const wrapIndex = (index: number, length: number): number => {
  if (length <= 0) {
    return 0;
  }
  return ((index % length) + length) % length;
};

const formatUpdatedAt = (isoString: string): string => {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }
  return date.toLocaleString();
};

export function DraftCarousel({ drafts }: DraftCarouselProps) {
  const [index, setIndex] = useState(0);
  const total = drafts.length;

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
        <p>No drafts have been saved yet. Be the first to create one.</p>
      </div>
    );
  }

  const current = drafts[wrapIndex(index, total)];

  return (
    <div className="carousel">
      <div className="carousel-header">
        <button
          type="button"
          className="button carousel-arrow"
          onClick={goPrev}
          aria-label="Previous draft"
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
              href={`/d/${current.publicId}`}
            >
              Permalink
            </Link>
          </div>
        </div>
        <button
          type="button"
          className="button carousel-arrow"
          onClick={goNext}
          aria-label="Next draft"
        >
          {">"}
        </button>
      </div>
      <DraftViewer
        order={current.picksOrder}
        captainAssignments={current.captainAssignments}
      />
    </div>
  );
}
