import { useState } from "react";

function oddsToImplied(odds) {
  if (!odds || odds === "-" || odds === "+") return null;
  const o = parseInt(odds);
  if (isNaN(o) || o === 0) return null;
  return o > 0 ? 100 / (o + 100) : Math.abs(o) / (Math.abs(o) + 100);
}
function probToAmericanOdds(prob) {
  prob = Math.max(0.01, Math.min(0.99, prob));
  return prob >= 0.5 ? `-${Math.round((prob/(1-prob))*100)}` : `+${Math.round(((1-prob)/prob)*100)}`;
}
function calcEV(prob, odds) {
  const o = parseInt(odds);
  if (isNaN(o)) return null;
  const payout = o > 0 ? o/100 : 100/Math.abs(o);
  return (prob*payout-(1-prob)).toFixed(3);
}
function logistic(x) { return 1/(1+Math.exp(-x)); }

const NBA_TEAMS = [
  "Atlanta Hawks","Boston Celtics","Brooklyn Nets","Charlotte Hornets","Chicago Bulls",
  "Cleveland Cavaliers","Dallas Mavericks","Denver Nuggets","Detroit Pistons",
  "Golden State Warriors","Houston Rockets","Indiana Pacers","LA Clippers",
  "Los Angeles Lakers","Memphis Grizzlies","Miami Heat","Milwaukee Bucks",
  "Minnesota Timberwolves","New Orleans Pelicans","New York Knicks",
  "Oklahoma City Thunder","Orlando Magic","Philadelphia 76ers","Phoenix Suns",
  "Portland Trail Blazers","Sacramento Kings","San Antonio Spurs","Toronto Raptors",
  "Utah Jazz","Washington Wizards"
];
const ABBR = {
  "Atlanta Hawks":"ATL","Boston Celtics":"BOS","Brooklyn Nets":"BKN","Charlotte Hornets":"CHA",
  "Chicago Bulls":"CHI","Cleveland Cavaliers":"CLE","Dallas Mavericks":"DAL","Denver Nuggets":"DEN",
  "Detroit Pistons":"DET","Golden State Warriors":"GSW","Houston Rockets":"HOU","Indiana Pacers":"IND",
  "LA Clippers":"LAC","Los Angeles Lakers":"LAL","Memphis Grizzlies":"MEM","Miami Heat":"MIA",
  "Milwaukee Bucks":"MIL","Minnesota Timberwolves":"MIN","New Orleans Pelicans":"NOP","New York Knicks":"NYK",
  "Oklahoma City Thunder":"OKC","Orlando Magic":"ORL","Philadelphia 76ers":"PHI","Phoenix Suns":"PHX",
  "Portland Trail Blazers":"POR","Sacramento Kings":"SAC","San Antonio Spurs":"SAS","Toronto Raptors":"TOR",
  "Utah Jazz":"UTA","Washington Wizards":"WAS"
};

async function fetchMatchup(homeTeam, awayTeam) {
  const resp = await fetch("/api/matchup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ homeTeam, awayTeam })
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || `Error ${resp.status}`);
  if (!data.home || !data.away) throw new Error("Invalid response from server");
  return data;
}

