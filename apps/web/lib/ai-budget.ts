const budgetScript = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 2 end
if tonumber(redis.call('GET', KEYS[2]) or '0') >= tonumber(ARGV[1]) then return 3 end
if tonumber(redis.call('GET', KEYS[3]) or '0') >= tonumber(ARGV[2]) then return 4 end
redis.call('SET', KEYS[1], '1', 'EX', ARGV[3])
if redis.call('INCR', KEYS[2]) == 1 then redis.call('EXPIRE', KEYS[2], ARGV[4]) end
if redis.call('INCR', KEYS[3]) == 1 then redis.call('EXPIRE', KEYS[3], ARGV[5]) end
return 1
`;

export type BudgetResult = "allowed" | "replay" | "wallet_limit" | "global_limit";

export function aiBudgetConfigured(): boolean {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)
    && (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN),
  );
}

export async function consumeAiBudget(wallet: string, nonce: string): Promise<BudgetResult> {
  const endpoint = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!endpoint || !token) throw new Error("AI rate limit storage is not configured");

  const day = new Date().toISOString().slice(0, 10);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify([
      "EVAL", budgetScript, 3,
      `roxmate:ai:nonce:${wallet}:${nonce}`,
      `roxmate:ai:wallet:${wallet}`,
      `roxmate:ai:global:${day}`,
      3, 100, 300, 3600, 86400,
    ]),
    signal: AbortSignal.timeout(5_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("AI rate limit storage is unavailable");
  const body = await response.json() as { result?: unknown; error?: string };
  switch (Number(body.result)) {
    case 1: return "allowed";
    case 2: return "replay";
    case 3: return "wallet_limit";
    case 4: return "global_limit";
    default: throw new Error("AI rate limit storage returned an invalid response");
  }
}
