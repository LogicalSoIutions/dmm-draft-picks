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

  return (
    <main>
      <header className="page-header">
        <div className="page-header-title">
          <h1>{draft.ownerKickUsername}&apos;s Draft</h1>
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
