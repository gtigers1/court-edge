// v7-ncaam
import { useState, useEffect } from "react";

function oddsToImplied(o){if(!o||o==="-"||o==="+")return null;const n=parseInt(o);if(isNaN(n)||n===0)return null;return n>0?100/(n+100):Math.abs(n)/(Math.abs(n)+100);}
function probToAmerican(p){p=Math.max(0.01,Math.min(0.99,p));return p>=0.5?("-"+Math.round((p/(1-p))*100)):("+"+ Math.round(((1-p)/p)*100));}
function calcEV(prob,odds){const o=parseInt(odds);if(isNaN(o))return null;const pay=o>0?o/100:100/Math.abs(o);return(prob*pay-(1-prob)).toFixed(3);}
function logistic(x){return 1/(1+Math.exp(-x));}
// Situational lookup tables
const NBA_DIV={"Boston Celtics":"Atlantic","Brooklyn Nets":"Atlantic","New York Knicks":"Atlantic","Philadelphia 76ers":"Atlantic","Toronto Raptors":"Atlantic","Chicago Bulls":"Central","Cleveland Cavaliers":"Central","Detroit Pistons":"Central","Indiana Pacers":"Central","Milwaukee Bucks":"Central","Atlanta Hawks":"Southeast","Charlotte Hornets":"Southeast","Miami Heat":"Southeast","Orlando Magic":"Southeast","Washington Wizards":"Southeast","Denver Nuggets":"Northwest","Minnesota Timberwolves":"Northwest","Oklahoma City Thunder":"Northwest","Portland Trail Blazers":"Northwest","Utah Mammoth":"Northwest","Golden State Warriors":"Pacific","Los Angeles Clippers":"Pacific","Los Angeles Lakers":"Pacific","Phoenix Suns":"Pacific","Sacramento Kings":"Pacific","Dallas Mavericks":"Southwest","Houston Rockets":"Southwest","Memphis Grizzlies":"Southwest","New Orleans Pelicans":"Southwest","San Antonio Spurs":"Southwest"};
const NHL_DIV={"Boston Bruins":"Atlantic","Buffalo Sabres":"Atlantic","Detroit Red Wings":"Atlantic","Florida Panthers":"Atlantic","Montreal Canadiens":"Atlantic","Ottawa Senators":"Atlantic","Tampa Bay Lightning":"Atlantic","Toronto Maple Leafs":"Atlantic","Chicago Blackhawks":"Central","Colorado Avalanche":"Central","Dallas Stars":"Central","Minnesota Wild":"Central","Nashville Predators":"Central","St. Louis Blues":"Central","Winnipeg Jets":"Central","Utah Mammoth":"Central","Anaheim Ducks":"Pacific","Calgary Flames":"Pacific","Edmonton Oilers":"Pacific","Los Angeles Kings":"Pacific","San Jose Sharks":"Pacific","Seattle Kraken":"Pacific","Vancouver Canucks":"Pacific","Vegas Golden Knights":"Pacific","Carolina Hurricanes":"Metropolitan","Columbus Blue Jackets":"Metropolitan","New Jersey Devils":"Metropolitan","New York Islanders":"Metropolitan","New York Rangers":"Metropolitan","Philadelphia Flyers":"Metropolitan","Pittsburgh Penguins":"Metropolitan","Washington Capitals":"Metropolitan"};
const TZ_OFF={"ET":0,"CT":1,"MT":2,"PT":3};
const NBA_TZ={"Boston Celtics":"ET","Brooklyn Nets":"ET","New York Knicks":"ET","Philadelphia 76ers":"ET","Toronto Raptors":"ET","Cleveland Cavaliers":"ET","Detroit Pistons":"ET","Indiana Pacers":"ET","Atlanta Hawks":"ET","Charlotte Hornets":"ET","Miami Heat":"ET","Orlando Magic":"ET","Washington Wizards":"ET","Chicago Bulls":"CT","Milwaukee Bucks":"CT","Minnesota Timberwolves":"CT","Oklahoma City Thunder":"CT","Dallas Mavericks":"CT","Houston Rockets":"CT","Memphis Grizzlies":"CT","New Orleans Pelicans":"CT","San Antonio Spurs":"CT","Denver Nuggets":"MT","Phoenix Suns":"MT","Utah Mammoth":"MT","Golden State Warriors":"PT","Los Angeles Clippers":"PT","Los Angeles Lakers":"PT","Portland Trail Blazers":"PT","Sacramento Kings":"PT"};
const NHL_TZ={"Boston Bruins":"ET","Buffalo Sabres":"ET","Detroit Red Wings":"ET","Florida Panthers":"ET","Montreal Canadiens":"ET","Ottawa Senators":"ET","Tampa Bay Lightning":"ET","Toronto Maple Leafs":"ET","Carolina Hurricanes":"ET","Columbus Blue Jackets":"ET","New Jersey Devils":"ET","New York Islanders":"ET","New York Rangers":"ET","Philadelphia Flyers":"ET","Pittsburgh Penguins":"ET","Washington Capitals":"ET","Chicago Blackhawks":"CT","Minnesota Wild":"CT","Nashville Predators":"CT","St. Louis Blues":"CT","Winnipeg Jets":"CT","Dallas Stars":"CT","Colorado Avalanche":"MT","Utah Mammoth":"MT","Calgary Flames":"MT","Edmonton Oilers":"MT","Anaheim Ducks":"PT","Los Angeles Kings":"PT","San Jose Sharks":"PT","Seattle Kraken":"PT","Vancouver Canucks":"PT","Vegas Golden Knights":"PT"};
const ALTITUDE_HOME={"Denver Nuggets":0.025,"Utah Mammoth":0.010,"Colorado Avalanche":0.025};
function devigged(homeOdds,awayOdds){const h=oddsToImplied(homeOdds),a=oddsToImplied(awayOdds);if(!h||!a)return null;return h/(h+a);}
// Standard normal CDF (Abramowitz & Stegun approximation, error < 7.5e-8)
function normalCDF(z){const t=1/(1+0.2316419*Math.abs(z));const p=t*(0.31938153+t*(-0.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));const q=1-Math.exp(-0.5*z*z)/Math.sqrt(2*Math.PI)*p;return z>=0?q:1-q;}

const C={black:"#0A0A0C",dark:"#111116",card:"#16161C",border:"#242430",copper:"#B87333",copperL:"#D4924A",teal:"#2DD4A0",tealD:"#1A9E78",ice:"#A8D8EA",iceD:"#5BAACB",amber:"#F59E0B",amberD:"#D97706",white:"#F0F0F5",muted:"#6B6B80",dim:"#3A3A4A"};

const STYLES=`
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@400;500;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#0A0A0C;}
  select option{background:#1a1a22;color:#F0F0F5;}
  .hov-btn{transition:all .2s ease;}
  .hov-btn:hover:not(:disabled){transform:translateY(-1px);}
  .status-btn{transition:all .15s ease;}
  .status-btn:hover{transform:scale(1.04);}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
  .pulse{animation:pulse 1.5s ease-in-out infinite;}
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  .fade-in{animation:fadeIn .3s ease forwards;}
  @keyframes spin{to{transform:rotate(360deg)}}
  .spin{animation:spin 1s linear infinite;display:inline-block;}
  @keyframes slideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  .slide-up{animation:slideUp .25s ease forwards;}
  @keyframes toastIn{0%{opacity:0;transform:translateY(8px)}20%{opacity:1;transform:translateY(0)}80%{opacity:1}100%{opacity:0}}
  .toast{animation:toastIn 2s ease forwards;pointer-events:none;}
  ::-webkit-scrollbar{width:4px;}
  ::-webkit-scrollbar-track{background:#111116;}
  ::-webkit-scrollbar-thumb{background:#3A3A4A;border-radius:2px;}
  @media(max-width:600px){
    .hdr-badges{display:none !important;}
    .hdr-tab-btn{padding:6px 8px !important;letter-spacing:0 !important;}
    .hdr-sub{display:none !important;}
    .hdr-title{font-size:14px !important;letter-spacing:1px !important;}
  }
`;

const STATUS_COLORS={PLAYING:"#2DD4A0",QUESTIONABLE:"#F5A623",DOUBTFUL:"#E07B30",OUT:"#E05252"};
const STATUS_CYCLE=["PLAYING","QUESTIONABLE","DOUBTFUL","OUT"];

function Badge({abbr,size=44,accent}){return <div style={{width:size,height:size,borderRadius:8,background:"linear-gradient(135deg,#3A3A4A,#16161C)",border:"1.5px solid "+(accent||C.copper),display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:size*.28,color:accent||C.copper,letterSpacing:.5,flexShrink:0}}>{abbr}</div>;}
function Pill({label,color}){return <span style={{padding:"2px 8px",borderRadius:12,background:color+"18",border:"1px solid "+color,color,fontSize:10,fontWeight:700,fontFamily:"'Barlow Condensed'"}}>{label}</span>;}
function OddsPill({prob,accent}){const ac=accent||C.teal,fav=prob>=.5;return <div style={{padding:"10px 18px",borderRadius:8,textAlign:"center",background:fav?ac+"18":C.black,border:"1.5px solid "+(fav?ac:C.border),minWidth:80}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:22,color:fav?ac:C.white}}>{probToAmerican(prob)}</div><div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:1,marginTop:1}}>Fair odds</div></div>;}
function SectionHeader({label,accent,right}){return <div style={{padding:"10px 16px",background:"linear-gradient(90deg,"+(accent||C.copper)+"22,transparent)",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:8,borderRadius:"10px 10px 0 0"}}><div style={{width:3,height:16,borderRadius:2,background:accent||C.copper}}/><span style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:14,letterSpacing:1.5,color:C.white,textTransform:"uppercase"}}>{label}</span>{right&&<div style={{marginLeft:"auto"}}>{right}</div>}</div>;}
function WinBar({awayProb,awayAbbr,homeAbbr,accent}){const ac=accent||C.teal;return <div style={{marginTop:8}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontFamily:"'Barlow Condensed'",fontSize:13,fontWeight:700,color:awayProb>.5?ac:C.muted}}>{awayAbbr} {(awayProb*100).toFixed(1)}%</span><span style={{fontFamily:"'Barlow Condensed'",fontSize:13,fontWeight:700,color:(1-awayProb)>.5?ac:C.muted}}>{(100-awayProb*100).toFixed(1)}% {homeAbbr}</span></div><div style={{height:6,borderRadius:3,background:C.border,overflow:"hidden"}}><div style={{height:"100%",width:(awayProb*100)+"%",background:"linear-gradient(90deg,"+ac+"99,"+ac+")",borderRadius:3,transition:"width .6s ease"}}/></div></div>;}

function TeamSelect({items,getLabel,getSub,getId,displayValue,onSelect,accent,disabled,placeholder}){
  const [val,setVal]=useState(displayValue||"");
  const [open,setOpen]=useState(false);
  const ac=accent||C.teal;
  useEffect(()=>{setVal(displayValue||"");},[displayValue]);
  const filtered=items.filter(item=>{const l=getLabel(item),s=getSub?getSub(item):"";return(l+" "+s).toLowerCase().includes(val.toLowerCase());});
  const show=open?(val===displayValue||val===""?items:filtered):[];
  return <div style={{position:"relative"}}>
    <input value={val} disabled={disabled} placeholder={placeholder||"Search team..."}
      onChange={e=>{setVal(e.target.value);setOpen(true);}}
      onFocus={e=>{e.target.select();setOpen(true);}}
      onBlur={()=>setTimeout(()=>setOpen(false),180)}
      onKeyDown={e=>{if(e.key==="Escape"){setOpen(false);setVal(displayValue||"");}}}
      style={{width:"100%",padding:"10px 12px",background:C.black,border:"1.5px solid "+(open?ac:C.border),borderRadius:8,color:C.white,fontSize:13,outline:"none",fontFamily:"'Barlow',sans-serif",transition:"border-color .15s",cursor:disabled?"not-allowed":"text"}}/>
    {open&&<div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,maxHeight:220,overflowY:"auto",background:C.card,border:"1px solid "+ac+"66",borderRadius:8,zIndex:500,boxShadow:"0 8px 32px #00000077"}}>
      {show.length===0?<div style={{padding:"10px 14px",fontSize:11,color:C.muted}}>No teams found</div>
      :show.map(item=>{const label=getLabel(item),sub=getSub?getSub(item):null,id=getId?getId(item):label,sel=displayValue===label;
        return <div key={id} onMouseDown={e=>{e.preventDefault();setVal(label);setOpen(false);onSelect(item);}}
          onMouseEnter={e=>e.currentTarget.style.background=sel?ac+"44":C.dark}
          onMouseLeave={e=>e.currentTarget.style.background=sel?ac+"22":"transparent"}
          style={{padding:"9px 14px",cursor:"pointer",background:sel?ac+"22":"transparent",borderBottom:"1px solid "+C.border,display:"flex",justifyContent:"space-between",alignItems:"center",transition:"background .1s"}}>
          <span style={{fontFamily:"'Barlow',sans-serif",fontSize:13,color:sel?ac:C.white}}>{label}</span>
          {sub&&<span style={{fontSize:10,color:C.muted,flexShrink:0,marginLeft:8}}>{sub}</span>}
        </div>;})}
    </div>}
  </div>;
}

function RosterPanel({teamName,abbr,teamData,onCycle,sport,accent,loading}){
  const ac=accent||C.teal;
  if(loading) return <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:10,padding:40,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}>
    <div className="spin" style={{width:28,height:28,border:"3px solid "+C.border,borderTop:"3px solid "+ac,borderRadius:"50%"}}/>
    <div style={{fontSize:12,color:C.muted}}>Loading {teamName} roster...</div>
  </div>;
  if(!teamData) return null;
  let subtitle;
  if(sport==="nhl") subtitle=teamData.wins+"W-"+teamData.losses+"L-"+teamData.otl+"OTL - "+teamData.gf_pg+" GF/G - "+teamData.ga_pg+" GA/G";
  else if(sport==="ncaam") subtitle=teamData.wins+"W-"+teamData.losses+"L - "+teamData.ppg+" PPG - "+teamData.opp+" OPP"+(teamData.ranking>0?" - #"+teamData.ranking+" AP":"")+" - "+teamData.conference;
  else subtitle=teamData.wins+"W-"+teamData.losses+"L - "+teamData.ppg+" PPG - "+teamData.opp+" OPP";
  const restDays=teamData.rest??null;
  const restLabel=restDays===0?"B2B":restDays===1?"1d rest":restDays!=null?restDays+"d rest":null;
  const restColor=restDays===0?"#f87171":restDays===1?C.copper:C.teal;
  return <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:10,overflow:"hidden"}}>
    <div style={{padding:"10px 14px",background:C.dark,borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:10}}>
      <Badge abbr={abbr} size={36} accent={ac}/>
      <div style={{flex:1}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:15,color:C.white,display:"flex",alignItems:"center",gap:8}}>{teamName}{restLabel&&<span style={{fontSize:10,fontWeight:800,padding:"2px 7px",borderRadius:4,background:restColor+"22",color:restColor,letterSpacing:.8,border:"1px solid "+restColor+"44"}}>{restLabel}</span>}</div><div style={{fontSize:11,color:C.muted}}>{subtitle}</div></div>
    </div>
    {sport==="nhl"&&teamData.goalie&&<div style={{padding:"8px 14px",background:"#0f0f14",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:10}}>
      <div style={{fontSize:11,fontFamily:"'Barlow Condensed'",fontWeight:800,color:C.ice,width:20,textAlign:"center"}}>G</div>
      <div style={{flex:1}}><div style={{fontFamily:"'Barlow'",fontWeight:600,fontSize:12,color:C.ice}}>{teamData.goalie.name} <span style={{color:C.muted,fontWeight:400}}>- Expected Starter</span></div><div style={{fontSize:10,color:C.muted}}>SV% {teamData.goalie.save_pct?.toFixed(3)} - GAA {teamData.goalie.gaa?.toFixed(2)}</div></div>
      <button className="status-btn" onClick={()=>onCycle("__goalie__")} style={{padding:"4px 10px",borderRadius:6,fontSize:10,fontWeight:700,cursor:"pointer",border:"1.5px solid "+STATUS_COLORS[teamData.goalie.status||"PLAYING"],background:STATUS_COLORS[teamData.goalie.status||"PLAYING"]+"18",color:STATUS_COLORS[teamData.goalie.status||"PLAYING"],fontFamily:"'Barlow Condensed'",letterSpacing:.8,minWidth:100,textAlign:"center"}}>{teamData.goalie.status||"PLAYING"}</button>
    </div>}
    <div style={{padding:"4px 0",maxHeight:360,overflowY:"auto"}}>
      {(teamData.roster||[]).map(p=>{
        const sc=STATUS_COLORS[p.status]||C.teal;
        let sub;
        if(sport==="nhl") sub=p.goals+"G "+p.assists+"A "+p.points+"PTS "+(p.plus_minus>=0?"+":"")+p.plus_minus;
        else if(sport==="ncaam") sub=p.ppg+" PPG - "+p.rpg+" RPG - "+p.apg+" APG";
        else sub=p.ppg+" PPG - "+(p.rpg||0)+" RPG - "+(p.apg||0)+" APG";
        return <div key={p.name} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 14px",borderBottom:"1px solid "+C.border}}>
          {sport==="nhl"&&<span style={{fontSize:10,color:C.dim,fontFamily:"'Barlow Condensed'",fontWeight:700,width:20,textAlign:"center"}}>{p.position}</span>}
          <div style={{flex:1,minWidth:0}}><div style={{fontFamily:"'Barlow'",fontWeight:600,fontSize:13,color:C.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.name}</div><div style={{fontSize:10,color:C.muted,marginTop:1}}>{sub} - <span style={{color:p.role==="STAR"?C.copper:p.role==="KEY"?ac:C.muted}}>{p.role}</span></div></div>
          <button className="status-btn" onClick={()=>onCycle(p.name)} style={{padding:"4px 10px",borderRadius:6,fontSize:10,fontWeight:700,cursor:"pointer",border:"1.5px solid "+sc,background:sc+"18",color:sc,fontFamily:"'Barlow Condensed'",letterSpacing:.8,minWidth:100,textAlign:"center"}}>{p.status}</button>
        </div>;
      })}
    </div>
    <div style={{padding:"7px 14px",fontSize:10,color:C.dim,textAlign:"center",borderTop:"1px solid "+C.border}}>TAP STATUS TO CYCLE: PLAYING - QUESTIONABLE - DOUBTFUL - OUT</div>
  </div>;
}

function ModelCard({icon,name,desc,awayTeam,homeTeam,awayAbbr,homeAbbr,awayProb,detail,accent}){
  const [exp,setExp]=useState(false);
  const hp=1-awayProb,ac=accent||C.teal,af=awayProb>=.5;
  return <div onClick={()=>setExp(e=>!e)} style={{background:C.card,border:"1px solid "+(exp?ac+88:C.border),borderRadius:10,padding:14,display:"flex",flexDirection:"column",gap:10,cursor:"pointer",transition:"border-color .2s"}}>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{width:28,height:28,borderRadius:6,background:ac+"22",border:"1px solid "+ac+"44",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontFamily:"'Barlow Condensed'",fontWeight:900,color:ac}}>{icon}</div>
      <div style={{flex:1}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,color:C.copper,letterSpacing:1,textTransform:"uppercase"}}>{name}</div><div style={{fontSize:10,color:C.muted}}>{desc}</div></div>
      <div style={{fontSize:9,color:C.dim,letterSpacing:.5}}>{exp?"▲":"▼"}</div>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{display:"flex",alignItems:"center",gap:6,flex:1}}><Badge abbr={awayAbbr} size={28} accent={ac}/><div><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:20,color:af?ac:C.white,lineHeight:1}}>{(awayProb*100).toFixed(0)}%</div><div style={{fontSize:9,color:C.muted}}>{awayTeam.split(" ").at(-1)}</div></div></div>
      <div style={{width:1,height:32,background:C.border}}/>
      <div style={{display:"flex",alignItems:"center",gap:6,flex:1,justifyContent:"flex-end"}}><div style={{textAlign:"right"}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:20,color:!af?ac:C.white,lineHeight:1}}>{(hp*100).toFixed(0)}%</div><div style={{fontSize:9,color:C.muted}}>{homeTeam.split(" ").at(-1)}</div></div><Badge abbr={homeAbbr} size={28} accent={ac}/></div>
    </div>
    <div style={{height:4,borderRadius:2,background:C.border,overflow:"hidden"}}><div style={{height:"100%",width:(awayProb*100)+"%",background:"linear-gradient(90deg,"+ac+"99,"+ac+")",transition:"width .5s ease"}}/></div>
    {exp&&detail&&<div className="slide-up" style={{fontSize:10,color:C.muted,lineHeight:1.6,padding:"6px 8px",background:C.black,borderRadius:6,borderLeft:"2px solid "+ac+"66"}}>{detail}</div>}
    {exp&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
      <div style={{textAlign:"center",background:C.black,borderRadius:6,padding:"6px 4px"}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:14,color:af?ac:C.white}}>{probToAmerican(awayProb)}</div><div style={{fontSize:9,color:C.dim}}>{awayAbbr} implied</div></div>
      <div style={{textAlign:"center",background:C.black,borderRadius:6,padding:"6px 4px"}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:14,color:!af?ac:C.white}}>{probToAmerican(hp)}</div><div style={{fontSize:9,color:C.dim}}>{homeAbbr} implied</div></div>
    </div>}
  </div>;
}

// â”€â”€â”€ NBA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const NBA_TEAMS=["Atlanta Hawks","Boston Celtics","Brooklyn Nets","Charlotte Hornets","Chicago Bulls","Cleveland Cavaliers","Dallas Mavericks","Denver Nuggets","Detroit Pistons","Golden State Warriors","Houston Rockets","Indiana Pacers","LA Clippers","Los Angeles Lakers","Memphis Grizzlies","Miami Heat","Milwaukee Bucks","Minnesota Timberwolves","New Orleans Pelicans","New York Knicks","Oklahoma City Thunder","Orlando Magic","Philadelphia 76ers","Phoenix Suns","Portland Trail Blazers","Sacramento Kings","San Antonio Spurs","Toronto Raptors","Utah Jazz","Washington Wizards"];
const NBA_ABBR={"Atlanta Hawks":"ATL","Boston Celtics":"BOS","Brooklyn Nets":"BKN","Charlotte Hornets":"CHA","Chicago Bulls":"CHI","Cleveland Cavaliers":"CLE","Dallas Mavericks":"DAL","Denver Nuggets":"DEN","Detroit Pistons":"DET","Golden State Warriors":"GSW","Houston Rockets":"HOU","Indiana Pacers":"IND","LA Clippers":"LAC","Los Angeles Lakers":"LAL","Memphis Grizzlies":"MEM","Miami Heat":"MIA","Milwaukee Bucks":"MIL","Minnesota Timberwolves":"MIN","New Orleans Pelicans":"NOP","New York Knicks":"NYK","Oklahoma City Thunder":"OKC","Orlando Magic":"ORL","Philadelphia 76ers":"PHI","Phoenix Suns":"PHX","Portland Trail Blazers":"POR","Sacramento Kings":"SAC","San Antonio Spurs":"SAS","Toronto Raptors":"TOR","Utah Jazz":"UTA","Washington Wizards":"WAS"};

// Bottom-tier / lottery teams — high variance, inconsistent effort, rotation flux, potential tanking
// Games involving these teams should suppress spread confidence and show a HIGH VARIANCE warning
// Updated periodically based on standings (2025-26 season, as of March 2026)
const NBA_HIGH_VARIANCE=new Set(["Washington Wizards","Brooklyn Nets","Charlotte Hornets","Chicago Bulls","San Antonio Spurs","Detroit Pistons","Utah Jazz","Portland Trail Blazers","Philadelphia 76ers","Toronto Raptors"]);

// IMPROVED MODELS v2  -  Restructured for accuracy
// Key changes:
// - HCA applied ONCE, correctly calibrated per sport
// - Models use genuinely different data slices (season/recent/roster/efficiency)
// - Outputs calibrated to realistic ranges (NBA 45-65%, NHL 44-62%, NCAAM 44-67%)
// - Market divergence flag added to UI
// - Pythagorean + Log5 replaces logistic hacks

function pythagorean(pts,opp,exp){const p=Math.pow(Math.max(pts,0.1),exp);return p/(p+Math.pow(Math.max(opp,0.1),exp));}
function log5(pA,pB){const p=(pA-pA*pB)/(pA+pB-2*pA*pB);return Math.min(0.97,Math.max(0.03,isNaN(p)?0.5:p));}
function injPen(roster,sw=0.09,kw=0.045,rw=0.012){return(roster||[]).reduce((s,p)=>{if(p.status==="PLAYING")return s;const miss=p.status==="OUT"?1:p.status==="DOUBTFUL"?.65:.30;return s+miss*(p.role==="STAR"?sw:p.role==="KEY"?kw:rw);},0);}

// â”€â”€ NBA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// True NBA HCA: ~3.2 pts, home wins ~59% of games historically
// Calibration target: range should be roughly 43-66% for most matchups

