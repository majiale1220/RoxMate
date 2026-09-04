import { decodeErrorResult, decodeFunctionResult, encodeAbiParameters, encodeFunctionData, keccak256 } from "viem";
import type { WalletProvider } from "./wallet";
import { DIVISIONS, STATIONS, type ResultPayload } from "./personal-types";

export const REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || process.env.REGISTRY_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;
export const CHAIN_ID = 10143;
export const RPC_URL = process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC_URL || "https://testnet-rpc.monad.xyz/";
export const MAX_SCAN_LIMIT = 10;

const stationIndex = new Map(STATIONS.map((station,index) => [station.key,index]));
const divisionIndex = new Map(DIVISIONS.map((division,index) => [division,index]));

export const registryAbi = [
  {type:"function",name:"getProfile",stateMutability:"view",inputs:[{name:"member",type:"address"}],outputs:[{name:"",type:"tuple",components:[{name:"displayName",type:"string"},{name:"city",type:"string"},{name:"bio",type:"string"},{name:"discoverable",type:"bool"},{name:"aiConsent",type:"bool"},{name:"revision",type:"uint64"},{name:"exists",type:"bool"}]}]},
  {type:"function",name:"getPersonalResultIds",stateMutability:"view",inputs:[{name:"owner",type:"address"},{name:"cursor",type:"uint256"},{name:"limit",type:"uint8"}],outputs:[{name:"ids",type:"bytes32[]"},{name:"nextCursor",type:"uint256"}]},
  {type:"function",name:"getPersonalResult",stateMutability:"view",inputs:[{name:"resultId",type:"bytes32"}],outputs:[{name:"",type:"tuple",components:[{name:"resultId",type:"bytes32"},{name:"owner",type:"address"},{name:"eventKey",type:"bytes32"},{name:"eventName",type:"string"},{name:"location",type:"string"},{name:"raceDayStart",type:"uint64"},{name:"division",type:"uint8"},{name:"totalSec",type:"uint32"},{name:"runPaceSec",type:"uint32"},{name:"scoreMask",type:"uint8"},{name:"timeSec",type:"uint32[8]"},{name:"distanceM",type:"uint32[8]"},{name:"loadKg",type:"uint16[8]"},{name:"reps",type:"uint16[8]"},{name:"revision",type:"uint64"},{name:"published",type:"bool"}]}]},
  {type:"function",name:"getIdentity",stateMutability:"view",inputs:[{name:"member",type:"address"}],outputs:[{name:"",type:"tuple",components:[{name:"latestResultId",type:"bytes32"},{name:"confirmedRaceCount",type:"uint64"},{name:"goodCount",type:"uint64"},{name:"badCount",type:"uint64"},{name:"distinctRaters",type:"uint64"}]}]},
  {type:"function",name:"getDiscoverableProfiles",stateMutability:"view",inputs:[{name:"cursor",type:"uint256"},{name:"limit",type:"uint8"}],outputs:[{name:"members",type:"address[]"},{name:"nextCursor",type:"uint256"}]},
  {type:"function",name:"getConnections",stateMutability:"view",inputs:[{name:"member",type:"address"},{name:"cursor",type:"uint256"},{name:"limit",type:"uint8"}],outputs:[{name:"others",type:"address[]"},{name:"statuses",type:"uint8[]"},{name:"nextCursor",type:"uint256"}]},
  {type:"function",name:"getConnection",stateMutability:"view",inputs:[{name:"member",type:"address"},{name:"other",type:"address"}],outputs:[{name:"",type:"uint8"}]},
  {type:"function",name:"getPersonalRaters",stateMutability:"view",inputs:[{name:"resultId",type:"bytes32"},{name:"cursor",type:"uint256"},{name:"limit",type:"uint8"}],outputs:[{name:"raters",type:"address[]"},{name:"nextCursor",type:"uint256"}]},
  {type:"function",name:"getPersonalRating",stateMutability:"view",inputs:[{name:"resultId",type:"bytes32"},{name:"rater",type:"address"}],outputs:[{name:"",type:"tuple",components:[{name:"value",type:"uint8"},{name:"ratedRevision",type:"uint64"},{name:"createdAt",type:"uint64"}]}]},
  {type:"function",name:"getPersonalRatingComment",stateMutability:"view",inputs:[{name:"resultId",type:"bytes32"},{name:"rater",type:"address"}],outputs:[{name:"",type:"string"}]},
  {type:"function",name:"updateProfile",stateMutability:"nonpayable",inputs:[{name:"displayName",type:"string"},{name:"city",type:"string"},{name:"bio",type:"string"},{name:"discoverable",type:"bool"},{name:"aiConsent",type:"bool"}],outputs:[]},
  {type:"function",name:"publishPersonalResult",stateMutability:"nonpayable",inputs:[{name:"input",type:"tuple",components:[{name:"resultId",type:"bytes32"},{name:"eventKey",type:"bytes32"},{name:"eventName",type:"string"},{name:"location",type:"string"},{name:"raceDayStart",type:"uint64"},{name:"division",type:"uint8"},{name:"totalSec",type:"uint32"},{name:"runPaceSec",type:"uint32"},{name:"scoreMask",type:"uint8"},{name:"timeSec",type:"uint32[8]"},{name:"distanceM",type:"uint32[8]"},{name:"loadKg",type:"uint16[8]"},{name:"reps",type:"uint16[8]"}]}],outputs:[]},
  {type:"function",name:"invitePartner",stateMutability:"nonpayable",inputs:[{name:"recipient",type:"address"}],outputs:[]},
  {type:"function",name:"respondPartner",stateMutability:"nonpayable",inputs:[{name:"requester",type:"address"},{name:"accept",type:"bool"}],outputs:[]},
  {type:"function",name:"ratePersonalResult",stateMutability:"nonpayable",inputs:[{name:"resultId",type:"bytes32"},{name:"value",type:"uint8"},{name:"comment",type:"string"}],outputs:[]},
] as const;

