"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { type Profile, type PersonalResult, type Connection, type MatchResponse } from "../lib/personal-types";
import { connectWallet, watchWallets, type WalletOption, type WalletProvider } from "../lib/wallet";
import { ProfileEditor, ResultEditor, ResultsList, ResultDetail, type Detail } from "../components/personal";
import { PartnerRow } from "../components/partners";
import { assertWalletContext, personalResultId, personalResultInput, readRegistry, sendRegistryTransaction } from "../lib/chain";
import { draftStorageKey, shortWallet } from "../lib/shared";
import { BrandLockup, LoadingPage, NoticeStack } from "../components/common";
import { athlete as readAthlete, connections as readConnections, matches as findMatches, myIdentity as readIdentity, resultDetail as readResultDetail } from "../lib/chain-service";

type Me = {wallet:string;profile:Profile|null;records:PersonalResult[];stats:{published:number;drafts:number;good:number;bad:number}};
type Page = "identity"|"record"|"matches"|"partners";
function errorText(error:unknown) {return (error as {code?:number})?.code===4001?"你取消了钱包请求，可以重新连接。":error instanceof Error?error.message:"操作失败，请重试";}

async function requestAi(matches:MatchResponse):Promise<MatchResponse> {
  if(!matches.matches.length) return matches;
  const response=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({candidates:matches.matches.map((match,index)=>({index,score:match.score,comparable:match.comparable,reasons:match.reasons.filter(reason=>!reason.startsWith("同城："))}))})});
  if(!response.ok) throw new Error("AI 服务暂不可用");
  const data=await response.json() as {enabled?:boolean;reasons?:Record<string,string>};
  if(!data.enabled||!data.reasons) return matches;
  return {
    ...matches,
    mode:"AI",
    notice:`${matches.notice} AI 已根据匿名匹配信号生成解释。`,
    matches:matches.matches.map((match,index)=>({...match,aiReason:data.reasons?.[String(index)]})),
  };
}

