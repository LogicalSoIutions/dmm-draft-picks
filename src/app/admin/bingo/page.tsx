import Link from "next/link";

import { BingoAdminEditor } from "@/components/bingo-admin-editor";
import { BingoAdminProgress } from "@/components/bingo-admin-progress";
import { isAdminUsername } from "@/lib/admin";
import { getAuthenticatedUserFromServer } from "@/lib/auth";
import {
  formatBingoSubmissionDeadline,
  isBingoSubmissionOpen,
} from "@/lib/bingo-deadline";
import { hasBingo } from "@/lib/bingo";
import {
  getBingoOptions,
  getBingoProgress,
  listAllBingoCardsWithOwner,
} from "@/server/db/queries";

export const dynamic = "force-dynamic";

export default async function AdminBingoPage() {
  const user = await getAuthenticatedUserFromServer();
  if (!user) {
    return (
      <main>
        <h1>Admin — Bingo</h1>
        <p>You need to authenticate with Kick before accessing this page.</p>
        <Link className="button" href="/auth/kick/start?next=/admin/bingo">
          Login with Kick
        </Link>
      </main>
    );
  }
  if (!isAdminUsername(user.kickUsername)) {
    return (
      <main>
        <h1>Admin — Bingo</h1>
        <p>You are not authorized to access this page.</p>
        <Link className="button secondary" href="/">
          Back to Home
        </Link>
      </main>
    );
  }

  const options = getBingoOptions();
  const submissionsOpen = isBingoSubmissionOpen();
  const validTileIds = new Set(options?.tiles.map((tile) => tile.id) ?? []);
  const completedTileIds = (getBingoProgress()?.completedTileIds ?? []).filter(
    (tileId) => validTileIds.has(tileId),
  );
  const completedSet = new Set(completedTileIds);
  const winners = options
    ? listAllBingoCardsWithOwner()
        .filter((card) => hasBingo(card.layout, completedSet))
        .map((card) => ({
          kickUsername: card.ownerKickUsername,
          updatedAt: card.updatedAt,
        }))
    : [];

  return (
    <main>
      <header className="page-header">
        <div className="page-header-title">
          <h1>Admin — Bingo Tiles</h1>
        </div>
        <div className="page-header-actions">
          <span className="page-header-user">
            Signed in as <strong>{user.kickUsername}</strong>
          </span>
          <Link className="button secondary" href="/admin">
            Back to Admin
          </Link>
        </div>
      </header>
      <p>
        Bingo cards lock at {formatBingoSubmissionDeadline()}.
      </p>
      {submissionsOpen ? (
        <>
          <p>
            Configure tiered option pools before lock. Players will place 24
            picks into fixed tier slots (8 Easy, 7 Medium, 5 Hard, 3 Insane, 1
            Legendary).
          </p>
          <BingoAdminEditor initialTiles={options?.tiles ?? []} />
        </>
      ) : options ? (
        <BingoAdminProgress
          initialCompletedTileIds={completedTileIds}
          initialWinners={winners}
          tiles={options.tiles}
        />
      ) : (
        <p className="status error">
          Bingo tiles are not set yet. You can’t track completions until tiles
          exist.
        </p>
      )}
    </main>
  );
}
