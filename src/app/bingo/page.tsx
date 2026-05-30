import type { Metadata } from "next";
import Link from "next/link";

import { BingoCardView } from "@/components/bingo-board";
import { DeadlineCountdown } from "@/components/deadline-countdown";
import { BingoEditor } from "@/components/bingo-editor";
import { getAuthenticatedUserFromServer } from "@/lib/auth";
import { isBingoTilePoolReady } from "@/lib/bingo";
import {
  getBingoSubmissionDeadline,
  isBingoSubmissionOpen,
} from "@/lib/bingo-deadline";
import { getBingoCardByOwnerUserId, getBingoOptions } from "@/server/db/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "DMM Bingo",
  description: "Build, edit, and lock in your DMM bingo card before the deadline.",
};

const PageShell = ({
  title,
  signedInUsername,
  userId,
  hasCard,
  children,
}: {
  title: string;
  signedInUsername?: string;
  userId?: number;
  hasCard?: boolean;
  children: React.ReactNode;
}) => (
  <main>
    <header className="page-header">
      <div className="page-header-title">
        <h1>{title}</h1>
      </div>
      <div className="page-header-actions">
        {signedInUsername ? (
          <span className="page-header-user">
            Signed in as <strong>{signedInUsername}</strong>
          </span>
        ) : null}
        {hasCard && userId ? (
          <Link className="button secondary" href={`/bingo/boards/${userId}`}>
            My Board
          </Link>
        ) : null}
        <Link className="button secondary" href="/bingo/boards">
          Browse Boards
        </Link>
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
      <PageShell title="Bingo" signedInUsername={user.kickUsername}>
        <p className="status">Bingo tiles have not been set yet. Check back soon.</p>
      </PageShell>
    );
  }
  const readiness = isBingoTilePoolReady(options.tiles);
  if (!readiness.ready) {
    return (
      <PageShell title="Bingo" signedInUsername={user.kickUsername}>
        <p className="status">{readiness.message}</p>
      </PageShell>
    );
  }

  const card = getBingoCardByOwnerUserId(user.userId);
  const open = isBingoSubmissionOpen();
  const deadlineIso = getBingoSubmissionDeadline().toISOString();
  const initialNowMs = Date.now();

  if (!open) {
    return (
      <PageShell
        title="Bingo — Locked"
        signedInUsername={user.kickUsername}
        userId={user.userId}
        hasCard={Boolean(card)}
      >
        <aside className="prize-banner bingo-deadline-banner" role="note">
          <div className="prize-banner-title">Bingo Deadline</div>
          <DeadlineCountdown
            deadlineIso={deadlineIso}
            initialNowMs={initialNowMs}
            openMessage="Bingo cards lock in:"
            closedMessage="Bingo cards locked."
          />
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
    <PageShell
      title={card ? "Edit Your Bingo Card" : "Build Your Bingo Card"}
      signedInUsername={user.kickUsername}
      userId={user.userId}
      hasCard={Boolean(card)}
    >
      <p className="bingo-tier-balance-text">
        Build a tier-balanced card: 8 Easy, 7 Medium, 5 Hard, 3 Insane, 1
        Legendary (plus FREE center).
      </p>
      <aside className="prize-banner bingo-deadline-banner" role="note">
        <div className="prize-banner-title">Bingo Deadline</div>
        <DeadlineCountdown
          deadlineIso={deadlineIso}
          initialNowMs={initialNowMs}
          openMessage="Bingo cards lock in:"
          closedMessage="Bingo cards locked."
        />
      </aside>
      <BingoEditor
        tiles={options.tiles}
        initialLayout={card?.layout ?? []}
        hasExistingCard={Boolean(card)}
      />
    </PageShell>
  );
}
