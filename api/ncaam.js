// ── Hardcoded NET Rankings ─────────────────────────────────────────────────
// Sourced from warrennolan.com NET Nitty Gritty Report, March 18, 2026.
// All 68 NCAA Tournament teams are included with their exact NET rank.
// Used as fallback when ESPN API returns no NET rank (turns badge green→yellow).
const NET_RANKS = {
  // ── All 68 Tournament Teams — actual NET ranks (warrennolan.com Mar 18 2026) ──
  // EAST
  "duke":1,"uconn":10,"connecticut":10,"michigan state":11,"kansas":21,
  "st. john's":16,"st. johns":16,"saint john's":16,"saint johns":16,
  "louisville":17,"ucla":30,"ohio state":29,"tcu":39,"texas christian":39,
  "ucf":51,"central florida":51,"south florida":45,
  "northern iowa":72,"california baptist":98,"cal baptist":98,
  "north dakota state":114,"n dakota state":114,"furman":186,"siena":183,

  // WEST
  "arizona":3,"purdue":9,"gonzaga":7,"arkansas":15,"wisconsin":25,
  "byu":23,"brigham young":23,
  "miami":32, // Miami FL — longer key "miami (oh)" wins for Miami Ohio
  "villanova":35,"utah state":26,"missouri":58,"texas":42,
  "high point":75,"hawaii":101,"hawai'i":101,
  "kennesaw state":155,"kennesaw st":155,
  "queens":189,"long island":198,"liu":198,

  // SOUTH
  "florida":4,"houston":5,"illinois":8,"nebraska":14,"vanderbilt":13,
  "north carolina":24,"tar heels":24,
  "saint mary's":22,"saint marys":22,"st. mary's":22,
  "clemson":34,"iowa":27,"texas a&m":44,"vcu":43,"virginia commonwealth":43,
  "mcneese":56,"mcneese cowboys":56,"troy":125,
  "penn":139,"pennsylvania":139,"idaho":145,"prairie view":300,"prairie view a&m":300,

  // MIDWEST
  "michigan":2,"iowa state":6,"virginia":12,"alabama":18,
  "texas tech":19,"tennessee":20,"kentucky":28,"georgia":33,
  "saint louis":31,"santa clara":40,
  "akron":54,"hofstra":88,"wright state":127,"wright st":127,
  "tennessee state":172,"tennessee st":172,"howard":203,

  // Miami (OH) — longer key beats "miami" above
  "miami (oh)":64,"miami of ohio":64,"miami ohio":64,"miami redhawks":64,

  // ── Non-tournament top 50 for common matchup teams ──
  "michigan state spartans":11, // alias
  "virginia cavaliers":12,
  "nc state":36,"north carolina state":36,
  "smu":37,"southern methodist":37,
  "auburn":38,"indiana":41,"new mexico":46,
  "san diego state":47,"sdsu":47,
  "oklahoma":48,"cincinnati":49,"baylor":50,
  "west virginia":59,"seton hall":53,
  "washington":60,"creighton":62,"marquette":63,
  "butler":65,"notre dame":66,"providence":67,
  "pittsburgh":68,"florida state":69,"wake forest":70,
  "virginia tech":71,"penn state":73,"northwestern":74,
  "minnesota":76,"rutgers":77,"maryland":78,
  "colorado":79,"utah":80,"arizona state":81,"oregon":82,
  "ole miss":83,"mississippi":83,"mississippi state":84,"lsu":85,
  "south carolina":86,"wichita state":87,
  "memphis":89,"tulsa":90,"dayton":91,
  "george mason":92,"richmond":93,"davidson":94,
  "loyola chicago":95,"la salle":96,"george washington":97,
  "fordham":99,"duquesne":100,
  "umass":102,"massachusetts":102,
  "drake":103,"belmont":104,"colgate":105,
  "chattanooga":106,"samford":107,"lipscomb":108,
  "fgcu":109,"florida gulf coast":109,"jacksonville state":110,
  "eastern washington":111,"weber state":112,"montana":113,
  "south dakota state":115,"milwaukee":116,"green bay":117,
  "morehead state":118,"eastern kentucky":119,
};

