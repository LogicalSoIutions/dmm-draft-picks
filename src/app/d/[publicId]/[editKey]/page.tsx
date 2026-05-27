import Link from "next/link";

import { DraftEditor } from "@/components/draft-editor";
import { getAuthenticatedUserFromServer } from "@/lib/auth";
import { authorizeDraftAccess } from "@/lib/draft";
import { getDraftByPublicId } from "@/server/db/queries";

type EditDraftPageProps = {
  params: Promise<{
    publicId: string;
    editKey: string;
  }>;
};

export default async function EditDraftPage({ params }: EditDraftPageProps) {
  const { publicId, editKey } = await params;
  const user = await getAuthenticatedUserFromServer();
  if (!user) {
    const nextPath = encodeURIComponent(`/d/${publicId}/${editKey}`);
    return (
      <main>
        <header className="page-header">
          <div className="page-header-title">
            <h1>Edit Draft</h1>
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
        <p>You need to authenticate with Kick before editing this draft.</p>
        <p>
          We only store your Kick username and auth token data required to keep
          you logged in.
        </p>
        <Link className="button" href={`/auth/kick/start?next=${nextPath}`}>
          Login with Kick
        </Link>
      </main>
    );
  }
  const draft = getDraftByPublicId(publicId);
  if (!draft || !authorizeDraftAccess({ draft, userId: user.userId, editKey })) {
    return (
      <main>
        <header className="page-header">
          <div className="page-header-title">
            <h1>Edit Draft</h1>
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
        <p>Invalid draft URL or you do not have access to this draft.</p>
      </main>
    );
  }
  return (
    <main>
      <header className="page-header">
        <div className="page-header-title">
          <h1>Edit Draft</h1>
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
      <DraftEditor
        initialOrder={draft.picksOrder}
        initialCaptainAssignments={draft.captainAssignments}
        publicId={publicId}
        editKey={editKey}
      />
    </main>
  );
}
