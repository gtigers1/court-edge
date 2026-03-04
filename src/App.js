import { useState } from "react";

// ── Shared helpers ──────────────────────────────────────────────────────────
function oddsToImplied(o){if(!o||o==="-"||o==="+")return null;const n=parseInt(o);if(isNaN(n)||n===0)return null;return n>0?100/(n+100):Math.abs(n)/(Math.abs(n)+100);}
function probToAmerican(p){p=Math.max(0.01,Math.min(0.99,p));return p>=0.5?`-${Math.round((p/(1-p))*100)}`:`+${Math.round(((1-p)/p)*100)}`;}
function calcEV(prob,odds){const o=parseInt(odds);if(isNaN(o))return null;const pay=o>0?o/100:100/Math.abs(o);return(prob*pay-(1-prob)).toFixed(3);}
function logistic(x){return 1/(1+Math.exp(-x));}

// ── Color palette (Arizona Rattlers) ───────────────────────────────────────
const C={
  black:"#0A0A0C",dark:"#111116",card:"#16161C",border:"#242430",
  copper:"#B87333",copperL:"#D4924A",
  teal:"#2DD4A0",tealD:"#1A9E78",
  ice:"#A8D8EA",iceD:"#5BAACB",       // NHL accent
  white:"#F0F0F5",muted:"#6B6B80",dim:"#3A3A4A",
};

// ── Styles ─────────────────────────────────────────────────────────────────
const STYLES=`
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@400;500;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:${C.black};}
  select option{background:#1a1a22;color:${C.white};}
  .hov-card{transition:all .2s ease;}
  .hov-card:hover{transform:translateY(-2px);border-color:${C.copper}!important;}
  .hov-btn{transition:all .2s ease;}
  .hov-btn:hover:not(:disabled){transform:translateY(-1px);}
  .hov-btn:active:not(:disabled){transform:translateY(0);}
  .status-btn{transition:all .15s ease;}
  .status-btn:hover{transform:scale(1.04);}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
  .pulse{animation:pulse 1.5s ease-in-out infinite;}
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  .fade-in{animation:fadeIn .3s ease forwards;}
  ::-webkit-scrollbar{width:4px;}
  ::-webkit-scrollbar-track{background:${C.dark};}
  ::-webkit-scrollbar-thumb{background:${C.dim};border-radius:2px;}
`;

const STATUS_COLORS={PLAYING:C.teal,QUESTIONABLE:"#F5A623",DOUBTFUL:"#E07B30",OUT:"#E05252"};
const STATUS_CYCLE=["PLAYING","QUESTIONABLE","DOUBTFUL","OUT"];

// ── Shared UI atoms ────────────────────────────────────────────────────────
function Badge({abbr,size=44,accent}){
  return <div style={{width:size,height:size,borderRadius:8,background:`linear-gradient(135deg,${C.dim},${C.card})`,border:`1.5px solid ${accent||C.copper}`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800,fontSize:size*.28,color:accent||C.copper,letterSpacing:.5,flexShrink:0}}>{abbr}</div>;
}
function Pill({label,color,bg}){return <span style={{padding:"2px 8px",borderRadius:12,background:bg||(color+"18"),border:`1px solid ${color}`,color,fontSize:10,fontWeight:700,fontFamily:"'Barlow Condensed'"}}>{label}</span>;}
function OddsPill({prob,accent}){const odds=probToAmerican(prob),fav=prob>=.5,ac=accent||C.teal;return <div style={{padding:"10px 18px",borderRadius:8,textAlign:"center",background:fav?ac+"18":C.black,border:`1.5px solid ${fav?ac:C.border}`,minWidth:80}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:22,color:fav?ac:C.white,letterSpacing:-.5}}>{odds}</div><div style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:1,marginTop:1}}>Fair odds</div></div>;}

function SectionHeader({label,accent,right}){
  return <div style={{padding:"10px 16px",background:`linear-gradient(90deg,${accent||C.copper}22,transparent)`,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:8}}>
    <div style={{width:3,height:16,borderRadius:2,background:accent||C.copper}}/>
    <span style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:14,letterSpacing:1.5,color:C.white,textTransform:"uppercase"}}>{label}</span>
    {right&&<div style={{marginLeft:"auto"}}>{right}</div>}
  </div>;
}

function WinBar({awayProb,awayAbbr,homeAbbr,accent}){
  const ac=accent||C.teal;
  return <div style={{marginTop:8}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
      <span style={{fontFamily:"'Barlow Condensed'",fontSize:13,fontWeight:700,color:awayProb>.5?ac:C.muted}}>{awayAbbr} {(awayProb*100).toFixed(1)}%</span>
      <span style={{fontFamily:"'Barlow Condensed'",fontSize:13,fontWeight:700,color:(1-awayProb)>.5?ac:C.muted}}>{(100-awayProb*100).toFixed(1)}% {homeAbbr}</span>
    </div>
    <div style={{height:6,borderRadius:3,background:C.border,overflow:"hidden"}}>
      <div style={{height:"100%",width:`${awayProb*100}%`,background:`linear-gradient(90deg,${accent?accent+"99":C.tealD},${ac})`,borderRadius:3,transition:"width .6s ease"}}/>
    </div>
  </div>;
}

// ── Shared roster/lineup panel ─────────────────────────────────────────────
function RosterPanel({teamName,abbr,teamData,onCycle,sport,accent}){
  if(!teamData)return null;
  const ac=accent||C.teal;
  const subtitle=sport==="nhl"
    ?`${teamData.wins}W–${teamData.losses}L–${teamData.otl}OTL · ${teamData.gf_pg} GF/G · ${teamData.ga_pg} GA/G`
    :`${teamData.wins}W–${teamData.losses}L · ${teamData.ppg} PPG · ${teamData.opp} OPP`;

  return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
    <div style={{padding:"10px 14px",background:C.dark,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10}}>
      <Badge abbr={abbr} size={36} accent={ac}/>
      <div>
        <div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:15,color:C.white}}>{teamName}</div>
        <div style={{fontSize:11,color:C.muted}}>{subtitle}</div>
      </div>
    </div>

    {sport==="nhl"&&teamData.goalie&&(
      <div style={{padding:"8px 14px",background:"#0f0f14",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10}}>
        <div style={{fontSize:18}}>🥅</div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Barlow'",fontWeight:600,fontSize:12,color:C.ice}}>{teamData.goalie.name} <span style={{color:C.muted,fontWeight:400}}>— Expected Starter</span></div>
          <div style={{fontSize:10,color:C.muted}}>SV% {teamData.goalie.save_pct?.toFixed(3)} · GAA {teamData.goalie.gaa?.toFixed(2)}</div>
        </div>
        <button className="status-btn" onClick={()=>onCycle("__goalie__")} style={{padding:"4px 10px",borderRadius:6,fontSize:10,fontWeight:700,cursor:"pointer",border:`1.5px solid ${STATUS_COLORS[teamData.goalie.status||"PLAYING"]}`,background:STATUS_COLORS[teamData.goalie.status||"PLAYING"]+"18",color:STATUS_COLORS[teamData.goalie.status||"PLAYING"],fontFamily:"'Barlow Condensed'",letterSpacing:.8,minWidth:100,textAlign:"center"}}>
          {teamData.goalie.status||"PLAYING"}
        </button>
      </div>
    )}

    <div style={{padding:"4px 0"}}>
      {(teamData.roster||[]).map(p=>{
        const sc=STATUS_COLORS[p.status]||C.teal;
        const sub=sport==="nhl"
          ?`${p.goals}G ${p.assists}A ${p.points}PTS  ${p.plus_minus>=0?"+":""}${p.plus_minus}`
          :`${p.ppg} PPG`;
        return <div key={p.name} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 14px",borderBottom:`1px solid ${C.border}`}}>
          {sport==="nhl"&&<span style={{fontSize:10,color:C.dim,fontFamily:"'Barlow Condensed'",fontWeight:700,width:20,textAlign:"center"}}>{p.position}</span>}
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:"'Barlow'",fontWeight:600,fontSize:13,color:C.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.name}</div>
            <div style={{fontSize:10,color:C.muted,marginTop:1}}>{sub} · <span style={{color:p.role==="STAR"?C.copper:p.role==="KEY"?ac:C.muted}}>{p.role}</span></div>
          </div>
          <button className="status-btn" onClick={()=>onCycle(p.name)} style={{padding:"4px 10px",borderRadius:6,fontSize:10,fontWeight:700,cursor:"pointer",border:`1.5px solid ${sc}`,background:sc+"18",color:sc,fontFamily:"'Barlow Condensed'",letterSpacing:.8,minWidth:100,textAlign:"center"}}>{p.status}</button>
        </div>;
      })}
    </div>
    <div style={{padding:"7px 14px",fontSize:10,color:C.dim,textAlign:"center",borderTop:`1px solid ${C.border}`}}>TAP STATUS TO CYCLE: PLAYING → QUESTIONABLE → DOUBTFUL → OUT</div>
  </div>;
}

