// NBA Spread Model Backtest — 2025-26 season
// Usage: node scripts/backtest.mjs [--verbose] [--from YYYYMMDD] [--to YYYYMMDD]
// Fetches completed games + spreads from ESPN, runs model, measures ATS accuracy.

const args = process.argv.slice(2);
const VERBOSE = args.includes("--verbose");
const FROM_DATE = args.find(a => a.match(/^\d{8}$/) && args[args.indexOf(a)-1]==="--from") || "20251022";
const TO_DATE = args.find(a => a.match(/^\d{8}$/) && args[args.indexOf(a)-1]==="--to") || (() => { const d=new Date(); return d.getFullYear()+""+String(d.getMonth()+1).padStart(2,"0")+String(d.getDate()-1).padStart(2,"0"); })();

// ── Model helpers (mirrors App.js) ──────────────────────────────────────────
const logistic = x => 1/(1+Math.exp(-x));
const pythagorean = (ppg,opp,exp) => { const p=Math.pow(ppg,exp),o=Math.pow(opp,exp); return p/(p+o); };

function injPenSimple(roster, s=0.09, k=0.04, r=0.01) {
  if (!Array.isArray(roster)) return 0;
  const sorted = [...roster].sort((a,b)=>(b.per||0)-(a.per||0));
  return sorted.slice(0,5).reduce((sum,p,i)=>{
    const w=[s,k,r,r*0.5,r*0.25][i]||0;
    const pen=p.status==="OUT"?w:p.status==="QUESTIONABLE"?w*0.38:p.status==="DOUBTFUL"?w*0.80:0;
    return sum+pen;
  },0);
}

function nbaMdlNetRating(h,a) {
  const hNet=(h.home_ppg||h.ppg)-(h.home_opp||h.opp);
  const aNet=(a.away_ppg||a.ppg)-(a.away_opp||a.opp);
  const hRecNet=(h.last10_ppg||h.ppg)-(h.last10_opp||h.opp);
  const aRecNet=(a.last10_ppg||a.ppg)-(a.last10_opp||a.opp);
  const hBlend=hNet*0.55+hRecNet*0.45, aBlend=aNet*0.55+aRecNet*0.45;
  const hi=injPenSimple(h.roster,0.10,0.05,0.01);
  const ai=injPenSimple(a.roster,0.10,0.05,0.01);
  return (hBlend-aBlend)+3.2-(hi-ai)*18;
}

function nbaMdlMonteCarlo(h,a) {
  // Multiplicative efficiency: team_offense × (opponent_defense / league_avg)
  const LEAGUE_PPG=114;
  // Blend season avg 50% with recent form 50% for more adaptability
  const hOff=(h.home_ppg||h.ppg)*0.50+(h.last10_ppg||h.ppg)*0.50;
  const aOff=(a.away_ppg||a.ppg)*0.50+(a.last10_ppg||a.ppg)*0.50;
  const hDefQ=(h.home_opp||h.opp)*0.50+(h.last10_opp||h.opp)*0.50;
  const aDefQ=(a.away_opp||a.opp)*0.50+(a.last10_opp||a.opp)*0.50;
  const hExp=hOff*(aDefQ/LEAGUE_PPG)+1.6;
  const aExp=aOff*(hDefQ/LEAGUE_PPG);
  return hExp-aExp;
}

function nbaMdlWinRate(h,a) {
  const hWP=h.wins/Math.max(h.wins+h.losses,1);
  const aWP=a.wins/Math.max(a.wins+a.losses,1);
  return (hWP-aWP)*28+3.2;
}

