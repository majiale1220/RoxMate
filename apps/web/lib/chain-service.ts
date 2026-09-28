import { createPublicClient, defineChain, http } from "viem";
import { CHAIN_ID, MAX_SCAN_LIMIT, REGISTRY_ADDRESS, RPC_URL, registryAbi } from "./chain";
import { STATIONS, DIVISIONS, type Profile, type PersonalResult, type Connection, type MatchResponse, type Review, type Score } from "./personal-types";
import { normalizeWallet } from "./shared";
import { newestPage, type Page } from "./pagination";

const chain = defineChain({ id: CHAIN_ID, name: "Monad Testnet", nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 }, rpcUrls: { default: { http: [RPC_URL] } } });
const client = createPublicClient({ chain, transport: http(RPC_URL) });
const divisions = [...DIVISIONS];

type ProfileTuple = { displayName: string; city: string; bio: string; discoverable: boolean; aiConsent: boolean; revision: bigint; exists: boolean };
type PersonalResultTuple = {
  resultId: string; owner: string; eventKey: string; eventName: string; location: string; raceDayStart: bigint;
  division: number; totalSec: number; runPaceSec: number; scoreMask: number;
  timeSec: readonly (number | bigint)[]; distanceM: readonly (number | bigint)[];
  loadKg: readonly (number | bigint)[]; reps: readonly (number | bigint)[]; revision: bigint; published: boolean;
};
type IdentityTuple = { latestResultId: string; confirmedRaceCount: bigint; goodCount: bigint; badCount: bigint; distinctRaters: bigint };
type RatingTuple = { value: number | bigint; ratedRevision: bigint; createdAt: bigint };

type ReadContext = {
  profiles: Map<string, Promise<Profile | null>>;
  resultLists: Map<string, Promise<Page<PersonalResult>>>;
  results: Map<string, Promise<PersonalResult>>;
};

const readContext = (): ReadContext => ({ profiles: new Map(), resultLists: new Map(), results: new Map() });
const toNumber = (value: unknown) => Number(value as number | bigint);
const zero = (value: number) => value === 0 ? null : value;
const hasKnownWorkload = (score: Score) => score.distanceM !== null || score.loadKg !== null || score.reps !== null;
const sameWorkload = (left: Score, right: Score) =>
  hasKnownWorkload(left) && hasKnownWorkload(right) &&
  left.distanceM === right.distanceM && left.loadKg === right.loadKg && left.reps === right.reps;

const read = (functionName: string, args: readonly unknown[] = []) =>
  client.readContract({ address: REGISTRY_ADDRESS, abi: registryAbi, functionName: functionName as never, args: args as never }) as Promise<unknown>;

async function getProfile(wallet: string, context: ReadContext): Promise<Profile | null> {
  const key = normalizeWallet(wallet);
  const cached = context.profiles.get(key);
  if (cached) return cached;

  const request = (async () => {
    const profile = await read("getProfile", [key]) as ProfileTuple;
    if (!profile?.exists) return null;
    return {
      wallet: key,
      display_name: profile.displayName,
      city: profile.city,
      bio: profile.bio,
      discoverable: profile.discoverable,
      ai_consent: profile.aiConsent,
    };
  })();
  context.profiles.set(key, request);
  return request;
}

export async function hasAiConsent(wallet: string): Promise<boolean> {
  const profile = await getProfile(wallet, readContext());
  return profile?.ai_consent === true;
}

async function getResult(id: string, context: ReadContext): Promise<PersonalResult> {
  const key = id.toLowerCase();
  const cached = context.results.get(key);
  if (cached) return cached;

  const request = (async () => {
    const result = await read("getPersonalResult", [id]) as PersonalResultTuple;
    const scores: Score[] = STATIONS.flatMap((station, index) => {
      if ((toNumber(result.scoreMask) & (1 << index)) === 0) return [];
      return [{
        key: station.key,
        timeSec: toNumber(result.timeSec[index]),
        distanceM: zero(toNumber(result.distanceM[index])),
        loadKg: zero(toNumber(result.loadKg[index])),
        reps: zero(toNumber(result.reps[index])),
      }];
    });
    const raceDate = new Date(toNumber(result.raceDayStart) * 1000);
    return {
      id: result.resultId,
      owner: normalizeWallet(result.owner),
      payload: {
        eventName: result.eventName,
        location: result.location,
        raceDate: raceDate.toISOString().slice(0, 10),
        division: divisions[toNumber(result.division)] || divisions[0],
        totalSec: zero(toNumber(result.totalSec)),
        runPaceSec: zero(toNumber(result.runPaceSec)),
        scores,
      },
      status: "PUBLISHED" as const,
      created_at: raceDate.toISOString(),
      updated_at: raceDate.toISOString(),
      good: 0,
      bad: 0,
    };
  })();
  context.results.set(key, request);
  return request;
}