// ── Shared model result card ───────────────────────────────────────────────
function ModelCard({icon,name,desc,awayTeam,homeTeam,awayAbbr,homeAbbr,awayProb,detail,accent}){
  const hp=1-awayProb,ac=accent||C.teal,awayFav=awayProb>=.5;
  return <div className="hov-card" style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:14,display:"flex",flexDirection:"column",gap:10}}>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <span style={{fontSize:18}}>{icon}</span>
      <div>
        <div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,color:C.copper,letterSpacing:1,textTransform:"uppercase"}}>{name}</div>
        <div style={{fontSize:10,color:C.muted}}>{desc}</div>
      </div>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{display:"flex",alignItems:"center",gap:6,flex:1}}>
        <Badge abbr={awayAbbr} size={28} accent={ac}/>
        <div>
          <div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:20,color:awayFav?ac:C.white,lineHeight:1}}>{(awayProb*100).toFixed(0)}%</div>
          <div style={{fontSize:9,color:C.muted}}>{awayTeam.split(" ").at(-1)}</div>
        </div>
      </div>
      <div style={{width:1,height:32,background:C.border}}/>
      <div style={{display:"flex",alignItems:"center",gap:6,flex:1,justifyContent:"flex-end"}}>
        <div style={{textAlign:"right"}}>
          <div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:20,color:!awayFav?ac:C.white,lineHeight:1}}>{(hp*100).toFixed(0)}%</div>
          <div style={{fontSize:9,color:C.muted}}>{homeTeam.split(" ").at(-1)}</div>
        </div>
        <Badge abbr={homeAbbr} size={28} accent={ac}/>
      </div>
    </div>
    <div style={{height:4,borderRadius:2,background:C.border,overflow:"hidden"}}>
      <div style={{height:"100%",width:`${awayProb*100}%`,background:`linear-gradient(90deg,${accent?accent+"99":C.tealD},${ac})`,transition:"width .5s ease"}}/>
    </div>
    {detail&&<div style={{fontSize:10,color:C.muted,lineHeight:1.5}}>{detail}</div>}
  </div>;
}

// ══════════════════════════════════════════════════════════════════════════
// NBA PAGE
// ══════════════════════════════════════════════════════════════════════════
const NBA_TEAMS=["Atlanta Hawks","Boston Celtics","Brooklyn Nets","Charlotte Hornets","Chicago Bulls","Cleveland Cavaliers","Dallas Mavericks","Denver Nuggets","Detroit Pistons","Golden State Warriors","Houston Rockets","Indiana Pacers","LA Clippers","Los Angeles Lakers","Memphis Grizzlies","Miami Heat","Milwaukee Bucks","Minnesota Timberwolves","New Orleans Pelicans","New York Knicks","Oklahoma City Thunder","Orlando Magic","Philadelphia 76ers","Phoenix Suns","Portland Trail Blazers","Sacramento Kings","San Antonio Spurs","Toronto Raptors","Utah Jazz","Washington Wizards"];
const NBA_ABBR={"Atlanta Hawks":"ATL","Boston Celtics":"BOS","Brooklyn Nets":"BKN","Charlotte Hornets":"CHA","Chicago Bulls":"CHI","Cleveland Cavaliers":"CLE","Dallas Mavericks":"DAL","Denver Nuggets":"DEN","Detroit Pistons":"DET","Golden State Warriors":"GSW","Houston Rockets":"HOU","Indiana Pacers":"IND","LA Clippers":"LAC","Los Angeles Lakers":"LAL","Memphis Grizzlies":"MEM","Miami Heat":"MIA","Milwaukee Bucks":"MIL","Minnesota Timberwolves":"MIN","New Orleans Pelicans":"NOP","New York Knicks":"NYK","Oklahoma City Thunder":"OKC","Orlando Magic":"ORL","Philadelphia 76ers":"PHI","Phoenix Suns":"PHX","Portland Trail Blazers":"POR","Sacramento Kings":"SAC","San Antonio Spurs":"SAS","Toronto Raptors":"TOR","Utah Jazz":"UTA","Washington Wizards":"WAS"};

function nbaMdlElo(h,a){const hw=h.wins/Math.max(h.wins+h.losses,1),aw=a.wins/Math.max(a.wins+a.losses,1);const hE=1500+400*Math.log10(Math.max(hw,.01)/Math.max(1-hw,.01)),aE=1500+400*Math.log10(Math.max(aw,.01)/Math.max(1-aw,.01));const h10=(h.last10_ppg||h.ppg)-(h.last10_opp||h.opp),a10=(a.last10_ppg||a.ppg)-(a.last10_opp||a.opp);const p=1/(1+Math.pow(10,(aE+a10*3-((hE+h10*3)+100))/400));return{homeProb:Math.min(.97,Math.max(.03,p)),hElo:Math.round(hE+h10*3),aElo:Math.round(aE+a10*3)};}
function nbaMdlRaptor(h,a){const val=r=>(r||[]).reduce((s,p)=>s+(p.per||15)*(p.status==="PLAYING"?1:p.status==="OUT"?0:p.status==="DOUBTFUL"?.25:.65),0);const hV=val(h.roster),aV=val(a.roster);return{homeProb:Math.min(.97,Math.max(.03,hV/Math.max(hV+aV,1)+.035)),hVal:hV.toFixed(1),aVal:aV.toFixed(1)};}
function nbaMdlFF(h,a){const hit=r=>(r||[]).reduce((s,p)=>{if(p.status==="PLAYING")return s;const sw=p.status==="OUT"?1:p.status==="DOUBTFUL"?.75:.35;return s+sw*Math.max(p.role==="STAR"?.08:p.role==="KEY"?.04:.015,Math.min((p.ppg||0)*.004,.06));},0);const ff=d=>(d.efg_pct||.52)*.40+(1-(d.tov_rate||14)/30)*.25+(d.oreb_pct||.25)*.20+Math.min(d.ftr||.22,.40)*.15;const hH=hit(h.roster),aH=hit(a.roster);return{homeProb:Math.min(.97,Math.max(.03,logistic((h.ppg-h.opp-(a.ppg-a.opp))*.065+(ff(h)-ff(a))*4)+.035-hH+aH)),hFF:ff(h).toFixed(3),aFF:ff(a).toFixed(3),hHit:hH,aHit:aH};}
function nbaMdlML(h,a){const pen=r=>(r||[]).reduce((s,p)=>p.status==="PLAYING"?s:s+(p.status==="OUT"?1:p.status==="DOUBTFUL"?.6:.3)*(p.per||12)*.01,0);const f=d=>({net:d.ppg-d.opp,wp:d.wins/Math.max(d.wins+d.losses,1),offE:d.ppg*(d.efg_pct||.52),defE:d.opp*(1-(d.opp_efg_pct||.52)),l10:(d.last10_ppg||d.ppg)-(d.last10_opp||d.opp),pen:pen(d.roster)});const h2=f(h),a2=f(a);return{homeProb:Math.min(.97,Math.max(.03,logistic((h2.net-a2.net)*.08+(h2.wp-a2.wp)*2.5+(h2.offE-a2.offE)*.05+(h2.defE-a2.defE)*.04+(h2.l10-a2.l10)*.06+(a2.pen-h2.pen)*1.8+.28)))};}
function nbaMdlMC(h,a,N=8000){const ih=r=>(r||[]).reduce((s,p)=>p.status==="PLAYING"?s:s+(p.status==="OUT"?1:p.status==="DOUBTFUL"?.65:.3)*Math.min((p.ppg||0)*.15,4),0);const hE=((h.ppg-ih(h.roster))+(100-(a.opp-ih(a.roster))))/2+1.5,aE=((a.ppg-ih(a.roster))+(100-(h.opp-ih(h.roster))))/2;let w=0;for(let i=0;i<N;i++){const u1=Math.random(),u2=Math.random();const z=Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2);const z2=Math.sqrt(-2*Math.log(u1))*Math.sin(2*Math.PI*u2);if(hE+z*11>aE+z2*11)w++;}return{homeProb:Math.min(.97,Math.max(.03,w/N)),hExp:hE.toFixed(1),aExp:aE.toFixed(1)};}
function nbaConsensus(ps){return Math.min(.97,Math.max(.03,[.18,.22,.22,.22,.16].reduce((s,w,i)=>s+ps[i]*w,0)));}