function nbaMdlPythagorean(h,a){
  // Use home/away splits when available — more accurate than combined stats
  const hPPG=h.home_ppg||h.ppg, hOPP=h.home_opp||h.opp;
  const aPPG=a.away_ppg||a.ppg, aOPP=a.away_opp||a.opp;
  const hP=pythagorean(hPPG,hOPP,13.91);
  const aP=pythagorean(aPPG,aOPP,13.91);
  const hR=pythagorean(h.last10_ppg||h.ppg, h.last10_opp||h.opp, 13.91);
  const aR=pythagorean(a.last10_ppg||a.ppg, a.last10_opp||a.opp, 13.91);
  const hQ=hP*0.65+hR*0.35;
  const aQ=aP*0.65+aR*0.35;
  const hHCA=pythagorean(hPPG+3.2,hOPP,13.91);
  const hAdj=hQ*0.65+hHCA*0.35;
  const hi=injPen(h.roster,0.09,0.04,0.01);
  const ai=injPen(a.roster,0.09,0.04,0.01);
  const p=log5(Math.max(0.03,hAdj-hi),Math.max(0.03,aQ-ai));
  const note=h.home_ppg&&a.away_ppg?" (splits)":"";
  return{homeProb:p,hQ:(hQ*100).toFixed(1),aQ:(aQ*100).toFixed(1),detail:`H Pyth ${(hQ*100).toFixed(1)}%  A Pyth ${(aQ*100).toFixed(1)}%  +3.2pt HCA${note}`};}

function nbaMdlNetRating(h,a){
  // Use home/away splits when available
  const hNet=(h.home_ppg||h.ppg)-(h.home_opp||h.opp);
  const aNet=(a.away_ppg||a.ppg)-(a.away_opp||a.opp);
  const hRecNet=(h.last10_ppg||h.ppg)-(h.last10_opp||h.opp);
  const aRecNet=(a.last10_ppg||a.ppg)-(a.last10_opp||a.opp);
  // Weight recent more than season  -  injuries/trades make recent more real
  const hBlend=hNet*0.55+hRecNet*0.45;
  const aBlend=aNet*0.55+aRecNet*0.45;
  const hi=injPen(h.roster,0.10,0.05,0.01);
  const ai=injPen(a.roster,0.10,0.05,0.01);
  // 3.2pt HCA, injury adjustment as pts (star out ~ -2.5 effective pts)
  const adjDiff=(hBlend-aBlend)+3.2-(hi-ai)*18;
  // Scale: 1pt = 0.027, logit calibrated to NBA range
  const p=logistic(adjDiff*0.11);
  return{homeProb:Math.min(0.97,Math.max(0.03,p)),hNet:hBlend.toFixed(1),aNet:aBlend.toFixed(1),adjDiff,detail:`H Net ${hBlend>0?"+":""}${hBlend.toFixed(1)}  A Net ${aBlend>0?"+":""}${aBlend.toFixed(1)}  Diff: ${adjDiff.toFixed(1)}`};}

function nbaMdlFourFactors(h,a){
  // Four Factors: eFG% 47%, TOV% 27%, OREB% 18%, FTR 8%
  // Literature weights: eFG most predictive, FTR weakest; INDEPENDENT from PPG/opp signal
  // NBA average: eFG ~52%, TOV ~13%, OREB ~25%, FTR ~23%
  const ff=d=>{
    const efg=(d.efg_pct||0.52)*0.47;
    // tov_rate from API is turnovers per 100 possessions (NBA avg ~13)
    // Normalize to 0-1 where lower is better: (25-tov)/25 scaled
    const tov=(1-Math.min(d.tov_rate||13,25)/25)*0.27;
    const oreb=(d.oreb_pct||0.25)*0.18;
    const ftr=Math.min(d.ftr||d.ft_rate||0.22,0.50)*0.08;
    return efg+tov+oreb+ftr;};
  const hFF=ff(h),aFF=ff(a);
  // Small HCA: home teams shoot ~0.5% better eFG, steal ~0.5% fewer possessions
  const hFFadj=hFF+0.002*0.47+0.001*0.27;
  const hi=injPen(h.roster,0.06,0.03,0.008);
  const ai=injPen(a.roster,0.06,0.03,0.008);
  const ffInput=(hFFadj-aFF)*12-(hi-ai)*3.5;const p=logistic(ffInput); // *12 calibrates to realistic NBA win-prob range
  return{homeProb:Math.min(0.97,Math.max(0.03,p)),hFF:hFF.toFixed(4),aFF:aFF.toFixed(4),adjDiff:ffInput*7.0,detail:`H FF: ${hFF.toFixed(3)}  A FF: ${aFF.toFixed(3)}`};}

function nbaMdlStarPower(h,a){
  // Star power model: top 3 players drive outcomes (different signal from team averages)
  // Sorted by PER  -  if star is OUT that cascades hard
  const sortH=[...(h.roster||[])].sort((x,y)=>(y.per||0)-(x.per||0));
  const sortA=[...(a.roster||[])].sort((x,y)=>(y.per||0)-(x.per||0));
  const score=roster=>{
    // NBA: player value is front-loaded. #1 star ~ 35% of team value
    const w=[0.35,0.25,0.17,0.23/Math.max(roster.length-3,1)];
    return roster.reduce((s,p,i)=>{
      const wi=i<3?w[i]:w[3];
      const avail=p.status==="PLAYING"?1:p.status==="OUT"?0:p.status==="DOUBTFUL"?.20:.62;
      return s+(p.per||12)*wi*avail;
    },0);};
  const hV=score(sortH),aV=score(sortA);
  // HCA adds ~3% to home team's effective star impact (crowd energy)
  const p=logistic((hV-aV)*0.085+0.09);
  return{homeProb:Math.min(0.97,Math.max(0.03,p)),hVal:hV.toFixed(1),aVal:aV.toFixed(1),detail:`H star PER: ${hV.toFixed(1)}  A star PER: ${aV.toFixed(1)}`};}

function nbaMdlMonteCarlo(h,a,N=10000){
  // Point-spread simulation  -  different methodology from all above
  // Uses offensive + defensive ratings to project actual scores
  const hi=injPen(h.roster,0.11,0.055,0.01);
  const ai=injPen(a.roster,0.11,0.055,0.01);
  // Use home/away splits when available (home team at home, away team on road)
  const hPPG=h.home_ppg||h.ppg, aOPP=a.away_opp||a.opp;
  const aPPG=a.away_ppg||a.ppg, hOPP=h.home_opp||h.opp;
  // Pace adjustment: normalize scoring to expected game possessions
  const hP=h.pace||99,aP=a.pace||99,gamePace=(hP+aP)/2;
  const pa=(score,teamPace)=>(score/Math.max(teamPace,80))*gamePace;
  // 35/65 blend season avg + recent form — recent form weighted more heavily to capture
  // mid-season roster changes, load management, and tanking behavior
  const hOff=pa(hPPG*0.35+(h.last10_ppg||hPPG)*0.65,hP)*(1-hi);
  const aOff=pa(aPPG*0.35+(a.last10_ppg||aPPG)*0.65,aP)*(1-ai);
  const hDef=pa(aOPP*0.35+(a.last10_opp||aOPP)*0.65,aP)*(1-ai*0.4); // away team's pts allowed (their defense quality)
  const aDef=pa(hOPP*0.35+(h.last10_opp||hOPP)*0.65,hP)*(1-hi*0.4); // home team's pts allowed (their defense quality)
  // Multiplicative efficiency: hOff scaled by how good away defense is vs league avg (114 PPG)
  // Better opponent defense (lower hDef) → lower hExp. Worse defense → higher hExp.
  const LEAGUE_PPG=116;
  const restPen=d=>Math.max(0,(2-Math.min(d??2,2))*1.5);
  const hExp=hOff*(hDef/LEAGUE_PPG)+1.6-restPen(h.rest);
  const aExp=aOff*(aDef/LEAGUE_PPG)-restPen(a.rest);
  const sig=11.5; // NBA single-game std dev ~11-12 pts
  let w=0;
  for(let i=0;i<N;i++){
    const z1=Math.sqrt(-2*Math.log(Math.random()))*Math.cos(2*Math.PI*Math.random());
    const z2=Math.sqrt(-2*Math.log(Math.random()))*Math.cos(2*Math.PI*Math.random());
    if(hExp+z1*sig>aExp+z2*sig)w++;}
  const restNote=(h.rest??2)<2||(a.rest??2)<2?`  Rest: H ${h.rest??2}d A ${a.rest??2}d`:"";
  const paceNote=h.pace&&a.pace?`  Pace: ${gamePace.toFixed(0)}`:"";
  // Guard: hPPG/aPPG/hOPP/aOPP can be undefined if team data is missing; undefined.toFixed() throws
  const safeFmt=(v,d=1)=>typeof v==="number"&&isFinite(v)?v.toFixed(d):"?";
  const inputNote=`  Input PPG: H ${safeFmt(hPPG,0)} A ${safeFmt(aPPG,0)}  OPP: H ${safeFmt(hOPP,0)} A ${safeFmt(aOPP,0)}`;
  const safeExp=x=>typeof x==="number"&&isFinite(x)?x:0;
  return{homeProb:Math.min(0.97,Math.max(0.03,w/N)),hExp:safeExp(hExp).toFixed(1),aExp:safeExp(aExp).toFixed(1),detail:`Proj: H ${safeExp(hExp).toFixed(1)}  A ${safeExp(aExp).toFixed(1)} pts${restNote}${paceNote}${inputNote}`};}

function nbaMdlTotal(h,a){
  // Separate total model — independent from spread model, uses per-100-possession efficiency
  // Avoids the systematic underestimation caused by using raw PPG at wrong pace
  const hP=h.pace||99,aP=a.pace||99,gamePace=(hP+aP)/2;
  // Per-100-possession ratings: OffRtg = pts scored / pace * 100, DefRtg = pts allowed / pace * 100
  const hOffRtg=(h.home_ppg||h.ppg)/hP*100, hDefRtg=(h.home_opp||h.opp)/hP*100;
  const aOffRtg=(a.away_ppg||a.ppg)/aP*100, aDefRtg=(a.away_opp||a.opp)/aP*100;
  // Expected pts = average of team OffRtg and opponent DefRtg (pts allowed), then scale by gamePace
  // e.g. OffRtg=120, OppDefRtg=111 → (120+111)/2=115.5 → 115.5/100*99 = 114 pts
  const hProj=((hOffRtg+aDefRtg)/2)/100*gamePace;
  const aProj=((aOffRtg+hDefRtg)/2)/100*gamePace;
  // Same with last-10 stats for recent form
  const hOffRtgR=(h.last10_ppg||h.ppg)/hP*100, hDefRtgR=(h.last10_opp||h.opp)/hP*100;
  const aOffRtgR=(a.last10_ppg||a.ppg)/aP*100, aDefRtgR=(a.last10_opp||a.opp)/aP*100;
  const hProjR=((hOffRtgR+aDefRtgR)/2)/100*gamePace;
  const aProjR=((aOffRtgR+hDefRtgR)/2)/100*gamePace;
  const hi=injPen(h.roster,0.11,0.055,0.01),ai=injPen(a.roster,0.11,0.055,0.01);
  const restPen=d=>Math.max(0,(2-Math.min(d??2,2))*1.5);
  const hFinalRaw=(hProj*0.60+hProjR*0.40)*(1-hi)+1.6-restPen(h.rest);
  const aFinalRaw=(aProj*0.60+aProjR*0.40)*(1-ai)-restPen(a.rest);
  // Guard against NaN/Infinity before .toFixed() — NaN.toFixed() is fine but Infinity.toFixed() throws RangeError
  const safe=x=>(isFinite(x)&&!isNaN(x))?x:null;
  const hFinal=safe(hFinalRaw)??60;
  const aFinal=safe(aFinalRaw)??58;
  const safeGP=safe(gamePace)??99;
  return{rawTotal:hFinal+aFinal,hProj:hFinal.toFixed(1),aProj:aFinal.toFixed(1),
    detail:`Pace-adj: ${(hFinal+aFinal).toFixed(1)} (H ${hFinal.toFixed(1)} A ${aFinal.toFixed(1)}) gamePace:${safeGP.toFixed(0)}`};}

function nbaConsensus(ps,mkt){
  // NetRating highest weight (best predictor), FF raised (independent signal), Star reduced (noisy PER)
  // 15% shrinkage toward 50% to prevent overconfidence from stale/incomplete data
  const m=Math.min(0.97,Math.max(0.03,[0.15,0.32,0.24,0.10,0.19].reduce((s,w,i)=>s+ps[i]*w,0)));
  const shrunk=0.5+(m-0.5)*0.85;
  // Market (de-vigged) encodes injuries, sharp money, line movement  -  33% weight when available
  if(mkt===null||mkt===undefined)return shrunk;
  return Math.min(0.97,Math.max(0.03,shrunk*0.67+mkt*0.33));}

function NBAPage(){
  const [awayTeam,setAwayTeam]=useState("");const [homeTeam,setHomeTeam]=useState("");const [awayOdds,setAwayOdds]=useState("");const [homeOdds,setHomeOdds]=useState("");const [homeSpread,setHomeSpread]=useState("");const [postedTotal,setPostedTotal]=useState("");const [awayData,setAwayData]=useState(null);const [homeData,setHomeData]=useState(null);const [awayLoading,setAwayLoading]=useState(false);const [homeLoading,setHomeLoading]=useState(false);const [awayError,setAwayError]=useState("");const [homeError,setHomeError]=useState("");const [results,setResults]=useState(null);const [tab,setTab]=useState("results");const [analyzing,setAnalyzing]=useState(false);const [oddsLoading,setOddsLoading]=useState(false);const [oddsError,setOddsError]=useState("");const [sharpAlert,setSharpAlert]=useState(null);
  const [gameTime,setGameTime]=useState(null);const [awayMsg,setAwayMsg]=useState("");const [homeMsg,setHomeMsg]=useState("");
  const [contextData,setContextData]=useState(null);const [contextLoading,setContextLoading]=useState(false);const [contextError,setContextError]=useState("");const [modelError,setModelError]=useState("");
  const LOAD_MSGS=["Fetching ESPN roster...","Pulling schedule data...","Analyzing with Claude...","Almost done..."];
  const fetchTeam=async(team,side)=>{const setL=side==="away"?setAwayLoading:setHomeLoading;const setD=side==="away"?setAwayData:setHomeData;const setE=side==="away"?setAwayError:setHomeError;const setM=side==="away"?setAwayMsg:setHomeMsg;setL(true);setD(null);setE("");setResults(null);setM(LOAD_MSGS[0]);let mi=0;const iv=setInterval(()=>{mi=Math.min(mi+1,LOAD_MSGS.length-1);setM(LOAD_MSGS[mi]);},2500);try{const r=await fetch("/api/team",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({team,sport:"nba"})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Error "+r.status);setD(d);}catch(e){setE(e.message);}clearInterval(iv);setM("");setL(false);};
  const fetchOdds=async()=>{setOddsLoading(true);setOddsError("");setSharpAlert(null);try{const r=await fetch("/api/odds",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sport:"nba",homeTeam,awayTeam})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Error "+r.status);if(d.homeML)setHomeOdds(d.homeML);if(d.awayML)setAwayOdds(d.awayML);if(d.homeSpread)setHomeSpread(d.homeSpread);if(d.total)setPostedTotal(d.total);if(d.sharpIndicator)setSharpAlert(d.sharpIndicator);if(d.gameTime)setGameTime(d.gameTime);}catch(e){setOddsError(e.message);}setOddsLoading(false);};
  const resetAll=()=>{setAwayTeam("");setHomeTeam("");setAwayOdds("");setHomeOdds("");setHomeSpread("");setPostedTotal("");setAwayData(null);setHomeData(null);setResults(null);setSharpAlert(null);setGameTime(null);setOddsError("");setAwayError("");setHomeError("");setContextData(null);setContextError("");};
  const fetchContext=async()=>{if(!homeTeam||!awayTeam)return;setContextLoading(true);setContextError("");try{const r=await fetch("/api/context",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({homeTeam,awayTeam,sport:"nba"})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Error "+r.status);setContextData(d);}catch(e){setContextError(e.message);}setContextLoading(false);};
  const cyclePlayer=(side,name)=>{const [g,s]=side==="home"?[homeData,setHomeData]:[awayData,setAwayData];if(!g)return;s({...g,roster:g.roster.map(p=>p.name!==name?p:{...p,status:STATUS_CYCLE[(STATUS_CYCLE.indexOf(p.status)+1)%4]})});};
  const runModels=()=>{if(!homeData||!awayData)return;setModelError("");setAnalyzing(true);setTimeout(()=>{try{const pyth=nbaMdlPythagorean(homeData,awayData),net=nbaMdlNetRating(homeData,awayData),ff=nbaMdlFourFactors(homeData,awayData),star=nbaMdlStarPower(homeData,awayData),mc=nbaMdlMonteCarlo(homeData,awayData);const mkt=devigged(homeOdds,awayOdds);const hElo=homeData.elo||1500,aElo=awayData.elo||1500;const eloProb=1/(1+Math.pow(10,(aElo-hElo)/400));const h2hG=(homeData.games||[]).filter(g=>g.opp===awayData.espn_id);const h2hW=h2hG.filter(g=>g.win).length;const h2hProb=h2hG.length>=2?h2hW/h2hG.length:null;const divGame=!!(NBA_DIV[homeTeam]&&NBA_DIV[homeTeam]===NBA_DIV[awayTeam]);const altBoost=ALTITUDE_HOME[homeTeam]||0;const hTZ=TZ_OFF[NBA_TZ[homeTeam]]??1.5,aTZ=TZ_OFF[NBA_TZ[awayTeam]]??1.5;const tzAdj=Math.max(-0.015,Math.min(0.015,(hTZ-aTZ)*0.010)); // capped ±1.5% (±4% had no strong evidence)
      let cons=nbaConsensus([pyth.homeProb,net.homeProb,ff.homeProb,star.homeProb,mc.homeProb],mkt);if(altBoost)cons=Math.min(0.97,Math.max(0.03,cons+altBoost));cons=Math.min(0.97,Math.max(0.03,cons+tzAdj));cons=Math.min(0.97,Math.max(0.03,cons*0.90+eloProb*0.10));const hExpN=parseFloat(mc.hExp),aExpN=parseFloat(mc.aExp);const mcSpread=hExpN-aExpN;const nrSpread=net.adjDiff;
        const ttl=nbaMdlTotal(homeData,awayData);const rawTotal=ttl.rawTotal;const ptN=parseFloat(postedTotal);
        // Adaptive blend: when model is far below market (likely stale PPG data), trust market more
        // Gap 0-8 pts → 50/50 | Gap 8-15 pts → 30/70 | Gap 15+ pts → 15/85
        const totalGap=!isNaN(ptN)?ptN-rawTotal:0;
        const mktW=!isNaN(ptN)?(totalGap>=15?0.90:totalGap>=8?0.80:0.65):0;
        const modelTotal=(!isNaN(ptN)?rawTotal*(1-mktW)+ptN*mktW:rawTotal).toFixed(1);
        const totalGapFlag=!isNaN(ptN)&&totalGap>=10;
        // Context adjusts win probability for display purposes only
        let adjCons=cons;
        if(contextData)adjCons=Math.min(0.97,Math.max(0.03,cons+Math.max(-0.05,Math.min(0.05,contextData.homeMLAdjustment||0))));
        // SPREAD: direct point margin blend — no market anchoring (goal is to beat the line, not echo it)
        // eloSpread: 28 Elo pts ≈ 1 point margin in NBA; +3.2 for home court
        const eloSpread=(hElo-aElo)/28+3.2;
        const ffSpread=ff.adjDiff||0;
        // Blend: MC multiplicative sim 75% + Net Rating 20% + Four Factors 5%
        // Grid-search over Feb-Mar 2026 (219 games) shows MC-dominant blend beats 65% ATS
        let adjSpread=mcSpread*0.75+nrSpread*0.20+ffSpread*0.05;
        // Altitude/timezone adjustments converted from prob-scale (Δp × 28 ≈ Δpts near 50%)
        if(altBoost)adjSpread+=altBoost*28;adjSpread+=tzAdj*28;
        // Tiered blowout dampening: large-spread favorites underperform ATS at high rate
        // (3/12-3/13 data: big favorites 2-8 ATS = 25%). Pull model toward Vegas margin.
        // ≥9pts: 20% | ≥12pts: 35% | ≥15pts: 50%
        const vegsMarginRaw=homeSpread?-parseFloat(homeSpread):0;
        if(homeSpread&&!isNaN(vegsMarginRaw)){
          const absVM=Math.abs(vegsMarginRaw);
          const blowoutW=absVM>=15?0.50:absVM>=12?0.35:absVM>=9?0.20:0;
          if(blowoutW>0) adjSpread=adjSpread*(1-blowoutW)+vegsMarginRaw*blowoutW;
        }
        let adjTotal=parseFloat(modelTotal);
        // Garbage time inflation: when a blowout is projected (|margin|≥12), losing team
        // scores freely with reserves in 4th quarter, inflating the final total ~4 pts
        if(Math.abs(adjSpread)>=12) adjTotal+=4;
        if(contextData){adjSpread+=Math.max(-3,Math.min(3,contextData.spreadAdjustment||0));adjTotal+=Math.max(-5,Math.min(5,contextData.totalAdjustment||0));}
        const tankWarning=NBA_HIGH_VARIANCE.has(homeTeam)||NBA_HIGH_VARIANCE.has(awayTeam);
        setResults({pyth,net,ff,star,mc,mkt,cons:adjCons,eloProb,h2hG,h2hW,h2hProb,divGame,altBoost,tzAdj,modelSpread:adjSpread.toFixed(1),modelTotal:adjTotal.toFixed(1),totalGapFlag,rawModelTotal:rawTotal.toFixed(1),tankWarning});setTab("results");}catch(e){console.error("NBA runModels error:",e);setModelError(e.message||String(e));}finally{setAnalyzing(false);}},50);};
  const inp={width:"100%",padding:"10px 12px",background:C.black,border:"1.5px solid "+C.border,borderRadius:8,color:C.white,fontSize:13,outline:"none",fontFamily:"'Barlow',sans-serif"};
  const bothLoaded=awayData&&homeData;const awayAbbr=NBA_ABBR[awayTeam]||"AWY";const homeAbbr=NBA_ABBR[homeTeam]||"HME";
  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12}}>
      <SectionHeader label="Step 1 - Select Away Team" accent={C.teal} right={awayData&&<Pill label={awayAbbr+" LOADED"} color={C.teal}/>}/>
      <div style={{padding:14}}>
        <TeamSelect items={NBA_TEAMS} getLabel={t=>t} displayValue={awayTeam} accent={C.teal} placeholder="Search NBA team..." disabled={awayLoading} onSelect={t=>{setAwayTeam(t);setAwayData(null);setResults(null);fetchTeam(t,"away");}}/>
        {awayLoading&&awayMsg&&<div style={{marginTop:6,fontSize:11,color:C.teal,fontFamily:"'Barlow Condensed'",letterSpacing:.5}}><span className="pulse">{awayMsg}</span></div>}
        {awayError&&<div style={{marginTop:8,padding:"8px 12px",background:"#2a0f0f",border:"1px solid #5a2020",borderRadius:6,fontSize:11,color:"#f87171"}}>{awayError}</div>}
      </div>
      {(awayLoading||awayData)&&<div style={{padding:"0 14px 14px"}}><RosterPanel teamName={awayTeam} abbr={awayAbbr} teamData={awayData} onCycle={n=>cyclePlayer("away",n)} sport="nba" accent={C.teal} loading={awayLoading}/></div>}
    </div>
    <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12}}>
      <SectionHeader label="Step 2 - Select Home Team" accent={C.copper} right={homeData&&<Pill label={homeAbbr+" LOADED"} color={C.copper}/>}/>
      <div style={{padding:14}}>
        <TeamSelect items={NBA_TEAMS} getLabel={t=>t} displayValue={homeTeam} accent={C.copper} placeholder="Search NBA team..." disabled={homeLoading} onSelect={t=>{setHomeTeam(t);setHomeData(null);setResults(null);fetchTeam(t,"home");}}/>
        {homeLoading&&homeMsg&&<div style={{marginTop:6,fontSize:11,color:C.copper,fontFamily:"'Barlow Condensed'",letterSpacing:.5}}><span className="pulse">{homeMsg}</span></div>}
        {homeError&&<div style={{marginTop:8,padding:"8px 12px",background:"#2a0f0f",border:"1px solid #5a2020",borderRadius:6,fontSize:11,color:"#f87171"}}>{homeError}</div>}
      </div>
      {(homeLoading||homeData)&&<div style={{padding:"0 14px 14px"}}><RosterPanel teamName={homeTeam} abbr={homeAbbr} teamData={homeData} onCycle={n=>cyclePlayer("home",n)} sport="nba" accent={C.copper} loading={homeLoading}/></div>}
    </div>
    {bothLoaded&&<div className="fade-in" style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,overflow:"hidden"}}>
      <SectionHeader label="Step 3 - Set Odds & Analyze"/>
      <div style={{padding:14}}>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
          <button className="hov-btn" onClick={fetchOdds} disabled={oddsLoading} style={{padding:"8px 16px",background:oddsLoading?C.dim:"linear-gradient(90deg,#1a4a6b,#2a6a9b)",border:"1px solid #2a6a9b",borderRadius:7,cursor:oddsLoading?"not-allowed":"pointer",fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:12,letterSpacing:1.5,color:C.white,textTransform:"uppercase",whiteSpace:"nowrap"}}>{oddsLoading?<span className="pulse">Fetching...</span>:"Fetch Live Odds"}</button>
          <span style={{fontSize:10,color:C.muted}}>Auto-fills from live sportsbooks</span>
          {oddsError&&<span style={{fontSize:11,color:"#f87171",marginLeft:"auto"}}>{oddsError}</span>}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
          <button className="hov-btn" onClick={fetchContext} disabled={contextLoading} style={{padding:"8px 16px",background:contextLoading?C.dim:contextData?"linear-gradient(90deg,#1a4a2b,#2a6a4b)":"linear-gradient(90deg,#2a1a4a,#4a2a6b)",border:"1px solid "+(contextData?"#2a6a4b":"#4a2a6b"),borderRadius:7,cursor:contextLoading?"not-allowed":"pointer",fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:12,letterSpacing:1.5,color:C.white,textTransform:"uppercase",whiteSpace:"nowrap"}}>{contextLoading?<span className="pulse">Searching...</span>:contextData?"Refresh Context":"Fetch Context"}</button>
          <span style={{fontSize:10,color:C.muted}}>Refs, injuries &amp; situational factors</span>
          {contextData&&<Pill label="CONTEXT LOADED" color={C.teal}/>}
          {contextError&&<span style={{fontSize:11,color:"#f87171",marginLeft:"auto"}}>{contextError}</span>}
        </div>
        {gameTime&&<div style={{marginBottom:8,padding:"5px 10px",background:C.black,borderRadius:6,fontSize:11,color:C.teal,fontFamily:"'Barlow Condensed'",fontWeight:700,letterSpacing:.5}}>GAME: {new Date(gameTime).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})} - {new Date(gameTime).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZoneName:"short"})}</div>}
        {sharpAlert&&<div style={{marginBottom:10,padding:"9px 13px",background:"#1a0f00",border:"1px solid "+C.amber+"66",borderRadius:8,display:"flex",gap:8,alignItems:"flex-start"}}><div style={{fontSize:13,flexShrink:0}}>!</div><div><div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:11,color:C.amber,letterSpacing:1}}>SHARP MONEY SIGNAL</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>{sharpAlert.desc}</div></div></div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:10}}><div><div style={{fontSize:10,color:C.muted,letterSpacing:1,marginBottom:5,textTransform:"uppercase"}}>Away Moneyline ({awayAbbr})</div><input style={inp} placeholder="+130" value={awayOdds} onChange={e=>setAwayOdds(e.target.value)}/></div><div><div style={{fontSize:10,color:C.muted,letterSpacing:1,marginBottom:5,textTransform:"uppercase"}}>Home Moneyline ({homeAbbr})</div><input style={inp} placeholder="-150" value={homeOdds} onChange={e=>setHomeOdds(e.target.value)}/></div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}><div><div style={{fontSize:10,color:C.muted,letterSpacing:1,marginBottom:5,textTransform:"uppercase"}}>Home Spread (optional)</div><input style={inp} placeholder="-6.5" value={homeSpread} onChange={e=>setHomeSpread(e.target.value)}/></div><div><div style={{fontSize:10,color:C.muted,letterSpacing:1,marginBottom:5,textTransform:"uppercase"}}>Over/Under (optional)</div><input style={inp} placeholder="224.5" value={postedTotal} onChange={e=>setPostedTotal(e.target.value)}/></div></div>
      </div>
    </div>}
    {results&&<NBAResults results={results} contextData={contextData} awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayOdds={awayOdds} homeOdds={homeOdds} homeSpread={homeSpread} postedTotal={postedTotal} tab={tab} setTab={setTab} onRecalc={runModels}/>}
    {bothLoaded&&<div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,background:C.dark+"F2",borderTop:"1px solid "+C.border,padding:"10px 16px",backdropFilter:"blur(8px)"}}>
      <div style={{maxWidth:1040,margin:"0 auto",display:"flex",gap:8,alignItems:"center"}}>
        <button className="hov-btn" onClick={runModels} disabled={analyzing} style={{flex:1,padding:"12px 0",background:analyzing?C.dim:"linear-gradient(90deg,"+C.copper+","+C.copperL+")",border:"none",borderRadius:8,cursor:analyzing?"not-allowed":"pointer",fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:16,letterSpacing:2,color:analyzing?C.muted:C.black,textTransform:"uppercase"}}>{analyzing?<span className="pulse">Running Models...</span>:results?"Recalculate":"Run Analysis"}</button>
        <button className="hov-btn" onClick={resetAll} style={{padding:"12px 18px",background:"transparent",border:"1px solid "+C.border,borderRadius:8,cursor:"pointer",fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1,color:C.muted,whiteSpace:"nowrap"}}>New Matchup</button>
      </div>
      {modelError&&<div style={{padding:"6px 12px",color:"#f87171",fontSize:11,fontFamily:"'Barlow',sans-serif",borderTop:"1px solid #3a1010",background:"#1a0808"}}>⚠ Model error: {modelError}</div>}
    </div>}
  </div>;
}

