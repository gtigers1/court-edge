// v6-sequential
import { useState } from "react";

function oddsToImplied(o){if(!o||o==="-"||o==="+")return null;const n=parseInt(o);if(isNaN(n)||n===0)return null;return n>0?100/(n+100):Math.abs(n)/(Math.abs(n)+100);}
function probToAmerican(p){p=Math.max(0.01,Math.min(0.99,p));return p>=0.5?("-"+Math.round((p/(1-p))*100)):("+"+ Math.round(((1-p)/p)*100));}
function calcEV(prob,odds){const o=parseInt(odds);if(isNaN(o))return null;const pay=o>0?o/100:100/Math.abs(o);return(prob*pay-(1-prob)).toFixed(3);}
function logistic(x){return 1/(1+Math.exp(-x));}

const C={black:"#0A0A0C",dark:"#111116",card:"#16161C",border:"#242430",copper:"#B87333",copperL:"#D4924A",teal:"#2DD4A0",tealD:"#1A9E78",ice:"#A8D8EA",iceD:"#5BAACB",white:"#F0F0F5",muted:"#6B6B80",dim:"#3A3A4A"};

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
  const subtitle=sport==="nhl"?teamData.wins+"W-"+teamData.losses+"L-"+teamData.otl+"OTL - "+teamData.gf_pg+" GF/G - "+teamData.ga_pg+" GA/G":teamData.wins+"W-"+teamData.losses+"L - "+teamData.ppg+" PPG - "+teamData.opp+" OPP";
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
        const sub=sport==="nhl"?p.goals+"G "+p.assists+"A "+p.points+"PTS "+(p.plus_minus>=0?"+":"")+p.plus_minus:p.ppg+" PPG";
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

const NBA_TEAMS=["Atlanta Hawks","Boston Celtics","Brooklyn Nets","Charlotte Hornets","Chicago Bulls","Cleveland Cavaliers","Dallas Mavericks","Denver Nuggets","Detroit Pistons","Golden State Warriors","Houston Rockets","Indiana Pacers","LA Clippers","Los Angeles Lakers","Memphis Grizzlies","Miami Heat","Milwaukee Bucks","Minnesota Timberwolves","New Orleans Pelicans","New York Knicks","Oklahoma City Thunder","Orlando Magic","Philadelphia 76ers","Phoenix Suns","Portland Trail Blazers","Sacramento Kings","San Antonio Spurs","Toronto Raptors","Utah Jazz","Washington Wizards"];
const NBA_ABBR={"Atlanta Hawks":"ATL","Boston Celtics":"BOS","Brooklyn Nets":"BKN","Charlotte Hornets":"CHA","Chicago Bulls":"CHI","Cleveland Cavaliers":"CLE","Dallas Mavericks":"DAL","Denver Nuggets":"DEN","Detroit Pistons":"DET","Golden State Warriors":"GSW","Houston Rockets":"HOU","Indiana Pacers":"IND","LA Clippers":"LAC","Los Angeles Lakers":"LAL","Memphis Grizzlies":"MEM","Miami Heat":"MIA","Milwaukee Bucks":"MIL","Minnesota Timberwolves":"MIN","New Orleans Pelicans":"NOP","New York Knicks":"NYK","Oklahoma City Thunder":"OKC","Orlando Magic":"ORL","Philadelphia 76ers":"PHI","Phoenix Suns":"PHX","Portland Trail Blazers":"POR","Sacramento Kings":"SAC","San Antonio Spurs":"SAS","Toronto Raptors":"TOR","Utah Jazz":"UTA","Washington Wizards":"WAS"};

