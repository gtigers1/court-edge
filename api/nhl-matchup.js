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
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 2000, tools: [{ type: "web_search_20250305", name: "web_search" }], system: "You are a JSON-only API. Never output prose, markdown, or code fences. Only output a single raw JSON object.", messages: [{ role: "user", content: "Search current 2025-26 NHL season stats for " + awayTeam + " and " + homeTeam + ". Reply with ONLY this JSON (fill real values): {\"home\":{\"wins\":0,\"losses\":0,\"otl\":0,\"points\":0,\"gf_pg\":3.1,\"ga_pg\":2.8,\"pp_pct\":21.5,\"pk_pct\":81.0,\"shots_pg\":31.2,\"shots_against_pg\":29.8,\"save_pct\":0.912,\"last10\":\"6-2-2\",\"last10_gf\":3.2,\"last10_ga\":2.6,\"goalie\":{\"name\":\"Starter Name\",\"save_pct\":0.912,\"gaa\":2.45,\"starts\":28,\"status\":\"PLAYING\"},\"roster\":[{\"name\":\"Player Name\",\"position\":\"LW\",\"goals\":18,\"assists\":26,\"points\":44,\"plus_minus\":8,\"role\":\"STAR\",\"status\":\"PLAYING\"}]},\"away\":{\"wins\":0,\"losses\":0,\"otl\":0,\"points\":0,\"gf_pg\":3.1,\"ga_pg\":2.8,\"pp_pct\":21.5,\"pk_pct\":81.0,\"shots_pg\":31.2,\"shots_against_pg\":29.8,\"save_pct\":0.912,\"last10\":\"6-2-2\",\"last10_gf\":3.2,\"last10_ga\":2.6,\"goalie\":{\"name\":\"Starter Name\",\"save_pct\":0.912,\"gaa\":2.45,\"starts\":28,\"status\":\"PLAYING\"},\"roster\":[{\"name\":\"Player Name\",\"position\":\"LW\",\"goals\":18,\"assists\":26,\"points\":44,\"plus_minus\":8,\"role\":\"STAR\",\"status\":\"PLAYING\"}]}} Include 8 real skaters per team sorted by points. role=STAR if pts>40, KEY if pts>20, else ROLE. status=OUT/DOUBTFUL/QUESTIONABLE/PLAYING." }] })
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || "API error" });
    const raw = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch(_) {}
    if (!parsed) { try { parsed = JSON.parse(raw.replace(/```json|```/gi, "").trim()); } catch(_) {} }
    if (!parsed) { try { const i=raw.indexOf("{"),j=raw.lastIndexOf("}"); parsed=JSON.parse(raw.slice(i,j+1)); } catch(_) {} }
    if (!parsed?.home || !parsed?.away) return res.status(500).json({ error: "Could not parse response", raw: raw.slice(0,400) });
    const fix = t => ({ wins:t.wins??20, losses:t.losses??15, otl:t.otl??5, points:t.points??45, gf_pg:t.gf_pg??3.0, ga_pg:t.ga_pg??3.0, pp_pct:t.pp_pct??20, pk_pct:t.pk_pct??80, shots_pg:t.shots_pg??30, shots_against_pg:t.shots_against_pg??30, save_pct:t.save_pct??.905, last10:t.last10??"5-3-2", last10_gf:t.last10_gf??3.0, last10_ga:t.last10_ga??3.0, goalie:{ name:t.goalie?.name??"Starter", save_pct:t.goalie?.save_pct??.905, gaa:t.goalie?.gaa??2.80, starts:t.goalie?.starts??20, status:t.goalie?.status??"PLAYING" }, roster:(t.roster||[]).map(p=>({ name:p.name||"Unknown", position:p.position||"F", goals:p.goals??0, assists:p.assists??0, points:p.points??0, plus_minus:p.plus_minus??0, role:p.role||"ROLE", status:p.status||"PLAYING" })) });
    return res.status(200).json({ home: fix(parsed.home), away: fix(parsed.away) });
  } catch (err) { return res.status(500).json({ error: err.message }); }
}