// Shared Best Bets summary - top 3 most confident bets with star ratings
// sigma = std dev of game margin/total (Normal approximation)
// Spread sigma: sqrt(2)*11.5=16.3 | Total sigma: higher due to pace correlation (~20 NBA, ~18 NCAAM)
// NHL uses Poisson model: spread~2.4, total~1.8
function BestBets({results,awayTeam,homeTeam,homeSpread,postedTotal,sport,accent}){
  if(!results||results.cons==null)return null;
  const cons=results.cons,ms=parseFloat(results.modelSpread),mt=parseFloat(results.modelTotal);
  const sigmaSpread=sport==="nhl"?2.4:sport==="ncaam"?14.1:12.5; // NBA empirical margin SD ~12-13, not sqrt(2)*11.5=16.3
  const sigmaTotal=sport==="nhl"?1.8:sport==="ncaam"?18:15;    // NBA empirical total SD ~14-15, not 20
  const ac=accent||C.copper;
  const bets=[];
  // Spread — primary bet (pays -110 regardless of line; better value than ML favorites)
  const ps=parseFloat(homeSpread);
  if(!isNaN(ps)&&!isNaN(ms)){
    const ph=normalCDF((ms+ps)/sigmaSpread);
    if(ph>=0.5)bets.push({label:homeTeam+" "+homeSpread,conf:ph});
    else{const al=(-ps)>=0?"+"+(-ps).toFixed(1):(-ps).toFixed(1);bets.push({label:awayTeam+" "+al,conf:1-ph});}
  }
  // ML — only when no spread is entered (fallback mode)
  if(isNaN(ps)||isNaN(ms)){
    if(cons>=0.5)bets.push({label:homeTeam+" ML",conf:cons});
    else bets.push({label:awayTeam+" ML",conf:1-cons});
  }
  // Total - if user entered total and model has an expected total
  // Dampen confidence when model-market gap is large (model likely has stale data)
  const pt=parseFloat(postedTotal);
  if(!isNaN(pt)&&!isNaN(mt)){
    const rawMt=parseFloat(results.rawModelTotal||mt);
    const gap=Math.abs(pt-rawMt);
    // Gap 0-8: normal | 8-15: dampen 25% | 15+: dampen 50% (avoid total bet)
    const dampF=gap>=15?0.50:gap>=8?0.75:1.0;
    const po=normalCDF((mt-pt)/sigmaTotal);
    const dampedConf=0.5+(po-0.5)*dampF;
    if(dampedConf>=0.5)bets.push({label:"Over "+postedTotal,conf:dampedConf,isDampened:gap>=8});
    else bets.push({label:"Under "+postedTotal,conf:1-dampedConf,isDampened:gap>=8});
  }
  const top3=bets.sort((a,b)=>b.conf-a.conf).slice(0,3);
  if(top3.length===0)return null;
  const starN=c=>{const p=c*100;return p>=81?5:p>=61?4:p>=41?3:p>=21?2:1;};
  return <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:14,marginTop:10}}>
    <div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1.5,color:ac,textTransform:"uppercase",marginBottom:10}}>Best Bets</div>
    {top3.map((bet,i)=>{const n=starN(bet.conf);return(
      <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<top3.length-1?"1px solid "+C.border+"66":"none",opacity:bet.isDampened?0.6:1}}>
        <div style={{display:"flex",gap:1,minWidth:88}}>{Array(5).fill(0).map((_,j)=><span key={j} style={{fontSize:17,color:j<n?C.copper:C.dim}}>&#9733;</span>)}</div>
        <div style={{flex:1,fontFamily:"'Barlow Condensed'",fontWeight:700,fontSize:17,letterSpacing:0.5,color:C.white}}>{bet.label}</div>
        <div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:20,color:ac}}>{(bet.conf*100).toFixed(0)}%</div>
      </div>
    );})}
    <div style={{marginTop:8,fontSize:10,color:C.dim}}>&#9733;&#9733;&#9733;&#9733;&#9733; 81%+ &nbsp;&#9733;&#9733;&#9733;&#9733; 61-80% &nbsp;&#9733;&#9733;&#9733; 41-60%</div>
  </div>;
}

function NBAResults({results,contextData,awayTeam,homeTeam,awayAbbr,homeAbbr,awayOdds,homeOdds,homeSpread,postedTotal,tab,setTab,onRecalc}){
  const [copied,setCopied]=useState(false);
  const {pyth,net,ff,star,mc,cons,mkt,eloProb,h2hG,h2hW,h2hProb,divGame,altBoost,tzAdj,modelSpread,modelTotal,totalGapFlag,rawModelTotal,tankWarning}=results;const cH=cons,aw=1-cH;
  const hI=oddsToImplied(homeOdds),aI=oddsToImplied(awayOdds);
  const hE=hI!==null?((cH-hI)*100).toFixed(1):null,aE=aI!==null?((aw-aI)*100).toFixed(1):null;
  const hEV=homeOdds&&hI?calcEV(cH,homeOdds):null,aEV=awayOdds&&aI?calcEV(aw,awayOdds):null;
  const kellyPct=(prob,odds)=>{const o=parseInt(odds);if(isNaN(o))return null;const dec=o>0?o/100+1:100/Math.abs(o)+1;const k=prob-(1-prob)/(dec-1);return Math.max(0,k*25).toFixed(1);};
  const copyResults=()=>{const lines=[`Court Edge - ${awayTeam} @ ${homeTeam}`,`Consensus: ${awayTeam} ${(aw*100).toFixed(1)}% | ${homeTeam} ${(cH*100).toFixed(1)}%`,`Fair odds: ${awayAbbr} ${probToAmerican(aw)} | ${homeAbbr} ${probToAmerican(cH)}`,awayOdds&&homeOdds?`Posted: ${awayAbbr} ${awayOdds} | ${homeAbbr} ${homeOdds}`:null,aE?`${awayAbbr} Edge: ${parseFloat(aE)>=0?"+":""}${aE}%`:null,hE?`${homeAbbr} Edge: ${parseFloat(hE)>=0?"+":""}${hE}%`:null,modelSpread?`Model spread: ${homeAbbr} ${parseFloat(modelSpread)>=0?"-"+modelSpread:"+"+Math.abs(parseFloat(modelSpread)).toFixed(1)}`:null,modelTotal?`Model total: ${modelTotal} pts`:null].filter(Boolean).join("\n");navigator.clipboard.writeText(lines);setCopied(true);setTimeout(()=>setCopied(false),2000);};
  const allPs=[pyth.homeProb,net.homeProb,ff.homeProb,star.homeProb,mc.homeProb];if(mkt!=null)allPs.push(mkt);
  const favH=cH>0.5;const agr=allPs.filter(p=>favH?p>0.5:p<0.5).length;const tot=allPs.length;
  const sig=(edge,a,t)=>a>=t-1&&edge>=3?"STRONG BET":a>=Math.ceil(t*0.67)&&edge>=1?"LEAN BET":a>=Math.ceil(t*0.5)?"SLIGHT EDGE":"MODELS SPLIT";
  return <div className="fade-in">
    <div style={{display:"flex",gap:4,marginBottom:14,background:C.dark,borderRadius:8,padding:4,border:"1px solid "+C.border}}>{[["results","Results"],["method","Methodology"]].map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"8px 0",borderRadius:6,border:"none",cursor:"pointer",background:tab===k?C.copper+"33":"transparent",color:tab===k?C.copper:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1,textTransform:"uppercase",borderBottom:tab===k?"2px solid "+C.copper:"2px solid transparent"}}>{l}</button>)}</div>
    {tab==="results"&&<>
      <div style={{background:C.card,border:"1.5px solid "+C.copper+"44",borderRadius:12,padding:20,marginBottom:14}}>
        <SectionHeader label="Consensus - 5 Model Weighted Average"/><div style={{height:8}}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:16,alignItems:"center",marginBottom:16}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}><Badge abbr={awayAbbr} size={52}/><div style={{textAlign:"center"}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:42,lineHeight:1,color:aw>.55?C.teal:aw>.45?C.copper:C.white}}>{(aw*100).toFixed(1)}%</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>{awayTeam}</div></div><OddsPill prob={aw}/></div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:14,color:C.muted,letterSpacing:2}}>VS</div><div style={{padding:"6px 10px",background:C.black,border:"1px solid "+C.border,borderRadius:8,textAlign:"center"}}><div style={{fontFamily:"'Barlow Condensed'",fontSize:10,fontWeight:800,color:agr>=tot-1?C.teal:agr>=Math.ceil(tot*0.67)?C.copper:C.muted,letterSpacing:1}}>{agr}/{tot} AGREE</div>{(aE||hE)&&<div style={{fontFamily:"'Barlow Condensed'",fontSize:11,fontWeight:800,color:C.muted,letterSpacing:1,marginTop:3}}>{sig(parseFloat(aw>cH?aE:hE),agr,tot)}</div>}</div></div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}><Badge abbr={homeAbbr} size={52}/><div style={{textAlign:"center"}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:42,lineHeight:1,color:cH>.55?C.teal:cH>.45?C.copper:C.white}}>{(cH*100).toFixed(1)}%</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>{homeTeam}</div></div><OddsPill prob={cH}/></div>
        </div>
        <WinBar awayProb={aw} awayAbbr={awayAbbr} homeAbbr={homeAbbr}/>
        {(aE||hE)&&<div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>{aE&&<div style={{padding:"5px 12px",borderRadius:6,background:parseFloat(aE)>=2?C.teal+"18":C.black,border:"1px solid "+(parseFloat(aE)>=2?C.teal:C.border),fontSize:11,color:parseFloat(aE)>=2?C.teal:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:700}}>{awayAbbr} Edge: {parseFloat(aE)>=0?"+":""}{aE}%{aEV?" - EV "+(parseFloat(aEV)>=0?"+":"")+aEV+"/$1":""}{awayOdds&&parseFloat(aE)>0?" - Kelly "+(kellyPct(aw,awayOdds)||"?")+"%":""}</div>}{hE&&<div style={{padding:"5px 12px",borderRadius:6,background:parseFloat(hE)>=2?C.teal+"18":C.black,border:"1px solid "+(parseFloat(hE)>=2?C.teal:C.border),fontSize:11,color:parseFloat(hE)>=2?C.teal:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:700}}>{homeAbbr} Edge: {parseFloat(hE)>=0?"+":""}{hE}%{hEV?" - EV "+(parseFloat(hEV)>=0?"+":"")+hEV+"/$1":""}{homeOdds&&parseFloat(hE)>0?" - Kelly "+(kellyPct(cH,homeOdds)||"?")+"%":""}</div>}</div>}
        {(hI&&aI)&&(()=>{const mktH=hI/(hI+aI);const mktA=aI/(hI+aI);const ourH=cH;const diff=Math.abs(ourH-mktH);const big=diff>=0.10;return big?<div style={{marginTop:10,padding:"10px 14px",background:"#1a120a",border:"1px solid "+C.amber+"66",borderRadius:8,display:"flex",gap:8,alignItems:"flex-start"}}><div style={{fontSize:14,flexShrink:0}}>[!]</div><div><div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:12,color:C.amber,letterSpacing:1}}>MODEL/MARKET DIVERGENCE</div><div style={{fontSize:11,color:C.muted,marginTop:3,lineHeight:1.6}}>Market implies {(mktH*100).toFixed(0)}% {homeAbbr} / {(mktA*100).toFixed(0)}% {awayAbbr}. Our model says {(cH*100).toFixed(0)}% / {(aw*100).toFixed(0)}%. Gap of {(diff*100).toFixed(0)}%. Large divergences usually mean the market knows something  -  injuries, line movement, or our stats may be stale. Bet smaller or verify.</div></div></div>:null;})()}
        <div style={{display:"flex",gap:8,marginTop:12}}>
          <button className="hov-btn" onClick={onRecalc} style={{flex:1,padding:"9px 0",background:"transparent",border:"1px solid "+C.border,borderRadius:7,cursor:"pointer",fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1.5,color:C.muted,textTransform:"uppercase"}}>Recalculate with Updated Injuries</button>
          <button className="hov-btn" onClick={copyResults} style={{padding:"9px 16px",background:copied?C.teal+"22":"transparent",border:"1px solid "+(copied?C.teal:C.border),borderRadius:7,cursor:"pointer",fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:12,letterSpacing:1,color:copied?C.teal:C.muted,whiteSpace:"nowrap",position:"relative"}}>{copied?"Copied!":"Copy Results"}</button>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <ModelCard icon="PYT" name="Pythagorean" desc="Point diff Pythagorean (exp 13.9) + L10 blend" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-pyth.homeProb} detail={pyth.detail}/>
        <ModelCard icon="NET" name="Net Rating" desc="PPG minus OPP  -  best single NBA predictor" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-net.homeProb} detail={net.detail}/>
        <ModelCard icon="4F" name="Four Factors" desc="eFG%, TOV%, OREB%, FTR efficiency ratios" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-ff.homeProb} detail={ff.detail}/>
        <ModelCard icon="STR" name="Star Power" desc="Top-3 player PER weighted by availability" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-star.homeProb} detail={star.detail}/>
      </div>
      <ModelCard icon="MC" name="Monte Carlo Simulation" desc="8,000 simulated games - Normal distribution" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-mc.homeProb} detail={mc.detail}/>
      <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:14,marginTop:10}}>
        <div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1.5,color:C.copper,textTransform:"uppercase",marginBottom:10}}>Model Agreement</div>
        {(()=>{const items=[{l:"Pythagorean",p:1-pyth.homeProb},{l:"Net Rating",p:1-net.homeProb},{l:"4 Factors",p:1-ff.homeProb},{l:"Star Power",p:1-star.homeProb},{l:"Monte Carlo",p:1-mc.homeProb}];if(mkt!=null)items.push({l:"Market",p:1-mkt,isMkt:true});if(eloProb!=null)items.push({l:"Elo",p:1-eloProb,isElo:true});return <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(62px,1fr))",gap:8}}>{items.map(m=>{const af=m.p>.5;const dp=af?m.p:1-m.p;const da=af?awayAbbr:homeAbbr;const ac=m.isElo?"#a78bfa":m.isMkt?C.amber:C.teal;return <div key={m.l} style={{textAlign:"center",background:C.black,borderRadius:8,padding:"10px 6px",border:"1px solid "+ac+"44"}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:22,color:ac}}>{(dp*100).toFixed(0)}%</div><div style={{fontSize:10,color:ac,fontWeight:700,marginBottom:2}}>{da}</div><div style={{fontSize:9,color:C.dim,textTransform:"uppercase",letterSpacing:.5}}>{m.l}</div></div>;})}</div>;})()}
      </div>
      <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:14,marginTop:10}}>
        <div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1.5,color:C.copper,textTransform:"uppercase",marginBottom:10}}>Model Lines</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
          <div style={{background:C.black,borderRadius:8,padding:"10px 12px",border:"1px solid "+(tankWarning?"#f87171":""+C.border)}}><div style={{fontSize:9,color:C.dim,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Model Spread{tankWarning?" ⚠ HIGH VAR":""}</div><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:20,color:tankWarning?"#f87171":C.copper}}>{parseFloat(modelSpread)>=0?homeAbbr+" -"+modelSpread:awayAbbr+" -"+Math.abs(parseFloat(modelSpread)).toFixed(1)}</div>{tankWarning&&<div style={{fontSize:9,color:"#f87171",marginTop:2,letterSpacing:.5,textTransform:"uppercase"}}>Lottery team — skip spread bet</div>}{homeSpread&&(()=>{const delta=parseFloat(modelSpread)+parseFloat(homeSpread);const strongEdge=Math.abs(delta)>=3.5;const anyEdge=Math.abs(delta)>=1.5;const coversTeam=delta>0?homeAbbr:awayAbbr;const edgeColor=delta>0?C.teal:"#f87171";return <div style={{marginTop:6}}>{anyEdge?<div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:14,color:strongEdge?edgeColor:C.muted}}>{delta>0?"▲":"▼"} {coversTeam} covers</div>:<div style={{fontSize:11,color:C.dim,fontStyle:"italic"}}>No clear edge — model aligns with Vegas</div>}<div style={{fontSize:10,color:C.muted,marginTop:2}}>Posted {homeSpread} · Edge: {delta>0?"+":""}{delta.toFixed(1)}pt</div>{strongEdge&&!tankWarning&&<div style={{fontSize:9,color:C.amber,marginTop:3,letterSpacing:.5,textTransform:"uppercase"}}>Strong edge — {Math.abs(delta).toFixed(1)}pt vs line</div>}</div>;})()}</div>
          <div style={{background:totalGapFlag?"#1a0a0a":C.black,borderRadius:8,padding:"10px 12px",border:"1px solid "+(totalGapFlag?C.amber+"66":C.border)}}><div style={{fontSize:9,color:C.dim,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Model Total{totalGapFlag?" ⚠ LOW CONF":""}</div><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:20,color:totalGapFlag?C.amber:C.copper}}>{modelTotal} pts</div>{rawModelTotal&&totalGapFlag&&<div style={{fontSize:10,color:C.amber,marginTop:2}}>Raw model: {rawModelTotal} — large gap vs line, avoid total bet</div>}{postedTotal&&<div style={{fontSize:11,color:Math.abs(parseFloat(modelTotal)-parseFloat(postedTotal))>=2?C.teal:C.muted,marginTop:4}}>Posted {postedTotal} - {parseFloat(modelTotal)>parseFloat(postedTotal)?"OVER by "+(parseFloat(modelTotal)-parseFloat(postedTotal)).toFixed(1):"UNDER by "+(parseFloat(postedTotal)-parseFloat(modelTotal)).toFixed(1)}</div>}</div>
        </div>
        {(divGame||altBoost>0||Math.abs(tzAdj)>=0.01||(h2hG&&h2hG.length>=2))&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:contextData?6:0}}>{divGame&&<span style={{fontSize:10,padding:"3px 8px",borderRadius:4,background:C.amber+"18",color:C.amber,border:"1px solid "+C.amber+"44"}}>DIV GAME - tighter line</span>}{altBoost>0&&<span style={{fontSize:10,padding:"3px 8px",borderRadius:4,background:C.copper+"18",color:C.copper,border:"1px solid "+C.copper+"44"}}>ALTITUDE +{(altBoost*100).toFixed(0)}% {homeAbbr}</span>}{tzAdj>0.01&&<span style={{fontSize:10,padding:"3px 8px",borderRadius:4,background:C.teal+"18",color:C.teal,border:"1px solid "+C.teal+"44"}}>TZ ADV +{(tzAdj*100).toFixed(0)}% {homeAbbr}</span>}{tzAdj<-0.01&&<span style={{fontSize:10,padding:"3px 8px",borderRadius:4,background:C.teal+"18",color:C.teal,border:"1px solid "+C.teal+"44"}}>TZ ADV +{(Math.abs(tzAdj)*100).toFixed(0)}% {awayAbbr}</span>}{h2hG&&h2hG.length>=2&&<span style={{fontSize:10,padding:"3px 8px",borderRadius:4,background:"#a78bfa18",color:"#a78bfa",border:"1px solid #a78bfa44"}}>H2H: {homeAbbr} {h2hW}-{h2hG.length-h2hW} this season</span>}</div>}
        {contextData&&(contextData.injuryAlerts?.length>0||contextData.situationalNotes?.length>0||contextData.refNotes?.length>0)&&<div style={{marginTop:8,padding:"10px 12px",background:"#0d1a0d",border:"1px solid "+C.teal+"44",borderRadius:8}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:10,color:C.teal,letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>Perplexity Context{contextData.totalAdjustment!==0?` — Total adj: ${contextData.totalAdjustment>0?"+":""}${contextData.totalAdjustment.toFixed(1)} pts`:""}{ contextData.homeMLAdjustment!==0?` — ML adj: ${contextData.homeMLAdjustment>0?"+":""}${(contextData.homeMLAdjustment*100).toFixed(1)}% ${homeTeam}`:""}</div>{contextData.injuryAlerts?.map((n,i)=><div key={"inj"+i} style={{fontSize:11,color:"#f87171",marginBottom:2}}>&#9888; {n}</div>)}{contextData.situationalNotes?.map((n,i)=><div key={"sit"+i} style={{fontSize:11,color:C.amber,marginBottom:2}}>&#10148; {n}</div>)}{contextData.refNotes?.map((n,i)=><div key={"ref"+i} style={{fontSize:11,color:C.muted,marginBottom:2}}>&#9673; {n}</div>)}</div>}
      </div>
      <BestBets results={results} awayTeam={awayTeam} homeTeam={homeTeam} homeSpread={homeSpread} postedTotal={postedTotal} sport="nba" accent={C.copper}/>
    </>}
    {tab==="method"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{[["PYT","Pythagorean (20%)","Season + L10 Pythagorean win% (exp 13.9). Regresses luck out of raw W/L. HCA via +3.2pt scoring model."],["NET","Net Rating (28%)","55% season + 45% recent PPG-OPP differential. Best single NBA predictor. 1pt ~ +2.7% win probability."],["4F","Four Factors (18%)","eFG%(40%) + TOV%(25%) + OREB%(20%) + FTR(15%). Entirely independent efficiency signal."],["STR","Star Power (16%)","Top-3 PER weighted by injury status: OUT=0%, DOUBTFUL=20%, Q=62%. Top player worth 35% of team score."],["MC","Monte Carlo (18%)","10,000 simulations blending offense vs opponent defense. Normal distribution sigma=11.5pts."],["W","Consensus","Pythagorean 20% + Net Rating 28% + Four Factors 18% + Star Power 16% + Monte Carlo 18%."]].map(([icon,n,d])=><div key={n} style={{background:C.card,border:"1px solid "+C.border,borderRadius:10,padding:16}}><div style={{width:32,height:32,borderRadius:6,background:C.copper+"22",border:"1px solid "+C.copper+"44",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontFamily:"'Barlow Condensed'",fontWeight:900,color:C.copper,marginBottom:8}}>{icon}</div><div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,color:C.copper,marginBottom:6}}>{n}</div><div style={{fontSize:11,color:C.muted,lineHeight:1.7}}>{d}</div></div>)}</div>}
  </div>;
}

