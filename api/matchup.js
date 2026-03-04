export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });
  const { homeTeam, awayTeam } = req.body || {};
  if (!homeTeam || !awayTeam) return res.status(400).json({ error: "homeTeam and awayTeam required" });
  try {
    const search = async (team) => {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001", max_tokens: 1500,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: "It is March 2026. Search for the " + team + " current NBA roster right now. Find their active players list for the 2025-26 season including any recent trades or signings. List every player currently on the roster with their points per game this season. Also find their current win-loss record and team scoring stats." }]
        })
      });
      const d = await r.json();
      return (d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("");
    };

    const fmtTeam = async (team, data) => {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1500,
          system: "Output only a single raw JSON object. No markdown, no explanation, no code fences.",
          messages: [{ role: "user", content: "Convert this " + team + " NBA roster data to JSON.\n\nData:\n" + data.slice(0,2500) + "\n\nJSON format:\n{\"wins\":0,\"losses\":0,\"ppg\":112,\"opp\":110,\"efg_pct\":0.52,\"tov_rate\":13,\"oreb_pct\":0.25,\"ftr\":0.22,\"opp_efg_pct\":0.52,\"opp_tov_rate\":13,\"opp_oreb_pct\":0.25,\"opp_ftr\":0.22,\"last10\":\"5-5\",\"last10_ppg\":112,\"last10_opp\":110,\"roster\":[{\"name\":\"Player Name\",\"ppg\":20.0,\"per\":17.0,\"role\":\"STAR\",\"status\":\"PLAYING\"}]}\nRules: Only players on the current roster (March 2026). role=STAR if ppg>20, KEY if ppg>11, else ROLE. per=ppg*0.85. Estimate team ppg/opp from context if not given." }]
        })
      });
      const d = await r.json();
      const raw = (d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("").trim();
      let p = null;
      try { p = JSON.parse(raw); } catch(_) {}
      if (!p) { try { p = JSON.parse(raw.replace(/^```json\s*/i,"").replace(/\s*```$/,"")); } catch(_) {} }
      if (!p) { try { const i=raw.indexOf("{"),j=raw.lastIndexOf("}"); if(i>=0&&j>i) p=JSON.parse(raw.slice(i,j+1)); } catch(_) {} }
      return p;
    };

    const [t1, t2] = await Promise.all([search(awayTeam), search(homeTeam)]);
    const [away, home] = await Promise.all([fmtTeam(awayTeam, t1), fmtTeam(homeTeam, t2)]);
    if (!home || !away) return res.status(500).json({ error: "Parse failed" });
    const fix = t => ({ wins:t.wins??20, losses:t.losses??20, ppg:t.ppg??112, opp:t.opp??112, efg_pct:t.efg_pct??.52, tov_rate:t.tov_rate??13.5, oreb_pct:t.oreb_pct??.26, ftr:t.ftr??.22, opp_efg_pct:t.opp_efg_pct??.52, opp_tov_rate:t.opp_tov_rate??13.5, opp_oreb_pct:t.opp_oreb_pct??.26, opp_ftr:t.opp_ftr??.22, last10:t.last10??"5-5", last10_ppg:t.last10_ppg??t.ppg??112, last10_opp:t.last10_opp??t.opp??112, roster:(t.roster||[]).map(p=>({name:p.name||"Unknown",ppg:p.ppg??10,per:p.per??12,role:p.role||"ROLE",status:p.status||"PLAYING"})) });
    return res.status(200).json({ home: fix(home), away: fix(away) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}