const registryErrorAbi = [
  {type:"error",name:"InvalidConnection",inputs:[]},
  {type:"error",name:"NotInviteRecipient",inputs:[]},
  {type:"error",name:"ProfileNotFound",inputs:[]},
  {type:"error",name:"NotPartner",inputs:[]},
  {type:"error",name:"InputTooLong",inputs:[]},
] as const;

export function eventKey(eventName:string, location:string, raceDate:string, division:string) {
  return keccak256(encodeAbiParameters(
    [{type:"string"},{type:"string"},{type:"string"},{type:"string"}],
    [eventName, location, raceDate, division],
  ));
}

export function personalResultInput(payload: ResultPayload) {
  const timeSec = new Array(8).fill(0);
  const distanceM = new Array(8).fill(0);
  const loadKg = new Array(8).fill(0);
  const reps = new Array(8).fill(0);
  let scoreMask = 0;
  for (const score of payload.scores) {
    const index = stationIndex.get(score.key);
    if (index === undefined) continue;
    scoreMask |= 1 << index;
    timeSec[index] = score.timeSec;
    distanceM[index] = score.distanceM ?? 0;
    loadKg[index] = score.loadKg ?? 0;
    reps[index] = score.reps ?? 0;
  }
  const division = divisionIndex.get(payload.division);
  if (division === undefined) throw new Error("比赛组别不正确，请重新选择");
  return {
    eventKey: eventKey(payload.eventName, payload.location, payload.raceDate, payload.division),
    eventName: payload.eventName,
    location: payload.location,
    raceDayStart: Math.floor(new Date(`${payload.raceDate}T00:00:00Z`).getTime() / 1000),
    division,
    totalSec: payload.totalSec ?? 0,
    runPaceSec: payload.runPaceSec ?? 0,
    scoreMask,
    timeSec,
    distanceM,
    loadKg,
    reps,
  };
}

