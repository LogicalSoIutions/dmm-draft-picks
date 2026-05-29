import { ensureBingoTables, openBingoDb, resolveSqlitePath } from "./bingo-db-utils.mjs";

const dbPath = resolveSqlitePath();
const db = openBingoDb();

try {
  ensureBingoTables(db);
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM bingo_cards").run();
    db.prepare("DELETE FROM bingo_progress").run();
    db.prepare("DELETE FROM bingo_options").run();
  });
  tx();

  const cards = db.prepare("SELECT COUNT(*) AS count FROM bingo_cards").get().count;
  const progress = db.prepare("SELECT COUNT(*) AS count FROM bingo_progress").get()
    .count;
  const options = db.prepare("SELECT COUNT(*) AS count FROM bingo_options").get().count;

  console.log(`Wiped bingo data in ${dbPath}`);
  console.log(`bingo_cards=${cards}, bingo_progress=${progress}, bingo_options=${options}`);
} finally {
  db.close();
}