function nbaMdlElo(h,a){const hw=h.wins/Math.max(h.wins+h.losses,1),aw=a.wins/Math.max(a.wins+a.losses,1);const hE=1500+400*Math.log10(Math.max(hw,.01)/Math.max(1-hw,.01)),aE=1500+400*Math.log10(Math.max(aw,.01)/Math.max(1-aw,.01));const h10=(h.last10_ppg||h.ppg)-(h.last10_opp||h.opp),a10=(a.last10_ppg||a.ppg)-(a.last10_opp||a.opp);const p=1/(1+Math.pow(10,(aE+a10*3-((hE+h10*3)+100))/400));return{homeProb:Math.min(.97,Math.max(.03,p)),hElo:Math.round(hE+h10*3),aElo:Math.round(aE+a10*3)};}
function nbaMdlRaptor(h,a){const val=r=>(r||[]).reduce((s,p)=>s+(p.per||15)*(p.status==="PLAYING"?1:p.status==="OUT"?0:p.status==="DOUBTFUL"?.25:.65),0);const hV=val(h.roster),aV=val(a.roster);return{homeProb:Math.min(.97,Math.max(.03,hV/Math.max(hV+aV,1)+.035)),hVal:hV.toFixed(1),aVal:aV.toFixed(1)};}
function nbaMdlFF(h,a){const hit=r=>(r||[]).reduce((s,p)=>{if(p.status==="PLAYING")return s;const sw=p.status==="OUT"?1:p.status==="DOUBTFUL"?.75:.35;return s+sw*Math.max(p.role==="STAR"?.08:p.role==="KEY"?.04:.015,Math.min((p.ppg||0)*.004,.06));},0);const ff=d=>(d.efg_pct||.52)*.40+(1-(d.tov_rate||14)/30)*.25+(d.oreb_pct||.25)*.20+Math.min(d.ftr||.22,.40)*.15;const hH=hit(h.roster),aH=hit(a.roster);return{homeProb:Math.min(.97,Math.max(.03,logistic((h.ppg-h.opp-(a.ppg-a.opp))*.065+(ff(h)-ff(a))*4)+.035-hH+aH)),hFF:ff(h).toFixed(3),aFF:ff(a).toFixed(3)};}
function nbaMdlML(h,a){const pen=r=>(r||[]).reduce((s,p)=>p.status==="PLAYING"?s:s+(p.status==="OUT"?1:p.status==="DOUBTFUL"?.6:.3)*(p.per||12)*.01,0);const f=d=>({net:d.ppg-d.opp,wp:d.wins/Math.max(d.wins+d.losses,1),offE:d.ppg*(d.efg_pct||.52),defE:d.opp*(1-(d.opp_efg_pct||.52)),l10:(d.last10_ppg||d.ppg)-(d.last10_opp||d.opp),pen:pen(d.roster)});const h2=f(h),a2=f(a);return{homeProb:Math.min(.97,Math.max(.03,logistic((h2.net-a2.net)*.08+(h2.wp-a2.wp)*2.5+(h2.offE-a2.offE)*.05+(h2.defE-a2.defE)*.04+(h2.l10-a2.l10)*.06+(a2.pen-h2.pen)*1.8+.28)))};}
function nbaMdlMC(h,a,N=8000){const ih=r=>(r||[]).reduce((s,p)=>p.status==="PLAYING"?s:s+(p.status==="OUT"?1:p.status==="DOUBTFUL"?.65:.3)*Math.min((p.ppg||0)*.15,4),0);const hE=((h.ppg-ih(h.roster))+(100-(a.opp-ih(a.roster))))/2+1.5,aE=((a.ppg-ih(a.roster))+(100-(h.opp-ih(h.roster))))/2;let w=0;for(let i=0;i<N;i++){const u1=Math.random(),u2=Math.random();const z=Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2),z2=Math.sqrt(-2*Math.log(u1))*Math.sin(2*Math.PI*u2);if(hE+z*11>aE+z2*11)w++;}return{homeProb:Math.min(.97,Math.max(.03,w/N)),hExp:hE.toFixed(1),aExp:aE.toFixed(1)};}
function nbaConsensus(ps){return Math.min(.97,Math.max(.03,[.18,.22,.22,.22,.16].reduce((s,w,i)=>s+ps[i]*w,0)));}

