import { NextResponse } from "next/server";
import { hasAiConsent } from "../../../lib/chain-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Candidate = { wallet: string; index: number; score: number; comparable: number; reasons: string[] };

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

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (raw.length > 32_768) return NextResponse.json({ enabled: false, error: "请求内容过大" }, { status: 413 });
    const body = JSON.parse(raw) as { candidates?: unknown } | null;
    if (!body || typeof body !== "object") return NextResponse.json({ enabled: false, error: "匹配数据格式不正确" }, { status: 400 });
    const candidateValues = Array.isArray(body.candidates) ? body.candidates.slice(0, 10) : [];
    const validCandidates = candidateValues.every((value): value is Candidate => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      const candidate = value as Partial<Candidate>;
      return typeof candidate.wallet === "string" && /^0x[a-f\d]{40}$/i.test(candidate.wallet)
        && Number.isInteger(candidate.index) && Number.isFinite(candidate.score)
        && Number.isInteger(candidate.comparable) && Array.isArray(candidate.reasons)
        && candidate.reasons.every((reason) => typeof reason === "string");
    });
    if (!validCandidates) {
      return NextResponse.json({ enabled: false, error: "匹配数据格式不正确" }, { status: 400 });
    }
    const candidates = candidateValues as Candidate[];

    const apiKey = process.env.AI_API_KEY;
    const endpoint = process.env.AI_MATCH_URL;
    const model = process.env.AI_MATCH_MODEL;
    if (!apiKey || !endpoint || !model) return NextResponse.json({ enabled: false, code: "ai_unconfigured", reasons: {} });

    const authorizedCandidates = (await Promise.all(candidates.map(async (candidate) =>
      await hasAiConsent(candidate.wallet) ? candidate : null
    ))).filter((candidate): candidate is Candidate => candidate !== null);
    if (!authorizedCandidates.length) return NextResponse.json({ enabled: false, code: "no_authorized_candidates", reasons: {} });

    // Never send candidate wallet addresses to the model provider.
    const modelCandidates = authorizedCandidates.map(({ index, score, comparable, reasons }) => ({ index, score, comparable, reasons }));

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
    return NextResponse.json({ enabled: true, reasons: parseReasons(data.choices?.[0]?.message?.content) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ enabled: false, error: "请求 JSON 格式不正确" }, { status: 400 });
    return NextResponse.json({ enabled: false, code: "ai_unavailable", reasons: {} });
  }
}
