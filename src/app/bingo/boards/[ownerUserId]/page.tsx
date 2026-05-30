import Link from "next/link";

import { BingoCardView } from "@/components/bingo-board";
import { formatEasternDateTime } from "@/lib/format-date";
import {
  getBingoCardWithOwnerByOwnerUserId,
  getBingoOptions,
} from "@/server/db/queries";

export const dynamic = "force-dynamic";

type BingoBoardPageProps = {
  params: Promise<{
    ownerUserId: string;
  }>;
};

export default async function BingoBoardPage({ params }: BingoBoardPageProps) {
  const { ownerUserId } = await params;
  const parsedOwnerUserId = Number.parseInt(ownerUserId, 10);
  const validOwnerUserId =
    Number.isInteger(parsedOwnerUserId) && parsedOwnerUserId > 0
      ? parsedOwnerUserId
      : null;
  const card = validOwnerUserId
    ? getBingoCardWithOwnerByOwnerUserId(validOwnerUserId)
    : null;

  if (!card) {
    return (
      <main>
        <header className="page-header">
          <div className="page-header-title">
            <h1>Bingo Board Not Found</h1>
          </div>
          <div className="page-header-actions">
            <Link className="button secondary" href="/bingo/boards">
              Back to Boards
            </Link>
            <Link className="button secondary" href="/bingo">
              Back to Bingo
            </Link>
          </div>
        </header>
        <p>This bingo board link is invalid or no card exists for that user.</p>
      </main>
    );
  }

  const options = getBingoOptions();

  return (
    <main>
      <header className="page-header">
        <div className="page-header-title">
          <h1>{card.ownerKickUsername}&apos;s Bingo Board</h1>
        </div>
        <div className="page-header-actions">
          <Link className="button secondary" href="/bingo/boards">
            Back to Boards
          </Link>
          <Link className="button secondary" href="/bingo">
            Back to Bingo
          </Link>
        </div>
      </header>
      <p>Updated {formatEasternDateTime(card.updatedAt)}.</p>
      {!options ? (
        <p className="status">Bingo tiles are not set yet, so this board cannot render.</p>
      ) : (
        <div className="card">
          <BingoCardView tiles={options.tiles} layout={card.layout} />
        </div>
      )}
    </main>
  );
}