function NBAPage(){
  const [awayTeam,setAwayTeam]=useState("");
  const [homeTeam,setHomeTeam]=useState("");
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

  const fetchTeam = async (team, side) => {
    const setLoading = side==="away"?setAwayLoading:setHomeLoading;
    const setData = side==="away"?setAwayData:setHomeData;
    const setError = side==="away"?setAwayError:setHomeError;
    setLoading(true); setData(null); setError(""); setResults(null);
    try {
      const r = await fetch("/api/team", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({team, sport:"nba"})});
      const d = await r.json();
      if(!r.ok) throw new Error(d.error||"Error "+r.status);
      setData(d);
    } catch(e) { setError(e.message); }
    setLoading(false);
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
      const elo=nbaMdlElo(homeData,awayData),rap=nbaMdlRaptor(homeData,awayData),ff=nbaMdlFF(homeData,awayData),ml=nbaMdlML(homeData,awayData),mc=nbaMdlMC(homeData,awayData);
      setResults({elo,rap,ff,ml,mc,cons:nbaConsensus([elo.homeProb,rap.homeProb,ff.homeProb,ml.homeProb,mc.homeProb])});
      setTab("results"); setAnalyzing(false);
    },50);
  };

  const inp={width:"100%",padding:"10px 12px",background:C.black,border:"1.5px solid "+C.border,borderRadius:8,color:C.white,fontSize:13,outline:"none",fontFamily:"'Barlow',sans-serif"};
  const bothLoaded=awayData&&homeData;
  const awayAbbr=NBA_ABBR[awayTeam]||"AWY";
  const homeAbbr=NBA_ABBR[homeTeam]||"HME";

  return <div style={{display:"flex",flexDirection:"column",gap:14}}>

    {/* Step 1: Away Team */}
    <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,overflow:"hidden"}}>
      <SectionHeader label="Step 1 - Select Away Team" accent={C.teal} right={awayData&&<Pill label={awayAbbr+" LOADED"} color={C.teal}/>}/>
      <div style={{padding:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,alignItems:"flex-end"}}>
          <div>
            <div style={{fontSize:10,color:C.teal,fontFamily:"'Barlow Condensed'",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>Away Team</div>
            <select style={{...inp,cursor:"pointer"}} value={awayTeam} onChange={e=>{setAwayTeam(e.target.value);setAwayData(null);setResults(null);}}>
              <option value="">Select away team...</option>{NBA_TEAMS.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button className="hov-btn" onClick={()=>fetchTeam(awayTeam,"away")} disabled={!awayTeam||awayLoading} style={{padding:"10px 20px",background:awayTeam&&!awayLoading?"linear-gradient(90deg,"+C.tealD+","+C.teal+")":C.dim,border:"none",borderRadius:8,cursor:awayTeam&&!awayLoading?"pointer":"not-allowed",fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:14,letterSpacing:1.5,color:awayTeam&&!awayLoading?C.black:C.muted,textTransform:"uppercase",whiteSpace:"nowrap"}}>
            {awayLoading?<span className="pulse">Loading...</span>:"Load Roster"}
          </button>
        </div>
        {awayError&&<div style={{marginTop:8,padding:"8px 12px",background:"#2a0f0f",border:"1px solid #5a2020",borderRadius:6,fontSize:11,color:"#f87171"}}>{awayError}</div>}
      </div>
      {(awayLoading||awayData)&&<div style={{padding:"0 14px 14px"}}>
        <RosterPanel teamName={awayTeam} abbr={awayAbbr} teamData={awayData} onCycle={n=>cyclePlayer("away",n)} sport="nba" accent={C.teal} loading={awayLoading}/>
      </div>}
    </div>

    {/* Step 2: Home Team */}
    <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,overflow:"hidden"}}>
      <SectionHeader label="Step 2 - Select Home Team" accent={C.copper} right={homeData&&<Pill label={homeAbbr+" LOADED"} color={C.copper}/>}/>
      <div style={{padding:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:10,alignItems:"flex-end"}}>
          <div>
            <div style={{fontSize:10,color:C.copper,fontFamily:"'Barlow Condensed'",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>Home Team</div>
            <select style={{...inp,cursor:"pointer"}} value={homeTeam} onChange={e=>{setHomeTeam(e.target.value);setHomeData(null);setResults(null);}}>
              <option value="">Select home team...</option>{NBA_TEAMS.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button className="hov-btn" onClick={()=>fetchTeam(homeTeam,"home")} disabled={!homeTeam||homeLoading} style={{padding:"10px 20px",background:homeTeam&&!homeLoading?"linear-gradient(90deg,"+C.copper+","+C.copperL+")":C.dim,border:"none",borderRadius:8,cursor:homeTeam&&!homeLoading?"pointer":"not-allowed",fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:14,letterSpacing:1.5,color:homeTeam&&!homeLoading?C.black:C.muted,textTransform:"uppercase",whiteSpace:"nowrap"}}>
            {homeLoading?<span className="pulse">Loading...</span>:"Load Roster"}
          </button>
        </div>
        {homeError&&<div style={{marginTop:8,padding:"8px 12px",background:"#2a0f0f",border:"1px solid #5a2020",borderRadius:6,fontSize:11,color:"#f87171"}}>{homeError}</div>}
      </div>
      {(homeLoading||homeData)&&<div style={{padding:"0 14px 14px"}}>
        <RosterPanel teamName={homeTeam} abbr={homeAbbr} teamData={homeData} onCycle={n=>cyclePlayer("home",n)} sport="nba" accent={C.copper} loading={homeLoading}/>
      </div>}
    </div>

    {/* Step 3: Odds + Analyze */}
    {bothLoaded&&<div className="fade-in" style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,overflow:"hidden"}}>
      <SectionHeader label="Step 3 - Set Odds & Analyze"/>
      <div style={{padding:14}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div><div style={{fontSize:10,color:C.muted,letterSpacing:1,marginBottom:5,textTransform:"uppercase"}}>Away Moneyline ({awayAbbr})</div><input style={inp} placeholder="+130" value={awayOdds} onChange={e=>setAwayOdds(e.target.value)}/></div>
          <div><div style={{fontSize:10,color:C.muted,letterSpacing:1,marginBottom:5,textTransform:"uppercase"}}>Home Moneyline ({homeAbbr})</div><input style={inp} placeholder="-150" value={homeOdds} onChange={e=>setHomeOdds(e.target.value)}/></div>
        </div>
        <button className="hov-btn" onClick={runModels} disabled={analyzing} style={{width:"100%",padding:"13px 0",background:analyzing?C.dim:"linear-gradient(90deg,"+C.copper+","+C.copperL+")",border:"none",borderRadius:9,cursor:analyzing?"not-allowed":"pointer",fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:17,letterSpacing:2,color:analyzing?C.muted:C.black,textTransform:"uppercase"}}>
          {analyzing?<span className="pulse">Running Models...</span>:"Run Analysis"}
        </button>
      </div>
    </div>}

    {results&&<NBAResults results={results} awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayOdds={awayOdds} homeOdds={homeOdds} tab={tab} setTab={setTab} onRecalc={runModels}/>}
  </div>;
}

function NBAResults({results,awayTeam,homeTeam,awayAbbr,homeAbbr,awayOdds,homeOdds,tab,setTab,onRecalc}){
  const {elo,rap,ff,ml,mc,cons}=results;const cH=cons,aw=1-cH;
  const hI=oddsToImplied(homeOdds),aI=oddsToImplied(awayOdds);
  const hE=hI!==null?((cH-hI)*100).toFixed(1):null,aE=aI!==null?((aw-aI)*100).toFixed(1):null;
  const hEV=homeOdds&&hI?calcEV(cH,homeOdds):null,aEV=awayOdds&&aI?calcEV(aw,awayOdds):null;
  const sig=v=>v>=5?"STRONG BET":v>=2?"LEAN BET":v>=0?"SLIGHT EDGE":"NO VALUE";
  return <div className="fade-in">
    <div style={{display:"flex",gap:4,marginBottom:14,background:C.dark,borderRadius:8,padding:4,border:"1px solid "+C.border}}>{[["results","Results"],["method","Methodology"]].map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"8px 0",borderRadius:6,border:"none",cursor:"pointer",background:tab===k?C.copper+"33":"transparent",color:tab===k?C.copper:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1,textTransform:"uppercase",borderBottom:tab===k?"2px solid "+C.copper:"2px solid transparent"}}>{l}</button>)}</div>
    {tab==="results"&&<>
      <div style={{background:C.card,border:"1.5px solid "+C.copper+"44",borderRadius:12,padding:20,marginBottom:14}}>
        <SectionHeader label="Consensus - 5 Model Weighted Average"/>
        <div style={{height:8}}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:16,alignItems:"center",marginBottom:16}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}><Badge abbr={awayAbbr} size={52}/><div style={{textAlign:"center"}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:42,lineHeight:1,color:aw>.55?C.teal:aw>.45?C.copper:C.white}}>{(aw*100).toFixed(1)}%</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>{awayTeam}</div></div><OddsPill prob={aw}/></div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:14,color:C.muted,letterSpacing:2}}>VS</div>{(aE||hE)&&<div style={{padding:"8px 12px",background:C.black,border:"1px solid "+C.border,borderRadius:8}}><div style={{fontFamily:"'Barlow Condensed'",fontSize:11,fontWeight:800,color:C.muted,letterSpacing:1}}>{sig(parseFloat(aw>cH?aE:hE))}</div></div>}</div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}><Badge abbr={homeAbbr} size={52}/><div style={{textAlign:"center"}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:42,lineHeight:1,color:cH>.55?C.teal:cH>.45?C.copper:C.white}}>{(cH*100).toFixed(1)}%</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>{homeTeam}</div></div><OddsPill prob={cH}/></div>
        </div>
        <WinBar awayProb={aw} awayAbbr={awayAbbr} homeAbbr={homeAbbr}/>
        {(aE||hE)&&<div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>{aE&&<div style={{padding:"5px 12px",borderRadius:6,background:parseFloat(aE)>=2?C.teal+"18":C.black,border:"1px solid "+(parseFloat(aE)>=2?C.teal:C.border),fontSize:11,color:parseFloat(aE)>=2?C.teal:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:700}}>{awayAbbr} Edge: {parseFloat(aE)>=0?"+":""}{aE}%{aEV?" - EV "+(parseFloat(aEV)>=0?"+":"")+aEV+"/$1":""}</div>}{hE&&<div style={{padding:"5px 12px",borderRadius:6,background:parseFloat(hE)>=2?C.teal+"18":C.black,border:"1px solid "+(parseFloat(hE)>=2?C.teal:C.border),fontSize:11,color:parseFloat(hE)>=2?C.teal:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:700}}>{homeAbbr} Edge: {parseFloat(hE)>=0?"+":""}{hE}%{hEV?" - EV "+(parseFloat(hEV)>=0?"+":"")+hEV+"/$1":""}</div>}</div>}
        <button className="hov-btn" onClick={onRecalc} style={{marginTop:12,width:"100%",padding:"9px 0",background:"transparent",border:"1px solid "+C.border,borderRadius:7,cursor:"pointer",fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1.5,color:C.muted,textTransform:"uppercase"}}>Recalculate with Updated Injuries</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <ModelCard icon="ELO" name="Elo Rating" desc="Win-rate Elo + recent form + home court" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-elo.homeProb} detail={"Away Elo: "+elo.aElo+"  Home Elo: "+elo.hElo+"  +100 HCA"}/>
        <ModelCard icon="PER" name="RAPTOR Impact" desc="Player PER weighted by availability" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-rap.homeProb} detail={"Away adj PER: "+rap.aVal+"  Home: "+rap.hVal}/>
        <ModelCard icon="4F" name="Four Factors" desc="eFG%, TOV%, OREB%, FTR + net rating" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-ff.homeProb} detail={"Away FF: "+ff.aFF+"  Home: "+ff.hFF}/>
        <ModelCard icon="ML" name="ML / BPI" desc="7-feature logistic regression" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-ml.homeProb} detail="Net rtg  Win%  Eff  L10  Injury penalty"/>
      </div>
      <ModelCard icon="MC" name="Monte Carlo Simulation" desc="8,000 simulated games - Normal distribution" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-mc.homeProb} detail={"Proj: "+awayTeam.split(" ").at(-1)+" "+mc.aExp+"  "+homeTeam.split(" ").at(-1)+" "+mc.hExp+" pts"}/>
      <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:14,marginTop:10}}>
        <div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1.5,color:C.copper,textTransform:"uppercase",marginBottom:10}}>Model Agreement</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
          {[{l:"Elo",p:1-elo.homeProb},{l:"RAPTOR",p:1-rap.homeProb},{l:"4 Factors",p:1-ff.homeProb},{l:"ML/BPI",p:1-ml.homeProb},{l:"Monte Carlo",p:1-mc.homeProb}].map(m=>{const af=m.p>.5;const dp=af?m.p:1-m.p;const da=af?awayAbbr:homeAbbr;return <div key={m.l} style={{textAlign:"center",background:C.black,borderRadius:8,padding:"10px 6px",border:"1px solid "+C.teal+"44"}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:22,color:C.teal}}>{(dp*100).toFixed(0)}%</div><div style={{fontSize:10,color:C.teal,fontWeight:700,marginBottom:2}}>{da}</div><div style={{fontSize:9,color:C.dim,textTransform:"uppercase",letterSpacing:.5}}>{m.l}</div></div>;})}
        </div>
      </div>
    </>}
    {tab==="method"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{[["ELO","Elo Rating (18%)","Win rate to Elo (1500 base). L10 adjusts dynamically. +100 home court."],["PER","RAPTOR / Player Impact (22%)","PER x availability: OUT=0%, DOUBTFUL=25%, QUESTIONABLE=65%, PLAYING=100%."],["4F","Net Rating / Four Factors (22%)","eFG%(40%) + TOV(25%) + OREB(20%) + FTR(15%) with net rating."],["ML","ML / BPI-Style (22%)","Logistic regression: net rating, win%, efficiency, L10, injury penalty, HCA."],["MC","Monte Carlo (16%)","8,000 simulations. Normal distribution scoring adjusted for injuries."],["W","Consensus","Elo x18% + RAPTOR x22% + FF x22% + ML x22% + MC x16%."]].map(([icon,n,d])=><div key={n} style={{background:C.card,border:"1px solid "+C.border,borderRadius:10,padding:16}}><div style={{width:32,height:32,borderRadius:6,background:C.copper+"22",border:"1px solid "+C.copper+"44",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontFamily:"'Barlow Condensed'",fontWeight:900,color:C.copper,marginBottom:8}}>{icon}</div><div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,color:C.copper,marginBottom:6}}>{n}</div><div style={{fontSize:11,color:C.muted,lineHeight:1.7}}>{d}</div></div>)}</div>}
  </div>;
}

