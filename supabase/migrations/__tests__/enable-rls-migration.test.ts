import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  import.meta.dirname,
  "..",
  "20260929120000_enable_rls_public_tables.sql",
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

  it("hardens security definer helpers with empty search_path and postgres owner", () => {
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
    expect(sql).not.toContain("set search_path = public");
    expect(sql).toContain("owner to postgres");
    expect(sql).toContain("function public.is_org_member");
    expect(sql).toContain("function public.client_belongs_to_org");
  });

  it("does not grant execute on helpers to anon", () => {
    expect(sql).toMatch(
      /revoke execute on function public\.is_org_member\(uuid\) from anon/,
    );
    const grantExecuteToAnon = /grant execute on function[^;]+\bto\s+anon\b/gi;
    expect(sql.match(grantExecuteToAnon)).toBeNull();
  });

  it("does not grant any table privileges to anon", () => {
    const grantToAnon = /grant\b[^;]*\bto\s+anon\b/gi;
    expect(sql.match(grantToAnon)).toBeNull();
  });

  it("blocks authenticated access to appointment secure token columns", () => {
    expect(sql).toContain(
      "revoke select (secure_token_hash) on table public.appointments from authenticated",
    );
    expect(sql).toContain(
      "revoke update (secure_token_hash) on table public.appointments from authenticated",
    );
  });

  it("limits organization updates to non-identity columns", () => {
    expect(sql).toContain(
      "grant update (name, timezone, default_locale) on table public.organizations to authenticated",
    );
  });

  it("requires actor_user_id on appointment event inserts", () => {
    expect(sql).toContain("actor_user_id = (select auth.uid())");
  });
});
