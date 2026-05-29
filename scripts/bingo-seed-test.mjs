import { ensureBingoTables, openBingoDb, resolveSqlitePath } from "./bingo-db-utils.mjs";

const countsByProfile = {
  min: { easy: 8, medium: 7, hard: 5, insane: 3, legendary: 1 },
  max: { easy: 21, medium: 14, hard: 10, insane: 6, legendary: 2 },
};

const profile = process.argv.includes("--max") ? "max" : "min";
const counts = countsByProfile[profile];
const dbPath = resolveSqlitePath();
const db = openBingoDb();

try {
  ensureBingoTables(db);
  const anyUser = db.prepare("SELECT id FROM users ORDER BY id ASC LIMIT 1").get();
  if (!anyUser) {
    console.error(
      "Cannot seed bingo options: no users exist yet. Log in once, then run this again.",
    );
    process.exit(1);
  }

  const tiers = ["easy", "medium", "hard", "insane", "legendary"];
  const tiles = [];
  let index = 1;
  for (const tier of tiers) {
    const count = counts[tier];
    for (let tierIndex = 1; tierIndex <= count; tierIndex += 1) {
      const labelTier = `${tier[0].toUpperCase()}${tier.slice(1)}`;
      tiles.push({
        id: `tile-${index}`,
        label: `${labelTier} Test ${tierIndex}`,
        tier,
      });
      index += 1;
    }
  }

  const tx = db.transaction(() => {
    db.prepare("DELETE FROM bingo_cards").run();
    db.prepare("DELETE FROM bingo_progress").run();
    db.prepare(
      `
        INSERT INTO bingo_options (id, tiles_json, set_by_user_id)
        VALUES (1, ?, ?)
        ON CONFLICT(id)
        DO UPDATE SET
          tiles_json = excluded.tiles_json,
          set_by_user_id = excluded.set_by_user_id,
          updated_at = CURRENT_TIMESTAMP
      `,
    ).run(JSON.stringify(tiles), anyUser.id);
  });
  tx();

  console.log(
    `Seeded bingo options (${profile}) into ${dbPath} with ${tiles.length} tiles.`,
  );
  console.log("Also cleared bingo_cards and bingo_progress for a clean test run.");
} finally {
  db.close();
}
