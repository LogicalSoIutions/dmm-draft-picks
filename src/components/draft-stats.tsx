import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";

import {
  captains,
  picks,
  type Participant,
} from "@/data/participants";

const captainHeaderStyle = (captain: Participant): CSSProperties | undefined =>
  captain.color
    ? ({ "--captain-color": captain.color } as CSSProperties)
    : undefined;
import type {
  CaptainAffinity,
  DraftStatsSummary,
  OfficialMatchStats,
  PickStats,
  SlotConsensus,
  SlotConsensusEntry,
} from "@/lib/draft-stats";
import { formatEasternDateTime } from "@/lib/format-date";
import { snakeSlotsByCaptain } from "@/lib/snake-draft";

type DraftStatsProps = {
  summary: DraftStatsSummary;
  slotConsensus: SlotConsensus[];
  pickStats: PickStats[];
  captainAffinity: CaptainAffinity[];
  officialMatchStats: OfficialMatchStats | null;
  officialUpdatedAt: string | null;
};

const captainById = new Map(captains.map((captain) => [captain.id, captain]));
const pickById = new Map(picks.map((pick) => [pick.id, pick]));

const formatPercent = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) {
    return "0%";
  }
  if (value >= 99.95) {
    return "100%";
  }
  if (value < 10) {
    return `${value.toFixed(1)}%`;
  }
  return `${Math.round(value)}%`;
};

