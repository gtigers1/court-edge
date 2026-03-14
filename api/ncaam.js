export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const pplxKey = process.env.PERPLEXITY_API_KEY;
  const apiKey  = process.env.ANTHROPIC_API_KEY; // fallback only
  if (!pplxKey && !apiKey) return res.status(500).json({ error: "PERPLEXITY_API_KEY not set" });
  const { teamId, team } = req.body || {};
  if (!teamId) return res.status(400).json({ error: "teamId required" });

  try {
    const rosterUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${teamId}/roster`;
    const teamUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${teamId}`;
    const [rosterResp, teamResp] = await Promise.all([fetch(rosterUrl), fetch(teamUrl)]);
    const [rosterJson, teamJson] = await Promise.all([rosterResp.json(), teamResp.json()]);

    const recordSummary = teamJson?.team?.record?.items?.[0]?.summary || "0-0";
    const parts = recordSummary.split("-");
    const wins = parseInt(parts[0]) || 15;
    const losses = parseInt(parts[1]) || 15;

    // Fetch schedule for rest days, Elo, and H2H
    const teamNumId = String(teamJson?.team?.id || teamId || "");
    let daysSinceLastGame = 2;
    let teamElo = 1500;
    let teamGames = [];
    try {
      const schedResp = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${teamId}/schedule`);
      const schedJson = await schedResp.json();
      const completed = (schedJson?.events || []).filter(e => e.competitions?.[0]?.status?.type?.completed === true);
      if (completed.length > 0) {
        const lastDate = new Date(completed[completed.length - 1].date);
        daysSinceLastGame = Math.max(0, Math.floor((new Date() - lastDate) / (1000 * 60 * 60 * 24)));
      }
      const ELO_K = 30;
      for (const ev of completed) {
        const comp = ev.competitions?.[0];
        if (!comp) continue;
        const ours = comp.competitors?.find(c => String(c.id) === teamNumId);
        const theirs = comp.competitors?.find(c => String(c.id) !== teamNumId);
        if (!ours || !theirs || ours.score == null || theirs.score == null) continue;
        const s = parseFloat(ours.score)||0, t = parseFloat(theirs.score)||0;
        const isHome = ours.homeAway === "home";
        const win = s > t ? 1 : 0;
        if (theirs.id) teamGames.push({ opp: String(theirs.id), win: win === 1 });
        const effElo = teamElo + (isHome ? 50 : -50);
        const expected = 1 / (1 + Math.pow(10, (1500 - effElo) / 400));
        const margin = Math.abs(s - t);
        teamElo += ELO_K * Math.max(0.5, Math.log(margin + 1) / Math.log(15)) * (win - expected);
      }
    } catch(_) {}

    // Try ESPN NET ranking
    const rankings = teamJson?.team?.rankings || [];
    const espnNetRank = rankings.find(r => (r.type?.displayName||"").toLowerCase().includes("net") || (r.name||"").toLowerCase().includes("net"))?.current || null;

    const athletes = rosterJson?.athletes || [];
    let allPlayers = [];
    if (Array.isArray(athletes) && athletes.length > 0) {
      if (athletes[0]?.items) {
        for (const group of athletes) allPlayers = allPlayers.concat(group.items || []);
      } else {
        allPlayers = athletes;
      }
    }
    const playerNames = allPlayers.map(p => p.fullName || p.displayName || "").filter(Boolean).slice(0, 18);

    if (playerNames.length === 0) {
      return res.status(500).json({ error: "ESPN roster empty for " + team, rosterUrl });
    }

    const schema = '{"wins":0,"losses":0,"ppg":75.0,"opp":70.0,"tempo":68.0,"efg_pct":0.52,"tov_rate":16.0,"oreb_pct":0.30,"ft_rate":0.35,"opp_efg_pct":0.50,"opp_tov_rate":16.0,"opp_oreb_pct":0.28,"conference":"Big Ten","ranking":0,"kenpom_rank":100,"roster":[{"name":"Player Name","ppg":15.0,"rpg":5.0,"apg":3.0,"per":18.0,"role":"STAR","status":"PLAYING"}]}';

    let raw = "";

    if (pplxKey) {
      // Single Perplexity Sonar call: search + format in one shot (faster, cheaper, more current)
      const r = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${pplxKey}` },
        body: JSON.stringify({
          model: "sonar-pro",
          messages: [
            { role: "system", content: "You are a sports data API. Search the web for current stats and return ONLY a raw JSON object. No markdown, no code fences, no explanation, no text before or after the JSON." },
            { role: "user", content: `Search for current 2025-26 NCAA basketball season stats for ${team}. Return this exact JSON schema filled with real data:\n${schema}\n\nRoster - include ALL players below using their EXACT names:\n${playerNames.join(", ")}\n\nRules: wins/losses from current record. ppg/opp = current season averages. tempo from KenPom or Barttorvik. efg_pct as decimal (e.g. 0.52). ranking = AP poll rank (0 if unranked). kenpom_rank = KenPom rank. For each player: ppg/rpg/apg = per game averages this season. role: STAR if ppg>15, KEY if ppg>8, else ROLE. per = ppg*1.1+rpg*0.3+apg*0.4.` }
          ],
          temperature: 0.1
        })
      });
      const d = await r.json();
      raw = d.choices?.[0]?.message?.content || "";
    } else {
      // Fallback: Anthropic (two-call search + format)
      const search = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 800, tools: [{ type: "web_search_20250305", name: "web_search" }], messages: [{ role: "user", content: team + " 2025-26 NCAA basketball stats wins losses ppg opponent-ppg efg% turnover rate offensive rebound rate free throw rate tempo kenpom rank player scoring averages" }] })
      });
      const sd = await search.json();
      const searchText = (sd.content || []).filter(b => b.type === "text").map(b => b.text).join("").slice(0, 2000);
      const fmt = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 2500, system: "Output only a single raw JSON object. No markdown, no explanation, no code fences.", messages: [{ role: "user", content: "Build JSON for " + team + " college basketball 2025-26 season.\n\nRoster (use EXACT names, include ALL):\n" + playerNames.join(", ") + "\n\nStats data:\n" + searchText + "\n\nSchema:\n" + schema + "\n\nRules: Include EVERY player in roster array. role=STAR if ppg>15, KEY if ppg>8, else ROLE. per=ppg*1.1+rpg*0.3+apg*0.4. ranking=AP poll rank 0 if unranked. kenpom_rank=estimated 1-364." }] })
      });
      const fd = await fmt.json();
      raw = (fd.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    }

    let parsed = null;
    // 1. Direct parse
    try { parsed = JSON.parse(raw); } catch(_) {}
    // 2. Strip markdown code fences
    if (!parsed) { try { parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i,"").replace(/\s*```\s*$/,"")); } catch(_) {} }
    // 3. Extract first { ... } block
    if (!parsed) { try { const i=raw.indexOf("{"),j=raw.lastIndexOf("}"); if(i>=0&&j>i) parsed=JSON.parse(raw.slice(i,j+1)); } catch(_) {} }
    if (!parsed) return res.status(500).json({ error: "Parse failed — Perplexity returned unexpected format", raw: raw.slice(0,300) });

    parsed.wins = parsed.wins || wins;
    parsed.losses = parsed.losses || losses;
    parsed.ppg = parsed.ppg || 75;
    parsed.opp = parsed.opp || 70;
    parsed.tempo = parsed.tempo || 68;
    parsed.efg_pct = parsed.efg_pct || 0.52;
    parsed.tov_rate = parsed.tov_rate || 16;
    parsed.oreb_pct = parsed.oreb_pct || 0.30;
    parsed.ft_rate = parsed.ft_rate || 0.35;
    parsed.opp_efg_pct = parsed.opp_efg_pct || 0.50;
    parsed.opp_tov_rate = parsed.opp_tov_rate || 16;
    parsed.opp_oreb_pct = parsed.opp_oreb_pct || 0.28;
    parsed.conference = parsed.conference || "Unknown";
    parsed.ranking = parsed.ranking || 0;
    parsed.kenpom_rank = parsed.kenpom_rank || 150;
    parsed.rest = daysSinceLastGame;
    parsed.elo = Math.round(teamElo);
    parsed.espn_id = teamNumId;
    parsed.games = teamGames;
    if (espnNetRank) parsed.kenpom_rank = espnNetRank;
    parsed.roster = (parsed.roster || []).map(p => ({
      name: p.name || "Unknown",
      ppg: p.ppg || 5,
      rpg: p.rpg || 3,
      apg: p.apg || 1,
      per: p.per || (p.ppg || 5) * 1.1,
      role: p.role || "ROLE",
      status: "PLAYING"
    }));
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
