import Link from "next/link";

import { DeadlineCountdown } from "@/components/deadline-countdown";
import { DraftEditor } from "@/components/draft-editor";
import { DraftViewer } from "@/components/draft-viewer";
import { defaultPickOrder } from "@/data/participants";
import { getAuthenticatedUserFromServer } from "@/lib/auth";
import {
  getNewDraftSubmissionDeadline,
  isNewDraftSubmissionOpen,
} from "@/lib/draft-deadline";
import { getDraftByOwnerUserId } from "@/server/db/queries";

export default async function NewDraftPage() {
  const user = await getAuthenticatedUserFromServer();
  if (!user) {
    return (
      <main>
        <header className="page-header">
          <div className="page-header-title">
            <h1>New Draft</h1>
          </div>
          <div className="page-header-actions">
            <Link className="button secondary" href="/stats">
              View Stats
            </Link>
            <Link className="button" href="/">
              Back to Home
            </Link>
          </div>
        </header>
        <p>You need to authenticate with Kick before creating a draft.</p>
        <p>
          We only store your Kick username and auth token data required to keep
          you logged in.
        </p>
        <Link className="button" href="/auth/kick/start?next=/draft/new">
          Login with Kick
        </Link>
      </main>
    );
  }
  const existingDraft = getDraftByOwnerUserId(user.userId);
  const newDraftsOpen = isNewDraftSubmissionOpen();
  const submissionDeadlineIso = getNewDraftSubmissionDeadline().toISOString();
  const initialNowMs = Date.now();
  if (!newDraftsOpen) {
    return (
      <main>
        <header className="page-header">
          <div className="page-header-title">
            <h1>Draft Locked</h1>
          </div>
          <div className="page-header-actions">
            <Link className="button secondary" href="/stats">
              View Stats
            </Link>
            <Link className="button" href="/">
              Back to Home
            </Link>
          </div>
        </header>
        <p>Signed in as {user.kickUsername}.</p>
        <aside className="prize-banner draft-deadline-banner" role="note">
          <div className="prize-banner-title">Draft Pick Deadline</div>
          <DeadlineCountdown
            deadlineIso={submissionDeadlineIso}
            initialNowMs={initialNowMs}
            openMessage="Draft picks lock in:"
            closedMessage="Draft picks locked."
          />
        </aside>
        {existingDraft ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p>The deadline has passed. Your submitted draft is locked and can no longer be edited.</p>
            <DraftViewer
              order={existingDraft.picksOrder}
              captainAssignments={existingDraft.captainAssignments}
            />
          </div>
        ) : (
          <p>
            You did not save a draft before the deadline.
          </p>
        )}
      </main>
    );
  }
  const initialOrder = existingDraft?.picksOrder ?? defaultPickOrder;
  const initialCaptainAssignments = existingDraft?.captainAssignments ?? {};
  return (
    <main>
      <header className="page-header">
        <div className="page-header-title">
          <h1>{existingDraft ? "Edit Your Draft" : "Create Draft"}</h1>
        </div>
        <div className="page-header-actions">
          <Link className="button secondary" href="/stats">
            View Stats
          </Link>
          <Link className="button" href="/">
            Back to Home
          </Link>
        </div>
      </header>
      <p>Signed in as {user.kickUsername}.</p>
      <p>
        We only store your Kick username and auth token data required to keep you
        logged in.
      </p>
      <aside className="prize-banner draft-deadline-banner" role="note">
        <div className="prize-banner-title">Draft Pick Deadline</div>
        <DeadlineCountdown
          deadlineIso={submissionDeadlineIso}
          initialNowMs={initialNowMs}
          openMessage="Draft picks lock in:"
          closedMessage="Draft picks locked."
        />
      </aside>
      {existingDraft ? (
        <p>
          Your account has one draft. Saving here updates that same draft instead
          of creating a new one.
        </p>
      ) : null}
      <DraftEditor
        initialOrder={initialOrder}
        initialCaptainAssignments={initialCaptainAssignments}
        publicId={existingDraft?.publicId}
      />
    </main>
  );
}
