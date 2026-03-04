export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });
  const { homeTeam, awayTeam } = req.body || {};
  if (!homeTeam || !awayTeam) return res.status(400).json({ error: "homeTeam and awayTeam required" });
  try {
    // Step 1: Search for raw stats
    const search = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: "Search: current 2025-26 NBA season stats wins losses ppg opp for " + awayTeam + " and " + homeTeam + " plus their top 10 players ppg" }]
      })
    });
    const sd = await search.json();
    if (!search.ok) return res.status(502).json({ error: sd.error?.message || "Search error" });
    const searchText = (sd.content || []).filter(b => b.type === "text").map(b => b.text).join("");

    // Step 2: Format into JSON with a tiny prompt
    const format = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        system: "Output only raw JSON, no markdown.",
        messages: [{ role: "user", content: "Format this NBA data into JSON. Home=" + homeTeam + " Away=" + awayTeam + ".\n\nData:\n" + searchText.slice(0, 2000) + "\n\nReturn: {\"home\":{\"wins\":0,\"losses\":0,\"ppg\":0,\"opp\":0,\"efg_pct\":0.52,\"tov_rate\":13,\"oreb_pct\":0.25,\"ftr\":0.22,\"opp_efg_pct\":0.52,\"opp_tov_rate\":13,\"opp_oreb_pct\":0.25,\"opp_ftr\":0.22,\"last10\":\"5-5\",\"last10_ppg\":112,\"last10_opp\":110,\"roster\":[{\"name\":\"Player\",\"ppg\":20,\"per\":18,\"role\":\"STAR\",\"status\":\"PLAYING\"}]},\"away\":{same fields}} Use real values from data. Include all players found. role=STAR if ppg>20, KEY if ppg>11, else ROLE." }]
      })
    });
    const fd = await format.json();
    if (!format.ok) return res.status(502).json({ error: fd.error?.message || "Format error" });
    const raw = (fd.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
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