export default function Home() {
  const [me,setMe]=useState<Me|null>(null),[ready,setReady]=useState(false),[page,setPage]=useState<Page>("identity");
  const [wallets,setWallets]=useState<WalletOption[]>([]),[walletId,setWalletId]=useState("");
  const [provider,setProvider]=useState<WalletProvider|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
  const [editingProfile,setEditingProfile]=useState(false),[draft,setDraft]=useState<PersonalResult|undefined>();
  const [recordKey,setRecordKey]=useState(0),[match,setMatch]=useState<MatchResponse|null>(null),[links,setLinks]=useState<Connection[]>([]);
  const [athlete,setAthlete]=useState<{profile:Profile;records:PersonalResult[];isPartner:boolean}|null>(null),[detail,setDetail]=useState<Detail|null>(null);
  const epoch=useRef(0);
  useEffect(()=>{if(detail)document.getElementById("result-detail")?.scrollIntoView({behavior:"smooth",block:"start"});else if(athlete)document.getElementById("athlete-detail")?.scrollIntoView({behavior:"smooth",block:"start"});},[detail?.record.id,athlete?.profile.wallet]);
  const clear=useCallback(()=>{epoch.current++;setMe(null);setPage("identity");setMatch(null);setLinks([]);setAthlete(null);setDetail(null);setDraft(undefined);setRecordKey(k=>k+1);setEditingProfile(false);},[]);
  useEffect(()=>watchWallets(setWallets),[]);
  useEffect(()=>{if(!me||provider||!wallets.length)return;const selected=wallets.find(w=>w.id===walletId)||wallets[0];if(selected)setProvider(selected.provider);},[me,provider,walletId,wallets]);
  useEffect(()=>{if(!me)return;try{const raw=localStorage.getItem(draftStorageKey(me.wallet));if(raw){const parsed=JSON.parse(raw) as {payload?:PersonalResult["payload"]};if(parsed.payload)setDraft({id:"local-draft",owner:me.wallet,payload:parsed.payload,status:"DRAFT",created_at:new Date().toISOString(),updated_at:new Date().toISOString(),good:0,bad:0});}}catch{/* Ignore malformed local drafts. */}},[me?.wallet]);
  useEffect(()=>{setReady(true);},[]);
  const logout=useCallback(async()=>{clear();setProvider(null);},[clear]);
  useEffect(()=>{
    const options=provider?[provider]:wallets.map(w=>w.provider);
    const changed=(value:unknown)=>{
      if(!me) return;
      const invalid=Array.isArray(value)?!value[0]||String(value[0]).toLowerCase()!==me.wallet:Number(value)!==10143;
      if(invalid) {void logout();setError("钱包账户或网络已变化，请重新连接钱包。");}
    };
    for(const p of options){p.on?.("accountsChanged",changed);p.on?.("chainChanged",changed);}
    return()=>{for(const p of options){p.removeListener?.("accountsChanged",changed);p.removeListener?.("chainChanged",changed);}};
  },[provider,wallets,me,logout]);
  const act=async(task:()=>Promise<void>)=>{setBusy(true);setError("");setMessage("");try{await task();}catch(e){setError(errorText(e));}finally{setBusy(false);}};
  const requireProvider=()=>{if(!provider)throw new Error("请先连接钱包");return provider;};
  const refresh=async(wallet=me?.wallet)=>{if(!wallet) return;const generation=epoch.current;const next=await readIdentity(wallet);if(generation===epoch.current)setMe(next);};
  const connect=()=>act(async()=>{
    const selected=wallets.find(w=>w.id===walletId)||wallets[0];
    if(!selected) throw new Error("未检测到浏览器钱包。请在安装钱包扩展的浏览器中打开此页面，或使用钱包内置浏览器。");
    const wallet=await connectWallet(selected.provider);setProvider(selected.provider);await refresh(wallet);setMessage("钱包已连接，欢迎来到 RoxMate。");
  });
  const changePage=(next:Page)=>{setPage(next);setError("");setMessage("");setAthlete(null);setDetail(null);if(next==="partners")void act(async()=>{setLinks(await readConnections(me!.wallet));});};
  const openAthlete=(wallet:string)=>act(async()=>{setAthlete(await readAthlete(me!.wallet,wallet));setDetail(null);});
  const openResult=(id:string)=>act(async()=>{setDetail(await readResultDetail(me!.wallet,id));});
  if(!ready) return <LoadingPage/>;
  if(!me) return <main className="login-shell">
    <div className="scanlines"/><header className="login-topbar"><BrandLockup/><div className="network-pill">MONAD TESTNET · 10143</div></header>
    <section className="login-hero"><div className="hero-copy"><p className="eyebrow">YOUR OWN RECORD. YOUR NEXT PARTNER.</p><h1>FIND YOUR<br/><span>STRONGER</span> PAIR<span className="cursor">_</span></h1><p className="hero-sub">记录每一场比赛，建立你的运动身份。<br/>用真实的个人成绩，找到合拍的搭档。</p>
      {wallets.length>1&&<label className="wallet-select">选择钱包<select value={walletId||wallets[0]?.id} onChange={e=>setWalletId(e.target.value)}>{wallets.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>}
      <button className="primary-button large" onClick={connect} disabled={busy}>{busy?"正在连接钱包…":"连接钱包 ↗"}</button>
      <p className="microcopy">钱包地址即运动身份 · 写入链上时才需要签名并支付 Gas</p><NoticeStack error={error} message={message}/>
      {!wallets.length&&<p className="helper">尚未检测到钱包。请使用带钱包扩展的浏览器，或钱包内置浏览器打开本站。</p>}
    </div><div className="hero-graphic" aria-hidden="true"><div className="orbit orbit-a"/><div className="orbit orbit-b"/><div className="core-number">YOU<span>/ NEXT PB</span></div><div className="graphic-label label-bottom">RECORD / CONNECT / GROW</div></div></section>
    <footer className="login-footer"><span>ROXMATE / PERSONAL RECORDS</span><span>个人成绩 · AI 匹配 · 搭档评价</span></footer>
  </main>;
  const transact=async(functionName:string,args:readonly unknown[])=>sendRegistryTransaction(requireProvider(),me.wallet,functionName,args);
  const readWallet=async(functionName:string,args:readonly unknown[])=>{const active= requireProvider();await assertWalletContext(active,me.wallet);return readRegistry(active,functionName,args);};
  const respondPartner=(connection:Connection,accept:boolean)=>act(async()=>{const status=Number(await readWallet("getConnection",[connection.requester,me.wallet]));if(status!==1)throw new Error(accept?(status===2?"邀请已经接受，请刷新搭档页面。":status===3?"这条邀请已被拒绝，可重新发起邀请。":"这条邀请已不存在，或邀请方地址不匹配。请刷新搭档页面。"):"这条邀请状态已变化，请刷新搭档页面。");await transact("respondPartner",[connection.requester,accept]);setLinks(current=>current.map(value=>value.id===connection.id?{...value,status:accept?"ACCEPTED":"DECLINED"}:value));if(accept)setMessage("已成为搭档，可以查看并评价彼此成绩。");});
  const invitePartner=(wallet:string)=>act(async()=>{await transact("invitePartner",[wallet]);setMessage("搭档邀请已上链发送。");});
  const submitReview=(value:"GOOD"|"BAD",comment:string)=>act(async()=>{if(!detail)return;await transact("ratePersonalResult",[detail.record.id,value==="GOOD"?1:2,comment]);setDetail(current=>current?{...current,canReview:false,reviews:[...current.reviews,{id:`${detail.record.id}-${me.wallet}`,result_id:detail.record.id,rater:me.wallet,value,comment,display_name:me.profile?.display_name||me.wallet,created_at:new Date().toISOString()}]}:null);setMessage("评价已上链保存，每项成绩只能评价一次。");});
  return <main className="app-shell personal-app"><header className="app-topbar"><BrandLockup/><div className="topbar-right"><span className="network-pill">钱包已连接</span><button className="wallet-button" onClick={()=>void act(logout)} disabled={busy}>{shortWallet(me.wallet)} · 退出</button></div></header>
    <div className="app-frame"><aside className="sidebar"><div className="side-index">YOUR PERSONAL BEST</div><nav>{([ ["identity","身份卡","IDENTITY"],["record","我的成绩","RESULTS"],["matches","AI 找搭子","MATCH"],["partners","我的搭档","PARTNERS"] ] as const).map(([id,label,en],i)=><button key={id} className={`nav-item ${page===id?"active":""}`} disabled={busy||(!me.profile&&id!=="identity")} onClick={()=>changePage(id)}><span>0{i+1}</span><b>{label}</b><em>{en}</em></button>)}</nav><div className="sidebar-bottom"><div className="side-status">● WALLET VERIFIED</div><p className="helper">一张身份卡，记录每一次进步。</p></div></aside>
    <section className="content"><div className="content-heading"><div><p className="eyebrow">ROXMATE / {page.toUpperCase()}</p><h2>{{identity:"我的运动身份",record:"记录你的每场比赛",matches:"找到合拍的搭档",partners:"一起进步的人"}[page]}</h2></div><span className="helper">个人自报成绩 · 平台保存</span></div><NoticeStack error={error} message={message}/>
    {(!me.profile||editingProfile)&&<ProfileEditor initial={me.profile} wallet={me.wallet} busy={busy} cancel={me.profile?()=>setEditingProfile(false):undefined} onSave={values=>act(async()=>{await transact("updateProfile",[values.display_name,values.city,values.bio,values.discoverable,values.ai_consent]);setMe(current=>current?{...current,profile:values}:current);setEditingProfile(false);setMatch(null);setMessage("身份卡已上链保存。");})}/>}
    {me.profile&&!editingProfile&&<>
      {page==="identity"&&<><div className="personal-identity-grid"><section className="panel neon-border profile-card"><div className="card-top"><span className="card-label">YOUR ATHLETE ID</span><span className="lime">钱包已验证 ✓</span></div><div className="initial-avatar">{me.profile.display_name.slice(0,2).toUpperCase()}</div><h3>{me.profile.display_name}</h3><p>{me.profile.city}</p><p className="helper">{me.profile.bio||"每一次完成，都是你的履历。"}</p><code>{shortWallet(me.wallet)}</code><div className="card-actions"><button className="secondary-button" onClick={()=>setEditingProfile(true)}>编辑身份卡</button><span className="helper">{me.profile.discoverable?"已开启搭档推荐":"仅自己与已建立关系的搭档可见"}</span></div></section>
      <section className="panel metric-panel"><div className="panel-kicker">YOUR PROGRESS</div><div className="metrics"><div><strong>{me.stats.published}</strong><span>已发布比赛</span></div><div><strong>{me.stats.drafts}</strong><span>草稿</span></div><div><strong className="lime">{me.stats.good}</strong><span>GOOD 评价</span></div><div><strong>{me.stats.bad}</strong><span>BAD 评价</span></div></div><p className="helper">履历包含你提交的多场比赛。自报成绩与搭档评价均保存在平台，尚不代表官方认证或链上确认。</p><button className="primary-button" onClick={()=>{setDraft(undefined);setRecordKey(k=>k+1);changePage("record");}}>+ 记录一场比赛</button></section></div>
      <ResultsList title="比赛履历" records={me.records} own onOpen={openResult} onEdit={r=>{setDraft(r);setRecordKey(k=>k+1);changePage("record");}}/></>}
      {page==="record"&&<><div className="section-heading"><p className="helper">每场比赛单独保存；发布交易由钱包确认并支付 Gas，发布后不能覆盖修改。</p><button className="text-button" disabled={busy} onClick={()=>{setDraft(undefined);setRecordKey(k=>k+1);}}>+ 新建成绩</button></div><ResultEditor key={recordKey} initial={draft} busy={busy} onSave={(body)=>act(async()=>{if(body.status==="DRAFT"){localStorage.setItem(draftStorageKey(me.wallet),JSON.stringify(body));setMessage("草稿已保存在当前浏览器。");return;}const p=body.payload;const id=personalResultId(p,me.wallet);await transact("publishPersonalResult",[{resultId:id,...personalResultInput(p)}]);localStorage.removeItem(draftStorageKey(me.wallet));const saved={id,owner:me.wallet,payload:p,status:"PUBLISHED" as const,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),good:0,bad:0};setMe(current=>current?{...current,records:[saved,...current.records],stats:{...current.stats,published:current.stats.published+1}}:current);setDraft(undefined);setRecordKey(k=>k+1);setPage("identity");setMessage("比赛成绩已上链发布。");})}/></>}
      {page==="matches"&&<><section className="panel match-welcome"><div><span className="panel-kicker">PERFORMANCE-BASED MATCHING</span><h3>你的优势，遇见他的强项。</h3><p className="helper">每次最多读取 10 位公开候选人，并使用每人最近最多 5 场成绩，只比较同组别、同工作量项目。</p></div><button className="primary-button" disabled={busy} onClick={()=>void act(async()=>{const basic=await findMatches(me.wallet);if(!me.profile?.ai_consent){setMatch(basic);return;}try{setMatch(await requestAi(basic));}catch{setMatch(basic);setMessage("AI 暂不可用，已展示链上基础匹配结果。");}})}>{busy?"正在分析…":match?"重新匹配 ↗":"开始匹配 ↗"}</button></section>
      {match&&<><div className="notice" role="status"><b>{match.mode==="AI"?"AI 分析":"基础匹配"}</b> · {match.notice}</div><div className="personal-match-list">{match.matches.map(m=><article className="panel personal-match-card" key={m.profile.wallet}><div className="candidate-avatar">{m.profile.display_name.slice(0,2)}</div><div><h3>{m.profile.display_name}</h3><p className="helper">{m.profile.city} · {m.publishedCount} 场已发布比赛</p><ul className="match-reasons">{m.reasons.map(r=><li key={r}>{r}</li>)}</ul>{m.aiReason&&<p className="ai-reason">AI 分析：{m.aiReason}</p>}</div><div className="match-score"><strong>{m.score}</strong><small>基础匹配分</small></div><button className="secondary-button" disabled={busy} onClick={()=>openAthlete(m.profile.wallet)}>查看身份与成绩 ↗</button></article>)}</div></>}
      {!match&&<div className="empty-state">点击“开始匹配”，查找真实用户。没有符合条件的用户时会显示空结果。</div>}</>}
      {page==="partners"&&<><p className="helper">双方接受链上邀请后成为搭档，即可查看彼此已发布的成绩并评价。</p>{!links.length?<div className="empty-state">还没有搭档邀请。先去“AI 找搭子”查看身份卡并发出邀请。</div>:links.map(connection=><PartnerRow key={connection.id} connection={connection} viewer={me.wallet} busy={busy} onAccept={()=>void respondPartner(connection,true)} onDecline={()=>void respondPartner(connection,false)} onOpen={()=>openAthlete(connection.wallet)}/>)}</>}
      {athlete&&<section id="athlete-detail" className="panel detail-panel"><div className="section-heading"><h3>{athlete.profile.display_name} 的身份卡</h3><button className="text-button" onClick={()=>{setAthlete(null);setDetail(null);}}>关闭</button></div><p>{athlete.profile.city} · {athlete.profile.bio}</p>{!athlete.isPartner&&<button className="primary-button" disabled={busy} onClick={()=>void invitePartner(athlete.profile.wallet)}>邀请成为搭档</button>}<ResultsList title="已发布成绩" records={athlete.records} onOpen={openResult}/></section>}
      {detail&&<ResultDetail key={detail.record.id} detail={detail} busy={busy} onClose={()=>setDetail(null)} onReview={submitReview}/>} 
    </>}
    </section></div>
  </main>;
}