function NBAPage() {
  const [homeTeam,setHomeTeam]=useState("");
  const [awayTeam,setAwayTeam]=useState("");
  const [homeOdds,setHomeOdds]=useState("");
  const [awayOdds,setAwayOdds]=useState("");
  const [homeData,setHomeData]=useState(null);
  const [awayData,setAwayData]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [results,setResults]=useState(null);
  const [tab,setTab]=useState("results");
  const [dataLoaded,setDataLoaded]=useState(false);

  const cyclePlayer=(side,name)=>{
    const [getter,setter]=side==="home"?[homeData,setHomeData]:[awayData,setAwayData];
    if(!getter)return;
    setter({...getter,roster:getter.roster.map(p=>p.name!==name?p:{...p,status:STATUS_CYCLE[(STATUS_CYCLE.indexOf(p.status)+1)%4]})});
  };

  const runModels=(h,a)=>{
    const elo=nbaMdlElo(h,a),rap=nbaMdlRaptor(h,a),ff=nbaMdlFF(h,a),ml=nbaMdlML(h,a),mc=nbaMdlMC(h,a);
    const cons=nbaConsensus([elo.homeProb,rap.homeProb,ff.homeProb,ml.homeProb,mc.homeProb]);
    setResults({elo,rap,ff,ml,mc,cons});setTab("results");
  };

  const handleFetch=async()=>{
    if(!homeTeam||!awayTeam){setError("Select both teams.");return;}
    if(homeTeam===awayTeam){setError("Select two different teams.");return;}
    setError("");setLoading(true);setResults(null);setDataLoaded(false);
    try{
      const r=await fetch("/api/matchup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({homeTeam,awayTeam})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||`Error ${r.status}`);
      if(!d.home||!d.away)throw new Error("Invalid response");
      setHomeData(d.home);setAwayData(d.away);setDataLoaded(true);runModels(d.home,d.away);
    }catch(e){setError(`Failed: ${e.message}`);}
    setLoading(false);
  };

  const inp={width:"100%",padding:"10px 12px",background:C.black,border:`1.5px solid ${C.border}`,borderRadius:8,color:C.white,fontSize:13,outline:"none",fontFamily:"'Barlow',sans-serif"};
  const outCount=d=>d?.roster?.filter(p=>p.status!=="PLAYING").length||0;

  return <div>
    {/* Matchup selector */}
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden",marginBottom:14}}>
      <SectionHeader label="Select NBA Matchup" right={<span style={{fontSize:11,color:C.muted}}>2025–26 Season</span>}/>
      <div style={{padding:16}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:12,alignItems:"center",marginBottom:14}}>
          <div>
            <div style={{fontSize:10,color:C.teal,fontFamily:"'Barlow Condensed'",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>✈️ Away Team</div>
            <select style={{...inp,cursor:"pointer"}} value={awayTeam} onChange={e=>{setAwayTeam(e.target.value);setAwayData(null);setResults(null);setDataLoaded(false);}}>
              <option value="">Select team...</option>{NBA_TEAMS.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",paddingTop:20}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:C.dark,border:`2px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:12,color:C.muted}}>@</div>
          </div>
          <div>
            <div style={{fontSize:10,color:C.copper,fontFamily:"'Barlow Condensed'",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>🏠 Home Team</div>
            <select style={{...inp,cursor:"pointer"}} value={homeTeam} onChange={e=>{setHomeTeam(e.target.value);setHomeData(null);setResults(null);setDataLoaded(false);}}>
              <option value="">Select team...</option>{NBA_TEAMS.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 36px 1fr",gap:12,marginBottom:14}}>
          <div><div style={{fontSize:10,color:C.muted,letterSpacing:1,marginBottom:5,textTransform:"uppercase"}}>Away Moneyline</div><input style={inp} placeholder="+130" value={awayOdds} onChange={e=>setAwayOdds(e.target.value)}/></div>
          <div/>
          <div><div style={{fontSize:10,color:C.muted,letterSpacing:1,marginBottom:5,textTransform:"uppercase"}}>Home Moneyline</div><input style={inp} placeholder="-150" value={homeOdds} onChange={e=>setHomeOdds(e.target.value)}/></div>
        </div>
        {error&&<div style={{padding:"10px 14px",background:"#2a0f0f",border:"1px solid #5a2020",borderRadius:8,marginBottom:12,fontSize:12,color:"#f87171"}}>⚠️ {error}</div>}
        <button className="hov-btn" onClick={handleFetch} disabled={loading} style={{width:"100%",padding:"13px 0",background:loading?C.dim:`linear-gradient(90deg,${C.copper},${C.copperL})`,border:"none",borderRadius:9,cursor:loading?"not-allowed":"pointer",fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:17,letterSpacing:2,color:loading?C.muted:C.black,textTransform:"uppercase"}}>
          {loading?<span className="pulse">⏳  Fetching Live 2025–26 Data…</span>:"🔍  Fetch Live Data & Analyze"}
        </button>
        {loading&&<div style={{marginTop:10,padding:"10px 14px",background:C.black,border:`1px solid ${C.border}`,borderRadius:8,textAlign:"center"}}><div style={{fontSize:11,color:C.teal}} className="pulse">Searching current NBA stats, rosters & injury reports…</div><div style={{fontSize:10,color:C.muted,marginTop:3}}>~15–20 seconds · Live web search</div></div>}
      </div>
    </div>

    {/* Rosters */}
    {dataLoaded&&homeData&&awayData&&<div className="fade-in" style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden",marginBottom:14}}>
      <SectionHeader label="Injury Report" accent={C.teal} right={<div style={{display:"flex",gap:6}}>
        {outCount(awayData)>0?<Pill label={`${NBA_ABBR[awayTeam]} ${outCount(awayData)} OUT`} color="#E05252"/>:<Pill label={`${NBA_ABBR[awayTeam]} FULL`} color={C.teal}/>}
        {outCount(homeData)>0?<Pill label={`${NBA_ABBR[homeTeam]} ${outCount(homeData)} OUT`} color="#E05252"/>:<Pill label={`${NBA_ABBR[homeTeam]} FULL`} color={C.teal}/>}
      </div>}/>
      <div style={{padding:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <RosterPanel teamName={awayTeam} abbr={NBA_ABBR[awayTeam]} teamData={awayData} onCycle={n=>cyclePlayer("away",n)} sport="nba" accent={C.teal}/>
          <RosterPanel teamName={homeTeam} abbr={NBA_ABBR[homeTeam]} teamData={homeData} onCycle={n=>cyclePlayer("home",n)} sport="nba" accent={C.teal}/>
        </div>
        <button className="hov-btn" onClick={()=>runModels(homeData,awayData)} style={{marginTop:12,width:"100%",padding:"11px 0",background:`linear-gradient(90deg,${C.tealD},${C.teal})`,border:"none",borderRadius:8,cursor:"pointer",fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:15,letterSpacing:2,color:C.black,textTransform:"uppercase"}}>♻️  Recalculate With Updated Injuries</button>
      </div>
    </div>}

    {/* Results */}
    {results&&<NBAResults results={results} awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={NBA_ABBR[awayTeam]} homeAbbr={NBA_ABBR[homeTeam]} awayOdds={awayOdds} homeOdds={homeOdds} homeData={homeData} awayData={awayData} tab={tab} setTab={setTab}/>}
  </div>;
}

function NBAResults({results,awayTeam,homeTeam,awayAbbr,homeAbbr,awayOdds,homeOdds,homeData,awayData,tab,setTab}){
  const {elo,rap,ff,ml,mc,cons}=results;
  const cH=cons,cA=1-cH;
  const hI=oddsToImplied(homeOdds),aI=oddsToImplied(awayOdds);
  const hE=hI!==null?((cH-hI)*100).toFixed(1):null;
  const aE=aI!==null?((cA-aI)*100).toFixed(1):null;
  const hEV=homeOdds&&hI?calcEV(cH,homeOdds):null;
  const aEV=awayOdds&&aI?calcEV(cA,awayOdds):null;
  const sig=v=>v>=5?{l:"STRONG BET",c:"#22c55e"}:v>=2?{l:"LEAN BET",c:C.teal}:v>=0?{l:"SLIGHT EDGE",c:C.copper}:{l:"NO VALUE",c:"#E05252"};
  const aw=1-cons; // away win prob

  return <div className="fade-in">
    <div style={{display:"flex",gap:4,marginBottom:14,background:C.dark,borderRadius:8,padding:4,border:`1px solid ${C.border}`}}>
      {[["results","📊 Results"],["method","🔬 Methodology"]].map(([k,l])=>(
        <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"8px 0",borderRadius:6,border:"none",cursor:"pointer",background:tab===k?`${C.copper}33`:"transparent",color:tab===k?C.copper:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1,textTransform:"uppercase",borderBottom:tab===k?`2px solid ${C.copper}`:"2px solid transparent"}}>{l}</button>
      ))}
    </div>

    {tab==="results"&&<>
      {/* Consensus hero */}
      <div style={{background:C.card,border:`1.5px solid ${C.copper}44`,borderRadius:12,padding:20,marginBottom:14,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-30,right:-30,width:120,height:120,borderRadius:"50%",background:C.copper+"0a",pointerEvents:"none"}}/>
        <SectionHeader label="Consensus — 5 Model Weighted Average"/>
        <div style={{height:8}}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:16,alignItems:"center",marginBottom:16}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
            <Badge abbr={awayAbbr} size={52}/>
            <div style={{textAlign:"center"}}>
              <div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:42,lineHeight:1,color:aw>.55?C.teal:aw>.45?C.copper:C.white}}>{(aw*100).toFixed(1)}%</div>
              <div style={{fontSize:11,color:C.muted,marginTop:2}}>{awayTeam}</div>
            </div>
            <OddsPill prob={aw}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
            <div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:14,color:C.muted,letterSpacing:2}}>VS</div>
            {aE&&<div style={{textAlign:"center",padding:"8px 12px",background:parseFloat(aE)>=2?C.teal+"18":C.black,border:`1px solid ${parseFloat(aE)>=2?C.teal:C.border}`,borderRadius:8}}>
              <div style={{fontFamily:"'Barlow Condensed'",fontSize:11,fontWeight:800,color:parseFloat(aE)>=2?C.teal:C.muted,letterSpacing:1}}>{sig(parseFloat(aw>cH?aE:hE)).l}</div>
              {aEV&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>EV: {parseFloat(aEV)>=0?"+":""}{aEV}</div>}
            </div>}
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
            <Badge abbr={homeAbbr} size={52}/>
            <div style={{textAlign:"center"}}>
              <div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:42,lineHeight:1,color:cH>.55?C.teal:cH>.45?C.copper:C.white}}>{(cH*100).toFixed(1)}%</div>
              <div style={{fontSize:11,color:C.muted,marginTop:2}}>{homeTeam}</div>
            </div>
            <OddsPill prob={cH}/>
          </div>
        </div>
        <WinBar awayProb={aw} awayAbbr={awayAbbr} homeAbbr={homeAbbr}/>
        {(aE||hE)&&<div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
          {aE&&<div style={{padding:"5px 12px",borderRadius:6,background:parseFloat(aE)>=2?C.teal+"18":C.black,border:`1px solid ${parseFloat(aE)>=2?C.teal:C.border}`,fontSize:11,color:parseFloat(aE)>=2?C.teal:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:700}}>{awayAbbr} Edge: {parseFloat(aE)>=0?"+":""}{aE}%{aEV?` · EV ${parseFloat(aEV)>=0?"+":""}${aEV}/$1`:""}</div>}
          {hE&&<div style={{padding:"5px 12px",borderRadius:6,background:parseFloat(hE)>=2?C.teal+"18":C.black,border:`1px solid ${parseFloat(hE)>=2?C.teal:C.border}`,fontSize:11,color:parseFloat(hE)>=2?C.teal:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:700}}>{homeAbbr} Edge: {parseFloat(hE)>=0?"+":""}{hE}%{hEV?` · EV ${parseFloat(hEV)>=0?"+":""}${hEV}/$1`:""}</div>}
        </div>}
      </div>
      {/* Model grid */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <ModelCard icon="♟️" name="Elo Rating" desc="Win-rate Elo + recent form + home court" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-elo.homeProb} detail={`Away Elo: ${elo.aElo}  ·  Home Elo: ${elo.hElo}  ·  +100 HCA`}/>
        <ModelCard icon="👤" name="RAPTOR Impact" desc="Player PER weighted by availability" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-rap.homeProb} detail={`Away adj PER: ${rap.aVal}  ·  Home: ${rap.hVal}`}/>
        <ModelCard icon="📐" name="Four Factors" desc="eFG%, TOV%, OREB%, FTR + net rating" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-ff.homeProb} detail={`Away FF: ${ff.aFF}  ·  Home: ${ff.hFF}`}/>
        <ModelCard icon="🤖" name="ML / BPI" desc="7-feature logistic regression" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-ml.homeProb} detail="Net rtg · Win% · Eff · L10 · Injury penalty"/>
      </div>
      <ModelCard icon="🎲" name="Monte Carlo Simulation" desc="8,000 simulated games · Normal distribution" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-mc.homeProb} detail={`Proj: ${awayTeam.split(" ").at(-1)} ${mc.aExp}  ·  ${homeTeam.split(" ").at(-1)} ${mc.hExp} pts`}/>
      {/* Agreement */}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:14,marginTop:10}}>
        <div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1.5,color:C.copper,textTransform:"uppercase",marginBottom:10}}>📈 Model Agreement</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
          {[{l:"Elo",p:1-elo.homeProb},{l:"RAPTOR",p:1-rap.homeProb},{l:"4 Factors",p:1-ff.homeProb},{l:"ML/BPI",p:1-ml.homeProb},{l:"Monte Carlo",p:1-mc.homeProb}].map(m=>{
            const fav=m.p>.5;
            return <div key={m.l} style={{textAlign:"center",background:C.black,borderRadius:8,padding:"10px 6px",border:`1px solid ${fav?C.teal+"44":C.border}`}}>
              <div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:22,color:fav?C.teal:C.white}}>{(m.p*100).toFixed(0)}%</div>
              <div style={{fontSize:10,color:fav?C.teal:C.muted,fontWeight:700,marginBottom:2}}>{fav?awayAbbr:homeAbbr}</div>
              <div style={{fontSize:9,color:C.dim,textTransform:"uppercase",letterSpacing:.5}}>{m.l}</div>
            </div>;
          })}
        </div>
      </div>
    </>}

    {tab==="method"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      {[["♟️","Elo Rating (18%)","Win rate → Elo (1500 base). L10 adjusts dynamically. +100 home court. Formula: 1/(1+10^(diff/400))."],["👤","RAPTOR / Player Impact (22%)","PER × availability: OUT=0%, DOUBTFUL=25%, QUESTIONABLE=65%, PLAYING=100%."],["📐","Net Rating / Four Factors (22%)","eFG%(40%) + TOV(25%) + OREB(20%) + FTR(15%) blended with net rating differential."],["🤖","ML / BPI-Style (22%)","Logistic regression: net rating, win%, off/def efficiency, L10, injury penalty, HCA."],["🎲","Monte Carlo (16%)","8,000 simulations. Scores from normal dist (σ=11) vs opponent defense, adjusted for injuries."],["🏆","Consensus","Elo×18% + RAPTOR×22% + FF×22% + ML×22% + MC×16%."]].map(([icon,n,d])=>(
        <div key={n} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:16}}>
          <div style={{fontSize:22,marginBottom:8}}>{icon}</div>
          <div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,color:C.copper,marginBottom:6}}>{n}</div>
          <div style={{fontSize:11,color:C.muted,lineHeight:1.7}}>{d}</div>
        </div>
      ))}
    </div>}
  </div>;
}

