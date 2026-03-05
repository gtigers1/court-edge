export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });
  const { team, sport } = req.body || {};
  if (!team) return res.status(400).json({ error: "team required" });

  // ESPN API team slugs (confirmed from espn.com)
  const NBA_SLUG = {"Atlanta Hawks":"atl","Boston Celtics":"bos","Brooklyn Nets":"bkn","Charlotte Hornets":"cha","Chicago Bulls":"chi","Cleveland Cavaliers":"cle","Dallas Mavericks":"dal","Denver Nuggets":"den","Detroit Pistons":"det","Golden State Warriors":"gs","Houston Rockets":"hou","Indiana Pacers":"ind","LA Clippers":"lac","Los Angeles Lakers":"lal","Memphis Grizzlies":"mem","Miami Heat":"mia","Milwaukee Bucks":"mil","Minnesota Timberwolves":"min","New Orleans Pelicans":"no","New York Knicks":"ny","Oklahoma City Thunder":"okc","Orlando Magic":"orl","Philadelphia 76ers":"phi","Phoenix Suns":"phx","Portland Trail Blazers":"por","Sacramento Kings":"sac","San Antonio Spurs":"sa","Toronto Raptors":"tor","Utah Jazz":"utah","Washington Wizards":"wsh"};
  const NHL_SLUG = {"Anaheim Ducks":"ana","Boston Bruins":"bos","Buffalo Sabres":"buf","Calgary Flames":"cgy","Carolina Hurricanes":"car","Chicago Blackhawks":"chi","Colorado Avalanche":"col","Columbus Blue Jackets":"cbj","Dallas Stars":"dal","Detroit Red Wings":"det","Edmonton Oilers":"edm","Florida Panthers":"fla","Los Angeles Kings":"la","Minnesota Wild":"min","Montreal Canadiens":"mtl","Nashville Predators":"nsh","New Jersey Devils":"nj","New York Islanders":"nyi","New York Rangers":"nyr","Ottawa Senators":"ott","Philadelphia Flyers":"phi","Pittsburgh Penguins":"pit","San Jose Sharks":"sj","Seattle Kraken":"sea","St. Louis Blues":"stl","Tampa Bay Lightning":"tb","Toronto Maple Leafs":"tor","Utah Mammoth":"utah","Vancouver Canucks":"van","Vegas Golden Knights":"vgk","Washington Capitals":"wsh","Winnipeg Jets":"wpg"};

  const slug = sport === "nhl" ? NHL_SLUG[team] : NBA_SLUG[team];
  if (!slug) return res.status(400).json({ error: "Unknown team: " + team });

  // Dynamic date for search queries - always current month/year
  const now = new Date();
  const monthYear = now.toLocaleString('en-US', { month: 'long', year: 'numeric' }); // e.g. "April 2026"

  try {
    // Step 1: Fetch full roster from ESPN public API (with stats if available)
    const espnSport = sport === "nhl" ? "hockey/nhl" : "basketball/nba";
    const espnSeason = "2026"; // 2025-26 season (year the season ends)
    const rosterUrl = `https://site.api.espn.com/apis/site/v2/sports/${espnSport}/teams/${slug}/roster?enable=stats&season=${espnSeason}`;
    const rosterResp = await fetch(rosterUrl);
    const rosterJson = await rosterResp.json();

    // Step 2: Fetch team record/stats from ESPN
    const teamUrl = `https://site.api.espn.com/apis/site/v2/sports/${espnSport}/teams/${slug}?season=${espnSeason}`;
    const teamResp = await fetch(teamUrl);
    const teamJson = await teamResp.json();

    // Extract team record - find the TOTAL/OVERALL record, not home/away/conf splits
    const recordItems = teamJson?.team?.record?.items || [];
    const totalRec = recordItems.find(i => i.type === "total" || i.description?.toLowerCase().includes("overall")) || recordItems[0] || {};
    const record = totalRec.stats || [];
    const getStat = (name) => parseFloat(record.find(s => s.name === name)?.value || 0);
    const wins = getStat("wins") || parseInt(totalRec.summary?.split("-")[0]) || 30;
    const losses = getStat("losses") || parseInt(totalRec.summary?.split("-")[1]) || 20;

    // Step 2b: Fetch schedule for L10, rest, home/away splits, Elo, and H2H data
    const teamNumId = String(teamJson?.team?.id || "");
    let l10ppg = null, l10opp = null;
    let daysSinceLastGame = 2;
    let hSplit = null, aSplit = null;
    let teamElo = 1500;
    let teamGames = [];
    let injuryMap = {};
    let espnTeamStats = {};
    try {
      const [schedResp, injResp, statsResp] = await Promise.all([
        fetch(`https://site.api.espn.com/apis/site/v2/sports/${espnSport}/teams/${slug}/schedule`),
        fetch(`https://site.api.espn.com/apis/site/v2/sports/${espnSport}/injuries`),
        fetch(`https://site.api.espn.com/apis/site/v2/sports/${espnSport}/teams/${slug}/statistics?season=${espnSeason}`)
      ]);
      const schedJson = await schedResp.json();
      const completed = (schedJson?.events || []).filter(e => e.competitions?.[0]?.status?.type?.completed === true);

      // Rest
      if (completed.length > 0) {
        const lastDate = new Date(completed[completed.length - 1].date);
        daysSinceLastGame = Math.max(0, Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24)));
      }

      // L10
      const last10 = completed.slice(-10);
      let l10SF = 0, l10AG = 0, l10Cnt = 0;
      for (const ev of last10) {
        const comp = ev.competitions?.[0];
        const ours = comp?.competitors?.find(c => String(c.id) === teamNumId);
        const theirs = comp?.competitors?.find(c => String(c.id) !== teamNumId);
        if (ours?.score != null && theirs?.score != null) { l10SF += parseFloat(ours.score)||0; l10AG += parseFloat(theirs.score)||0; l10Cnt++; }
      }
      if (l10Cnt >= 3) { l10ppg = l10SF / l10Cnt; l10opp = l10AG / l10Cnt; }

      // Single pass: home/away splits + Elo + H2H game log
      let hSF = 0, hAG = 0, hCnt = 0, aSF = 0, aAG = 0, aCnt = 0;
      const ELO_K = 30;
      for (const ev of completed) {
        const comp = ev.competitions?.[0];
        if (!comp) continue;
        const ours = comp.competitors?.find(c => String(c.id) === teamNumId);
        const theirs = comp.competitors?.find(c => String(c.id) !== teamNumId);
        if (!ours || !theirs || ours.score == null || theirs.score == null) continue;
        const s = parseFloat(ours.score) || 0, t = parseFloat(theirs.score) || 0;
        const isHome = ours.homeAway === "home";
        const win = s > t ? 1 : 0;
        if (theirs.id) teamGames.push({ opp: String(theirs.id), win: win === 1 });
        const effElo = teamElo + (isHome ? 50 : -50);
        const expected = 1 / (1 + Math.pow(10, (1500 - effElo) / 400));
        const margin = Math.abs(s - t);
        const marginMult = Math.max(0.5, Math.log(margin + 1) / Math.log(15));
        teamElo += ELO_K * marginMult * (win - expected);
        if (isHome) { hSF += s; hAG += t; hCnt++; } else { aSF += s; aAG += t; aCnt++; }
      }
      if (hCnt >= 8) hSplit = { sf: hSF / hCnt, ag: hAG / hCnt };
      if (aCnt >= 8) aSplit = { sf: aSF / aCnt, ag: aAG / aCnt };

      // Build injury map from ESPN injury endpoint
      try {
        const injJson = await injResp.json();
        const normN = s => (s||"").toLowerCase().replace(/[^a-z]/g,"");
        const mapStatus = s => {
          if (!s) return null;
          const sl = s.toLowerCase();
          if (sl.includes("day-to-day")) return "QUESTIONABLE";
          if (sl === "out" || sl.includes("injured reserve") || sl.includes("suspension")) return "OUT";
          return null;
        };
        for (const teamEntry of (injJson.injuries || [])) {
          for (const inj of (teamEntry.injuries || [])) {
            const mapped = mapStatus(inj.status);
            if (mapped && inj.athlete?.displayName) {
              injuryMap[normN(inj.athlete.displayName)] = mapped;
            }
          }
        }
      } catch(_) {}

      // ESPN team statistics - live team-level stats (PPG, eFG%, TOV, shots, etc.)
      try {
        const sJson = await statsResp.json();
        const flat = (sJson?.results?.stats?.categories || []).flatMap(c => c.stats || []);
        const tStat = n => { const s = flat.find(x => x.name === n || x.abbreviation === n); return s ? parseFloat(s.value) : null; };
        if (sport === "nba") {
          const ppg  = tStat("avgPoints");
          const opp  = tStat("avgPointsAllowed");
          const fgm  = tStat("fieldGoalsMade"),   fga = tStat("fieldGoalsAttempted");
          const tpm  = tStat("threePointFieldGoalsMade");
          const fta  = tStat("freeThrowsAttempted");
          const tov  = tStat("avgTurnovers");
          const oreb = tStat("avgOffensiveRebounds");
          const ofgm = tStat("opponentFieldGoalsMade");
          const ofga = tStat("opponentFieldGoalsAttempted") ?? tStat("oppFieldGoalsAttempted");
          const otpm = tStat("opponentThreePointFieldGoalsMade");
          const otov = tStat("opponentTurnovers") ?? tStat("avgOpponentTurnovers");
          const ofta = tStat("opponentFreeThrowsAttempted") ?? tStat("oppFreeThrowsAttempted");
          const odreb= tStat("opponentDefensiveRebounds") ?? tStat("avgOpponentDefensiveRebounds");
          const gp   = tStat("gamesPlayed") || 82;
          if (ppg)  espnTeamStats.ppg  = parseFloat(ppg.toFixed(1));
          if (opp)  espnTeamStats.opp  = parseFloat(opp.toFixed(1));
          if (fgm && fga && tpm) espnTeamStats.efg_pct = parseFloat(((fgm + 0.5*tpm) / fga).toFixed(3));
          if (tov && fga && fta) espnTeamStats.tov_rate = parseFloat((100 * tov / (fga/gp + 0.44*(fta/gp) + tov)).toFixed(1));
          if (oreb && odreb) espnTeamStats.oreb_pct = parseFloat((oreb / (oreb + odreb)).toFixed(3));
          if (fta && fga) espnTeamStats.ftr = parseFloat(((fta/gp) / (fga/gp)).toFixed(3));
          if (ofgm && ofga && otpm) espnTeamStats.opp_efg_pct = parseFloat(((ofgm + 0.5*otpm) / ofga).toFixed(3));
          if (otov && ofga && ofta) espnTeamStats.opp_tov_rate = parseFloat((100 * otov / (ofga/gp + 0.44*(ofta/gp) + otov)).toFixed(1));
        } else {
          const gf   = tStat("avgGoals") ?? tStat("goals");
          const ga   = tStat("goalsAgainst") ?? tStat("avgGoalsAgainst");
          const shots= tStat("avgShotsOnGoal") ?? tStat("shotsOnGoal");
          const sa   = tStat("avgShotsAgainst") ?? tStat("shotsAgainst");
          const ppGls= tStat("powerPlayGoals");
          const ppo  = tStat("powerPlayOpportunities");
          const ppga = tStat("powerPlayGoalsAllowed");
          const ppoa = tStat("powerPlayOpportunitiesAllowed") ?? tStat("penaltyKillOpportunities");
          if (gf)    espnTeamStats.gf_pg   = parseFloat((gf).toFixed(2));
          if (ga)    espnTeamStats.ga_pg   = parseFloat((ga).toFixed(2));
          if (shots) espnTeamStats.shots_pg = parseFloat((shots).toFixed(1));
          if (sa)    espnTeamStats.shots_against_pg = parseFloat((sa).toFixed(1));
          if (ppGls != null && ppo > 0) espnTeamStats.pp_pct = parseFloat((ppGls / ppo * 100).toFixed(1));
          if (ppga != null && ppoa > 0) espnTeamStats.pk_pct = parseFloat(((1 - ppga/ppoa) * 100).toFixed(1));
        }
      } catch(_) {}
    } catch(_) {}

    // Step 3: Extract players from ESPN roster API
    const athletes = rosterJson?.athletes || [];
    // NBA returns flat array, NHL returns grouped by position group
    let allPlayers = [];
    if (Array.isArray(athletes) && athletes.length > 0) {
      if (athletes[0]?.items) {
        // NHL: grouped format [{position:"Forwards",items:[...]}, ...]
        for (const group of athletes) {
          allPlayers = allPlayers.concat(group.items || []);
        }
      } else {
        allPlayers = athletes;
      }
    }

    // Get player names, positions, and any stats ESPN returns directly
    const playerNames = allPlayers.map(p => {
      // Handle multiple ESPN response formats for stats:
      // Format A (newer): statistics.splits.categories[].stats
      // Format B (older): statistics.splits[].stats  (array)
      // Format C: statistics.categories[].stats
      // Format D: statistics.stats
      const rawSplits = p.statistics?.splits;
      const statsArr = (
        rawSplits?.categories?.flatMap(c => c.stats || []) ||
        (Array.isArray(rawSplits) ? rawSplits[0]?.stats : null) ||
        p.statistics?.categories?.flatMap(c => c.stats || []) ||
        p.statistics?.stats || []
      );
      const espnStat = name => { const s = statsArr.find(x => x.name === name || x.abbreviation === name); return s ? parseFloat(s.value) : null; };
      const ppg = espnStat("avgPoints") ?? espnStat("pts") ?? espnStat("PTS") ?? espnStat("PPG");
      const rpg = espnStat("avgRebounds") ?? espnStat("reb") ?? espnStat("REB") ?? espnStat("RPG");
      const apg = espnStat("avgAssists") ?? espnStat("ast") ?? espnStat("AST") ?? espnStat("APG");
      return {
        name: p.fullName || p.displayName || "Unknown",
        position: p.position?.abbreviation || "F",
        jersey: p.jersey || "",
        ppg: ppg > 0 ? ppg : null,
        rpg: rpg > 0 ? rpg : null,
        apg: apg > 0 ? apg : null,
      };
    }).filter(p => p.name !== "Unknown").slice(0, 25);

    if (playerNames.length === 0) {
      return res.status(500).json({ error: "ESPN roster empty for " + team, rosterUrl });
    }

    // Step 4: Run two Haiku searches in parallel — team stats + individual player stats
    const nameList = playerNames.map(p => p.name).join(", ");
    const [search, playerSearch] = await Promise.all([
      fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 800,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: sport === "nhl"
            ? team + " NHL " + monthYear + " expected starting goalie tonight, last 10 games record, injury report"
            : team + " NBA " + monthYear + " last 10 games record wins losses, notable injuries or lineup changes"
          }]
        })
      }),
      sport === "nhl" ? Promise.resolve(null) : fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: team + " 2025-26 NBA player stats per game: " + nameList + ". Find PPG RPG APG for each player this season." }]
        })
      })
    ]);
    const sd = await search.json();
    const searchText = (sd.content || []).filter(b => b.type === "text").map(b => b.text).join("").slice(0, 1500);
    const psd = playerSearch ? await playerSearch.json() : null;
    const playerSearchText = psd ? (psd.content || []).filter(b => b.type === "text").map(b => b.text).join("").slice(0, 1500) : "";

    // Step 5: Sonnet formats with exact ESPN names + stats
    // Include any ESPN-sourced stats as hints so Sonnet uses exact values instead of guessing
    const playerList = playerNames.map(p => {
      if (sport === "nhl") return p.name + " (" + p.position + ")";
      const hints = [];
      if (p.ppg != null) hints.push("PPG:" + p.ppg.toFixed(1));
      if (p.rpg != null) hints.push("RPG:" + p.rpg.toFixed(1));
      if (p.apg != null) hints.push("APG:" + p.apg.toFixed(1));
      return hints.length > 0 ? p.name + " [" + hints.join(" ") + "]" : p.name;
    }).join(", ");
    const nbaSchema = '{"wins":0,"losses":0,"ppg":112,"opp":110,"efg_pct":0.52,"tov_rate":13,"oreb_pct":0.25,"ftr":0.22,"opp_efg_pct":0.52,"opp_tov_rate":13,"opp_oreb_pct":0.25,"opp_ftr":0.22,"last10":"5-5","last10_ppg":112,"last10_opp":110,"roster":[{"name":"exact name from list","ppg":20.0,"rpg":5.0,"apg":3.0,"per":17.0,"role":"STAR","status":"PLAYING"}]}';
    const nhlSchema = '{"wins":0,"losses":0,"otl":0,"points":0,"gf_pg":3.0,"ga_pg":2.8,"shots_pg":30,"shots_against_pg":28,"pp_pct":22,"pk_pct":80,"last10_gf":3.0,"last10_ga":2.8,"goalie":{"name":"exact goalie name","save_pct":0.910,"gaa":2.80,"status":"PLAYING"},"roster":[{"name":"exact name","goals":10,"assists":20,"points":30,"plus_minus":5,"position":"LW","role":"KEY","status":"PLAYING"}]}';

    const fmt = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2500,
        system: "Output only a single raw JSON object. No markdown, no explanation, no code fences.",
        messages: [{ role: "user", content: "Build JSON for " + team + " " + sport.toUpperCase() + ".\n\nALL players (use EXACT names, include ALL of them):\n" + playerList + "\n\nTeam stats:\n" + searchText + (playerSearchText ? "\n\nPlayer stats:\n" + playerSearchText : "") + "\n\nSchema:\n" + (sport === "nhl" ? nhlSchema : nbaSchema) + "\n\nCRITICAL: Include EVERY player in the list above in the roster array. " + (sport === "nhl" ? "Separate goalies from skaters - put starting goalie in goalie field, rest in roster. role=STAR if points>40, KEY if points>20, else ROLE. Use position from the list." : "Players shown with [PPG:X RPG:Y APG:Z] have CONFIRMED stats — copy those values EXACTLY. For all others use the Player stats section above to find real values — do NOT make up numbers. role=STAR if ppg>20, KEY if ppg>11, else ROLE. per=ppg*0.9+rpg*0.3+apg*0.5 (e.g. 25ppg/10rpg/8apg = 30.5). Include rpg and apg for each player.") }]
      })
    });
    const fd = await fmt.json();
    if (!fmt.ok) return res.status(502).json({ error: fd.error?.message || "Format error" });
    const raw = (fd.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();

    let parsed = null;
    try { parsed = JSON.parse(raw); } catch(_) {}
    if (!parsed) { try { parsed = JSON.parse(raw.replace(/^```json\s*/i,"").replace(/\s*```$/,"")); } catch(_) {} }
    if (!parsed) { try { const i=raw.indexOf("{"),j=raw.lastIndexOf("}"); if(i>=0&&j>i) parsed=JSON.parse(raw.slice(i,j+1)); } catch(_) {} }
    if (!parsed) return res.status(500).json({ error: "Parse failed", espnPlayerCount: playerNames.length, raw: raw.slice(0,200) });

    // Normalize
    parsed.rest = daysSinceLastGame;
    parsed.elo = Math.round(teamElo);
    parsed.espn_id = teamNumId;
    parsed.games = teamGames;
    if (sport === "nhl") {
      // Always use ESPN's live record when valid
      parsed.wins = wins > 0 ? wins : (parsed.wins || 0);
      parsed.losses = losses > 0 ? losses : (parsed.losses || 0);
      parsed.otl=parsed.otl??5;
      parsed.points=parsed.points||(parsed.wins*2+parsed.otl); parsed.gf_pg=parsed.gf_pg||3.0;
      parsed.ga_pg=parsed.ga_pg||2.8; parsed.shots_pg=parsed.shots_pg||30;
      parsed.shots_against_pg=parsed.shots_against_pg||28; parsed.pp_pct=parsed.pp_pct||20;
      parsed.pk_pct=parsed.pk_pct||80;
      parsed.last10_gf=l10ppg!=null?parseFloat(l10ppg.toFixed(2)):(parsed.last10_gf||parsed.gf_pg);
      parsed.last10_ga=l10opp!=null?parseFloat(l10opp.toFixed(2)):(parsed.last10_ga||parsed.ga_pg);
      // Home/away goal splits
      if (hSplit) { parsed.home_gf=parseFloat(hSplit.sf.toFixed(2)); parsed.home_ga=parseFloat(hSplit.ag.toFixed(2)); }
      if (aSplit) { parsed.away_gf=parseFloat(aSplit.sf.toFixed(2)); parsed.away_ga=parseFloat(aSplit.ag.toFixed(2)); }
      const normN = s => (s||"").toLowerCase().replace(/[^a-z]/g,"");
      parsed.roster=(parsed.roster||[]).map(p=>({name:p.name||"Unknown",goals:p.goals??0,assists:p.assists??0,points:p.points??0,plus_minus:p.plus_minus??0,position:p.position||"F",role:p.role||"ROLE",status:injuryMap[normN(p.name||"")]||"PLAYING"}));
      if(parsed.goalie){parsed.goalie.status=injuryMap[normN(parsed.goalie.name||"")]||"PLAYING";}
    } else {
      // Always use ESPN's live record when valid - never let Claude override it
      parsed.wins = wins > 0 ? wins : (parsed.wins || 0);
      parsed.losses = losses > 0 ? losses : (parsed.losses || 0);
      parsed.ppg=parsed.ppg||112; parsed.opp=parsed.opp||112;
      parsed.efg_pct=parsed.efg_pct||0.52; parsed.tov_rate=parsed.tov_rate||13.5;
      parsed.oreb_pct=parsed.oreb_pct||0.26; parsed.ftr=parsed.ftr||0.22;
      parsed.opp_efg_pct=parsed.opp_efg_pct||0.52; parsed.opp_tov_rate=parsed.opp_tov_rate||13.5;
      parsed.opp_oreb_pct=parsed.opp_oreb_pct||0.26; parsed.opp_ftr=parsed.opp_ftr||0.22;
      parsed.last10=parsed.last10||"5-5";
      parsed.last10_ppg=l10ppg!=null?parseFloat(l10ppg.toFixed(1)):(parsed.last10_ppg||parsed.ppg);
      parsed.last10_opp=l10opp!=null?parseFloat(l10opp.toFixed(1)):(parsed.last10_opp||parsed.opp);
      // Home/away scoring splits
      if (hSplit) { parsed.home_ppg=parseFloat(hSplit.sf.toFixed(1)); parsed.home_opp=parseFloat(hSplit.ag.toFixed(1)); }
      if (aSplit) { parsed.away_ppg=parseFloat(aSplit.sf.toFixed(1)); parsed.away_opp=parseFloat(aSplit.ag.toFixed(1)); }
      const normN = s => (s||"").toLowerCase().replace(/[^a-z]/g,"");
      parsed.roster=(parsed.roster||[]).map(p=>({name:p.name||"Unknown",ppg:p.ppg||10,rpg:p.rpg||3,apg:p.apg||1,per:p.per||((p.ppg||10)*0.9+(p.rpg||3)*0.3+(p.apg||1)*0.5),role:p.role||"ROLE",status:injuryMap[normN(p.name||"")]||"PLAYING"}));
    }
    // Always override with ESPN's live team stats (PPG, OPP, eFG%, shots, etc.)
    // espnTeamStats only contains keys ESPN returned; this does not touch roster or record
    if (Object.keys(espnTeamStats).length > 0) Object.assign(parsed, espnTeamStats);
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}