const formatNumber = (value: number, fractionDigits = 1): string => {
  if (!Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(fractionDigits);
};

const formatDate = (iso: string | null): string => {
  if (!iso) {
    return "—";
  }
  return formatEasternDateTime(iso);
};

type PickThumbProps = {
  pick: Participant;
  size?: number;
};

function PickThumb({ pick, size = 56 }: PickThumbProps) {
  return (
    <Image
      src={pick.imagePath}
      alt={pick.label}
      width={size}
      height={size}
      className="participant-image stats-thumb"
    />
  );
}

function HeadlineNumbers({ summary }: { summary: DraftStatsSummary }) {
  return (
    <div className="stats-headline">
      <div className="stats-headline-item">
        <span className="stats-headline-value">{summary.totalDrafts}</span>
        <span className="stats-headline-label">Drafts submitted</span>
      </div>
      <div className="stats-headline-item">
        <span className="stats-headline-value">{summary.totalUniqueOwners}</span>
        <span className="stats-headline-label">Unique guessers</span>
      </div>
      <div className="stats-headline-item">
        <span className="stats-headline-value stats-headline-value-small">
          {formatDate(summary.lastUpdatedAt)}
        </span>
        <span className="stats-headline-label">Last submission</span>
      </div>
    </div>
  );
}

type ConsensusSlotCellProps = {
  slot: SlotConsensus;
};

function ConsensusSlotCell({ slot }: ConsensusSlotCellProps) {
  const top = slot.topEntries[0];
  const runners = slot.topEntries.slice(1);
  const topPick = top ? pickById.get(top.pickId) ?? null : null;
  return (
    <div className="stats-consensus-slot">
      <div className="stats-consensus-slot-header">
        <span className="stats-consensus-slot-number">#{slot.slotNumber}</span>
        <span className="stats-consensus-slot-count">
          {slot.filledCount} draft{slot.filledCount === 1 ? "" : "s"}
        </span>
      </div>
      {topPick && top ? (
        <div className="stats-consensus-slot-top">
          <PickThumb pick={topPick} size={56} />
          <div className="stats-consensus-slot-top-text">
            <strong>{topPick.label}</strong>
            <span className="stats-consensus-slot-top-pct">
              {formatPercent(top.percent)}
            </span>
          </div>
        </div>
      ) : (
        <div className="stats-consensus-slot-empty">no picks yet</div>
      )}
      {runners.length > 0 ? (
        <ul className="stats-consensus-slot-runners">
          {runners.map((runner: SlotConsensusEntry) => {
            const runnerPick = pickById.get(runner.pickId);
            if (!runnerPick) {
              return null;
            }
            return (
              <li key={runner.pickId}>
                <span className="stats-consensus-runner-name">
                  {runnerPick.label}
                </span>
                <span className="stats-consensus-runner-pct">
                  {formatPercent(runner.percent)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

type ConsensusBoardProps = {
  slotConsensus: SlotConsensus[];
};

function ConsensusBoard({ slotConsensus }: ConsensusBoardProps) {
  const slotsByCaptain = captains.map((_, captainIndex) => {
    const captainSlots = snakeSlotsByCaptain[captainIndex] ?? [];
    return captainSlots
      .map((slotNumber) => slotConsensus[slotNumber - 1])
      .filter((slot): slot is SlotConsensus => slot !== undefined);
  });
  return (
    <div className="card stats-section">
      <h2>Consensus Snake Board</h2>
      <p>
        For each snake-draft slot, the pick that the most people put there
        across every submitted draft. Hover counts show the runners-up.
      </p>
      <div className="captain-table-scroll">
        <div className="captain-table stats-consensus-table">
          {captains.map((captain, captainIndex) => (
            <div key={captain.id} className="captain-column">
              <div
                className="captain-column-header"
                style={captainHeaderStyle(captain)}
              >
                <Image
                  src={captain.imagePath}
                  alt={captain.label}
                  width={80}
                  height={80}
                  className="participant-image"
                />
                <strong>{captain.label}</strong>
              </div>
              <div className="captain-column-slots">
                {slotsByCaptain[captainIndex].map((slot) => (
                  <ConsensusSlotCell key={slot.slotNumber} slot={slot} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type PickStatCardProps = {
  pick: Participant;
  stats: PickStats;
};

function PickStatCard({ pick, stats }: PickStatCardProps) {
  const modeCaptain =
    stats.captainBuckets[0] && captainById.get(stats.captainBuckets[0].captainId);
  const histogramMax = stats.slotBuckets.reduce(
    (max, bucket) => (bucket.count > max ? bucket.count : max),
    0,
  );
  return (
    <div className="card stats-pick-card">
      <div className="stats-pick-card-header">
        <PickThumb pick={pick} size={64} />
        <div className="stats-pick-card-headline">
          <strong>{pick.label}</strong>
          <span className="stats-pick-card-meta">
            {stats.totalAppearances} placement
            {stats.totalAppearances === 1 ? "" : "s"}
          </span>
        </div>
      </div>
      <dl className="stats-pick-card-stats">
        <div>
          <dt>Most common slot</dt>
          <dd>
            {stats.modeSlotNumber !== null ? (
              <>
                <strong>#{stats.modeSlotNumber}</strong>{" "}
                <span className="stats-pct">
                  ({formatPercent(stats.modeSlotPercent)})
                </span>
              </>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt>Average slot</dt>
          <dd>
            {stats.averageSlot !== null
              ? formatNumber(stats.averageSlot, 1)
              : "—"}
          </dd>
        </div>
        <div>
          <dt>Slot range</dt>
          <dd>
            {stats.minSlot !== null && stats.maxSlot !== null
              ? stats.minSlot === stats.maxSlot
                ? `#${stats.minSlot}`
                : `#${stats.minSlot}–#${stats.maxSlot}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt>Top captain</dt>
          <dd>
            {modeCaptain ? (
              <>
                <strong>{modeCaptain.label}</strong>{" "}
                <span className="stats-pct">
                  ({formatPercent(stats.captainBuckets[0]?.percent ?? 0)})
                </span>
              </>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>
      {stats.slotBuckets.length > 0 ? (
        <div className="stats-pick-histogram" aria-label="Slot distribution">
          {stats.slotBuckets.map((bucket) => {
            const heightPct = histogramMax > 0
              ? (bucket.count / histogramMax) * 100
              : 0;
            return (
              <div
                key={bucket.slotNumber}
                className="stats-pick-histogram-bar"
                title={`Slot #${bucket.slotNumber}: ${bucket.count} (${formatPercent(bucket.percent)})`}
              >
                <span
                  className="stats-pick-histogram-fill"
                  style={{ height: `${heightPct}%` }}
                />
                <span className="stats-pick-histogram-slot">
                  {bucket.slotNumber}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

type PickBreakdownProps = {
  pickStats: PickStats[];
};

function PickBreakdown({ pickStats }: PickBreakdownProps) {
  const sorted = [...pickStats].sort((a, b) => {
    if (b.totalAppearances !== a.totalAppearances) {
      return b.totalAppearances - a.totalAppearances;
    }
    if (b.modeSlotPercent !== a.modeSlotPercent) {
      return b.modeSlotPercent - a.modeSlotPercent;
    }
    return a.pickId.localeCompare(b.pickId);
  });
  return (
    <div className="card stats-section">
      <h2>Per-Pick Breakdown</h2>
      <p>
        Where each pick lands across all submitted drafts. Bars show the slot
        distribution; the taller the bar, the more people put them there.
      </p>
      <div className="stats-pick-grid">
        {sorted.map((stats) => {
          const pick = pickById.get(stats.pickId);
          if (!pick) {
            return null;
          }
          return <PickStatCard key={stats.pickId} pick={pick} stats={stats} />;
        })}
      </div>
    </div>
  );
}

type CaptainAffinitySectionProps = {
  affinity: CaptainAffinity[];
};

function CaptainAffinitySection({ affinity }: CaptainAffinitySectionProps) {
  return (
    <div className="card stats-section">
      <h2>Captain Affinity</h2>
      <p>
        Picks that people most often assign to each captain in the snake-draft
        layout.
      </p>
      <div className="stats-captain-grid">
        {affinity.map((entry) => {
          const captain = captainById.get(entry.captainId);
          if (!captain) {
            return null;
          }
          return (
            <div key={entry.captainId} className="stats-captain-card">
              <div
                className="stats-captain-card-header"
                style={captainHeaderStyle(captain)}
              >
                <Image
                  src={captain.imagePath}
                  alt={captain.label}
                  width={56}
                  height={56}
                  className="participant-image"
                />
              </div>
              {entry.topPicks.length === 0 ? (
                <p className="stats-empty">No picks assigned yet.</p>
              ) : (
                <ul className="stats-captain-card-list">
                  {entry.topPicks.map((row) => {
                    const pick = pickById.get(row.pickId);
                    if (!pick) {
                      return null;
                    }
                    return (
                      <li key={row.pickId}>
                        <span className="stats-captain-card-pick">
                          <PickThumb pick={pick} size={28} />
                          <span>{pick.label}</span>
                        </span>
                        <span className="stats-pct">
                          {formatPercent(row.percent)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type OfficialSectionProps = {
  stats: OfficialMatchStats;
  officialUpdatedAt: string | null;
};

function OfficialSection({ stats, officialUpdatedAt }: OfficialSectionProps) {
  const trimmedHistogram = stats.histogram.filter((bucket) => bucket.count > 0);
  const maxCount = trimmedHistogram.reduce(
    (max, bucket) => (bucket.count > max ? bucket.count : max),
    0,
  );
  return (
    <div className="card stats-section">
      <h2>Official Draft Comparison</h2>
      <p>
        Official draft locked in on <strong>{formatDate(officialUpdatedAt)}</strong>.
        Best guess so far: <strong>{stats.bestCorrect}</strong> slot
        {stats.bestCorrect === 1 ? "" : "s"} correct. Average:{" "}
        <strong>{formatNumber(stats.averageCorrect, 1)}</strong>.
      </p>
      {trimmedHistogram.length > 0 ? (
        <div className="stats-official-histogram">
          {trimmedHistogram.map((bucket) => {
            const widthPct = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;
            return (
              <div key={bucket.correctSlots} className="stats-official-row">
                <span className="stats-official-row-label">
                  {bucket.correctSlots} correct
                </span>
                <div className="stats-official-row-bar">
                  <span
                    className="stats-official-row-fill"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <span className="stats-official-row-count">
                  {bucket.count} ({formatPercent(bucket.percent)})
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
      {stats.leaderboard.length > 0 ? (
        <div className="stats-official-leaderboard">
          <h3>Leaderboard</h3>
          <ol>
            {stats.leaderboard.map((entry) => (
              <li key={entry.publicId}>
                <Link href={`/d/${entry.publicId}`} className="carousel-link">
                  {entry.ownerKickUsername}
                </Link>
                <span className="stats-official-leader-meta">
                  {entry.correctSlots} correct · {formatDate(entry.updatedAt)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

export function DraftStats({
  summary,
  slotConsensus,
  pickStats,
  captainAffinity,
  officialMatchStats,
  officialUpdatedAt,
}: DraftStatsProps) {
  if (summary.totalDrafts === 0) {
    return (
      <div className="card">
        <p>No drafts have been submitted yet. Stats will appear here as soon as the first guesses come in.</p>
      </div>
    );
  }
  return (
    <div className="stats-layout">
      <HeadlineNumbers summary={summary} />
      <ConsensusBoard slotConsensus={slotConsensus} />
      {officialMatchStats && officialMatchStats.totalDrafts > 0 ? (
        <OfficialSection
          stats={officialMatchStats}
          officialUpdatedAt={officialUpdatedAt}
        />
      ) : null}
      <PickBreakdown pickStats={pickStats} />
      <CaptainAffinitySection affinity={captainAffinity} />
    </div>
  );
}
