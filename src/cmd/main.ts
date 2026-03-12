import { add } from "@lib/math";
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type AdditionRow = {
  id: number;
  a: number;
  b: number;
  result: number;
  created_at: string;
};

const DB_PATH = fileURLToPath(
  new URL(join(process.cwd(), "var", "invoke-agent.sqlite"), import.meta.url),
);

function ensureDbFolder() {
  mkdirSync(dirname(DB_PATH), { recursive: true });
}

function openDatabase(): Database {
  ensureDbFolder();
  const db = new Database(DB_PATH);
  db.run(`
    CREATE TABLE IF NOT EXISTS additions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      a REAL NOT NULL,
      b REAL NOT NULL,
      result REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    PRAGMA journal_mode = WAL;
  `);
  return db;
}

function parseOperands(argv: string[]): [number, number] {
  const [firstArg, secondArg] = argv;
  const a = firstArg === undefined ? 2 : Number(firstArg);
  const b = secondArg === undefined ? 3 : Number(secondArg);
  if (Number.isNaN(a) || Number.isNaN(b)) {
    throw new Error("Operands must be numeric values");
  }
  return [a, b];
}

function recordAddition(db: Database, a: number, b: number, result: number) {
  const stmt = db.prepare(
    "INSERT INTO additions (a, b, result) VALUES ($a, $b, $result)",
  );
  stmt.run({ $a: a, $b: b, $result: result });
}

function latestAdditions(db: Database, limit = 5): AdditionRow[] {
  const stmt = db.prepare(
    "SELECT id, a, b, result, created_at FROM additions ORDER BY id DESC LIMIT $limit",
  );
  return stmt.all({ $limit: limit }) as AdditionRow[];
}

if (import.meta.main) {
  let db: Database | undefined;
  try {
    const [a, b] = parseOperands(Bun.argv.slice(2));
    const result = add(a, b);
    db = openDatabase();
    recordAddition(db, a, b, result);
    const recent = latestAdditions(db);

    console.log(`Add ${a} + ${b} = ${result}`);
    console.log("Recent additions saved to SQLite:");
    for (const row of recent) {
      console.log(
        `  [${row.id}] ${row.a} + ${row.b} = ${row.result} (${row.created_at})`,
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    db?.close();
  }
}

export { add };