// ══════════════════════════════════════════════════════════════════════════
// NHL PAGE
// ══════════════════════════════════════════════════════════════════════════
const NHL_TEAMS=["Anaheim Ducks","Boston Bruins","Buffalo Sabres","Calgary Flames","Carolina Hurricanes","Chicago Blackhawks","Colorado Avalanche","Columbus Blue Jackets","Dallas Stars","Detroit Red Wings","Edmonton Oilers","Florida Panthers","Los Angeles Kings","Minnesota Wild","Montreal Canadiens","Nashville Predators","New Jersey Devils","New York Islanders","New York Rangers","Ottawa Senators","Philadelphia Flyers","Pittsburgh Penguins","San Jose Sharks","Seattle Kraken","St. Louis Blues","Tampa Bay Lightning","Toronto Maple Leafs","Utah Hockey Club","Vancouver Canucks","Vegas Golden Knights","Washington Capitals","Winnipeg Jets"];
const NHL_ABBR={"Anaheim Ducks":"ANA","Boston Bruins":"BOS","Buffalo Sabres":"BUF","Calgary Flames":"CGY","Carolina Hurricanes":"CAR","Chicago Blackhawks":"CHI","Colorado Avalanche":"COL","Columbus Blue Jackets":"CBJ","Dallas Stars":"DAL","Detroit Red Wings":"DET","Edmonton Oilers":"EDM","Florida Panthers":"FLA","Los Angeles Kings":"LAK","Minnesota Wild":"MIN","Montreal Canadiens":"MTL","Nashville Predators":"NSH","New Jersey Devils":"NJD","New York Islanders":"NYI","New York Rangers":"NYR","Ottawa Senators":"OTT","Philadelphia Flyers":"PHI","Pittsburgh Penguins":"PIT","San Jose Sharks":"SJS","Seattle Kraken":"SEA","St. Louis Blues":"STL","Tampa Bay Lightning":"TBL","Toronto Maple Leafs":"TOR","Utah Hockey Club":"UTA","Vancouver Canucks":"VAN","Vegas Golden Knights":"VGK","Washington Capitals":"WSH","Winnipeg Jets":"WPG"};

