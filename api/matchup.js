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
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        system: "JSON API only. Output raw JSON, no markdown, no explanation.",
        messages: [{ role: "user", content: `2025-26 NBA stats for ${homeTeam} and ${awayTeam}. Output ONLY this JSON with real data:
{"home":{"wins":0,"losses":0,"ppg":0.0,"opp":0.0,"efg_pct":0.52,"tov_rate":13.5,"oreb_pct":0.26,"ftr":0.22,"opp_efg_pct":0.52,"opp_tov_rate":13.5,"opp_oreb_pct":0.26,"opp_ftr":0.22,"last10":"5-5","last10_ppg":0.0,"last10_opp":0.0,"roster":[{"name":"Name","ppg":0.0,"per":0.0,"role":"STAR","status":"PLAYING"}]},"away":{...same fields...}}
7 players per team by ppg. role: STAR>20ppg, KEY>11ppg, else ROLE. status from current injury report.` }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || "API error" });

    const raw = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    let parsed = null;
    try { parsed = JSON.parse(raw.trim()); } catch(_) {}
    if (!parsed) { try { parsed = JSON.parse(raw.replace(/```[\w]*\n?/gi,"").replace(/```\s*/g,"").trim()); } catch(_) {} }
    if (!parsed) { try { const s=raw.indexOf("{"),e=raw.lastIndexOf("}"); if(s!==-1&&e!==-1) parsed=JSON.parse(raw.slice(s,e+1)); } catch(_) {} }
    if (!parsed?.home || !parsed?.away) return res.status(500).json({ error: "Could not parse response", raw: raw.slice(0,300) });

    const fix = t => ({
      wins:t.wins??20, losses:t.losses??20, ppg:t.ppg??112, opp:t.opp??112,
      efg_pct:t.efg_pct??.52, tov_rate:t.tov_rate??13.5, oreb_pct:t.oreb_pct??.26, ftr:t.ftr??.22,
      opp_efg_pct:t.opp_efg_pct??.52, opp_tov_rate:t.opp_tov_rate??13.5, opp_oreb_pct:t.opp_oreb_pct??.26, opp_ftr:t.opp_ftr??.22,
      last10:t.last10??"5-5", last10_ppg:t.last10_ppg??t.ppg??112, last10_opp:t.last10_opp??t.opp??112,
      roster:(t.roster||[]).map(p=>({ name:p.name||"Unknown", ppg:p.ppg??10, per:p.per??12, role:p.role||"ROLE", status:p.status||"PLAYING" }))
    });

    return res.status(200).json({ home: fix(parsed.home), away: fix(parsed.away) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