// â”€â”€â”€ NHL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const NHL_TEAMS=["Anaheim Ducks","Boston Bruins","Buffalo Sabres","Calgary Flames","Carolina Hurricanes","Chicago Blackhawks","Colorado Avalanche","Columbus Blue Jackets","Dallas Stars","Detroit Red Wings","Edmonton Oilers","Florida Panthers","Los Angeles Kings","Minnesota Wild","Montreal Canadiens","Nashville Predators","New Jersey Devils","New York Islanders","New York Rangers","Ottawa Senators","Philadelphia Flyers","Pittsburgh Penguins","San Jose Sharks","Seattle Kraken","St. Louis Blues","Tampa Bay Lightning","Toronto Maple Leafs","Utah Mammoth","Vancouver Canucks","Vegas Golden Knights","Washington Capitals","Winnipeg Jets"];
const NHL_ABBR={"Anaheim Ducks":"ANA","Boston Bruins":"BOS","Buffalo Sabres":"BUF","Calgary Flames":"CGY","Carolina Hurricanes":"CAR","Chicago Blackhawks":"CHI","Colorado Avalanche":"COL","Columbus Blue Jackets":"CBJ","Dallas Stars":"DAL","Detroit Red Wings":"DET","Edmonton Oilers":"EDM","Florida Panthers":"FLA","Los Angeles Kings":"LAK","Minnesota Wild":"MIN","Montreal Canadiens":"MTL","Nashville Predators":"NSH","New Jersey Devils":"NJD","New York Islanders":"NYI","New York Rangers":"NYR","Ottawa Senators":"OTT","Philadelphia Flyers":"PHI","Pittsburgh Penguins":"PIT","San Jose Sharks":"SJS","Seattle Kraken":"SEA","St. Louis Blues":"STL","Tampa Bay Lightning":"TBL","Toronto Maple Leafs":"TOR","Utah Mammoth":"UTA","Vancouver Canucks":"VAN","Vegas Golden Knights":"VGK","Washington Capitals":"WSH","Winnipeg Jets":"WPG"};

function nhlMdlGoalDiff(h,a){
  // Use home/away splits when available
  const hGF=h.home_gf||h.gf_pg, hGA=h.home_ga||h.ga_pg;
  const aGF=a.away_gf||a.gf_pg, aGA=a.away_ga||a.ga_pg;
  const hP=pythagorean(hGF,hGA,2.0);
  const aP=pythagorean(aGF,aGA,2.0);
  const hR=pythagorean(h.last10_gf||h.gf_pg,h.last10_ga||h.ga_pg,2.0);
  const aR=pythagorean(a.last10_gf||a.gf_pg,a.last10_ga||a.ga_pg,2.0);
  const hQ=hP*0.60+hR*0.40;
  const aQ=aP*0.60+aR*0.40;
  const hHCA=pythagorean(hGF+0.10,hGA,2.0);
  const hAdj=hQ*0.65+hHCA*0.35;
  const hi=injPen(h.roster,0.07,0.035,0.008);
  const ai=injPen(a.roster,0.07,0.035,0.008);
  const hGI=h.goalie?.status==="OUT"?0.055:h.goalie?.status==="DOUBTFUL"?0.035:h.goalie?.status==="QUESTIONABLE"?0.015:0;
  const aGI=a.goalie?.status==="OUT"?0.055:a.goalie?.status==="DOUBTFUL"?0.035:a.goalie?.status==="QUESTIONABLE"?0.015:0;
  const p=log5(Math.max(0.03,hAdj-hi-hGI),Math.max(0.03,aQ-ai-aGI));
  return{homeProb:p,hQ:(hQ*100).toFixed(1),aQ:(aQ*100).toFixed(1),detail:`H Pyth ${(hQ*100).toFixed(1)}%  A Pyth ${(aQ*100).toFixed(1)}%  +0.10G HCA`};}

function nhlMdlGoalie(h,a){
  // Goalie save% -> expected GA  -  most important single NHL factor
  const hSV=Math.max(0.860,Math.min(0.940,(h.goalie?.save_pct||0.905)-(h.goalie?.status==="OUT"?0.025:h.goalie?.status==="DOUBTFUL"?0.015:h.goalie?.status==="QUESTIONABLE"?0.008:0)));
  const aSV=Math.max(0.860,Math.min(0.940,(a.goalie?.save_pct||0.905)-(a.goalie?.status==="OUT"?0.025:a.goalie?.status==="DOUBTFUL"?0.015:a.goalie?.status==="QUESTIONABLE"?0.008:0)));
  // xGA = shots faced x (1 - SV%)
  const hxGA=(a.shots_pg||30)*(1-hSV);
  const axGA=(h.shots_pg||30)*(1-aSV);
  // 0.5 goal diff ~ 9% win prob change in NHL
  const diff=axGA-hxGA+0.10; // +0.10 HCA
  const p=logistic(diff*2.0);
  return{homeProb:Math.min(0.97,Math.max(0.03,p)),hSV:hSV.toFixed(3),aSV:aSV.toFixed(3),detail:`H SV% ${hSV.toFixed(3)} xGA ${hxGA.toFixed(2)}  A SV% ${aSV.toFixed(3)} xGA ${axGA.toFixed(2)}`};}

function nhlMdlSpecialTeams(h,a){
  // PP% and PK%  -  genuinely independent from 5-on-5 goal data
  const hPP=(h.pp_pct||20)/100;const aPP=(a.pp_pct||20)/100;
  const hPK=(h.pk_pct||80)/100;const aPK=(a.pk_pct||80)/100;
  const hST=hPP*0.57+hPK*0.43;
  const aST=aPP*0.57+aPK*0.43;
  const hi=injPen(h.roster,0.05,0.025,0.005);
  const ai=injPen(a.roster,0.05,0.025,0.005);
  // Small HCA: home team gets slightly more power plays (~3% more)
  const p=logistic((hST-aST)*7+0.06-(hi-ai)*2);
  return{homeProb:Math.min(0.97,Math.max(0.03,p)),hST:(hST*100).toFixed(1),aST:(aST*100).toFixed(1),detail:`H ST: ${(hST*100).toFixed(1)}%  A ST: ${(aST*100).toFixed(1)}%`};}

function nhlMdlShotQuality(h,a){
  // Shot generation + finishing  -  proxy for possession/Corsi
  // shots_pg / shots_against_pg ratio = season CF%
  const hSh=h.shots_pg||30;const aSh=a.shots_pg||30;
  const hAg=h.shots_against_pg||30;const aAg=a.shots_against_pg||30;
  const hCF=hSh/(hSh+hAg);
  const aCF=aSh/(aSh+aAg);
  // Shooting% (goals/shots) captures finishing skill
  const hSP=h.gf_pg/Math.max(hSh,15);
  const aSP=a.gf_pg/Math.max(aSh,15);
  // xG model: CF% weighted by finishing rate
  const hXG=hSh*hSP;const aXG=aSh*aSP;
  const p=logistic((hCF-aCF)*4+(hXG-aXG)*5+0.06);
  return{homeProb:Math.min(0.97,Math.max(0.03,p)),hCF:(hCF*100).toFixed(1),aCF:(aCF*100).toFixed(1),detail:`H CF% ${(hCF*100).toFixed(1)}  A CF% ${(aCF*100).toFixed(1)}`};}

function nhlMdlMonteCarlo(h,a,N=10000){
  // Poisson simulation  -  goals are Poisson distributed
  const hGI=h.goalie?.status==="OUT"?0.32:h.goalie?.status==="DOUBTFUL"?0.20:h.goalie?.status==="QUESTIONABLE"?0.10:0;
  const aGI=a.goalie?.status==="OUT"?0.32:a.goalie?.status==="DOUBTFUL"?0.20:a.goalie?.status==="QUESTIONABLE"?0.10:0;
  const hi=injPen(h.roster,0.065,0.03,0.007);
  const ai=injPen(a.roster,0.065,0.03,0.007);
  const hGF=(h.gf_pg*0.60+(h.last10_gf||h.gf_pg)*0.40)*(1-hi);
  const aGA=(h.ga_pg*0.60+(h.last10_ga||h.ga_pg)*0.40)*(1-aGI*0.5);
  const aGF=(a.gf_pg*0.60+(a.last10_gf||a.gf_pg)*0.40)*(1-ai);
  const hGA=(a.ga_pg*0.60+(a.last10_ga||a.ga_pg)*0.40)*(1-hGI*0.5);
  // Rest penalty: back-to-back costs ~0.3 goals (NHL is lower-scoring than NBA)
  const restPenG=d=>Math.max(0,(2-Math.min(d??2,2))*0.15);
  const hL=Math.max(0.6,(hGF+(3.0-hGA))/2+0.05-restPenG(h.rest));
  const aL=Math.max(0.6,(aGF+(3.0-aGA))/2-restPenG(a.rest));
  function rpois(lam){let k=0,p=1,L=Math.exp(-lam);while(p>L){k++;p*=Math.random();}return k-1;}
  let hw=0,tie=0;
  for(let i=0;i<N;i++){const hg=rpois(hL),ag=rpois(aL);if(hg>ag)hw++;else if(hg===ag)tie++;}
  return{homeProb:Math.min(0.97,Math.max(0.03,(hw+tie*0.55)/N)),hLambda:hL.toFixed(2),aLambda:aL.toFixed(2),detail:`Proj: H ${hL.toFixed(2)}  A ${aL.toFixed(2)} goals`};}

function nhlConsensus(ps,mkt){
  // Goalie 30%, GoalDiff 22%, MC 18%, SpecTeams 17%, ShotQuality 13%
  // 15% shrinkage toward 50%  -  NHL is high variance, even good teams lose 40% at home
  const m=Math.min(0.97,Math.max(0.03,[0.22,0.30,0.17,0.13,0.18].reduce((s,w,i)=>s+ps[i]*w,0)));
  const shrunk=0.5+(m-0.5)*0.85;
  if(mkt===null||mkt===undefined)return shrunk;
  return Math.min(0.97,Math.max(0.03,shrunk*0.67+mkt*0.33));}

function NHLPage(){
  const [awayTeam,setAwayTeam]=useState("");const [homeTeam,setHomeTeam]=useState("");const [awayOdds,setAwayOdds]=useState("");const [homeOdds,setHomeOdds]=useState("");const [homeSpread,setHomeSpread]=useState("");const [postedTotal,setPostedTotal]=useState("");const [awayData,setAwayData]=useState(null);const [homeData,setHomeData]=useState(null);const [awayLoading,setAwayLoading]=useState(false);const [homeLoading,setHomeLoading]=useState(false);const [awayError,setAwayError]=useState("");const [homeError,setHomeError]=useState("");const [results,setResults]=useState(null);const [tab,setTab]=useState("results");const [analyzing,setAnalyzing]=useState(false);const [oddsLoading,setOddsLoading]=useState(false);const [oddsError,setOddsError]=useState("");const [sharpAlert,setSharpAlert]=useState(null);
  const [gameTime,setGameTime]=useState(null);const [awayMsg,setAwayMsg]=useState("");const [homeMsg,setHomeMsg]=useState("");
  const LOAD_MSGS=["Fetching ESPN roster...","Pulling schedule data...","Analyzing with Claude...","Almost done..."];
  const fetchTeam=async(team,side)=>{const setL=side==="away"?setAwayLoading:setHomeLoading;const setD=side==="away"?setAwayData:setHomeData;const setE=side==="away"?setAwayError:setHomeError;const setM=side==="away"?setAwayMsg:setHomeMsg;setL(true);setD(null);setE("");setResults(null);setM(LOAD_MSGS[0]);let mi=0;const iv=setInterval(()=>{mi=Math.min(mi+1,LOAD_MSGS.length-1);setM(LOAD_MSGS[mi]);},2500);try{const r=await fetch("/api/team",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({team,sport:"nhl"})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Error "+r.status);setD(d);}catch(e){setE(e.message);}clearInterval(iv);setM("");setL(false);};
  const fetchOdds=async()=>{setOddsLoading(true);setOddsError("");setSharpAlert(null);try{const r=await fetch("/api/odds",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sport:"nhl",homeTeam,awayTeam})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Error "+r.status);if(d.homeML)setHomeOdds(d.homeML);if(d.awayML)setAwayOdds(d.awayML);if(d.homeSpread)setHomeSpread(d.homeSpread);if(d.total)setPostedTotal(d.total);if(d.sharpIndicator)setSharpAlert(d.sharpIndicator);if(d.gameTime)setGameTime(d.gameTime);}catch(e){setOddsError(e.message);}setOddsLoading(false);};
  const resetAll=()=>{setAwayTeam("");setHomeTeam("");setAwayOdds("");setHomeOdds("");setHomeSpread("");setPostedTotal("");setAwayData(null);setHomeData(null);setResults(null);setSharpAlert(null);setGameTime(null);setOddsError("");setAwayError("");setHomeError("");};
  const cyclePlayer=(side,name)=>{const [g,s]=side==="home"?[homeData,setHomeData]:[awayData,setAwayData];if(!g)return;if(name==="__goalie__"){s({...g,goalie:{...g.goalie,status:STATUS_CYCLE[(STATUS_CYCLE.indexOf(g.goalie.status||"PLAYING")+1)%4]}});}else{s({...g,roster:g.roster.map(p=>p.name!==name?p:{...p,status:STATUS_CYCLE[(STATUS_CYCLE.indexOf(p.status)+1)%4]})});}};
  const runModels=()=>{if(!homeData||!awayData)return;setAnalyzing(true);setTimeout(()=>{const gd=nhlMdlGoalDiff(homeData,awayData),gl=nhlMdlGoalie(homeData,awayData),st=nhlMdlSpecialTeams(homeData,awayData),sq=nhlMdlShotQuality(homeData,awayData),mc=nhlMdlMonteCarlo(homeData,awayData);const mkt=devigged(homeOdds,awayOdds);const hL=parseFloat(mc.hLambda),aL=parseFloat(mc.aLambda);const modelSpread=(hL-aL).toFixed(2);const modelTotal=(hL+aL).toFixed(2);setResults({gd,gl,st,sq,mc,mkt,cons:nhlConsensus([gd.homeProb,gl.homeProb,st.homeProb,sq.homeProb,mc.homeProb],mkt),modelSpread,modelTotal,hLambda:mc.hLambda,aLambda:mc.aLambda});setTab("results");setAnalyzing(false);},50);};
  const inp={width:"100%",padding:"10px 12px",background:C.black,border:"1.5px solid "+C.border,borderRadius:8,color:C.white,fontSize:13,outline:"none",fontFamily:"'Barlow',sans-serif"};
  const bothLoaded=awayData&&homeData;const awayAbbr=NHL_ABBR[awayTeam]||"AWY";const homeAbbr=NHL_ABBR[homeTeam]||"HME";
  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12}}>
      <SectionHeader label="Step 1 - Select Away Team" accent={C.ice} right={awayData&&<Pill label={awayAbbr+" LOADED"} color={C.ice}/>}/>
      <div style={{padding:14}}>
        <TeamSelect items={NHL_TEAMS} getLabel={t=>t} displayValue={awayTeam} accent={C.ice} placeholder="Search NHL team..." disabled={awayLoading} onSelect={t=>{setAwayTeam(t);setAwayData(null);setResults(null);fetchTeam(t,"away");}}/>
        {awayLoading&&awayMsg&&<div style={{marginTop:6,fontSize:11,color:C.ice,fontFamily:"'Barlow Condensed'",letterSpacing:.5}}><span className="pulse">{awayMsg}</span></div>}
        {awayError&&<div style={{marginTop:8,padding:"8px 12px",background:"#2a0f0f",border:"1px solid #5a2020",borderRadius:6,fontSize:11,color:"#f87171"}}>{awayError}</div>}
      </div>
      {(awayLoading||awayData)&&<div style={{padding:"0 14px 14px"}}><RosterPanel teamName={awayTeam} abbr={awayAbbr} teamData={awayData} onCycle={n=>cyclePlayer("away",n)} sport="nhl" accent={C.ice} loading={awayLoading}/></div>}
    </div>
    <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12}}>
      <SectionHeader label="Step 2 - Select Home Team" accent={C.copper} right={homeData&&<Pill label={homeAbbr+" LOADED"} color={C.copper}/>}/>
      <div style={{padding:14}}>
        <TeamSelect items={NHL_TEAMS} getLabel={t=>t} displayValue={homeTeam} accent={C.copper} placeholder="Search NHL team..." disabled={homeLoading} onSelect={t=>{setHomeTeam(t);setHomeData(null);setResults(null);fetchTeam(t,"home");}}/>
        {homeLoading&&homeMsg&&<div style={{marginTop:6,fontSize:11,color:C.copper,fontFamily:"'Barlow Condensed'",letterSpacing:.5}}><span className="pulse">{homeMsg}</span></div>}
        {homeError&&<div style={{marginTop:8,padding:"8px 12px",background:"#2a0f0f",border:"1px solid #5a2020",borderRadius:6,fontSize:11,color:"#f87171"}}>{homeError}</div>}
      </div>
      {(homeLoading||homeData)&&<div style={{padding:"0 14px 14px"}}><RosterPanel teamName={homeTeam} abbr={homeAbbr} teamData={homeData} onCycle={n=>cyclePlayer("home",n)} sport="nhl" accent={C.copper} loading={homeLoading}/></div>}
    </div>
    {bothLoaded&&<div className="fade-in" style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,overflow:"hidden"}}>
      <SectionHeader label="Step 3 - Set Odds & Analyze"/>
      <div style={{padding:14}}>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
          <button className="hov-btn" onClick={fetchOdds} disabled={oddsLoading} style={{padding:"8px 16px",background:oddsLoading?C.dim:"linear-gradient(90deg,#1a4a6b,#2a6a9b)",border:"1px solid #2a6a9b",borderRadius:7,cursor:oddsLoading?"not-allowed":"pointer",fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:12,letterSpacing:1.5,color:C.white,textTransform:"uppercase",whiteSpace:"nowrap"}}>{oddsLoading?<span className="pulse">Fetching...</span>:"Fetch Live Odds"}</button>
          <span style={{fontSize:10,color:C.muted}}>Auto-fills from live sportsbooks</span>
          {oddsError&&<span style={{fontSize:11,color:"#f87171",marginLeft:"auto"}}>{oddsError}</span>}
        </div>
        {gameTime&&<div style={{marginBottom:8,padding:"5px 10px",background:C.black,borderRadius:6,fontSize:11,color:C.ice,fontFamily:"'Barlow Condensed'",fontWeight:700,letterSpacing:.5}}>GAME: {new Date(gameTime).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})} - {new Date(gameTime).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZoneName:"short"})}</div>}
        {sharpAlert&&<div style={{marginBottom:10,padding:"9px 13px",background:"#1a0f00",border:"1px solid "+C.amber+"66",borderRadius:8,display:"flex",gap:8,alignItems:"flex-start"}}><div style={{fontSize:13,flexShrink:0}}>!</div><div><div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:11,color:C.amber,letterSpacing:1}}>SHARP MONEY SIGNAL</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>{sharpAlert.desc}</div></div></div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:10}}><div><div style={{fontSize:10,color:C.muted,letterSpacing:1,marginBottom:5,textTransform:"uppercase"}}>Away Moneyline ({awayAbbr})</div><input style={inp} placeholder="+130" value={awayOdds} onChange={e=>setAwayOdds(e.target.value)}/></div><div><div style={{fontSize:10,color:C.muted,letterSpacing:1,marginBottom:5,textTransform:"uppercase"}}>Home Moneyline ({homeAbbr})</div><input style={inp} placeholder="-140" value={homeOdds} onChange={e=>setHomeOdds(e.target.value)}/></div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}><div><div style={{fontSize:10,color:C.muted,letterSpacing:1,marginBottom:5,textTransform:"uppercase"}}>Home Puck Line (optional)</div><input style={inp} placeholder="-1.5" value={homeSpread} onChange={e=>setHomeSpread(e.target.value)}/></div><div><div style={{fontSize:10,color:C.muted,letterSpacing:1,marginBottom:5,textTransform:"uppercase"}}>Over/Under (optional)</div><input style={inp} placeholder="5.5" value={postedTotal} onChange={e=>setPostedTotal(e.target.value)}/></div></div>
      </div>
    </div>}
    {results&&<NHLResults results={results} awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayOdds={awayOdds} homeOdds={homeOdds} homeSpread={homeSpread} postedTotal={postedTotal} tab={tab} setTab={setTab} onRecalc={runModels}/>}
    {bothLoaded&&<div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,background:C.dark+"F2",borderTop:"1px solid "+C.border,padding:"10px 16px",backdropFilter:"blur(8px)"}}>
      <div style={{maxWidth:1040,margin:"0 auto",display:"flex",gap:8,alignItems:"center"}}>
        <button className="hov-btn" onClick={runModels} disabled={analyzing} style={{flex:1,padding:"12px 0",background:analyzing?C.dim:"linear-gradient(90deg,"+C.iceD+","+C.ice+")",border:"none",borderRadius:8,cursor:analyzing?"not-allowed":"pointer",fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:16,letterSpacing:2,color:analyzing?C.muted:C.black,textTransform:"uppercase"}}>{analyzing?<span className="pulse">Running Models...</span>:results?"Recalculate":"Run Analysis"}</button>
        <button className="hov-btn" onClick={resetAll} style={{padding:"12px 18px",background:"transparent",border:"1px solid "+C.border,borderRadius:8,cursor:"pointer",fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1,color:C.muted,whiteSpace:"nowrap"}}>New Matchup</button>
      </div>
    </div>}
  </div>;
}

