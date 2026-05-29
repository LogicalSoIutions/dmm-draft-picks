import Link from "next/link";

import { BingoCardView } from "@/components/bingo-board";
import { BingoEditor } from "@/components/bingo-editor";
import { getAuthenticatedUserFromServer } from "@/lib/auth";
import { isBingoTilePoolReady } from "@/lib/bingo";
import {
  formatBingoSubmissionDeadline,
  isBingoSubmissionOpen,
} from "@/lib/bingo-deadline";
import { getBingoCardByOwnerUserId, getBingoOptions } from "@/server/db/queries";

export const dynamic = "force-dynamic";

const PageShell = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <main>
    <header className="page-header">
      <div className="page-header-title">
        <h1>{title}</h1>
      </div>
      <div className="page-header-actions">
        <Link className="button secondary" href="/">
          Back to Home
        </Link>
      </div>
    </header>
    {children}
  </main>
);

export default async function BingoPage() {
  const user = await getAuthenticatedUserFromServer();
  if (!user) {
    return (
      <PageShell title="Bingo">
        <p>You need to authenticate with Kick before building a bingo card.</p>
        <Link className="button" href="/auth/kick/start?next=/bingo">
          Login with Kick
        </Link>
      </PageShell>
    );
  }

  const options = getBingoOptions();
  if (!options) {
    return (
      <PageShell title="Bingo">
        <p>Signed in as {user.kickUsername}.</p>
        <p className="status">Bingo tiles have not been set yet. Check back soon.</p>
      </PageShell>
    );
  }
  const readiness = isBingoTilePoolReady(options.tiles);
  if (!readiness.ready) {
    return (
      <PageShell title="Bingo">
        <p>Signed in as {user.kickUsername}.</p>
        <p className="status">{readiness.message}</p>
      </PageShell>
    );
  }

  const card = getBingoCardByOwnerUserId(user.userId);
  const open = isBingoSubmissionOpen();
  const deadlineLabel = formatBingoSubmissionDeadline();

  if (!open) {
    return (
      <PageShell title="Bingo — Locked">
        <p>Signed in as {user.kickUsername}.</p>
        <aside className="prize-banner bingo-deadline-banner" role="note">
          <div className="prize-banner-title">Bingo Deadline</div>
          <p className="prize-banner-text">
            Bingo cards locked at <strong>{deadlineLabel}</strong>.
          </p>
        </aside>
        {card ? (
          <div className="card">
            <h2 className="bingo-card-title">Your Bingo Card</h2>
            <BingoCardView tiles={options.tiles} layout={card.layout} />
          </div>
        ) : (
          <p>You did not save a bingo card before the deadline.</p>
        )}
      </PageShell>
    );
  }

  return (
    <PageShell title={card ? "Edit Your Bingo Card" : "Build Your Bingo Card"}>
      <p>Signed in as {user.kickUsername}.</p>
      <p>
        Build a tier-balanced card: 8 Easy, 7 Medium, 5 Hard, 3 Insane, 1
        Legendary (plus FREE center).
      </p>
      <aside className="prize-banner bingo-deadline-banner" role="note">
        <div className="prize-banner-title">Bingo Deadline</div>
        <p className="prize-banner-text">
          Bingo cards lock at <strong>{deadlineLabel}</strong>. You can edit yours
          until then.
        </p>
      </aside>
      <BingoEditor
        tiles={options.tiles}
        initialLayout={card?.layout ?? []}
        hasExistingCard={Boolean(card)}
      />
    </PageShell>
  );
}
