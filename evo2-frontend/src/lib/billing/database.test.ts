import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";

const uid = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const price = "pri_01m2z97w73ff7j0we1nvv89txb";
const product = "pro_01m2z8swqyc7g3v02bx4n8sa5c";
const migration = readFileSync(
  new URL("../../../supabase/paddle-billing.sql", import.meta.url),
  "utf8",
);
let db: PGlite;
async function value<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
) {
  const result = await db.query<{ result: T }>(sql, params);
  return result.rows[0]!.result;
}
const access = (environment = "sandbox") =>
  value<{ plan: string; status: string }>(
    "select billing_access($1,$2,$3,$4) as result",
    [uid, environment, price, product],
  );
const reserve = (key: string) =>
  value<{ id?: string; busy?: boolean; reused?: boolean; exceeded?: boolean }>(
    "select reserve_analysis($1,$2,'sandbox') as result",
    [uid, key],
  );
const snapshot = (status = "active", stamp = new Date().toISOString()) => ({
  id: "sub_test",
  status,
  updated_at: stamp,
  price_id: price,
  product_id: product,
  eligible: true,
  period_end: new Date(Date.now() + 86400000).toISOString(),
  scheduled_change: null as unknown,
});
const apply = (
  id: string,
  subscription: ReturnType<typeof snapshot>,
  env = "sandbox",
) =>
  db.query(
    "select billing_apply_event($1,$2,'subscription.updated',now(),'ctm_test',$3::jsonb,null,null)",
    [env, id, JSON.stringify(subscription)],
  );

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
    grant usage on schema auth, public to authenticated, anon, service_role;
    create table profiles(id uuid primary key references auth.users,full_name text,display_name text,theme_preference text,email_notifications boolean,updated_at timestamptz,
      plan_type text default 'student',subscription_status text default 'inactive',plan_updated_at timestamptz);
    create table prediction_history(id serial primary key,user_id uuid references auth.users,prediction text);
    alter table prediction_history enable row level security;
    create policy own_history on prediction_history for select using(user_id=auth.uid());
    create table evo2_cache(id text);
    create table disease_predictions(id text);
    create table clinvar_disease_lookup(id text);
    grant all on profiles,prediction_history,evo2_cache,disease_predictions,clinvar_disease_lookup to authenticated;
  `);
  await db.exec(migration);
}, 60000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec("truncate auth.users cascade; truncate billing_events;");
  await db.query("insert into auth.users values($1),($2)", [uid, other]);
  await db.query("insert into profiles(id) values($1),($2)", [uid, other]);
  await db.query(
    "insert into billing_customers values($1,'sandbox','ctm_test')",
    [uid],
  );
});

describe("billing migration on PostgreSQL", () => {
  it("can be rerun without resetting real subscriptions", async () => {
    await apply("evt_first", snapshot());
    await db.exec(migration);
    expect((await access()).plan).toBe("researcher");
  });
  it("does not trust profile plan fields and rejects a cross-environment deployment", async () => {
    await db.query(
      "update profiles set plan_type='researcher',subscription_status='active' where id=$1",
      [uid],
    );
    expect((await access()).plan).toBe("student");
    await expect(access("live")).rejects.toThrow("configuration mismatch");
    await expect(apply("evt_live", snapshot(), "live")).rejects.toThrow(
      "environment mismatch",
    );
  });
  it("activates only the configured product and price with a valid billing period", async () => {
    await apply("evt_wrong", { ...snapshot(), price_id: "pri_wrong" });
    expect((await access()).plan).toBe("student");
    await apply(
      "evt_active",
      snapshot("active", new Date(Date.now() + 1000).toISOString()),
    );
    expect((await access()).plan).toBe("researcher");
    await db.exec(
      "update subscriptions set period_end=now()-interval '1 second'",
    );
    expect((await access()).plan).toBe("student");
  });
  it("deduplicates events and will not restore access from older snapshots", async () => {
    const old = snapshot();
    await apply("evt_a", old);
    await apply(
      "evt_b",
      snapshot("canceled", new Date(Date.now() + 1000).toISOString()),
    );
    await apply("evt_a", old);
    await apply("evt_late", old);
    expect((await access()).plan).toBe("student");
    expect((await access()).status).toBe("canceled");
    expect(
      await value<number>("select count(*)::int as result from billing_events"),
    ).toBe(3);
  });
  it("keeps scheduled cancellation access until effective time and handles recovery", async () => {
    const s = snapshot();
    s.scheduled_change = {
      action: "cancel",
      effective_at: new Date(Date.now() + 3600000).toISOString(),
    };
    await apply("evt_scheduled", s);
    expect((await access()).plan).toBe("researcher");
    await db.exec(
      `update subscriptions set scheduled_change=jsonb_build_object('action','cancel','effective_at',now()-interval '1 second')`,
    );
    expect((await access()).plan).toBe("student");
    await apply(
      "evt_past_due",
      snapshot("past_due", new Date(Date.now() + 1000).toISOString()),
    );
    expect((await access()).plan).toBe("student");
    await apply(
      "evt_recovered",
      snapshot("active", new Date(Date.now() + 2000).toISOString()),
    );
    expect((await access()).plan).toBe("researcher");
  });
  it("serializes checkout claims and blocks checkout for overdue subscriptions", async () => {
    const claims = await Promise.all(
      Array.from({ length: 8 }, () =>
        value<{ new: boolean; id: string }>(
          "select billing_begin_checkout($1,'sandbox') as result",
          [uid],
        ),
      ),
    );
    expect(claims.filter((c) => c.new)).toHaveLength(1);
    expect(new Set(claims.map((c) => c.id)).size).toBe(1);
    await apply("evt_due", snapshot("past_due"));
    expect(
      await value("select billing_begin_checkout($1,'sandbox') as result", [
        uid,
      ]),
    ).toEqual({ blocked: true });
  });
  it("limits parallel requests, counts variants once, and releases failures once", async () => {
    const attempts = await Promise.all(
      Array.from({ length: 9 }, (_, i) => reserve(`hg38:1:${i}:A:G`)),
    );
    expect(attempts.filter((a) => a.id)).toHaveLength(5);
    expect(attempts.filter((a) => a.exceeded)).toHaveLength(4);
    const first = attempts[0]!;
    expect((await reserve("hg38:1:0:A:G")).busy).toBe(true);
    await db.query("select settle_analysis($1,$2,true)", [uid, first.id]);
    expect((await reserve("hg38:1:0:A:G")).reused).toBe(true);
    await db.query("select settle_analysis($1,$2,false)", [
      uid,
      attempts[1]!.id,
    ]);
    await db.query("select settle_analysis($1,$2,false)", [
      uid,
      attempts[1]!.id,
    ]);
    expect(
      await value<number>(
        "select consumed as result from usage_daily where user_id=$1",
        [uid],
      ),
    ).toBe(4);
    expect((await reserve("hg38:1:new:A:G")).id).toBeTruthy();
  });
  it("does not reset consumed quota when upgrading", async () => {
    await Promise.all(
      Array.from({ length: 5 }, (_, i) => reserve(`variant${i}`)),
    );
    await apply("evt_upgrade", snapshot());
    const more = await Promise.all(
      Array.from({ length: 46 }, (_, i) => reserve(`new${i}`)),
    );
    expect(more.filter((r) => r.id)).toHaveLength(45);
    expect(more.filter((r) => r.exceeded)).toHaveLength(1);
  });
  it("prevents direct plan writes, billing RPC calls, and shared cache reads", async () => {
    expect(
      await value<boolean>(
        "select has_column_privilege('authenticated','profiles','plan_type','UPDATE') as result",
      ),
    ).toBe(false);
    expect(
      await value<boolean>(
        "select has_column_privilege('authenticated','profiles','full_name','UPDATE') as result",
      ),
    ).toBe(true);
    expect(
      await value<boolean>(
        "select has_table_privilege('authenticated','profiles','INSERT') as result",
      ),
    ).toBe(false);
    expect(
      await value<boolean>(
        "select has_table_privilege('authenticated','subscriptions','UPDATE') as result",
      ),
    ).toBe(false);
    expect(
      await value<boolean>(
        "select has_table_privilege('authenticated','evo2_cache','SELECT') as result",
      ),
    ).toBe(false);
    expect(
      await value<boolean>(
        "select has_function_privilege('authenticated','reserve_analysis(uuid,text,text)','EXECUTE') as result",
      ),
    ).toBe(false);
  });
  it("history RLS hides Student history and another user's records", async () => {
    await db.query(
      "insert into prediction_history(user_id,prediction) values($1,'benign'),($2,'uncertain')",
      [uid, other],
    );
    async function readHistory() {
      return db.transaction(async (tx) => {
        await tx.query(
          "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",
          [uid],
        );
        await tx.exec("set local role authenticated");
        return (await tx.query("select * from prediction_history")).rows;
      });
    }
    expect(await readHistory()).toHaveLength(0);
    await apply("evt_history", snapshot());
    expect(await readHistory()).toHaveLength(1);
  });
  it("rolls back the event ledger when subscription ownership is invalid", async () => {
    await db.query(
      "insert into subscriptions values('sandbox','sub_test',$1,'ctm_other','active',$2,$3,true,now()+interval '1 day',null,now())",
      [other, price, product],
    );
    await expect(apply("evt_badowner", snapshot())).rejects.toThrow(
      "owner mismatch",
    );
    expect(
      await value<number>("select count(*)::int as result from billing_events"),
    ).toBe(0);
  });
  it("records refunds without implicitly canceling active service", async () => {
    await apply("evt_refund_active", snapshot());
    await db.query(
      "select billing_apply_event('sandbox','evt_refund','adjustment.updated',now(),'ctm_test',null,null,$1::jsonb)",
      [
        JSON.stringify({
          id: "adj_refund",
          transaction_id: "txn_paid",
          action: "refund",
          status: "approved",
          amount: "1000",
          updated_at: new Date().toISOString(),
        }),
      ],
    );
    expect((await access()).plan).toBe("researcher");
    expect(
      await value<string>(
        "select status as result from billing_adjustments where adjustment_id='adj_refund'",
      ),
    ).toBe("approved");
  });
  it("releases a completed checkout after cancellation even when transaction delivery is late", async () => {
    const attempt = await value<{ id: string }>(
      "select billing_begin_checkout($1,'sandbox') as result",
      [uid],
    );
    await apply("evt_cancel_first", snapshot("canceled"));
    await db.query(
      "select billing_apply_event('sandbox','evt_tx_late','transaction.completed',now(),'ctm_test',null,$1::jsonb,null)",
      [
        JSON.stringify({
          id: "txn_paid",
          subscription_id: "sub_test",
          status: "completed",
          amount: "1000",
          currency: "USD",
          updated_at: new Date().toISOString(),
          attempt_id: attempt.id,
        }),
      ],
    );
    expect(
      (
        await value<{ new: boolean }>(
          "select billing_begin_checkout($1,'sandbox') as result",
          [uid],
        )
      ).new,
    ).toBe(true);
  });
});
