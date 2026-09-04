"use client";
import { useState } from "react";
import { STATIONS, DIVISIONS, type Profile, type PersonalResult, type ResultPayload, type Review } from "../lib/personal-types";
export const duration=(value:number|null)=>value===null?"—":`${Math.floor(value/60)}:${String(value%60).padStart(2,"0")}`;
export type Detail={record:PersonalResult;reviews:Review[];canReview:boolean};
export function ProfileEditor({initial,wallet,busy,onSave,cancel}:{initial:Profile|null;wallet:string;busy:boolean;onSave:(value:Profile)=>Promise<void>;cancel?:()=>void}) {
  const [value,setValue]=useState<Profile>(initial||{wallet,display_name:"",city:"",bio:"",discoverable:false,ai_consent:false});
  return <form className="panel editor-panel" onSubmit={e=>{e.preventDefault();void onSave(value);}}><span className="panel-kicker">YOUR IDENTITY / 01</span><h3>{initial?"编辑身份卡":"创建你的第一张身份卡"}</h3><p className="helper">身份卡与你的钱包绑定。只保存公开的昵称、城市和介绍，不收集精确训练时间或联系方式。</p><div className="personal-form-grid"><label>昵称 *<input required maxLength={40} value={value.display_name} onChange={e=>setValue({...value,display_name:e.target.value})} placeholder="你希望搭档怎么称呼你"/></label><label>城市 *<input required maxLength={60} value={value.city} onChange={e=>setValue({...value,city:e.target.value})} placeholder="例如：上海"/></label><label>钱包地址<input value={wallet} readOnly/></label><label className="full-width">个人介绍<textarea maxLength={300} value={value.bio} onChange={e=>setValue({...value,bio:e.target.value})} placeholder="训练目标，或你希望找到什么样的搭档"/></label></div>
  <label className="check-label consent-label"><input type="checkbox" checked={value.discoverable} onChange={e=>setValue({...value,discoverable:e.target.checked})}/><span>允许被推荐给搭档<small>其他登录用户可以查看你的身份卡和已发布成绩；草稿仅自己可见。已建立关系的搭档仍可查看已发布成绩。</small></span></label>
  <label className="check-label consent-label"><input type="checkbox" checked={value.ai_consent} onChange={e=>setValue({...value,ai_consent:e.target.checked})}/><span>允许匿名成绩摘要用于 AI 匹配<small>仅将可比项目用时比例发送给平台配置的 AI 服务，不发送昵称、钱包、比赛名称、个人介绍或联系方式。</small></span></label>
  <div className="form-actions">{cancel&&<button type="button" className="secondary-button" onClick={cancel}>取消</button>}<button className="primary-button" disabled={busy}>{busy?"正在保存…":"保存身份卡 ↗"}</button></div></form>;
}