// NHL-specific models
function nhlMdlElo(h,a){
  const hp=h.points/Math.max(h.wins+h.losses+h.otl,1)/2,ap=a.points/Math.max(a.wins+a.losses+a.otl,1)/2;
  const hE=1500+400*Math.log10(Math.max(hp,.01)/Math.max(1-hp,.01));
  const aE=1500+400*Math.log10(Math.max(ap,.01)/Math.max(1-ap,.01));
  const h10=(h.last10_gf||h.gf_pg)-(h.last10_ga||h.ga_pg),a10=(a.last10_gf||a.gf_pg)-(a.last10_ga||a.ga_pg);
  const p=1/(1+Math.pow(10,(aE+a10*40-((hE+h10*40)+60))/400));
  return{homeProb:Math.min(.97,Math.max(.03,p)),hElo:Math.round(hE+h10*40),aElo:Math.round(aE+a10*40)};
}
function nhlMdlGoalie(h,a){
  // Goalie model: save% differential is huge in hockey
  const gPen=g=>(g&&g.status&&g.status!=="PLAYING")?((g.status==="OUT"?1:g.status==="DOUBTFUL"?.7:.35)*(.920-(g.save_pct||.905))):0;
  const hSv=(h.goalie?.save_pct||h.save_pct||.905)-(gPen(h.goalie));
  const aSv=(a.goalie?.save_pct||a.save_pct||.905)-(gPen(a.goalie));
  const hShot=h.shots_against_pg||30,aShot=a.shots_against_pg||30;
  // Expected goals against = shots * (1 - save%)
  const hGA=hShot*(1-hSv),aGA=aShot*(1-aSv);
  // Lower GA = better. Diff drives probability
  const diff=(aGA-hGA); // positive = home advantage
  return{homeProb:Math.min(.97,Math.max(.03,logistic(diff*1.2+.05))),hSv:hSv.toFixed(3),aSv:aSv.toFixed(3),hGA:hGA.toFixed(2),aGA:aGA.toFixed(2)};
}
function nhlMdlSpecialTeams(h,a){
  // PP% and PK% matter enormously in hockey
  const hPP=(h.pp_pct||20)/100,aPP=(a.pp_pct||20)/100;
  const hPK=(h.pk_pct||80)/100,aPK=(a.pk_pct||80)/100;
  // Net special teams impact
  const hST=hPP*0.6+hPK*0.4;
  const aST=aPP*0.6+aPK*0.4;
  // Also factor in skater injuries
  const injPen=r=>(r||[]).reduce((s,p)=>p.status==="PLAYING"?s:s+(p.status==="OUT"?1:p.status==="DOUBTFUL"?.6:.3)*(p.role==="STAR"?.06:p.role==="KEY"?.03:.01),0);
  const hPenalty=injPen(h.roster),aPenalty=injPen(a.roster);
  const diff=(hST-aST)*3+(aPenalty-hPenalty)+0.05;
  return{homeProb:Math.min(.97,Math.max(.03,logistic(diff))),hST:(hST*100).toFixed(1),aST:(aST*100).toFixed(1)};
}
function nhlMdlCorsi(h,a){
  // Shot attempt dominance (proxy for Corsi/Fenwick)
  const hCF=h.shots_pg/(h.shots_pg+a.shots_against_pg||60);
  const aCF=a.shots_pg/(a.shots_pg+h.shots_against_pg||60);
  const netDiff=(h.gf_pg-h.ga_pg)-(a.gf_pg-a.ga_pg);
  const score=(hCF-aCF)*3+netDiff*0.3+0.05;
  return{homeProb:Math.min(.97,Math.max(.03,logistic(score))),hCF:(hCF*100).toFixed(1),aCF:(aCF*100).toFixed(1)};
}
function nhlMdlMC(h,a,N=8000){
  const goalieAdj=d=>{
    if(!d.goalie||d.goalie.status==="PLAYING")return 0;
    return d.goalie.status==="OUT"?.4:d.goalie.status==="DOUBTFUL"?.2:.1;
  };
  const injAdj=r=>(r||[]).reduce((s,p)=>p.status==="PLAYING"?s:s+(p.status==="OUT"?1:p.status==="DOUBTFUL"?.6:.3)*(p.role==="STAR"?.08:p.role==="KEY"?.04:.01),0);
  const hExp=h.gf_pg-goalieAdj(h)-injAdj(h.roster)+.1; // home ice ~0.1 extra goals
  const aExp=a.gf_pg-goalieAdj(a)-injAdj(a.roster);
  let hw=0;
  for(let i=0;i<N;i++){
    // Poisson-approximate with normal for speed
    const hG=Math.max(0,hExp+Math.sqrt(hExp)*(Math.sqrt(-2*Math.log(Math.random()))*Math.cos(2*Math.PI*Math.random())));
    const aG=Math.max(0,aExp+Math.sqrt(aExp)*(Math.sqrt(-2*Math.log(Math.random()))*Math.cos(2*Math.PI*Math.random())));
    if(hG>aG)hw++;
    else if(hG===aG)hw+=.5; // OT toss-up simplified
  }
  return{homeProb:Math.min(.97,Math.max(.03,hw/N)),hExp:hExp.toFixed(2),aExp:aExp.toFixed(2)};
}
function nhlConsensus(ps){return Math.min(.97,Math.max(.03,[.20,.28,.20,.17,.15].reduce((s,w,i)=>s+ps[i]*w,0)));}

