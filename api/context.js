export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const pplxKey = process.env.PERPLEXITY_API_KEY;
  const apiKey  = process.env.ANTHROPIC_API_KEY;
  if (!pplxKey && !apiKey) return res.status(500).json({ error: "No AI key configured" });

  const { homeTeam, awayTeam, sport } = req.body || {};
  if (!homeTeam || !awayTeam) return res.status(400).json({ error: "homeTeam and awayTeam required" });

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const sportName = sport === "nhl" ? "NHL hockey" : sport === "ncaam" ? "college basketball" : "NBA basketball";

  const schema = '{"totalAdjustment":0,"homeMLAdjustment":0,"spreadAdjustment":0,"injuryAlerts":[],"situationalNotes":[],"refNotes":[]}';

  const prompt = `Search for the ${awayTeam} vs ${homeTeam} ${sportName} game today (${dateStr}). Find:

1. REFEREE CREW: Who are the assigned referees for this game? Look up their historical tendencies - do they call more or fewer fouls than average? High-foul crews lead to more free throws and higher-scoring games. NBA average game total is ~224 pts.

2. INJURY/LINEUP NEWS: Any players listed as OUT, doubtful, or questionable for tonight? Any last-minute lineup changes or load management decisions announced today?

3. SITUATIONAL FACTORS: Is either team on a back-to-back? Any revenge game narrative? Playoff seeding implications? Recent travel? Home vs road record differences?

Based on this research, return ONLY this JSON schema filled with real data:
${schema}

Rules:
- totalAdjustment: points to add to model total (positive=over, negative=under). Clamp to -5/+5. Use 0 if uncertain.
- homeMLAdjustment: probability to add to ${homeTeam} win chance (positive=home favored more). Clamp to -0.05/+0.05. Use 0 if uncertain.
- spreadAdjustment: points to add to ${homeTeam} spread (positive=home covers better). Clamp to -3/+3. Use 0 if uncertain.
- injuryAlerts: up to 5 short strings describing confirmed injuries/lineup news found today.
- situationalNotes: up to 5 short strings about back-to-backs, revenge games, seeding stakes.
- refNotes: up to 3 short strings about referee crew and their scoring tendencies.

No markdown. No code fences. No explanation. Return only the JSON object.`;

  let raw = "";
  try {
    if (pplxKey) {
      const r = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${pplxKey}` },
        body: JSON.stringify({
          model: "sonar-pro",
          messages: [
            { role: "system", content: "You are a sports betting research assistant. Search the web for current, real information about tonight's game and return only a valid JSON object. No markdown, no code fences, no explanation." },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" }
        })
      });
      const d = await r.json();
      raw = d.choices?.[0]?.message?.content || "";
    } else if (apiKey) {
      // Anthropic fallback: search then format
      const search = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001", max_tokens: 1000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: `${awayTeam} vs ${homeTeam} ${sportName} ${dateStr}: referee crew tonight, injury report, back-to-back schedule` }]
        })
      });
      const sd = await search.json();
      const searchText = (sd.content || []).filter(b => b.type === "text").map(b => b.text).join("").slice(0, 2000);
      const fmt = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 600,
          system: "Output only a single raw JSON object. No markdown, no explanation, no code fences.",
          messages: [{ role: "user", content: `Context for ${awayTeam} @ ${homeTeam}:\n${searchText}\n\nReturn this schema:\n${schema}\n\nRules: totalAdjustment ±5 pts (refs/pace), homeMLAdjustment ±0.05, spreadAdjustment ±3. Use 0 if not found.` }]
        })
      });
      const fd = await fmt.json();
      raw = (fd.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    }

    let parsed = null;
    try { parsed = JSON.parse(raw); } catch(_) {}
    if (!parsed) { try { parsed = JSON.parse(raw.replace(/^```json\s*/i,"").replace(/\s*```$/,"")); } catch(_) {} }
    if (!parsed) { try { const i=raw.indexOf("{"),j=raw.lastIndexOf("}"); if(i>=0&&j>i) parsed=JSON.parse(raw.slice(i,j+1)); } catch(_) {} }
    if (!parsed) return res.status(500).json({ error: "Parse failed", raw: raw.slice(0, 200) });

    // Clamp adjustments to safe bounds
    const clamp = (v, mn, mx) => Math.max(mn, Math.min(mx, parseFloat(v) || 0));
    parsed.totalAdjustment   = clamp(parsed.totalAdjustment,   -5,    5);
    parsed.homeMLAdjustment  = clamp(parsed.homeMLAdjustment,  -0.05, 0.05);
    parsed.spreadAdjustment  = clamp(parsed.spreadAdjustment,  -3,    3);
    parsed.injuryAlerts      = Array.isArray(parsed.injuryAlerts)     ? parsed.injuryAlerts.slice(0, 5)     : [];
    parsed.situationalNotes  = Array.isArray(parsed.situationalNotes) ? parsed.situationalNotes.slice(0, 5) : [];
    parsed.refNotes          = Array.isArray(parsed.refNotes)         ? parsed.refNotes.slice(0, 3)         : [];

    return res.status(200).json(parsed);
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
