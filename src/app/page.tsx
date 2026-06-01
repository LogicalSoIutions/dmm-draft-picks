import Link from "next/link";

import { DraftCarousel } from "@/components/draft-carousel";
import { getAuthenticatedUserFromServer } from "@/lib/auth";
import { listAllDraftsWithOwner } from "@/server/db/queries";

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const authErrorValue = params.authError;
  const authError = Array.isArray(authErrorValue)
    ? authErrorValue[0]
    : authErrorValue;
  const user = await getAuthenticatedUserFromServer();
  const drafts = listAllDraftsWithOwner();
  return (
    <main>
      <aside className="prize-banner" role="note">
        <p className="prize-banner-text" style={{ fontSize: "16px", margin: 0 }}>
          <strong>DRAFT IS OVER - THERE WAS NOBODY EVEN CLOSE. ALL DRAFTS LOST ROUND 7.</strong>
        </p>
      </aside>
      <header className="page-header">
        <div className="page-header-title">
          <h1>DMM Draft Order</h1>
        </div>
        <div className="page-header-actions">
          <Link className="button secondary" href="/stats">
            View Stats
          </Link>
          {/* TODO: Enable once we have a draft */}
          {/* <Link className="button secondary" href="/bingo">
            Bingo
          </Link> */}
          {user ? (
            <>
              <span className="page-header-user">
                Signed in as <strong>{user.kickUsername}</strong>
              </span>
              <Link className="button" href="/draft/new">
                My Draft
              </Link>
              <Link className="button secondary" href="/privacy">
                Privacy
              </Link>
            </>
          ) : (
            <>
              <Link className="button" href="/auth/kick/start?next=/draft/new">
                Login with Kick
              </Link>
              <Link className="button secondary" href="/privacy">
                Privacy
              </Link>
            </>
          )}
        </div>
      </header>
      {authError ? (
        <p className="status error">Authentication error: {authError}</p>
      ) : null}
      <DraftCarousel
        drafts={drafts.map((draft) => ({
          publicId: draft.publicId,
          ownerKickUsername: draft.ownerKickUsername,
          picksOrder: draft.picksOrder,
          captainAssignments: draft.captainAssignments,
          updatedAt: draft.updatedAt,
        }))}
      />
    </main>
  );
}