function NHLPage() {
  const [homeTeam,setHomeTeam]=useState("");
  const [awayTeam,setAwayTeam]=useState("");
  const [homeOdds,setHomeOdds]=useState("");
  const [awayOdds,setAwayOdds]=useState("");
  const [homeData,setHomeData]=useState(null);
  const [awayData,setAwayData]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [results,setResults]=useState(null);
  const [tab,setTab]=useState("results");
  const [dataLoaded,setDataLoaded]=useState(false);

  const cyclePlayer=(side,name)=>{
    const [getter,setter]=side==="home"?[homeData,setHomeData]:[awayData,setAwayData];
    if(!getter)return;
    if(name==="__goalie__"){
      setter({...getter,goalie:{...getter.goalie,status:STATUS_CYCLE[(STATUS_CYCLE.indexOf(getter.goalie.status||"PLAYING")+1)%4]}});
    }else{
      setter({...getter,roster:getter.roster.map(p=>p.name!==name?p:{...p,status:STATUS_CYCLE[(STATUS_CYCLE.indexOf(p.status)+1)%4]})});
    }
  };

  const runModels=(h,a)=>{
    const elo=nhlMdlElo(h,a),gl=nhlMdlGoalie(h,a),st=nhlMdlSpecialTeams(h,a),cs=nhlMdlCorsi(h,a),mc=nhlMdlMC(h,a);
    const cons=nhlConsensus([elo.homeProb,gl.homeProb,st.homeProb,cs.homeProb,mc.homeProb]);
    setResults({elo,gl,st,cs,mc,cons});setTab("results");
  };

  const handleFetch=async()=>{
    if(!homeTeam||!awayTeam){setError("Select both teams.");return;}
    if(homeTeam===awayTeam){setError("Select two different teams.");return;}
    setError("");setLoading(true);setResults(null);setDataLoaded(false);
    try{
      const r=await fetch("/api/nhl-matchup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({homeTeam,awayTeam})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||`Error ${r.status}`);
      if(!d.home||!d.away)throw new Error("Invalid response");
      setHomeData(d.home);setAwayData(d.away);setDataLoaded(true);runModels(d.home,d.away);
    }catch(e){setError(`Failed: ${e.message}`);}
    setLoading(false);
  };

  const inp={width:"100%",padding:"10px 12px",background:C.black,border:`1.5px solid ${C.border}`,borderRadius:8,color:C.white,fontSize:13,outline:"none",fontFamily:"'Barlow',sans-serif"};
  const outCount=d=>d?.roster?.filter(p=>p.status!=="PLAYING").length||0;
  const goalieOut=d=>d?.goalie?.status&&d.goalie.status!=="PLAYING";

  return <div>
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden",marginBottom:14}}>
      <SectionHeader label="Select NHL Matchup" right={<span style={{fontSize:11,color:C.muted}}>2025–26 Season</span>}/>
      <div style={{padding:16}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:12,alignItems:"center",marginBottom:14}}>
          <div>
            <div style={{fontSize:10,color:C.ice,fontFamily:"'Barlow Condensed'",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>✈️ Away Team</div>
            <select style={{...inp,cursor:"pointer"}} value={awayTeam} onChange={e=>{setAwayTeam(e.target.value);setAwayData(null);setResults(null);setDataLoaded(false);}}>
              <option value="">Select team...</option>{NHL_TEAMS.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",paddingTop:20}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:C.dark,border:`2px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:12,color:C.muted}}>@</div>
          </div>
          <div>
            <div style={{fontSize:10,color:C.copper,fontFamily:"'Barlow Condensed'",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>🏠 Home Team</div>
            <select style={{...inp,cursor:"pointer"}} value={homeTeam} onChange={e=>{setHomeTeam(e.target.value);setHomeData(null);setResults(null);setDataLoaded(false);}}>
              <option value="">Select team...</option>{NHL_TEAMS.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 36px 1fr",gap:12,marginBottom:14}}>
          <div><div style={{fontSize:10,color:C.muted,letterSpacing:1,marginBottom:5,textTransform:"uppercase"}}>Away Moneyline</div><input style={inp} placeholder="+130" value={awayOdds} onChange={e=>setAwayOdds(e.target.value)}/></div>
          <div/>
          <div><div style={{fontSize:10,color:C.muted,letterSpacing:1,marginBottom:5,textTransform:"uppercase"}}>Home Moneyline</div><input style={inp} placeholder="-140" value={homeOdds} onChange={e=>setHomeOdds(e.target.value)}/></div>
        </div>
        {error&&<div style={{padding:"10px 14px",background:"#2a0f0f",border:"1px solid #5a2020",borderRadius:8,marginBottom:12,fontSize:12,color:"#f87171"}}>⚠️ {error}</div>}
        <button className="hov-btn" onClick={handleFetch} disabled={loading} style={{width:"100%",padding:"13px 0",background:loading?C.dim:`linear-gradient(90deg,${C.iceD||"#5BAACB"},${C.ice||"#A8D8EA"})`,border:"none",borderRadius:9,cursor:loading?"not-allowed":"pointer",fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:17,letterSpacing:2,color:loading?C.muted:C.black,textTransform:"uppercase"}}>
          {loading?<span className="pulse">⏳  Fetching Live 2025–26 Data…</span>:"🏒  Fetch Live Data & Analyze"}
        </button>
        {loading&&<div style={{marginTop:10,padding:"10px 14px",background:C.black,border:`1px solid ${C.border}`,borderRadius:8,textAlign:"center"}}><div style={{fontSize:11,color:C.ice}} className="pulse">Searching current NHL stats, rosters, goalies & injury reports…</div><div style={{fontSize:10,color:C.muted,marginTop:3}}>~15–20 seconds · Live web search</div></div>}
      </div>
    </div>

    {dataLoaded&&homeData&&awayData&&<div className="fade-in" style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden",marginBottom:14}}>
      <SectionHeader label="Lineup & Injury Report" accent={C.ice} right={<div style={{display:"flex",gap:6}}>
        {(outCount(awayData)>0||goalieOut(awayData))?<Pill label={`${NHL_ABBR[awayTeam]} ${outCount(awayData)+(goalieOut(awayData)?1:0)} OUT`} color="#E05252"/>:<Pill label={`${NHL_ABBR[awayTeam]} FULL`} color={C.ice}/>}
        {(outCount(homeData)>0||goalieOut(homeData))?<Pill label={`${NHL_ABBR[homeTeam]} ${outCount(homeData)+(goalieOut(homeData)?1:0)} OUT`} color="#E05252"/>:<Pill label={`${NHL_ABBR[homeTeam]} FULL`} color={C.ice}/>}
      </div>}/>
      <div style={{padding:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <RosterPanel teamName={awayTeam} abbr={NHL_ABBR[awayTeam]} teamData={awayData} onCycle={n=>cyclePlayer("away",n)} sport="nhl" accent={C.ice}/>
          <RosterPanel teamName={homeTeam} abbr={NHL_ABBR[homeTeam]} teamData={homeData} onCycle={n=>cyclePlayer("home",n)} sport="nhl" accent={C.ice}/>
        </div>
        <button className="hov-btn" onClick={()=>runModels(homeData,awayData)} style={{marginTop:12,width:"100%",padding:"11px 0",background:`linear-gradient(90deg,${C.iceD},${C.ice})`,border:"none",borderRadius:8,cursor:"pointer",fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:15,letterSpacing:2,color:C.black,textTransform:"uppercase"}}>♻️  Recalculate With Updated Lineup</button>
      </div>
    </div>}

    {results&&<NHLResults results={results} awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={NHL_ABBR[awayTeam]} homeAbbr={NHL_ABBR[homeTeam]} awayOdds={awayOdds} homeOdds={homeOdds} tab={tab} setTab={setTab}/>}
  </div>;
}

function NHLResults({results,awayTeam,homeTeam,awayAbbr,homeAbbr,awayOdds,homeOdds,tab,setTab}){
  const {elo,gl,st,cs,mc,cons}=results;
  const cH=cons,aw=1-cH;
  const hI=oddsToImplied(homeOdds),aI=oddsToImplied(awayOdds);
  const hE=hI!==null?((cH-hI)*100).toFixed(1):null;
  const aE=aI!==null?((aw-aI)*100).toFixed(1):null;
  const hEV=homeOdds&&hI?calcEV(cH,homeOdds):null;
  const aEV=awayOdds&&aI?calcEV(aw,awayOdds):null;
  const sig=v=>v>=5?{l:"STRONG BET",c:"#22c55e"}:v>=2?{l:"LEAN BET",c:C.ice}:v>=0?{l:"SLIGHT EDGE",c:C.copper}:{l:"NO VALUE",c:"#E05252"};

  return <div className="fade-in">
    <div style={{display:"flex",gap:4,marginBottom:14,background:C.dark,borderRadius:8,padding:4,border:`1px solid ${C.border}`}}>
      {[["results","📊 Results"],["method","🔬 Methodology"]].map(([k,l])=>(
        <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"8px 0",borderRadius:6,border:"none",cursor:"pointer",background:tab===k?`${C.ice}22`:"transparent",color:tab===k?C.ice:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1,textTransform:"uppercase",borderBottom:tab===k?`2px solid ${C.ice}`:"2px solid transparent"}}>{l}</button>
      ))}
    </div>

    {tab==="results"&&<>
      <div style={{background:C.card,border:`1.5px solid ${C.ice}44`,borderRadius:12,padding:20,marginBottom:14,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-30,right:-30,width:120,height:120,borderRadius:"50%",background:C.ice+"08",pointerEvents:"none"}}/>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
          <div style={{width:3,height:16,borderRadius:2,background:C.ice}}/>
          <span style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:14,letterSpacing:1.5,color:C.white,textTransform:"uppercase"}}>Consensus — 5 Hockey Models</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:16,alignItems:"center",marginBottom:16}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
            <Badge abbr={awayAbbr} size={52} accent={C.ice}/>
            <div style={{textAlign:"center"}}>
              <div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:42,lineHeight:1,color:aw>.55?C.ice:aw>.45?C.copper:C.white}}>{(aw*100).toFixed(1)}%</div>
              <div style={{fontSize:11,color:C.muted,marginTop:2}}>{awayTeam}</div>
            </div>
            <OddsPill prob={aw} accent={C.ice}/>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
            <div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:14,color:C.muted,letterSpacing:2}}>VS</div>
            {aE&&<div style={{textAlign:"center",padding:"8px 12px",background:parseFloat(aE)>=2?C.ice+"18":C.black,border:`1px solid ${parseFloat(aE)>=2?C.ice:C.border}`,borderRadius:8}}>
              <div style={{fontFamily:"'Barlow Condensed'",fontSize:11,fontWeight:800,color:parseFloat(aE)>=2?C.ice:C.muted,letterSpacing:1}}>{sig(parseFloat(aw>cH?aE:hE)).l}</div>
              {aEV&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>EV: {parseFloat(aEV)>=0?"+":""}{aEV}</div>}
            </div>}
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
            <Badge abbr={homeAbbr} size={52} accent={C.ice}/>
            <div style={{textAlign:"center"}}>
              <div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:42,lineHeight:1,color:cH>.55?C.ice:cH>.45?C.copper:C.white}}>{(cH*100).toFixed(1)}%</div>
              <div style={{fontSize:11,color:C.muted,marginTop:2}}>{homeTeam}</div>
            </div>
            <OddsPill prob={cH} accent={C.ice}/>
          </div>
        </div>
        <WinBar awayProb={aw} awayAbbr={awayAbbr} homeAbbr={homeAbbr} accent={C.ice}/>
        {(aE||hE)&&<div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
          {aE&&<div style={{padding:"5px 12px",borderRadius:6,background:parseFloat(aE)>=2?C.ice+"18":C.black,border:`1px solid ${parseFloat(aE)>=2?C.ice:C.border}`,fontSize:11,color:parseFloat(aE)>=2?C.ice:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:700}}>{awayAbbr} Edge: {parseFloat(aE)>=0?"+":""}{aE}%{aEV?` · EV ${parseFloat(aEV)>=0?"+":""}${aEV}/$1`:""}</div>}
          {hE&&<div style={{padding:"5px 12px",borderRadius:6,background:parseFloat(hE)>=2?C.ice+"18":C.black,border:`1px solid ${parseFloat(hE)>=2?C.ice:C.border}`,fontSize:11,color:parseFloat(hE)>=2?C.ice:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:700}}>{homeAbbr} Edge: {parseFloat(hE)>=0?"+":""}{hE}%{hEV?` · EV ${parseFloat(hEV)>=0?"+":""}${hEV}/$1`:""}</div>}
        </div>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <ModelCard icon="♟️" name="Elo Rating" desc="Points-based Elo + recent form + home ice" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-elo.homeProb} detail={`Away Elo: ${elo.aElo}  ·  Home Elo: ${elo.hElo}  ·  +60 home ice`} accent={C.ice}/>
        <ModelCard icon="🥅" name="Goalie Model" desc="Save% differential + expected goals against" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-gl.homeProb} detail={`Away SV%: ${gl.aSv} (xGA: ${gl.aGA})  ·  Home SV%: ${gl.hSv} (xGA: ${gl.hGA})`} accent={C.ice}/>
        <ModelCard icon="⚡" name="Special Teams" desc="Power play % + penalty kill % combined" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-st.homeProb} detail={`Away ST index: ${st.aST}  ·  Home: ${st.hST}`} accent={C.ice}/>
        <ModelCard icon="🎯" name="Shot Dominance / Corsi" desc="Shot attempt differential + goal rate" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-cs.homeProb} detail={`Away CF%: ${cs.aCF}%  ·  Home CF%: ${cs.hCF}%`} accent={C.ice}/>
      </div>
      <ModelCard icon="🎲" name="Monte Carlo Simulation" desc="8,000 simulated games · Poisson goal distribution" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-mc.homeProb} detail={`Proj: ${awayTeam.split(" ").at(-1)} ${mc.aExp}  ·  ${homeTeam.split(" ").at(-1)} ${mc.hExp} goals`} accent={C.ice}/>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:14,marginTop:10}}>
        <div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1.5,color:C.ice,textTransform:"uppercase",marginBottom:10}}>📈 Model Agreement</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
          {[{l:"Elo",p:1-elo.homeProb},{l:"Goalie",p:1-gl.homeProb},{l:"Spec. Teams",p:1-st.homeProb},{l:"Corsi",p:1-cs.homeProb},{l:"Monte Carlo",p:1-mc.homeProb}].map(m=>{
            const fav=m.p>.5;
            return <div key={m.l} style={{textAlign:"center",background:C.black,borderRadius:8,padding:"10px 6px",border:`1px solid ${fav?C.ice+"44":C.border}`}}>
              <div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:22,color:fav?C.ice:C.white}}>{(m.p*100).toFixed(0)}%</div>
              <div style={{fontSize:10,color:fav?C.ice:C.muted,fontWeight:700,marginBottom:2}}>{fav?awayAbbr:homeAbbr}</div>
              <div style={{fontSize:9,color:C.dim,textTransform:"uppercase",letterSpacing:.5}}>{m.l}</div>
            </div>;
          })}
        </div>
      </div>
    </>}

    {tab==="method"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      {[["♟️","Elo Rating (20%)","Points-based Elo (1500 base). L10 goal differential adjusts. +60 home ice advantage. 1/(1+10^(diff/400))."],["🥅","Goalie Model (28%)","Highest-weighted model. Save% × shots against = expected goals against. Goalie injuries significantly penalized. Most predictive in hockey."],["⚡","Special Teams (20%)","PP% (60%) + PK% (40%) combined index. Special teams convert ~20% of possessions — massive edge when one team dominates."],["🎯","Shot Dominance / Corsi (17%)","Shot attempt differential as proxy for zone time and sustained pressure. Combined with goal rate differential."],["🎲","Monte Carlo (15%)","8,000 simulations using Poisson-approximated goal distributions. Goalie and skater injuries reduce expected goals."],["🏆","Consensus","Elo×20% + Goalie×28% + SpecTeams×20% + Corsi×17% + MC×15%. Goalie model weighted highest as it's the #1 predictor in NHL."]].map(([icon,n,d])=>(
        <div key={n} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:16}}>
          <div style={{fontSize:22,marginBottom:8}}>{icon}</div>
          <div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,color:C.ice,marginBottom:6}}>{n}</div>
          <div style={{fontSize:11,color:C.muted,lineHeight:1.7}}>{d}</div>
        </div>
      ))}
    </div>}
  </div>;
}