export function personalResultId(payload: ResultPayload, wallet: string) {
  return keccak256(encodeAbiParameters(
    [{type:"string"},{type:"string"},{type:"string"},{type:"string"},{type:"address"},{type:"uint256"}],
    [payload.eventName, payload.location, payload.raceDate, payload.division, wallet as `0x${string}`, BigInt(Date.now())],
  ));
}

export async function readRegistry(provider:WalletProvider, functionName:string, args:readonly unknown[]=[]) {
  const data = encodeFunctionData({abi:registryAbi,functionName:functionName as never,args:args as never});
  const result = await provider.request({method:"eth_call",params:[{to:REGISTRY_ADDRESS,data},"latest"]}) as `0x${string}`;
  return decodeFunctionResult({abi:registryAbi,functionName:functionName as never,data:result});
}

function errorData(error:unknown): `0x${string}`|undefined {
  if(!error || typeof error!=="object") return undefined;
  const value=error as {data?:unknown;error?:unknown;originalError?:unknown};
  if(typeof value.data === "string" && value.data.startsWith("0x")) return value.data as `0x${string}`;
  return errorData(value.error) || errorData(value.originalError);
}

function contractErrorText(error:unknown) {
  const data=errorData(error);
  if(!data) return undefined;
  try {
    const decoded=decodeErrorResult({abi:registryErrorAbi,data});
    const messages:Record<string,string>={
      InvalidConnection:"邀请状态无效：对方可能已处理邀请，或当前钱包不是邀请接收方。",
      NotInviteRecipient:"这条邀请已不存在、已处理，或当前钱包不是接收方。请刷新搭档页面。",
      ProfileNotFound:"邀请双方都必须先创建身份卡。",
      NotPartner:"双方还不是搭档，暂时不能执行此操作。",
      InputTooLong:"填写内容过长，请缩短后重试。",
    };
    return messages[decoded.errorName];
  } catch { return undefined; }
}

export async function assertWalletContext(provider:WalletProvider, account:string) {
  const accounts=await provider.request({method:"eth_accounts"}) as string[];
  if(!accounts?.[0] || accounts[0].toLowerCase()!==account.toLowerCase()) throw new Error("当前钱包账户与页面账户不一致，请切换到账户后重新连接。");
  const chain=await provider.request({method:"eth_chainId"});
  if(Number(chain)!==CHAIN_ID) throw new Error("钱包当前不在 Monad Testnet，请切换网络后重试。");
}

export async function sendRegistryTransaction(provider:WalletProvider, account:string, functionName:string, args:readonly unknown[]) {
  await assertWalletContext(provider,account);
  const data = encodeFunctionData({abi:registryAbi,functionName:functionName as never,args:args as never});
  const transaction={from:account,to:REGISTRY_ADDRESS,data};
  try {
    await provider.request({method:"eth_estimateGas",params:[transaction]});
  } catch(error) {
    const specific=contractErrorText(error);
    if(specific) throw new Error(specific);
    const message=error instanceof Error?error.message:"";
    const lower=message.toLowerCase();
    if(lower.includes("revert")||lower.includes("execution failed")||lower.includes("internal json-rpc")||lower.includes("transaction failed")) throw new Error("合约校验失败：请检查身份卡、比赛日期和成绩字段后重试");
    throw error;
  }
  const hash = await provider.request({method:"eth_sendTransaction",params:[transaction]}) as string;
  for(let attempt=0;attempt<120;attempt++) {
    const receipt = await provider.request({method:"eth_getTransactionReceipt",params:[hash]}) as {status?:string}|null;
    if(receipt) { if(receipt.status && receipt.status !== "0x1") throw new Error("链上交易执行失败"); return hash; }
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  throw new Error("链上交易确认超时，请稍后从钱包记录查看状态");
}
