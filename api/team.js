export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });
  const { team, sport } = req.body || {};
  if (!team) return res.status(400).json({ error: "team required" });

  try {
    // Step 1: Search for current roster
    const search = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        system: "Search for current sports information and summarize the facts clearly.",
        messages: [{ role: "user", content: sport === "nhl"
          ? "Search: " + team + " NHL roster March 2026. Find every current player on the " + team + " active roster right now with their 2025-26 season goals, assists, points. Also find their goalie with save percentage and GAA. Include team wins, losses, OTL, goals per game, goals against per game, power play %, penalty kill %."
          : "Search: " + team + " NBA roster March 2026. Find every current player on the " + team + " active roster right now with their 2025-26 season points per game. Include team wins, losses, points per game, opponent points per game."
        }]
      })
    });
    const sd = await search.json();
    const searchText = (sd.content || []).filter(b => b.type === "text").map(b => b.text).join("");

    // Step 2: Format into clean JSON
    const nbaSchema = '{"wins":0,"losses":0,"ppg":112,"opp":110,"efg_pct":0.52,"tov_rate":13,"oreb_pct":0.25,"ftr":0.22,"opp_efg_pct":0.52,"opp_tov_rate":13,"opp_oreb_pct":0.25,"opp_ftr":0.22,"last10":"5-5","last10_ppg":112,"last10_opp":110,"roster":[{"name":"Player Name","ppg":20.0,"per":17.0,"role":"STAR","status":"PLAYING"}]}';
    const nhlSchema = '{"wins":0,"losses":0,"otl":0,"points":0,"gf_pg":3.0,"ga_pg":2.8,"shots_pg":30,"shots_against_pg":28,"pp_pct":22,"pk_pct":80,"last10_gf":3.0,"last10_ga":2.8,"goalie":{"name":"Goalie Name","save_pct":0.910,"gaa":2.80,"status":"PLAYING"},"roster":[{"name":"Player Name","goals":20,"assists":30,"points":50,"plus_minus":5,"position":"LW","role":"STAR","status":"PLAYING"}]}';

    const fmt = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: "Output only a single raw JSON object. No markdown, no explanation, no code fences.",
        messages: [{ role: "user", content: "Convert this " + team + " data to JSON.\n\nData:\n" + searchText.slice(0, 3000) + "\n\nReturn ONLY this JSON structure with real values:\n" + (sport === "nhl" ? nhlSchema : nbaSchema) + "\n\nRules: Include ALL players currently on the roster. " + (sport === "nhl" ? "For skaters: role=STAR if points>40, KEY if points>20, else ROLE. Include position (C/LW/RW/D). For goalie use expected starter." : "role=STAR if ppg>20, KEY if ppg>11, else ROLE. per=ppg*0.85.") + " Only current March 2026 roster players." }]
      })
    });
    const fd = await fmt.json();
    if (!fmt.ok) return res.status(502).json({ error: fd.error?.message || "Format error" });
    const raw = (fd.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();

    let parsed = null;
    try { parsed = JSON.parse(raw); } catch(_) {}
    if (!parsed) { try { parsed = JSON.parse(raw.replace(/^```json\s*/i,"").replace(/\s*```$/,"")); } catch(_) {} }
    if (!parsed) { try { const i=raw.indexOf("{"),j=raw.lastIndexOf("}"); if(i>=0&&j>i) parsed=JSON.parse(raw.slice(i,j+1)); } catch(_) {} }
    if (!parsed) return res.status(500).json({ error: "Parse failed", raw: raw.slice(0,300) });

    // Normalize
    if (sport === "nhl") {
      parsed.wins = parsed.wins ?? 30;
      parsed.losses = parsed.losses ?? 25;
      parsed.otl = parsed.otl ?? 5;
      parsed.points = parsed.points ?? (parsed.wins*2 + parsed.otl);
      parsed.gf_pg = parsed.gf_pg ?? 3.0;
      parsed.ga_pg = parsed.ga_pg ?? 2.8;
      parsed.shots_pg = parsed.shots_pg ?? 30;
      parsed.shots_against_pg = parsed.shots_against_pg ?? 28;
      parsed.pp_pct = parsed.pp_pct ?? 20;
      parsed.pk_pct = parsed.pk_pct ?? 80;
      parsed.last10_gf = parsed.last10_gf ?? parsed.gf_pg;
      parsed.last10_ga = parsed.last10_ga ?? parsed.ga_pg;
      parsed.roster = (parsed.roster||[]).map(p=>({name:p.name||"Unknown",goals:p.goals??0,assists:p.assists??0,points:p.points??0,plus_minus:p.plus_minus??0,position:p.position||"F",role:p.role||"ROLE",status:p.status||"PLAYING"}));
      if (parsed.goalie) { parsed.goalie.status = parsed.goalie.status || "PLAYING"; }
    } else {
      parsed.wins = parsed.wins ?? 30;
      parsed.losses = parsed.losses ?? 30;
      parsed.ppg = parsed.ppg ?? 112;
      parsed.opp = parsed.opp ?? 112;
      parsed.efg_pct = parsed.efg_pct ?? 0.52;
      parsed.tov_rate = parsed.tov_rate ?? 13.5;
      parsed.oreb_pct = parsed.oreb_pct ?? 0.26;
      parsed.ftr = parsed.ftr ?? 0.22;
      parsed.opp_efg_pct = parsed.opp_efg_pct ?? 0.52;
      parsed.opp_tov_rate = parsed.opp_tov_rate ?? 13.5;
      parsed.opp_oreb_pct = parsed.opp_oreb_pct ?? 0.26;
      parsed.opp_ftr = parsed.opp_ftr ?? 0.22;
      parsed.last10 = parsed.last10 ?? "5-5";
      parsed.last10_ppg = parsed.last10_ppg ?? parsed.ppg;
      parsed.last10_opp = parsed.last10_opp ?? parsed.opp;
      parsed.roster = (parsed.roster||[]).map(p=>({name:p.name||"Unknown",ppg:p.ppg??10,per:p.per??(p.ppg??10)*0.85,role:p.role||"ROLE",status:p.status||"PLAYING"}));
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}