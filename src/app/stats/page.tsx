import Link from "next/link";

import { DraftStats } from "@/components/draft-stats";
import { getAuthenticatedUserFromServer } from "@/lib/auth";
import {
  buildAllSlotAssignments,
  computeCaptainAffinity,
  computeOfficialMatchStats,
  computePickStats,
  computeSlotConsensus,
  computeSummary,
  type OfficialMatchDraftInput,
} from "@/lib/draft-stats";
import { canViewOfficialDraftResults } from "@/lib/official-draft-visibility";
import { buildSlotAssignments } from "@/lib/snake-draft";
import {
  getOfficialDraft,
  listAllDraftsWithOwner,
} from "@/server/db/queries";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const user = await getAuthenticatedUserFromServer();
  const showOfficialResults = canViewOfficialDraftResults(
    user?.kickUsername,
  );
  const drafts = listAllDraftsWithOwner();
  const officialDraft = showOfficialResults ? getOfficialDraft() : null;

  const draftInputs = drafts.map((draft) => ({
    picksOrder: draft.picksOrder,
    captainAssignments: draft.captainAssignments,
    ownerUserId: draft.ownerUserId,
    updatedAt: draft.updatedAt,
  }));
  const slotAssignmentsList = buildAllSlotAssignments(draftInputs);
  const summary = computeSummary(draftInputs);
  const slotConsensus = computeSlotConsensus(slotAssignmentsList);
  const pickStats = computePickStats(slotAssignmentsList);
  const captainAffinity = computeCaptainAffinity(draftInputs);

  const officialMatchDrafts: OfficialMatchDraftInput[] = drafts.map((draft) => ({
    publicId: draft.publicId,
    ownerKickUsername: draft.ownerKickUsername,
    updatedAt: draft.updatedAt,
    picksOrder: draft.picksOrder,
    captainAssignments: draft.captainAssignments,
  }));
  const officialMatchStats = officialDraft
    ? computeOfficialMatchStats(
        officialMatchDrafts,
        buildSlotAssignments(
          officialDraft.picksOrder,
          officialDraft.captainAssignments,
        ),
      )
    : null;

  return (
    <main className="stats-page">
      <header className="page-header">
        <div className="page-header-title">
          <h1>Draft Stats</h1>
        </div>
        <div className="page-header-actions">
          <Link className="button" href="/">
            Back to Home
          </Link>
        </div>
      </header>
      <DraftStats
        summary={summary}
        slotConsensus={slotConsensus}
        pickStats={pickStats}
        captainAffinity={captainAffinity}
        officialMatchStats={officialMatchStats}
        officialUpdatedAt={officialDraft?.updatedAt ?? null}
      />
    </main>
  );
}
