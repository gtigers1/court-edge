// v7-ncaam
import { useState } from "react";

function oddsToImplied(o){if(!o||o==="-"||o==="+")return null;const n=parseInt(o);if(isNaN(n)||n===0)return null;return n>0?100/(n+100):Math.abs(n)/(Math.abs(n)+100);}
function probToAmerican(p){p=Math.max(0.01,Math.min(0.99,p));return p>=0.5?("-"+Math.round((p/(1-p))*100)):("+"+ Math.round(((1-p)/p)*100));}
function calcEV(prob,odds){const o=parseInt(odds);if(isNaN(o))return null;const pay=o>0?o/100:100/Math.abs(o);return(prob*pay-(1-prob)).toFixed(3);}
function logistic(x){return 1/(1+Math.exp(-x));}
function devigged(homeOdds,awayOdds){const h=oddsToImplied(homeOdds),a=oddsToImplied(awayOdds);if(!h||!a)return null;return h/(h+a);}

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
  ::-webkit-scrollbar{width:4px;}
  ::-webkit-scrollbar-track{background:#111116;}
  ::-webkit-scrollbar-thumb{background:#3A3A4A;border-radius:2px;}
`;

const STATUS_COLORS={PLAYING:"#2DD4A0",QUESTIONABLE:"#F5A623",DOUBTFUL:"#E07B30",OUT:"#E05252"};
const STATUS_CYCLE=["PLAYING","QUESTIONABLE","DOUBTFUL","OUT"];

function Badge({abbr,size=44,accent}){return <div style={{width:size,height:size,borderRadius:8,background:"linear-gradient(135deg,#3A3A4A,#16161C)",border:"1.5px solid "+(accent||C.copper),display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:size*.28,color:accent||C.copper,letterSpacing:.5,flexShrink:0}}>{abbr}</div>;}
function Pill({label,color}){return <span style={{padding:"2px 8px",borderRadius:12,background:color+"18",border:"1px solid "+color,color,fontSize:10,fontWeight:700,fontFamily:"'Barlow Condensed'"}}>{label}</span>;}
function OddsPill({prob,accent}){const ac=accent||C.teal,fav=prob>=.5;return <div style={{padding:"10px 18px",borderRadius:8,textAlign:"center",background:fav?ac+"18":C.black,border:"1.5px solid "+(fav?ac:C.border),minWidth:80}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:22,color:fav?ac:C.white}}>{probToAmerican(prob)}</div><div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:1,marginTop:1}}>Fair odds</div></div>;}
function SectionHeader({label,accent,right}){return <div style={{padding:"10px 16px",background:"linear-gradient(90deg,"+(accent||C.copper)+"22,transparent)",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:8}}><div style={{width:3,height:16,borderRadius:2,background:accent||C.copper}}/><span style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:14,letterSpacing:1.5,color:C.white,textTransform:"uppercase"}}>{label}</span>{right&&<div style={{marginLeft:"auto"}}>{right}</div>}</div>;}
function WinBar({awayProb,awayAbbr,homeAbbr,accent}){const ac=accent||C.teal;return <div style={{marginTop:8}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontFamily:"'Barlow Condensed'",fontSize:13,fontWeight:700,color:awayProb>.5?ac:C.muted}}>{awayAbbr} {(awayProb*100).toFixed(1)}%</span><span style={{fontFamily:"'Barlow Condensed'",fontSize:13,fontWeight:700,color:(1-awayProb)>.5?ac:C.muted}}>{(100-awayProb*100).toFixed(1)}% {homeAbbr}</span></div><div style={{height:6,borderRadius:3,background:C.border,overflow:"hidden"}}><div style={{height:"100%",width:(awayProb*100)+"%",background:"linear-gradient(90deg,"+ac+"99,"+ac+")",borderRadius:3,transition:"width .6s ease"}}/></div></div>;}

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
  return <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:10,overflow:"hidden"}}>
    <div style={{padding:"10px 14px",background:C.dark,borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:10}}>
      <Badge abbr={abbr} size={36} accent={ac}/>
      <div><div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:15,color:C.white}}>{teamName}</div><div style={{fontSize:11,color:C.muted}}>{subtitle}</div></div>
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
        else sub=p.ppg+" PPG";
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
  const hp=1-awayProb,ac=accent||C.teal,af=awayProb>=.5;
  return <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:10,padding:14,display:"flex",flexDirection:"column",gap:10}}>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{width:28,height:28,borderRadius:6,background:ac+"22",border:"1px solid "+ac+"44",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontFamily:"'Barlow Condensed'",fontWeight:900,color:ac}}>{icon}</div>
      <div><div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,color:C.copper,letterSpacing:1,textTransform:"uppercase"}}>{name}</div><div style={{fontSize:10,color:C.muted}}>{desc}</div></div>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{display:"flex",alignItems:"center",gap:6,flex:1}}><Badge abbr={awayAbbr} size={28} accent={ac}/><div><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:20,color:af?ac:C.white,lineHeight:1}}>{(awayProb*100).toFixed(0)}%</div><div style={{fontSize:9,color:C.muted}}>{awayTeam.split(" ").at(-1)}</div></div></div>
      <div style={{width:1,height:32,background:C.border}}/>
      <div style={{display:"flex",alignItems:"center",gap:6,flex:1,justifyContent:"flex-end"}}><div style={{textAlign:"right"}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:20,color:!af?ac:C.white,lineHeight:1}}>{(hp*100).toFixed(0)}%</div><div style={{fontSize:9,color:C.muted}}>{homeTeam.split(" ").at(-1)}</div></div><Badge abbr={homeAbbr} size={28} accent={ac}/></div>
    </div>
    <div style={{height:4,borderRadius:2,background:C.border,overflow:"hidden"}}><div style={{height:"100%",width:(awayProb*100)+"%",background:"linear-gradient(90deg,"+ac+"99,"+ac+")",transition:"width .5s ease"}}/></div>
    {detail&&<div style={{fontSize:10,color:C.muted,lineHeight:1.5}}>{detail}</div>}
  </div>;
}

// â”€â”€â”€ NBA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const NBA_TEAMS=["Atlanta Hawks","Boston Celtics","Brooklyn Nets","Charlotte Hornets","Chicago Bulls","Cleveland Cavaliers","Dallas Mavericks","Denver Nuggets","Detroit Pistons","Golden State Warriors","Houston Rockets","Indiana Pacers","LA Clippers","Los Angeles Lakers","Memphis Grizzlies","Miami Heat","Milwaukee Bucks","Minnesota Timberwolves","New Orleans Pelicans","New York Knicks","Oklahoma City Thunder","Orlando Magic","Philadelphia 76ers","Phoenix Suns","Portland Trail Blazers","Sacramento Kings","San Antonio Spurs","Toronto Raptors","Utah Jazz","Washington Wizards"];
const NBA_ABBR={"Atlanta Hawks":"ATL","Boston Celtics":"BOS","Brooklyn Nets":"BKN","Charlotte Hornets":"CHA","Chicago Bulls":"CHI","Cleveland Cavaliers":"CLE","Dallas Mavericks":"DAL","Denver Nuggets":"DEN","Detroit Pistons":"DET","Golden State Warriors":"GSW","Houston Rockets":"HOU","Indiana Pacers":"IND","LA Clippers":"LAC","Los Angeles Lakers":"LAL","Memphis Grizzlies":"MEM","Miami Heat":"MIA","Milwaukee Bucks":"MIL","Minnesota Timberwolves":"MIN","New Orleans Pelicans":"NOP","New York Knicks":"NYK","Oklahoma City Thunder":"OKC","Orlando Magic":"ORL","Philadelphia 76ers":"PHI","Phoenix Suns":"PHX","Portland Trail Blazers":"POR","Sacramento Kings":"SAC","San Antonio Spurs":"SAS","Toronto Raptors":"TOR","Utah Jazz":"UTA","Washington Wizards":"WAS"};

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
  // Season Pythagorean (exp 13.91 = empirically optimal for NBA)
  // Uses point differential, ignores W/L noise
  const hP=pythagorean(h.ppg,h.opp,13.91);
  const aP=pythagorean(a.ppg,a.opp,13.91);
  // L10 Pythagorean for recency  -  recent form is meaningful but noisy
  const hR=pythagorean(h.last10_ppg||h.ppg, h.last10_opp||h.opp, 13.91);
  const aR=pythagorean(a.last10_ppg||a.ppg, a.last10_opp||a.opp, 13.91);
  // Blend: 65% season quality, 35% recent form
  const hQ=hP*0.65+hR*0.35;
  const aQ=aP*0.65+aR*0.35;
  // HCA applied as a fixed pythagorean bump: home team modeled as if scoring 3.2 more
  const hHCA=pythagorean(h.ppg+3.2,h.opp,13.91);
  const hAdj=hQ*0.65+hHCA*0.35;
  // Injury reduction applied to quality directly
  const hi=injPen(h.roster,0.09,0.04,0.01);
  const ai=injPen(a.roster,0.09,0.04,0.01);
  const p=log5(Math.max(0.03,hAdj-hi),Math.max(0.03,aQ-ai));
  return{homeProb:p,hQ:(hQ*100).toFixed(1),aQ:(aQ*100).toFixed(1),detail:`H Pyth ${(hQ*100).toFixed(1)}%  A Pyth ${(aQ*100).toFixed(1)}%  +3.2pt HCA`};}

function nbaMdlNetRating(h,a){
  // Net rating blend: season NET is the single best predictor
  // +1 pt net rating ~ +2.7% win probability (empirical NBA)
  const hNet=h.ppg-h.opp;
  const aNet=a.ppg-a.opp;
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
  return{homeProb:Math.min(0.97,Math.max(0.03,p)),hNet:hBlend.toFixed(1),aNet:aBlend.toFixed(1),detail:`H Net ${hBlend>0?"+":""}${hBlend.toFixed(1)}  A Net ${aBlend>0?"+":""}${aBlend.toFixed(1)}  Diff: ${adjDiff.toFixed(1)}`};}

function nbaMdlFourFactors(h,a){
  // Four Factors: eFG% 40%, TOV% 25%, OREB% 20%, FTR 15%
  // INDEPENDENT from PPG/opp signal  -  uses efficiency ratios
  // NBA average: eFG ~52%, TOV ~13%, OREB ~25%, FTR ~23%
  const ff=d=>{
    const efg=(d.efg_pct||0.52)*0.40;
    // tov_rate from API is turnovers per 100 possessions (NBA avg ~13)
    // Normalize to 0-1 where lower is better: (25-tov)/25 scaled
    const tov=(1-Math.min(d.tov_rate||13,25)/25)*0.25;
    const oreb=(d.oreb_pct||0.25)*0.20;
    const ftr=Math.min(d.ftr||d.ft_rate||0.22,0.50)*0.15;
    return efg+tov+oreb+ftr;};
  const hFF=ff(h),aFF=ff(a);
  // Small HCA: home teams shoot ~0.5% better eFG, steal ~0.5% fewer possessions
  const hFFadj=hFF+0.002*0.40+0.001*0.25;
  const hi=injPen(h.roster,0.06,0.03,0.008);
  const ai=injPen(a.roster,0.06,0.03,0.008);
  const p=logistic((hFFadj-aFF)*9-(hi-ai)*3.5);
  return{homeProb:Math.min(0.97,Math.max(0.03,p)),hFF:hFF.toFixed(4),aFF:aFF.toFixed(4),detail:`H FF: ${hFF.toFixed(3)}  A FF: ${aFF.toFixed(3)}`};}

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
  const hOff=(h.ppg*0.60+(h.last10_ppg||h.ppg)*0.40)*(1-hi);
  const aOff=(a.ppg*0.60+(a.last10_ppg||a.ppg)*0.40)*(1-ai);
  const hDef=(a.opp*0.60+(a.last10_opp||a.opp)*0.40)*(1-ai*0.4);
  const aDef=(h.opp*0.60+(h.last10_opp||h.opp)*0.40)*(1-hi*0.4);
  // Projected scores blend own offense vs opponent defense
  const hExp=(hOff*0.55+hDef*0.45)+1.6; // +1.6 HCA in pts; blend own offense vs opp defense (both in pts units)
  const aExp=aOff*0.55+aDef*0.45;
  const sig=11.5; // NBA single-game std dev ~11-12 pts
  let w=0;
  for(let i=0;i<N;i++){
    const z1=Math.sqrt(-2*Math.log(Math.random()))*Math.cos(2*Math.PI*Math.random());
    const z2=Math.sqrt(-2*Math.log(Math.random()))*Math.cos(2*Math.PI*Math.random());
    if(hExp+z1*sig>aExp+z2*sig)w++;}
  return{homeProb:Math.min(0.97,Math.max(0.03,w/N)),hExp:hExp.toFixed(1),aExp:aExp.toFixed(1),detail:`Proj: H ${hExp.toFixed(1)}  A ${aExp.toFixed(1)} pts`};}

function nbaConsensus(ps,mkt){
  // NetRating gets most weight  -  it's the best single NBA predictor
  // 15% shrinkage toward 50% to prevent overconfidence from stale/incomplete data
  const m=Math.min(0.97,Math.max(0.03,[0.20,0.28,0.18,0.16,0.18].reduce((s,w,i)=>s+ps[i]*w,0)));
  const shrunk=0.5+(m-0.5)*0.85;
  // Market (de-vigged) encodes injuries, sharp money, line movement  -  33% weight when available
  if(mkt===null||mkt===undefined)return shrunk;
  return Math.min(0.97,Math.max(0.03,shrunk*0.67+mkt*0.33));}

function NBAPage(){
  const [awayTeam,setAwayTeam]=useState("");const [homeTeam,setHomeTeam]=useState("");const [awayOdds,setAwayOdds]=useState("");const [homeOdds,setHomeOdds]=useState("");const [awayData,setAwayData]=useState(null);const [homeData,setHomeData]=useState(null);const [awayLoading,setAwayLoading]=useState(false);const [homeLoading,setHomeLoading]=useState(false);const [awayError,setAwayError]=useState("");const [homeError,setHomeError]=useState("");const [results,setResults]=useState(null);const [tab,setTab]=useState("results");const [analyzing,setAnalyzing]=useState(false);
  const fetchTeam=async(team,side)=>{const setL=side==="away"?setAwayLoading:setHomeLoading;const setD=side==="away"?setAwayData:setHomeData;const setE=side==="away"?setAwayError:setHomeError;setL(true);setD(null);setE("");setResults(null);try{const r=await fetch("/api/team",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({team,sport:"nba"})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Error "+r.status);setD(d);}catch(e){setE(e.message);}setL(false);};
  const cyclePlayer=(side,name)=>{const [g,s]=side==="home"?[homeData,setHomeData]:[awayData,setAwayData];if(!g)return;s({...g,roster:g.roster.map(p=>p.name!==name?p:{...p,status:STATUS_CYCLE[(STATUS_CYCLE.indexOf(p.status)+1)%4]})});};
  const runModels=()=>{if(!homeData||!awayData)return;setAnalyzing(true);setTimeout(()=>{const pyth=nbaMdlPythagorean(homeData,awayData),net=nbaMdlNetRating(homeData,awayData),ff=nbaMdlFourFactors(homeData,awayData),star=nbaMdlStarPower(homeData,awayData),mc=nbaMdlMonteCarlo(homeData,awayData);const mkt=devigged(homeOdds,awayOdds);setResults({pyth,net,ff,star,mc,mkt,cons:nbaConsensus([pyth.homeProb,net.homeProb,ff.homeProb,star.homeProb,mc.homeProb],mkt)});setTab("results");setAnalyzing(false);},50);};
  const inp={width:"100%",padding:"10px 12px",background:C.black,border:"1.5px solid "+C.border,borderRadius:8,color:C.white,fontSize:13,outline:"none",fontFamily:"'Barlow',sans-serif"};
  const bothLoaded=awayData&&homeData;const awayAbbr=NBA_ABBR[awayTeam]||"AWY";const homeAbbr=NBA_ABBR[homeTeam]||"HME";
  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,overflow:"hidden"}}>
      <SectionHeader label="Step 1 - Select Away Team" accent={C.teal} right={awayData&&<Pill label={awayAbbr+" LOADED"} color={C.teal}/>}/>
      <div style={{padding:14}}><div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,alignItems:"flex-end"}}><div><div style={{fontSize:10,color:C.teal,fontFamily:"'Barlow Condensed'",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>Away Team</div><select style={{...inp,cursor:"pointer"}} value={awayTeam} onChange={e=>{setAwayTeam(e.target.value);setAwayData(null);setResults(null);}}><option value="">Select away team...</option>{NBA_TEAMS.map(t=><option key={t} value={t}>{t}</option>)}</select></div><button className="hov-btn" onClick={()=>fetchTeam(awayTeam,"away")} disabled={!awayTeam||awayLoading} style={{padding:"10px 20px",background:awayTeam&&!awayLoading?"linear-gradient(90deg,"+C.tealD+","+C.teal+")":C.dim,border:"none",borderRadius:8,cursor:awayTeam&&!awayLoading?"pointer":"not-allowed",fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:14,letterSpacing:1.5,color:awayTeam&&!awayLoading?C.black:C.muted,textTransform:"uppercase",whiteSpace:"nowrap"}}>{awayLoading?<span className="pulse">Loading...</span>:"Load Roster"}</button></div>{awayError&&<div style={{marginTop:8,padding:"8px 12px",background:"#2a0f0f",border:"1px solid #5a2020",borderRadius:6,fontSize:11,color:"#f87171"}}>{awayError}</div>}</div>
      {(awayLoading||awayData)&&<div style={{padding:"0 14px 14px"}}><RosterPanel teamName={awayTeam} abbr={awayAbbr} teamData={awayData} onCycle={n=>cyclePlayer("away",n)} sport="nba" accent={C.teal} loading={awayLoading}/></div>}
    </div>
    <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,overflow:"hidden"}}>
      <SectionHeader label="Step 2 - Select Home Team" accent={C.copper} right={homeData&&<Pill label={homeAbbr+" LOADED"} color={C.copper}/>}/>
      <div style={{padding:14}}><div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,alignItems:"flex-end"}}><div><div style={{fontSize:10,color:C.copper,fontFamily:"'Barlow Condensed'",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>Home Team</div><select style={{...inp,cursor:"pointer"}} value={homeTeam} onChange={e=>{setHomeTeam(e.target.value);setHomeData(null);setResults(null);}}><option value="">Select home team...</option>{NBA_TEAMS.map(t=><option key={t} value={t}>{t}</option>)}</select></div><button className="hov-btn" onClick={()=>fetchTeam(homeTeam,"home")} disabled={!homeTeam||homeLoading} style={{padding:"10px 20px",background:homeTeam&&!homeLoading?"linear-gradient(90deg,"+C.copper+","+C.copperL+")":C.dim,border:"none",borderRadius:8,cursor:homeTeam&&!homeLoading?"pointer":"not-allowed",fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:14,letterSpacing:1.5,color:homeTeam&&!homeLoading?C.black:C.muted,textTransform:"uppercase",whiteSpace:"nowrap"}}>{homeLoading?<span className="pulse">Loading...</span>:"Load Roster"}</button></div>{homeError&&<div style={{marginTop:8,padding:"8px 12px",background:"#2a0f0f",border:"1px solid #5a2020",borderRadius:6,fontSize:11,color:"#f87171"}}>{homeError}</div>}</div>
      {(homeLoading||homeData)&&<div style={{padding:"0 14px 14px"}}><RosterPanel teamName={homeTeam} abbr={homeAbbr} teamData={homeData} onCycle={n=>cyclePlayer("home",n)} sport="nba" accent={C.copper} loading={homeLoading}/></div>}
    </div>
    {bothLoaded&&<div className="fade-in" style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,overflow:"hidden"}}>
      <SectionHeader label="Step 3 - Set Odds & Analyze"/>
      <div style={{padding:14}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}><div><div style={{fontSize:10,color:C.muted,letterSpacing:1,marginBottom:5,textTransform:"uppercase"}}>Away Moneyline ({awayAbbr})</div><input style={inp} placeholder="+130" value={awayOdds} onChange={e=>setAwayOdds(e.target.value)}/></div><div><div style={{fontSize:10,color:C.muted,letterSpacing:1,marginBottom:5,textTransform:"uppercase"}}>Home Moneyline ({homeAbbr})</div><input style={inp} placeholder="-150" value={homeOdds} onChange={e=>setHomeOdds(e.target.value)}/></div></div><button className="hov-btn" onClick={runModels} disabled={analyzing} style={{width:"100%",padding:"13px 0",background:analyzing?C.dim:"linear-gradient(90deg,"+C.copper+","+C.copperL+")",border:"none",borderRadius:9,cursor:analyzing?"not-allowed":"pointer",fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:17,letterSpacing:2,color:analyzing?C.muted:C.black,textTransform:"uppercase"}}>{analyzing?<span className="pulse">Running Models...</span>:"Run Analysis"}</button></div>
    </div>}
    {results&&<NBAResults results={results} awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayOdds={awayOdds} homeOdds={homeOdds} tab={tab} setTab={setTab} onRecalc={runModels}/>}
  </div>;
}

function NBAResults({results,awayTeam,homeTeam,awayAbbr,homeAbbr,awayOdds,homeOdds,tab,setTab,onRecalc}){
  const {pyth,net,ff,star,mc,cons,mkt}=results;const cH=cons,aw=1-cH;
  const hI=oddsToImplied(homeOdds),aI=oddsToImplied(awayOdds);
  const hE=hI!==null?((cH-hI)*100).toFixed(1):null,aE=aI!==null?((aw-aI)*100).toFixed(1):null;
  const hEV=homeOdds&&hI?calcEV(cH,homeOdds):null,aEV=awayOdds&&aI?calcEV(aw,awayOdds):null;
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
        {(aE||hE)&&<div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>{aE&&<div style={{padding:"5px 12px",borderRadius:6,background:parseFloat(aE)>=2?C.teal+"18":C.black,border:"1px solid "+(parseFloat(aE)>=2?C.teal:C.border),fontSize:11,color:parseFloat(aE)>=2?C.teal:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:700}}>{awayAbbr} Edge: {parseFloat(aE)>=0?"+":""}{aE}%{aEV?" - EV "+(parseFloat(aEV)>=0?"+":"")+aEV+"/$1":""}</div>}{hE&&<div style={{padding:"5px 12px",borderRadius:6,background:parseFloat(hE)>=2?C.teal+"18":C.black,border:"1px solid "+(parseFloat(hE)>=2?C.teal:C.border),fontSize:11,color:parseFloat(hE)>=2?C.teal:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:700}}>{homeAbbr} Edge: {parseFloat(hE)>=0?"+":""}{hE}%{hEV?" - EV "+(parseFloat(hEV)>=0?"+":"")+hEV+"/$1":""}</div>}</div>}
        {(hI&&aI)&&(()=>{const mktH=hI/(hI+aI);const mktA=aI/(hI+aI);const ourH=cH;const diff=Math.abs(ourH-mktH);const big=diff>=0.10;return big?<div style={{marginTop:10,padding:"10px 14px",background:"#1a120a",border:"1px solid "+C.amber+"66",borderRadius:8,display:"flex",gap:8,alignItems:"flex-start"}}><div style={{fontSize:14,flexShrink:0}}>[!]</div><div><div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:12,color:C.amber,letterSpacing:1}}>MODEL/MARKET DIVERGENCE</div><div style={{fontSize:11,color:C.muted,marginTop:3,lineHeight:1.6}}>Market implies {(mktH*100).toFixed(0)}% {homeAbbr} / {(mktA*100).toFixed(0)}% {awayAbbr}. Our model says {(cH*100).toFixed(0)}% / {(aw*100).toFixed(0)}%. Gap of {(diff*100).toFixed(0)}%. Large divergences usually mean the market knows something  -  injuries, line movement, or our stats may be stale. Bet smaller or verify.</div></div></div>:null;})()}
        <button className="hov-btn" onClick={onRecalc} style={{marginTop:12,width:"100%",padding:"9px 0",background:"transparent",border:"1px solid "+C.border,borderRadius:7,cursor:"pointer",fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1.5,color:C.muted,textTransform:"uppercase"}}>Recalculate with Updated Injuries</button>
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
        {(()=>{const items=[{l:"Pythagorean",p:1-pyth.homeProb},{l:"Net Rating",p:1-net.homeProb},{l:"4 Factors",p:1-ff.homeProb},{l:"Star Power",p:1-star.homeProb},{l:"Monte Carlo",p:1-mc.homeProb}];if(mkt!=null)items.push({l:"Market",p:1-mkt,isMkt:true});return <div style={{display:"grid",gridTemplateColumns:`repeat(${items.length},1fr)`,gap:8}}>{items.map(m=>{const af=m.p>.5;const dp=af?m.p:1-m.p;const da=af?awayAbbr:homeAbbr;const ac=m.isMkt?C.amber:C.teal;return <div key={m.l} style={{textAlign:"center",background:C.black,borderRadius:8,padding:"10px 6px",border:"1px solid "+ac+"44"}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:22,color:ac}}>{(dp*100).toFixed(0)}%</div><div style={{fontSize:10,color:ac,fontWeight:700,marginBottom:2}}>{da}</div><div style={{fontSize:9,color:C.dim,textTransform:"uppercase",letterSpacing:.5}}>{m.l}</div></div>;})}</div>;})()}
      </div>
    </>}
    {tab==="method"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{[["PYT","Pythagorean (20%)","Season + L10 Pythagorean win% (exp 13.9). Regresses luck out of raw W/L. HCA via +3.2pt scoring model."],["NET","Net Rating (28%)","55% season + 45% recent PPG-OPP differential. Best single NBA predictor. 1pt ~ +2.7% win probability."],["4F","Four Factors (18%)","eFG%(40%) + TOV%(25%) + OREB%(20%) + FTR(15%). Entirely independent efficiency signal."],["STR","Star Power (16%)","Top-3 PER weighted by injury status: OUT=0%, DOUBTFUL=20%, Q=62%. Top player worth 35% of team score."],["MC","Monte Carlo (18%)","10,000 simulations blending offense vs opponent defense. Normal distribution sigma=11.5pts."],["W","Consensus","Pythagorean 20% + Net Rating 28% + Four Factors 18% + Star Power 16% + Monte Carlo 18%."]].map(([icon,n,d])=><div key={n} style={{background:C.card,border:"1px solid "+C.border,borderRadius:10,padding:16}}><div style={{width:32,height:32,borderRadius:6,background:C.copper+"22",border:"1px solid "+C.copper+"44",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontFamily:"'Barlow Condensed'",fontWeight:900,color:C.copper,marginBottom:8}}>{icon}</div><div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,color:C.copper,marginBottom:6}}>{n}</div><div style={{fontSize:11,color:C.muted,lineHeight:1.7}}>{d}</div></div>)}</div>}
  </div>;
}

// â”€â”€â”€ NHL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const NHL_TEAMS=["Anaheim Ducks","Boston Bruins","Buffalo Sabres","Calgary Flames","Carolina Hurricanes","Chicago Blackhawks","Colorado Avalanche","Columbus Blue Jackets","Dallas Stars","Detroit Red Wings","Edmonton Oilers","Florida Panthers","Los Angeles Kings","Minnesota Wild","Montreal Canadiens","Nashville Predators","New Jersey Devils","New York Islanders","New York Rangers","Ottawa Senators","Philadelphia Flyers","Pittsburgh Penguins","San Jose Sharks","Seattle Kraken","St. Louis Blues","Tampa Bay Lightning","Toronto Maple Leafs","Utah Mammoth","Vancouver Canucks","Vegas Golden Knights","Washington Capitals","Winnipeg Jets"];
const NHL_ABBR={"Anaheim Ducks":"ANA","Boston Bruins":"BOS","Buffalo Sabres":"BUF","Calgary Flames":"CGY","Carolina Hurricanes":"CAR","Chicago Blackhawks":"CHI","Colorado Avalanche":"COL","Columbus Blue Jackets":"CBJ","Dallas Stars":"DAL","Detroit Red Wings":"DET","Edmonton Oilers":"EDM","Florida Panthers":"FLA","Los Angeles Kings":"LAK","Minnesota Wild":"MIN","Montreal Canadiens":"MTL","Nashville Predators":"NSH","New Jersey Devils":"NJD","New York Islanders":"NYI","New York Rangers":"NYR","Ottawa Senators":"OTT","Philadelphia Flyers":"PHI","Pittsburgh Penguins":"PIT","San Jose Sharks":"SJS","Seattle Kraken":"SEA","St. Louis Blues":"STL","Tampa Bay Lightning":"TBL","Toronto Maple Leafs":"TOR","Utah Mammoth":"UTA","Vancouver Canucks":"VAN","Vegas Golden Knights":"VGK","Washington Capitals":"WSH","Winnipeg Jets":"WPG"};

function nhlMdlGoalDiff(h,a){
  // Goals per game differential  -  the primary NHL quality signal
  // Pythagorean exp=2.0 works well for hockey
  const hP=pythagorean(h.gf_pg,h.ga_pg,2.0);
  const aP=pythagorean(a.gf_pg,a.ga_pg,2.0);
  const hR=pythagorean(h.last10_gf||h.gf_pg,h.last10_ga||h.ga_pg,2.0);
  const aR=pythagorean(a.last10_gf||a.gf_pg,a.last10_ga||a.ga_pg,2.0);
  const hQ=hP*0.60+hR*0.40;
  const aQ=aP*0.60+aR*0.40;
  // HCA: +0.10 goals -> ~pythagorean bump
  const hHCA=pythagorean(h.gf_pg+0.10,h.ga_pg,2.0);
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
  const hL=Math.max(0.6,(hGF+(3.0-hGA))/2+0.05);
  const aL=Math.max(0.6,(aGF+(3.0-aGA))/2);
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
  const [awayTeam,setAwayTeam]=useState("");const [homeTeam,setHomeTeam]=useState("");const [awayOdds,setAwayOdds]=useState("");const [homeOdds,setHomeOdds]=useState("");const [awayData,setAwayData]=useState(null);const [homeData,setHomeData]=useState(null);const [awayLoading,setAwayLoading]=useState(false);const [homeLoading,setHomeLoading]=useState(false);const [awayError,setAwayError]=useState("");const [homeError,setHomeError]=useState("");const [results,setResults]=useState(null);const [tab,setTab]=useState("results");const [analyzing,setAnalyzing]=useState(false);
  const fetchTeam=async(team,side)=>{const setL=side==="away"?setAwayLoading:setHomeLoading;const setD=side==="away"?setAwayData:setHomeData;const setE=side==="away"?setAwayError:setHomeError;setL(true);setD(null);setE("");setResults(null);try{const r=await fetch("/api/team",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({team,sport:"nhl"})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Error "+r.status);setD(d);}catch(e){setE(e.message);}setL(false);};
  const cyclePlayer=(side,name)=>{const [g,s]=side==="home"?[homeData,setHomeData]:[awayData,setAwayData];if(!g)return;if(name==="__goalie__"){s({...g,goalie:{...g.goalie,status:STATUS_CYCLE[(STATUS_CYCLE.indexOf(g.goalie.status||"PLAYING")+1)%4]}});}else{s({...g,roster:g.roster.map(p=>p.name!==name?p:{...p,status:STATUS_CYCLE[(STATUS_CYCLE.indexOf(p.status)+1)%4]})});}};
  const runModels=()=>{if(!homeData||!awayData)return;setAnalyzing(true);setTimeout(()=>{const gd=nhlMdlGoalDiff(homeData,awayData),gl=nhlMdlGoalie(homeData,awayData),st=nhlMdlSpecialTeams(homeData,awayData),sq=nhlMdlShotQuality(homeData,awayData),mc=nhlMdlMonteCarlo(homeData,awayData);const mkt=devigged(homeOdds,awayOdds);setResults({gd,gl,st,sq,mc,mkt,cons:nhlConsensus([gd.homeProb,gl.homeProb,st.homeProb,sq.homeProb,mc.homeProb],mkt)});setTab("results");setAnalyzing(false);},50);};
  const inp={width:"100%",padding:"10px 12px",background:C.black,border:"1.5px solid "+C.border,borderRadius:8,color:C.white,fontSize:13,outline:"none",fontFamily:"'Barlow',sans-serif"};
  const bothLoaded=awayData&&homeData;const awayAbbr=NHL_ABBR[awayTeam]||"AWY";const homeAbbr=NHL_ABBR[homeTeam]||"HME";
  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,overflow:"hidden"}}>
      <SectionHeader label="Step 1 - Select Away Team" accent={C.ice} right={awayData&&<Pill label={awayAbbr+" LOADED"} color={C.ice}/>}/>
      <div style={{padding:14}}><div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,alignItems:"flex-end"}}><div><div style={{fontSize:10,color:C.ice,fontFamily:"'Barlow Condensed'",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>Away Team</div><select style={{...inp,cursor:"pointer"}} value={awayTeam} onChange={e=>{setAwayTeam(e.target.value);setAwayData(null);setResults(null);}}><option value="">Select away team...</option>{NHL_TEAMS.map(t=><option key={t} value={t}>{t}</option>)}</select></div><button className="hov-btn" onClick={()=>fetchTeam(awayTeam,"away")} disabled={!awayTeam||awayLoading} style={{padding:"10px 20px",background:awayTeam&&!awayLoading?"linear-gradient(90deg,"+C.iceD+","+C.ice+")":C.dim,border:"none",borderRadius:8,cursor:awayTeam&&!awayLoading?"pointer":"not-allowed",fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:14,letterSpacing:1.5,color:awayTeam&&!awayLoading?C.black:C.muted,textTransform:"uppercase",whiteSpace:"nowrap"}}>{awayLoading?<span className="pulse">Loading...</span>:"Load Roster"}</button></div>{awayError&&<div style={{marginTop:8,padding:"8px 12px",background:"#2a0f0f",border:"1px solid #5a2020",borderRadius:6,fontSize:11,color:"#f87171"}}>{awayError}</div>}</div>
      {(awayLoading||awayData)&&<div style={{padding:"0 14px 14px"}}><RosterPanel teamName={awayTeam} abbr={awayAbbr} teamData={awayData} onCycle={n=>cyclePlayer("away",n)} sport="nhl" accent={C.ice} loading={awayLoading}/></div>}
    </div>
    <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,overflow:"hidden"}}>
      <SectionHeader label="Step 2 - Select Home Team" accent={C.copper} right={homeData&&<Pill label={homeAbbr+" LOADED"} color={C.copper}/>}/>
      <div style={{padding:14}}><div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,alignItems:"flex-end"}}><div><div style={{fontSize:10,color:C.copper,fontFamily:"'Barlow Condensed'",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>Home Team</div><select style={{...inp,cursor:"pointer"}} value={homeTeam} onChange={e=>{setHomeTeam(e.target.value);setHomeData(null);setResults(null);}}><option value="">Select home team...</option>{NHL_TEAMS.map(t=><option key={t} value={t}>{t}</option>)}</select></div><button className="hov-btn" onClick={()=>fetchTeam(homeTeam,"home")} disabled={!homeTeam||homeLoading} style={{padding:"10px 20px",background:homeTeam&&!homeLoading?"linear-gradient(90deg,"+C.copper+","+C.copperL+")":C.dim,border:"none",borderRadius:8,cursor:homeTeam&&!homeLoading?"pointer":"not-allowed",fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:14,letterSpacing:1.5,color:homeTeam&&!homeLoading?C.black:C.muted,textTransform:"uppercase",whiteSpace:"nowrap"}}>{homeLoading?<span className="pulse">Loading...</span>:"Load Roster"}</button></div>{homeError&&<div style={{marginTop:8,padding:"8px 12px",background:"#2a0f0f",border:"1px solid #5a2020",borderRadius:6,fontSize:11,color:"#f87171"}}>{homeError}</div>}</div>
      {(homeLoading||homeData)&&<div style={{padding:"0 14px 14px"}}><RosterPanel teamName={homeTeam} abbr={homeAbbr} teamData={homeData} onCycle={n=>cyclePlayer("home",n)} sport="nhl" accent={C.copper} loading={homeLoading}/></div>}
    </div>
    {bothLoaded&&<div className="fade-in" style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,overflow:"hidden"}}>
      <SectionHeader label="Step 3 - Set Odds & Analyze"/>
      <div style={{padding:14}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}><div><div style={{fontSize:10,color:C.muted,letterSpacing:1,marginBottom:5,textTransform:"uppercase"}}>Away Moneyline ({awayAbbr})</div><input style={inp} placeholder="+130" value={awayOdds} onChange={e=>setAwayOdds(e.target.value)}/></div><div><div style={{fontSize:10,color:C.muted,letterSpacing:1,marginBottom:5,textTransform:"uppercase"}}>Home Moneyline ({homeAbbr})</div><input style={inp} placeholder="-140" value={homeOdds} onChange={e=>setHomeOdds(e.target.value)}/></div></div><button className="hov-btn" onClick={runModels} disabled={analyzing} style={{width:"100%",padding:"13px 0",background:analyzing?C.dim:"linear-gradient(90deg,"+C.iceD+","+C.ice+")",border:"none",borderRadius:9,cursor:analyzing?"not-allowed":"pointer",fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:17,letterSpacing:2,color:analyzing?C.muted:C.black,textTransform:"uppercase"}}>{analyzing?<span className="pulse">Running Models...</span>:"Run Analysis"}</button></div>
    </div>}
    {results&&<NHLResults results={results} awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayOdds={awayOdds} homeOdds={homeOdds} tab={tab} setTab={setTab} onRecalc={runModels}/>}
  </div>;
}

function NHLResults({results,awayTeam,homeTeam,awayAbbr,homeAbbr,awayOdds,homeOdds,tab,setTab,onRecalc}){
  const {gd,gl,st,sq,mc,cons,mkt}=results;const cH=cons,aw=1-cH;
  const hI=oddsToImplied(homeOdds),aI=oddsToImplied(awayOdds);
  const hE=hI!==null?((cH-hI)*100).toFixed(1):null,aE=aI!==null?((aw-aI)*100).toFixed(1):null;
  const hEV=homeOdds&&hI?calcEV(cH,homeOdds):null,aEV=awayOdds&&aI?calcEV(aw,awayOdds):null;
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
        {(aE||hE)&&<div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>{aE&&<div style={{padding:"5px 12px",borderRadius:6,background:parseFloat(aE)>=2?C.ice+"18":C.black,border:"1px solid "+(parseFloat(aE)>=2?C.ice:C.border),fontSize:11,color:parseFloat(aE)>=2?C.ice:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:700}}>{awayAbbr} Edge: {parseFloat(aE)>=0?"+":""}{aE}%{aEV?" - EV "+(parseFloat(aEV)>=0?"+":"")+aEV+"/$1":""}</div>}{hE&&<div style={{padding:"5px 12px",borderRadius:6,background:parseFloat(hE)>=2?C.ice+"18":C.black,border:"1px solid "+(parseFloat(hE)>=2?C.ice:C.border),fontSize:11,color:parseFloat(hE)>=2?C.ice:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:700}}>{homeAbbr} Edge: {parseFloat(hE)>=0?"+":""}{hE}%{hEV?" - EV "+(parseFloat(hEV)>=0?"+":"")+hEV+"/$1":""}</div>}</div>}
        {(hI&&aI)&&(()=>{const mktH=hI/(hI+aI);const diff=Math.abs(cH-mktH);const big=diff>=0.10;return big?<div style={{marginTop:10,padding:"10px 14px",background:"#0a121a",border:"1px solid "+C.ice+"66",borderRadius:8,display:"flex",gap:8,alignItems:"flex-start"}}><div style={{fontSize:14,flexShrink:0}}>[!]</div><div><div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:12,color:C.ice,letterSpacing:1}}>MODEL/MARKET DIVERGENCE</div><div style={{fontSize:11,color:C.muted,marginTop:3,lineHeight:1.6}}>Market implies {(mktH*100).toFixed(0)}% {homeAbbr} / {((1-mktH)*100).toFixed(0)}% {awayAbbr}. Our model says {(cH*100).toFixed(0)}% / {(aw*100).toFixed(0)}%. Gap of {(diff*100).toFixed(0)}%. Verify goalie starter  -  a backup in net will kill this prediction.</div></div></div>:null;})()}
        <button className="hov-btn" onClick={onRecalc} style={{marginTop:12,width:"100%",padding:"9px 0",background:"transparent",border:"1px solid "+C.border,borderRadius:7,cursor:"pointer",fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1.5,color:C.muted,textTransform:"uppercase"}}>Recalculate with Updated Lineup</button>
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
        {(()=>{const items=[{l:"Goal Diff",p:1-gd.homeProb},{l:"Goalie",p:1-gl.homeProb},{l:"Spec Teams",p:1-st.homeProb},{l:"Shot xG",p:1-sq.homeProb},{l:"Monte Carlo",p:1-mc.homeProb}];if(mkt!=null)items.push({l:"Market",p:1-mkt,isMkt:true});return <div style={{display:"grid",gridTemplateColumns:`repeat(${items.length},1fr)`,gap:8}}>{items.map(m=>{const af=m.p>.5;const dp=af?m.p:1-m.p;const da=af?awayAbbr:homeAbbr;const ac=m.isMkt?C.amber:C.ice;return <div key={m.l} style={{textAlign:"center",background:C.black,borderRadius:8,padding:"10px 6px",border:"1px solid "+ac+"44"}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:22,color:ac}}>{(dp*100).toFixed(0)}%</div><div style={{fontSize:10,color:ac,fontWeight:700,marginBottom:2}}>{da}</div><div style={{fontSize:9,color:C.dim,textTransform:"uppercase",letterSpacing:.5}}>{m.l}</div></div>;})}</div>;})()}
      </div>
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
].sort((a,b)=>a.name.localeCompare(b.name));

function ncaamMdlEfficiency(h,a){
  // Adjusted efficiency per 100 possessions  -  what KenPom actually measures
  // Normalizing by tempo removes pace bias completely
  const hOff=h.ppg/Math.max(h.tempo,55)*100;
  const aDef=a.opp/Math.max(a.tempo,55)*100; // opp's pts ALLOWED per 100
  const aOff=a.ppg/Math.max(a.tempo,55)*100;
  const hDef=h.opp/Math.max(h.tempo,55)*100;
  // Game efficiency margin: offense vs opponent defense
  const hEM=hOff-aDef; // How much better H offense is vs A defense, per 100
  const aEM=aOff-hDef;
  // KenPom rank provides schedule-strength correction
  const hRank=Math.min(h.kenpom_rank||150,350);
  const aRank=Math.min(a.kenpom_rank||150,350);
  const hRankAdj=(175-hRank)*0.03; // rank 1 = +5.2, rank 175 = 0, rank 350 = -5.25
  const aRankAdj=(175-aRank)*0.03;
  const hInj=injPen(h.roster,0.10,0.05,0.015);
  const aInj=injPen(a.roster,0.10,0.05,0.015);
  // HCA 3.5 pts per 100 poss at home  -  empirically ~3.5 for college
  const diff=(hEM+hRankAdj)-(aEM+aRankAdj)+3.5-(hInj-aInj)*22;
  const p=logistic(diff*0.075);
  return{homeProb:Math.min(0.97,Math.max(0.03,p)),hEM:((hEM+hRankAdj)).toFixed(1),aEM:((aEM+aRankAdj)).toFixed(1),detail:`H AdjEM ${((hEM+hRankAdj)).toFixed(1)}  A AdjEM ${((aEM+aRankAdj)).toFixed(1)}`};}

function ncaamMdlPythagorean(h,a){
  // Win quality  -  Pythagorean win% with conference adjustment
  // Exponent 11.5 = empirically best for college basketball
  const hP=pythagorean(h.ppg,h.opp,11.5);
  const aP=pythagorean(a.ppg,a.opp,11.5);
  // Strength-of-schedule proxy: KenPom rank adjusts quality
  const hSOS=Math.max(0.90,Math.min(1.10,1+(175-Math.min(h.kenpom_rank||150,350))*0.0015));
  const aSOS=Math.max(0.90,Math.min(1.10,1+(175-Math.min(a.kenpom_rank||150,350))*0.0015));
  const hQ=Math.min(0.97,hP*hSOS);
  const aQ=Math.min(0.97,aP*aSOS);
  const hHCA=pythagorean(h.ppg+3.5,h.opp,11.5);
  const hAdj=hQ*0.65+hHCA*0.35;
  const hi=injPen(h.roster,0.10,0.05,0.015);
  const ai=injPen(a.roster,0.10,0.05,0.015);
  const p=log5(Math.max(0.03,hAdj-hi),Math.max(0.03,aQ-ai));
  return{homeProb:Math.min(0.97,Math.max(0.03,p)),hQ:(hQ*100).toFixed(1),aQ:(aQ*100).toFixed(1),detail:`H Pyth ${(hQ*100).toFixed(1)}%  A Pyth ${(aQ*100).toFixed(1)}%  +3.5pt HCA`};}

function ncaamMdlFourFactors(h,a){
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
  // HCA small FF boost: home teams get ~1% eFG boost
  const p=logistic((hTotal-aTotal)*7+0.28-(hi-ai)*3);
  return{homeProb:Math.min(0.97,Math.max(0.03,p)),hFF:hOff.toFixed(3),aFF:aOff.toFixed(3),detail:`H Off FF: ${hOff.toFixed(3)}  A Off FF: ${aOff.toFixed(3)}`};}

function ncaamMdlTalent(h,a){
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
  // HCA in college: home crowd especially impacts road stars negatively
  const p=logistic((hV-aV)*0.12+0.30);
  return{homeProb:Math.min(0.97,Math.max(0.03,p)),hVal:hV.toFixed(1),aVal:aV.toFixed(1),detail:`H talent: ${hV.toFixed(1)}  A talent: ${aV.toFixed(1)}`};}

function ncaamMdlMonteCarlo(h,a,N=10000){
  // Tempo-aware point simulation
  const hi=injPen(h.roster,0.11,0.055,0.013);
  const ai=injPen(a.roster,0.11,0.055,0.013);
  // Adjust both teams' PPG to the expected game pace
  const gamePace=(h.tempo*0.5+a.tempo*0.5);
  const hOff=(h.ppg/Math.max(h.tempo,55))*gamePace*(1-hi);
  const aOff=(a.ppg/Math.max(a.tempo,55))*gamePace*(1-ai);
  const hDef=(a.opp/Math.max(a.tempo,55))*gamePace;
  const aDef=(h.opp/Math.max(h.tempo,55))*gamePace;
  // Score = blend own offense vs opponent defense (both in pts units after tempo adjustment)
  const hExp=(hOff*0.55+hDef*0.45)+1.8;
  const aExp=aOff*0.55+aDef*0.45;
  const sig=10; // NCAAM game SD ~10 pts per team
  let w=0;
  for(let i=0;i<N;i++){
    const z1=Math.sqrt(-2*Math.log(Math.random()))*Math.cos(2*Math.PI*Math.random());
    const z2=Math.sqrt(-2*Math.log(Math.random()))*Math.cos(2*Math.PI*Math.random());
    if(hExp+z1*sig>aExp+z2*sig)w++;}
  return{homeProb:Math.min(0.97,Math.max(0.03,w/N)),hExp:hExp.toFixed(1),aExp:aExp.toFixed(1),detail:`Proj: H ${hExp.toFixed(1)}  A ${aExp.toFixed(1)} pts`};}

function ncaamConsensus(ps,mkt){
  // Efficiency gets most weight (most reliable for college)
  // 15% shrinkage toward 50%  -  college basketball is highly variable
  const m=Math.min(0.97,Math.max(0.03,[0.28,0.22,0.20,0.13,0.17].reduce((s,w,i)=>s+ps[i]*w,0)));
  const shrunk=0.5+(m-0.5)*0.85;
  if(mkt===null||mkt===undefined)return shrunk;
  return Math.min(0.97,Math.max(0.03,shrunk*0.67+mkt*0.33));}

function NCAAMPage(){
  const [awayTeam,setAwayTeam]=useState(null);
  const [homeTeam,setHomeTeam]=useState(null);
  const [awayOdds,setAwayOdds]=useState("");
  const [homeOdds,setHomeOdds]=useState("");
  const [awayData,setAwayData]=useState(null);
  const [homeData,setHomeData]=useState(null);
  const [awayLoading,setAwayLoading]=useState(false);
  const [homeLoading,setHomeLoading]=useState(false);
  const [awayError,setAwayError]=useState("");
  const [homeError,setHomeError]=useState("");
  const [results,setResults]=useState(null);
  const [tab,setTab]=useState("results");
  const [analyzing,setAnalyzing]=useState(false);

  const fetchTeam=async(t,side)=>{
    const setL=side==="away"?setAwayLoading:setHomeLoading;
    const setD=side==="away"?setAwayData:setHomeData;
    const setE=side==="away"?setAwayError:setHomeError;
    setL(true);setD(null);setE("");setResults(null);
    try{
      const r=await fetch("/api/ncaam",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({teamId:t.id,team:t.name})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"Error "+r.status);
      setD(d);
    }catch(e){setE(e.message);}
    setL(false);
  };

  const cyclePlayer=(side,name)=>{
    const [g,s]=side==="home"?[homeData,setHomeData]:[awayData,setAwayData];
    if(!g)return;
    s({...g,roster:g.roster.map(p=>p.name!==name?p:{...p,status:STATUS_CYCLE[(STATUS_CYCLE.indexOf(p.status)+1)%4]})});
  };

  const runModels=()=>{
    if(!homeData||!awayData)return;
    setAnalyzing(true);
    setTimeout(()=>{
      const eff=ncaamMdlEfficiency(homeData,awayData),pyth=ncaamMdlPythagorean(homeData,awayData),ff=ncaamMdlFourFactors(homeData,awayData),tal=ncaamMdlTalent(homeData,awayData),mc=ncaamMdlMonteCarlo(homeData,awayData);
      const mkt=devigged(homeOdds,awayOdds);
      setResults({eff,pyth,ff,tal,mc,mkt,cons:ncaamConsensus([eff.homeProb,pyth.homeProb,ff.homeProb,tal.homeProb,mc.homeProb],mkt)});
      setTab("results");setAnalyzing(false);
    },50);
  };

  const inp={width:"100%",padding:"10px 12px",background:C.black,border:"1.5px solid "+C.border,borderRadius:8,color:C.white,fontSize:13,outline:"none",fontFamily:"'Barlow',sans-serif"};
  const bothLoaded=awayData&&homeData;
  const awayAbbr=awayTeam?awayTeam.name.split(" ").slice(-1)[0].slice(0,4).toUpperCase():"AWY";
  const homeAbbr=homeTeam?homeTeam.name.split(" ").slice(-1)[0].slice(0,4).toUpperCase():"HME";

  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    {/* Away */}
    <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,overflow:"hidden"}}>
      <SectionHeader label="Step 1 - Select Away Team" accent={C.amber} right={awayData&&<Pill label={awayAbbr+" LOADED"} color={C.amber}/>}/>
      <div style={{padding:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,alignItems:"flex-end"}}>
          <div>
            <div style={{fontSize:10,color:C.amber,fontFamily:"'Barlow Condensed'",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>Away Team</div>
            <select style={{...inp,cursor:"pointer"}} value={awayTeam?.id||""} onChange={e=>{const t=NCAAM_TEAMS.find(x=>x.id===e.target.value)||null;setAwayTeam(t);setAwayData(null);setResults(null);}}>
              <option value="">Select away team...</option>
              {NCAAM_TEAMS.map(t=><option key={t.id} value={t.id}>{t.name} ({t.conf})</option>)}
            </select>
          </div>
          <button className="hov-btn" onClick={()=>fetchTeam(awayTeam,"away")} disabled={!awayTeam||awayLoading} style={{padding:"10px 20px",background:awayTeam&&!awayLoading?"linear-gradient(90deg,"+C.amberD+","+C.amber+")":C.dim,border:"none",borderRadius:8,cursor:awayTeam&&!awayLoading?"pointer":"not-allowed",fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:14,letterSpacing:1.5,color:awayTeam&&!awayLoading?C.black:C.muted,textTransform:"uppercase",whiteSpace:"nowrap"}}>
            {awayLoading?<span className="pulse">Loading...</span>:"Load Roster"}
          </button>
        </div>
        {awayError&&<div style={{marginTop:8,padding:"8px 12px",background:"#2a0f0f",border:"1px solid #5a2020",borderRadius:6,fontSize:11,color:"#f87171"}}>{awayError}</div>}
      </div>
      {(awayLoading||awayData)&&<div style={{padding:"0 14px 14px"}}><RosterPanel teamName={awayTeam?.name||""} abbr={awayAbbr} teamData={awayData} onCycle={n=>cyclePlayer("away",n)} sport="ncaam" accent={C.amber} loading={awayLoading}/></div>}
    </div>

    {/* Home */}
    <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,overflow:"hidden"}}>
      <SectionHeader label="Step 2 - Select Home Team" accent={C.copper} right={homeData&&<Pill label={homeAbbr+" LOADED"} color={C.copper}/>}/>
      <div style={{padding:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,alignItems:"flex-end"}}>
          <div>
            <div style={{fontSize:10,color:C.copper,fontFamily:"'Barlow Condensed'",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>Home Team</div>
            <select style={{...inp,cursor:"pointer"}} value={homeTeam?.id||""} onChange={e=>{const t=NCAAM_TEAMS.find(x=>x.id===e.target.value)||null;setHomeTeam(t);setHomeData(null);setResults(null);}}>
              <option value="">Select home team...</option>
              {NCAAM_TEAMS.map(t=><option key={t.id} value={t.id}>{t.name} ({t.conf})</option>)}
            </select>
          </div>
          <button className="hov-btn" onClick={()=>fetchTeam(homeTeam,"home")} disabled={!homeTeam||homeLoading} style={{padding:"10px 20px",background:homeTeam&&!homeLoading?"linear-gradient(90deg,"+C.copper+","+C.copperL+")":C.dim,border:"none",borderRadius:8,cursor:homeTeam&&!homeLoading?"pointer":"not-allowed",fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:14,letterSpacing:1.5,color:homeTeam&&!homeLoading?C.black:C.muted,textTransform:"uppercase",whiteSpace:"nowrap"}}>
            {homeLoading?<span className="pulse">Loading...</span>:"Load Roster"}
          </button>
        </div>
        {homeError&&<div style={{marginTop:8,padding:"8px 12px",background:"#2a0f0f",border:"1px solid #5a2020",borderRadius:6,fontSize:11,color:"#f87171"}}>{homeError}</div>}
      </div>
      {(homeLoading||homeData)&&<div style={{padding:"0 14px 14px"}}><RosterPanel teamName={homeTeam?.name||""} abbr={homeAbbr} teamData={homeData} onCycle={n=>cyclePlayer("home",n)} sport="ncaam" accent={C.copper} loading={homeLoading}/></div>}
    </div>

    {bothLoaded&&<div className="fade-in" style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,overflow:"hidden"}}>
      <SectionHeader label="Step 3 - Set Odds & Analyze" accent={C.amber}/>
      <div style={{padding:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div><div style={{fontSize:10,color:C.muted,letterSpacing:1,marginBottom:5,textTransform:"uppercase"}}>Away Moneyline ({awayAbbr})</div><input style={inp} placeholder="+130" value={awayOdds} onChange={e=>setAwayOdds(e.target.value)}/></div>
          <div><div style={{fontSize:10,color:C.muted,letterSpacing:1,marginBottom:5,textTransform:"uppercase"}}>Home Moneyline ({homeAbbr})</div><input style={inp} placeholder="-150" value={homeOdds} onChange={e=>setHomeOdds(e.target.value)}/></div>
        </div>
        <button className="hov-btn" onClick={runModels} disabled={analyzing} style={{width:"100%",padding:"13px 0",background:analyzing?C.dim:"linear-gradient(90deg,"+C.amberD+","+C.amber+")",border:"none",borderRadius:9,cursor:analyzing?"not-allowed":"pointer",fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:17,letterSpacing:2,color:analyzing?C.muted:C.black,textTransform:"uppercase"}}>
          {analyzing?<span className="pulse">Running Models...</span>:"Run Analysis"}
        </button>
      </div>
    </div>}

    {results&&<NCAAMResults results={results} awayTeam={awayTeam?.name||""} homeTeam={homeTeam?.name||""} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayOdds={awayOdds} homeOdds={homeOdds} tab={tab} setTab={setTab} onRecalc={runModels}/>}
  </div>;
}

function NCAAMResults({results,awayTeam,homeTeam,awayAbbr,homeAbbr,awayOdds,homeOdds,tab,setTab,onRecalc}){
  const {eff,pyth,ff,tal,mc,cons,mkt}=results;const cH=cons,aw=1-cH;
  const hI=oddsToImplied(homeOdds),aI=oddsToImplied(awayOdds);
  const hE=hI!==null?((cH-hI)*100).toFixed(1):null,aE=aI!==null?((aw-aI)*100).toFixed(1):null;
  const hEV=homeOdds&&hI?calcEV(cH,homeOdds):null,aEV=awayOdds&&aI?calcEV(aw,awayOdds):null;
  const allPsN=[eff.homeProb,pyth.homeProb,ff.homeProb,tal.homeProb,mc.homeProb];if(mkt!=null)allPsN.push(mkt);
  const favHN=cH>0.5;const agrN=allPsN.filter(p=>favHN?p>0.5:p<0.5).length;const totN=allPsN.length;
  const sigN=(edge,a,t)=>a>=t-1&&edge>=3?"STRONG BET":a>=Math.ceil(t*0.67)&&edge>=1?"LEAN BET":a>=Math.ceil(t*0.5)?"SLIGHT EDGE":"MODELS SPLIT";
  return <div className="fade-in">
    <div style={{display:"flex",gap:4,marginBottom:14,background:C.dark,borderRadius:8,padding:4,border:"1px solid "+C.border}}>{[["results","Results"],["method","Methodology"]].map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"8px 0",borderRadius:6,border:"none",cursor:"pointer",background:tab===k?C.amber+"22":"transparent",color:tab===k?C.amber:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1,textTransform:"uppercase",borderBottom:tab===k?"2px solid "+C.amber:"2px solid transparent"}}>{l}</button>)}</div>
    {tab==="results"&&<>
      <div style={{background:C.card,border:"1.5px solid "+C.amber+"44",borderRadius:12,padding:20,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}><div style={{width:3,height:16,borderRadius:2,background:C.amber}}/><span style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:14,letterSpacing:1.5,color:C.white,textTransform:"uppercase"}}>Consensus - 5 College Basketball Models</span></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:16,alignItems:"center",marginBottom:16}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}><Badge abbr={awayAbbr} size={52} accent={C.amber}/><div style={{textAlign:"center"}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:42,lineHeight:1,color:aw>.55?C.amber:aw>.45?C.copper:C.white}}>{(aw*100).toFixed(1)}%</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>{awayTeam}</div></div><OddsPill prob={aw} accent={C.amber}/></div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:14,color:C.muted,letterSpacing:2}}>VS</div><div style={{padding:"6px 10px",background:C.black,border:"1px solid "+C.border,borderRadius:8,textAlign:"center"}}><div style={{fontFamily:"'Barlow Condensed'",fontSize:10,fontWeight:800,color:agrN>=totN-1?C.amber:agrN>=Math.ceil(totN*0.67)?C.copper:C.muted,letterSpacing:1}}>{agrN}/{totN} AGREE</div>{(aE||hE)&&<div style={{fontFamily:"'Barlow Condensed'",fontSize:11,fontWeight:800,color:C.muted,letterSpacing:1,marginTop:3}}>{sigN(parseFloat(aw>cH?aE:hE),agrN,totN)}</div>}</div></div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}><Badge abbr={homeAbbr} size={52} accent={C.amber}/><div style={{textAlign:"center"}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:42,lineHeight:1,color:cH>.55?C.amber:cH>.45?C.copper:C.white}}>{(cH*100).toFixed(1)}%</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>{homeTeam}</div></div><OddsPill prob={cH} accent={C.amber}/></div>
        </div>
        <WinBar awayProb={aw} awayAbbr={awayAbbr} homeAbbr={homeAbbr} accent={C.amber}/>
        {(aE||hE)&&<div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>{aE&&<div style={{padding:"5px 12px",borderRadius:6,background:parseFloat(aE)>=2?C.amber+"18":C.black,border:"1px solid "+(parseFloat(aE)>=2?C.amber:C.border),fontSize:11,color:parseFloat(aE)>=2?C.amber:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:700}}>{awayAbbr} Edge: {parseFloat(aE)>=0?"+":""}{aE}%{aEV?" - EV "+(parseFloat(aEV)>=0?"+":"")+aEV+"/$1":""}</div>}{hE&&<div style={{padding:"5px 12px",borderRadius:6,background:parseFloat(hE)>=2?C.amber+"18":C.black,border:"1px solid "+(parseFloat(hE)>=2?C.amber:C.border),fontSize:11,color:parseFloat(hE)>=2?C.amber:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:700}}>{homeAbbr} Edge: {parseFloat(hE)>=0?"+":""}{hE}%{hEV?" - EV "+(parseFloat(hEV)>=0?"+":"")+hEV+"/$1":""}</div>}</div>}
        {(hI&&aI)&&(()=>{const mktH=hI/(hI+aI);const diff=Math.abs(cH-mktH);const big=diff>=0.10;return big?<div style={{marginTop:10,padding:"10px 14px",background:"#1a1200",border:"1px solid "+C.amber+"66",borderRadius:8,display:"flex",gap:8,alignItems:"flex-start"}}><div style={{fontSize:14,flexShrink:0}}>[!]</div><div><div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:12,color:C.amber,letterSpacing:1}}>MODEL/MARKET DIVERGENCE</div><div style={{fontSize:11,color:C.muted,marginTop:3,lineHeight:1.6}}>Market implies {(mktH*100).toFixed(0)}% {homeAbbr} / {((1-mktH)*100).toFixed(0)}% {awayAbbr}. Our model says {(cH*100).toFixed(0)}% / {(aw*100).toFixed(0)}%. Gap of {(diff*100).toFixed(0)}%. College markets move on injury news and home/away venue changes. Verify this is current.</div></div></div>:null;})()}
        <button className="hov-btn" onClick={onRecalc} style={{marginTop:12,width:"100%",padding:"9px 0",background:"transparent",border:"1px solid "+C.border,borderRadius:7,cursor:"pointer",fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1.5,color:C.muted,textTransform:"uppercase"}}>Recalculate with Updated Injuries</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <ModelCard icon="AEM" name="Adj. Efficiency" desc="Pts/100 poss margin + KenPom rank/SOS adj" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-eff.homeProb} detail={eff.detail} accent={C.amber}/>
        <ModelCard icon="PYT" name="Pythagorean" desc="Win quality Pythagorean (exp 11.5) + SOS" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-pyth.homeProb} detail={pyth.detail} accent={C.amber}/>
        <ModelCard icon="4F" name="Four Factors" desc="Off + Def four factors  -  independent of PPG" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-ff.homeProb} detail={ff.detail} accent={C.amber}/>
        <ModelCard icon="TAL" name="Talent Model" desc="Top-3 player PER  -  star power matters most in NCAAM" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-tal.homeProb} detail={tal.detail} accent={C.amber}/>
      </div>
      <ModelCard icon="MC" name="Monte Carlo Simulation" desc="8,000 simulated games  -  injury adjusted" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-mc.homeProb} detail={mc.detail} accent={C.amber}/>
      <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:14,marginTop:10}}>
        <div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1.5,color:C.amber,textTransform:"uppercase",marginBottom:10}}>Model Agreement</div>
        {(()=>{const items=[{l:"Adj Eff",p:1-eff.homeProb},{l:"Pythagorean",p:1-pyth.homeProb},{l:"4 Factors",p:1-ff.homeProb},{l:"Talent",p:1-tal.homeProb},{l:"Monte Carlo",p:1-mc.homeProb}];if(mkt!=null)items.push({l:"Market",p:1-mkt,isMkt:true});return <div style={{display:"grid",gridTemplateColumns:`repeat(${items.length},1fr)`,gap:8}}>{items.map(m=>{const af=m.p>.5;const dp=af?m.p:1-m.p;const da=af?awayAbbr:homeAbbr;const ac=m.isMkt?C.copper:C.amber;return <div key={m.l} style={{textAlign:"center",background:C.black,borderRadius:8,padding:"10px 6px",border:"1px solid "+ac+"44"}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:22,color:ac}}>{(dp*100).toFixed(0)}%</div><div style={{fontSize:10,color:ac,fontWeight:700,marginBottom:2}}>{da}</div><div style={{fontSize:9,color:C.dim,textTransform:"uppercase",letterSpacing:.5}}>{m.l}</div></div>;})}</div>;})()}
      </div>
    </>}
    {tab==="method"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{[["AEM","Adj Efficiency (28%)","Pts per 100 possessions: offense vs opponent defense. KenPom rank adjusts for schedule strength. +3.5pt HCA."],["PYT","Pythagorean (22%)","Win quality Pythagorean (exp 11.5) with SOS multiplier from KenPom rank. Log5 head-to-head."],["4F","Four Factors (20%)","Offensive (55%) + Defensive (45%) four factors. Entirely independent from PPG signal."],["TAL","Talent Model (13%)","Top-3 player PER weighted by availability. College star impact is larger than NBA. OUT=0%, DOUBTFUL=15%."],["MC","Monte Carlo (17%)","10,000 tempo-adjusted simulations. Game pace = avg of both teams. sigma=10pts per team."],["W","Consensus","Adj Eff 28% + Pythagorean 22% + Four Factors 20% + Talent 13% + Monte Carlo 17%."]].map(([icon,n,d])=><div key={n} style={{background:C.card,border:"1px solid "+C.border,borderRadius:10,padding:16}}><div style={{width:32,height:32,borderRadius:6,background:C.amber+"22",border:"1px solid "+C.amber+"44",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontFamily:"'Barlow Condensed'",fontWeight:900,color:C.amber,marginBottom:8}}>{icon}</div><div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,color:C.amber,marginBottom:6}}>{n}</div><div style={{fontSize:11,color:C.muted,lineHeight:1.7}}>{d}</div></div>)}</div>}
  </div>;
}

// â”€â”€â”€ APP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function App(){
  const [sport,setSport]=useState("nba");
  const TABS=[{id:"nba",label:"NBA",accent:C.teal,sub:"5-model system - Elo - RAPTOR - Four Factors - ML/BPI - Monte Carlo"},{id:"nhl",label:"NHL",accent:C.ice,sub:"5-model system - Elo - Goalie - Special Teams - Corsi - Monte Carlo"},{id:"ncaam",label:"NCAAM",accent:C.amber,sub:"5-model system - KenPom - BPI - Four Factors - Tempo - Monte Carlo"}];
  const ct=TABS.find(t=>t.id===sport);
  return <div style={{minHeight:"100vh",background:C.black,fontFamily:"'Barlow',sans-serif",color:C.white}}>
    <style>{STYLES}</style>
    <div style={{background:C.dark,borderBottom:"1px solid "+C.border}}>
      <div style={{maxWidth:1040,margin:"0 auto",padding:"0 16px"}}>
        <div style={{display:"flex",alignItems:"center",height:56,gap:16}}>
          <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
            <div style={{width:32,height:32,borderRadius:6,background:"linear-gradient(135deg,"+C.copper+","+C.copperL+")",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:14,color:C.black}}>CE</div>
            <div><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:20,color:C.white,letterSpacing:1,lineHeight:1}}>COURT EDGE</div><div style={{fontSize:9,color:C.copper,letterSpacing:2,textTransform:"uppercase"}}>Sports Analytics</div></div>
          </div>
          <div style={{display:"flex",gap:2,marginLeft:16,background:C.black,borderRadius:8,padding:3,border:"1px solid "+C.border}}>
            {TABS.map(item=><button key={item.id} onClick={()=>setSport(item.id)} style={{padding:"7px 16px",borderRadius:6,border:"none",cursor:"pointer",background:sport===item.id?"linear-gradient(135deg,"+item.accent+"22,"+item.accent+"11)":"transparent",color:sport===item.id?item.accent:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:14,letterSpacing:1,borderBottom:sport===item.id?"2px solid "+item.accent:"2px solid transparent",transition:"all .2s ease"}}>{item.label}</button>)}
          </div>
          <div style={{marginLeft:"auto",display:"flex",gap:6,alignItems:"center"}}>
            <div style={{padding:"5px 12px",borderRadius:20,background:"linear-gradient(90deg,"+C.copper+","+C.copperL+")",fontSize:11,fontWeight:700,color:C.black,fontFamily:"'Barlow Condensed'",letterSpacing:1}}>2025-26 LIVE</div>
            <div style={{padding:"5px 12px",borderRadius:20,background:C.card,border:"1px solid "+C.border,fontSize:11,color:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:700}}>5 MODELS</div>
          </div>
        </div>
      </div>
    </div>
    <div style={{background:"linear-gradient(90deg,"+ct.accent+"18,transparent)",borderBottom:"1px solid "+C.border,padding:"8px 16px"}}>
      <div style={{maxWidth:1040,margin:"0 auto",display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:18,color:ct.accent,letterSpacing:2}}>{ct.label==="NBA"?"NBA MONEYLINE ANALYZER":ct.label==="NHL"?"NHL MONEYLINE ANALYZER":"NCAAM MONEYLINE ANALYZER"}</span>
        <span style={{fontSize:11,color:C.muted}}>{ct.sub}</span>
      </div>
    </div>
    <div style={{maxWidth:1040,margin:"0 auto",padding:"16px"}}>
      {sport==="nba"&&<NBAPage/>}
      {sport==="nhl"&&<NHLPage/>}
      {sport==="ncaam"&&<NCAAMPage/>}
      <div style={{fontSize:10,color:C.dim,textAlign:"center",padding:"16px 0 8px"}}>For informational and entertainment purposes only - Not financial advice - Gamble responsibly</div>
    </div>
  </div>;
}
