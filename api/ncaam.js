export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const pplxKey = process.env.PERPLEXITY_API_KEY;
  const apiKey  = process.env.ANTHROPIC_API_KEY;
  if (!pplxKey && !apiKey) return res.status(500).json({ error: "PERPLEXITY_API_KEY not set" });
  const { teamId, team } = req.body || {};
  if (!teamId) return res.status(400).json({ error: "teamId required" });

  try {
    // ── 1. ESPN: roster + team info (concurrent) ────────────────────────────
    const rosterUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${teamId}/roster`;
    const teamUrl   = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${teamId}`;
    const [rosterResp, teamResp] = await Promise.all([fetch(rosterUrl), fetch(teamUrl)]);
    const [rosterJson, teamJson] = await Promise.all([rosterResp.json(), teamResp.json()]);

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

    // ── 2. ESPN: schedule → rest days + rolling Elo ─────────────────────────
    let daysSinceLastGame = 2, teamElo = 1500, teamGames = [];
    try {
      const schedResp = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${teamId}/schedule`);
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
        const s = parseFloat(ours.score)||0, t = parseFloat(theirs.score)||0;
        const win    = s > t ? 1 : 0;
        const isHome = ours.homeAway === "home";
        if (theirs.id) teamGames.push({ opp: String(theirs.id), win: win === 1 });
        margins.push(s - t);
        const effElo   = teamElo + (isHome ? 50 : -50);
        const expected = 1 / (1 + Math.pow(10, (1500 - effElo) / 400));
        teamElo += ELO_K * Math.max(0.5, Math.log(Math.abs(s-t)+1)/Math.log(15)) * (win - expected);
      }
      // Margin of victory std dev: low = consistent, high = volatile
      if (margins.length > 3) {
        const mean = margins.reduce((a,b)=>a+b,0)/margins.length;
        daysSinceLastGame = daysSinceLastGame; // already set
        const variance = margins.reduce((s,m)=>s+Math.pow(m-mean,2),0)/margins.length;
        // attach to a temp var; applied below after parsed
        teamGames._marginStddev = parseFloat(Math.sqrt(variance).toFixed(1));
      }
    } catch(_) {}

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
    // Correct endpoint: /common/v3/ path (the /site/v2/ statistics endpoint 404s for NCAAM).
    // ESPN returns POSITIONAL string arrays — stats[] values map 1:1 to labels[].
    // Verified structure from live API:
    //   categories[0] = "averages", labels = ["GP","GS","MIN","FG","FG%","3PT","3P%",
    //     "FT","FT%","OR","DR","REB","AST","BLK","STL","PF","TO","PTS"]
    //   stats = positional strings e.g. ["33","33","25.2",...,"3.0","4.7",...,"7.7"]
    //   PTS=index 17, REB=index 11, AST=index 12, MIN=index 2
    const fetchPlayerStats = async ({ id, name }) => {
      if (!id) return { name, espn: false };
      try {
        const r = await fetch(
          `https://site.api.espn.com/apis/common/v3/sports/basketball/mens-college-basketball/athletes/${id}/stats`
        );
        if (!r.ok) return { name, espn: false };
        const d = await r.json();

        // Find the "averages" category (per-game stats)
        const cats   = d?.categories || [];
        const avgCat = cats.find(c => c.name === "averages") || cats[0];
        if (!avgCat) return { name, espn: false };

        const labels   = avgCat.labels || [];   // ["GP","GS","MIN",...,"REB","AST",...,"PTS"]
        const nameList = avgCat.names  || [];   // ["gamesPlayed","gamesStarted","avgMinutes",...,"avgPoints"]

        // Pick the current season row — highest year, most games played if tie
        const rows = avgCat.statistics || [];
        const currentRow = rows.reduce((best, row) => {
          if (!best) return row;
          const bYear = best.season?.year || 0, rYear = row.season?.year || 0;
          if (rYear !== bYear) return rYear > bYear ? row : best;
          // Same year: prefer more games played
          const bGP = parseFloat((best.stats||[])[0]) || 0;
          const rGP = parseFloat((row.stats ||[])[0]) || 0;
          return rGP > bGP ? row : best;
        }, null);

        if (!currentRow?.stats) return { name, espn: false };
        const statsArr = currentRow.stats; // positional string array

        // Look up a stat by its label ("PTS") or names-array entry ("avgPoints")
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

    // Names of players whose ESPN fetch failed (need AI to fill in stats)
    const needsAI   = playerStats.filter(p => !p.espn).map(p => p.name);
    const playerNames = playerEntries.map(p => p.name);

    // ── 5. Perplexity: team stats + injury status + stats for ESPN-failed players
    const teamStatsSchema = JSON.stringify({
      wins:0, losses:0, ppg:75.0, opp:70.0, tempo:68.0,
      efg_pct:0.52, tov_rate:16.0, oreb_pct:0.30, ft_rate:0.35,
      opp_efg_pct:0.50, opp_tov_rate:16.0, opp_oreb_pct:0.28,
      opp_3p_pct:0.335, opp_ftr:0.30, conf_tourney_winner:false,
      conference:"Big Ten", ranking:0, kenpom_rank:100
    });

    // Roster block: if ESPN succeeded for a player, only ask for status.
    // If ESPN failed, ask for full stats + status.
    const rosterSchemaBlock = playerNames.map(name => {
      const s = playerStats.find(p => p.name === name);
      if (s?.espn) return `{"name":"${name}","status":"PLAYING"}`;
      return `{"name":"${name}","ppg":0,"rpg":0,"apg":0,"mpg":0,"status":"PLAYING"}`;
    }).join(",");

    const promptRules = [
      "wins/losses: current season record",
      "ppg/opp: team season scoring averages",
      "tempo: possessions per 40 min (KenPom or Barttorvik)",
      "efg_pct as decimal (0.52 = 52%)",
      "opp_3p_pct: opponent 3-point % allowed this season (decimal, e.g. 0.320 = elite, 0.345 = average)",
      "opp_ftr: opponent free throw attempts / opponent field goal attempts (decimal, e.g. 0.28)",
      "conf_tourney_winner: true if team won their conference tournament this season",
      "ranking: AP poll rank, 0 if unranked",
      "kenpom_rank: KenPom or NET rank (1-364)",
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

    // ── 6. Parse Perplexity response ─────────────────────────────────────────
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch(_) {}
    if (!parsed) { try { parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i,"").replace(/\s*```\s*$/,"")); } catch(_) {} }
    if (!parsed) { try { const i=raw.indexOf("{"),j=raw.lastIndexOf("}"); if(i>=0&&j>i) parsed=JSON.parse(raw.slice(i,j+1)); } catch(_) {} }
    if (!parsed) return res.status(500).json({ error: "Parse failed", raw: raw.slice(0,300) });

    // ── 7. Apply team stat defaults ──────────────────────────────────────────
    parsed.wins          = parsed.wins          || wins;
    parsed.losses        = parsed.losses        || losses;
    parsed.ppg           = parsed.ppg           || 75;
    parsed.opp           = parsed.opp           || 70;
    parsed.tempo         = parsed.tempo         || 68;
    parsed.efg_pct       = parsed.efg_pct       || 0.52;
    parsed.tov_rate      = parsed.tov_rate      || 16;
    parsed.oreb_pct      = parsed.oreb_pct      || 0.30;
    parsed.ft_rate       = parsed.ft_rate       || 0.35;
    parsed.opp_efg_pct   = parsed.opp_efg_pct   || 0.50;
    parsed.opp_tov_rate  = parsed.opp_tov_rate  || 16;
    parsed.opp_oreb_pct       = parsed.opp_oreb_pct       || 0.28;
    parsed.opp_3p_pct         = parsed.opp_3p_pct         || 0.335;
    parsed.opp_ftr            = parsed.opp_ftr            || 0.30;
    parsed.conf_tourney_winner= parsed.conf_tourney_winner|| false;
    parsed.conference    = parsed.conference    || "Unknown";
    parsed.ranking       = parsed.ranking       || 0;
    parsed.kenpom_rank   = parsed.kenpom_rank   || 150;
    parsed.rest          = daysSinceLastGame;
    parsed.elo           = Math.round(teamElo);
    parsed.espn_id       = teamNumId;
    parsed.margin_stddev = teamGames._marginStddev || 10;
    parsed.games         = teamGames;
    if (espnNetRank) parsed.kenpom_rank = espnNetRank;

    // ── 8. Build final roster: ESPN stats (authoritative) + AI injury status ──
    const VALID_STATUS = new Set(["PLAYING","OUT","DOUBTFUL","QUESTIONABLE"]);

    // Map from player name → injury status from Perplexity
    const injuryMap = {};
    for (const p of (parsed.roster || [])) {
      if (p.name) injuryMap[p.name] = VALID_STATUS.has(p.status) ? p.status : "PLAYING";
    }

    // Map from player name → AI stats (for ESPN-failed players only)
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

      // PER: (ppg + weighted reb + weighted ast) normalised by √(mpg/30)
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
