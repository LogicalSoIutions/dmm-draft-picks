import Link from "next/link";

import { AdminDraftEditor } from "@/components/admin-draft-editor";
import { defaultPickOrder } from "@/data/participants";
import { isAdminUsername } from "@/lib/admin";
import { getAuthenticatedUserFromServer } from "@/lib/auth";
import {
  findDraftsMatchingPayload,
  getOfficialDraft,
  listAllDraftsWithOwner,
} from "@/server/db/queries";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getAuthenticatedUserFromServer();
  if (!user) {
    return (
      <main>
        <h1>Admin</h1>
        <p>You need to authenticate with Kick before accessing this page.</p>
        <Link className="button" href="/auth/kick/start?next=/admin">
          Login with Kick
        </Link>
      </main>
    );
  }
  if (!isAdminUsername(user.kickUsername)) {
    return (
      <main>
        <h1>Admin</h1>
        <p>You are not authorized to access this page.</p>
        <Link className="button secondary" href="/">
          Back to Home
        </Link>
      </main>
    );
  }
  const official = getOfficialDraft();
  const matches = official
    ? findDraftsMatchingPayload({
        picksOrder: official.picksOrder,
        captainAssignments: official.captainAssignments,
      })
    : [];
  const allDrafts = listAllDraftsWithOwner();

  return (
    <main>
      <header className="page-header">
        <div className="page-header-title">
          <h1>Admin — Official Draft</h1>
        </div>
        <div className="page-header-actions">
          <span className="page-header-user">
            Signed in as <strong>{user.kickUsername}</strong>
          </span>
          <Link className="button secondary" href="/admin/bingo">
            Bingo Tiles
          </Link>
          <Link className="button secondary" href="/">
            Back to Home
          </Link>
        </div>
      </header>
      <p>
        Set the actual draft below. Saving updates the official record and lists
        every saved draft that is 1000% identical to it.
      </p>
      <AdminDraftEditor
        initialOrder={official?.picksOrder ?? defaultPickOrder}
        initialCaptainAssignments={official?.captainAssignments ?? {}}
        initialMatches={matches.map((match) => ({
          publicId: match.publicId,
          kickUsername: match.kickUsername,
          updatedAt: match.updatedAt,
        }))}
        hasOfficialDraft={Boolean(official)}
        allDrafts={allDrafts.map((d) => ({
          picksOrder: d.picksOrder,
          captainAssignments: d.captainAssignments,
        }))}
      />
    </main>
  );
}
