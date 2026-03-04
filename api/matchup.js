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
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 3000, tools: [{ type: "web_search_20250305", name: "web_search" }], system: "You are a JSON-only API. Never output prose, markdown, or code fences. Only output a single raw JSON object.", messages: [{ role: "user", content: "Search current 2025-26 NBA season stats for " + awayTeam + " and " + homeTeam + ". Reply with ONLY this JSON (fill real values): {\"home\":{\"wins\":0,\"losses\":0,\"ppg\":112.5,\"opp\":109.2,\"efg_pct\":0.535,\"tov_rate\":13.1,\"oreb_pct\":0.27,\"ftr\":0.21,\"opp_efg_pct\":0.521,\"opp_tov_rate\":13.8,\"opp_oreb_pct\":0.25,\"opp_ftr\":0.20,\"last10\":\"7-3\",\"last10_ppg\":114.0,\"last10_opp\":108.5,\"roster\":[{\"name\":\"Player Name\",\"ppg\":24.5,\"per\":22.1,\"role\":\"STAR\",\"status\":\"PLAYING\"}]},\"away\":{\"wins\":0,\"losses\":0,\"ppg\":112.5,\"opp\":109.2,\"efg_pct\":0.535,\"tov_rate\":13.1,\"oreb_pct\":0.27,\"ftr\":0.21,\"opp_efg_pct\":0.521,\"opp_tov_rate\":13.8,\"opp_oreb_pct\":0.25,\"opp_ftr\":0.20,\"last10\":\"7-3\",\"last10_ppg\":114.0,\"last10_opp\":108.5,\"roster\":[{\"name\":\"Player Name\",\"ppg\":24.5,\"per\":22.1,\"role\":\"STAR\",\"status\":\"PLAYING\"}]}} Include ALL active roster players (typically 13-15) per team sorted by ppg. role=STAR if ppg>20, KEY if ppg>11, else ROLE. status=OUT/DOUBTFUL/QUESTIONABLE/PLAYING." }] })
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || "API error" });
    const raw = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch(_) {}
    if (!parsed) { try { parsed = JSON.parse(raw.replace(/\\\json|\\\/gi, "").trim()); } catch(_) {} }
    if (!parsed) { try { const i=raw.indexOf("{"),j=raw.lastIndexOf("}"); parsed=JSON.parse(raw.slice(i,j+1)); } catch(_) {} }
    if (!parsed?.home || !parsed?.away) return res.status(500).json({ error: "Could not parse response", raw: raw.slice(0,400) });
    const fix = t => ({ wins:t.wins??20, losses:t.losses??20, ppg:t.ppg??112, opp:t.opp??112, efg_pct:t.efg_pct??.52, tov_rate:t.tov_rate??13.5, oreb_pct:t.oreb_pct??.26, ftr:t.ftr??.22, opp_efg_pct:t.opp_efg_pct??.52, opp_tov_rate:t.opp_tov_rate??13.5, opp_oreb_pct:t.opp_oreb_pct??.26, opp_ftr:t.opp_ftr??.22, last10:t.last10??"5-5", last10_ppg:t.last10_ppg??t.ppg??112, last10_opp:t.last10_opp??t.opp??112, roster:(t.roster||[]).map(p=>({ name:p.name||"Unknown", ppg:p.ppg??10, per:p.per??12, role:p.role||"ROLE", status:p.status||"PLAYING" })) });
    return res.status(200).json({ home: fix(parsed.home), away: fix(parsed.away) });
  } catch (err) { return res.status(500).json({ error: err.message }); }
}
