// api/matchup.js — fetches live 2025-26 NBA data for both teams in one API call
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });

  const { homeTeam, awayTeam } = req.body;
  if (!homeTeam || !awayTeam) return res.status(400).json({ error: "homeTeam and awayTeam required" });

  const prompt = `Search the web for current 2025-26 NBA season stats and injury reports for both the ${homeTeam} and ${awayTeam}.

Return ONLY a valid JSON object in this exact shape, with real current data for both teams:
{
  "home": {
    "wins": 0, "losses": 0, "ppg": 110.0, "opp": 110.0,
    "efg_pct": 0.52, "tov_rate": 13.5, "oreb_pct": 0.26, "ftr": 0.22,
    "opp_efg_pct": 0.52, "opp_tov_rate": 13.5, "opp_oreb_pct": 0.26, "opp_ftr": 0.22,
    "last10": "5-5", "last10_ppg": 110.0, "last10_opp": 110.0,
    "roster": [
      {"name": "Player Name", "ppg": 20.0, "per": 20.0, "role": "STAR", "status": "PLAYING"},
      {"name": "Player Name", "ppg": 14.0, "per": 15.0, "role": "KEY", "status": "PLAYING"}
    ]
  },
  "away": {
    "wins": 0, "losses": 0, "ppg": 110.0, "opp": 110.0,
    "efg_pct": 0.52, "tov_rate": 13.5, "oreb_pct": 0.26, "ftr": 0.22,
    "opp_efg_pct": 0.52, "opp_tov_rate": 13.5, "opp_oreb_pct": 0.26, "opp_ftr": 0.22,
    "last10": "5-5", "last10_ppg": 110.0, "last10_opp": 110.0,
    "roster": [
      {"name": "Player Name", "ppg": 20.0, "per": 20.0, "role": "STAR", "status": "PLAYING"},
      {"name": "Player Name", "ppg": 14.0, "per": 15.0, "role": "KEY", "status": "PLAYING"}
    ]
  }
}

Rules:
- Include 7-9 real players per team in "roster", sorted by ppg descending
- player "role": "STAR" if ppg > 20, "KEY" if ppg > 11, else "ROLE"
- player "status": "OUT" if currently out injured, "DOUBTFUL" if doubtful, "QUESTIONABLE" if questionable, "PLAYING" if healthy
- Use real 2025-26 season stats. Do not use placeholder values.
- Return ONLY the JSON object. No explanation, no markdown, no code fences.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "interleaved-thinking-2025-05-14"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);

    // Extract the last text block
    const texts = (data.content || []).filter(b => b.type === "text");
    if (!texts.length) return res.status(500).json({ error: "No text response from Claude" });

    const raw = texts[texts.length - 1].text;

    // Try to parse JSON
    const attempts = [
      s => JSON.parse(s.trim()),
      s => JSON.parse(s.replace(/```[\w]*\n?/g, "").trim()),
      s => { const m = s.match(/\{[\s\S]*\}/); if (!m) throw 0; return JSON.parse(m[0]); }
    ];
    for (const fn of attempts) {
      try {
        const parsed = fn(raw);
        if (parsed?.home && parsed?.away) return res.status(200).json(parsed);
      } catch (_) {}
    }

    return res.status(500).json({ error: "Failed to parse response", raw: raw.slice(0, 300) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
