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

function modelElo(hd,ad){const hw=hd.wins/Math.max(hd.wins+hd.losses,1),aw=ad.wins/Math.max(ad.wins+ad.losses,1);const hE=1500+400*Math.log10(Math.max(hw,0.01)/Math.max(1-hw,0.01)),aE=1500+400*Math.log10(Math.max(aw,0.01)/Math.max(1-aw,0.01));const h10=(hd.last10_ppg||hd.ppg)-(hd.last10_opp||hd.opp),a10=(ad.last10_ppg||ad.ppg)-(ad.last10_opp||ad.opp);const p=1/(1+Math.pow(10,(aE+a10*3-((hE+h10*3)+100))/400));return{homeProb:Math.min(0.97,Math.max(0.03,p)),hElo:Math.round(hE+h10*3),aElo:Math.round(aE+a10*3)};}
function modelRaptor(hd,ad){const val=roster=>(roster||[]).reduce((s,p)=>{const st=p.status;return s+(p.per||15)*(st==="PLAYING"?1:st==="OUT"?0:st==="DOUBTFUL"?0.25:0.65);},0);const hV=val(hd.roster),aV=val(ad.roster);return{homeProb:Math.min(0.97,Math.max(0.03,hV/Math.max(hV+aV,1)+0.035)),hVal:hV.toFixed(1),aVal:aV.toFixed(1)};}
function modelFourFactors(hd,ad){const hit=roster=>(roster||[]).reduce((s,p)=>{if(p.status==="PLAYING")return s;const sw=p.status==="OUT"?1:p.status==="DOUBTFUL"?0.75:0.35;return s+sw*Math.max(p.role==="STAR"?0.08:p.role==="KEY"?0.04:0.015,Math.min((p.ppg||0)*0.004,0.06));},0);const ff=d=>(d.efg_pct||0.52)*0.40+(1-(d.tov_rate||14)/30)*0.25+(d.oreb_pct||0.25)*0.20+Math.min(d.ftr||0.22,0.40)*0.15;const netDiff=(hd.ppg-hd.opp)-(ad.ppg-ad.opp),ffDiff=ff(hd)-ff(ad);const hH=hit(hd.roster),aH=hit(ad.roster);return{homeProb:Math.min(0.97,Math.max(0.03,logistic(netDiff*0.065+ffDiff*4)+0.035-hH+aH)),hFF:ff(hd).toFixed(3),aFF:ff(ad).toFixed(3),hHit:hH,aHit:aH};}
function modelML(hd,ad){const pen=roster=>(roster||[]).reduce((s,p)=>{if(p.status==="PLAYING")return s;return s+(p.status==="OUT"?1:p.status==="DOUBTFUL"?0.6:0.3)*(p.per||12)*0.01;},0);const f=(d)=>({net:d.ppg-d.opp,wp:d.wins/Math.max(d.wins+d.losses,1),offE:d.ppg*(d.efg_pct||0.52),defE:d.opp*(1-(d.opp_efg_pct||0.52)),l10:(d.last10_ppg||d.ppg)-(d.last10_opp||d.opp),pen:pen(d.roster)});const h=f(hd),a=f(ad);const score=(h.net-a.net)*0.08+(h.wp-a.wp)*2.5+(h.offE-a.offE)*0.05+(h.defE-a.defE)*0.04+(h.l10-a.l10)*0.06+(a.pen-h.pen)*1.8+0.28;return{homeProb:Math.min(0.97,Math.max(0.03,logistic(score)))};}
function modelMonteCarlo(hd,ad,N=10000){const ih=roster=>(roster||[]).reduce((s,p)=>{if(p.status==="PLAYING")return s;return s+(p.status==="OUT"?1:p.status==="DOUBTFUL"?0.65:0.3)*Math.min((p.ppg||0)*0.15,4);},0);const hE=((hd.ppg-ih(hd.roster))+(100-(ad.opp-ih(ad.roster))))/2+1.5,aE=((ad.ppg-ih(ad.roster))+(100-(hd.opp-ih(hd.roster))))/2;let w=0;for(let i=0;i<N;i++){const u1=Math.random(),u2=Math.random();const z1=Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2),z2=Math.sqrt(-2*Math.log(u1))*Math.sin(2*Math.PI*u2);if(hE+z1*11>aE+z2*11)w++;}return{homeProb:Math.min(0.97,Math.max(0.03,w/N)),hExp:hE.toFixed(1),aExp:aE.toFixed(1)};}
function modelConsensus(ps){return Math.min(0.97,Math.max(0.03,[0.18,0.22,0.22,0.22,0.16].reduce((s,w,i)=>s+ps[i]*w,0)));}

