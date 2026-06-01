import Link from "next/link";

import { DraftViewer } from "@/components/draft-viewer";
import { getDraftWithOwnerByPublicId } from "@/server/db/queries";

type PublicDraftPageProps = {
  params: Promise<{
    publicId: string;
  }>;
};

export default async function PublicDraftPage({ params }: PublicDraftPageProps) {
  const { publicId } = await params;
  const draft = getDraftWithOwnerByPublicId(publicId);

  if (!draft) {
    return (
      <main>
        <header className="page-header">
          <div className="page-header-title">
            <h1>Draft Not Found</h1>
          </div>
          <div className="page-header-actions">
            <Link className="button" href="/">
              Back to Home
            </Link>
          </div>
        </header>
        <p>This share URL is invalid or the draft was removed.</p>
      </main>
    );
  }

  const displayTitle = draft.ownerKickUsername.toLowerCase() === "zappermickie"
    ? "ZapperMickie's Draft (Just kidding, everybody lost on Pick 7)"
    : `${draft.ownerKickUsername}'s Draft`;

  return (
    <main>
      <header className="page-header">
        <div className="page-header-title">
          <h1>{displayTitle}</h1>
        </div>
        <div className="page-header-actions">
          <Link className="button" href="/">
            Back to Home
          </Link>
        </div>
      </header>
      <DraftViewer
        order={draft.picksOrder}
        captainAssignments={draft.captainAssignments}
      />
    </main>
  );
}