type ScoreInput={time:string;distance:string;load:string;reps:string};
function parseTime(value:string,name:string) {
  if(!value.trim()) return null;
  if(!/^\d{1,4}:[0-5]\d$/.test(value)) throw new Error(`${name}请使用 分:秒 格式，例如 02:18`);
  const [m,s]=value.split(":").map(Number);if(m*60+s<=0)throw new Error(`${name}必须大于 0`);return m*60+s;
}
function parseQuantity(value:string,name:string,max:number) {
  if(!value.trim()) return null;
  if(!/^\d+$/.test(value)) throw new Error(`${name}必须是正整数`);
  const parsed=Number(value);
  if(!Number.isSafeInteger(parsed)||parsed<1||parsed>max) throw new Error(`${name}超出可保存范围`);
  return parsed;
}
export function ResultEditor({initial,busy,onSave}:{initial?:PersonalResult;busy:boolean;onSave:(value:{status:string;payload:ResultPayload})=>Promise<void>}) {
  const [value,setValue]=useState<ResultPayload>(initial?.payload||{eventName:"",location:"",raceDate:"",division:"SINGLES_OPEN",totalSec:null,runPaceSec:null,scores:[]});
  const [total,setTotal]=useState(initial?.payload.totalSec?duration(initial.payload.totalSec):""),[pace,setPace]=useState(initial?.payload.runPaceSec?duration(initial.payload.runPaceSec):"");
  const [scores,setScores]=useState<Record<string,ScoreInput>>(Object.fromEntries(STATIONS.map(s=>{const v=initial?.payload.scores.find(x=>x.key===s.key);return [s.key,{time:v?duration(v.timeSec):"",distance:String(v?.distanceM??""),load:String(v?.loadKg??""),reps:String(v?.reps??"")}];})));
  const [localError,setLocalError]=useState("");
  const save=async(status:string)=>{
    setLocalError("");try{
      if(!value.raceDate) throw new Error("比赛日期不能为空");
      const raceTimestamp=Date.parse(`${value.raceDate}T00:00:00Z`);
      if(!Number.isFinite(raceTimestamp)) throw new Error("比赛日期格式不正确");
      if(raceTimestamp>Date.now()) throw new Error("比赛日期不能晚于今天");
      const parsed=STATIONS.flatMap(s=>{const row=scores[s.key],timeSec=parseTime(row.time,s.label);if(timeSec===null){if(row.distance||row.load||row.reps)throw new Error(`${s.label}已填工作量，请补充用时`);return[];}return [{key:s.key,timeSec,distanceM:parseQuantity(row.distance,`${s.label}距离`,0xffffffff),loadKg:parseQuantity(row.load,`${s.label}负重`,0xffff),reps:parseQuantity(row.reps,`${s.label}次数`,0xffff)}];});
      if(!parsed.length) throw new Error("至少填写一项个人项目成绩");
      await onSave({status,payload:{...value,totalSec:parseTime(total,"总用时"),runPaceSec:parseTime(pace,"跑步配速"),scores:parsed}});
    }catch(e){setLocalError(e instanceof Error?e.message:"保存失败，请重试");}
  };
  const field=(key:string,part:keyof ScoreInput,newValue:string)=>setScores({...scores,[key]:{...scores[key],[part]:newValue}});
  return <form className="panel editor-panel" onSubmit={e=>{e.preventDefault();void save("PUBLISHED");}}><div className="section-heading"><h3>{initial?"继续编辑草稿":"新建个人比赛成绩"}</h3><span className="status-chip">{initial?"已保存草稿":"新记录"}</span></div><p className="helper">只填写你本人承担的项目成绩；未记录的项目留空。工作量未知时留空，不参与项目能力比较。</p>{localError&&<div className="notice error" role="alert">{localError}</div>}
    <div className="personal-form-grid"><label>比赛名称 *<input required maxLength={120} value={value.eventName} onChange={e=>setValue({...value,eventName:e.target.value})}/></label><label>比赛地点 *<input required maxLength={160} value={value.location} onChange={e=>setValue({...value,location:e.target.value})}/></label><label>比赛日期 *<input required type="date" value={value.raceDate} onChange={e=>setValue({...value,raceDate:e.target.value})}/></label><label>比赛组别<select value={value.division} onChange={e=>{const division=e.target.value as ResultPayload["division"];if(DIVISIONS.includes(division))setValue({...value,division});}}>{DIVISIONS.map(d=><option key={d}>{d}</option>)}</select></label><label>比赛总用时（分:秒，可选）<input value={total} placeholder="72:46" onChange={e=>setTotal(e.target.value)}/></label><label>本人跑步配速（分:秒 / km，可选）<input value={pace} placeholder="05:12" onChange={e=>setPace(e.target.value)}/></label></div>
    <div className="station-input-list">{STATIONS.map((s,i)=><fieldset className="station-input-card" key={s.key}><legend><span className="lime">0{i+1}</span> {s.label}</legend><div className="station-fields"><label>本人用时（分:秒）<input aria-label={`${s.label} 本人用时`} value={scores[s.key].time} placeholder="02:18" onChange={e=>field(s.key,"time",e.target.value)}/></label><label>本人距离（m）<input type="number" min="1" step="1" aria-label={`${s.label} 本人距离`} value={scores[s.key].distance} placeholder="未知留空" onChange={e=>field(s.key,"distance",e.target.value)}/></label><label>使用负重（kg）<input type="number" min="1" step="1" aria-label={`${s.label} 使用负重`} value={scores[s.key].load} placeholder="无/未知留空" onChange={e=>field(s.key,"load",e.target.value)}/></label><label>本人完成次数<input type="number" min="1" step="1" aria-label={`${s.label} 本人完成次数`} value={scores[s.key].reps} placeholder="未知留空" onChange={e=>field(s.key,"reps",e.target.value)}/></label></div></fieldset>)}</div>
    <p className="helper">发布表示你确认这是本人的自报成绩。发布后不可修改；若开启搭档推荐，其他登录用户可查看并用于匹配。仅已接受邀请的搭档可以评价。</p><div className="form-actions"><button type="button" className="secondary-button" disabled={busy} onClick={()=>void save("DRAFT")}>保存草稿</button><button className="primary-button" disabled={busy}>{busy?"正在保存…":"发布比赛成绩 ↗"}</button></div></form>;
}
export function ResultsList({title,records,own,onOpen,onEdit}:{title:string;records:PersonalResult[];own?:boolean;onOpen:(id:string)=>void;onEdit?:(r:PersonalResult)=>void}) {
  return <section className="results-list"><div className="section-heading"><h3>{title}</h3><span className="helper">{records.length} 条记录</span></div>{!records.length?<div className="empty-state">还没有比赛记录，发布第一场成绩后将在这里展示。</div>:records.map(r=><article className="panel result-list-row" key={r.id}><div><span className={`record-badge ${r.status==='DRAFT'?"draft":""}`}>{r.status==='DRAFT'?"草稿 · 仅自己可见":"已发布 · 自报成绩"}</span><h4>{r.payload.eventName||"未命名草稿"}</h4><p className="helper">{r.payload.raceDate||"未填写日期"} · {r.payload.location||"未填写地点"} · {r.payload.division}</p><p className="helper">{r.payload.scores.length} 项个人成绩 · {r.good||0} GOOD / {r.bad||0} BAD</p></div><div className="result-row-end"><strong>{duration(r.payload.totalSec)}</strong>{own&&r.status==='DRAFT'?<button className="secondary-button" onClick={()=>onEdit?.(r)}>继续编辑</button>:<button className="secondary-button" onClick={()=>onOpen(r.id)}>查看成绩与评价</button>}</div></article>)}</section>;
}
export function ResultDetail({detail,busy,onClose,onReview}:{detail:Detail;busy:boolean;onClose:()=>void;onReview:(value:"GOOD"|"BAD",comment:string)=>Promise<void>}) {
  const [value,setValue]=useState<"GOOD"|"BAD">("GOOD"),[comment,setComment]=useState("");const r=detail.record;
  return <section id="result-detail" className="panel detail-panel" aria-label="成绩详情"><div className="section-heading"><h3>{r.payload.eventName}</h3><button className="text-button" onClick={onClose}>关闭详情</button></div><p className="helper">{r.payload.raceDate} · {r.payload.location} · {r.payload.division} · 自报成绩</p><div className="detail-scores">{r.payload.scores.map(s=><div key={s.key}><b>{STATIONS.find(x=>x.key===s.key)?.label}</b><strong className="lime">{duration(s.timeSec)}</strong><span className="helper">{s.distanceM?`${s.distanceM} m · `:""}{s.loadKg?`${s.loadKg} kg · `:""}{s.reps?`${s.reps} 次`:""}{!s.distanceM&&!s.reps?"工作量未知":""}</span></div>)}</div><h4>搭档评价（{detail.reviews.length}）</h4>{!detail.reviews.length&&<p className="helper">还没有评价。</p>}{detail.reviews.map(v=><div className="review-row" key={v.id}><b className={v.value==='GOOD'?"lime":"bad-text"}>{v.value}</b><span>{v.display_name}</span><p>{v.comment||"未填写补充说明"}</p></div>)}{detail.canReview?<form onSubmit={e=>{e.preventDefault();void onReview(value,comment);}}><p className="helper">你们已成为搭档，可以评价这条成绩。每人每条成绩一次，提交后不能修改。</p><div className="choice-grid"><label className="check-label"><input type="radio" name="rating" checked={value==='GOOD'} onChange={()=>setValue("GOOD")}/>GOOD</label><label className="check-label"><input type="radio" name="rating" checked={value==='BAD'} onChange={()=>setValue("BAD")}/>BAD</label></div><label className="review-comment">补充说明（可选）<textarea maxLength={500} value={comment} onChange={e=>setComment(e.target.value)}/></label><button className="primary-button" disabled={busy}>提交评价</button></form>:<p className="helper">仅已接受邀请的搭档可评价；不能评价自己，也不能重复评价。</p>}</section>;
}