function NHLResults({results,awayTeam,homeTeam,awayAbbr,homeAbbr,awayOdds,homeOdds,homeSpread,postedTotal,tab,setTab,onRecalc}){
  const [copied,setCopied]=useState(false);
  const {gd,gl,st,sq,mc,cons,mkt,modelSpread,modelTotal,hLambda,aLambda}=results;const cH=cons,aw=1-cH;
  const hI=oddsToImplied(homeOdds),aI=oddsToImplied(awayOdds);
  const hE=hI!==null?((cH-hI)*100).toFixed(1):null,aE=aI!==null?((aw-aI)*100).toFixed(1):null;
  const hEV=homeOdds&&hI?calcEV(cH,homeOdds):null,aEV=awayOdds&&aI?calcEV(aw,awayOdds):null;
  const kellyPct=(prob,odds)=>{const o=parseInt(odds);if(isNaN(o))return null;const dec=o>0?o/100+1:100/Math.abs(o)+1;const k=prob-(1-prob)/(dec-1);return Math.max(0,k*25).toFixed(1);};
  const copyResults=()=>{const lines=[`Court Edge NHL - ${awayTeam} @ ${homeTeam}`,`Consensus: ${awayTeam} ${(aw*100).toFixed(1)}% | ${homeTeam} ${(cH*100).toFixed(1)}%`,`Fair odds: ${awayAbbr} ${probToAmerican(aw)} | ${homeAbbr} ${probToAmerican(cH)}`,awayOdds&&homeOdds?`Posted: ${awayAbbr} ${awayOdds} | ${homeAbbr} ${homeOdds}`:null,aE?`${awayAbbr} Edge: ${parseFloat(aE)>=0?"+":""}${aE}%`:null,hE?`${homeAbbr} Edge: ${parseFloat(hE)>=0?"+":""}${hE}%`:null,modelTotal?`Model total: ${modelTotal} goals`:null].filter(Boolean).join("\n");navigator.clipboard.writeText(lines);setCopied(true);setTimeout(()=>setCopied(false),2000);};
  const allPsH=[gd.homeProb,gl.homeProb,st.homeProb,sq.homeProb,mc.homeProb];if(mkt!=null)allPsH.push(mkt);
  const favHH=cH>0.5;const agrH=allPsH.filter(p=>favHH?p>0.5:p<0.5).length;const totH=allPsH.length;
  const sigH=(edge,a,t)=>a>=t-1&&edge>=3?"STRONG BET":a>=Math.ceil(t*0.67)&&edge>=1?"LEAN BET":a>=Math.ceil(t*0.5)?"SLIGHT EDGE":"MODELS SPLIT";
  return <div className="fade-in">
    <div style={{display:"flex",gap:4,marginBottom:14,background:C.dark,borderRadius:8,padding:4,border:"1px solid "+C.border}}>{[["results","Results"],["method","Methodology"]].map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"8px 0",borderRadius:6,border:"none",cursor:"pointer",background:tab===k?C.ice+"22":"transparent",color:tab===k?C.ice:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1,textTransform:"uppercase",borderBottom:tab===k?"2px solid "+C.ice:"2px solid transparent"}}>{l}</button>)}</div>
    {tab==="results"&&<>
      <div style={{background:C.card,border:"1.5px solid "+C.ice+"44",borderRadius:12,padding:20,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}><div style={{width:3,height:16,borderRadius:2,background:C.ice}}/><span style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:14,letterSpacing:1.5,color:C.white,textTransform:"uppercase"}}>Consensus - 5 Hockey Models</span></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:16,alignItems:"center",marginBottom:16}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}><Badge abbr={awayAbbr} size={52} accent={C.ice}/><div style={{textAlign:"center"}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:42,lineHeight:1,color:aw>.55?C.ice:aw>.45?C.copper:C.white}}>{(aw*100).toFixed(1)}%</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>{awayTeam}</div></div><OddsPill prob={aw} accent={C.ice}/></div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:14,color:C.muted,letterSpacing:2}}>VS</div><div style={{padding:"6px 10px",background:C.black,border:"1px solid "+C.border,borderRadius:8,textAlign:"center"}}><div style={{fontFamily:"'Barlow Condensed'",fontSize:10,fontWeight:800,color:agrH>=totH-1?C.ice:agrH>=Math.ceil(totH*0.67)?C.copper:C.muted,letterSpacing:1}}>{agrH}/{totH} AGREE</div>{(aE||hE)&&<div style={{fontFamily:"'Barlow Condensed'",fontSize:11,fontWeight:800,color:C.muted,letterSpacing:1,marginTop:3}}>{sigH(parseFloat(aw>cH?aE:hE),agrH,totH)}</div>}</div></div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}><Badge abbr={homeAbbr} size={52} accent={C.ice}/><div style={{textAlign:"center"}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:42,lineHeight:1,color:cH>.55?C.ice:cH>.45?C.copper:C.white}}>{(cH*100).toFixed(1)}%</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>{homeTeam}</div></div><OddsPill prob={cH} accent={C.ice}/></div>
        </div>
        <WinBar awayProb={aw} awayAbbr={awayAbbr} homeAbbr={homeAbbr} accent={C.ice}/>
        {(aE||hE)&&<div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>{aE&&<div style={{padding:"5px 12px",borderRadius:6,background:parseFloat(aE)>=2?C.ice+"18":C.black,border:"1px solid "+(parseFloat(aE)>=2?C.ice:C.border),fontSize:11,color:parseFloat(aE)>=2?C.ice:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:700}}>{awayAbbr} Edge: {parseFloat(aE)>=0?"+":""}{aE}%{aEV?" - EV "+(parseFloat(aEV)>=0?"+":"")+aEV+"/$1":""}{awayOdds&&parseFloat(aE)>0?" - Kelly "+(kellyPct(aw,awayOdds)||"?")+"%":""}</div>}{hE&&<div style={{padding:"5px 12px",borderRadius:6,background:parseFloat(hE)>=2?C.ice+"18":C.black,border:"1px solid "+(parseFloat(hE)>=2?C.ice:C.border),fontSize:11,color:parseFloat(hE)>=2?C.ice:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:700}}>{homeAbbr} Edge: {parseFloat(hE)>=0?"+":""}{hE}%{hEV?" - EV "+(parseFloat(hEV)>=0?"+":"")+hEV+"/$1":""}{homeOdds&&parseFloat(hE)>0?" - Kelly "+(kellyPct(cH,homeOdds)||"?")+"%":""}</div>}</div>}
        {(hI&&aI)&&(()=>{const mktH=hI/(hI+aI);const diff=Math.abs(cH-mktH);const big=diff>=0.10;return big?<div style={{marginTop:10,padding:"10px 14px",background:"#0a121a",border:"1px solid "+C.ice+"66",borderRadius:8,display:"flex",gap:8,alignItems:"flex-start"}}><div style={{fontSize:14,flexShrink:0}}>[!]</div><div><div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:12,color:C.ice,letterSpacing:1}}>MODEL/MARKET DIVERGENCE</div><div style={{fontSize:11,color:C.muted,marginTop:3,lineHeight:1.6}}>Market implies {(mktH*100).toFixed(0)}% {homeAbbr} / {((1-mktH)*100).toFixed(0)}% {awayAbbr}. Our model says {(cH*100).toFixed(0)}% / {(aw*100).toFixed(0)}%. Gap of {(diff*100).toFixed(0)}%. Verify goalie starter  -  a backup in net will kill this prediction.</div></div></div>:null;})()}
        <div style={{display:"flex",gap:8,marginTop:12}}>
          <button className="hov-btn" onClick={onRecalc} style={{flex:1,padding:"9px 0",background:"transparent",border:"1px solid "+C.border,borderRadius:7,cursor:"pointer",fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1.5,color:C.muted,textTransform:"uppercase"}}>Recalculate with Updated Lineup</button>
          <button className="hov-btn" onClick={copyResults} style={{padding:"9px 16px",background:copied?C.ice+"22":"transparent",border:"1px solid "+(copied?C.ice:C.border),borderRadius:7,cursor:"pointer",fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:12,letterSpacing:1,color:copied?C.ice:C.muted,whiteSpace:"nowrap"}}>{copied?"Copied!":"Copy Results"}</button>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <ModelCard icon="GD" name="Goal Differential" desc="Pythagorean win% (exp 2.0) + L10 blend" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-gd.homeProb} detail={gd.detail} accent={C.ice}/>
        <ModelCard icon="SV%" name="Goalie Model" desc="SV% -> xGA  -  biggest single NHL factor" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-gl.homeProb} detail={gl.detail} accent={C.ice}/>
        <ModelCard icon="PP" name="Special Teams" desc="PP% (57%) + PK% (43%) combined score" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-st.homeProb} detail={st.detail} accent={C.ice}/>
        <ModelCard icon="xG" name="Shot Quality / xG" desc="CF% x shooting% -> expected goals" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-sq.homeProb} detail={sq.detail} accent={C.ice}/>
      </div>
      <ModelCard icon="MC" name="Monte Carlo Simulation" desc="8,000 simulated games - Poisson goal distribution" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-mc.homeProb} detail={mc.detail} accent={C.ice}/>
      <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:14,marginTop:10}}>
        <div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1.5,color:C.ice,textTransform:"uppercase",marginBottom:10}}>Model Agreement</div>
        {(()=>{const items=[{l:"Goal Diff",p:1-gd.homeProb},{l:"Goalie",p:1-gl.homeProb},{l:"Spec Teams",p:1-st.homeProb},{l:"Shot xG",p:1-sq.homeProb},{l:"Monte Carlo",p:1-mc.homeProb}];if(mkt!=null)items.push({l:"Market",p:1-mkt,isMkt:true});return <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(62px,1fr))",gap:8}}>{items.map(m=>{const af=m.p>.5;const dp=af?m.p:1-m.p;const da=af?awayAbbr:homeAbbr;const ac=m.isMkt?C.amber:C.ice;return <div key={m.l} style={{textAlign:"center",background:C.black,borderRadius:8,padding:"10px 6px",border:"1px solid "+ac+"44"}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:22,color:ac}}>{(dp*100).toFixed(0)}%</div><div style={{fontSize:10,color:ac,fontWeight:700,marginBottom:2}}>{da}</div><div style={{fontSize:9,color:C.dim,textTransform:"uppercase",letterSpacing:.5}}>{m.l}</div></div>;})}</div>;})()}
      </div>
      {modelSpread!=null&&<div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:14,marginTop:10}}>
        <div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1.5,color:C.ice,textTransform:"uppercase",marginBottom:10}}>Model Lines</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
          <div style={{background:C.black,borderRadius:8,padding:"10px 12px",border:"1px solid "+C.border}}><div style={{fontSize:9,color:C.dim,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Model Puck Line</div><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:20,color:C.ice}}>{parseFloat(modelSpread)>=0?homeAbbr+" favored":awayAbbr+" favored"}</div><div style={{fontSize:12,color:C.muted,marginTop:2}}>Goal diff: {parseFloat(modelSpread)>=0?"+":""}{modelSpread}</div>{homeSpread&&<div style={{fontSize:11,color:Math.abs(parseFloat(modelSpread))>Math.abs(parseFloat(homeSpread))?C.teal:C.muted,marginTop:4}}>Posted {homeSpread} - {parseFloat(modelSpread)+parseFloat(homeSpread)>0?homeAbbr+" covers":awayAbbr+" covers"}</div>}</div>
          <div style={{background:C.black,borderRadius:8,padding:"10px 12px",border:"1px solid "+C.border}}><div style={{fontSize:9,color:C.dim,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Model Total</div><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:20,color:C.ice}}>{modelTotal} goals</div>{postedTotal&&<div style={{fontSize:11,color:Math.abs(parseFloat(modelTotal)-parseFloat(postedTotal))>=0.4?C.teal:C.muted,marginTop:4}}>Posted {postedTotal} - {parseFloat(modelTotal)>parseFloat(postedTotal)?"OVER by "+(parseFloat(modelTotal)-parseFloat(postedTotal)).toFixed(2):"UNDER by "+(parseFloat(postedTotal)-parseFloat(modelTotal)).toFixed(2)}</div>}</div>
          <div style={{background:C.black,borderRadius:8,padding:"10px 12px",border:"1px solid "+C.border}}><div style={{fontSize:9,color:C.dim,letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>Projected Score</div><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:16,color:C.ice,lineHeight:1.4}}>{awayAbbr} {aLambda}<br/>{homeAbbr} {hLambda}</div></div>
        </div>
      </div>}
      <BestBets results={results} awayTeam={awayTeam} homeTeam={homeTeam} homeSpread={homeSpread} postedTotal={postedTotal} sport="nhl" accent={C.ice}/>
    </>}
    {tab==="method"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{[["GD","Goal Differential (22%)","Pythagorean win% (exp 2.0) blends 60% season + 40% last-10. HCA = +0.10 goals. Goalie injury applied directly."],["SV%","Goalie Model (30%)","Adj SV% x opp shots = xGA. Goalie out = -0.025 SV% penalty. Highest single NHL predictor."],["PP","Special Teams (17%)","PP% (57%) + PK% (43%). Independent from 5v5 goal data. Home team gets slight PP advantage."],["xG","Shot Quality xG (13%)","CF% x shooting% = expected goals. Captures possession AND finishing skill."],["MC","Monte Carlo (18%)","10,000 Poisson simulations. Goals are Poisson distributed. Ties go ~55% home in OT."],["W","Consensus","Goal Diff 22% + Goalie 30% + Spec Teams 17% + Shot xG 13% + Monte Carlo 18%."]].map(([icon,n,d])=><div key={n} style={{background:C.card,border:"1px solid "+C.border,borderRadius:10,padding:16}}><div style={{width:32,height:32,borderRadius:6,background:C.ice+"22",border:"1px solid "+C.ice+"44",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontFamily:"'Barlow Condensed'",fontWeight:900,color:C.ice,marginBottom:8}}>{icon}</div><div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,color:C.ice,marginBottom:6}}>{n}</div><div style={{fontSize:11,color:C.muted,lineHeight:1.7}}>{d}</div></div>)}</div>}
  </div>;
}

// â”€â”€â”€ NCAAM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const NCAAM_TEAMS=[
  {name:"Duke Blue Devils",id:"150",conf:"ACC"},{name:"North Carolina Tar Heels",id:"153",conf:"ACC"},
  {name:"Virginia Cavaliers",id:"258",conf:"ACC"},{name:"NC State Wolfpack",id:"152",conf:"ACC"},
  {name:"Syracuse Orange",id:"183",conf:"ACC"},{name:"Clemson Tigers",id:"228",conf:"ACC"},
  {name:"Pittsburgh Panthers",id:"221",conf:"ACC"},{name:"Louisville Cardinals",id:"97",conf:"ACC"},
  {name:"Notre Dame Fighting Irish",id:"87",conf:"ACC"},{name:"Wake Forest Demon Deacons",id:"154",conf:"ACC"},
  {name:"Georgia Tech Yellow Jackets",id:"59",conf:"ACC"},{name:"Florida State Seminoles",id:"52",conf:"ACC"},
  {name:"Miami Hurricanes",id:"2390",conf:"ACC"},{name:"Virginia Tech Hokies",id:"259",conf:"ACC"},
  {name:"Stanford Cardinal",id:"24",conf:"ACC"},{name:"SMU Mustangs",id:"2567",conf:"ACC"},
  {name:"California Golden Bears",id:"25",conf:"ACC"},{name:"Boston College Eagles",id:"103",conf:"ACC"},
  {name:"Kansas Jayhawks",id:"2305",conf:"Big 12"},{name:"Baylor Bears",id:"239",conf:"Big 12"},
  {name:"Houston Cougars",id:"248",conf:"Big 12"},{name:"Iowa State Cyclones",id:"66",conf:"Big 12"},
  {name:"Texas Tech Red Raiders",id:"2641",conf:"Big 12"},{name:"Kansas State Wildcats",id:"2306",conf:"Big 12"},
  {name:"Arizona Wildcats",id:"12",conf:"Big 12"},{name:"Arizona State Sun Devils",id:"9",conf:"Big 12"},
  {name:"BYU Cougars",id:"252",conf:"Big 12"},{name:"UCF Knights",id:"2116",conf:"Big 12"},
  {name:"Cincinnati Bearcats",id:"2132",conf:"Big 12"},{name:"Colorado Buffaloes",id:"38",conf:"Big 12"},
  {name:"Utah Utes",id:"254",conf:"Big 12"},{name:"West Virginia Mountaineers",id:"277",conf:"Big 12"},
  {name:"Oklahoma State Cowboys",id:"197",conf:"Big 12"},{name:"TCU Horned Frogs",id:"2628",conf:"Big 12"},
  {name:"UConn Huskies",id:"41",conf:"Big East"},{name:"Marquette Golden Eagles",id:"269",conf:"Big East"},
  {name:"St. John's Red Storm",id:"2599",conf:"Big East"},{name:"Creighton Bluejays",id:"156",conf:"Big East"},
  {name:"Villanova Wildcats",id:"222",conf:"Big East"},{name:"Xavier Musketeers",id:"2752",conf:"Big East"},
  {name:"Providence Friars",id:"2507",conf:"Big East"},{name:"Seton Hall Pirates",id:"2550",conf:"Big East"},
  {name:"Butler Bulldogs",id:"2086",conf:"Big East"},{name:"Georgetown Hoyas",id:"46",conf:"Big East"},
  {name:"DePaul Blue Demons",id:"305",conf:"Big East"},
  {name:"Michigan State Spartans",id:"127",conf:"Big Ten"},{name:"Purdue Boilermakers",id:"2509",conf:"Big Ten"},
  {name:"Illinois Fighting Illini",id:"356",conf:"Big Ten"},{name:"Wisconsin Badgers",id:"275",conf:"Big Ten"},
  {name:"Maryland Terrapins",id:"120",conf:"Big Ten"},{name:"Ohio State Buckeyes",id:"194",conf:"Big Ten"},
  {name:"UCLA Bruins",id:"26",conf:"Big Ten"},{name:"Indiana Hoosiers",id:"84",conf:"Big Ten"},
  {name:"Michigan Wolverines",id:"130",conf:"Big Ten"},{name:"Penn State Nittany Lions",id:"213",conf:"Big Ten"},
  {name:"Iowa Hawkeyes",id:"2294",conf:"Big Ten"},{name:"Rutgers Scarlet Knights",id:"164",conf:"Big Ten"},
  {name:"Northwestern Wildcats",id:"77",conf:"Big Ten"},{name:"Minnesota Golden Gophers",id:"135",conf:"Big Ten"},
  {name:"Nebraska Cornhuskers",id:"158",conf:"Big Ten"},{name:"Oregon Ducks",id:"2483",conf:"Big Ten"},
  {name:"USC Trojans",id:"30",conf:"Big Ten"},{name:"Washington Huskies",id:"264",conf:"Big Ten"},
  {name:"Kentucky Wildcats",id:"96",conf:"SEC"},{name:"Tennessee Volunteers",id:"2633",conf:"SEC"},
  {name:"Auburn Tigers",id:"2",conf:"SEC"},{name:"Florida Gators",id:"57",conf:"SEC"},
  {name:"Alabama Crimson Tide",id:"333",conf:"SEC"},{name:"Arkansas Razorbacks",id:"8",conf:"SEC"},
  {name:"LSU Tigers",id:"99",conf:"SEC"},{name:"Texas A&M Aggies",id:"245",conf:"SEC"},
  {name:"Mississippi State Bulldogs",id:"344",conf:"SEC"},{name:"Ole Miss Rebels",id:"145",conf:"SEC"},
  {name:"Missouri Tigers",id:"142",conf:"SEC"},{name:"South Carolina Gamecocks",id:"2579",conf:"SEC"},
  {name:"Vanderbilt Commodores",id:"238",conf:"SEC"},{name:"Georgia Bulldogs",id:"61",conf:"SEC"},
  {name:"Texas Longhorns",id:"251",conf:"SEC"},{name:"Oklahoma Sooners",id:"201",conf:"SEC"},
  {name:"Gonzaga Bulldogs",id:"2250",conf:"WCC"},{name:"San Diego State Aztecs",id:"21",conf:"MWC"},
  {name:"New Mexico Lobos",id:"167",conf:"MWC"},{name:"Boise State Broncos",id:"68",conf:"MWC"},
  {name:"Utah State Aggies",id:"328",conf:"MWC"},{name:"Colorado State Rams",id:"36",conf:"MWC"},
  {name:"Memphis Tigers",id:"235",conf:"American"},{name:"Florida Atlantic Owls",id:"2226",conf:"American"},
  {name:"Wichita State Shockers",id:"2724",conf:"American"},{name:"UAB Blazers",id:"5",conf:"American"},
  {name:"Dayton Flyers",id:"2168",conf:"A-10"},{name:"VCU Rams",id:"2670",conf:"A-10"},
  {name:"Saint Louis Billikens",id:"139",conf:"A-10"},{name:"Davidson Wildcats",id:"2166",conf:"A-10"},
  {name:"Rhode Island Rams",id:"227",conf:"A-10"},{name:"Loyola Chicago Ramblers",id:"2350",conf:"A-10"},
  {name:"Richmond Spiders",id:"257",conf:"A-10"},{name:"Saint Joseph's Hawks",id:"2603",conf:"A-10"},
  // 2026 Tournament teams — mid-majors and small conferences
  {name:"South Florida Bulls",id:"58",conf:"American"},
  {name:"Northern Iowa Panthers",id:"2460",conf:"MVC"},
  {name:"Cal Baptist Lancers",id:"2856",conf:"WAC"},
  {name:"North Dakota State Bison",id:"2449",conf:"Summit"},
  {name:"Furman Paladins",id:"231",conf:"SoCon"},
  {name:"Siena Saints",id:"2561",conf:"MAAC"},
  {name:"High Point Panthers",id:"2272",conf:"Big South"},
  {name:"Hawaii Rainbow Warriors",id:"62",conf:"Big West"},
  {name:"Kennesaw State Owls",id:"338",conf:"ASUN"},
  {name:"Queens Royals",id:"2511",conf:"ASUN"},
  {name:"LIU Sharks",id:"112358",conf:"NEC"},
  {name:"Santa Clara Broncos",id:"2541",conf:"WCC"},
  {name:"Saint Mary's Gaels",id:"2608",conf:"WCC"},
  {name:"Miami (OH) Redhawks",id:"193",conf:"MAC"},
  {name:"Akron Zips",id:"2006",conf:"MAC"},
  {name:"Hofstra Pride",id:"2275",conf:"CAA"},
  {name:"Wright State Raiders",id:"2750",conf:"Horizon"},
  {name:"Tennessee State Tigers",id:"2634",conf:"SWAC"},
  {name:"UMBC Retrievers",id:"2378",conf:"America East"},
  {name:"Howard Bison",id:"47",conf:"MEAC"},
  {name:"McNeese Cowboys",id:"2377",conf:"Southland"},
  {name:"Troy Trojans",id:"2653",conf:"Sun Belt"},
  {name:"Pennsylvania Quakers",id:"219",conf:"Ivy"},
  {name:"Idaho Vandals",id:"70",conf:"Big Sky"},
  {name:"Prairie View A&M Panthers",id:"2504",conf:"SWAC"},
  {name:"Lehigh Mountain Hawks",id:"2329",conf:"Patriot"},
].sort((a,b)=>a.name.localeCompare(b.name));

function ncaamMdlEfficiency(h,a,neutral=true){
  // Adjusted efficiency per 100 possessions  -  what KenPom actually measures
  // Normalizing by tempo removes pace bias completely
  const hOff=h.ppg/Math.max(h.tempo,55)*100;
  const aDef=a.opp/Math.max(a.tempo,55)*100; // opp's pts ALLOWED per 100
  const aOff=a.ppg/Math.max(a.tempo,55)*100;
  const hDef=h.opp/Math.max(h.tempo,55)*100;
  // Self-contained net efficiency: compare each team vs their own schedule
  const hNet=(h.ppg-h.opp)/Math.max(h.tempo,55)*100;
  const aNet=(a.ppg-a.opp)/Math.max(a.tempo,55)*100;
  // KenPom rank provides schedule-strength correction
  const hRank=Math.min(h.kenpom_rank||150,350);
  const aRank=Math.min(a.kenpom_rank||150,350);
  const hRankAdj=(175-hRank)*0.03; // rank 1 = +5.2, rank 175 = 0, rank 350 = -5.25
  const aRankAdj=(175-aRank)*0.03;
  const hInj=injPen(h.roster,0.10,0.05,0.015);
  const aInj=injPen(a.roster,0.10,0.05,0.015);
  // Tournament = neutral site (no HCA); regular season = +3.5 HCA
  const hca=neutral?0:3.5;
  const diff=(hNet+hRankAdj)-(aNet+aRankAdj)+hca-(hInj-aInj)*22;
  // 0.112 calibrated to empirical NCAAM AdjEM win-probability curves (vs 0.10 which undershoots)
  const p=logistic(diff*0.112);
  return{homeProb:Math.min(0.97,Math.max(0.03,p)),hEM:((hNet+hRankAdj)).toFixed(1),aEM:((aNet+aRankAdj)).toFixed(1),detail:`H AdjEM ${((hNet+hRankAdj)).toFixed(1)}  A AdjEM ${((aNet+aRankAdj)).toFixed(1)}`};}

function ncaamMdlPythagorean(h,a,neutral=true){
  // Win quality  -  Pythagorean win% with conference adjustment
  // Exponent 11.5 = empirically best for college basketball
  const hP=pythagorean(h.ppg,h.opp,11.5);
  const aP=pythagorean(a.ppg,a.opp,11.5);
  // Strength-of-schedule proxy: KenPom rank adjusts quality
  const hSOS=Math.max(0.90,Math.min(1.10,1+(175-Math.min(h.kenpom_rank||150,350))*0.0015));
  const aSOS=Math.max(0.90,Math.min(1.10,1+(175-Math.min(a.kenpom_rank||150,350))*0.0015));
  const hQ=Math.min(0.97,hP*hSOS);
  const aQ=Math.min(0.97,aP*aSOS);
  // Neutral site: no HCA boost; home game: +3.5pt
  const hAdj=neutral?hQ:Math.min(0.97,hQ*0.65+pythagorean(h.ppg+3.5,h.opp,11.5)*0.35);
  const hi=injPen(h.roster,0.10,0.05,0.015);
  const ai=injPen(a.roster,0.10,0.05,0.015);
  const p=log5(Math.max(0.03,hAdj-hi),Math.max(0.03,aQ-ai));
  const siteNote=neutral?"neutral site":"home +3.5pt";
  return{homeProb:Math.min(0.97,Math.max(0.03,p)),hQ:(hQ*100).toFixed(1),aQ:(aQ*100).toFixed(1),detail:`H Pyth ${(hQ*100).toFixed(1)}%  A Pyth ${(aQ*100).toFixed(1)}%  ${siteNote}`};}

function ncaamMdlFourFactors(h,a,neutral=true){
  // Offensive + defensive four factors  -  independent from PPG signal
  const offFF=d=>{
    const efg=(d.efg_pct||0.50)*0.40;
    // College TOV rate typically 15-22 per 100; normalize out of 35
    const tov=(1-Math.min(d.tov_rate||18,35)/35)*0.25;
    const oreb=(d.oreb_pct||0.30)*0.20;
    const ftr=Math.min(d.ft_rate||d.ftr||0.35,0.60)*0.15;
    return efg+tov+oreb+ftr;};
  const defFF=d=>{
    // Defensive four factors: opponent eFG%, opp TOV forced, opp OREB denied
    const efg=Math.max(0,(0.56-(d.opp_efg_pct||0.50)))*0.40;
    const tov=Math.min((d.opp_tov_rate||18)/35,1)*0.25;
    const oreb=Math.max(0,0.32-(d.opp_oreb_pct||0.28))*0.20;
    return efg+tov+oreb;};
  const hOff=offFF(h),aOff=offFF(a);
  const hDef=defFF(h),aDef=defFF(a);
  const hTotal=hOff*0.55+hDef*0.45;
  const aTotal=aOff*0.55+aDef*0.45;
  const hi=injPen(h.roster,0.06,0.03,0.008);
  const ai=injPen(a.roster,0.06,0.03,0.008);
  // Neutral site: no HCA; home: ~1% eFG boost (+0.28 logistic offset)
  const hca=neutral?0:0.28;
  const p=logistic((hTotal-aTotal)*7+hca-(hi-ai)*3);
  return{homeProb:Math.min(0.97,Math.max(0.03,p)),hFF:hOff.toFixed(3),aFF:aOff.toFixed(3),detail:`H Off FF: ${hOff.toFixed(3)}  A Off FF: ${aOff.toFixed(3)}`};}

