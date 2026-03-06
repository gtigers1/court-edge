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
  // NBA.com franchise IDs for player stats API (stats.nba.com)
  const NBA_COM_ID = {"Atlanta Hawks":1610612737,"Boston Celtics":1610612738,"Brooklyn Nets":1610612751,"Charlotte Hornets":1610612766,"Chicago Bulls":1610612741,"Cleveland Cavaliers":1610612739,"Dallas Mavericks":1610612742,"Denver Nuggets":1610612743,"Detroit Pistons":1610612765,"Golden State Warriors":1610612744,"Houston Rockets":1610612745,"Indiana Pacers":1610612754,"LA Clippers":1610612746,"Los Angeles Lakers":1610612747,"Memphis Grizzlies":1610612763,"Miami Heat":1610612748,"Milwaukee Bucks":1610612749,"Minnesota Timberwolves":1610612750,"New Orleans Pelicans":1610612740,"New York Knicks":1610612752,"Oklahoma City Thunder":1610612760,"Orlando Magic":1610612753,"Philadelphia 76ers":1610612755,"Phoenix Suns":1610612756,"Portland Trail Blazers":1610612757,"Sacramento Kings":1610612758,"San Antonio Spurs":1610612759,"Toronto Raptors":1610612761,"Utah Jazz":1610612762,"Washington Wizards":1610612764};

  const slug = sport === "nhl" ? NHL_SLUG[team] : NBA_SLUG[team];
  if (!slug) return res.status(400).json({ error: "Unknown team: " + team });

  // Dynamic date for search queries - always current month/year
  const now = new Date();
  const monthYear = now.toLocaleString('en-US', { month: 'long', year: 'numeric' }); // e.g. "April 2026"

  try {
    const espnSport = sport === "nhl" ? "hockey/nhl" : "basketball/nba";
    const espnSeason = "2026"; // 2025-26 season (year the season ends)

    // NBA.com player stats setup
    const nbaComTeamId = sport === "nba" ? (NBA_COM_ID[team] || null) : null;
    const nbaComUrl = nbaComTeamId ? `https://stats.nba.com/stats/leaguedashplayerstats?PerMode=PerGame&Season=2025-26&TeamID=${nbaComTeamId}&MeasureType=Base&PaceAdjust=N&PlusMinus=N&Rank=N&SeasonType=Regular%20Season` : null;
    const nbaHeaders = {"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36","Accept":"application/json, text/plain, */*","Accept-Language":"en-US,en;q=0.9","Referer":"https://www.nba.com/","x-nba-stats-origin":"stats","x-nba-stats-token":"true"};

    // Step 1: Fetch ALL external data in one parallel batch (roster + team + schedule + injuries + stats + NBA.com)
    const [rosterResp, teamResp, schedResp, injResp, statsResp, nbaComResp] = await Promise.all([
      fetch(`https://site.api.espn.com/apis/site/v2/sports/${espnSport}/teams/${slug}/roster?enable=stats&season=${espnSeason}`),
      fetch(`https://site.api.espn.com/apis/site/v2/sports/${espnSport}/teams/${slug}?season=${espnSeason}`),
      fetch(`https://site.api.espn.com/apis/site/v2/sports/${espnSport}/teams/${slug}/schedule`),
      fetch(`https://site.api.espn.com/apis/site/v2/sports/${espnSport}/injuries`),
      fetch(`https://site.api.espn.com/apis/site/v2/sports/${espnSport}/teams/${slug}/statistics?season=${espnSeason}`),
      nbaComUrl ? fetch(nbaComUrl, { headers: nbaHeaders }).catch(() => null) : Promise.resolve(null)
    ]);

    // Step 2: Parse JSON in parallel
    const [rosterJson, teamJson, schedJson] = await Promise.all([
      rosterResp.json(),
      teamResp.json(),
      schedResp.json()
    ]);

    // Extract team record - find the TOTAL/OVERALL record, not home/away/conf splits
    const recordItems = teamJson?.team?.record?.items || [];
    const totalRec = recordItems.find(i => i.type === "total" || i.description?.toLowerCase().includes("overall")) || recordItems[0] || {};
    const recordStats = totalRec.stats || [];
    const getStat = (name) => parseFloat(recordStats.find(s => s.name === name)?.value || 0);
    const wins = getStat("wins") || parseInt(totalRec.summary?.split("-")[0]) || 30;
    const losses = getStat("losses") || parseInt(totalRec.summary?.split("-")[1]) || 20;
    const teamNumId = String(teamJson?.team?.id || "");

    // Process schedule: rest, L10 PPG + W/L, home/away splits, Elo, H2H
    const completed = (schedJson?.events || []).filter(e => e.competitions?.[0]?.status?.type?.completed === true);
    let l10ppg = null, l10opp = null, l10wins = 0, l10losses = 0;
    let daysSinceLastGame = 2;
    let hSplit = null, aSplit = null;
    let teamElo = 1500;
    let teamGames = [];

    if (completed.length > 0) {
      const lastDate = new Date(completed[completed.length - 1].date);
      daysSinceLastGame = Math.max(0, Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24)));
    }

    const last10 = completed.slice(-10);
    let l10SF = 0, l10AG = 0, l10Cnt = 0;
    for (const ev of last10) {
      const comp = ev.competitions?.[0];
      const ours = comp?.competitors?.find(c => String(c.id) === teamNumId);
      const theirs = comp?.competitors?.find(c => String(c.id) !== teamNumId);
      if (ours?.score != null && theirs?.score != null) {
        const s = parseFloat(ours.score)||0, t = parseFloat(theirs.score)||0;
        l10SF += s; l10AG += t; l10Cnt++;
        if (s > t) l10wins++; else l10losses++;
      }
    }
    if (l10Cnt >= 3) { l10ppg = l10SF / l10Cnt; l10opp = l10AG / l10Cnt; }

    let hSF = 0, hAG = 0, hCnt = 0, aSF = 0, aAG = 0, aCnt = 0;
    let sSF = 0, sAG = 0, sCnt = 0; // full-season PPG/OPP from real game scores
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
      sSF += s; sAG += t; sCnt++;
    }
    if (hCnt >= 8) hSplit = { sf: hSF / hCnt, ag: hAG / hCnt };
    if (aCnt >= 8) aSplit = { sf: aSF / aCnt, ag: aAG / aCnt };
    const schedPPG = sCnt >= 10 ? parseFloat((sSF / sCnt).toFixed(1)) : null;
    const schedOPP = sCnt >= 10 ? parseFloat((sAG / sCnt).toFixed(1)) : null;

    // Shared normalization helper
    const normKey = s => (s||"").toLowerCase().replace(/[^a-z]/g,"");

    // Parse injuries
    let injuryMap = {};
    try {
      const injJson = await injResp.json();
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
            injuryMap[normKey(inj.athlete.displayName)] = mapped;
          }
        }
      }
    } catch(_) {}

    // Parse ESPN team statistics - live team-level stats (PPG, eFG%, TOV, shots, etc.)
    let espnTeamStats = {};
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

    // Parse NBA.com player stats - live per-game stats per player (PPG/RPG/APG)
    let nbaStatsMap = {};
    if (nbaComResp) {
      try {
        const nbaComJson = await nbaComResp.json();
        const rs = (nbaComJson.resultSets || []).find(r => r.name === "LeagueDashPlayerStats");
        if (rs) {
          const h = rs.headers;
          const nameIdx = h.indexOf("PLAYER_NAME");
          const ptsIdx  = h.indexOf("PTS");
          const rebIdx  = h.indexOf("REB");
          const astIdx  = h.indexOf("AST");
          for (const row of (rs.rowSet || [])) {
            const pName = row[nameIdx];
            if (pName) {
              nbaStatsMap[normKey(pName)] = {
                ppg: row[ptsIdx] != null ? parseFloat(row[ptsIdx]) : null,
                rpg: row[rebIdx] != null ? parseFloat(row[rebIdx]) : null,
                apg: row[astIdx] != null ? parseFloat(row[astIdx]) : null,
              };
            }
          }
        }
      } catch(_) {}
    }

    // Step 3: Extract players from ESPN roster API
    const athletes = rosterJson?.athletes || [];
    // NBA returns flat array, NHL returns grouped by position group
    let allPlayers = [];
    if (Array.isArray(athletes) && athletes.length > 0) {
      if (athletes[0]?.items) {
        // NHL: grouped format [{position:"Forwards",items:[...]}, ...]
        for (const group of athletes) { allPlayers = allPlayers.concat(group.items || []); }
      } else {
        allPlayers = athletes;
      }
    }

    // Build player list, preferring NBA.com stats (live) over ESPN's unreliable stats field
    const playerNames = allPlayers.map(p => {
      const fullName = p.fullName || p.displayName || "Unknown";
      // NBA: prefer NBA.com live stats
      if (sport === "nba" && Object.keys(nbaStatsMap).length > 0) {
        const nb = nbaStatsMap[normKey(fullName)];
        if (nb) return { name: fullName, position: p.position?.abbreviation || "F", jersey: p.jersey || "", ppg: nb.ppg, rpg: nb.rpg, apg: nb.apg };
      }
      // Fallback: ESPN stat formats (A: splits.categories, B: splits[], C: categories, D: stats)
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
      return { name: fullName, position: p.position?.abbreviation || "F", jersey: p.jersey || "", ppg: ppg > 0 ? ppg : null, rpg: rpg > 0 ? rpg : null, apg: apg > 0 ? apg : null };
    }).filter(p => p.name !== "Unknown").slice(0, 25);

    if (playerNames.length === 0) {
      return res.status(500).json({ error: "ESPN roster empty for " + team });
    }

    // Step 4: NBA response - team stats from ESPN, player stats from NBA.com (or Haiku fallback)
    if (sport === "nba") {
      // Base result: all team-level fields from ESPN + schedule (no AI needed)
      const baseResult = {
        wins,
        losses,
        ppg:          espnTeamStats.ppg          || schedPPG || 112,
        opp:          espnTeamStats.opp          || schedOPP || 112,
        efg_pct:      espnTeamStats.efg_pct      || 0.52,
        tov_rate:     espnTeamStats.tov_rate     || 13.5,
        oreb_pct:     espnTeamStats.oreb_pct     || 0.26,
        ftr:          espnTeamStats.ftr          || 0.22,
        opp_efg_pct:  espnTeamStats.opp_efg_pct  || 0.52,
        opp_tov_rate: espnTeamStats.opp_tov_rate || 13.5,
        opp_oreb_pct: 0.26,
        opp_ftr:      0.22,
        last10:     l10Cnt > 0 ? (l10wins + "-" + l10losses) : "5-5",
        last10_ppg: l10ppg != null ? parseFloat(l10ppg.toFixed(1)) : (espnTeamStats.ppg || schedPPG || 112),
        last10_opp: l10opp != null ? parseFloat(l10opp.toFixed(1)) : (espnTeamStats.opp || schedOPP || 112),
        rest:    daysSinceLastGame,
        elo:     Math.round(teamElo),
        espn_id: teamNumId,
        games:   teamGames,
      };
      if (hSplit) { baseResult.home_ppg = parseFloat(hSplit.sf.toFixed(1)); baseResult.home_opp = parseFloat(hSplit.ag.toFixed(1)); }
      if (aSplit) { baseResult.away_ppg = parseFloat(aSplit.sf.toFixed(1)); baseResult.away_opp = parseFloat(aSplit.ag.toFixed(1)); }

      const buildRoster = (players) => players.map(p => {
        const ppg = p.ppg != null ? parseFloat(p.ppg.toFixed(1)) : 5.0;
        const rpg = p.rpg != null ? parseFloat(p.rpg.toFixed(1)) : 2.0;
        const apg = p.apg != null ? parseFloat(p.apg.toFixed(1)) : 1.0;
        const per = parseFloat((ppg*0.9 + rpg*0.3 + apg*0.5).toFixed(1));
        const role = ppg > 20 ? "STAR" : ppg > 11 ? "KEY" : "ROLE";
        const status = injuryMap[normKey(p.name || "")] || "PLAYING";
        return { name: p.name, ppg, rpg, apg, per, role, status };
      });

      // Fast path: NBA.com returned stats for most players - no AI needed
      if (Object.keys(nbaStatsMap).length >= 8) {
        return res.status(200).json({ ...baseResult, roster: buildRoster(playerNames) });
      }

      // Tier 2: Try ESPN per-athlete stats API (~200ms, no AI needed)
      // sports.core.api.espn.com returns current season stats per athlete ID
      try {
        const espnAthleteStats = await Promise.all(
          allPlayers.slice(0, 20).map(p =>
            p.id ? fetch(`https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/${espnSeason}/types/2/athletes/${p.id}/statistics`)
              .then(r => r.ok ? r.json() : null).catch(() => null)
            : Promise.resolve(null)
          )
        );
        const players20 = allPlayers.slice(0, 20);
        for (let i = 0; i < players20.length; i++) {
          const d = espnAthleteStats[i];
          if (!d) continue;
          const flat = (d.splits?.categories || []).flatMap(c => c.stats || []);
          const gs = n => { const s = flat.find(x => x.name === n || x.abbreviation === n); return s ? parseFloat(s.value) : null; };
          const ppg = gs("avgPoints") ?? gs("points");
          const rpg = gs("avgRebounds") ?? gs("rebounds");
          const apg = gs("avgAssists") ?? gs("assists");
          if (ppg !== null) {
            nbaStatsMap[normKey(players20[i].fullName || players20[i].displayName || "")] = { ppg, rpg, apg };
          }
        }
      } catch(_) {}

      if (Object.keys(nbaStatsMap).length >= 8) {
        const updated = playerNames.map(p => { const s = nbaStatsMap[normKey(p.name)]; return s ? { ...p, ...s } : p; });
        return res.status(200).json({ ...baseResult, roster: buildRoster(updated) });
      }

      // Tier 3: Dual parallel Haiku searches (split roster in half for double coverage) + Sonnet roster
      const half = Math.ceil(playerNames.length / 2);
      const names1 = playerNames.slice(0, half).map(p => p.name).join(", ");
      const names2 = playerNames.slice(half).map(p => p.name).join(", ");
      const haikuCall = (names) => fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: team + " NBA 2025-26 season stats per game " + monthYear + ": " + names + ". List PPG RPG APG for each player." }]
        })
      });
      const [r1, r2] = await Promise.all([haikuCall(names1), haikuCall(names2)]);
      const [j1, j2] = await Promise.all([r1.json(), r2.json()]);
      const txt = (arr) => (arr.content || []).filter(b => b.type === "text").map(b => b.text).join("").slice(0, 1200);
      const playerSearchText = txt(j1) + "\n\n" + txt(j2);

      const rosterSchema = '[{"name":"exact name from list","ppg":20.0,"rpg":5.0,"apg":3.0}]';
      const fmt = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1200,
          system: "Output only a raw JSON array. No markdown, no explanation, no code fences.",
          messages: [{ role: "user", content: "Extract per-game stats for ALL " + team + " NBA players from the search results below.\n\nPlayer list (use EXACT names, include ALL):\n" + playerNames.map(p => p.name).join(", ") + "\n\nStats data:\n" + playerSearchText + "\n\nSchema:\n" + rosterSchema + "\n\nInclude EVERY player. Use real stats from the data; use 5/2/1 only if genuinely not found." }]
        })
      });
      const fd = await fmt.json();
      const rawRoster = (fd.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
      let rosterArr = null;
      try { rosterArr = JSON.parse(rawRoster); } catch(_) {}
      if (!rosterArr) { try { rosterArr = JSON.parse(rawRoster.replace(/^```json\s*/i,"").replace(/\s*```$/,"")); } catch(_) {} }
      if (!rosterArr) { try { const i=rawRoster.indexOf("["),j=rawRoster.lastIndexOf("]"); if(i>=0&&j>i) rosterArr=JSON.parse(rawRoster.slice(i,j+1)); } catch(_) {} }

      return res.status(200).json({ ...baseResult, roster: buildRoster(rosterArr || playerNames) });
    }

    // Step 5: NHL path - Haiku search for goalie/context, then Sonnet to format roster
    // (NHL player stats not publicly available, must use AI search)
    const nameList = playerNames.map(p => p.name + " (" + p.position + ")").join(", ");
    const search = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: team + " NHL " + monthYear + " expected starting goalie tonight, last 10 games record, injury report" }]
      })
    });
    const sd = await search.json();
    const searchText = (sd.content || []).filter(b => b.type === "text").map(b => b.text).join("").slice(0, 1500);

    const nhlSchema = '{"wins":0,"losses":0,"otl":0,"points":0,"gf_pg":3.0,"ga_pg":2.8,"shots_pg":30,"shots_against_pg":28,"pp_pct":22,"pk_pct":80,"last10_gf":3.0,"last10_ga":2.8,"goalie":{"name":"exact goalie name","save_pct":0.910,"gaa":2.80,"status":"PLAYING"},"roster":[{"name":"exact name","goals":10,"assists":20,"points":30,"plus_minus":5,"position":"LW","role":"KEY","status":"PLAYING"}]}';
    const fmt = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2500,
        system: "Output only a single raw JSON object. No markdown, no explanation, no code fences.",
        messages: [{ role: "user", content: "Build JSON for " + team + " NHL.\n\nALL players (use EXACT names, include ALL of them):\n" + nameList + "\n\nTeam stats:\n" + searchText + "\n\nSchema:\n" + nhlSchema + "\n\nCRITICAL: Include EVERY player in the list above in the roster array. Separate goalies from skaters - put starting goalie in goalie field, rest in roster. role=STAR if points>40, KEY if points>20, else ROLE. Use position from the list." }]
      })
    });
    const fd = await fmt.json();
    if (!fmt.ok) return res.status(502).json({ error: fd.error?.message || "Format error" });
    const raw = (fd.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();

    let parsed = null;
    try { parsed = JSON.parse(raw); } catch(_) {}
    if (!parsed) { try { parsed = JSON.parse(raw.replace(/^```json\s*/i,"").replace(/\s*```$/,"")); } catch(_) {} }
    if (!parsed) { try { const i=raw.indexOf("{"),j=raw.lastIndexOf("}"); if(i>=0&&j>i) parsed=JSON.parse(raw.slice(i,j+1)); } catch(_) {} }
    if (!parsed) return res.status(500).json({ error: "Parse failed", raw: raw.slice(0,200) });

    // Normalize NHL
    parsed.rest = daysSinceLastGame;
    parsed.elo = Math.round(teamElo);
    parsed.espn_id = teamNumId;
    parsed.games = teamGames;
    parsed.wins = wins > 0 ? wins : (parsed.wins || 0);
    parsed.losses = losses > 0 ? losses : (parsed.losses || 0);
    parsed.otl = parsed.otl ?? 5;
    parsed.points = parsed.points || (parsed.wins*2 + parsed.otl);
    parsed.gf_pg = parsed.gf_pg || 3.0;
    parsed.ga_pg = parsed.ga_pg || 2.8;
    parsed.shots_pg = parsed.shots_pg || 30;
    parsed.shots_against_pg = parsed.shots_against_pg || 28;
    parsed.pp_pct = parsed.pp_pct || 20;
    parsed.pk_pct = parsed.pk_pct || 80;
    parsed.last10_gf = l10ppg != null ? parseFloat(l10ppg.toFixed(2)) : (parsed.last10_gf || parsed.gf_pg);
    parsed.last10_ga = l10opp != null ? parseFloat(l10opp.toFixed(2)) : (parsed.last10_ga || parsed.ga_pg);
    if (hSplit) { parsed.home_gf = parseFloat(hSplit.sf.toFixed(2)); parsed.home_ga = parseFloat(hSplit.ag.toFixed(2)); }
    if (aSplit) { parsed.away_gf = parseFloat(aSplit.sf.toFixed(2)); parsed.away_ga = parseFloat(aSplit.ag.toFixed(2)); }
    parsed.roster = (parsed.roster||[]).map(p => ({name:p.name||"Unknown",goals:p.goals??0,assists:p.assists??0,points:p.points??0,plus_minus:p.plus_minus??0,position:p.position||"F",role:p.role||"ROLE",status:injuryMap[normKey(p.name||"")]||"PLAYING"}));
    if (parsed.goalie) { parsed.goalie.status = injuryMap[normKey(parsed.goalie.name || "")] || "PLAYING"; }

    // Override with ESPN live team stats (shots, PP%, PK%)
    if (Object.keys(espnTeamStats).length > 0) Object.assign(parsed, espnTeamStats);

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
