import assert from "node:assert/strict";
import test from "node:test";
import { aiBudgetConfigured, consumeAiBudget } from "../lib/ai-budget.ts";

test("AI remains disabled without shared rate limit storage", async () => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  try {
    assert.equal(aiBudgetConfigured(), false);
    await assert.rejects(consumeAiBudget("0xabc", "nonce"), /not configured/);
  } finally {
    if (url !== undefined) process.env.UPSTASH_REDIS_REST_URL = url;
    if (token !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = token;
    if (kvUrl !== undefined) process.env.KV_REST_API_URL = kvUrl;
    if (kvToken !== undefined) process.env.KV_REST_API_TOKEN = kvToken;
  }
});

test("AI budget accepts Vercel Upstash integration variables", async () => {
  const originalFetch = globalThis.fetch;
  const old = Object.fromEntries(["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN"]
    .map((key) => [key, process.env[key]]));
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  process.env.KV_REST_API_URL = "https://kv.example.test";
  process.env.KV_REST_API_TOKEN = "kv-token";
  let seenUrl;
  globalThis.fetch = async (url) => {
    seenUrl = url;
    return Response.json({ result: 1 });
  };
  try {
    assert.equal(aiBudgetConfigured(), true);
    assert.equal(await consumeAiBudget("0xabc", "nonce"), "allowed");
    assert.equal(seenUrl, "https://kv.example.test");
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("AI budget uses one atomic Redis script and rejects storage failure", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.test";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  let command;
  globalThis.fetch = async (_url, options) => {
    command = JSON.parse(options.body);
    return Response.json({ result: 1 });
  };
  try {
    assert.equal(await consumeAiBudget("0xabc", "nonce"), "allowed");
    assert.equal(command[0], "EVAL");
    assert.equal(command[2], 3);
    assert.equal(command[6], 3);
    assert.equal(command[7], 100);
    globalThis.fetch = async () => new Response(null, { status: 503 });
    await assert.rejects(consumeAiBudget("0xabc", "another-nonce"), /unavailable/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  }
});