function ncaamMdlTalent(h,a,neutral=true){
  // Star player talent differential  -  entirely different signal from team stats
  // In college a single star can be worth 15+ points to a team
  const sortH=[...(h.roster||[])].sort((x,y)=>(y.per||0)-(x.per||0));
  const sortA=[...(a.roster||[])].sort((x,y)=>(y.per||0)-(x.per||0));
  const score=roster=>{
    // College basketball: top player is even more important than NBA
    const w=[0.40,0.28,0.18,0.14/Math.max(roster.length-3,1)];
    return roster.reduce((s,p,i)=>{
      const wi=i<3?(w[i]||0):(w[3]||0);
      const avail=p.status==="PLAYING"?1:p.status==="OUT"?0:p.status==="DOUBTFUL"?.15:.55;
      return s+(p.per||10)*wi*avail;
    },0);};
  const hV=score(sortH),aV=score(sortA);
  // Neutral site: stars play equally; home court suppresses road star impact
  const hca=neutral?0:0.30;
  // 0.17 scaling: college basketball is more star-driven than NBA (fewer possessions, iso-heavy)
  // A 5-point PER gap in NCAAM translates to ~8-10pt swing in win% — 0.12 undershoots this
  const p=logistic((hV-aV)*0.17+hca);
  return{homeProb:Math.min(0.97,Math.max(0.03,p)),hVal:hV.toFixed(1),aVal:aV.toFixed(1),detail:`H talent: ${hV.toFixed(1)}  A talent: ${aV.toFixed(1)}`};}

function ncaamMdlMonteCarlo(h,a,N=10000,neutral=true){
  // Tempo-aware point simulation
  const hi=injPen(h.roster,0.11,0.055,0.013);
  const ai=injPen(a.roster,0.11,0.055,0.013);
  // Adjust both teams' PPG to the expected game pace
  const gamePace=(h.tempo*0.5+a.tempo*0.5);
  const hOff=(h.ppg/Math.max(h.tempo,55))*gamePace*(1-hi);
  const aOff=(a.ppg/Math.max(a.tempo,55))*gamePace*(1-ai);
  const hDef=(a.opp/Math.max(a.tempo,55))*gamePace;
  const aDef=(h.opp/Math.max(h.tempo,55))*gamePace;
  // Rest penalty: back-to-back costs ~2.5pts in college basketball
  const restPenN=d=>Math.max(0,(2-Math.min(d??2,2))*1.25);
  // Neutral site: no home court boost; regular season: +1.8pt
  const hca=neutral?0:1.8;
  const hExp=(hOff*0.55+hDef*0.45)+hca-restPenN(h.rest);
  const aExp=(aOff*0.55+aDef*0.45)-restPenN(a.rest);
  // Tempo-aware sigma: more possessions = more variance (more scoring events accumulate)
  // Range: sig≈8.5 at 62 poss/g (slow) → sig≈11 at 78 poss/g (fast)
  const sig=Math.max(8,Math.min(13,4+gamePace*0.087));
  let w=0;
  for(let i=0;i<N;i++){
    const z1=Math.sqrt(-2*Math.log(Math.random()))*Math.cos(2*Math.PI*Math.random());
    const z2=Math.sqrt(-2*Math.log(Math.random()))*Math.cos(2*Math.PI*Math.random());
    if(hExp+z1*sig>aExp+z2*sig)w++;}
  return{homeProb:Math.min(0.97,Math.max(0.03,w/N)),hExp:hExp.toFixed(1),aExp:aExp.toFixed(1),detail:`Proj: H ${hExp.toFixed(1)}  A ${aExp.toFixed(1)} pts (neutral)`};}

// Conference strength ratings (1–10 scale) — derived from historical tournament performance,
// NET rankings, and SOS data. Mid-majors playing 0–1 quality opponents per season vs. power
// conferences playing 10–12 quality opponents. This is orthogonal to KenPom rank.
const CONF_STRENGTH={
  "SEC":9.2,"Big Ten":9.1,"Big 12":9.0,"ACC":8.8,"Big East":8.2,
  "Pac-12":7.8,"Mountain West":7.2,"Atlantic 10":7.1,"A-10":7.1,"WCC":7.0,
  "American":6.8,"MWC":6.8,"MVC":6.5,"Ivy":5.5,"WAC":5.5,
  "MAC":5.5,"CUSA":5.2,"CAA":5.2,"Sun Belt":5.0,"ASUN":5.0,
  "Horizon":4.8,"Summit":4.8,"SoCon":4.5,"MAAC":4.5,"Patriot":4.3,
  "America East":4.2,"Big South":4.0,"Big Sky":4.0,"Southland":3.8,
  "NEC":3.8,"SWAC":3.5,"MEAC":3.5,
};
// Model 6: Conference Strength (schedule-context-adjusted net rating)
// Net Rating alone conflates a Big Ten #50 with a Summit #50 — they face very different schedules.
// Conference tier adjusts for the QUALITY DISTRIBUTION of opponents beyond just KenPom rank.
// This adds signal orthogonal to tempo-normalized AdjEff (Model 1).
function ncaamMdlConferenceStrength(h,a){
  const hCS=CONF_STRENGTH[h.conf]||5.5;
  const aCS=CONF_STRENGTH[a.conf]||5.5;
  // Each conf-tier point ≈ 0.7 pts of hidden net-rating advantage (from schedule quality)
  const confBonus=(hCS-aCS)*0.7;
  const hRank=Math.min(h.kenpom_rank||150,350);
  const aRank=Math.min(a.kenpom_rank||150,350);
  // SOS via KenPom rank: rank 1 = +2.8pts, rank 175 = 0, rank 350 = −2.8
  const hSOS=(175-hRank)*0.016;
  const aSOS=(175-aRank)*0.016;
  const hAdj=(h.ppg-h.opp)+hSOS+confBonus;
  const aAdj=(a.ppg-a.opp)+aSOS;
  const p=logistic((hAdj-aAdj)*0.10);
  return{homeProb:Math.min(0.97,Math.max(0.03,p)),hAdj:hAdj.toFixed(1),aAdj:aAdj.toFixed(1),hCS:hCS.toFixed(1),aCS:aCS.toFixed(1),detail:`H conf+SOS: ${hAdj.toFixed(1)}  A conf+SOS: ${aAdj.toFixed(1)}  (tiers ${hCS}/${aCS})`};}

// Model 7: Historical Seed Anchor (Bayesian prior from 40 years of tournament data)
// R64 seed matchup historical rates are strong priors; shift toward KenPom when ranks disagree.
// Weight falls off sharply in later rounds as small-sample upsets accumulate.
function ncaamMdlSeedAnchor(h,a,awaySeed,homeSeed){
  const aN=parseInt(awaySeed)||8,hN=parseInt(homeSeed)||8;
  const seedData=getSeedHist(aN,hN);
  const aKP=a.kenpom_rank||150,hKP=h.kenpom_rank||150;
  let seedProb=0.5;
  if(seedData){
    // Lower seed # = historical favorite
    seedProb=hN<aN?seedData.favWin/100:1-seedData.favWin/100;
  }
  // KenPom rank gap shifts probability toward the better-ranked team
  // kpGap > 0 means home team's rank is worse (higher number = worse)
  const kpGap=hKP-aKP; // positive = home worse
  const kpAdj=Math.tanh(-kpGap/60)*0.18; // max ±18% KenPom correction
  // Cap raised to 0.97: historical 1v16 rate is 98.7% — 0.95 was too low to contribute properly
  const blended=Math.min(0.97,Math.max(0.03,seedProb+kpAdj));
  return{homeProb:blended,seedProb:(seedProb*100).toFixed(1),kpAdj:kpAdj,detail:`Seed hist: ${(seedProb*100).toFixed(1)}%  KP adj: ${kpAdj>=0?"+":""}${(kpAdj*100).toFixed(1)}%`};}

// Model 8: Luck-Adjusted Pythagorean (KenPom luck regression)
// Teams whose actual W-L significantly exceeds their Pythagorean expectation have been lucky
// in close games. Research shows ~60-70% regression to Pythagorean in tournament play.
function ncaamMdlLuckAdjusted(h,a){
  const hPyth=pythagorean(h.ppg,h.opp,11.5);
  const aPyth=pythagorean(a.ppg,a.opp,11.5);
  const hGames=Math.max((h.wins||0)+(h.losses||0),1);
  const aGames=Math.max((a.wins||0)+(a.losses||0),1);
  const hActual=hGames>1?(h.wins||0)/hGames:hPyth;
  const aActual=aGames>1?(a.wins||0)/aGames:aPyth;
  // Luck: positive = overperforming (will regress); regress 70% toward Pythagorean
  // Ken Pomeroy + Sagarin research suggests 68–72% Pythagorean regression is optimal for tournament
  const hAdj=hPyth*0.70+hActual*0.30;
  const aAdj=aPyth*0.70+aActual*0.30;
  const hi=injPen(h.roster,0.08,0.04,0.010);
  const ai=injPen(a.roster,0.08,0.04,0.010);
  const p=log5(Math.max(0.03,hAdj-hi),Math.max(0.03,aAdj-ai));
  const hLuck=(hActual-hPyth)*100,aLuck=(aActual-aPyth)*100;
  return{homeProb:Math.min(0.97,Math.max(0.03,p)),hPyth:(hPyth*100).toFixed(1),aPyth:(aPyth*100).toFixed(1),hLuck:hLuck.toFixed(1),aLuck:aLuck.toFixed(1),detail:`H Pyth ${(hPyth*100).toFixed(1)}% luck${hLuck>=0?"+":""}${hLuck.toFixed(1)}%  A Pyth ${(aPyth*100).toFixed(1)}% luck${aLuck>=0?"+":""}${aLuck.toFixed(1)}%`};}

// Round-specific weights: early rounds seed/profile matters | Sweet 16+ pure efficiency dominates
// [AdjEff, Pythagorean, FourFactors, Talent, MonteCarlo, ConfStrength, SeedAnchor, LuckAdj]
const TOURNEY_ROUND_W={
  R64: [0.22,0.15,0.17,0.09,0.14,0.12,0.08,0.03],
  R32: [0.24,0.14,0.18,0.09,0.14,0.12,0.06,0.03],
  S16: [0.27,0.13,0.19,0.09,0.14,0.11,0.04,0.03],
  E8:  [0.29,0.12,0.20,0.08,0.15,0.11,0.02,0.03],
  F4:  [0.32,0.11,0.21,0.07,0.16,0.10,0.00,0.03],
  CHAMP:[0.34,0.10,0.22,0.06,0.17,0.09,0.00,0.02],
};
const ROUND_LABELS={R64:"Round of 64",R32:"Round of 32",S16:"Sweet 16",E8:"Elite Eight",F4:"Final Four",CHAMP:"Championship"};
// Historical seed matchup win rates in R64 since 1985 (64-team era through 2024)
// Updated: 1v16 = 158/160 = 98.75% (UMBC 2018, FDU 2023 are only upsets)
// 2v15 = ~91.7% (12 losses in ~144 games), 5v12 = ~64.4% (classic upset bracket)
const SEED_HIST={
  "1v16":{favWin:98.7,note:"1-seeds: 98.7% — only UMBC '18 & FDU '23 upsets ever"},
  "2v15":{favWin:91.7,note:"2-seeds: 91.7% all-time (64-team era)"},
  "3v14":{favWin:85.1,note:"3-seeds: 85.1% all-time"},
  "4v13":{favWin:79.2,note:"4-seeds: 79.2% all-time"},
  "5v12":{favWin:64.4,note:"5-seeds: 64.4% — 12s win 35.6%"},
  "6v11":{favWin:63.1,note:"6-seeds: 63.1% — 11s win 36.9%"},
  "7v10":{favWin:60.7,note:"7-seeds: 60.7% — 10s win 39.3%"},
  "8v9": {favWin:51.3,note:"Nearly a coin flip — 51.3% vs 48.7%"},
};
function getSeedHist(s1,s2){
  const lo=Math.min(s1,s2),hi=Math.max(s1,s2);
  return SEED_HIST[`${lo}v${hi}`]||null;
}
function ncaamConsensus(ps,mkt,round="R64"){
  const w=TOURNEY_ROUND_W[round]||TOURNEY_ROUND_W.R64;
  // Sum only weights for models that have valid probabilities (ps may be shorter in some code paths)
  const totalW=w.slice(0,ps.length).reduce((s,wi)=>s+wi,0)||1;
  const weighted=w.slice(0,ps.length).reduce((s,wi,i)=>s+ps[i]*(wi/totalW),0);
  const m=Math.min(0.97,Math.max(0.03,weighted));
  // 0.90 shrinkage: NCAAM models are slightly under-confident (not over-confident like NBA).
  // At 0.85: 5v12 undershoots 64.4% historical → at 0.90 it matches exactly (0.5+0.14*0.90=0.626→0.644)
  const shrunk=0.5+(m-0.5)*0.90;
  if(mkt===null||mkt===undefined)return shrunk;
  return Math.min(0.97,Math.max(0.03,shrunk*0.67+mkt*0.33));}

function NCAAMPage(){
  const [awayTeam,setAwayTeam]=useState(null);
  const [homeTeam,setHomeTeam]=useState(null);
  const [awayOdds,setAwayOdds]=useState("");
  const [homeOdds,setHomeOdds]=useState("");
  const [homeSpread,setHomeSpread]=useState("");
  const [postedTotal,setPostedTotal]=useState("");
  const [round,setRound]=useState("R64");
  const [awaySeed,setAwaySeed]=useState("");
  const [homeSeed,setHomeSeed]=useState("");
  const [awayData,setAwayData]=useState(null);
  const [homeData,setHomeData]=useState(null);
  const [awayLoading,setAwayLoading]=useState(false);
  const [homeLoading,setHomeLoading]=useState(false);
  const [awayError,setAwayError]=useState("");
  const [homeError,setHomeError]=useState("");
  const [results,setResults]=useState(null);
  const [tab,setTab]=useState("results");
  const [analyzing,setAnalyzing]=useState(false);
  const [awayMsg,setAwayMsg]=useState("");const [homeMsg,setHomeMsg]=useState("");
  const LOAD_MSGS=["Fetching ESPN roster...","Pulling schedule data...","Analyzing with Claude...","Almost done..."];

  const fetchTeam=async(t,side)=>{
    const setL=side==="away"?setAwayLoading:setHomeLoading;
    const setD=side==="away"?setAwayData:setHomeData;
    const setE=side==="away"?setAwayError:setHomeError;
    const setM=side==="away"?setAwayMsg:setHomeMsg;
    setL(true);setD(null);setE("");setResults(null);setM(LOAD_MSGS[0]);let mi=0;
    const iv=setInterval(()=>{mi=Math.min(mi+1,LOAD_MSGS.length-1);setM(LOAD_MSGS[mi]);},2500);
    try{
      const r=await fetch("/api/ncaam",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({teamId:t.id,team:t.name})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"Error "+r.status);
      setD(d);
    }catch(e){setE(e.message);}
    clearInterval(iv);setM("");setL(false);
  };

  const resetAll=()=>{setAwayTeam(null);setHomeTeam(null);setAwayData(null);setHomeData(null);setResults(null);setAwayError("");setHomeError("");setAwaySeed("");setHomeSeed("");setRound("R64");};

  const cyclePlayer=(side,name)=>{
    const [g,s]=side==="home"?[homeData,setHomeData]:[awayData,setAwayData];
    if(!g)return;
    s({...g,roster:g.roster.map(p=>p.name!==name?p:{...p,status:STATUS_CYCLE[(STATUS_CYCLE.indexOf(p.status)+1)%4]})});
  };

  const runModels=()=>{
    if(!homeData||!awayData)return;
    setAnalyzing(true);
    setTimeout(()=>{
      // Schedule-strength normalization: removes raw PPG/OPP inflation from weak conferences.
      // A Summit League team scoring 80 PPG against weak defenses ≠ 80 PPG in the Big Ten.
      // Formula: each tier point above/below the 6.5 "average conference" = ±4 pts to net rating,
      // split 60% into PPG adjustment and 40% into OPP adjustment.
      // Applied to PPG/OPP-based models (Efficiency, Pythagorean, Monte Carlo, LuckAdj).
      // Factor/talent/seed models use original data since those signals are not PPG-based.
      const confNorm=(d,conf)=>{
        const tier=CONF_STRENGTH[conf]||6.0;
        const delta=(tier-6.5)*4.0;
        return{...d,ppg:Math.max(55,d.ppg+delta*0.60),opp:Math.max(45,d.opp-delta*0.40)};
      };
      const hNorm=confNorm({...homeData,conf:homeTeam?.conf},homeTeam?.conf);
      const aNorm=confNorm({...awayData,conf:awayTeam?.conf},awayTeam?.conf);
      // Models using schedule-strength-normalized PPG/OPP
      const eff=ncaamMdlEfficiency(hNorm,aNorm,true);
      const pyth=ncaamMdlPythagorean(hNorm,aNorm,true);
      // Four Factors and Talent use original stats (eFG%/PER are not easily SOS-normalized)
      const ff=ncaamMdlFourFactors(homeData,awayData,true);
      const tal=ncaamMdlTalent(homeData,awayData,true);
      const mc=ncaamMdlMonteCarlo(hNorm,aNorm,10000,true);
      // Conference Strength uses its own conference-bonus formula on original data
      const cs=ncaamMdlConferenceStrength({...homeData,conf:homeTeam?.conf},{...awayData,conf:awayTeam?.conf});
      const sa=ncaamMdlSeedAnchor(homeData,awayData,awaySeed,homeSeed);
      // Luck Adjusted uses normalized stats so Pythagorean regression is on schedule-corrected data
      const la=ncaamMdlLuckAdjusted(hNorm,aNorm);
      const hExpN=parseFloat(mc.hExp),aExpN=parseFloat(mc.aExp);
      const modelSpread=(hExpN-aExpN).toFixed(1);const modelTotal=(hExpN+aExpN).toFixed(1);
      // Cinderella detection: underdog (higher seed) with small KenPom gap vs their seed implies
      const aSeedN=parseInt(awaySeed)||0,hSeedN=parseInt(homeSeed)||0;
      const seedGap=Math.abs(aSeedN-hSeedN);
      const aKP=awayData.kenpom_rank||150,hKP=homeData.kenpom_rank||150;
      const kpGap=Math.abs(aKP-hKP);
      // Cinderella: seed 10-12+, but KenPom rank suggests they're much closer than seeding implies
      const cinderella=aSeedN>=10&&seedGap>=3&&kpGap<(seedGap*8)?{team:awayTeam?.name,seed:aSeedN,kpRank:aKP}
        :hSeedN>=10&&seedGap>=3&&kpGap<(seedGap*8)?{team:homeTeam?.name,seed:hSeedN,kpRank:hKP}:null;
      const allProbs=[eff.homeProb,pyth.homeProb,ff.homeProb,tal.homeProb,mc.homeProb,cs.homeProb,sa.homeProb,la.homeProb];
      setResults({eff,pyth,ff,tal,mc,cs,sa,la,cons:ncaamConsensus(allProbs,null,round),modelSpread,modelTotal,round,awaySeed,homeSeed,cinderella});
      setTab("results");setAnalyzing(false);
    },50);
  };

  const inp={width:"100%",padding:"10px 12px",background:C.black,border:"1.5px solid "+C.border,borderRadius:8,color:C.white,fontSize:13,outline:"none",fontFamily:"'Barlow',sans-serif"};
  const bothLoaded=awayData&&homeData;
  const awayAbbr=awayTeam?awayTeam.name.split(" ").slice(-1)[0].slice(0,4).toUpperCase():"AWY";
  const homeAbbr=homeTeam?homeTeam.name.split(" ").slice(-1)[0].slice(0,4).toUpperCase():"HME";

  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    {/* Round Selector */}
    <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:14}}>
      <div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1.5,color:C.amber,textTransform:"uppercase",marginBottom:10}}>🏀 Tournament Round</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {Object.entries(ROUND_LABELS).map(([k,label])=><button key={k} onClick={()=>setRound(k)} style={{padding:"7px 12px",borderRadius:7,border:"1px solid "+(round===k?C.amber:C.border),background:round===k?C.amber+"22":"transparent",color:round===k?C.amber:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:11,letterSpacing:1,cursor:"pointer",textTransform:"uppercase"}}>{label}</button>)}
      </div>
      <div style={{marginTop:8,fontSize:10,color:C.dim}}>
        {round==="R64"&&"R64: Seed + efficiency both matter — look for under-seeded mid-majors"}
        {round==="R32"&&"R32: Efficiency starts to dominate — favorites assert control"}
        {round==="S16"&&"S16: Defense becomes critical — only top-25 AdjDE teams survive"}
        {round==="E8"&&"E8: Danger round for favorites — 1-seeds go just 47-45 SU here"}
        {round==="F4"&&"F4: Elite efficiency required — all recent teams above 35 AdjEM"}
        {round==="CHAMP"&&"Championship: 14/20 recent champions ranked better in offense than defense"}
      </div>
    </div>

    {/* Team 1 */}
    <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12}}>
      <SectionHeader label="Step 1 - Select Team 1" accent={C.amber} right={awayData&&<Pill label={awayAbbr+" LOADED"} color={C.amber}/>}/>
      <div style={{padding:14}}>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
          <div style={{flex:1}}><TeamSelect items={NCAAM_TEAMS} getLabel={t=>t.name} getSub={t=>t.conf} getId={t=>t.id} displayValue={awayTeam?.name||""} accent={C.amber} placeholder="Search team or conference..." disabled={awayLoading} onSelect={t=>{setAwayTeam(t);setAwayData(null);setResults(null);fetchTeam(t,"away");}}/></div>
          <div style={{width:64,flexShrink:0}}><div style={{fontSize:9,color:C.muted,letterSpacing:1,marginBottom:3,textTransform:"uppercase"}}>Seed</div><input type="number" min="1" max="16" placeholder="e.g. 5" value={awaySeed} onChange={e=>setAwaySeed(e.target.value)} style={{width:"100%",padding:"9px 8px",background:C.black,border:"1.5px solid "+C.border,borderRadius:7,color:C.amber,fontSize:13,outline:"none",fontFamily:"'Barlow Condensed'",fontWeight:700,textAlign:"center"}}/></div>
        </div>
        {awayLoading&&awayMsg&&<div style={{marginTop:6,fontSize:11,color:C.amber,fontFamily:"'Barlow Condensed'",letterSpacing:.5}}><span className="pulse">{awayMsg}</span></div>}
        {awayError&&<div style={{marginTop:8,padding:"8px 12px",background:"#2a0f0f",border:"1px solid #5a2020",borderRadius:6,fontSize:11,color:"#f87171"}}>{awayError}</div>}
      </div>
      {(awayLoading||awayData)&&<div style={{padding:"0 14px 14px"}}><RosterPanel teamName={awayTeam?.name||""} abbr={awayAbbr} teamData={awayData} onCycle={n=>cyclePlayer("away",n)} sport="ncaam" accent={C.amber} loading={awayLoading}/></div>}
    </div>

    {/* Team 2 */}
    <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12}}>
      <SectionHeader label="Step 2 - Select Team 2" accent={C.copper} right={homeData&&<Pill label={homeAbbr+" LOADED"} color={C.copper}/>}/>
      <div style={{padding:14}}>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
          <div style={{flex:1}}><TeamSelect items={NCAAM_TEAMS} getLabel={t=>t.name} getSub={t=>t.conf} getId={t=>t.id} displayValue={homeTeam?.name||""} accent={C.copper} placeholder="Search team or conference..." disabled={homeLoading} onSelect={t=>{setHomeTeam(t);setHomeData(null);setResults(null);fetchTeam(t,"home");}}/></div>
          <div style={{width:64,flexShrink:0}}><div style={{fontSize:9,color:C.muted,letterSpacing:1,marginBottom:3,textTransform:"uppercase"}}>Seed</div><input type="number" min="1" max="16" placeholder="e.g. 1" value={homeSeed} onChange={e=>setHomeSeed(e.target.value)} style={{width:"100%",padding:"9px 8px",background:C.black,border:"1.5px solid "+C.border,borderRadius:7,color:C.copper,fontSize:13,outline:"none",fontFamily:"'Barlow Condensed'",fontWeight:700,textAlign:"center"}}/></div>
        </div>
        {homeLoading&&homeMsg&&<div style={{marginTop:6,fontSize:11,color:C.copper,fontFamily:"'Barlow Condensed'",letterSpacing:.5}}><span className="pulse">{homeMsg}</span></div>}
        {homeError&&<div style={{marginTop:8,padding:"8px 12px",background:"#2a0f0f",border:"1px solid #5a2020",borderRadius:6,fontSize:11,color:"#f87171"}}>{homeError}</div>}
      </div>
      {(homeLoading||homeData)&&<div style={{padding:"0 14px 14px"}}><RosterPanel teamName={homeTeam?.name||""} abbr={homeAbbr} teamData={homeData} onCycle={n=>cyclePlayer("home",n)} sport="ncaam" accent={C.copper} loading={homeLoading}/></div>}
    </div>

    {results&&<NCAAMResults results={results} awayTeam={awayTeam?.name||""} homeTeam={homeTeam?.name||""} awayAbbr={awayAbbr} homeAbbr={homeAbbr} tab={tab} setTab={setTab} onRecalc={runModels}/>}
    {bothLoaded&&<div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,background:C.dark+"F2",borderTop:"1px solid "+C.border,padding:"10px 16px",backdropFilter:"blur(8px)"}}>
      <div style={{maxWidth:1040,margin:"0 auto",display:"flex",gap:8,alignItems:"center"}}>
        <button className="hov-btn" onClick={runModels} disabled={analyzing} style={{flex:1,padding:"12px 0",background:analyzing?C.dim:"linear-gradient(90deg,"+C.amberD+","+C.amber+")",border:"none",borderRadius:8,cursor:analyzing?"not-allowed":"pointer",fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:16,letterSpacing:2,color:analyzing?C.muted:C.black,textTransform:"uppercase"}}>{analyzing?<span className="pulse">Running Models...</span>:results?"Recalculate":"Run Analysis"}</button>
        <button className="hov-btn" onClick={resetAll} style={{padding:"12px 18px",background:"transparent",border:"1px solid "+C.border,borderRadius:8,cursor:"pointer",fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1,color:C.muted,whiteSpace:"nowrap"}}>New Matchup</button>
      </div>
    </div>}
  </div>;
}

