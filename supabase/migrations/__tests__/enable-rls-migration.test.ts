import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  import.meta.dirname,
  "..",
  "20260929120000_enable_rls_public_tables.sql",
);

const verifyGrantsPath = join(
  import.meta.dirname,
  "..",
  "..",
  "tests",
  "verify_rls_grants.sql",
);

const tables = [
  "organizations",
  "organization_members",
  "technicians",
  "clients",
  "services",
  "appointments",
  "appointment_technicians",
  "appointment_events",
  "company_settings",
] as const;

const defaultDbUrl = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function localDatabaseReady(dbUrl: string) {
  try {
    execSync(`psql "${dbUrl}" -tAc "select 1"`, {
      stdio: "pipe",
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

describe("enable RLS migration", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("enables RLS on all nine public application tables", () => {
    for (const table of tables) {
      expect(sql).toContain(
        `alter table public.${table} enable row level security`,
      );
    }
  });

  it("revokes API access from anon on every table", () => {
    for (const table of tables) {
      expect(sql).toMatch(
        new RegExp(
          `revoke all on table public\\.${table} from public, anon, authenticated`,
        ),
      );
    }
  });

  it("places security definer helpers in private schema", () => {
    expect(sql).toContain("create schema if not exists private");
    expect(sql).toContain("function private.is_org_member");
    expect(sql).not.toMatch(/create or replace function public\.is_org_member/);
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("owner to postgres");
  });

  it("does not grant execute on helpers to anon", () => {
    expect(sql).toMatch(
      /revoke execute on function private\.is_org_member\(uuid\) from anon/,
    );
    const grantExecuteToAnon = /grant execute on function[^;]+\bto\s+anon\b/gi;
    expect(sql.match(grantExecuteToAnon)).toBeNull();
  });

  it("does not grant any table privileges to anon", () => {
    const grantToAnon = /grant\b[^;]*\bto\s+anon\b/gi;
    expect(sql.match(grantToAnon)).toBeNull();
  });

  it("uses column-list grants on appointments without secure_token_hash", () => {
    expect(sql).toContain("grant");
    expect(sql).toMatch(/grant\s+select\s+\(\s*id,\s*organization_id,/);
    expect(sql).not.toMatch(
      /grant select, insert, update, delete on table public\.appointments/,
    );
    expect(sql).not.toContain("secure_token_hash");
    expect(sql).not.toMatch(/create policy appointments_insert_supervisor/i);
  });

  it("limits organization_members select to self or supervisor", () => {
    expect(sql).toContain("organization_members_select_self_or_supervisor");
    expect(sql).toContain("user_id = (select auth.uid())");
  });

  it("makes appointment_events append-only for authenticated", () => {
    expect(sql).toContain(
      "grant select, insert on table public.appointment_events to authenticated",
    );
    expect(sql).not.toMatch(
      /grant select, insert, delete on table public\.appointment_events/,
    );
    expect(sql).not.toMatch(/create policy appointment_events_delete_admin/i);
  });
});

describe("RLS grant verification SQL", () => {
  const verifySql = readFileSync(verifyGrantsPath, "utf8");

  it("asserts column and table privileges with has_column_privilege", () => {
    expect(verifySql).toContain("has_column_privilege");
    expect(verifySql).toContain("secure_token_hash");
    expect(verifySql).toContain("has_table_privilege");
  });
});

describe("RLS grants against local database", () => {
  const dbUrl = process.env.SUPABASE_DB_URL ?? defaultDbUrl;

  it.skipIf(!localDatabaseReady(dbUrl))(
    "passes verify_rls_grants.sql after migrations",
    () => {
      execSync(`psql "${dbUrl}" -v ON_ERROR_STOP=1 -f "${verifyGrantsPath}"`, {
        stdio: "pipe",
        timeout: 30_000,
      });
    },
  );
});