const NHL_TEAMS=["Anaheim Ducks","Boston Bruins","Buffalo Sabres","Calgary Flames","Carolina Hurricanes","Chicago Blackhawks","Colorado Avalanche","Columbus Blue Jackets","Dallas Stars","Detroit Red Wings","Edmonton Oilers","Florida Panthers","Los Angeles Kings","Minnesota Wild","Montreal Canadiens","Nashville Predators","New Jersey Devils","New York Islanders","New York Rangers","Ottawa Senators","Philadelphia Flyers","Pittsburgh Penguins","San Jose Sharks","Seattle Kraken","St. Louis Blues","Tampa Bay Lightning","Toronto Maple Leafs","Utah Hockey Club","Vancouver Canucks","Vegas Golden Knights","Washington Capitals","Winnipeg Jets"];
const NHL_ABBR={"Anaheim Ducks":"ANA","Boston Bruins":"BOS","Buffalo Sabres":"BUF","Calgary Flames":"CGY","Carolina Hurricanes":"CAR","Chicago Blackhawks":"CHI","Colorado Avalanche":"COL","Columbus Blue Jackets":"CBJ","Dallas Stars":"DAL","Detroit Red Wings":"DET","Edmonton Oilers":"EDM","Florida Panthers":"FLA","Los Angeles Kings":"LAK","Minnesota Wild":"MIN","Montreal Canadiens":"MTL","Nashville Predators":"NSH","New Jersey Devils":"NJD","New York Islanders":"NYI","New York Rangers":"NYR","Ottawa Senators":"OTT","Philadelphia Flyers":"PHI","Pittsburgh Penguins":"PIT","San Jose Sharks":"SJS","Seattle Kraken":"SEA","St. Louis Blues":"STL","Tampa Bay Lightning":"TBL","Toronto Maple Leafs":"TOR","Utah Hockey Club":"UTA","Vancouver Canucks":"VAN","Vegas Golden Knights":"VGK","Washington Capitals":"WSH","Winnipeg Jets":"WPG"};