async function getResults(wallet: string, context: ReadContext, before?: number): Promise<Page<PersonalResult>> {
  const key = normalizeWallet(wallet);
  const cacheKey = `${key}:${before ?? "latest"}`;
  const cached = context.resultLists.get(cacheKey);
  if (cached) return cached;

  const request = (async () => {
    const ids = await newestPage(async (cursor, limit) => {
      const [page] = await read("getPersonalResultIds", [key, cursor, limit]) as [`0x${string}`[], bigint];
      return page;
    }, before);
    return { ...ids, items: await Promise.all(ids.items.map((id) => getResult(id, context))) };
  })();
  context.resultLists.set(cacheKey, request);
  return request;
}

export async function olderResults(wallet: string, before: number): Promise<Page<PersonalResult>> {
  return getResults(wallet, readContext(), before);
}

export async function myIdentity(wallet: string) {
  const context = readContext();
  const [profile, results, identityResult] = await Promise.all([
    getProfile(wallet, context),
    getResults(wallet, context),
    read("getIdentity", [wallet]),
  ]);
  const identity = identityResult as IdentityTuple;
  return {
    wallet: normalizeWallet(wallet),
    profile,
    records: results.items,
    olderResultsCursor: results.olderCursor,
    stats: { published: results.total, drafts: 0, good: toNumber(identity.goodCount), bad: toNumber(identity.badCount) },
  };
}

export async function athlete(viewer: string, target: string) {
  const context = readContext();
  const profile = await getProfile(target, context);
  if (!profile) throw new Error("身份卡不存在");
  const [statusResult, results] = await Promise.all([
    read("getConnection", [viewer, target]),
    getResults(target, context),
  ]);
  const status = toNumber(statusResult);
  const isPartner = status === 2;
  if (normalizeWallet(viewer) !== normalizeWallet(target) && !profile.discoverable && !isPartner) throw new Error("该用户未开启应用内展示；链上数据仍公开");
  return { profile, records: results.items, olderResultsCursor: results.olderCursor, publishedCount: results.total, isPartner };
}

export async function connections(wallet: string, before?: number): Promise<Page<Connection>> {
  const context = readContext();
  const page = await newestPage(async (cursor, limit) => {
    const [others, statuses] = await read("getConnections", [wallet, cursor, limit]) as [string[], number[], bigint];
    return others.map((other, index) => ({ other, status: toNumber(statuses[index]) }));
  }, before);
  const items = await Promise.all(page.items.map(async ({ other, status: statusNumber }) => {
    const profile = await getProfile(other, context);
    const status = ["NONE", "PENDING", "ACCEPTED", "DECLINED"][statusNumber] as Connection["status"];
    let requester = wallet;
    if (status === "PENDING") {
      try {
        requester = await read("getPendingRequester", [wallet, other]) as string;
      } catch {
        throw new Error("当前合约尚未部署搭档权限修复版，无法安全显示邀请方向。");
      }
      if (normalizeWallet(requester) !== normalizeWallet(wallet) && normalizeWallet(requester) !== normalizeWallet(other)) {
        throw new Error("链上邀请方向不正确，请刷新后重试。");
      }
    }
    return {
      id: `${normalizeWallet(wallet)}-${normalizeWallet(other)}`,
      requester,
      recipient: status === "PENDING" && normalizeWallet(requester) === normalizeWallet(wallet) ? other : wallet,
      status,
      display_name: profile?.display_name || other.slice(0, 8),
      city: profile?.city || "",
      wallet: normalizeWallet(other),
    };
  }));
  return { ...page, items };
}

