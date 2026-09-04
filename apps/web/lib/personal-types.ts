export const STATIONS = [
  { key: "ski", label: "SkiErg" }, { key: "push", label: "Sled Push" },
  { key: "pull", label: "Sled Pull" }, { key: "burpee", label: "Burpee Broad Jump" },
  { key: "row", label: "Rowing" }, { key: "carry", label: "Farmers Carry" },
  { key: "lunges", label: "Sandbag Lunges" }, { key: "wall", label: "Wall Balls" },
] as const;
export const DIVISIONS = ["SINGLES_OPEN", "SINGLES_PRO", "DOUBLES_OPEN", "DOUBLES_PRO", "DOUBLES_MIXED"] as const;
export type StationKey = typeof STATIONS[number]["key"];
export type Division = typeof DIVISIONS[number];
export type Profile = { wallet: string; display_name: string; city: string; bio: string; discoverable: boolean; ai_consent: boolean };
export type Score = { key: StationKey; timeSec: number; distanceM: number | null; loadKg: number | null; reps: number | null };
export type ResultPayload = { eventName: string; location: string; raceDate: string; division: Division; totalSec: number | null; runPaceSec: number | null; scores: Score[] };
export type PersonalResult = { id: string; owner: string; payload: ResultPayload; status: "DRAFT" | "PUBLISHED"; created_at: string; updated_at: string; good: number; bad: number };
export type Review = { id: string; result_id: string; rater: string; value: "GOOD" | "BAD"; comment: string; display_name: string; created_at: string };
export type Connection = { id: string; requester: string; recipient: string; status: "PENDING" | "ACCEPTED" | "DECLINED"; display_name: string; city: string; wallet: string };
export type Match = { profile: Profile; score: number; comparable: number; reasons: string[]; aiReason?: string; publishedCount: number; connection: Connection["status"] | null };
export type MatchResponse = { mode: "AI" | "BASIC"; notice: string; matches: Match[] };
