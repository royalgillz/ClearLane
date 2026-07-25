import { newClient } from "./pool.mjs";

// introspect the live db and print an ascii schema diagram. reflects what actually
// got migrated, not a hand-drawn picture that can drift.

const TABLE_ORDER = [
  "sessions", "drivers", "vehicles", "coverage_prefs", "providers",
  "call_jobs", "calls", "quotes", "reports",
];

function typeLabel(col) {
  if (col.data_type === "ARRAY") return `${col.udt_name.replace(/^_/, "")}[]`;
  if (col.data_type === "USER-DEFINED") return col.udt_name; // enum name
  if (col.data_type === "character varying") return "text";
  if (col.data_type === "timestamp with time zone") return "timestamptz";
  return col.data_type;
}

async function main() {
  const client = newClient();
  await client.connect();
  try {
    const cols = (await client.query(`
      select table_name, column_name, data_type, udt_name, is_nullable, column_default
      from information_schema.columns
      where table_schema = 'public' and table_name = any($1)
      order by table_name, ordinal_position
    `, [TABLE_ORDER])).rows;

    const pks = (await client.query(`
      select tc.table_name, kcu.column_name
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
      where tc.constraint_type = 'PRIMARY KEY' and tc.table_schema = 'public'
    `)).rows;

    const fks = (await client.query(`
      select tc.table_name, kcu.column_name, ccu.table_name as ref_table
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
      join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
      where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
    `)).rows;

    const pkSet = new Set(pks.map((r) => `${r.table_name}.${r.column_name}`));
    const fkMap = new Map(fks.map((r) => [`${r.table_name}.${r.column_name}`, r.ref_table]));

    const byTable = new Map();
    for (const c of cols) {
      if (!byTable.has(c.table_name)) byTable.set(c.table_name, []);
      byTable.get(c.table_name).push(c);
    }

    const line = "=".repeat(72);
    console.log(`\n${line}\nClearLane schema\n${line}`);

    for (const table of TABLE_ORDER) {
      const tcols = byTable.get(table);
      if (!tcols) continue;
      console.log(`\n[${table}]`);
      for (const c of tcols) {
        const key = `${table}.${c.column_name}`;
        const marks = [];
        if (pkSet.has(key)) marks.push("PK");
        if (fkMap.has(key)) marks.push(`FK->${fkMap.get(key)}`);
        if (c.is_nullable === "NO" && !pkSet.has(key)) marks.push("not null");
        const suffix = marks.length ? `  (${marks.join(", ")})` : "";
        console.log(`  ${c.column_name.padEnd(30)} ${typeLabel(c).padEnd(16)}${suffix}`);
      }
    }

    console.log(`\n${line}\nrelationships\n${line}`);
    for (const r of fks) {
      console.log(`  ${r.table_name}.${r.column_name}  ->  ${r.ref_table}.id`);
    }
    console.log("");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
