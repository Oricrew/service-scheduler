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

  it("defines security definer membership helpers with fixed search_path", () => {
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public");
    expect(sql).toContain("function public.is_org_member");
    expect(sql).toContain("function public.has_minimum_org_role");
  });

  it("does not grant any table privileges to anon", () => {
    const grantToAnon = /grant\b[^;]*\bto\s+anon\b/gi;
    expect(sql.match(grantToAnon)).toBeNull();
  });
});
