import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("sets up an empty development project in the documented order", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
      create function auth.role() returns text language sql stable as $$ select 'service_role'::text $$;
    `);
    for (const name of ["development-bootstrap.sql", "profile-settings.sql", "germline-association-schema.sql", "snv-disease-pipeline-schema.sql", "paddle-billing.sql", "free-access.sql", "analysis-cache-6-months.sql"]) {
      const sql = readFileSync(new URL(`../../../supabase/${name}`, import.meta.url), "utf8");
      // gen_random_uuid is native in embedded Postgres; Supabase also has pgcrypto.
      await db.exec(sql.replaceAll("create extension if not exists pgcrypto;", ""));
    }
    await db.exec("insert into auth.users values ('11111111-1111-4111-8111-111111111111')");
    const profile = await db.query<{ plan_type: string; subscription_status: string }>("select plan_type,subscription_status from profiles");
    expect(profile.rows).toEqual([{ plan_type: "student", subscription_status: "inactive" }]);
    const permission = await db.query<{ allowed: boolean }>("select has_column_privilege('authenticated','profiles','plan_type','UPDATE') as allowed");
    expect(permission.rows[0]?.allowed).toBe(false);
    expect((await db.query("select * from billing_config")).rows).toHaveLength(1);
    expect((await db.query("select * from free_usage_daily")).rows).toHaveLength(0);
    expect((await db.query("select * from analysis_result_cache")).rows).toHaveLength(0);
    const freePermission = await db.query<{ allowed: boolean }>("select has_function_privilege('authenticated','reserve_free_analysis(uuid,text,integer)','EXECUTE') as allowed");
    expect(freePermission.rows[0]?.allowed).toBe(false);
  } finally { await db.close(); }
}, 60000);