function nbaMdlFourFactors(h,a) {
  const ff=d=>{
    const efg=(d.efg_pct||0.52)*0.47;
    const tov=(1-Math.min(d.tov_rate||13,25)/25)*0.27;
    const oreb=(d.oreb_pct||0.25)*0.18;
    const ftr=Math.min(d.ftr||0.22,0.50)*0.08;
    return efg+tov+oreb+ftr;
  };
  const hFF=ff(h), aFF=ff(a);
  const hFFadj=hFF+0.002*0.47+0.001*0.27;
  const hi=injPenSimple(h.roster,0.06,0.03,0.008);
  const ai=injPenSimple(a.roster,0.06,0.03,0.008);
  const ffInput=(hFFadj-aFF)*12-(hi-ai)*3.5;
  return ffInput*7.0;
}

function modelSpread(h, a, weights={mc:0.35,nr:0.35,ff:0.15,elo:0.15,wr:0}) {
  const mcS = nbaMdlMonteCarlo(h,a);
  const nrS = nbaMdlNetRating(h,a);
  const ffS = nbaMdlFourFactors(h,a);
  const wrS = nbaMdlWinRate(h,a);
  const hElo=h.elo||1500, aElo=a.elo||1500;
  const eloS = (hElo-aElo)/28+3.2;
  const wr=weights.wr||0;
  const total=weights.mc+weights.nr+weights.ff+weights.elo+wr;
  return (mcS*weights.mc + nrS*weights.nr + ffS*weights.ff + eloS*weights.elo + wrS*wr)/total;
}

// ── ESPN API helpers ─────────────────────────────────────────────────────────
async function fetchJSON(url) {
  const r = await fetch(url, {headers:{"User-Agent":"Mozilla/5.0"}});
  if (!r.ok) return null;
  return r.json().catch(()=>null);
}

// Get completed game IDs + scores for a date (YYYYMMDD)
async function getGamesForDate(date) {
  const d = await fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${date}&limit=30`);
  if (!d?.events) return [];
  return d.events
    .filter(e => e.competitions?.[0]?.status?.type?.completed)
    .map(e => {
      const comp = e.competitions[0];
      const home = comp.competitors.find(c=>c.homeAway==="home");
      const away = comp.competitors.find(c=>c.homeAway==="away");
      if (!home||!away) return null;
      return {
        eventId: e.id,
        date,
        homeTeam: home.team.displayName,
        homeAbbr: home.team.abbreviation,
        homeId:   home.team.id,
        homeScore: parseFloat(home.score)||0,
        awayTeam: away.team.displayName,
        awayAbbr: away.team.abbreviation,
        awayId:   away.team.id,
        awayScore: parseFloat(away.score)||0,
        actualMargin: (parseFloat(home.score)||0)-(parseFloat(away.score)||0), // positive = home won
      };
    }).filter(Boolean);
}

// Get posted spread for a game via summary endpoint
async function getSpread(eventId) {
  const d = await fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${eventId}`);
  const pc = d?.pickcenter;
  if (!Array.isArray(pc)||pc.length===0) return null;
  // pickcenter[0].spread: negative = home favored (e.g. -6.5 means home team is -6.5)
  const spread = pc[0]?.spread;
  const total  = pc[0]?.overUnder;
  const detail = pc[0]?.details||"";
  if (spread==null) return null;
  return { homeSpread: spread, total, detail };
}

// ESPN team stats (maps name → stats object)
const ESPN_SLUG = {"Atlanta Hawks":"atl","Boston Celtics":"bos","Brooklyn Nets":"bkn","Charlotte Hornets":"cha","Chicago Bulls":"chi","Cleveland Cavaliers":"cle","Dallas Mavericks":"dal","Denver Nuggets":"den","Detroit Pistons":"det","Golden State Warriors":"gs","Houston Rockets":"hou","Indiana Pacers":"ind","LA Clippers":"lac","Los Angeles Lakers":"lal","Memphis Grizzlies":"mem","Miami Heat":"mia","Milwaukee Bucks":"mil","Minnesota Timberwolves":"min","New Orleans Pelicans":"no","New York Knicks":"ny","Oklahoma City Thunder":"okc","Orlando Magic":"orl","Philadelphia 76ers":"phi","Phoenix Suns":"phx","Portland Trail Blazers":"por","Sacramento Kings":"sac","San Antonio Spurs":"sa","Toronto Raptors":"tor","Utah Jazz":"utah","Washington Wizards":"wsh"};