// 5 Models
function modelElo(hd,ad){const hw=hd.wins/Math.max(hd.wins+hd.losses,1),aw=ad.wins/Math.max(ad.wins+ad.losses,1);const hE=1500+400*Math.log10(Math.max(hw,0.01)/Math.max(1-hw,0.01)),aE=1500+400*Math.log10(Math.max(aw,0.01)/Math.max(1-aw,0.01));const h10=(hd.last10_ppg||hd.ppg)-(hd.last10_opp||hd.opp),a10=(ad.last10_ppg||ad.ppg)-(ad.last10_opp||ad.opp);const p=1/(1+Math.pow(10,(aE+a10*3-((hE+h10*3)+100))/400));return{homeProb:Math.min(0.97,Math.max(0.03,p)),hElo:Math.round(hE+h10*3),aElo:Math.round(aE+a10*3)};}
function modelRaptor(hd,ad){const val=roster=>(roster||[]).reduce((s,p)=>{const st=p.status;return s+(p.per||15)*(st==="PLAYING"?1:st==="OUT"?0:st==="DOUBTFUL"?0.25:0.65);},0);const hV=val(hd.roster),aV=val(ad.roster);return{homeProb:Math.min(0.97,Math.max(0.03,hV/Math.max(hV+aV,1)+0.035)),hVal:hV.toFixed(1),aVal:aV.toFixed(1)};}
function modelFourFactors(hd,ad){const hit=roster=>(roster||[]).reduce((s,p)=>{if(p.status==="PLAYING")return s;const sw=p.status==="OUT"?1:p.status==="DOUBTFUL"?0.75:0.35;return s+sw*Math.max(p.role==="STAR"?0.08:p.role==="KEY"?0.04:0.015,Math.min((p.ppg||0)*0.004,0.06));},0);const ff=d=>(d.efg_pct||0.52)*0.40+(1-(d.tov_rate||14)/30)*0.25+(d.oreb_pct||0.25)*0.20+Math.min(d.ftr||0.22,0.40)*0.15;const netDiff=(hd.ppg-hd.opp)-(ad.ppg-ad.opp),ffDiff=ff(hd)-ff(ad);const hH=hit(hd.roster),aH=hit(ad.roster);return{homeProb:Math.min(0.97,Math.max(0.03,logistic(netDiff*0.065+ffDiff*4)+0.035-hH+aH)),hFF:ff(hd).toFixed(3),aFF:ff(ad).toFixed(3),hHit:hH,aHit:aH};}
function modelML(hd,ad){const pen=roster=>(roster||[]).reduce((s,p)=>{if(p.status==="PLAYING")return s;return s+(p.status==="OUT"?1:p.status==="DOUBTFUL"?0.6:0.3)*(p.per||12)*0.01;},0);const f=(d)=>({net:d.ppg-d.opp,wp:d.wins/Math.max(d.wins+d.losses,1),offE:d.ppg*(d.efg_pct||0.52),defE:d.opp*(1-(d.opp_efg_pct||0.52)),l10:(d.last10_ppg||d.ppg)-(d.last10_opp||d.opp),pen:pen(d.roster)});const h=f(hd),a=f(ad);const score=(h.net-a.net)*0.08+(h.wp-a.wp)*2.5+(h.offE-a.offE)*0.05+(h.defE-a.defE)*0.04+(h.l10-a.l10)*0.06+(a.pen-h.pen)*1.8+0.28;return{homeProb:Math.min(0.97,Math.max(0.03,logistic(score)))};}
function modelMonteCarlo(hd,ad,N=10000){const ih=roster=>(roster||[]).reduce((s,p)=>{if(p.status==="PLAYING")return s;return s+(p.status==="OUT"?1:p.status==="DOUBTFUL"?0.65:0.3)*Math.min((p.ppg||0)*0.15,4);},0);const hE=((hd.ppg-ih(hd.roster))+(100-(ad.opp-ih(ad.roster))))/2+1.5,aE=((ad.ppg-ih(ad.roster))+(100-(hd.opp-ih(hd.roster))))/2;let w=0;for(let i=0;i<N;i++){const u1=Math.random(),u2=Math.random();const z1=Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2),z2=Math.sqrt(-2*Math.log(u1))*Math.sin(2*Math.PI*u2);if(hE+z1*11>aE+z2*11)w++;}return{homeProb:Math.min(0.97,Math.max(0.03,w/N)),hExp:hE.toFixed(1),aExp:aE.toFixed(1)};}
function modelConsensus(ps){return Math.min(0.97,Math.max(0.03,[0.18,0.22,0.22,0.22,0.16].reduce((s,w,i)=>s+ps[i]*w,0)));}

// UI
const STATUS_COLORS={"PLAYING":"#00e87a","QUESTIONABLE":"#e8d87a","DOUBTFUL":"#e8b87a","OUT":"#e87a7a"};
const STATUS_CYCLE=["PLAYING","QUESTIONABLE","DOUBTFUL","OUT"];