const STATUS_COLORS = { PLAYING:"#2DD4A0", QUESTIONABLE:"#F5A623", DOUBTFUL:"#E07B30", OUT:"#E05252" };
const STATUS_CYCLE = ["PLAYING","QUESTIONABLE","DOUBTFUL","OUT"];

const C = {
  black:   "#0A0A0C",
  dark:    "#111116",
  card:    "#16161C",
  border:  "#242430",
  copper:  "#B87333",
  copperL: "#D4924A",
  teal:    "#2DD4A0",
  tealD:   "#1A9E78",
  white:   "#F0F0F5",
  muted:   "#6B6B80",
  dim:     "#3A3A4A",
};

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${C.black}; }
  select option { background: #1a1a22; color: ${C.white}; }
  
  .tab-btn { transition: all 0.15s ease; }
  .tab-btn:hover { background: ${C.dim} !important; }
  
  .odds-pill { transition: all 0.15s ease; cursor: pointer; }
  .odds-pill:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(45,212,160,0.3); }
  
  .status-btn { transition: all 0.15s ease; }
  .status-btn:hover { transform: scale(1.04); }
  
  .fetch-btn { transition: all 0.2s ease; }
  .fetch-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(184,115,51,0.5); }
  .fetch-btn:active:not(:disabled) { transform: translateY(0); }

  .rerun-btn { transition: all 0.2s ease; }
  .rerun-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(45,212,160,0.35); }

  .model-card { transition: all 0.2s ease; }
  .model-card:hover { transform: translateY(-2px); border-color: ${C.copper} !important; }

  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
  .pulse { animation: pulse 1.5s ease-in-out infinite; }

  @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  .fade-in { animation: fadeIn 0.3s ease forwards; }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: ${C.dark}; }
  ::-webkit-scrollbar-thumb { background: ${C.dim}; border-radius: 2px; }
`;

function Badge({ abbr, size = 44 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 8,
      background: `linear-gradient(135deg, ${C.dim}, ${C.card})`,
      border: `1.5px solid ${C.copper}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Barlow Condensed', sans-serif",
      fontWeight: 800, fontSize: size * 0.28, color: C.copper,
      letterSpacing: 0.5, flexShrink: 0,
    }}>{abbr}</div>
  );
}

function StatChip({ label, value, accent }) {
  return (
    <div style={{ textAlign: "center", padding: "6px 10px", background: C.black, borderRadius: 6, border: `1px solid ${C.border}` }}>
      <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 16, fontWeight: 700, color: accent || C.white }}>{value}</div>
      <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 1 }}>{label}</div>
    </div>
  );
}