// Lookup by name match (handles "Illinois Fighting Illini" → "illinois").
// Uses exact-first, then longer-key-first partial match to avoid "miami" swallowing "miami (oh)".
function lookupNetRank(teamName) {
  if (!teamName) return null;
  const lower = teamName.toLowerCase().trim();
  // 1. Exact match
  if (NET_RANKS[lower] != null) return NET_RANKS[lower];
  // 2. Key contained in team name — prefer longest key (most specific)
  let best = null, bestLen = 0;
  for (const [key, rank] of Object.entries(NET_RANKS)) {
    if (lower.includes(key) && key.length > bestLen) { best = rank; bestLen = key.length; }
  }
  if (best != null) return best;
  // 3. Team name contained in key
  for (const [key, rank] of Object.entries(NET_RANKS)) {
    if (key.includes(lower)) return rank;
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const pplxKey = process.env.PERPLEXITY_API_KEY;
  const apiKey  = process.env.ANTHROPIC_API_KEY;
  if (!pplxKey && !apiKey) return res.status(500).json({ error: "PERPLEXITY_API_KEY not set" });
  const { teamId, team } = req.body || {};
  if (!teamId) return res.status(400).json({ error: "teamId required" });

  // Track where each key stat came from for debugging
  const sources = {};

  try {
    // ── 1. ESPN: roster + team info + statistics (concurrent) ───────────────
    const rosterUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${teamId}/roster`;
    const teamUrl   = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${teamId}`;
    const statsUrl  = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${teamId}/statistics`;

    const [rosterResp, teamResp, statsResp] = await Promise.all([
      fetch(rosterUrl), fetch(teamUrl), fetch(statsUrl)
    ]);
    const [rosterJson, teamJson, statsJson] = await Promise.all([
      rosterResp.json(), teamResp.json(), statsResp.json()
    ]);

    const recordSummary = teamJson?.team?.record?.items?.[0]?.summary || "0-0";
    const parts  = recordSummary.split("-");
    const wins   = parseInt(parts[0]) || 15;
    const losses = parseInt(parts[1]) || 15;

    const teamNumId = String(teamJson?.team?.id || teamId || "");
    const rankings  = teamJson?.team?.rankings || [];
    const espnNetRank = rankings.find(r =>
      (r.type?.displayName||"").toLowerCase().includes("net") ||
      (r.name||"").toLowerCase().includes("net")
    )?.current || null;

    // ── 2a. ESPN statistics endpoint — most authoritative team averages ──────
    // Parses the /statistics endpoint which ESPN computes from all season games.
    // More reliable than AI and more complete than computing from game logs.
    let espnStatPPG = null, espnStatOPP = null, espnStatTempo = null;
    try {
      const cats = statsJson?.results?.stats?.categories || [];
      const findStat = (catNames, statNames) => {
        for (const catName of catNames) {
          const cat = cats.find(c =>
            catName.test ? catName.test(c.name||"") : (c.name||"").toLowerCase().includes(catName)
          );
          if (!cat) continue;
          for (const sn of statNames) {
            const s = (cat.stats||[]).find(st =>
              (st.name||"").toLowerCase() === sn.toLowerCase() ||
              (st.abbreviation||"").toLowerCase() === sn.toLowerCase() ||
              (st.displayName||"").toLowerCase().includes(sn.toLowerCase())
            );
            if (s?.value != null) return parseFloat(s.value);
          }
        }
        return null;
      };
      espnStatPPG  = findStat(["scoring","general","offensive"], ["avgPoints","pointsPerGame","pts","ppg","points per game"]);
      espnStatOPP  = findStat(["scoring","general","defensive"], ["avgPointsAgainst","pointsAllowed","opp","points against","opponent points"]);
      espnStatTempo= findStat(["general","pace","tempo"],        ["possessions","pace","tempo","possessionsPerGame"]);
      if (espnStatPPG  != null) sources.ppg  = "ESPN stats endpoint";
      if (espnStatOPP  != null) sources.opp  = "ESPN stats endpoint";
      if (espnStatTempo!= null) sources.tempo= "ESPN stats endpoint";
    } catch(_) {}

    // ── 2b. ESPN: schedule → rest days + rolling Elo + score-based PPG/OPP ──
    let daysSinceLastGame = 2, teamElo = 1500, teamGames = [];
    let sSF = 0, sAG = 0, sCnt = 0;
    try {
      // Must specify season=2026&seasontype=2 (regular season) — without this, ESPN only
      // returns the current postseason game (no score yet), giving sCnt=0 and falling back to AI.
      // seasontype=2 = regular season (30-35 completed games with real scores).
      const schedResp = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${teamId}/schedule?season=2026&seasontype=2`);
      const schedJson = await schedResp.json();
      const completed = (schedJson?.events || []).filter(e => e.competitions?.[0]?.status?.type?.completed === true);
      if (completed.length > 0) {
        const lastDate = new Date(completed[completed.length - 1].date);
        daysSinceLastGame = Math.max(0, Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24)));
      }
      const ELO_K = 30;
      const margins = [];
      for (const ev of completed) {
        const comp  = ev.competitions?.[0];
        if (!comp) continue;
        const ours   = comp.competitors?.find(c => String(c.id) === teamNumId);
        const theirs = comp.competitors?.find(c => String(c.id) !== teamNumId);
        if (!ours || !theirs || ours.score == null || theirs.score == null) continue;
        // score can be a plain string (old format) or an object {value, displayValue} (new format)
        const parseScore = v => typeof v === 'object' ? (v?.value ?? parseFloat(v?.displayValue) ?? 0) : parseFloat(v)||0;
        const s = parseScore(ours.score), t = parseScore(theirs.score);
        if (s > 0 || t > 0) { sSF += s; sAG += t; sCnt++; }
        const win    = s > t ? 1 : 0;
        const isHome = ours.homeAway === "home";
        if (theirs.id) teamGames.push({ opp: String(theirs.id), win: win === 1 });
        margins.push(s - t);
        const effElo   = teamElo + (isHome ? 50 : -50);
        const expected = 1 / (1 + Math.pow(10, (1500 - effElo) / 400));
        teamElo += ELO_K * Math.max(0.5, Math.log(Math.abs(s-t)+1)/Math.log(15)) * (win - expected);
      }
      if (margins.length > 3) {
        const mean = margins.reduce((a,b)=>a+b,0)/margins.length;
        teamGames._marginStddev = parseFloat(Math.sqrt(margins.reduce((s,m)=>s+Math.pow(m-mean,2),0)/margins.length).toFixed(1));
      }
    } catch(_) {}

    // Schedule-computed PPG/OPP: lower threshold to 5 games (was 10)
    const schedPPG = sCnt >= 5 ? parseFloat((sSF / sCnt).toFixed(1)) : null;
    const schedOPP = sCnt >= 5 ? parseFloat((sAG / sCnt).toFixed(1)) : null;
    if (schedPPG != null && sources.ppg == null) sources.ppg = `ESPN reg season scores (${sCnt} games)`;
    if (schedOPP != null && sources.opp == null) sources.opp = `ESPN reg season scores (${sCnt} games)`;

    // ── 3. Extract player IDs + names from roster ────────────────────────────
    const athletes = rosterJson?.athletes || [];
    let allPlayers = [];
    if (Array.isArray(athletes) && athletes.length > 0) {
      if (athletes[0]?.items) {
        for (const group of athletes) allPlayers = allPlayers.concat(group.items || []);
      } else {
        allPlayers = athletes;
      }
    }
    const playerEntries = allPlayers
      .filter(p => p.fullName || p.displayName)
      .slice(0, 15)
      .map(p => ({ id: String(p.id || p.athlete?.id || ""), name: p.fullName || p.displayName || "" }))
      .filter(p => p.name);

    if (playerEntries.length === 0) {
      return res.status(500).json({ error: "ESPN roster empty for " + team, rosterUrl });
    }

    // ── 4. ESPN: per-game stats for every player (concurrent) ────────────────
    const fetchPlayerStats = async ({ id, name }) => {
      if (!id) return { name, espn: false };
      try {
        const r = await fetch(
          `https://site.api.espn.com/apis/common/v3/sports/basketball/mens-college-basketball/athletes/${id}/stats`
        );
        if (!r.ok) return { name, espn: false };
        const d = await r.json();
        const cats   = d?.categories || [];
        const avgCat = cats.find(c => c.name === "averages") || cats[0];
        if (!avgCat) return { name, espn: false };
        const labels   = avgCat.labels || [];
        const nameList = avgCat.names  || [];
        const rows = avgCat.statistics || [];
        const currentRow = rows.reduce((best, row) => {
          if (!best) return row;
          const bYear = best.season?.year || 0, rYear = row.season?.year || 0;
          if (rYear !== bYear) return rYear > bYear ? row : best;
          const bGP = parseFloat((best.stats||[])[0]) || 0;
          const rGP = parseFloat((row.stats ||[])[0]) || 0;
          return rGP > bGP ? row : best;
        }, null);
        if (!currentRow?.stats) return { name, espn: false };
        const statsArr = currentRow.stats;
        const getByLabel = (...keys) => {
          for (const k of keys) {
            let idx = labels.indexOf(k);
            if (idx < 0) idx = nameList.indexOf(k);
            if (idx >= 0 && idx < statsArr.length) {
              const val = parseFloat(statsArr[idx]);
              if (!isNaN(val)) return Math.round(val * 10) / 10;
            }
          }
          return null;
        };
        const ppg = getByLabel("PTS", "avgPoints");
        const rpg = getByLabel("REB", "avgRebounds");
        const apg = getByLabel("AST", "avgAssists");
        const mpg = getByLabel("MIN", "avgMinutes");
        if (ppg === null && rpg === null) return { name, espn: false };
        return { name, ppg, rpg, apg, mpg, espn: true };
      } catch { return { name, espn: false }; }
    };

    const statsResults = await Promise.allSettled(playerEntries.map(fetchPlayerStats));
    const playerStats  = statsResults.map(r => r.status === "fulfilled" ? r.value : { espn: false });
    const needsAI   = playerStats.filter(p => !p.espn).map(p => p.name);
    const playerNames = playerEntries.map(p => p.name);

    // ── 5. Perplexity: team stats + injury status ────────────────────────────
    const teamStatsSchema = JSON.stringify({
      wins:0, losses:0, ppg:75.0, opp:70.0, tempo:68.0,
      efg_pct:0.52, tov_rate:16.0, oreb_pct:0.30, ft_rate:0.35,
      opp_efg_pct:0.50, opp_tov_rate:16.0, opp_oreb_pct:0.28,
      opp_3p_pct:0.335, opp_ftr:0.30, conf_tourney_winner:false,
      conference:"Big Ten", ranking:0, kenpom_rank:100
    });

    const rosterSchemaBlock = playerNames.map(name => {
      const s = playerStats.find(p => p.name === name);
      if (s?.espn) return `{"name":"${name}","status":"PLAYING"}`;
      return `{"name":"${name}","ppg":0,"rpg":0,"apg":0,"mpg":0,"status":"PLAYING"}`;
    }).join(",");

    const promptRules = [
      "wins/losses: current season record",
      "ppg/opp: team season scoring averages — double-check against KenPom or Barttorvik, NOT box score outliers",
      "tempo: possessions per 40 min (KenPom or Barttorvik)",
      "efg_pct as decimal (0.52 = 52%)",
      "opp_3p_pct: opponent 3-point % allowed this season (decimal, e.g. 0.320 = elite, 0.345 = average)",
      "opp_ftr: opponent free throw attempts / opponent field goal attempts (decimal, e.g. 0.28)",
      "conf_tourney_winner: true if team won their conference tournament this season",
      "ranking: AP poll rank, 0 if unranked",
      "kenpom_rank: KenPom or NET rank (1-364) — IMPORTANT: high-major teams (Big Ten, SEC, ACC) are typically ranked 1-80",
      "roster.status: search injury report — OUT=out/injured/suspended, DOUBTFUL=doubtful, QUESTIONABLE=day-to-day, PLAYING=healthy",
      needsAI.length ? `roster ppg/rpg/apg/mpg: season per-game averages (ONLY needed for: ${needsAI.join(", ")})` : null,
    ].filter(Boolean).join("\n- ");

    const userPrompt = `Search for current 2025-26 NCAA basketball stats and injury report for ${team}.

Return ONLY this JSON (fill in all values):
{"wins":0,"losses":0,"ppg":0,"opp":0,"tempo":0,"efg_pct":0,"tov_rate":0,"oreb_pct":0,"ft_rate":0,"opp_efg_pct":0,"opp_tov_rate":0,"opp_oreb_pct":0,"opp_3p_pct":0,"opp_ftr":0,"conf_tourney_winner":false,"conference":"","ranking":0,"kenpom_rank":0,"roster":[${rosterSchemaBlock}]}

Rules:
- ${promptRules}`;

    let raw = "";
    if (pplxKey) {
      const r = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${pplxKey}` },
        body: JSON.stringify({
          model: "sonar-pro",
          messages: [
            { role: "system", content: "You are a sports data API. Return ONLY a raw JSON object. No markdown, no code fences, no explanation." },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.1
        })
      });
      const d = await r.json();
      raw = d.choices?.[0]?.message?.content || "";
    } else {
      const search = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 800, tools: [{ type: "web_search_20250305", name: "web_search" }], messages: [{ role: "user", content: `${team} 2025-26 NCAA basketball: ppg opp tempo efg% tov% oreb% kenpom rank injury report ${playerNames.join(" ")}` }] })
      });
      const sd = await search.json();
      const searchText = (sd.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("").slice(0,2000);
      const fmt = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 2000, system: "Output only a single raw JSON object. No markdown, no code fences.", messages: [{ role: "user", content: `${team} 2025-26 NCAA basketball. Stats: ${searchText}\n\nReturn: ${JSON.stringify({...JSON.parse(teamStatsSchema), roster: playerNames.map(n=>({name:n,ppg:0,rpg:0,apg:0,mpg:0,status:"PLAYING"}))})}\n\nRules: team stats from search data. status: OUT/DOUBTFUL/QUESTIONABLE/PLAYING per injury report. ppg/rpg/apg/mpg: per-game averages.` }] })
      });
      const fd = await fmt.json();
      raw = (fd.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("").trim();
    }

    // ── 6. Parse AI response ──────────────────────────────────────────────────
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch(_) {}
    if (!parsed) { try { parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i,"").replace(/\s*```\s*$/,"")); } catch(_) {} }
    if (!parsed) { try { const i=raw.indexOf("{"),j=raw.lastIndexOf("}"); if(i>=0&&j>i) parsed=JSON.parse(raw.slice(i,j+1)); } catch(_) {} }
    if (!parsed) return res.status(500).json({ error: "Parse failed", raw: raw.slice(0,300) });

    // ── 7. Merge sources: ESPN stats → schedule scores → AI (priority order) ─
    // PPG/OPP: ESPN statistics endpoint is most authoritative (official ESPN averages).
    // Schedule-computed from real scores is second. AI is last resort.
    const finalPPG = espnStatPPG ?? schedPPG ?? parsed.ppg ?? 75;
    const finalOPP = espnStatOPP ?? schedOPP ?? parsed.opp ?? 70;
    if (!sources.ppg) sources.ppg = "AI (Perplexity)";
    if (!sources.opp) sources.opp = "AI (Perplexity)";

    parsed.wins   = parsed.wins   || wins;
    parsed.losses = parsed.losses || losses;
    parsed.ppg    = finalPPG;
    parsed.opp    = finalOPP;
    parsed.tempo  = espnStatTempo ?? parsed.tempo ?? 68;
    parsed.efg_pct       = parsed.efg_pct       || 0.52;
    parsed.tov_rate      = parsed.tov_rate       || 16;
    parsed.oreb_pct      = parsed.oreb_pct       || 0.30;
    parsed.ft_rate       = parsed.ft_rate        || 0.35;
    parsed.opp_efg_pct   = parsed.opp_efg_pct    || 0.50;
    parsed.opp_tov_rate  = parsed.opp_tov_rate   || 16;
    parsed.opp_oreb_pct  = parsed.opp_oreb_pct   || 0.28;
    parsed.opp_3p_pct    = parsed.opp_3p_pct     || 0.335;
    parsed.opp_ftr       = parsed.opp_ftr        || 0.30;
    parsed.conf_tourney_winner = parsed.conf_tourney_winner || false;
    parsed.conference    = parsed.conference      || "Unknown";
    parsed.ranking       = parsed.ranking         || 0;
    parsed.kenpom_rank   = parsed.kenpom_rank     || 150;
    parsed.rest          = daysSinceLastGame;
    parsed.elo           = Math.round(teamElo);
    parsed.espn_id       = teamNumId;
    parsed.margin_stddev = teamGames._marginStddev || 10;
    parsed.games         = teamGames;

    // NET rank priority: 1) ESPN API (if available)  2) Hardcoded table  3) AI
    const hardcodedRank = lookupNetRank(team);
    if (espnNetRank) {
      parsed.kenpom_rank = espnNetRank;
      sources.kenpom_rank = "ESPN NET ranking";
    } else if (hardcodedRank) {
      parsed.kenpom_rank = hardcodedRank;
      sources.kenpom_rank = "NET rank (hardcoded Mar 2026)";
    } else {
      sources.kenpom_rank = "AI (Perplexity)";
    }

    // ── 8. Sanity clamp — prevent impossible values from corrupting models ───
    // These bounds represent the realistic range for any NCAA Division I team.
    // Clamping here means bad AI data can't produce 97% results downstream.
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    parsed.ppg           = clamp(parsed.ppg,          55,  95);   // no team averages below 55 or above 95
    parsed.opp           = clamp(parsed.opp,          50,  92);   // no D1 team allows fewer than 50 ppg
    parsed.tempo         = clamp(parsed.tempo,         58,  82);   // KenPom tempo range for D1
    parsed.efg_pct       = clamp(parsed.efg_pct,      0.38, 0.64);
    parsed.tov_rate      = clamp(parsed.tov_rate,      8,   28);
    parsed.oreb_pct      = clamp(parsed.oreb_pct,      0.15, 0.50);
    parsed.ft_rate       = clamp(parsed.ft_rate,       0.15, 0.55);
    parsed.opp_efg_pct   = clamp(parsed.opp_efg_pct,  0.38, 0.64);
    parsed.opp_tov_rate  = clamp(parsed.opp_tov_rate,  8,   28);
    parsed.opp_oreb_pct  = clamp(parsed.opp_oreb_pct,  0.15, 0.50);
    parsed.opp_3p_pct    = clamp(parsed.opp_3p_pct,   0.25, 0.42);
    parsed.opp_ftr       = clamp(parsed.opp_ftr,       0.15, 0.50);
    parsed.kenpom_rank   = clamp(parseInt(parsed.kenpom_rank)||150, 1, 364);

    // Net rating sanity: if ppg-opp implies an impossible net rating for the seed, log it
    const netRating = parsed.ppg - parsed.opp;
    sources.net_rating     = `${netRating > 0 ? "+" : ""}${netRating.toFixed(1)} PPG (${sources.ppg})`;
    sources.schedule_games = sCnt;
    sources.espn_stats_ppg = espnStatPPG;
    sources.espn_stats_opp = espnStatOPP;
    sources.sched_ppg      = schedPPG;
    sources.sched_opp      = schedOPP;
    sources.ai_ppg         = parsed.ppg;
    parsed._sources        = sources;

    // ── 9. Build final roster: ESPN stats (authoritative) + AI injury status ─
    const VALID_STATUS = new Set(["PLAYING","OUT","DOUBTFUL","QUESTIONABLE"]);
    const injuryMap = {};
    for (const p of (parsed.roster || [])) {
      if (p.name) injuryMap[p.name] = VALID_STATUS.has(p.status) ? p.status : "PLAYING";
    }
    const aiStatsMap = {};
    for (const p of (parsed.roster || [])) {
      if (p.name && !playerStats.find(s => s.name === p.name && s.espn)) {
        aiStatsMap[p.name] = p;
      }
    }
    parsed.roster = playerStats.map(espnP => {
      const ai  = aiStatsMap[espnP.name] || {};
      const ppg = espnP.espn ? (espnP.ppg ?? 5)  : (ai.ppg || 5);
      const rpg = espnP.espn ? (espnP.rpg ?? 3)  : (ai.rpg || 3);
      const apg = espnP.espn ? (espnP.apg ?? 1)  : (ai.apg || 1);
      const mpg = espnP.espn ? (espnP.mpg ?? 25) : (ai.mpg || 25);
      const per = Math.round(((ppg * 1.0 + rpg * 0.6 + apg * 0.5) * Math.sqrt(Math.max(mpg, 10) / 30)) * 10) / 10;
      const role   = ppg > 15 ? "STAR" : ppg > 8 ? "KEY" : "ROLE";
      const status = injuryMap[espnP.name] || "PLAYING";
      return { name: espnP.name, ppg, rpg, apg, mpg, per, role, status };
    });

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