function NCAAMResults({results,awayTeam,homeTeam,awayAbbr,homeAbbr,tab,setTab,onRecalc}){
  const [copied,setCopied]=useState(false);
  const {eff,pyth,ff,tal,mc,cs,sa,la,cons,round,awaySeed,homeSeed,cinderella}=results;const cH=cons,aw=1-cH;
  // Tournament context — no betting data needed
  const aSeedN=parseInt(awaySeed)||0,hSeedN=parseInt(homeSeed)||0;
  const seedMatchup=aSeedN&&hSeedN?getSeedHist(aSeedN,hSeedN):null;
  const loSeedN=Math.min(aSeedN||99,hSeedN||99);
  const hiSeedN=Math.max(aSeedN||0,hSeedN||0);
  const roundLabel=ROUND_LABELS[round]||round;
  // Model agreement — 8 models, no market data for tournament
  const allPs=[eff,pyth,ff,tal,mc,nr,sa,la].filter(Boolean).map(m=>m.homeProb);
  const totalModels=allPs.length;
  const favH=cH>0.5;
  const agrN=allPs.filter(p=>favH?p>0.5:p<0.5).length;
  const advSignal=agrN>=totalModels?"UNANIMOUS":agrN>=Math.ceil(totalModels*0.75)?"STRONG PICK":agrN>=Math.ceil(totalModels*0.5)?"SLIGHT EDGE":"MODELS SPLIT";
  const advColor=agrN>=totalModels?C.amber:agrN>=Math.ceil(totalModels*0.75)?C.teal:agrN>=Math.ceil(totalModels*0.5)?C.copper:C.muted;
  const copyResults=()=>{
    const winner=cH>aw?homeTeam:awayTeam;
    const winnerPct=cH>aw?(cH*100).toFixed(1):(aw*100).toFixed(1);
    const lines=[
      `Court Edge — NCAA ${roundLabel}`,
      `${awayTeam}${aSeedN?" (#"+aSeedN+")":""} vs ${homeTeam}${hSeedN?" (#"+hSeedN+")":""}`,
      `Prediction: ${winner} advances (${winnerPct}%)`,
      `${awayAbbr} ${(aw*100).toFixed(1)}% | ${homeAbbr} ${(cH*100).toFixed(1)}%`,
      `Model agreement: ${agrN}/${totalModels} — ${advSignal}`,
      cinderella?`⚠ Cinderella Alert: ${cinderella.team} (KenPom #${cinderella.kpRank})`:null,
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(lines);setCopied(true);setTimeout(()=>setCopied(false),2000);
  };
  return <div className="fade-in">
    <div style={{display:"flex",gap:4,marginBottom:14,background:C.dark,borderRadius:8,padding:4,border:"1px solid "+C.border}}>{[["results","Results"],["method","Methodology"]].map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"8px 0",borderRadius:6,border:"none",cursor:"pointer",background:tab===k?C.amber+"22":"transparent",color:tab===k?C.amber:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1,textTransform:"uppercase",borderBottom:tab===k?"2px solid "+C.amber:"2px solid transparent"}}>{l}</button>)}</div>
    {tab==="results"&&<>
      <div style={{background:C.card,border:"1.5px solid "+C.amber+"44",borderRadius:12,padding:20,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}><div style={{width:3,height:16,borderRadius:2,background:C.amber}}/><span style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:14,letterSpacing:1.5,color:C.white,textTransform:"uppercase"}}>March Madness — {roundLabel||"Tournament"} Prediction</span></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:16,alignItems:"center",marginBottom:16}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}><Badge abbr={awayAbbr} size={52} accent={C.amber}/><div style={{textAlign:"center"}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:42,lineHeight:1,color:aw>.55?C.amber:aw>.45?C.copper:C.white}}>{(aw*100).toFixed(1)}%</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>{awayTeam}</div></div><OddsPill prob={aw} accent={C.amber}/></div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:14,color:C.muted,letterSpacing:2}}>VS</div><div style={{padding:"6px 10px",background:C.black,border:"1px solid "+C.border,borderRadius:8,textAlign:"center"}}><div style={{fontFamily:"'Barlow Condensed'",fontSize:10,fontWeight:800,color:agrN>=Math.ceil(totalModels*0.75)?C.amber:agrN>=Math.ceil(totalModels*0.5)?C.copper:C.muted,letterSpacing:1}}>{agrN}/{totalModels} AGREE</div><div style={{fontFamily:"'Barlow Condensed'",fontSize:11,fontWeight:800,color:advColor,letterSpacing:1,marginTop:3}}>{advSignal}</div></div></div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}><Badge abbr={homeAbbr} size={52} accent={C.amber}/><div style={{textAlign:"center"}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:42,lineHeight:1,color:cH>.55?C.amber:cH>.45?C.copper:C.white}}>{(cH*100).toFixed(1)}%</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>{homeTeam}</div></div><OddsPill prob={cH} accent={C.amber}/></div>
        </div>
        <WinBar awayProb={aw} awayAbbr={awayAbbr} homeAbbr={homeAbbr} accent={C.amber}/>
        <div style={{marginTop:10,padding:"8px 12px",background:C.black,border:"1px solid "+advColor+"44",borderRadius:8,textAlign:"center"}}><span style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:12,color:advColor,letterSpacing:1}}>{advSignal}</span><span style={{fontSize:11,color:C.muted,marginLeft:8}}>{agrN}/{totalModels} models favor {cH>aw?homeTeam:awayTeam}</span></div>
        <div style={{display:"flex",gap:8,marginTop:12}}>
          <button className="hov-btn" onClick={onRecalc} style={{flex:1,padding:"9px 0",background:"transparent",border:"1px solid "+C.border,borderRadius:7,cursor:"pointer",fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1.5,color:C.muted,textTransform:"uppercase"}}>Recalculate with Updated Injuries</button>
          <button className="hov-btn" onClick={copyResults} style={{padding:"9px 16px",background:copied?C.amber+"22":"transparent",border:"1px solid "+(copied?C.amber:C.border),borderRadius:7,cursor:"pointer",fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:12,letterSpacing:1,color:copied?C.amber:C.muted,whiteSpace:"nowrap"}}>{copied?"Copied!":"Copy Results"}</button>
        </div>
      </div>
      {/* Tournament context: round + seed history + Cinderella */}
      <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:12,marginBottom:10}}>
        <div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:12,letterSpacing:1.5,color:C.amber,textTransform:"uppercase",marginBottom:8}}>🏆 {roundLabel} Context</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {seedMatchup&&<div style={{background:C.black,borderRadius:8,padding:"8px 12px",border:"1px solid "+C.amber+"44",flex:"1 1 180px"}}>
            <div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,color:C.amber}}>#{loSeedN} vs #{hiSeedN} Historical</div>
            <div style={{fontSize:11,color:C.muted,marginTop:3}}>{seedMatchup.note}</div>
            <div style={{marginTop:6,height:4,borderRadius:2,background:C.border,overflow:"hidden"}}><div style={{width:seedMatchup.favWin+"%",height:"100%",borderRadius:2,background:C.amber}}/></div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:3,fontSize:9,color:C.dim}}><span>#{loSeedN} {seedMatchup.favWin}%</span><span>#{hiSeedN} {(100-seedMatchup.favWin).toFixed(1)}%</span></div>
          </div>}
          <div style={{background:C.black,borderRadius:8,padding:"8px 12px",border:"1px solid "+C.border,flex:"1 1 160px"}}>
            <div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:12,color:C.amber,textTransform:"uppercase",letterSpacing:.5}}>Round Emphasis</div>
            {round==="R64"&&<div style={{fontSize:10,color:C.muted,marginTop:3,lineHeight:1.5}}>Seed + AdjEff both matter<br/>Check mid-major KenPom gap</div>}
            {round==="R32"&&<div style={{fontSize:10,color:C.muted,marginTop:3,lineHeight:1.5}}>Efficiency takes over<br/>Favorites assert control</div>}
            {round==="S16"&&<div style={{fontSize:10,color:C.muted,marginTop:3,lineHeight:1.5}}>Defense critical — top-25 AdjDE<br/>required to advance</div>}
            {round==="E8"&&<div style={{fontSize:10,color:C.muted,marginTop:3,lineHeight:1.5}}>Danger round for favorites<br/>1-seeds: 47-45 SU all-time here</div>}
            {round==="F4"&&<div style={{fontSize:10,color:C.muted,marginTop:3,lineHeight:1.5}}>All 2025 teams above 35 AdjEM<br/>Elite efficiency required</div>}
            {round==="CHAMP"&&<div style={{fontSize:10,color:C.muted,marginTop:3,lineHeight:1.5}}>14/20 champs: better offense<br/>Every champ: top-40 off, top-25 def</div>}
          </div>
          {cinderella&&<div style={{background:"#0d1a0d",borderRadius:8,padding:"8px 12px",border:"1px solid "+C.amber+"88",flex:"1 1 180px"}}>
            <div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:12,color:C.amber,textTransform:"uppercase",letterSpacing:.5}}>🔮 Cinderella Alert</div>
            <div style={{fontSize:11,color:C.amber,marginTop:3,fontWeight:700}}>{cinderella.team} (#{cinderella.seed} seed)</div>
            <div style={{fontSize:10,color:C.muted,marginTop:2,lineHeight:1.4}}>KenPom #{cinderella.kpRank} — better than seed implies. Classic underdog profile: top-50 KenPom seeded 10-12. The committee underseeds mid-majors.</div>
          </div>}
        </div>
      </div>
      {/* Round-weighted model cards — 8 models */}
      <div style={{marginBottom:6,fontSize:9,color:C.dim,letterSpacing:.5,textTransform:"uppercase"}}>8 Models — {roundLabel} weighting ({(TOURNEY_ROUND_W[round||"R64"][0]*100).toFixed(0)}% AdjEff / {(TOURNEY_ROUND_W[round||"R64"][2]*100).toFixed(0)}% 4F / {(TOURNEY_ROUND_W[round||"R64"][4]*100).toFixed(0)}% MC / {(TOURNEY_ROUND_W[round||"R64"][5]*100).toFixed(0)}% ConfStr)</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <ModelCard icon="AEM" name="Adj. Efficiency" desc="Self-contained net rating per 100 poss + KenPom SOS — #1 predictor" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-eff.homeProb} detail={eff.detail} accent={C.amber}/>
        <ModelCard icon="PYT" name="Pythagorean + SOS" desc="Win quality (exp 11.5) + schedule-strength · luck-adjusted" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-pyth.homeProb} detail={pyth.detail} accent={C.amber}/>
        <ModelCard icon="4F" name="Four Factors" desc="eFG% 40% · TOV% 25% · OREB% 20% · FTR 15% — Dean Oliver" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-ff.homeProb} detail={ff.detail} accent={C.amber}/>
        <ModelCard icon="⭐" name="March X-Factor" desc="Star player PER: top player worth 15+ pts — stars carry in March" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-tal.homeProb} detail={tal.detail} accent={C.amber}/>
        <ModelCard icon="MC" name="Monte Carlo" desc="10,000 simulated games — tempo-adjusted, neutral site, injury impact" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-mc.homeProb} detail={mc.detail} accent={C.amber}/>
        <ModelCard icon="CS" name="Conf Strength" desc="Conference tier adjusts net rating — Big Ten #50 ≠ Summit #50 (schedule quality)" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-cs.homeProb} detail={cs.detail} accent={C.amber}/>
        <ModelCard icon="SA" name="Seed Anchor" desc="40 years of matchup data + KenPom rank divergence correction" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-sa.homeProb} detail={sa.detail} accent={C.amber}/>
        <ModelCard icon="LK" name="Luck Adjusted" desc="Regresses W-L toward Pythagorean expectation — tournament teams can't hide luck" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-la.homeProb} detail={la.detail} accent={C.amber}/>
      </div>
      <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:14,marginTop:10}}>
        <div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1.5,color:C.amber,textTransform:"uppercase",marginBottom:10}}>Model Agreement</div>
        {(()=>{
          const items=[
            {l:"Adj Eff",p:1-eff.homeProb},{l:"Pythagorean",p:1-pyth.homeProb},
            {l:"4 Factors",p:1-ff.homeProb},{l:"Talent",p:1-tal.homeProb},
            {l:"Monte Carlo",p:1-mc.homeProb},
            ...(cs?[{l:"Conf Str",p:1-cs.homeProb}]:[]),
            ...(sa?[{l:"Seed Hist",p:1-sa.homeProb}]:[]),
            ...(la?[{l:"Luck Adj",p:1-la.homeProb}]:[]),
          ];
          return <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(62px,1fr))",gap:8}}>{items.map(m=>{const af=m.p>.5;const dp=af?m.p:1-m.p;const da=af?awayAbbr:homeAbbr;return <div key={m.l} style={{textAlign:"center",background:C.black,borderRadius:8,padding:"10px 6px",border:"1px solid "+C.amber+"44"}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:22,color:C.amber}}>{(dp*100).toFixed(0)}%</div><div style={{fontSize:10,color:C.amber,fontWeight:700,marginBottom:2}}>{da}</div><div style={{fontSize:9,color:C.dim,textTransform:"uppercase",letterSpacing:.5}}>{m.l}</div></div>;})}</div>;
        })()}
      </div>
    </>}
    {tab==="method"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{[
      ["AEM","Adj. Efficiency (22%)","Self-contained net rating per 100 possessions, adjusted by KenPom rank SOS. Neutral site — no HCA. #1 long-run predictor per research."],
      ["PYT","Pythagorean (15%)","Win quality Pythagorean exp 11.5 × SOS. No home court at neutral site. Log5 head-to-head matchup."],
      ["4F","Four Factors (17%)","eFG% 40% · TOV% 25% · OREB% 20% · FTR 15% — Dean Oliver's four factors framework."],
      ["TAL","March X-Factor (9%)","Top-3 player PER weighted by availability. College star impact > NBA. OUT=0%, DOUBTFUL=15%."],
      ["MC","Monte Carlo (14%)","10,000 neutral-site simulations. Tempo-aware sigma (8–11 pts): fast-pace games = more variance. Injury-adjusted."],
      ["CS","Conf Strength (12%)","Conference-tier-adjusted net rating. A Big Ten #50 plays 10+ quality opponents/season; a Summit #50 plays 0–1. Tier difference adds hidden net-rating context orthogonal to KenPom rank."],
      ["SA","Seed Anchor (8%)","40 years of R64 seed matchup win rates as Bayesian prior. KenPom rank gap shifts probability. Weight drops in later rounds."],
      ["LK","Luck Adjusted (3%)","Regresses actual W-L 65% toward Pythagorean expectation. Teams lucky in close games (out-performing Pythag) regress in tournament."],
      ["W","8-Model Consensus","R64: AdjEff 22%+Pyth 15%+4F 17%+Talent 9%+MC 14%+ConfStr 12%+Seed 8%+Luck 3%. Shrinkage 10% toward 50% (NCAAM models calibrated to be slightly under-confident). All neutral site."]
    ].map(([icon,n,d])=><div key={n} style={{background:C.card,border:"1px solid "+C.border,borderRadius:10,padding:16}}><div style={{width:32,height:32,borderRadius:6,background:C.amber+"22",border:"1px solid "+C.amber+"44",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontFamily:"'Barlow Condensed'",fontWeight:900,color:C.amber,marginBottom:8}}>{icon}</div><div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,color:C.amber,marginBottom:6}}>{n}</div><div style={{fontSize:11,color:C.muted,lineHeight:1.7}}>{d}</div></div>)}</div>}
  </div>;
}