export async function resultDetail(viewer: string, id: string) {
  const context = readContext();
  const record = await getResult(id, context);
  const owner = record.owner;
  const profile = await getProfile(owner, context);
  if (!profile) throw new Error("身份卡不存在");
  const [statusResult, viewerRating] = await Promise.all([
    read("getConnection", [viewer, owner]),
    read("getPersonalRating", [id, viewer]) as Promise<RatingTuple>,
  ]);
  const status = toNumber(statusResult);
  const isPartner = status === 2;
  if (normalizeWallet(viewer) !== owner && !profile.discoverable && !isPartner) throw new Error("该用户未开启应用内成绩展示；链上数据仍公开");

  const reviews = await reviewPage(id, context);
  return {
    record,
    reviews: reviews.items,
    reviewCount: reviews.total,
    olderReviewsCursor: reviews.olderCursor,
    canReview: normalizeWallet(viewer) !== owner && isPartner && toNumber(viewerRating.value) === 0,
  };
}

async function reviewPage(id: string, context: ReadContext, before?: number): Promise<Page<Review>> {
  const raters = await newestPage(async (cursor, limit) => {
    const [page] = await read("getPersonalRaters", [id, cursor, limit]) as [string[], bigint];
    return page;
  }, before);
  const items: Review[] = await Promise.all(raters.items.map(async (rater) => {
    const [rating, comment, raterProfile] = await Promise.all([
      read("getPersonalRating", [id, rater]) as Promise<RatingTuple>,
      read("getPersonalRatingComment", [id, rater]) as Promise<string>,
      getProfile(rater, context),
    ]);
    return {
      id: `${id}-${normalizeWallet(rater)}`,
      result_id: id,
      rater: normalizeWallet(rater),
      value: toNumber(rating.value) === 1 ? "GOOD" : "BAD",
      comment,
      display_name: raterProfile?.display_name || rater.slice(0, 8),
      created_at: new Date(toNumber(rating.createdAt) * 1000).toISOString(),
    };
  }));
  return { ...raters, items };
}

export async function olderReviews(id: string, before: number): Promise<Page<Review>> {
  return reviewPage(id, readContext(), before);
}

export async function matches(wallet: string, before?: number): Promise<MatchResponse> {
  const context = readContext();
  const me = await getProfile(wallet, context);
  if (!me) throw new Error("请先创建身份卡");
  const [countResult, mine] = await Promise.all([
    read("profileCount"),
    getResults(wallet, context),
  ]);
  const count = toNumber(countResult);
  const end = before === undefined ? count : Math.min(Math.max(0, before), count);
  const start = Math.max(0, end - MAX_SCAN_LIMIT);
  const [memberAddresses] = end > start
    ? await read("getDiscoverableProfiles", [start, end - start]) as [string[], bigint]
    : [[], BigInt(0)];
  const candidates = await Promise.all(memberAddresses
    .filter((address) => normalizeWallet(address) !== normalizeWallet(wallet))
    .map(async (address) => {
      const profile = await getProfile(address, context);
      if (!profile || profile.city.toLowerCase() !== me.city.toLowerCase()) return null;
      return { profile, results: await getResults(address, context) };
    }));

  const found = (candidates.filter(Boolean) as { profile: Profile; results: Page<PersonalResult> }[])
    .map(({ profile, results }) => {
      const pairs: number[] = [];
      for (const station of STATIONS) {
        for (const mineResult of mine.items.slice(0, 5)) {
          for (const candidateResult of results.items.slice(0, 5)) {
            if (mineResult.payload.division !== candidateResult.payload.division) continue;
            const left = mineResult.payload.scores.find((score) => score.key === station.key);
            const right = candidateResult.payload.scores.find((score) => score.key === station.key);
            if (left && right && sameWorkload(left, right)) {
              pairs.push(left.timeSec / right.timeSec);
              break;
            }
          }
        }
      }
      const similar = pairs.length ? pairs.reduce((sum, value) => sum + Math.min(value, 1 / value), 0) / pairs.length : 0;
      return {
        profile,
        score: Math.round(35 + (pairs.length >= 3 ? 55 * similar : 0)),
        comparable: pairs.length,
        reasons: [`同城：${me.city}`, pairs.length >= 3 ? `有 ${pairs.length} 项相同组别、工作量的成绩可比` : "可比项目不足 3 项"],
        publishedCount: results.total,
        connection: null,
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_SCAN_LIMIT);

  return {
    mode: "BASIC",
    notice: `链上基础匹配：每批最多读取 ${MAX_SCAN_LIMIT} 个身份位置，每位最多比较最近 5 场成绩。`,
    matches: found,
    cursor: end,
    nextCursor: start > 0 ? start : null,
  };
}