function nhlMdlElo(h,a){const hp=h.points/Math.max(h.wins+h.losses+h.otl,1)/2,ap=a.points/Math.max(a.wins+a.losses+a.otl,1)/2;const hE=1500+400*Math.log10(Math.max(hp,.01)/Math.max(1-hp,.01)),aE=1500+400*Math.log10(Math.max(ap,.01)/Math.max(1-ap,.01));const h10=(h.last10_gf||h.gf_pg)-(h.last10_ga||h.ga_pg),a10=(a.last10_gf||a.gf_pg)-(a.last10_ga||a.ga_pg);const p=1/(1+Math.pow(10,(aE+a10*40-((hE+h10*40)+60))/400));return{homeProb:Math.min(.97,Math.max(.03,p)),hElo:Math.round(hE+h10*40),aElo:Math.round(aE+a10*40)};}
function nhlMdlGoalie(h,a){const gP=g=>(g&&g.status&&g.status!=="PLAYING")?((g.status==="OUT"?1:g.status==="DOUBTFUL"?.7:.35)*(.920-(g.save_pct||.905))):0;const hSv=(h.goalie?.save_pct||.905)-gP(h.goalie),aSv=(a.goalie?.save_pct||.905)-gP(a.goalie);const hGA=(h.shots_against_pg||30)*(1-hSv),aGA=(a.shots_against_pg||30)*(1-aSv);return{homeProb:Math.min(.97,Math.max(.03,logistic((aGA-hGA)*1.2+.05))),hSv:hSv.toFixed(3),aSv:aSv.toFixed(3),hGA:hGA.toFixed(2),aGA:aGA.toFixed(2)};}
function nhlMdlSpecialTeams(h,a){const hST=(h.pp_pct||20)/100*.6+(h.pk_pct||80)/100*.4,aST=(a.pp_pct||20)/100*.6+(a.pk_pct||80)/100*.4;const iP=r=>(r||[]).reduce((s,p)=>p.status==="PLAYING"?s:s+(p.status==="OUT"?1:p.status==="DOUBTFUL"?.6:.3)*(p.role==="STAR"?.06:p.role==="KEY"?.03:.01),0);return{homeProb:Math.min(.97,Math.max(.03,logistic((hST-aST)*3+(iP(a.roster)-iP(h.roster))+.05))),hST:(hST*100).toFixed(1),aST:(aST*100).toFixed(1)};}
function nhlMdlCorsi(h,a){const hCF=h.shots_pg/(h.shots_pg+a.shots_against_pg||60),aCF=a.shots_pg/(a.shots_pg+h.shots_against_pg||60);return{homeProb:Math.min(.97,Math.max(.03,logistic((hCF-aCF)*3+(h.gf_pg-h.ga_pg-(a.gf_pg-a.ga_pg))*.3+.05))),hCF:(hCF*100).toFixed(1),aCF:(aCF*100).toFixed(1)};}
function nhlMdlMC(h,a,N=8000){const gA=d=>d.goalie?.status==="OUT"?.4:d.goalie?.status==="DOUBTFUL"?.2:d.goalie?.status==="QUESTIONABLE"?.1:0;const iA=r=>(r||[]).reduce((s,p)=>p.status==="PLAYING"?s:s+(p.status==="OUT"?1:p.status==="DOUBTFUL"?.6:.3)*(p.role==="STAR"?.08:p.role==="KEY"?.04:.01),0);const hExp=h.gf_pg-gA(h)-iA(h.roster)+.1,aExp=a.gf_pg-gA(a)-iA(a.roster);let hw=0;for(let i=0;i<N;i++){const hG=Math.max(0,hExp+Math.sqrt(Math.max(hExp,.5))*(Math.sqrt(-2*Math.log(Math.random()))*Math.cos(2*Math.PI*Math.random())));const aG=Math.max(0,aExp+Math.sqrt(Math.max(aExp,.5))*(Math.sqrt(-2*Math.log(Math.random()))*Math.cos(2*Math.PI*Math.random())));hw+=hG>aG?1:hG===aG?.5:0;}return{homeProb:Math.min(.97,Math.max(.03,hw/N)),hExp:hExp.toFixed(2),aExp:aExp.toFixed(2)};}
function nhlConsensus(ps){return Math.min(.97,Math.max(.03,[.20,.28,.20,.17,.15].reduce((s,w,i)=>s+ps[i]*w,0)));}