function TBadge({name,small}){const ab=ABBR[name]||name?.slice(0,3).toUpperCase();return <div style={{width:small?32:48,height:small?32:48,borderRadius:"50%",background:"linear-gradient(135deg,#1a3a5c,#0f2340)",border:"2px solid #c8a84b",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue',cursive",fontSize:small?9:12,color:"#c8a84b",letterSpacing:1,boxShadow:"0 2px 12px rgba(200,168,75,0.25)"}}>{ab}</div>;}
function Pill({label,color,large}){return <span style={{display:"inline-block",padding:large?"6px 14px":"3px 9px",borderRadius:20,fontSize:large?12:10,fontWeight:700,background:color+"22",border:`1px solid ${color}`,color,letterSpacing:0.5}}>{label}</span>;}

function RosterPanel({teamName, teamData, onCyclePlayer}) {
  if (!teamData) return null;
  return (
    <div style={{marginTop:10,background:"#050c18",border:"1px solid #1a2d4e",borderRadius:8,padding:10}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        <TBadge name={teamName} small/>
        <div>
          <div style={{fontSize:11,fontWeight:700,color:"#c8a84b",fontFamily:"'Bebas Neue',cursive",letterSpacing:1}}>
            ROSTER — TAP TO SET INJURY STATUS
          </div>
          <div style={{fontSize:10,color:"#3a5a8a"}}>
            {teamData.wins}W–{teamData.losses}L · {teamData.ppg} PPG · {teamData.opp} OPP
          </div>
        </div>
      </div>
      {teamData.roster.map(p => {
        const sc = STATUS_COLORS[p.status];
        return (
          <div key={p.name} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:"1px solid #0a1628"}}>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:600,color:"#dde8ff"}}>{p.name}</div>
              <div style={{fontSize:10,color:"#3a5a8a"}}>
                {p.ppg} PPG ·{" "}
                <span style={{color:p.role==="STAR"?"#e8b87a":p.role==="KEY"?"#4a9aff":"#8899bb"}}>{p.role}</span>
              </div>
            </div>
            <button onClick={()=>onCyclePlayer(p.name)} style={{padding:"4px 10px",borderRadius:12,fontSize:10,fontWeight:700,cursor:"pointer",background:sc+"22",border:`1px solid ${sc}`,color:sc,whiteSpace:"nowrap",minWidth:96,textAlign:"center"}}>
              {p.status}
            </button>
          </div>
        );
      })}
      <div style={{marginTop:6,fontSize:10,color:"#2a4a6a",textAlign:"center"}}>
        PLAYING → QUESTIONABLE → DOUBTFUL → OUT
      </div>
    </div>
  );
}