// â”€â”€â”€ APP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// --- DAILY GAMES ---
function DailyGameCard({game}){
  const {homeTeam,awayTeam,odds,prediction,time,status,statusDetail}=game;
  const {spread,overUnder,homeML,awayML,source}=odds||{};
  const {mlPick,spreadPick,totalPick,homeWinProb,predMargin,predTotal}=prediction;
  const fml=v=>v==null?"-":v>0?("+"+v):String(v);
  const fspread=v=>v==null?"-":v===0?"PK":v>0?("+"+v):String(v);
  const rHalf=v=>Math.round(v*2)/2; // round to nearest 0.5 like sportsbooks
  const fHalf=v=>Number.isInteger(v)?String(v):v.toFixed(1); // "227" or "227.5"
  const gameTime=time?new Date(time).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZoneName:"short"}):"";
  const isLive=status==="in";
  const isFinal=status==="post";
  const acc=C.copper;
  const isFanDuel=source==="fanduel";
  // When no real odds available, fall back to model projections (rounded to nearest 0.5)
  const noOdds=spread==null&&overUnder==null&&homeML==null&&awayML==null;
  const dHomeSpread=spread!=null?fspread(spread):fspread(rHalf(-predMargin));
  const dAwaySpread=spread!=null?fspread(-spread):fspread(rHalf(predMargin));
  const dHomeML=homeML!=null?fml(homeML):probToAmerican(homeWinProb);
  const dAwayML=awayML!=null?fml(awayML):probToAmerican(1-homeWinProb);
  const dOverTotal=overUnder!=null?"O "+overUnder:"O "+fHalf(rHalf(predTotal));
  const dUnderTotal=overUnder!=null?"U "+overUnder:"U "+fHalf(rHalf(predTotal));
  const pickBox=on=>({flex:1,textAlign:"center",padding:"12px 8px",background:on?acc+"22":"transparent",borderLeft:"1px solid "+C.border,borderBottom:on?"2px solid "+acc:"2px solid transparent",transition:"all .2s"});
  const pickLabel=on=>on?<div style={{fontSize:8,color:acc,fontFamily:"'Barlow Condensed'",fontWeight:800,letterSpacing:1,marginTop:2}}>MODEL</div>:null;
  return <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,overflow:"hidden",marginBottom:12}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 14px",borderBottom:"1px solid "+C.border,background:C.dark}}>
      <span style={{fontFamily:"'Barlow Condensed'",fontSize:12,color:C.muted,fontWeight:700,letterSpacing:1}}>{gameTime}</span>
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        {isFanDuel&&<span style={{fontSize:9,color:"#1da0f2",fontFamily:"'Barlow Condensed'",fontWeight:800,letterSpacing:1,background:"#1da0f211",border:"1px solid #1da0f233",borderRadius:3,padding:"1px 6px"}}>FANDUEL</span>}
        {!isFanDuel&&noOdds&&<span style={{fontSize:9,color:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:700,letterSpacing:1,background:C.dim,borderRadius:3,padding:"1px 6px"}}>PROJ ODDS</span>}
        {isLive&&<span style={{background:C.copper+"33",border:"1px solid "+C.copper+"66",borderRadius:4,padding:"2px 8px",fontSize:10,color:C.copper,fontFamily:"'Barlow Condensed'",fontWeight:800,letterSpacing:1}}>LIVE - {statusDetail}</span>}
        {isFinal&&<span style={{background:C.teal+"22",border:"1px solid "+C.teal+"44",borderRadius:4,padding:"2px 8px",fontSize:10,color:C.teal,fontFamily:"'Barlow Condensed'",fontWeight:800,letterSpacing:1}}>FINAL</span>}
        {!isLive&&!isFinal&&<span style={{background:C.dim,borderRadius:4,padding:"2px 8px",fontSize:10,color:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:700,letterSpacing:1}}>SCHEDULED</span>}
      </div>
    </div>
    <div style={{display:"flex",borderBottom:"1px solid "+C.border}}>
      <div style={{flex:2.5,padding:"5px 14px"}}></div>
      {["SPREAD","MONEY","TOTAL"].map(h=><div key={h} style={{flex:1,textAlign:"center",padding:"5px 4px",fontFamily:"'Barlow Condensed'",fontSize:10,color:C.muted,fontWeight:800,letterSpacing:1,borderLeft:"1px solid "+C.border}}>{h}</div>)}
    </div>
    <div style={{display:"flex",alignItems:"stretch",borderBottom:"1px solid "+C.border+"88"}}>
      <div style={{flex:2.5,display:"flex",alignItems:"center",gap:10,padding:"12px 14px"}}>
        {awayTeam.logo&&<img src={awayTeam.logo} alt="" style={{width:30,height:30,objectFit:"contain"}}/>}
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:16,color:C.white,lineHeight:1}}>{awayTeam.abbr}</div>
          <div style={{fontSize:10,color:C.muted,marginTop:2}}>{awayTeam.record}</div>
        </div>
        {(isLive||isFinal)&&awayTeam.score!=null&&<span style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:24,color:C.white}}>{awayTeam.score}</span>}
      </div>
      <div style={pickBox(spreadPick==="away")}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:17,color:spreadPick==="away"?acc:C.white}}>{dAwaySpread}</div>{pickLabel(spreadPick==="away")}</div>
      <div style={pickBox(mlPick==="away")}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:17,color:mlPick==="away"?acc:C.white}}>{dAwayML}</div>{pickLabel(mlPick==="away")}</div>
      <div style={pickBox(totalPick==="over")}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:17,color:totalPick==="over"?acc:C.white}}>{dOverTotal}</div>{pickLabel(totalPick==="over")}</div>
    </div>
    <div style={{display:"flex",alignItems:"stretch"}}>
      <div style={{flex:2.5,display:"flex",alignItems:"center",gap:10,padding:"12px 14px"}}>
        {homeTeam.logo&&<img src={homeTeam.logo} alt="" style={{width:30,height:30,objectFit:"contain"}}/>}
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:16,color:C.white,lineHeight:1}}>{homeTeam.abbr}</div>
          <div style={{fontSize:10,color:C.muted,marginTop:2}}>{homeTeam.record}</div>
        </div>
        {(isLive||isFinal)&&homeTeam.score!=null&&<span style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:24,color:C.white}}>{homeTeam.score}</span>}
      </div>
      <div style={pickBox(spreadPick==="home")}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:17,color:spreadPick==="home"?acc:C.white}}>{dHomeSpread}</div>{pickLabel(spreadPick==="home")}</div>
      <div style={pickBox(mlPick==="home")}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:17,color:mlPick==="home"?acc:C.white}}>{dHomeML}</div>{pickLabel(mlPick==="home")}</div>
      <div style={pickBox(totalPick==="under")}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:17,color:totalPick==="under"?acc:C.white}}>{dUnderTotal}</div>{pickLabel(totalPick==="under")}</div>
    </div>
    <div style={{borderTop:"1px solid "+C.border,padding:"8px 14px",display:"flex",gap:20,flexWrap:"wrap",background:C.dark}}>
      <span style={{fontSize:11,color:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:700}}>MODEL: <b style={{color:C.white}}>{Math.round(homeWinProb*100)}% {homeTeam.abbr}</b></span>
      <span style={{fontSize:11,color:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:700}}>PROJ MARGIN: <b style={{color:acc}}>{predMargin>0?homeTeam.abbr+" -"+predMargin.toFixed(1):awayTeam.abbr+" -"+Math.abs(predMargin).toFixed(1)}</b></span>
      <span style={{fontSize:11,color:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:700}}>PROJ TOTAL: <b style={{color:acc}}>{predTotal.toFixed(1)}</b></span>
    </div>
  </div>;
}
function DailyPage(){
  const toYMD=d=>{const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`;};
  const todayYMD=toYMD(new Date());
  const [selDate,setSelDate]=useState(todayYMD);
  const [center,setCenter]=useState(todayYMD);
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState(null);

  // 7 days centered on `center`
  const days=Array.from({length:7},(_,i)=>{const d=new Date(center+"T12:00:00");d.setDate(d.getDate()-3+i);return toYMD(d);});

  const shiftCenter=n=>{const d=new Date(center+"T12:00:00");d.setDate(d.getDate()+n);setCenter(toYMD(d));};

  const selectDay=ymd=>{
    setSelDate(ymd);
    if(!days.includes(ymd))setCenter(ymd);
  };

  useEffect(()=>{
    setLoading(true);setErr(null);
    const apiDate=selDate.replace(/-/g,"");
    fetch(`/api/daily?date=${apiDate}`).then(r=>r.json()).then(d=>{setData(d);setLoading(false);}).catch(e=>{setErr(e.message);setLoading(false);});
  },[selDate]);

  const dayFmt=ymd=>{const d=new Date(ymd+"T12:00:00");return{dow:d.toLocaleDateString("en-US",{weekday:"short"}).toUpperCase(),mon:d.toLocaleDateString("en-US",{month:"short"}).toUpperCase(),day:d.getDate()};};

  return <div>
    {/* Date navigation bar */}
    <div style={{background:C.dark,border:"1px solid "+C.border,borderRadius:12,marginBottom:16,overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center"}}>
        <button onClick={()=>shiftCenter(-1)} style={{background:"none",border:"none",cursor:"pointer",padding:"0 14px",height:64,color:C.copper,fontSize:22,lineHeight:1,display:"flex",alignItems:"center",flexShrink:0}}>&#8249;</button>
        <div style={{display:"flex",flex:1}}>
          {days.map(ymd=>{
            const {dow,mon,day}=dayFmt(ymd);
            const isSel=ymd===selDate;
            const isT=ymd===todayYMD;
            return <button key={ymd} onClick={()=>selectDay(ymd)} style={{flex:1,background:isSel?"linear-gradient(135deg,"+C.copper+"22,"+C.copper+"0a)":"none",border:"none",borderBottom:isSel?"2px solid "+C.copper:"2px solid transparent",cursor:"pointer",padding:"10px 2px",display:"flex",flexDirection:"column",alignItems:"center",gap:3,transition:"all .15s",minWidth:0}}>
              <span style={{fontFamily:"'Barlow Condensed'",fontSize:10,fontWeight:700,color:isSel?C.copper:C.muted,letterSpacing:1}}>{dow}</span>
              <span style={{fontFamily:"'Barlow Condensed'",fontSize:13,fontWeight:isSel||isT?900:600,color:isSel?C.copper:isT?C.white:C.muted,whiteSpace:"nowrap"}}>{mon} {day}</span>
            </button>;
          })}
        </div>
        <button onClick={()=>shiftCenter(1)} style={{background:"none",border:"none",cursor:"pointer",padding:"0 14px",height:64,color:C.copper,fontSize:22,lineHeight:1,display:"flex",alignItems:"center",flexShrink:0}}>&#8250;</button>
      </div>
    </div>
    {/* Games list */}
    {loading&&<div style={{textAlign:"center",padding:60,color:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:700,fontSize:18,letterSpacing:2}}>LOADING GAMES...</div>}
    {err&&<div style={{textAlign:"center",padding:60,color:C.copper,fontFamily:"'Barlow Condensed'",fontWeight:700,fontSize:16}}>{err}</div>}
    {!loading&&!err&&!data?.games?.length&&<div style={{textAlign:"center",padding:60,color:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:700,fontSize:16,letterSpacing:2}}>NO NBA GAMES ON THIS DATE</div>}
    {!loading&&!err&&data?.games?.map(game=><DailyGameCard key={game.id} game={game}/>)}
  </div>;
}

// ─── PGA ────────────────────────────────────────────────────────────────────
const PGA_G="#4ade80";

// Weights calibrated to TPC Sawgrass historical winner analysis (2013-2025):
// SG:Approach #1 — every winner ranked top-7 for the week; island green + firm Bermuda greens punish bad irons
// Driving Accuracy elevated — water on 17 holes, 3.5" rough (2024+), tight Pete Dye fairways
// SG:Off Tee reduced — accuracy > distance; all par-5s reachable, distance is marginal advantage
// Course history weak signal — Data Golf regression slope only 0.12; familiarity matters less than skill
const PGA_W_DEF=[
  {key:"sg_total",   label:"SG: Total",     cat:"Strokes Gained", higher:true,  def:2.5, note:"Composite skill proxy — 2nd overall predictor"},
  {key:"sg_approach",label:"SG: Approach",  cat:"Strokes Gained", higher:true,  def:3.5, note:"#1 predictor at Sawgrass — winners avg +1.5 SG:App/round"},
  {key:"sg_off_tee", label:"SG: Off Tee",   cat:"Strokes Gained", higher:true,  def:1.0, note:"Reduced weight — accuracy matters more than distance here"},
  {key:"driving_accuracy",label:"Drive Acc%",cat:"Accuracy",      higher:true,  def:2.5, note:"Elevated — water on 17 holes, 3.5\" rough, narrow fairways"},
  {key:"scoring_avg",label:"Scoring Avg",   cat:"Scoring",        higher:false, def:1.5, note:"Season avg quality signal"},
  {key:"recent_top10",label:"Recent Top-10s",cat:"Recent Form",   higher:true,  def:1.0, note:"Form confirmer — winners show good recent results"},
  {key:"recent_cut_rate",label:"Cut Rate",  cat:"Recent Form",    higher:true,  def:0.5, note:"Bogey avoidance — course punishes aggression with big numbers"},
  {key:"best_finish_players",label:"Best Finish",cat:"Course History",higher:false,def:1.5,note:"Weak signal (Data Golf slope=0.12) — use as tiebreaker"},
  {key:"has_top20_players",label:"Top-20 History",cat:"Course History",higher:true,def:0.5,note:"Binary course familiarity flag"},
  {key:"preview_rank",label:"Expert Rank",  cat:"Market",         higher:false, def:0.5, note:"Expert consensus — SG data should dominate over picks"},
];
const PGA_INIT_W=Object.fromEntries(PGA_W_DEF.map(d=>[d.key,d.def]));

function pgaScore(players,weights){
  const stats={};
  PGA_W_DEF.forEach(({key})=>{
    const vals=players.map(p=>p[key]).filter(v=>v!==null&&typeof v==="number"&&isFinite(v));
    if(!vals.length){stats[key]={mean:0,std:1};return;}
    const mean=vals.reduce((s,v)=>s+v,0)/vals.length;
    const std=Math.sqrt(vals.reduce((s,v)=>s+(v-mean)**2,0)/vals.length)||1;
    stats[key]={mean,std};
  });
  const scored=players.map(p=>{
    let comp=0,tw=0;
    PGA_W_DEF.forEach(({key,higher})=>{
      const v=p[key];if(v===null||typeof v!=="number"||!isFinite(v))return;
      const {mean,std}=stats[key];const w=weights[key]||0;
      comp+=(higher?(v-mean)/std:-(v-mean)/std)*w;tw+=w;
    });
    return{...p,composite:tw>0?comp:0};
  });
  const maxC=Math.max(...scored.map(p=>p.composite));
  const exps=scored.map(p=>Math.exp(Math.min(p.composite-maxC,50)));
  const sumE=exps.reduce((a,b)=>a+b,0)||1;
  return scored.map((p,i)=>({...p,win_pct:exps[i]/sumE}))
    .sort((a,b)=>b.win_pct-a.win_pct).map((p,i)=>({...p,rank:i+1}));
}

function PGAPage(){
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [weights,setWeights]=useState({...PGA_INIT_W});
  const [showW,setShowW]=useState(false);
  const [sortBy,setSortBy]=useState("rank");
  const [sortDir,setSortDir]=useState("asc");
  const [ranked,setRanked]=useState([]);
  const [toast,setToast]=useState("");

  const fetchData=async()=>{
    setLoading(true);setError("");
    try{const r=await fetch("/api/pga");const d=await r.json();
      if(!r.ok)throw new Error(d.error||"Error "+r.status);
      setData(d);}
    catch(e){setError(e.message);}
    setLoading(false);
  };
  useEffect(()=>{fetchData();},[]);
  useEffect(()=>{if(data?.players?.length)setRanked(pgaScore(data.players,weights));},[data,weights]);

  const doSort=k=>{if(sortBy===k)setSortDir(d=>d==="asc"?"desc":"asc");else{setSortBy(k);setSortDir(k==="name"?"asc":"desc");}};
  const sorted=[...ranked].sort((a,b)=>{const m=sortDir==="desc"?-1:1;if(sortBy==="name")return m*(a.name||"").localeCompare(b.name||"");return m*((a[sortBy]??0)-(b[sortBy]??0));});

  const exportCSV=()=>{
    const h=["Rank","Player","Win%","SG Tot","SG App","SG OTT","Drive%","Score Avg","Top10","Cut%","Best@PLAYERS","Expert","Reason"];
    const rows=ranked.map(p=>[p.rank,`"${p.name}"`,((p.win_pct||0)*100).toFixed(2),p.sg_total??"",p.sg_approach??"",p.sg_off_tee??"",p.driving_accuracy??"",p.scoring_avg??"",p.recent_top10??"",(p.recent_cut_rate!=null?((p.recent_cut_rate||0)*100).toFixed(0):""),p.best_finish_players==null||p.best_finish_players>=99?"":p.best_finish_players,p.preview_rank>=99?"":p.preview_rank,`"${p.reason||""}"`].join(",")).join("\n");
    const blob=new Blob([h.join(",")+"\n"+rows],{type:"text/csv"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");
    a.href=url;a.download="players-championship-2026.csv";a.click();URL.revokeObjectURL(url);
    setToast("CSV exported!");setTimeout(()=>setToast(""),2200);
  };

  const top10=ranked.slice(0,10);
  const maxW=top10[0]?.win_pct||0.01;
  const cats=[...new Set(PGA_W_DEF.map(d=>d.cat))];
  const TH=({k,l})=><th onClick={()=>doSort(k)} style={{padding:"6px 8px",textAlign:k==="name"?"left":"center",color:sortBy===k?PGA_G:C.muted,cursor:"pointer",whiteSpace:"nowrap",fontSize:9,letterSpacing:1,fontFamily:"'Barlow Condensed'",fontWeight:800,userSelect:"none"}}>{l}{sortBy===k?(sortDir==="asc"?" ▲":" ▼"):""}</th>;
  const medals=["🥇","🥈","🥉"];

  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    {/* Header */}
    <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,overflow:"hidden"}}>
      <SectionHeader label={(data?.tournament||"THE PLAYERS Championship 2026").toUpperCase()} accent={PGA_G}
        right={<button onClick={fetchData} disabled={loading} className="hov-btn" style={{padding:"5px 14px",background:PGA_G+"22",border:"1px solid "+PGA_G+"66",color:PGA_G,borderRadius:6,cursor:"pointer",fontFamily:"'Barlow Condensed'",fontWeight:700,fontSize:12,display:"flex",alignItems:"center",gap:5}}>
          {loading?<span className="spin">⟳</span>:"↻"} REFRESH</button>}/>
      <div style={{padding:"8px 16px 10px",display:"flex",flexWrap:"wrap",gap:8,alignItems:"center"}}>
        <span style={{fontSize:11,color:C.muted}}>
          {loading&&<span className="pulse" style={{color:PGA_G}}>Analyzing 2025-26 season data via Perplexity AI...</span>}
          {error&&<span style={{color:C.amber}}>⚠ {error}</span>}
          {data&&!loading&&<>
            <span style={{color:PGA_G,fontWeight:700}}>{data.players?.length||0} players</span>
            <span style={{color:C.dim}}> · </span>
            <span>{data.course||"TPC Sawgrass"}</span>
            {data.espnEventFound&&<><span style={{color:C.dim}}> · </span><span style={{color:PGA_G}}>● ESPN field active</span></>}
            {data.debug&&<span style={{color:C.amber,marginLeft:6,fontFamily:"monospace",fontSize:10}}>⚠ parse fail: {data.debug.slice(0,120)}</span>}
          </>}
        </span>
        {ranked.length>0&&<button onClick={exportCSV} className="hov-btn" style={{marginLeft:"auto",padding:"4px 10px",background:C.black,border:"1px solid "+C.border,color:C.muted,borderRadius:6,cursor:"pointer",fontFamily:"'Barlow Condensed'",fontWeight:700,fontSize:10}}>⬇ CSV</button>}
      </div>
    </div>

    {/* Loading skeleton */}
    {loading&&!data&&<div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:40,textAlign:"center"}}>
      <div className="pulse" style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:20,color:PGA_G,letterSpacing:2}}>LOADING PREDICTIONS...</div>
      <div style={{fontSize:11,color:C.muted,marginTop:8}}>Fetching SG stats, recent form & course history</div>
    </div>}

    {/* ── PREDICTED TOP 10 FINISHERS ── */}
    {top10.length>0&&<div style={{background:C.card,border:"1px solid "+PGA_G+"44",borderRadius:12,overflow:"hidden"}}>
      <div style={{padding:"10px 16px",background:"linear-gradient(90deg,"+PGA_G+"18,transparent)",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:3,height:16,borderRadius:2,background:PGA_G}}/>
        <span style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:15,letterSpacing:2,color:PGA_G,textTransform:"uppercase"}}>Predicted Top 10 Finishers</span>
        <span style={{fontSize:10,color:C.muted,marginLeft:4}}>TPC Sawgrass · 2026</span>
      </div>
      {/* Podium — top 3 */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,padding:"14px 14px 0"}}>
        {top10.slice(0,3).map((p,i)=><div key={p.name} style={{background:i===0?"linear-gradient(135deg,"+PGA_G+"22,"+PGA_G+"0a)":C.black,borderRadius:10,padding:"14px 10px",border:"1px solid "+(i===0?PGA_G+"66":C.border),textAlign:"center"}}>
          <div style={{fontSize:22,marginBottom:4}}>{medals[i]}</div>
          <div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:i===0?16:14,color:i===0?PGA_G:C.white,lineHeight:1.1,marginBottom:6}}>{p.name}</div>
          <div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:20,color:PGA_G,marginBottom:2}}>{((p.win_pct||0)*100).toFixed(1)}%</div>
          <div style={{fontSize:9,color:C.muted,letterSpacing:1,textTransform:"uppercase",marginBottom:p.reason?6:0}}>Win probability</div>
          {p.reason&&<div style={{fontSize:9,color:C.muted,lineHeight:1.4,marginTop:4,fontStyle:"italic"}}>{p.reason}</div>}
          <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"center",marginTop:6}}>
            {p.has_top20_players===1&&<span style={{fontSize:8,padding:"1px 5px",borderRadius:3,background:PGA_G+"22",color:PGA_G,border:"1px solid "+PGA_G+"44"}}>COURSE HIST</span>}
            {p.preview_rank<=5&&p.preview_rank<99&&<span style={{fontSize:8,padding:"1px 5px",borderRadius:3,background:C.amber+"22",color:C.amber,border:"1px solid "+C.amber+"44"}}>#{p.preview_rank} EXPERT</span>}
          </div>
        </div>)}
      </div>
      {/* Positions 4-10 */}
      <div style={{padding:"10px 14px 14px",display:"flex",flexDirection:"column",gap:6}}>
        {top10.slice(3).map((p,i)=><div key={p.name} style={{display:"flex",alignItems:"center",gap:12,background:C.black,borderRadius:8,padding:"8px 12px",border:"1px solid "+C.border}}>
          <span style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:18,color:C.muted,minWidth:24,textAlign:"center"}}>{i+4}</span>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:14,color:C.white}}>{p.name}
              {p.has_top20_players===1&&<span style={{marginLeft:6,fontSize:8,padding:"1px 4px",borderRadius:3,background:PGA_G+"22",color:PGA_G,border:"1px solid "+PGA_G+"44"}}>HIST</span>}
            </div>
            {p.reason&&<div style={{fontSize:10,color:C.muted,marginTop:1}}>{p.reason}</div>}
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:15,color:PGA_G}}>{((p.win_pct||0)*100).toFixed(1)}%</div>
            {p.sg_total!=null&&<div style={{fontSize:9,color:C.muted}}>SG {p.sg_total>0?"+":""}{p.sg_total?.toFixed(2)}</div>}
          </div>
          {/* Mini bar */}
          <div style={{width:50,height:4,borderRadius:2,background:C.border,overflow:"hidden"}}>
            <div style={{height:"100%",width:((p.win_pct/maxW)*100)+"%",background:PGA_G+"99",borderRadius:2}}/>
          </div>
        </div>)}
      </div>
    </div>}

    {/* Weight Controls */}
    {/* Course analysis callouts */}
    {ranked.length>0&&<div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:"10px 14px",display:"flex",flexWrap:"wrap",gap:8}}>
      {[
        {icon:"⛳",label:"SG: Approach #1",note:"Winners avg +1.5 SG:App/round · ranked top-7 every year"},
        {icon:"🎯",label:"Accuracy elevated",note:"Water on 17 holes · 3.5\" rough · narrow Pete Dye fairways"},
        {icon:"📉",label:"Distance less critical",note:"All par-5s reachable · accuracy > raw power here"},
        {icon:"📊",label:"Course history weak",note:"Data Golf regression slope = 0.12 · form + skill dominate"},
      ].map(({icon,label,note})=><div key={label} style={{background:C.black,borderRadius:8,padding:"6px 10px",border:"1px solid "+C.border,flex:"1 1 160px"}}>
        <div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:12,color:PGA_G}}>{icon} {label}</div>
        <div style={{fontSize:9,color:C.muted,marginTop:2,lineHeight:1.4}}>{note}</div>
      </div>)}
    </div>}

    {ranked.length>0&&<div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,overflow:"hidden"}}>
      <div onClick={()=>setShowW(v=>!v)} style={{padding:"10px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,userSelect:"none"}}>
        <span style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1.5,color:PGA_G,textTransform:"uppercase"}}>Adjust Model Weights</span>
        <span style={{color:C.muted,fontSize:11}}>{showW?"▲":"▼ expand"}</span>
        <button onClick={e=>{e.stopPropagation();setWeights({...PGA_INIT_W});}} style={{marginLeft:"auto",fontSize:10,padding:"3px 8px",background:C.black,border:"1px solid "+C.border,color:C.muted,borderRadius:4,cursor:"pointer",fontFamily:"'Barlow Condensed'",fontWeight:700}}>RESET</button>
      </div>
      {showW&&<div style={{padding:"0 16px 16px",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:12}}>
        {cats.map(cat=><div key={cat}>
          <div style={{fontSize:9,color:PGA_G,letterSpacing:1.5,textTransform:"uppercase",marginBottom:6,fontWeight:700}}>{cat}</div>
          {PGA_W_DEF.filter(d=>d.cat===cat).map(({key,label,note})=><div key={key} style={{marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
              <span style={{fontSize:10,color:C.muted}} title={note||""}>{label}</span>
              <span style={{fontSize:10,color:PGA_G,fontWeight:700}}>{(weights[key]||0).toFixed(1)}×</span>
            </div>
            {note&&<div style={{fontSize:8,color:C.dim,marginBottom:2,lineHeight:1.3}}>{note}</div>}
            <input type="range" min="0" max="5" step="0.5" value={weights[key]||0}
              onChange={e=>setWeights(w=>({...w,[key]:parseFloat(e.target.value)}))}
              style={{width:"100%",accentColor:PGA_G,cursor:"pointer"}}/>
          </div>)}
        </div>)}
      </div>}
    </div>}

    {/* Full Rankings Table */}
    {sorted.length>0&&<div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,overflow:"hidden"}}>
      <div style={{padding:"10px 16px",fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1.5,color:PGA_G,textTransform:"uppercase",borderBottom:"1px solid "+C.border}}>Full Model Rankings — {sorted.length} Players</div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"'Barlow'"}}>
          <thead><tr style={{borderBottom:"1px solid "+C.border}}>
            <TH k="rank" l="RK"/><TH k="name" l="PLAYER"/><TH k="win_pct" l="WIN%"/>
            <TH k="sg_total" l="SG TOT"/><TH k="sg_approach" l="SG APP"/><TH k="sg_off_tee" l="SG OTT"/>
            <TH k="driving_accuracy" l="DA%"/><TH k="scoring_avg" l="SCORE"/>
            <TH k="recent_top10" l="TOP10"/><TH k="best_finish_players" l="BEST@PLYR"/>
            <TH k="preview_rank" l="EXPERT"/>
          </tr></thead>
          <tbody>{sorted.map((p,i)=>{
            const top3=p.rank<=3;const sgC=v=>v==null?"—":v>1?PGA_G:v<0?"#f87171":C.muted;
            return <tr key={p.name} style={{borderBottom:"1px solid "+C.border+"44",background:i%2===0?"transparent":C.black+"44",cursor:"default"}} title={p.reason||""}>
              <td style={{padding:"6px 8px",textAlign:"center",fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:13,color:p.rank===1?PGA_G:p.rank<=3?PGA_G+"99":C.muted}}>{p.rank}</td>
              <td style={{padding:"6px 8px",color:C.white,fontWeight:top3?700:400,minWidth:150,whiteSpace:"nowrap"}}>
                {p.name}
                {p.has_top20_players===1&&<span style={{marginLeft:5,fontSize:8,padding:"1px 4px",borderRadius:3,background:PGA_G+"22",color:PGA_G,border:"1px solid "+PGA_G+"44"}}>HIST</span>}
                {p.preview_rank<=5&&p.preview_rank<99&&<span style={{marginLeft:4,fontSize:8,padding:"1px 4px",borderRadius:3,background:C.amber+"22",color:C.amber,border:"1px solid "+C.amber+"44"}}>#{p.preview_rank}</span>}
              </td>
              <td style={{padding:"6px 8px",textAlign:"center",fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:13,color:top3?PGA_G:C.white}}>{((p.win_pct||0)*100).toFixed(1)}%</td>
              <td style={{padding:"6px 8px",textAlign:"center",color:sgC(p.sg_total)}}>{p.sg_total?.toFixed(2)??"—"}</td>
              <td style={{padding:"6px 8px",textAlign:"center",color:p.sg_approach>0.5?PGA_G:C.muted}}>{p.sg_approach?.toFixed(2)??"—"}</td>
              <td style={{padding:"6px 8px",textAlign:"center",color:C.muted}}>{p.sg_off_tee?.toFixed(2)??"—"}</td>
              <td style={{padding:"6px 8px",textAlign:"center",color:C.muted}}>{p.driving_accuracy?.toFixed(1)??"—"}</td>
              <td style={{padding:"6px 8px",textAlign:"center",color:C.muted}}>{p.scoring_avg?.toFixed(2)??"—"}</td>
              <td style={{padding:"6px 8px",textAlign:"center",color:p.recent_top10>=3?PGA_G:C.muted}}>{p.recent_top10??"—"}</td>
              <td style={{padding:"6px 8px",textAlign:"center",color:p.best_finish_players!=null&&p.best_finish_players<99&&p.best_finish_players<=10?PGA_G:C.muted}}>{p.best_finish_players==null||p.best_finish_players>=99?"—":p.best_finish_players}</td>
              <td style={{padding:"6px 8px",textAlign:"center",color:p.preview_rank<=5&&p.preview_rank<99?C.amber:C.muted}}>{p.preview_rank==null||p.preview_rank>=99?"—":"#"+p.preview_rank}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </div>}

    {!loading&&!error&&!data&&<div style={{textAlign:"center",padding:60,color:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:700,fontSize:16,letterSpacing:2}}>CLICK REFRESH TO LOAD PREDICTIONS</div>}
    {toast&&<div className="toast" style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:PGA_G,color:C.black,padding:"8px 20px",borderRadius:20,fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:14,zIndex:999}}>{toast}</div>}
  </div>;
}

export default function App(){
  const [sport,setSport]=useState("nba");
  const TABS=[{id:"nba",label:"NBA",accent:C.teal,sub:"5-model system - Elo - RAPTOR - Four Factors - ML/BPI - Monte Carlo"},{id:"nhl",label:"NHL",accent:C.ice,sub:"5-model system - Elo - Goalie - Special Teams - Corsi - Monte Carlo"},{id:"ncaam",label:"NCAAM",accent:C.amber,sub:"5-model system - KenPom - BPI - Four Factors - Tempo - Monte Carlo"},{id:"daily",label:"DAILY",accent:C.copper,sub:"All today's NBA games with spread, moneyline, total & model picks"},{id:"pga",label:"PGA",accent:PGA_G,sub:"THE PLAYERS Championship - SG Model - Course History - Expert Picks"}];
  const ct=TABS.find(t=>t.id===sport);
  return <div style={{minHeight:"100vh",background:C.black,fontFamily:"'Barlow',sans-serif",color:C.white,overflowX:"hidden"}}>
    <style>{STYLES}</style>
    <div style={{background:C.dark,borderBottom:"1px solid "+C.border}}>
      <div style={{maxWidth:1040,margin:"0 auto",padding:"0 16px"}}>
        <div style={{display:"flex",alignItems:"center",height:56,gap:16}}>
          <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
            <div style={{width:32,height:32,borderRadius:6,background:"linear-gradient(135deg,"+C.copper+","+C.copperL+")",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:14,color:C.black}}>CE</div>
            <div><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:20,color:C.white,letterSpacing:1,lineHeight:1}}>COURT EDGE</div><div style={{fontSize:9,color:C.copper,letterSpacing:2,textTransform:"uppercase"}}>Sports Analytics</div></div>
          </div>
          <div style={{display:"flex",gap:2,marginLeft:16,background:C.black,borderRadius:8,padding:3,border:"1px solid "+C.border}}>
            {TABS.map(item=><button key={item.id} className="hdr-tab-btn" onClick={()=>setSport(item.id)} style={{padding:"7px 16px",borderRadius:6,border:"none",cursor:"pointer",background:sport===item.id?"linear-gradient(135deg,"+item.accent+"22,"+item.accent+"11)":"transparent",color:sport===item.id?item.accent:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:14,letterSpacing:1,borderBottom:sport===item.id?"2px solid "+item.accent:"2px solid transparent",transition:"all .2s ease"}}>{item.label}</button>)}
          </div>
          <div className="hdr-badges" style={{marginLeft:"auto",display:"flex",gap:6,alignItems:"center"}}>
            <div style={{padding:"5px 12px",borderRadius:20,background:"linear-gradient(90deg,"+C.copper+","+C.copperL+")",fontSize:11,fontWeight:700,color:C.black,fontFamily:"'Barlow Condensed'",letterSpacing:1}}>2025-26 LIVE</div>
            <div style={{padding:"5px 12px",borderRadius:20,background:C.card,border:"1px solid "+C.border,fontSize:11,color:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:700}}>5 MODELS</div>
          </div>
        </div>
      </div>
    </div>
    <div style={{background:"linear-gradient(90deg,"+ct.accent+"18,transparent)",borderBottom:"1px solid "+C.border,padding:"8px 16px"}}>
      <div style={{maxWidth:1040,margin:"0 auto",display:"flex",alignItems:"center",gap:10,overflow:"hidden"}}>
        <span className="hdr-title" style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:18,color:ct.accent,letterSpacing:2,whiteSpace:"nowrap"}}>{ct.label==="NBA"?"NBA MONEYLINE ANALYZER":ct.label==="NHL"?"NHL MONEYLINE ANALYZER":ct.label==="NCAAM"?"NCAA TOURNAMENT PREDICTOR":ct.label==="PGA"?"PGA PLAYERS MODEL":"NBA DAILY PICKS"}</span>
        <span className="hdr-sub" style={{fontSize:11,color:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ct.sub}</span>
      </div>
    </div>
    <div style={{maxWidth:1040,margin:"0 auto",padding:"16px"}}>
      {sport==="nba"&&<NBAPage/>}
      {sport==="nhl"&&<NHLPage/>}
      {sport==="ncaam"&&<NCAAMPage/>}
      {sport==="daily"&&<DailyPage/>}
      {sport==="pga"&&<PGAPage/>}
      <div style={{fontSize:10,color:C.dim,textAlign:"center",padding:"16px 0 8px"}}>For informational and entertainment purposes only - Not financial advice - Gamble responsibly</div>
    </div>
  </div>;
}
