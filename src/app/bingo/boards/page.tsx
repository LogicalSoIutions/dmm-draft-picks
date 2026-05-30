import type { Metadata } from "next";
import Link from "next/link";

import { BingoCarousel } from "@/components/bingo-carousel";
import { getBingoOptions, listAllBingoCardsWithOwner } from "@/server/db/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "DMM Bingo Boards",
  description: "Browse all submitted DMM bingo boards.",
};

export default async function BingoBoardsPage() {
  const options = getBingoOptions();
  const cards = [...listAllBingoCardsWithOwner()].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );

  return (
    <main>
      <header className="page-header">
        <div className="page-header-title">
          <h1>All Bingo Boards</h1>
        </div>
        <div className="page-header-actions">
          <Link className="button secondary" href="/bingo">
            Back to Bingo
          </Link>
          <Link className="button secondary" href="/">
            Back to Home
          </Link>
        </div>
      </header>
      <p>
        Browse every submitted board and open a permalink for each one.
      </p>
      {!options ? (
        <p className="status">Bingo tiles are not set yet. Boards will appear here soon.</p>
      ) : (
        <BingoCarousel
          cards={cards.map((card) => ({
            ownerUserId: card.ownerUserId,
            ownerKickUsername: card.ownerKickUsername,
            layout: card.layout,
            updatedAt: card.updatedAt,
          }))}
          tiles={options.tiles}
        />
      )}
    </main>
  );
}
