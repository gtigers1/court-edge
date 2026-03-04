export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
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
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        system: "Output only raw JSON. No text, no markdown.",
        messages: [{ role: "user", content: "Get 2025-26 NBA stats for " + awayTeam + " and " + homeTeam + ". Return ONLY this JSON structure with real values: {\"home\":{\"wins\":0,\"losses\":0,\"ppg\":0,\"opp\":0,\"efg_pct\":0,\"tov_rate\":0,\"oreb_pct\":0,\"ftr\":0,\"opp_efg_pct\":0,\"opp_tov_rate\":0,\"opp_oreb_pct\":0,\"opp_ftr\":0,\"last10\":\"0-0\",\"last10_ppg\":0,\"last10_opp\":0,\"roster\":[{\"name\":\"\",\"ppg\":0,\"per\":0,\"role\":\"\",\"status\":\"PLAYING\"}]},\"away\":{...same fields...}} All 13-15 active players per team. role=STAR/KEY/ROLE by ppg." }]
      })
    });
    const data = await response.json();
    if (!response.ok) return res.status(502).json({ error: data.error?.message || "Upstream error" });
    const raw = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch(_) {}
    if (!parsed) { try { parsed = JSON.parse(raw.replace(/^```json\s*/i,"").replace(/\s*```$/,"")); } catch(_) {} }
    if (!parsed) { try { const i=raw.indexOf("{"), j=raw.lastIndexOf("}"); if(i>=0&&j>i) parsed=JSON.parse(raw.slice(i,j+1)); } catch(_) {} }
    if (!parsed?.home || !parsed?.away) return res.status(500).json({ error: "Parse failed", raw: raw.slice(0,300) });
    const fix = t => ({ wins:t.wins??20, losses:t.losses??20, ppg:t.ppg??112, opp:t.opp??112, efg_pct:t.efg_pct??.52, tov_rate:t.tov_rate??13.5, oreb_pct:t.oreb_pct??.26, ftr:t.ftr??.22, opp_efg_pct:t.opp_efg_pct??.52, opp_tov_rate:t.opp_tov_rate??13.5, opp_oreb_pct:t.opp_oreb_pct??.26, opp_ftr:t.opp_ftr??.22, last10:t.last10??"5-5", last10_ppg:t.last10_ppg??t.ppg??112, last10_opp:t.last10_opp??t.opp??112, roster:(t.roster||[]).map(p=>({name:p.name||"Unknown",ppg:p.ppg??10,per:p.per??12,role:p.role||"ROLE",status:p.status||"PLAYING"})) });
    return res.status(200).json({ home: fix(parsed.home), away: fix(parsed.away) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}