function MCard({icon,name,desc,homeTeam,awayTeam,homeProb,detail}){const ap=1-homeProb,hF=homeProb>=0.5;return <div style={{background:"linear-gradient(135deg,#0c1c32,#091525)",border:"1px solid #1a2d4e",borderRadius:10,padding:16}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}><span style={{fontSize:20}}>{icon}</span><div><div style={{fontFamily:"'Bebas Neue',cursive",fontSize:13,letterSpacing:1.5,color:"#c8a84b"}}>{name}</div><div style={{fontSize:10,color:"#3a5a8a"}}>{desc}</div></div></div><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><span style={{fontSize:10,color:"#8899bb",width:32,textAlign:"right"}}>{ABBR[homeTeam]}</span><div style={{flex:1,height:20,background:"#0a1628",borderRadius:10,overflow:"hidden",position:"relative"}}><div style={{position:"absolute",left:0,top:0,height:"100%",width:`${homeProb*100}%`,background:hF?"linear-gradient(90deg,#00a855,#00e87a)":"linear-gradient(90deg,#c84a4a,#e87a7a)",transition:"width 0.6s ease"}}/><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 8px"}}><span style={{fontSize:11,fontWeight:700,color:"#fff",textShadow:"0 1px 3px #000"}}>{(homeProb*100).toFixed(1)}%</span><span style={{fontSize:11,fontWeight:700,color:"#fff",textShadow:"0 1px 3px #000"}}>{(ap*100).toFixed(1)}%</span></div></div><span style={{fontSize:10,color:"#8899bb",width:32}}>{ABBR[awayTeam]}</span></div><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:11,color:hF?"#00e87a":"#4a6a9a",fontWeight:hF?700:400}}>{hF?`▲ ${homeTeam.split(" ").at(-1)} favored`:homeTeam.split(" ").at(-1)}</span><span style={{fontSize:11,color:!hF?"#00e87a":"#4a6a9a",fontWeight:!hF?700:400}}>{!hF?`▲ ${awayTeam.split(" ").at(-1)} favored`:awayTeam.split(" ").at(-1)}</span></div>{detail&&<div style={{marginTop:8,paddingTop:8,borderTop:"1px solid #0f1e32",fontSize:10,color:"#3a5a8a",lineHeight:1.7}}>{detail}</div>}</div>;}

export default function App() {
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [homeOdds, setHomeOdds] = useState("");
  const [awayOdds, setAwayOdds] = useState("");
  const [homeData, setHomeData] = useState(null);
  const [awayData, setAwayData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);
  const [tab, setTab] = useState("results");
  const [dataLoaded, setDataLoaded] = useState(false);

  const cyclePlayer = (side, name) => {
    const setter = side === "home" ? setHomeData : setAwayData;
    const data = side === "home" ? homeData : awayData;
    if (!data) return;
    setter({...data, roster: data.roster.map(p => {
      if (p.name !== name) return p;
      const idx = STATUS_CYCLE.indexOf(p.status);
      return {...p, status: STATUS_CYCLE[(idx+1) % STATUS_CYCLE.length]};
    })});
  };

  const handleFetchAndRun = async () => {
    if (!homeTeam || !awayTeam) { setError("Please select both teams."); return; }
    if (homeTeam === awayTeam) { setError("Please select two different teams."); return; }
    setError("");
    setLoading(true);
    setResults(null);
    setDataLoaded(false);

    try {
      const matchup = await fetchMatchup(homeTeam, awayTeam);
      const hd = matchup.home;
      const ad = matchup.away;
      setHomeData(hd);
      setAwayData(ad);
      setDataLoaded(true);

      // Run models immediately with fetched data
      const elo = modelElo(hd, ad);
      const rap = modelRaptor(hd, ad);
      const ff  = modelFourFactors(hd, ad);
      const ml  = modelML(hd, ad);
      const mc  = modelMonteCarlo(hd, ad);
      const cons = modelConsensus([elo.homeProb, rap.homeProb, ff.homeProb, ml.homeProb, mc.homeProb]);
      setResults({elo, rap, ff, ml, mc, cons});
      setTab("results");
    } catch(e) {
      setError(`Failed to fetch data: ${e.message}`);
    }
    setLoading(false);
  };

  const handleRerun = () => {
    if (!homeData || !awayData) return;
    const elo = modelElo(homeData, awayData);
    const rap = modelRaptor(homeData, awayData);
    const ff  = modelFourFactors(homeData, awayData);
    const ml  = modelML(homeData, awayData);
    const mc  = modelMonteCarlo(homeData, awayData);
    const cons = modelConsensus([elo.homeProb, rap.homeProb, ff.homeProb, ml.homeProb, mc.homeProb]);
    setResults({elo, rap, ff, ml, mc, cons});
  };

  const sig = e => {
    const v = parseFloat(e);
    return v>=5?{l:"STRONG BET ✓",c:"#00e87a"}:v>=2?{l:"LEAN BET ↑",c:"#7be87a"}:v>=0?{l:"SLIGHT EDGE ~",c:"#e8d87a"}:{l:"NO VALUE ✗",c:"#e87a7a"};
  };

  const cs = {
    app:{minHeight:"100vh",background:"linear-gradient(160deg,#050c18 0%,#091525 60%,#050e1c 100%)",fontFamily:"'Inter',sans-serif",color:"#dde8ff"},
    hdr:{background:"linear-gradient(90deg,#091525,#0d1e38,#091525)",borderBottom:"1px solid #1a2d4e",padding:"16px 24px",display:"flex",alignItems:"center"},
    wrap:{maxWidth:1020,margin:"0 auto",padding:"20px 14px"},
    card:{background:"linear-gradient(135deg,#0c1c32,#091525)",border:"1px solid #1a2d4e",borderRadius:12,padding:20,marginBottom:16},
    sec:{fontFamily:"'Bebas Neue',cursive",fontSize:15,letterSpacing:2,color:"#c8a84b",margin:"0 0 14px"},
    lbl:{fontSize:10,color:"#3a5a8a",letterSpacing:1,marginBottom:5,display:"block",textTransform:"uppercase"},
    sel:{width:"100%",padding:"10px 12px",background:"#050c18",border:"1px solid #1a2d4e",borderRadius:8,color:"#dde8ff",fontSize:13,outline:"none",cursor:"pointer"},
    inp:{width:"100%",padding:"10px 12px",background:"#050c18",border:"1px solid #1a2d4e",borderRadius:8,color:"#dde8ff",fontSize:13,outline:"none",boxSizing:"border-box"},
    btn:{width:"100%",padding:13,background:"linear-gradient(90deg,#c8a84b,#e8c870)",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"'Bebas Neue',cursive",fontSize:17,letterSpacing:2,color:"#050c18",marginTop:10},
    pill:col=>({display:"inline-block",padding:"3px 9px",borderRadius:20,fontSize:10,fontWeight:700,background:col+"22",border:`1px solid ${col}`,color:col}),
    tabB:a=>({padding:"8px 16px",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer",border:"none",background:a?"#c8a84b":"transparent",color:a?"#050c18":"#4a6a9a",fontFamily:"'Bebas Neue',cursive",letterSpacing:1}),
    prob:p=>({fontFamily:"'Bebas Neue',cursive",fontSize:44,lineHeight:1,color:p>0.56?"#00e87a":p>0.44?"#c8a84b":"#e87a7a"}),
  };

  const outCount = data => data?.roster?.filter(p=>p.status!=="PLAYING").length || 0;

  return (
    <div style={cs.app}>
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700&display=swap" rel="stylesheet"/>
      <div style={cs.hdr}>
        <div>
          <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:26,letterSpacing:3,color:"#c8a84b",textShadow:"0 0 24px rgba(200,168,75,0.5)"}}>COURT EDGE</div>
          <div style={{fontSize:10,color:"#3a5a8a",letterSpacing:2,marginTop:-2}}>NBA MONEYLINE · 5-MODEL SYSTEM · 2025-26 LIVE DATA</div>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:6}}>
          <span style={cs.pill("#00e87a")}>LIVE 2025-26</span>
          <span style={cs.pill("#e8b87a")}>5 MODELS</span>
          <span style={cs.pill("#c8a84b")}>INJURY TRACKING</span>
        </div>
      </div>

      <div style={cs.wrap}>
        <div style={cs.card}>
          <p style={cs.sec}>⚡ SELECT MATCHUP</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 32px 1fr",gap:12,alignItems:"start"}}>
            <div>
              <span style={cs.lbl}>Home Team</span>
              <select style={cs.sel} value={homeTeam} onChange={e=>{setHomeTeam(e.target.value);setHomeData(null);setResults(null);setDataLoaded(false);}}>
                <option value="">Select team...</option>
                {NBA_TEAMS.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
              <div style={{marginTop:8}}>
                <span style={cs.lbl}>Home Moneyline (optional)</span>
                <input style={cs.inp} placeholder="-150" value={homeOdds} onChange={e=>setHomeOdds(e.target.value)}/>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue',cursive",fontSize:18,color:"#3a5a8a",paddingTop:36}}>VS</div>
            <div>
              <span style={cs.lbl}>Away Team</span>
              <select style={cs.sel} value={awayTeam} onChange={e=>{setAwayTeam(e.target.value);setAwayData(null);setResults(null);setDataLoaded(false);}}>
                <option value="">Select team...</option>
                {NBA_TEAMS.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
              <div style={{marginTop:8}}>
                <span style={cs.lbl}>Away Moneyline (optional)</span>
                <input style={cs.inp} placeholder="+130" value={awayOdds} onChange={e=>setAwayOdds(e.target.value)}/>
              </div>
            </div>
          </div>

          {error && <div style={{background:"#180a0a",border:"1px solid #4a1a1a",borderRadius:8,padding:"12px 14px",marginTop:14,color:"#e87a7a",fontSize:12}}>⚠️ {error}</div>}

          <button style={{...cs.btn,opacity:loading?0.6:1}} onClick={handleFetchAndRun} disabled={loading}>
            {loading ? "⏳ FETCHING LIVE 2025-26 DATA..." : "🔍 FETCH LIVE DATA & RUN MODELS"}
          </button>

          {loading && (
            <div style={{marginTop:12,background:"#050c18",border:"1px solid #1a2d4e",borderRadius:8,padding:14,textAlign:"center"}}>
              <div style={{fontSize:12,color:"#4a9aff",marginBottom:4}}>Searching for current 2025-26 season stats, rosters & injury reports...</div>
              <div style={{fontSize:10,color:"#3a5a8a"}}>This takes ~15-20 seconds · Using live web search</div>
            </div>
          )}
        </div>

        {/* Rosters shown after data loads — allow injury adjustments then re-run */}
        {dataLoaded && homeData && awayData && (
          <div style={cs.card}>
            <p style={cs.sec}>🏥 ADJUST INJURY STATUS — TAP ANY PLAYER TO CHANGE</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <RosterPanel teamName={homeTeam} teamData={homeData} onCyclePlayer={name=>cyclePlayer("home",name)}/>
              <RosterPanel teamName={awayTeam} teamData={awayData} onCyclePlayer={name=>cyclePlayer("away",name)}/>
            </div>
            <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
              {outCount(homeData)>0&&<Pill label={`${ABBR[homeTeam]}: ${outCount(homeData)} player${outCount(homeData)>1?"s":""} limited`} color="#e8b87a"/>}
              {outCount(homeData)===0&&<Pill label={`${ABBR[homeTeam]}: Full strength`} color="#00e87a"/>}
              {outCount(awayData)>0&&<Pill label={`${ABBR[awayTeam]}: ${outCount(awayData)} player${outCount(awayData)>1?"s":""} limited`} color="#e8b87a"/>}
              {outCount(awayData)===0&&<Pill label={`${ABBR[awayTeam]}: Full strength`} color="#00e87a"/>}
            </div>
            <button style={{...cs.btn,background:"linear-gradient(90deg,#1a6a3a,#00a855)",color:"#fff",fontSize:14}} onClick={handleRerun}>
              ♻️ RECALCULATE WITH UPDATED INJURIES
            </button>
          </div>
        )}

        {results && (() => {
          const {elo,rap,ff,ml,mc,cons} = results;
          const cH=cons, cA=1-cH;
          const hI=oddsToImplied(homeOdds), aI=oddsToImplied(awayOdds);
          const hE=hI!==null?((cH-hI)*100).toFixed(1):null;
          const aE=aI!==null?((cA-aI)*100).toFixed(1):null;
          const hEV=homeOdds&&hI?calcEV(cH,homeOdds):null;
          const aEV=awayOdds&&aI?calcEV(cA,awayOdds):null;
          return <>
            <div style={{display:"flex",gap:6,marginBottom:16,background:"#0a1525",borderRadius:8,padding:6,border:"1px solid #1a2d4e",flexWrap:"wrap",alignItems:"center"}}>
              {[{k:"results",l:"📊 Results"},{k:"method",l:"🔬 Methodology"}].map(t=><button key={t.k} style={cs.tabB(tab===t.k)} onClick={()=>setTab(t.k)}>{t.l}</button>)}
              {hE!==null&&<div style={{marginLeft:"auto",display:"flex",gap:6,flexWrap:"wrap"}}>
                <Pill label={`${homeTeam.split(" ").at(-1)}: ${parseFloat(hE)>=0?"+":""}${hE}% edge`} color={parseFloat(hE)>=2?"#00e87a":parseFloat(hE)>=0?"#e8d87a":"#e87a7a"}/>
                <Pill label={`${awayTeam.split(" ").at(-1)}: ${parseFloat(aE)>=0?"+":""}${aE}% edge`} color={parseFloat(aE)>=2?"#00e87a":parseFloat(aE)>=0?"#e8d87a":"#e87a7a"}/>
              </div>}
            </div>

            {tab==="results"&&<>
              <div style={{background:"linear-gradient(135deg,#0f2a0a,#091e06)",border:"1px solid #2a5a1a",borderRadius:12,padding:20,marginBottom:16}}>
                <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:13,letterSpacing:2,color:"#7be87a",marginBottom:12}}>🏆 CONSENSUS — WEIGHTED AVERAGE OF ALL 5 MODELS</div>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{textAlign:"center",minWidth:80}}>
                    <TBadge name={homeTeam}/>
                    <div style={cs.prob(cH)}>{(cH*100).toFixed(1)}%</div>
                    <div style={{fontSize:11,color:"#4a8a3a"}}>{homeTeam.split(" ").at(-1)}</div>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{height:22,background:"#0a1628",borderRadius:11,overflow:"hidden",marginBottom:8}}>
                      <div style={{height:"100%",width:`${cH*100}%`,background:"linear-gradient(90deg,#00a855,#00e87a)",transition:"width 0.8s ease"}}/>
                    </div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center"}}>
                      <span style={cs.pill("#c8a84b")}>Fair home: {probToAmericanOdds(cH)}</span>
                      <span style={cs.pill("#c8a84b")}>Fair away: {probToAmericanOdds(cA)}</span>
                      {hE&&<Pill large label={`${homeTeam.split(" ").at(-1)}: ${hEV?`EV ${parseFloat(hEV)>=0?"+":""}${hEV}/$1`:hE+"% edge"}`} color={parseFloat(hE)>=2?"#00e87a":parseFloat(hE)>=0?"#e8d87a":"#e87a7a"}/>}
                      {aE&&<Pill large label={`${awayTeam.split(" ").at(-1)}: ${aEV?`EV ${parseFloat(aEV)>=0?"+":""}${aEV}/$1`:aE+"% edge"}`} color={parseFloat(aE)>=2?"#00e87a":parseFloat(aE)>=0?"#e8d87a":"#e87a7a"}/>}
                      {hE&&<Pill large label={sig(cH>cA?hE:aE).l} color={sig(cH>cA?hE:aE).c}/>}
                    </div>
                  </div>
                  <div style={{textAlign:"center",minWidth:80}}>
                    <TBadge name={awayTeam}/>
                    <div style={cs.prob(cA)}>{(cA*100).toFixed(1)}%</div>
                    <div style={{fontSize:11,color:"#4a8a3a"}}>{awayTeam.split(" ").at(-1)}</div>
                  </div>
                </div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                <MCard icon="♟️" name="ELO RATING" desc="Win-rate Elo + recent form + home court" homeTeam={homeTeam} awayTeam={awayTeam} homeProb={elo.homeProb} detail={`Home Elo: ${elo.hElo} · Away Elo: ${elo.aElo} · +100 home court bonus`}/>
                <MCard icon="👤" name="RAPTOR / PLAYER IMPACT" desc="PER weighted by availability" homeTeam={homeTeam} awayTeam={awayTeam} homeProb={rap.homeProb} detail={`Home PER (adj): ${rap.hVal} · Away: ${rap.aVal}`}/>
                <MCard icon="📐" name="NET RATING / FOUR FACTORS" desc="eFG%, TOV%, OREB%, FTR + net rating" homeTeam={homeTeam} awayTeam={awayTeam} homeProb={ff.homeProb} detail={`Home FF: ${ff.hFF} · Away: ${ff.aFF} · Injury drag -${(ff.hHit*100).toFixed(1)}% / -${(ff.aHit*100).toFixed(1)}%`}/>
                <MCard icon="🤖" name="ML / BPI-STYLE" desc="7-feature logistic regression" homeTeam={homeTeam} awayTeam={awayTeam} homeProb={ml.homeProb} detail="Net rating · Win% · Off/Def efficiency · L10 form · Injury penalty"/>
              </div>
              <MCard icon="🎲" name="BAYESIAN MONTE CARLO SIMULATION" desc="10,000 simulated games · Normal distribution scoring" homeTeam={homeTeam} awayTeam={awayTeam} homeProb={mc.homeProb} detail={`Projected: ${homeTeam.split(" ").at(-1)} ${mc.hExp} · ${awayTeam.split(" ").at(-1)} ${mc.aExp} pts`}/>

              <div style={{...cs.card,marginTop:12}}>
                <p style={cs.sec}>📈 MODEL AGREEMENT</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
                  {[{l:"Elo",p:elo.homeProb},{l:"RAPTOR",p:rap.homeProb},{l:"4 Factors",p:ff.homeProb},{l:"ML/BPI",p:ml.homeProb},{l:"Monte Carlo",p:mc.homeProb}].map(m=>{
                    const fav=m.p>0.5;
                    return <div key={m.l} style={{textAlign:"center",background:"#050c18",borderRadius:8,padding:"12px 8px",border:`1px solid ${fav?"#1a4a2a":"#3a1a1a"}`}}>
                      <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:22,color:fav?"#00e87a":"#e87a7a"}}>{(m.p*100).toFixed(0)}%</div>
                      <div style={{fontSize:10,color:fav?"#00e87a":"#e87a7a",fontWeight:700,marginBottom:3}}>{fav?ABBR[homeTeam]:ABBR[awayTeam]}</div>
                      <div style={{fontSize:10,color:"#3a5a8a"}}>{m.l}</div>
                    </div>;
                  })}
                </div>
              </div>
            </>}

            {tab==="method"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {[
                {icon:"♟️",n:"Elo Rating (18%)",d:"Win rate → Elo (baseline 1500). L10 net rating adjusts. Home court = +100 pts. Formula: 1/(1+10^(diff/400))."},
                {icon:"👤",n:"RAPTOR / Player Impact (22%)",d:"PER per player × availability: OUT=0%, DOUBTFUL=25%, QUESTIONABLE=65%, PLAYING=100%. Win prob = home share of total roster value."},
                {icon:"📐",n:"Net Rating / Four Factors (22%)",d:"eFG% (40%) + TOV rate (25%) + OREB% (20%) + FTR (15%) blended with net rating. Injury drag applied by status and role."},
                {icon:"🤖",n:"ML / BPI-Style (22%)",d:"XGBoost-style: 7 features — net rating, win%, off/def efficiency, L10 form, injury penalty, home intercept."},
                {icon:"🎲",n:"Monte Carlo (16%)",d:"10,000 simulated games. Scores sampled from normal distribution (σ=11) around each team's expected output vs opponent defense."},
                {icon:"🏆",n:"Consensus Weighting",d:"Elo×18% + RAPTOR×22% + FourFactors×22% + ML×22% + MC×16%. RAPTOR & ML weighted highest for injury sensitivity."},
              ].map(({icon,n,d})=><div key={n} style={{background:"#050c18",borderRadius:10,padding:16,border:"1px solid #1a2d4e"}}>
                <div style={{fontSize:22,marginBottom:6}}>{icon}</div>
                <div style={{fontSize:13,fontWeight:700,color:"#c8a84b",marginBottom:6}}>{n}</div>
                <div style={{fontSize:11,color:"#4a6a9a",lineHeight:1.65}}>{d}</div>
              </div>)}
            </div>}
          </>;
        })()}

        <div style={{fontSize:11,color:"#1e3050",textAlign:"center",padding:"12px 0 6px",lineHeight:1.7}}>
          ⚠️ For informational &amp; entertainment purposes only · Not financial advice · Please gamble responsibly
        </div>
      </div>
    </div>
  );
}
