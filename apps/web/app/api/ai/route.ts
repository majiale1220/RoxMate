import { NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { aiRequestMessage, type AiRequest } from "../../../lib/ai-auth";
import { aiBudgetConfigured, consumeAiBudget } from "../../../lib/ai-budget";
import { hasAiConsent, matches } from "../../../lib/chain-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseReasons(content: unknown): Record<string, string> {
  if (typeof content !== "string") return {};
  const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    const items = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === "object" && Array.isArray((parsed as {matches?:unknown}).matches) ? (parsed as {matches:unknown[]}).matches : []);
    return Object.fromEntries(items.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const value = item as { index?: unknown; reason?: unknown };
      return Number.isInteger(value.index) && typeof value.reason === "string" && value.reason.trim()
        ? [[String(value.index), value.reason.trim().slice(0, 300)]]
        : [];
    }));
  } catch {
    return {};
  }
}

function validRequest(value: unknown): value is AiRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const request = value as Partial<AiRequest>;
  return typeof request.wallet === "string" && /^0x[a-f\d]{40}$/i.test(request.wallet)
    && Number.isSafeInteger(request.cursor) && (request.cursor ?? -1) >= 0
    && Number.isSafeInteger(request.issuedAt)
    && typeof request.nonce === "string" && /^[0-9a-f-]{36}$/i.test(request.nonce)
    && typeof request.signature === "string" && /^0x[a-f\d]{130}$/i.test(request.signature);
}

async function readLimitedText(request: Request, maxBytes: number): Promise<string | null> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      void reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function POST(request: Request) {
  try {
    const raw = await readLimitedText(request, 2_048);
    if (raw === null) return NextResponse.json({ enabled: false, error: "请求内容过大" }, { status: 413 });
    const body = JSON.parse(raw) as unknown;
    if (!validRequest(body)) return NextResponse.json({ enabled: false, error: "匹配请求格式不正确" }, { status: 400 });
    const now = Date.now();
    if (body.issuedAt > now + 30_000 || now - body.issuedAt > 300_000) {
      return NextResponse.json({ enabled: false, code: "signature_expired" }, { status: 401 });
    }

    const apiKey = process.env.AI_API_KEY;
    const endpoint = process.env.AI_MATCH_URL;
    const model = process.env.AI_MATCH_MODEL;
    if (!apiKey || !endpoint || !model || !aiBudgetConfigured()) {
      return NextResponse.json({ enabled: false, code: "ai_unconfigured", reasons: {} });
    }

    let signatureValid = false;
    try {
      signatureValid = await verifyMessage({
        address: body.wallet as `0x${string}`,
        message: aiRequestMessage(body),
        signature: body.signature as `0x${string}`,
      });
    } catch {/* Invalid signature encoding. */}
    if (!signatureValid) return NextResponse.json({ enabled: false, code: "invalid_signature" }, { status: 401 });
    if (!await hasAiConsent(body.wallet)) {
      return NextResponse.json({ enabled: false, code: "requester_not_authorized", reasons: {} }, { status: 403 });
    }

    const budget = await consumeAiBudget(body.wallet.toLowerCase(), body.nonce.toLowerCase());
    if (budget !== "allowed") {
      return NextResponse.json({ enabled: false, code: budget, reasons: {} }, { status: 429 });
    }

    // Recompute every score and reason from the registry. The client cannot
    // supply model instructions or another athlete's private text.
    const page = await matches(body.wallet, body.cursor);
    const candidates = page.matches.filter((candidate) => candidate.profile.ai_consent);
    if (!candidates.length) return NextResponse.json({ enabled: false, code: "no_authorized_candidates", reasons: {} });
    const modelCandidates = candidates.map((candidate, index) => ({
      index,
      score: candidate.score,
      comparable: candidate.comparable,
      reasons: candidate.reasons.filter((reason) => !reason.startsWith("同城：")),
    }));

    const prompt = [
      "你是 RoxMate 的运动搭档匹配解释器。",
      "根据匿名的基础匹配信号，为每个候选人生成一句简洁、客观、中文的搭档建议。",
      "不要猜测姓名、钱包、联系方式或未提供的个人信息，不要输出分数以外的新事实。",
      "只返回 JSON 数组，每项格式为 {\"index\": number, \"reason\": string}。",
      JSON.stringify({ candidates: modelCandidates }),
    ].join("\n");
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, reasoning_effort: "low", messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!upstream.ok) return NextResponse.json({ enabled: false, code: "upstream_unavailable", reasons: {} });
    const data = await upstream.json() as { choices?: Array<{ message?: { content?: unknown } }> };
    const parsed = parseReasons(data.choices?.[0]?.message?.content);
    const reasons = Object.fromEntries(candidates.flatMap((candidate, index) => {
      const reason = parsed[String(index)];
      return reason ? [[candidate.profile.wallet, reason]] : [];
    }));
    return NextResponse.json({ enabled: true, reasons }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ enabled: false, error: "请求 JSON 格式不正确" }, { status: 400 });
    return NextResponse.json({ enabled: false, code: "ai_unavailable", reasons: {} }, { status: 503 });
  }
}