const teamCache = {};

async function fetchTeamStats(teamName) {
  if (teamCache[teamName]) return teamCache[teamName];
  const slug = ESPN_SLUG[teamName];
  if (!slug) return null;

  const [statsResp, schedResp] = await Promise.all([
    fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${slug}/statistics?season=2026`),
    fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${slug}/schedule?season=2026`),
  ]);

  // Parse ESPN team stats
  const flat = (statsResp?.results?.stats?.categories||[]).flatMap(c=>c.stats||[]);
  const tStat = n => { const s=flat.find(x=>x.name===n||x.abbreviation===n); return s?parseFloat(s.value):null; };
  const ppg  = tStat("avgPoints");
  const opp  = tStat("avgPointsAllowed");
  const fgm  = tStat("fieldGoalsMade"), fga=tStat("fieldGoalsAttempted");
  const tpm  = tStat("threePointFieldGoalsMade");
  const fta  = tStat("freeThrowsAttempted");
  const tovR = tStat("avgTurnovers");
  const oreb = tStat("avgOffensiveRebounds");
  const odreb= tStat("opponentDefensiveRebounds")??tStat("avgOpponentDefensiveRebounds");
  const gp   = tStat("gamesPlayed")||82;
  const directPace = tStat("pace")??tStat("avgPossessions");

  let efg_pct=null, tov_rate=null, oreb_pct=null, ftr=null, pace=null;
  if (fgm&&fga&&tpm) efg_pct=(fgm+0.5*tpm)/fga;
  if (tovR&&fga&&fta) tov_rate=100*tovR/((fga/gp)+0.44*(fta/gp)+tovR);
  if (oreb&&odreb) oreb_pct=oreb/(oreb+odreb);
  if (fta&&fga) ftr=(fta/gp)/(fga/gp);
  if (directPace&&directPace>80&&directPace<125) pace=directPace;
  else if (fga&&tovR!=null&&fta&&oreb!=null&&gp>0) { const est=(fga/gp)-oreb+tovR+0.44*(fta/gp); if(est>80&&est<125) pace=est; }

  // Parse schedule: home/away splits, last10, ELO
  const teamJson = await fetchJSON(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${slug}?season=2026`);
  const recordItems = teamJson?.team?.record?.items||[];
  const totalRec = recordItems.find(i=>i.type==="total"||i.description?.toLowerCase().includes("overall"))||recordItems[0]||{};
  const rStats = totalRec.stats||[];
  const gS = n=>parseFloat(rStats.find(s=>s.name===n)?.value||0);
  const wins=gS("wins")||parseInt(totalRec.summary?.split("-")[0])||0;
  const losses=gS("losses")||parseInt(totalRec.summary?.split("-")[1])||0;
  const teamNumId = String(teamJson?.team?.id||"");

  const completed=(schedResp?.events||[]).filter(e=>e.competitions?.[0]?.status?.type?.completed);
  let hSF=0,hAG=0,hCnt=0,aSF=0,aAG=0,aCnt=0,sSF=0,sAG=0,sCnt=0;
  let l10SF=0,l10AG=0,l10Cnt=0,l10W=0,l10L=0;
  let teamElo=1500;
  const ELO_K=30;
  const scoreVal = c => parseFloat(c?.score?.value ?? c?.score?.displayValue ?? c?.score) || 0;
  const last10=completed.slice(-10);
  for (const ev of last10) {
    const comp=ev.competitions?.[0];
    const ours=comp?.competitors?.find(c=>String(c.id)===teamNumId);
    const theirs=comp?.competitors?.find(c=>String(c.id)!==teamNumId);
    if (ours&&theirs) {
      const s=scoreVal(ours),t=scoreVal(theirs);
      if(s>0||t>0){l10SF+=s;l10AG+=t;l10Cnt++;if(s>t)l10W++;else l10L++;}
    }
  }
  for (const ev of completed) {
    const comp=ev.competitions?.[0]; if(!comp)continue;
    const ours=comp.competitors?.find(c=>String(c.id)===teamNumId);
    const theirs=comp.competitors?.find(c=>String(c.id)!==teamNumId);
    if (!ours||!theirs)continue;
    const s=scoreVal(ours),t=scoreVal(theirs);
    if(s===0&&t===0)continue;
    const isHome=ours.homeAway==="home";
    const win=s>t?1:0;
    const effElo=teamElo+(isHome?50:-50);
    const expected=1/(1+Math.pow(10,(1500-effElo)/400));
    const mm=Math.max(0.5,Math.log(Math.abs(s-t)+1)/Math.log(15));
    teamElo+=ELO_K*mm*(win-expected);
    if(isHome){hSF+=s;hAG+=t;hCnt++;}else{aSF+=s;aAG+=t;aCnt++;}
    sSF+=s;sAG+=t;sCnt++;
  }

  const stats = {
    wins, losses,
    ppg:  ppg||  (sCnt>0?sSF/sCnt:114),
    opp:  opp||  (sCnt>0?sAG/sCnt:114),
    home_ppg: hCnt>=5?hSF/hCnt:null,
    home_opp: hCnt>=5?hAG/hCnt:null,
    away_ppg: aCnt>=5?aSF/aCnt:null,
    away_opp: aCnt>=5?aAG/aCnt:null,
    last10_ppg: l10Cnt>=3?l10SF/l10Cnt:null,
    last10_opp: l10Cnt>=3?l10AG/l10Cnt:null,
    efg_pct:  efg_pct||0.52,
    tov_rate: tov_rate||13.5,
    oreb_pct: oreb_pct||0.26,
    ftr:      ftr||0.22,
    pace:     pace||99,
    elo:      Math.round(teamElo),
    roster:   [], // no roster needed for team-level backtest
  };
  teamCache[teamName]=stats;
  return stats;
}

// ── Date range helpers ────────────────────────────────────────────────────────
function dateRange(from, to) {
  const dates=[];
  let d=new Date(from.slice(0,4)+"-"+from.slice(4,6)+"-"+from.slice(6,8));
  const end=new Date(to.slice(0,4)+"-"+to.slice(4,6)+"-"+to.slice(6,8));
  while(d<=end) {
    dates.push(d.getFullYear()+""+String(d.getMonth()+1).padStart(2,"0")+String(d.getDate()).padStart(2,"0"));
    d.setDate(d.getDate()+1);
  }
  return dates;
}

// ── Weight configurations to test ─────────────────────────────────────────────
const WEIGHT_CONFIGS = [
  {name:"FixedMC (MC35 NR35 FF15 ELO15)",  mc:0.35, nr:0.35, ff:0.15, elo:0.15, wr:0},
  {name:"MC-heavy (MC50 NR35 FF10 ELO05)", mc:0.50, nr:0.35, ff:0.10, elo:0.05, wr:0},
  {name:"MC-dominant (MC60 NR30 FF10 ELO00)", mc:0.60, nr:0.30, ff:0.10, elo:0.00, wr:0},
  {name:"MC+NR equal (MC45 NR45 FF10 ELO00)", mc:0.45, nr:0.45, ff:0.10, elo:0.00, wr:0},
  {name:"NR-heavy (MC25 NR55 FF10 ELO10)", mc:0.25, nr:0.55, ff:0.10, elo:0.10, wr:0},
  {name:"NR-only (NR80 ELO20)",            mc:0.00, nr:0.80, ff:0.00, elo:0.20, wr:0.00},
  {name:"MC-only (MC90 ELO10)",            mc:0.90, nr:0.00, ff:0.00, elo:0.10, wr:0},
  {name:"No-FF-No-ELO (MC50 NR50)",        mc:0.50, nr:0.50, ff:0.00, elo:0.00, wr:0},
  {name:"MC35+WR15 (MC35 NR35 FF10 ELO10 WR10)", mc:0.35, nr:0.35, ff:0.10, elo:0.10, wr:0.10},
];

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n=== NBA Spread Model Backtest ===`);
  console.log(`Period: ${FROM_DATE} → ${TO_DATE}\n`);

  const dates = dateRange(FROM_DATE, TO_DATE);
  console.log(`Fetching ${dates.length} days of games...`);

  // Collect all games
  const games = [];
  let processed = 0;
  for (const date of dates) {
    const dayGames = await getGamesForDate(date);
    for (const game of dayGames) {
      // Rate limit
      await new Promise(r=>setTimeout(r,150));
      const spreadData = await getSpread(game.eventId);
      if (!spreadData) continue; // skip games with no spread data
      games.push({...game, ...spreadData});
    }
    processed++;
    if (processed%10===0) process.stdout.write(`  ${processed}/${dates.length} days (${games.length} games w/ spreads)...\r`);
  }
  console.log(`\nFound ${games.length} games with spread data.`);
  if (games.length===0) { console.log("No games found. Check date range."); return; }

  // Fetch team stats (cache)
  const teamNames = [...new Set(games.flatMap(g=>[g.homeTeam,g.awayTeam]))];
  console.log(`\nFetching stats for ${teamNames.length} teams...`);
  await Promise.all(teamNames.map((t,i)=>new Promise(async res=>{
    await new Promise(r=>setTimeout(r,i*200));
    await fetchTeamStats(t);
    res();
  })));
  console.log("Team stats loaded.\n");

  // Run model + collect results
  const results = [];
  let noData = 0;
  for (const game of games) {
    const h = teamCache[game.homeTeam];
    const a = teamCache[game.awayTeam];
    if (!h||!a) { noData++; continue; }

    const postedHomeSpread = game.homeSpread; // negative = home favored
    const actualMargin = game.actualMargin;   // positive = home won

    // ATS result: home covers if actualMargin > -homeSpread
    // e.g. homeSpread=-6.5 → home covers if actualMargin > 6.5
    // e.g. homeSpread=+4.5 → home covers if actualMargin > -4.5 (home wins or loses by <4.5)
    const homeCoversActual = actualMargin > -postedHomeSpread;

    results.push({ game, h, a, postedHomeSpread, actualMargin, homeCoversActual });
  }
  console.log(`Skipped ${noData} games with missing team data.\n`);
  console.log(`Running model on ${results.length} games...\n`);

  // Test each weight configuration
  for (const weights of WEIGHT_CONFIGS) {
    let correct=0, total=0;
    const errors = []; // (model_spread - posted_spread) for wrong picks
    const buckets = {bigFav:[0,0], modFav:[0,0], small:[0,0], modDog:[0,0], bigDog:[0,0]};

    for (const {game, h, a, postedHomeSpread, actualMargin, homeCoversActual} of results) {
      const ms = modelSpread(h, a, weights);
      // Model picks home if ms > -postedHomeSpread (model thinks home will cover)
      // Model picks away if ms < -postedHomeSpread
      const modelPicksHome = ms > -postedHomeSpread;
      const win = modelPicksHome === homeCoversActual;

      // Bucket by posted spread size
      const absSpread = Math.abs(postedHomeSpread);
      const bucket = absSpread>=12?"bigFav":absSpread>=7?"modFav":absSpread>=3?"small":absSpread>=1?"modDog":"bigDog";
      buckets[bucket][0]+=win?1:0; buckets[bucket][1]++;

      if (win) correct++;
      else errors.push(ms-(-postedHomeSpread)); // positive = model thought home had more edge than line
      total++;

      if (VERBOSE&&weights.name.includes("Current")) {
        const pick = modelPicksHome ? `${game.homeAbbr} ${postedHomeSpread}` : `${game.awayAbbr} ${-postedHomeSpread>0?"+"+(-postedHomeSpread).toFixed(1):(-postedHomeSpread).toFixed(1)}`;
        const res = win?"✓":"✗";
        console.log(`${res} ${game.date} ${game.awayAbbr}@${game.homeAbbr} | Line:${postedHomeSpread} | Model:${ms.toFixed(1)} | Actual:${actualMargin.toFixed(0)} | Pick:${pick}`);
      }
    }

    const pct = (correct/total*100).toFixed(1);
    const avgErr = errors.length>0?(errors.reduce((s,e)=>s+e,0)/errors.length).toFixed(2):0;
    console.log(`[${weights.name.padEnd(45)}] ${correct}/${total} = ${pct}%`);
    if (VERBOSE) {
      const bFmt=(k)=>`${k}: ${buckets[k][0]}/${buckets[k][1]}=${buckets[k][1]>0?(buckets[k][0]/buckets[k][1]*100).toFixed(0):0}%`;
      console.log(`  Buckets: ${bFmt("bigFav")} | ${bFmt("modFav")} | ${bFmt("small")} | avg miss:${avgErr}`);
    }
  }

  // Detailed analysis of worst losses for current weights
  console.log("\n── Worst model misses (FixedMC weights, per-component breakdown) ─────────");
  const current = WEIGHT_CONFIGS[0];
  const misses = results
    .map(r => {
      const mc=nbaMdlMonteCarlo(r.h,r.a);
      const nr=nbaMdlNetRating(r.h,r.a);
      const ff=nbaMdlFourFactors(r.h,r.a);
      const wr=nbaMdlWinRate(r.h,r.a);
      const elo=(r.h.elo||1500-r.a.elo||1500)/28+3.2;
      const ms=modelSpread(r.h,r.a,current);
      const modelPicksHome = ms > -r.postedHomeSpread;
      const win = modelPicksHome===r.homeCoversActual;
      return { ...r, ms, mc, nr, ff, wr, modelPicksHome, win };
    })
    .filter(r=>!r.win)
    .sort((a,b)=>Math.abs(b.ms-(-b.postedHomeSpread))-Math.abs(a.ms-(-a.postedHomeSpread)))
    .slice(0,15);

  for (const r of misses) {
    const gap=(r.ms-(-r.postedHomeSpread)).toFixed(1);
    const pick=r.modelPicksHome?`${r.game.homeAbbr}${r.postedHomeSpread}`:`${r.game.awayAbbr}${(-r.postedHomeSpread).toFixed(1)}`;
    console.log(`${r.game.date} ${r.game.awayAbbr}@${r.game.homeAbbr} | Line:${r.postedHomeSpread} Model:${r.ms.toFixed(1)} (MC:${r.mc.toFixed(1)} NR:${r.nr.toFixed(1)} FF:${r.ff.toFixed(1)} WR:${r.wr.toFixed(1)}) gap:${gap} | actual:${r.actualMargin.toFixed(0)} | pick:${pick} ✗`);
  }

  // Spread distribution analysis
  console.log("\n── Spread distribution in dataset ──");
  const spread_buckets={};
  for (const {postedHomeSpread,homeCoversActual} of results) {
    const k=Math.round(postedHomeSpread/2)*2;
    if(!spread_buckets[k])spread_buckets[k]={total:0,homeCovers:0};
    spread_buckets[k].total++;
    if(homeCoversActual)spread_buckets[k].homeCovers++;
  }
  const keys=Object.keys(spread_buckets).map(Number).sort((a,b)=>a-b);
  for (const k of keys) {
    const b=spread_buckets[k];
    const hcPct=(b.homeCovers/b.total*100).toFixed(0);
    console.log(`  Spread ~${k}: ${b.total} games, home covers ${hcPct}%`);
  }

  // Naive baselines
  const alwaysFav = results.filter(r=>r.postedHomeSpread<0?r.homeCoversActual:!r.homeCoversActual).length/results.length*100;
  const alwaysDog = 100-alwaysFav;
  console.log(`\n── Baselines ──`);
  console.log(`Always bet favorite:   ${alwaysFav.toFixed(1)}%`);
  console.log(`Always bet underdog:   ${alwaysDog.toFixed(1)}%`);
  console.log(`Random (coin flip):    50.0%`);
  console.log(`Target:                65.0%`);
  console.log(`\nNeed ${Math.ceil(results.length*0.65)} correct out of ${results.length} for 65% target.`);

  // Calibration: how do model spreads compare to Vegas and actual margins?
  console.log("\n── Model calibration (FixedMC config) ──");
  const calW = WEIGHT_CONFIGS[0];
  let sumMdl=0,sumVegas=0,sumActual=0,sumMdlSq=0;
  let sameDirCount=0;
  let sumMC=0,sumNR=0,sumFF=0,sumWR=0,sumELO=0;
  for (const {game,h,a,postedHomeSpread,actualMargin} of results) {
    const ms=modelSpread(h,a,calW);
    const vegasLine=-postedHomeSpread;
    sumMdl+=Math.abs(ms); sumVegas+=Math.abs(vegasLine); sumActual+=Math.abs(actualMargin);
    sumMdlSq+=Math.pow(ms-actualMargin,2);
    if((ms>0)===(vegasLine>0))sameDirCount++;
    sumMC+=Math.abs(nbaMdlMonteCarlo(h,a));
    sumNR+=Math.abs(nbaMdlNetRating(h,a));
    sumFF+=Math.abs(nbaMdlFourFactors(h,a));
    sumWR+=Math.abs(nbaMdlWinRate(h,a));
  }
  const n=results.length;
  console.log(`Avg |model spread|:  ${(sumMdl/n).toFixed(2)} pts (MC:${(sumMC/n).toFixed(1)} NR:${(sumNR/n).toFixed(1)} FF:${(sumFF/n).toFixed(1)} WR:${(sumWR/n).toFixed(1)})`);
  console.log(`Avg |Vegas line|:    ${(sumVegas/n).toFixed(2)} pts`);
  console.log(`Avg |actual margin|: ${(sumActual/n).toFixed(2)} pts`);
  console.log(`Model RMSE vs actual: ${Math.sqrt(sumMdlSq/n).toFixed(2)} pts`);
  console.log(`Model agrees Vegas direction: ${(sameDirCount/n*100).toFixed(1)}%`);

  // Test different scale factors
  console.log("\n── Scale factor sweep (model direction × k vs Vegas line) ──");
  for (const k of [1,2,3,4,5,7,10,20]) {
    let correct=0;
    for (const {h,a,postedHomeSpread,homeCoversActual} of results) {
      const ms=modelSpread(h,a,calW);
      const pickHome=(ms*k)>-postedHomeSpread;
      if((pickHome&&homeCoversActual)||(!pickHome&&!homeCoversActual))correct++;
    }
    console.log(`  Scale ${String(k).padStart(2)}x: ${correct}/${n} = ${(correct/n*100).toFixed(1)}%`);
  }

  // Rule-based strategies using Vegas line size patterns
  console.log("\n── Rule-based strategies ──");
  const bestScaleW = {mc:0.00,nr:0.80,ff:0.00,elo:0.20,wr:0}; // NR-only as best model
  const rules = [
    {name:"Always bet favorite",                pick:(line,ms,h,a)=>line<0},
    {name:"Pure model direction (ms>0=home)",   pick:(line,ms,h,a)=>ms>0},
    {name:"Model scale 3x",                     pick:(line,ms,h,a)=>(ms*3)>-line},
    // Spread-size rules
    {name:"Big fav(|line|≥12): bet fav; else model 3x",
      pick:(line,ms,h,a)=>Math.abs(line)>=12?(line<0):(ms*3)>-line},
    {name:"Big road fav(+8+):away; big home fav(≤-12):home; else model 3x",
      pick:(line,ms,h,a)=>line>=8?false:line<=-12?true:(ms*3)>-line},
    {name:"All |line|≥8: bet fav; small: model 3x",
      pick:(line,ms,h,a)=>Math.abs(line)>=8?(line<0):(ms*3)>-line},
    // NR-only with scaling
    {name:"NR-only scale 4x",
      pick:(line,ms,h,a)=>{const nr=nbaMdlNetRating(h,a);return(nr*4)>-line;}},
    {name:"WR-only scale 4x",
      pick:(line,ms,h,a)=>{const wr=nbaMdlWinRate(h,a);return(wr*4)>-line;}},
    // Selective: only bet when model strongly differs from line
    {name:"High-confidence only (|ms*4 - line|>8, else skip→fav)",
      pick:(line,ms,h,a)=>{const pred=ms*4;const diff=pred-(-line);return Math.abs(diff)>8?pred>-line:line<0;}},
  ];
  for (const rule of rules) {
    let correct=0;
    for (const {h,a,postedHomeSpread,homeCoversActual} of results) {
      const ms=modelSpread(h,a,calW);
      const pickHome=rule.pick(postedHomeSpread,ms,h,a);
      if((pickHome&&homeCoversActual)||(!pickHome&&!homeCoversActual))correct++;
    }
    console.log(`  ${rule.name.padEnd(60)}: ${correct}/${n} = ${(correct/n*100).toFixed(1)}%`);
  }

  // Grid search: find optimal MC/NR weights
  console.log("\n── Grid search: optimal MC vs NR weights (FF=0.10 fixed) ──");
  let best={correct:0,w:null};
  const gridResults=[];
  for (let mc=0; mc<=1.0; mc=Math.round((mc+0.05)*100)/100) {
    for (let nr=0; nr<=1.0-mc; nr=Math.round((nr+0.05)*100)/100) {
      const rem=Math.round((1.0-mc-nr)*100)/100;
      if(rem<0)continue;
      const ff=Math.min(rem,0.10);
      const elo=rem-ff;
      if(elo<0)continue;
      const w={mc,nr,ff,elo,wr:0};
      let correct=0;
      for(const {h,a,postedHomeSpread,homeCoversActual} of results){
        const ms=modelSpread(h,a,w);
        const picks=(ms>-postedHomeSpread)===homeCoversActual;
        if(picks)correct++;
      }
      gridResults.push({mc,nr,ff,elo,correct});
      if(correct>best.correct){best={correct,w:{mc,nr,ff,elo}};}
    }
  }
  // Show top 10
  gridResults.sort((a,b)=>b.correct-a.correct);
  gridResults.slice(0,10).forEach(r=>{
    const pct=(r.correct/n*100).toFixed(1);
    console.log(`  MC:${r.mc.toFixed(2)} NR:${r.nr.toFixed(2)} FF:${r.ff.toFixed(2)} ELO:${r.elo.toFixed(2)} → ${r.correct}/${n} = ${pct}%`);
  });

  // Stats per team: reveal actual PPG/OPP values for calibration
  console.log("\n── Team stats sample (top 6 teams by wins) ──");
  const teamList=Object.entries(teamCache).sort((a,b)=>b[1].wins-a[1].wins).slice(0,6);
  for (const [name,s] of teamList) {
    console.log(`  ${name.padEnd(25)} W:${s.wins} L:${s.losses} PPG:${s.ppg?.toFixed(1)} OPP:${s.opp?.toFixed(1)} home_ppg:${s.home_ppg?.toFixed(1)} away_ppg:${s.away_ppg?.toFixed(1)} last10:${s.last10_ppg?.toFixed(1)}`);
  }
}


main().catch(console.error);
