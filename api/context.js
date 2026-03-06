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

  // Safe default returned if search/parse fails — model still runs with zero adjustments
  const safeDefault = { totalAdjustment:0, homeMLAdjustment:0, spreadAdjustment:0, injuryAlerts:[], situationalNotes:[], refNotes:[] };

  const schema = '{"totalAdjustment":0,"homeMLAdjustment":0,"spreadAdjustment":0,"injuryAlerts":[],"situationalNotes":[],"refNotes":[]}';

  // Compact single-paragraph prompt — easier for search models to return clean JSON
  const prompt = `Search for tonight's ${awayTeam} @ ${homeTeam} ${sportName} game on ${dateStr}. Research: (1) referee crew assigned to this game and whether they average more or fewer fouls/points than league average, (2) any player injury or lineup news announced today (OUT/doubtful/questionable), (3) situational factors like back-to-back games, playoff seeding stakes, or revenge games. Return ONLY this JSON object with real data — no markdown, no fences, no extra text: ${schema} Rules: totalAdjustment = pts to add to game total (-5 to +5, positive means over). homeMLAdjustment = add to ${homeTeam} win probability (-0.05 to +0.05). spreadAdjustment = add to ${homeTeam} spread (-3 to +3). injuryAlerts = array of short injury strings. situationalNotes = array of short situational strings. refNotes = array of short referee tendency strings. Use 0 / empty arrays if data not found.`;

  let raw = "";
  try {
    if (pplxKey) {
      const r = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${pplxKey}` },
        body: JSON.stringify({
          model: "sonar-pro",
          max_tokens: 800,
          messages: [
            { role: "system", content: "You are a sports betting data API. Always respond with a single valid JSON object. No markdown, no code fences, no explanation." },
            { role: "user", content: prompt }
          ]
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

    // Progressive JSON extraction
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch(_) {}
    if (!parsed) { try { parsed = JSON.parse(raw.replace(/^```json\s*/i,"").replace(/\s*```$/,"").trim()); } catch(_) {} }
    if (!parsed) { try { const i=raw.indexOf("{"), j=raw.lastIndexOf("}"); if(i>=0&&j>i) parsed=JSON.parse(raw.slice(i,j+1)); } catch(_) {} }

    // If still unparseable, return safe defaults rather than blocking the user
    if (!parsed) {
      const note = raw.length > 0 ? "Context search returned non-JSON response" : "Context search returned empty response";
      return res.status(200).json({ ...safeDefault, situationalNotes: [note] });
    }

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
    // Never block the user — return safe defaults with the error as a note
    return res.status(200).json({ ...safeDefault, situationalNotes: ["Context fetch error: " + err.message] });
  }
}