function NHLPage(){
  const [awayTeam,setAwayTeam]=useState("");const [homeTeam,setHomeTeam]=useState("");const [awayOdds,setAwayOdds]=useState("");const [homeOdds,setHomeOdds]=useState("");const [awayData,setAwayData]=useState(null);const [homeData,setHomeData]=useState(null);const [awayLoading,setAwayLoading]=useState(false);const [homeLoading,setHomeLoading]=useState(false);const [awayError,setAwayError]=useState("");const [homeError,setHomeError]=useState("");const [results,setResults]=useState(null);const [tab,setTab]=useState("results");const [analyzing,setAnalyzing]=useState(false);
  const fetchTeam=async(team,side)=>{const setL=side==="away"?setAwayLoading:setHomeLoading;const setD=side==="away"?setAwayData:setHomeData;const setE=side==="away"?setAwayError:setHomeError;setL(true);setD(null);setE("");setResults(null);try{const r=await fetch("/api/team",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({team,sport:"nhl"})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Error "+r.status);setD(d);}catch(e){setE(e.message);}setL(false);};
  const cyclePlayer=(side,name)=>{const [g,s]=side==="home"?[homeData,setHomeData]:[awayData,setAwayData];if(!g)return;if(name==="__goalie__"){s({...g,goalie:{...g.goalie,status:STATUS_CYCLE[(STATUS_CYCLE.indexOf(g.goalie.status||"PLAYING")+1)%4]}});}else{s({...g,roster:g.roster.map(p=>p.name!==name?p:{...p,status:STATUS_CYCLE[(STATUS_CYCLE.indexOf(p.status)+1)%4]})});}};
  const runModels=()=>{if(!homeData||!awayData)return;setAnalyzing(true);setTimeout(()=>{const elo=nhlMdlElo(homeData,awayData),gl=nhlMdlGoalie(homeData,awayData),st=nhlMdlSpecialTeams(homeData,awayData),cs=nhlMdlCorsi(homeData,awayData),mc=nhlMdlMC(homeData,awayData);setResults({elo,gl,st,cs,mc,cons:nhlConsensus([elo.homeProb,gl.homeProb,st.homeProb,cs.homeProb,mc.homeProb])});setTab("results");setAnalyzing(false);},50);};
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
  const {elo,gl,st,cs,mc,cons}=results;const cH=cons,aw=1-cH;
  const hI=oddsToImplied(homeOdds),aI=oddsToImplied(awayOdds);
  const hE=hI!==null?((cH-hI)*100).toFixed(1):null,aE=aI!==null?((aw-aI)*100).toFixed(1):null;
  const hEV=homeOdds&&hI?calcEV(cH,homeOdds):null,aEV=awayOdds&&aI?calcEV(aw,awayOdds):null;
  return <div className="fade-in">
    <div style={{display:"flex",gap:4,marginBottom:14,background:C.dark,borderRadius:8,padding:4,border:"1px solid "+C.border}}>{[["results","Results"],["method","Methodology"]].map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"8px 0",borderRadius:6,border:"none",cursor:"pointer",background:tab===k?C.ice+"22":"transparent",color:tab===k?C.ice:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1,textTransform:"uppercase",borderBottom:tab===k?"2px solid "+C.ice:"2px solid transparent"}}>{l}</button>)}</div>
    {tab==="results"&&<>
      <div style={{background:C.card,border:"1.5px solid "+C.ice+"44",borderRadius:12,padding:20,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}><div style={{width:3,height:16,borderRadius:2,background:C.ice}}/><span style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:14,letterSpacing:1.5,color:C.white,textTransform:"uppercase"}}>Consensus - 5 Hockey Models</span></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:16,alignItems:"center",marginBottom:16}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}><Badge abbr={awayAbbr} size={52} accent={C.ice}/><div style={{textAlign:"center"}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:42,lineHeight:1,color:aw>.55?C.ice:aw>.45?C.copper:C.white}}>{(aw*100).toFixed(1)}%</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>{awayTeam}</div></div><OddsPill prob={aw} accent={C.ice}/></div>
          <div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:14,color:C.muted,letterSpacing:2}}>VS</div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}><Badge abbr={homeAbbr} size={52} accent={C.ice}/><div style={{textAlign:"center"}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:42,lineHeight:1,color:cH>.55?C.ice:cH>.45?C.copper:C.white}}>{(cH*100).toFixed(1)}%</div><div style={{fontSize:11,color:C.muted,marginTop:2}}>{homeTeam}</div></div><OddsPill prob={cH} accent={C.ice}/></div>
        </div>
        <WinBar awayProb={aw} awayAbbr={awayAbbr} homeAbbr={homeAbbr} accent={C.ice}/>
        {(aE||hE)&&<div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>{aE&&<div style={{padding:"5px 12px",borderRadius:6,background:parseFloat(aE)>=2?C.ice+"18":C.black,border:"1px solid "+(parseFloat(aE)>=2?C.ice:C.border),fontSize:11,color:parseFloat(aE)>=2?C.ice:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:700}}>{awayAbbr} Edge: {parseFloat(aE)>=0?"+":""}{aE}%{aEV?" - EV "+(parseFloat(aEV)>=0?"+":"")+aEV+"/$1":""}</div>}{hE&&<div style={{padding:"5px 12px",borderRadius:6,background:parseFloat(hE)>=2?C.ice+"18":C.black,border:"1px solid "+(parseFloat(hE)>=2?C.ice:C.border),fontSize:11,color:parseFloat(hE)>=2?C.ice:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:700}}>{homeAbbr} Edge: {parseFloat(hE)>=0?"+":""}{hE}%{hEV?" - EV "+(parseFloat(hEV)>=0?"+":"")+hEV+"/$1":""}</div>}</div>}
        <button className="hov-btn" onClick={onRecalc} style={{marginTop:12,width:"100%",padding:"9px 0",background:"transparent",border:"1px solid "+C.border,borderRadius:7,cursor:"pointer",fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1.5,color:C.muted,textTransform:"uppercase"}}>Recalculate with Updated Lineup</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <ModelCard icon="ELO" name="Elo Rating" desc="Points-based Elo + recent form + home ice" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-elo.homeProb} detail={"Away Elo: "+elo.aElo+"  Home Elo: "+elo.hElo+"  +60 home ice"} accent={C.ice}/>
        <ModelCard icon="SV%" name="Goalie Model" desc="Save% differential + expected goals against" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-gl.homeProb} detail={"Away SV%: "+gl.aSv+" xGA: "+gl.aGA+"  Home SV%: "+gl.hSv+" xGA: "+gl.hGA} accent={C.ice}/>
        <ModelCard icon="PP" name="Special Teams" desc="Power play % + penalty kill % combined" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-st.homeProb} detail={"Away ST: "+st.aST+"  Home ST: "+st.hST} accent={C.ice}/>
        <ModelCard icon="CF%" name="Shot Dominance / Corsi" desc="Shot attempt differential + goal rate" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-cs.homeProb} detail={"Away CF%: "+cs.aCF+"%  Home CF%: "+cs.hCF+"%"} accent={C.ice}/>
      </div>
      <ModelCard icon="MC" name="Monte Carlo Simulation" desc="8,000 simulated games - Poisson goal distribution" awayTeam={awayTeam} homeTeam={homeTeam} awayAbbr={awayAbbr} homeAbbr={homeAbbr} awayProb={1-mc.homeProb} detail={"Proj: "+awayTeam.split(" ").at(-1)+" "+mc.aExp+"  "+homeTeam.split(" ").at(-1)+" "+mc.hExp+" goals"} accent={C.ice}/>
      <div style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:14,marginTop:10}}>
        <div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,letterSpacing:1.5,color:C.ice,textTransform:"uppercase",marginBottom:10}}>Model Agreement</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
          {[{l:"Elo",p:1-elo.homeProb},{l:"Goalie",p:1-gl.homeProb},{l:"Spec Teams",p:1-st.homeProb},{l:"Corsi",p:1-cs.homeProb},{l:"Monte Carlo",p:1-mc.homeProb}].map(m=>{const af=m.p>.5;const dp=af?m.p:1-m.p;const da=af?awayAbbr:homeAbbr;return <div key={m.l} style={{textAlign:"center",background:C.black,borderRadius:8,padding:"10px 6px",border:"1px solid "+C.ice+"44"}}><div style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:22,color:C.ice}}>{(dp*100).toFixed(0)}%</div><div style={{fontSize:10,color:C.ice,fontWeight:700,marginBottom:2}}>{da}</div><div style={{fontSize:9,color:C.dim,textTransform:"uppercase",letterSpacing:.5}}>{m.l}</div></div>;})}
        </div>
      </div>
    </>}
    {tab==="method"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{[["ELO","Elo Rating (20%)","Points-based Elo (1500 base). L10 goal differential adjusts. +60 home ice."],["SV%","Goalie Model (28%)","Save% x shots against = xGA. Goalie injuries heavily penalized."],["PP","Special Teams (20%)","PP% (60%) + PK% (40%). Special teams drive scoring opportunities."],["CF%","Shot Dominance / Corsi (17%)","Shot attempt differential as proxy for zone time and pressure."],["MC","Monte Carlo (15%)","8,000 simulations with Poisson goal distributions. Adjusts for injuries."],["W","Consensus","Elo x20% + Goalie x28% + SpecTeams x20% + Corsi x17% + MC x15%."]].map(([icon,n,d])=><div key={n} style={{background:C.card,border:"1px solid "+C.border,borderRadius:10,padding:16}}><div style={{width:32,height:32,borderRadius:6,background:C.ice+"22",border:"1px solid "+C.ice+"44",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontFamily:"'Barlow Condensed'",fontWeight:900,color:C.ice,marginBottom:8}}>{icon}</div><div style={{fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:13,color:C.ice,marginBottom:6}}>{n}</div><div style={{fontSize:11,color:C.muted,lineHeight:1.7}}>{d}</div></div>)}</div>}
  </div>;
}

