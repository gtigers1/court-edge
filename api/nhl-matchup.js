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
        messages: [{ role: "user", content: `2025-26 NHL stats for ${homeTeam} and ${awayTeam}. Output ONLY this JSON structure with real data:
{"home":{"wins":0,"losses":0,"otl":0,"points":0,"gf_pg":0.0,"ga_pg":0.0,"pp_pct":0.0,"pk_pct":0.0,"shots_pg":0.0,"shots_against_pg":0.0,"save_pct":0.0,"last10":"5-3-2","last10_gf":0.0,"last10_ga":0.0,"goalie":{"name":"Name","save_pct":0.910,"gaa":2.50,"starts":0,"status":"PLAYING"},"roster":[{"name":"Name","position":"C","goals":0,"assists":0,"points":0,"plus_minus":0,"role":"STAR","status":"PLAYING"}]},"away":{...same fields...}}
8 skaters per team sorted by points. role: STAR>40pts, KEY>20pts, else ROLE. status from injury report.` }]
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
      wins:t.wins??20, losses:t.losses??15, otl:t.otl??5, points:t.points??45,
      gf_pg:t.gf_pg??3.0, ga_pg:t.ga_pg??3.0, pp_pct:t.pp_pct??20, pk_pct:t.pk_pct??80,
      shots_pg:t.shots_pg??30, shots_against_pg:t.shots_against_pg??30, save_pct:t.save_pct??.905,
      last10:t.last10??"5-3-2", last10_gf:t.last10_gf??3.0, last10_ga:t.last10_ga??3.0,
      goalie:{ name:t.goalie?.name??"Starter", save_pct:t.goalie?.save_pct??.905, gaa:t.goalie?.gaa??2.80, starts:t.goalie?.starts??20, status:t.goalie?.status??"PLAYING" },
      roster:(t.roster||[]).map(p=>({ name:p.name||"Unknown", position:p.position||"F", goals:p.goals??0, assists:p.assists??0, points:p.points??0, plus_minus:p.plus_minus??0, role:p.role||"ROLE", status:p.status||"PLAYING" }))
    });

    return res.status(200).json({ home: fix(parsed.home), away: fix(parsed.away) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
