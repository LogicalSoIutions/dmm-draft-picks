import Link from "next/link";

import { formatEasternDateTime } from "@/lib/format-date";
import { getBingoOptions, listAllBingoCardsWithOwner } from "@/server/db/queries";

export const dynamic = "force-dynamic";

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
      ) : cards.length === 0 ? (
        <div className="card">
          <p>No bingo boards have been submitted yet.</p>
        </div>
      ) : (
        <div className="card">
          <h2>Submitted Boards</h2>
          <p>{cards.length} total submissions.</p>
          <div className="grid" style={{ gap: 10 }}>
            {cards.map((card) => (
              <div
                key={card.ownerUserId}
                className="row"
                style={{ justifyContent: "space-between", alignItems: "center" }}
              >
                <div>
                  <strong>{card.ownerKickUsername}</strong>
                  <div className="status">
                    Updated {formatEasternDateTime(card.updatedAt)}
                  </div>
                </div>
                <Link
                  className="button secondary"
                  href={`/bingo/boards/${card.ownerUserId}`}
                >
                  View Board
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
