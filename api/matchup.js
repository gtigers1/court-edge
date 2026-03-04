export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });

  const { homeTeam, awayTeam } = req.body || {};
  if (!homeTeam || !awayTeam) return res.status(400).json({ error: "homeTeam and awayTeam required" });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        system: `You are a JSON data API. You ONLY output valid JSON. No prose, no markdown, no code fences, no explanation. Just the raw JSON object.`,
        messages: [{
          role: "user",
          content: `Search for current 2025-26 NBA season stats for the ${homeTeam} and ${awayTeam}.

Output ONLY this JSON (no other text, no markdown, no backticks):

{"home":{"wins":0,"losses":0,"ppg":0.0,"opp":0.0,"efg_pct":0.52,"tov_rate":13.5,"oreb_pct":0.26,"ftr":0.22,"opp_efg_pct":0.52,"opp_tov_rate":13.5,"opp_oreb_pct":0.26,"opp_ftr":0.22,"last10":"5-5","last10_ppg":0.0,"last10_opp":0.0,"roster":[{"name":"Player Name","ppg":0.0,"per":0.0,"role":"STAR","status":"PLAYING"}]},"away":{"wins":0,"losses":0,"ppg":0.0,"opp":0.0,"efg_pct":0.52,"tov_rate":13.5,"oreb_pct":0.26,"ftr":0.22,"opp_efg_pct":0.52,"opp_tov_rate":13.5,"opp_oreb_pct":0.26,"opp_ftr":0.22,"last10":"5-5","last10_ppg":0.0,"last10_opp":0.0,"roster":[{"name":"Player Name","ppg":0.0,"per":0.0,"role":"STAR","status":"PLAYING"}]}}

Fill in real 2025-26 data. Include 7-9 real players per team sorted by PPG. Role: STAR if ppg>20, KEY if ppg>11, else ROLE. Status: OUT/DOUBTFUL/QUESTIONABLE/PLAYING based on current injury report.`
        }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || "API error" });

    // Extract all text blocks
    const textBlocks = (data.content || []).filter(b => b.type === "text");
    const raw = textBlocks.map(b => b.text).join("");

    // Try multiple JSON extraction strategies
    let parsed = null;

    // Strategy 1: direct parse
    try { parsed = JSON.parse(raw.trim()); } catch(_) {}

    // Strategy 2: strip markdown fences
    if (!parsed) {
      try {
        const stripped = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        parsed = JSON.parse(stripped);
      } catch(_) {}
    }

    // Strategy 3: find the outermost { }
    if (!parsed) {
      try {
        const start = raw.indexOf("{");
        const end = raw.lastIndexOf("}");
        if (start !== -1 && end !== -1) parsed = JSON.parse(raw.slice(start, end + 1));
      } catch(_) {}
    }

    if (!parsed?.home || !parsed?.away) {
      return res.status(500).json({
        error: "Could not parse JSON from response",
        raw: raw.slice(0, 500)
      });
    }

    // Ensure required fields exist with defaults
    const fixTeam = (t) => ({
      wins: t.wins ?? 20,
      losses: t.losses ?? 20,
      ppg: t.ppg ?? 112,
      opp: t.opp ?? 112,
      efg_pct: t.efg_pct ?? 0.52,
      tov_rate: t.tov_rate ?? 13.5,
      oreb_pct: t.oreb_pct ?? 0.26,
      ftr: t.ftr ?? 0.22,
      opp_efg_pct: t.opp_efg_pct ?? 0.52,
      opp_tov_rate: t.opp_tov_rate ?? 13.5,
      opp_oreb_pct: t.opp_oreb_pct ?? 0.26,
      opp_ftr: t.opp_ftr ?? 0.22,
      last10: t.last10 ?? "5-5",
      last10_ppg: t.last10_ppg ?? t.ppg ?? 112,
      last10_opp: t.last10_opp ?? t.opp ?? 112,
      roster: (t.roster || []).map(p => ({
        name: p.name || "Unknown",
        ppg: p.ppg ?? 10,
        per: p.per ?? 12,
        role: p.role || "ROLE",
        status: p.status || "PLAYING"
      }))
    });

    return res.status(200).json({ home: fixTeam(parsed.home), away: fixTeam(parsed.away) });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