export default function App(){
  const [sport,setSport]=useState("nba");
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
            {[{id:"nba",label:"NBA",accent:C.teal},{id:"nhl",label:"NHL",accent:C.ice}].map(item=><button key={item.id} onClick={()=>setSport(item.id)} style={{padding:"7px 20px",borderRadius:6,border:"none",cursor:"pointer",background:sport===item.id?"linear-gradient(135deg,"+item.accent+"22,"+item.accent+"11)":"transparent",color:sport===item.id?item.accent:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:800,fontSize:14,letterSpacing:1,borderBottom:sport===item.id?"2px solid "+item.accent:"2px solid transparent",transition:"all .2s ease"}}>{item.label}</button>)}
          </div>
          <div style={{marginLeft:"auto",display:"flex",gap:6,alignItems:"center"}}>
            <div style={{padding:"5px 12px",borderRadius:20,background:"linear-gradient(90deg,"+C.copper+","+C.copperL+")",fontSize:11,fontWeight:700,color:C.black,fontFamily:"'Barlow Condensed'",letterSpacing:1}}>2025-26 LIVE</div>
            <div style={{padding:"5px 12px",borderRadius:20,background:C.card,border:"1px solid "+C.border,fontSize:11,color:C.muted,fontFamily:"'Barlow Condensed'",fontWeight:700}}>5 MODELS</div>
          </div>
        </div>
      </div>
    </div>
    <div style={{background:sport==="nba"?"linear-gradient(90deg,"+C.teal+"18,transparent)":"linear-gradient(90deg,"+C.ice+"18,transparent)",borderBottom:"1px solid "+C.border,padding:"8px 16px"}}>
      <div style={{maxWidth:1040,margin:"0 auto",display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontFamily:"'Barlow Condensed'",fontWeight:900,fontSize:18,color:sport==="nba"?C.teal:C.ice,letterSpacing:2}}>{sport==="nba"?"NBA MONEYLINE ANALYZER":"NHL MONEYLINE ANALYZER"}</span>
        <span style={{fontSize:11,color:C.muted}}>{sport==="nba"?"5-model system - Elo - RAPTOR - Four Factors - ML/BPI - Monte Carlo":"5-model system - Elo - Goalie - Special Teams - Corsi - Monte Carlo"}</span>
      </div>
    </div>
    <div style={{maxWidth:1040,margin:"0 auto",padding:"16px"}}>
      {sport==="nba"&&<NBAPage/>}
      {sport==="nhl"&&<NHLPage/>}
      <div style={{fontSize:10,color:C.dim,textAlign:"center",padding:"16px 0 8px"}}>For informational and entertainment purposes only - Not financial advice - Gamble responsibly</div>
    </div>
  </div>;
}
