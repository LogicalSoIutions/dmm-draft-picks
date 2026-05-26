import Link from "next/link";

import { DraftEditor } from "@/components/draft-editor";
import { defaultPickOrder } from "@/data/participants";
import { getAuthenticatedUserFromServer } from "@/lib/auth";
import { getDraftByOwnerUserId } from "@/server/db/queries";

export default async function NewDraftPage() {
  const user = await getAuthenticatedUserFromServer();
  if (!user) {
    return (
      <main>
        <h1>New Draft</h1>
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
  const initialOrder = existingDraft?.picksOrder ?? defaultPickOrder;
  const initialCaptainAssignments = existingDraft?.captainAssignments ?? {};
  return (
    <main>
      <h1>{existingDraft ? "Edit Your Draft" : "Create Draft"}</h1>
      <p>Signed in as {user.kickUsername}.</p>
      <p>
        We only store your Kick username and auth token data required to keep you
        logged in.
      </p>
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
