import { createPublicClient, defineChain, http } from "viem";
import { CHAIN_ID, MAX_SCAN_LIMIT, REGISTRY_ADDRESS, RPC_URL, registryAbi } from "./chain";
import { STATIONS, DIVISIONS, type Profile, type PersonalResult, type Connection, type MatchResponse, type Review, type Score } from "./personal-types";
import { normalizeWallet } from "./shared";

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
  resultLists: Map<string, Promise<PersonalResult[]>>;
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

async function getResults(wallet: string, context: ReadContext): Promise<PersonalResult[]> {
  const key = normalizeWallet(wallet);
  const cached = context.resultLists.get(key);
  if (cached) return cached;

  const request = (async () => {
    const [ids] = await read("getPersonalResultIds", [key, 0, MAX_SCAN_LIMIT]) as [`0x${string}`[], bigint];
    const results = await Promise.all(ids.map((id) => getResult(id, context)));
    // The contract appends IDs; present the bounded fetched page newest-first.
    return results.reverse();
  })();
  context.resultLists.set(key, request);
  return request;
}

export async function myIdentity(wallet: string) {
  const context = readContext();
  const [profile, records, identityResult] = await Promise.all([
    getProfile(wallet, context),
    getResults(wallet, context),
    read("getIdentity", [wallet]),
  ]);
  const identity = identityResult as IdentityTuple;
  return {
    wallet: normalizeWallet(wallet),
    profile,
    records,
    stats: { published: records.length, drafts: 0, good: toNumber(identity.goodCount), bad: toNumber(identity.badCount) },
  };
}

export async function athlete(viewer: string, target: string) {
  const context = readContext();
  const profile = await getProfile(target, context);
  if (!profile) throw new Error("身份卡不存在");
  const [statusResult, records] = await Promise.all([
    read("getConnection", [viewer, target]),
    getResults(target, context),
  ]);
  const status = toNumber(statusResult);
  const isPartner = status === 2;
  if (normalizeWallet(viewer) !== normalizeWallet(target) && !profile.discoverable && !isPartner) throw new Error("该身份卡未公开");
  return { profile, records, isPartner };
}

export async function connections(wallet: string): Promise<Connection[]> {
  const context = readContext();
  const [others, statuses] = await read("getConnections", [wallet, 0, MAX_SCAN_LIMIT]) as [string[], number[]];
  return Promise.all(others.map(async (other, index) => {
    const profile = await getProfile(other, context);
    const status = ["NONE", "PENDING", "ACCEPTED", "DECLINED"][toNumber(statuses[index])] as Connection["status"];
    return {
      id: `${normalizeWallet(wallet)}-${normalizeWallet(other)}`,
      // The current contract stores PENDING symmetrically. Keep the existing
      // conservative presentation until a directional getter is deployed.
      requester: status === "PENDING" ? other : wallet,
      recipient: status === "PENDING" ? wallet : other,
      status,
      display_name: profile?.display_name || other.slice(0, 8),
      city: profile?.city || "",
      wallet: normalizeWallet(other),
    };
  }));
}

export async function resultDetail(viewer: string, id: string) {
  const context = readContext();
  const record = await getResult(id, context);
  const owner = record.owner;
  const profile = await getProfile(owner, context);
  if (!profile) throw new Error("身份卡不存在");
  const [statusResult, ratersResult] = await Promise.all([
    read("getConnection", [viewer, owner]),
    read("getPersonalRaters", [id, 0, MAX_SCAN_LIMIT]),
  ]);
  const status = toNumber(statusResult);
  const isPartner = status === 2;
  if (normalizeWallet(viewer) !== owner && !profile.discoverable && !isPartner) throw new Error("无权查看这项成绩");

  const [raters] = ratersResult as [string[], bigint];
  const reviews: Review[] = await Promise.all(raters.map(async (rater) => {
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
  return { record, reviews, canReview: normalizeWallet(viewer) !== owner && isPartner && !reviews.some((review) => review.rater === normalizeWallet(viewer)) };
}

export async function matches(wallet: string): Promise<MatchResponse> {
  const context = readContext();
  const me = await getProfile(wallet, context);
  if (!me) throw new Error("请先创建身份卡");
  const [members, mine] = await Promise.all([
    read("getDiscoverableProfiles", [0, MAX_SCAN_LIMIT]) as Promise<[string[], bigint]>,
    getResults(wallet, context),
  ]);
  const [memberAddresses] = members;
  const candidates = await Promise.all(memberAddresses
    .filter((address) => normalizeWallet(address) !== normalizeWallet(wallet))
    .map(async (address) => {
      const profile = await getProfile(address, context);
      if (!profile || profile.city.toLowerCase() !== me.city.toLowerCase()) return null;
      return { profile, records: await getResults(address, context) };
    }));

  const found = (candidates.filter(Boolean) as { profile: Profile; records: PersonalResult[] }[])
    .map(({ profile, records }) => {
      const pairs: number[] = [];
      for (const station of STATIONS) {
        for (const mineResult of mine.slice(0, 5)) {
          for (const candidateResult of records.slice(0, 5)) {
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
        publishedCount: records.length,
        connection: null,
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_SCAN_LIMIT);

  return { mode: "BASIC", notice: `链上基础匹配：本次最多读取 ${MAX_SCAN_LIMIT} 位候选人，每位最多读取最近 5 场成绩。`, matches: found };
}