function WinBar({ homeProb, homeAbbr, awayAbbr }) {
  const ap = 1 - homeProb;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: "'Barlow Condensed'", fontSize: 13, fontWeight: 700, color: ap > 0.5 ? C.teal : C.muted }}>{homeAbbr} {(ap*100).toFixed(1)}%</span>
        <span style={{ fontFamily: "'Barlow Condensed'", fontSize: 13, fontWeight: 700, color: homeProb > 0.5 ? C.teal : C.muted }}>{(homeProb*100).toFixed(1)}% {awayAbbr}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: C.border, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${homeProb*100}%`, background: `linear-gradient(90deg, ${C.tealD}, ${C.teal})`, borderRadius: 3, transition: "width 0.6s ease" }}/>
      </div>
    </div>
  );
}

function OddsPill({ prob }) {
  const odds = probToAmericanOdds(prob);
  const fav = prob >= 0.5;
  return (
    <div className="odds-pill" style={{
      padding: "10px 18px", borderRadius: 8, textAlign: "center",
      background: fav ? `linear-gradient(135deg, ${C.tealD}22, ${C.teal}11)` : C.black,
      border: `1.5px solid ${fav ? C.teal : C.border}`,
      minWidth: 80,
    }}>
      <div style={{ fontFamily: "'Barlow Condensed'", fontWeight: 900, fontSize: 22, color: fav ? C.teal : C.white, letterSpacing: -0.5 }}>{odds}</div>
      <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginTop: 1 }}>Fair odds</div>
    </div>
  );
}

function RosterPanel({ teamName, teamData, onCyclePlayer }) {
  if (!teamData) return null;
  return (
    <div className="fade-in" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
      {/* Team header */}
      <div style={{ padding: "10px 14px", background: C.dark, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
        <Badge abbr={ABBR[teamName]} size={36}/>
        <div>
          <div style={{ fontFamily: "'Barlow Condensed'", fontWeight: 800, fontSize: 15, color: C.white, letterSpacing: 0.3 }}>{teamName}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{teamData.wins}W â€“ {teamData.losses}L &nbsp;Â·&nbsp; {teamData.ppg} PPG &nbsp;Â·&nbsp; {teamData.opp} OPP</div>
        </div>
      </div>
      {/* Roster rows */}
      <div style={{ padding: "6px 0" }}>
        {(teamData.roster || []).map(p => {
          const sc = STATUS_COLORS[p.status] || C.teal;
          return (
            <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 14px", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Barlow'", fontWeight: 600, fontSize: 13, color: C.white, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
                  {p.ppg} PPG &nbsp;Â·&nbsp;
                  <span style={{ color: p.role==="STAR" ? C.copper : p.role==="KEY" ? C.teal : C.muted }}>{p.role}</span>
                </div>
              </div>
              <button className="status-btn" onClick={() => onCyclePlayer(p.name)} style={{
                padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                cursor: "pointer", border: `1.5px solid ${sc}`,
                background: sc + "18", color: sc,
                fontFamily: "'Barlow Condensed'", letterSpacing: 0.8,
                minWidth: 100, textAlign: "center",
              }}>{p.status}</button>
            </div>
          );
        })}
      </div>
      <div style={{ padding: "8px 14px", fontSize: 10, color: C.dim, textAlign: "center", borderTop: `1px solid ${C.border}` }}>
        TAP STATUS TO CYCLE: PLAYING â†’ QUESTIONABLE â†’ DOUBTFUL â†’ OUT
      </div>
    </div>
  );
}

function ModelCard({ icon, name, desc, homeTeam, awayTeam, homeProb, detail }) {
  const ap = 1 - homeProb;
  const hFav = homeProb >= 0.5;
  return (
    <div className="model-card" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <div>
          <div style={{ fontFamily: "'Barlow Condensed'", fontWeight: 800, fontSize: 13, color: C.copper, letterSpacing: 1, textTransform: "uppercase" }}>{name}</div>
          <div style={{ fontSize: 10, color: C.muted }}>{desc}</div>
        </div>
      </div>
      {/* Teams row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
          <Badge abbr={ABBR[awayTeam]} size={28}/>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed'", fontWeight: 900, fontSize: 20, color: !hFav ? C.teal : C.white, lineHeight: 1 }}>{(ap*100).toFixed(0)}%</div>
            <div style={{ fontSize: 9, color: C.muted }}>{awayTeam.split(" ").at(-1)}</div>
          </div>
        </div>
        <div style={{ width: 1, height: 32, background: C.border }}/>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, justifyContent: "flex-end" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'Barlow Condensed'", fontWeight: 900, fontSize: 20, color: hFav ? C.teal : C.white, lineHeight: 1 }}>{(homeProb*100).toFixed(0)}%</div>
            <div style={{ fontSize: 9, color: C.muted }}>{homeTeam.split(" ").at(-1)}</div>
          </div>
          <Badge abbr={ABBR[homeTeam]} size={28}/>
        </div>
      </div>
      {/* Bar */}
      <div style={{ height: 4, borderRadius: 2, background: C.border, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${homeProb*100}%`, background: `linear-gradient(90deg,${C.tealD},${C.teal})`, transition: "width 0.5s ease" }}/>
      </div>
      {detail && <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.5 }}>{detail}</div>}
    </div>
  );
}

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

  const runModels = (hd, ad) => {
    const elo = modelElo(hd, ad);
    const rap = modelRaptor(hd, ad);
    const ff  = modelFourFactors(hd, ad);
    const ml  = modelML(hd, ad);
    const mc  = modelMonteCarlo(hd, ad);
    const cons = modelConsensus([elo.homeProb,rap.homeProb,ff.homeProb,ml.homeProb,mc.homeProb]);
    setResults({elo,rap,ff,ml,mc,cons});
    setTab("results");
  };

  const handleFetch = async () => {
    if (!homeTeam || !awayTeam) { setError("Select both teams first."); return; }
    if (homeTeam === awayTeam) { setError("Select two different teams."); return; }
    setError(""); setLoading(true); setResults(null); setDataLoaded(false);
    try {
      const matchup = await fetchMatchup(homeTeam, awayTeam);
      setHomeData(matchup.home); setAwayData(matchup.away);
      setDataLoaded(true);
      runModels(matchup.home, matchup.away);
    } catch(e) { setError(`Failed: ${e.message}`); }
    setLoading(false);
  };

  const handleRerun = () => { if (homeData && awayData) runModels(homeData, awayData); };

  const inp = { width:"100%",padding:"10px 12px",background:C.black,border:`1.5px solid ${C.border}`,borderRadius:8,color:C.white,fontSize:13,outline:"none",fontFamily:"'Barlow',sans-serif" };
  const sel = { ...inp, cursor:"pointer" };

  const outCount = d => d?.roster?.filter(p=>p.status!=="PLAYING").length||0;

  return (
    <div style={{ minHeight:"100vh", background:C.black, fontFamily:"'Barlow',sans-serif", color:C.white }}>
      <style>{styles}</style>
      
      {/* HEADER */}
      <div style={{ background:C.dark, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ maxWidth:1040, margin:"0 auto", padding:"0 16px" }}>
          <div style={{ display:"flex", alignItems:"center", height:56, gap:12 }}>
            {/* Logo */}
            <div style={{ display:"flex", alignItems:"center", gap:10, marginRight:8 }}>
              <div style={{ width:32, height:32, borderRadius:6, background:`linear-gradient(135deg,${C.copper},${C.copperL})`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <span style={{ fontSize:16 }}>ðŸ€</span>
              </div>
              <div>
                <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:20, color:C.white, letterSpacing:1, lineHeight:1 }}>COURT EDGE</div>
                <div style={{ fontSize:9, color:C.copper, letterSpacing:2, textTransform:"uppercase" }}>NBA Analytics</div>
              </div>
            </div>
            {/* Nav pills */}
            <div style={{ display:"flex", gap:4, marginLeft:"auto", alignItems:"center" }}>
              {[["ðŸ†","NBA"],["ðŸ“Š","Models"],["âš¡","Live"]].map(([icon,label])=>(
                <div key={label} style={{ padding:"5px 12px", borderRadius:20, background:C.card, border:`1px solid ${C.border}`, fontSize:11, color:C.muted, display:"flex", gap:5, alignItems:"center" }}>
                  <span>{icon}</span><span style={{ fontFamily:"'Barlow Condensed'", fontWeight:700, letterSpacing:0.5 }}>{label}</span>
                </div>
              ))}
              <div style={{ marginLeft:6, padding:"5px 14px", borderRadius:20, background:`linear-gradient(90deg,${C.copper},${C.copperL})`, fontSize:11, fontWeight:700, color:C.black, fontFamily:"'Barlow Condensed'", letterSpacing:1 }}>
                2025â€“26 LIVE
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1040, margin:"0 auto", padding:"16px" }}>

        {/* MATCHUP SELECTOR â€” FanDuel-style card */}
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden", marginBottom:14 }}>
          {/* Card header bar */}
          <div style={{ padding:"10px 16px", background:`linear-gradient(90deg,${C.copper}22,transparent)`, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:3, height:16, borderRadius:2, background:C.copper }}/>
            <span style={{ fontFamily:"'Barlow Condensed'", fontWeight:800, fontSize:14, letterSpacing:1.5, color:C.white, textTransform:"uppercase" }}>Select Matchup</span>
            <span style={{ marginLeft:"auto", fontSize:11, color:C.muted }}>2025â€“26 NBA Season</span>
          </div>

          <div style={{ padding:16 }}>
            {/* Team pickers */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:12, alignItems:"center", marginBottom:14 }}>
              {/* Away */}
              <div>
                <div style={{ fontSize:10, color:C.teal, fontFamily:"'Barlow Condensed'", fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", marginBottom:6 }}>âœˆï¸ Away Team</div>
                <select style={sel} value={awayTeam} onChange={e=>{setAwayTeam(e.target.value);setAwayData(null);setResults(null);setDataLoaded(false);}}>
                  <option value="">Select team...</option>
                  {NBA_TEAMS.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {/* VS badge */}
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, paddingTop:20 }}>
                <div style={{ width:36, height:36, borderRadius:"50%", background:C.dark, border:`2px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:12, color:C.muted }}>VS</div>
              </div>
              {/* Home */}
              <div>
                <div style={{ fontSize:10, color:C.copper, fontFamily:"'Barlow Condensed'", fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", marginBottom:6 }}>ðŸ  Home Team</div>
                <select style={sel} value={homeTeam} onChange={e=>{setHomeTeam(e.target.value);setHomeData(null);setResults(null);setDataLoaded(false);}}>
                  <option value="">Select team...</option>
                  {NBA_TEAMS.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Moneyline inputs */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 36px 1fr", gap:12, marginBottom:16 }}>
              <div>
                <div style={{ fontSize:10, color:C.muted, letterSpacing:1, marginBottom:5, textTransform:"uppercase" }}>Away Moneyline</div>
                <input style={inp} placeholder="+130" value={awayOdds} onChange={e=>setAwayOdds(e.target.value)}/>
              </div>
              <div/>
              <div>
                <div style={{ fontSize:10, color:C.muted, letterSpacing:1, marginBottom:5, textTransform:"uppercase" }}>Home Moneyline</div>
                <input style={inp} placeholder="-150" value={homeOdds} onChange={e=>setHomeOdds(e.target.value)}/>
              </div>
            </div>

            {error && (
              <div style={{ padding:"10px 14px", background:"#2a0f0f", border:`1px solid #5a2020`, borderRadius:8, marginBottom:12, fontSize:12, color:"#f87171" }}>
                âš ï¸ {error}
              </div>
            )}

            {/* CTA Button */}
            <button className="fetch-btn" onClick={handleFetch} disabled={loading} style={{
              width:"100%", padding:"13px 0",
              background: loading ? C.dim : `linear-gradient(90deg,${C.copper},${C.copperL})`,
              border:"none", borderRadius:9, cursor: loading?"not-allowed":"pointer",
              fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:17, letterSpacing:2,
              color: loading ? C.muted : C.black, textTransform:"uppercase",
            }}>
              {loading ? (
                <span className="pulse">â³ &nbsp;Fetching Live 2025â€“26 Dataâ€¦</span>
              ) : "ðŸ”  Fetch Live Data & Analyze"}
            </button>

            {loading && (
              <div style={{ marginTop:10, padding:"10px 14px", background:C.black, border:`1px solid ${C.border}`, borderRadius:8, textAlign:"center" }}>
                <div style={{ fontSize:11, color:C.teal }} className="pulse">Searching current season stats, rosters & injury reportsâ€¦</div>
                <div style={{ fontSize:10, color:C.muted, marginTop:3 }}>Takes ~15â€“20 seconds Â· Powered by live web search</div>
              </div>
            )}
          </div>
        </div>

        {/* ROSTER / INJURY PANEL */}
        {dataLoaded && homeData && awayData && (
          <div className="fade-in" style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden", marginBottom:14 }}>
            <div style={{ padding:"10px 16px", background:`linear-gradient(90deg,${C.teal}22,transparent)`, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:3, height:16, borderRadius:2, background:C.teal }}/>
              <span style={{ fontFamily:"'Barlow Condensed'", fontWeight:800, fontSize:14, letterSpacing:1.5, color:C.white, textTransform:"uppercase" }}>Injury Report</span>
              <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
                {outCount(homeData)>0 && <span style={{ padding:"2px 8px", borderRadius:12, background:"#e0525218", border:`1px solid #E05252`, color:"#E05252", fontSize:10, fontWeight:700 }}>{ABBR[homeTeam]} {outCount(homeData)} OUT</span>}
                {outCount(awayData)>0 && <span style={{ padding:"2px 8px", borderRadius:12, background:"#e0525218", border:`1px solid #E05252`, color:"#E05252", fontSize:10, fontWeight:700 }}>{ABBR[awayTeam]} {outCount(awayData)} OUT</span>}
                {outCount(homeData)===0 && <span style={{ padding:"2px 8px", borderRadius:12, background:C.teal+"18", border:`1px solid ${C.teal}`, color:C.teal, fontSize:10, fontWeight:700 }}>{ABBR[homeTeam]} FULL</span>}
                {outCount(awayData)===0 && <span style={{ padding:"2px 8px", borderRadius:12, background:C.teal+"18", border:`1px solid ${C.teal}`, color:C.teal, fontSize:10, fontWeight:700 }}>{ABBR[awayTeam]} FULL</span>}
              </div>
            </div>
            <div style={{ padding:14 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <RosterPanel teamName={awayTeam} teamData={awayData} onCyclePlayer={n=>cyclePlayer("away",n)}/>
                <RosterPanel teamName={homeTeam} teamData={homeData} onCyclePlayer={n=>cyclePlayer("home",n)}/>
              </div>
              <button className="rerun-btn" onClick={handleRerun} style={{
                marginTop:12, width:"100%", padding:"11px 0",
                background:`linear-gradient(90deg,${C.tealD},${C.teal})`,
                border:"none", borderRadius:8, cursor:"pointer",
                fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:15, letterSpacing:2,
                color:C.black, textTransform:"uppercase",
              }}>â™»ï¸  Recalculate With Updated Injuries</button>
            </div>
          </div>
        )}

        {/* RESULTS */}
        {results && (() => {
          const {elo,rap,ff,ml,mc,cons} = results;
          const cH=cons, cA=1-cH;
          const hI=oddsToImplied(homeOdds), aI=oddsToImplied(awayOdds);
          const hE=hI!==null?((cH-hI)*100).toFixed(1):null;
          const aE=aI!==null?((cA-aI)*100).toFixed(1):null;
          const hEV=homeOdds&&hI?calcEV(cH,homeOdds):null;
          const aEV=awayOdds&&aI?calcEV(cA,awayOdds):null;
          const sig = v => v>=5?{l:"STRONG BET",c:"#22c55e"}:v>=2?{l:"LEAN BET",c:C.teal}:v>=0?{l:"SLIGHT EDGE",c:C.copper}:{l:"NO VALUE",c:"#E05252"};

          return (
            <div className="fade-in">
              {/* Tab bar */}
              <div style={{ display:"flex", gap:4, marginBottom:14, background:C.dark, borderRadius:8, padding:4, border:`1px solid ${C.border}` }}>
                {[["results","ðŸ“Š Results"],["method","ðŸ”¬ Methodology"]].map(([k,l])=>(
                  <button key={k} className="tab-btn" onClick={()=>setTab(k)} style={{
                    flex:1, padding:"8px 0", borderRadius:6, border:"none", cursor:"pointer",
                    background: tab===k ? `linear-gradient(90deg,${C.copper}33,${C.copper}22)` : "transparent",
                    color: tab===k ? C.copper : C.muted,
                    fontFamily:"'Barlow Condensed'", fontWeight:800, fontSize:13, letterSpacing:1, textTransform:"uppercase",
                    borderBottom: tab===k ? `2px solid ${C.copper}` : "2px solid transparent",
                  }}>{l}</button>
                ))}
              </div>

              {tab==="results" && <>
                {/* CONSENSUS HERO CARD */}
                <div style={{ background:C.card, border:`1.5px solid ${C.copper}44`, borderRadius:12, padding:20, marginBottom:14, position:"relative", overflow:"hidden" }}>
                  {/* Decorative bg */}
                  <div style={{ position:"absolute", top:-30, right:-30, width:120, height:120, borderRadius:"50%", background:C.copper+"0a", pointerEvents:"none" }}/>
                  
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
                    <div style={{ width:3, height:16, borderRadius:2, background:C.copper }}/>
                    <span style={{ fontFamily:"'Barlow Condensed'", fontWeight:800, fontSize:14, letterSpacing:1.5, color:C.copper, textTransform:"uppercase" }}>Consensus â€” 5 Model Weighted Average</span>
                  </div>

                  {/* Main matchup display */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", gap:16, alignItems:"center", marginBottom:16 }}>
                    {/* Away */}
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
                      <Badge abbr={ABBR[awayTeam]} size={52}/>
                      <div style={{ textAlign:"center" }}>
                        <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:42, lineHeight:1, color: cA>0.55?C.teal:cA>0.45?C.copper:C.white }}>{(cA*100).toFixed(1)}%</div>
                        <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{awayTeam}</div>
                      </div>
                      <OddsPill prob={cA}/>
                    </div>

                    {/* Center */}
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
                      <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:14, color:C.muted, letterSpacing:2 }}>VS</div>
                      {hE && (
                        <div style={{ textAlign:"center", padding:"8px 12px", background: parseFloat(hE)>=2?C.teal+"18":C.black, border:`1px solid ${parseFloat(hE)>=2?C.teal:C.border}`, borderRadius:8 }}>
                          <div style={{ fontFamily:"'Barlow Condensed'", fontSize:11, fontWeight:800, color: parseFloat(hE)>=2?C.teal:C.muted, letterSpacing:1 }}>{sig(parseFloat(cH>cA?hE:aE)).l}</div>
                          {hEV && <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>EV: {parseFloat(hEV)>=0?"+":""}{hEV}</div>}
                        </div>
                      )}
                    </div>

                    {/* Home */}
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
                      <Badge abbr={ABBR[homeTeam]} size={52}/>
                      <div style={{ textAlign:"center" }}>
                        <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:42, lineHeight:1, color: cH>0.55?C.teal:cH>0.45?C.copper:C.white }}>{(cH*100).toFixed(1)}%</div>
                        <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{homeTeam}</div>
                      </div>
                      <OddsPill prob={cH}/>
                    </div>
                  </div>

                  {/* Win probability bar */}
                  <WinBar homeProb={cH} homeAbbr={ABBR[awayTeam]} awayAbbr={ABBR[homeTeam]}/>

                  {/* Edge chips */}
                  {(hE||aE) && (
                    <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
                      {hE && <div style={{ padding:"5px 12px", borderRadius:6, background: parseFloat(hE)>=2?C.teal+"18":C.black, border:`1px solid ${parseFloat(hE)>=2?C.teal:C.border}`, fontSize:11, color: parseFloat(hE)>=2?C.teal:C.muted, fontFamily:"'Barlow Condensed'", fontWeight:700 }}>
                        {ABBR[homeTeam]} Edge: {parseFloat(hE)>=0?"+":""}{hE}%{hEV?` Â· EV ${parseFloat(hEV)>=0?"+":""}${hEV}/$1`:""}
                      </div>}
                      {aE && <div style={{ padding:"5px 12px", borderRadius:6, background: parseFloat(aE)>=2?C.teal+"18":C.black, border:`1px solid ${parseFloat(aE)>=2?C.teal:C.border}`, fontSize:11, color: parseFloat(aE)>=2?C.teal:C.muted, fontFamily:"'Barlow Condensed'", fontWeight:700 }}>
                        {ABBR[awayTeam]} Edge: {parseFloat(aE)>=0?"+":""}{aE}%{aEV?` Â· EV ${parseFloat(aEV)>=0?"+":""}${aEV}/$1`:""}
                      </div>}
                    </div>
                  )}
                </div>

                {/* MODEL GRID */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                  <ModelCard icon="â™Ÿï¸" name="Elo Rating" desc="Win-rate Elo + recent form + home court" homeTeam={homeTeam} awayTeam={awayTeam} homeProb={elo.homeProb} detail={`Home Elo: ${elo.hElo}  Â·  Away Elo: ${elo.aElo}  Â·  +100 home court`}/>
                  <ModelCard icon="ðŸ‘¤" name="RAPTOR Impact" desc="Player PER weighted by availability" homeTeam={homeTeam} awayTeam={awayTeam} homeProb={rap.homeProb} detail={`Home adj PER: ${rap.hVal}  Â·  Away: ${rap.aVal}`}/>
                  <ModelCard icon="ðŸ“" name="Four Factors" desc="eFG%, TOV%, OREB%, FTR + net rating" homeTeam={homeTeam} awayTeam={awayTeam} homeProb={ff.homeProb} detail={`Home: ${ff.hFF}  Â·  Away: ${ff.aFF}  Â·  Injury drag -${(ff.hHit*100).toFixed(1)}% / -${(ff.aHit*100).toFixed(1)}%`}/>
                  <ModelCard icon="ðŸ¤–" name="ML / BPI" desc="7-feature logistic regression model" homeTeam={homeTeam} awayTeam={awayTeam} homeProb={ml.homeProb} detail="Net rtg Â· Win% Â· Off/Def eff Â· L10 form Â· Injury penalty"/>
                </div>
                <ModelCard icon="ðŸŽ²" name="Monte Carlo Simulation" desc="10,000 simulated games Â· Normal distribution scoring" homeTeam={homeTeam} awayTeam={awayTeam} homeProb={mc.homeProb} detail={`Projected: ${homeTeam.split(" ").at(-1)} ${mc.hExp}  Â·  ${awayTeam.split(" ").at(-1)} ${mc.aExp} pts`}/>

                {/* MODEL AGREEMENT */}
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:14, marginTop:10 }}>
                  <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:800, fontSize:13, letterSpacing:1.5, color:C.copper, textTransform:"uppercase", marginBottom:10 }}>ðŸ“ˆ Model Agreement</div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>
                    {[{l:"Elo",p:elo.homeProb},{l:"RAPTOR",p:rap.homeProb},{l:"4 Factors",p:ff.homeProb},{l:"ML/BPI",p:ml.homeProb},{l:"Monte Carlo",p:mc.homeProb}].map(m=>{
                      const fav = m.p>0.5;
                      return (
                        <div key={m.l} style={{ textAlign:"center", background:C.black, borderRadius:8, padding:"10px 6px", border:`1px solid ${fav?C.teal+"44":C.border}` }}>
                          <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:900, fontSize:22, color:fav?C.teal:C.white }}>{(m.p*100).toFixed(0)}%</div>
                          <div style={{ fontSize:10, color:fav?C.teal:C.muted, fontWeight:700, marginBottom:2 }}>{fav?ABBR[awayTeam]:ABBR[homeTeam]}</div>
                          <div style={{ fontSize:9, color:C.dim, textTransform:"uppercase", letterSpacing:0.5 }}>{m.l}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>}

              {tab==="method" && (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  {[
                    {icon:"â™Ÿï¸",n:"Elo Rating (18%)",d:"Win rate â†’ Elo (baseline 1500). Last 10 net rating adjusts dynamically. Home court = +100 Elo pts. Win probability: 1/(1+10^(diff/400))."},
                    {icon:"ðŸ‘¤",n:"RAPTOR / Player Impact (22%)",d:"Each player's PER multiplied by availability weight: OUT=0%, DOUBTFUL=25%, QUESTIONABLE=65%, PLAYING=100%. Win prob = home share of total roster value."},
                    {icon:"ðŸ“",n:"Net Rating / Four Factors (22%)",d:"eFG% (40%) + TOV rate (25%) + OREB% (20%) + FTR (15%). Blended with net rating differential. Injury drag applied by status and role."},
                    {icon:"ðŸ¤–",n:"ML / BPI-Style (22%)",d:"Logistic regression across 7 features: net rating, win%, offensive efficiency, defensive efficiency, L10 form, injury penalty, home court intercept."},
                    {icon:"ðŸŽ²",n:"Monte Carlo (16%)",d:"10,000 game simulations. Each team's score drawn from normal distribution (Ïƒ=11) centered on expected output vs opponent defense, adjusted for injuries."},
                    {icon:"ðŸ†",n:"Consensus Weighting",d:"EloÃ—18% + RAPTORÃ—22% + Four FactorsÃ—22% + MLÃ—22% + MCÃ—16%. RAPTOR and ML carry highest weight due to injury sensitivity."},
                  ].map(({icon,n,d})=>(
                    <div key={n} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:16 }}>
                      <div style={{ fontSize:22, marginBottom:8 }}>{icon}</div>
                      <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:800, fontSize:13, color:C.copper, letterSpacing:0.5, marginBottom:6 }}>{n}</div>
                      <div style={{ fontSize:11, color:C.muted, lineHeight:1.7 }}>{d}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        <div style={{ fontSize:10, color:C.dim, textAlign:"center", padding:"16px 0 8px", lineHeight:1.8 }}>
          âš ï¸ For informational &amp; entertainment purposes only Â· Not financial advice Â· Gamble responsibly
        </div>
      </div>
    </div>
  );
}

