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
        <div className="prize-banner-title">Prize Pool</div>
        <p className="prize-banner-text">
          Whoever guesses the draft right gets{" "}
          <strong>500M OSRS GP from Odablock</strong>. If more than 3 people
          win, the first two people to enter the winning draft will face off in
          a <strong>Split or Steal</strong>.
        </p>
      </aside>
      <header className="page-header">
        <div className="page-header-title">
          <h1>DMM Draft Order</h1>
        </div>
        <div className="page-header-actions">
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