// ══════════════════════════════════════════════════════════════════════════
// ROOT APP — Nav + page routing
// ══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [sport, setSport] = useState("nba");

  const navItems = [
    { id:"nba", label:"NBA 🏀", accent:C.teal },
    { id:"nhl", label:"NHL 🏒", accent:C.ice },
  ];

  return (
    <div style={{minHeight:"100vh",background:C.black,fontFamily:"'Barlow',sans-serif",color:C.white}}>
      <style>{STYLES}</style>

      {/* ── HEADER ── */}
      <div style={{background:C.dark,borderBottom:`1px solid ${C.border}`}}>
        <div style={{maxWidth:1040,margin:"0 auto",padding:"0 16px"}}>
          <div style={{display:"flex",alignItems:"center",height:56,gap:16}}>
            {/* Logo */}
            <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
              <div style={{width:32,height:32,borderRadius:6,background:`linear-gradient(135deg,${C.copper},${C.copperL})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🏟️</div>
              <div>
                <div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:20,color:C.white,letterSpacing:1,lineHeight:1}}>COURT EDGE</div>
                <div style={{fontSize:9,color:C.copper,letterSpacing:2,textTransform:"uppercase"}}>Sports Analytics</div>
              </div>
            </div>

            {/* Sport nav tabs */}
            <div style={{display:"flex",gap:2,marginLeft:16,background:C.black,borderRadius:8,padding:3,border:`1px solid ${C.border}`}}>
              {navItems.map(item=>(
                <button key={item.id} onClick={()=>setSport(item.id)} style={{
                  padding:"7px 20px",borderRadius:6,border:"none",cursor:"pointer",
                  background:sport===item.id?`linear-gradient(135deg,${item.accent}22,${item.accent}11)`:"transparent",
                  color:sport===item.id?item.accent:C.muted,
                  fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:14,letterSpacing:1,
                  borderBottom:sport===item.id?`2px solid ${item.accent}`:"2px solid transparent",
                  transition:"all .2s ease",
                }}>
                  {item.label}
                </button>
              ))}
            </div>

            {/* Right badges */}
            <div style={{marginLeft:"auto",display:"flex",gap:6,alignItems:"center"}}>
              <div style={{padding:"5px 12px",borderRadius:20,background:`linear-gradient(90deg,${C.copper},${C.copperL})`,fontSize:11,fontWeight:700,color:C.black,fontFamily:"'Barlow Condensed'",letterSpacing:1}}>
                2025–26 LIVE
              </div>
              <div style={{padding:"5px 12px",borderRadius:20,background:C.card,border:`1px solid ${C.border}`,fontSize:11,color:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:700,letterSpacing:.5}}>
                5 MODELS
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SPORT SUBTITLE BAR ── */}
      <div style={{background:sport==="nba"?`linear-gradient(90deg,${C.teal}18,transparent,${C.teal}08)`:`linear-gradient(90deg,${C.ice}18,transparent,${C.ice}08)`,borderBottom:`1px solid ${C.border}`,padding:"8px 16px"}}>
        <div style={{maxWidth:1040,margin:"0 auto",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:18,color:sport==="nba"?C.teal:C.ice,letterSpacing:2}}>
            {sport==="nba"?"NBA MONEYLINE ANALYZER":"NHL MONEYLINE ANALYZER"}
          </span>
          <span style={{fontSize:11,color:C.muted}}>
            {sport==="nba"?"5-model system · Elo · RAPTOR · Four Factors · ML/BPI · Monte Carlo":"5-model system · Elo · Goalie · Special Teams · Corsi · Monte Carlo"}
          </span>
        </div>
      </div>

      {/* ── PAGE CONTENT ── */}
      <div style={{maxWidth:1040,margin:"0 auto",padding:"16px"}}>
        {sport==="nba"&&<NBAPage/>}
        {sport==="nhl"&&<NHLPage/>}
        <div style={{fontSize:10,color:C.dim,textAlign:"center",padding:"16px 0 8px",lineHeight:1.8}}>
          ⚠️ For informational &amp; entertainment purposes only · Not financial advice · Gamble responsibly
        </div>
      </div>
    </div>
  );
}
