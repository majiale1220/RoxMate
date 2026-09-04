import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Candidate = { index: number; score: number; comparable: number; reasons: string[] };

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
    const body = JSON.parse(raw) as { candidates?: Candidate[] };
    const candidates = Array.isArray(body.candidates) ? body.candidates.slice(0, 10) : [];
    if (candidates.some((candidate) => !Number.isInteger(candidate.index) || !Number.isFinite(candidate.score) || !Number.isInteger(candidate.comparable) || !Array.isArray(candidate.reasons))) {
      return NextResponse.json({ enabled: false, error: "匹配数据格式不正确" }, { status: 400 });
    }

    const apiKey = process.env.AI_API_KEY;
    const endpoint = process.env.AI_MATCH_URL;
    const model = process.env.AI_MATCH_MODEL;
    if (!apiKey || !endpoint || !model) return NextResponse.json({ enabled: false, reasons: {} });

    const prompt = [
      "你是 RoxMate 的运动搭档匹配解释器。",
      "根据匿名的基础匹配信号，为每个候选人生成一句简洁、客观、中文的搭档建议。",
      "不要猜测姓名、钱包、联系方式或未提供的个人信息，不要输出分数以外的新事实。",
      "只返回 JSON 数组，每项格式为 {\"index\": number, \"reason\": string}。",
      JSON.stringify({ candidates }),
    ].join("\n");
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, temperature: 0.2, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!upstream.ok) return NextResponse.json({ enabled: false, reasons: {} });
    const data = await upstream.json() as { choices?: Array<{ message?: { content?: unknown } }> };
    return NextResponse.json({ enabled: true, reasons: parseReasons(data.choices?.[0]?.message?.content) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ enabled: false, error: "请求 JSON 格式不正确" }, { status: 400 });
    return NextResponse.json({ enabled: false, reasons: {} });
  }
}
