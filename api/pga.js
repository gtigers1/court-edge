export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();

  const pplxKey = process.env.PERPLEXITY_API_KEY;
  if (!pplxKey) return res.status(500).json({ error: "PERPLEXITY_API_KEY not set" });

  const safe = async (fn) => { try { return await fn(); } catch { return null; } };
  const fetchT = (url, opts = {}, ms = 8000) => Promise.race([
    fetch(url, opts),
    new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))
  ]);

  try {
    // ESPN Golf — find active PLAYERS Championship
    const scoreResp = await safe(() => fetchT(
      "https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard"
    ));
    const scoreJson = scoreResp ? await scoreResp.json().catch(() => null) : null;
    const events = scoreJson?.events || [];
    const playersEvent = events.find(e =>
      (e.name || e.shortName || "").toLowerCase().includes("players")
    );

    let espnNames = [];
    if (playersEvent?.id) {
      const ldrResp = await safe(() => fetchT(
        `https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?event=${playersEvent.id}`
      ));
      const ldrJson = ldrResp ? await ldrResp.json().catch(() => null) : null;
      const comps = ldrJson?.events?.[0]?.competitions?.[0]?.competitors || [];
      espnNames = comps.slice(0, 30).map(c => c.athlete?.displayName || c.displayName || "").filter(Boolean);
    }

    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const fieldHint = espnNames.length > 3
      ? `Some players in the field: ${espnNames.slice(0, 20).join(", ")}.`
      : "";

    // Use response_format json_object so Perplexity MUST return valid JSON
    const systemMsg = "You are a sports analytics API. You MUST return only valid JSON with no extra text, no markdown, no citations, no explanations.";

    const userMsg = `Today is ${today}. ${fieldHint}

Predict the top 25 finishers at THE PLAYERS Championship 2026 at TPC Sawgrass using 2025-26 PGA TOUR season data.

Return a JSON object with a "players" array:
{
  "players": [
    {
      "rank": 1,
      "name": "Scottie Scheffler",
      "sg_total": 3.1,
      "sg_approach": 1.2,
      "sg_off_tee": 0.8,
      "driving_accuracy": 62.0,
      "scoring_avg": 68.4,
      "recent_top10": 5,
      "recent_cut_rate": 0.9,
      "best_finish_players": 3,
      "has_top20_players": 1,
      "preview_rank": 1,
      "reason": "World number one with dominant SG stats and multiple PLAYERS contention history"
    }
  ]
}

Rules:
- rank: 1-25, predicted finish position
- sg_total/sg_approach/sg_off_tee: season SG averages, null if unknown
- driving_accuracy: season %, null if unknown
- scoring_avg: season avg score (lower=better), null if unknown
- recent_top10: count of top-10s in last 8 events
- recent_cut_rate: 0.0-1.0, null if unknown
- best_finish_players: best career finish at THE PLAYERS (99 if no history)
- has_top20_players: 1 if career top-20 at THE PLAYERS, else 0
- preview_rank: expert pick rank (99 if unmentioned)
- reason: one sentence why this player contends
Return ONLY the JSON object, nothing else.`;

    // Perplexity supports response_format: {type:"json_schema"} — enforces exact output structure
    const playerSchema = {
      type: "object",
      properties: {
        players: {
          type: "array",
          items: {
            type: "object",
            properties: {
              rank:                { type: "integer" },
              name:                { type: "string" },
              sg_total:            { type: ["number","null"] },
              sg_approach:         { type: ["number","null"] },
              sg_off_tee:          { type: ["number","null"] },
              driving_accuracy:    { type: ["number","null"] },
              scoring_avg:         { type: ["number","null"] },
              recent_top10:        { type: ["integer","null"] },
              recent_cut_rate:     { type: ["number","null"] },
              best_finish_players: { type: ["integer","null"] },
              has_top20_players:   { type: "integer" },
              preview_rank:        { type: "integer" },
              reason:              { type: "string" }
            },
            required: ["rank","name","reason"]
          }
        }
      },
      required: ["players"]
    };

    const pplxResp = await fetchT("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + pplxKey },
      body: JSON.stringify({
        model: "llama-3.1-sonar-large-128k-online",
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: userMsg }
        ],
        response_format: { type: "json_schema", json_schema: { schema: playerSchema } },
        temperature: 0.1,
        max_tokens: 5000
      })
    }, 50000);

    if (!pplxResp.ok) {
      const errText = await pplxResp.text().catch(() => "");
      return res.status(500).json({ error: `Perplexity ${pplxResp.status}: ${errText.slice(0, 200)}` });
    }

    const pplxJson = await pplxResp.json();

    // Detect API-level errors (rate limit, etc.)
    if (pplxJson?.error) {
      return res.status(500).json({ error: `Perplexity error: ${JSON.stringify(pplxJson.error).slice(0, 200)}` });
    }

    const raw = pplxJson?.choices?.[0]?.message?.content || "";

    // Parse — response_format: json_object guarantees a JSON object
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Fallback: try to extract JSON if model ignored the format constraint
      const fence = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (fence) { try { parsed = JSON.parse(fence[1]); } catch {} }
      if (!parsed) {
        const obj = raw.match(/\{[\s\S]*\}/);
        if (obj) { try { parsed = JSON.parse(obj[0]); } catch {} }
      }
    }

    const rawArray = Array.isArray(parsed?.players) ? parsed.players
      : Array.isArray(parsed) ? parsed : [];

    if (!rawArray.length) {
      // Return debug info so we can see what went wrong
      return res.status(200).json({
        players: [],
        tournament: "The Players Championship 2026",
        course: "TPC Sawgrass",
        espnEventFound: !!playersEvent,
        espnFieldSize: espnNames.length,
        debug: raw.slice(0, 500),
        fetched: new Date().toISOString()
      });
    }

    const players = rawArray
      .filter(p => p && p.name)
      .slice(0, 25)
      .map((p, i) => ({
        name: String(p.name).trim(),
        sg_total: typeof p.sg_total === "number" ? p.sg_total : null,
        sg_approach: typeof p.sg_approach === "number" ? p.sg_approach : null,
        sg_off_tee: typeof p.sg_off_tee === "number" ? p.sg_off_tee : null,
        driving_accuracy: typeof p.driving_accuracy === "number" ? p.driving_accuracy : null,
        scoring_avg: typeof p.scoring_avg === "number" ? p.scoring_avg : null,
        recent_top10: typeof p.recent_top10 === "number" ? p.recent_top10 : null,
        recent_cut_rate: typeof p.recent_cut_rate === "number" ? p.recent_cut_rate : null,
        best_finish_players: typeof p.best_finish_players === "number" ? p.best_finish_players : null,
        has_top20_players: p.has_top20_players === 1 ? 1 : 0,
        preview_rank: typeof p.preview_rank === "number" ? p.preview_rank : 99,
        reason: typeof p.reason === "string" ? p.reason : "",
        sources: ["perplexity"]
      }));

    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
    res.status(200).json({
      players,
      tournament: "The Players Championship 2026",
      course: "TPC Sawgrass",
      espnEventFound: !!playersEvent,
      espnFieldSize: espnNames.length,
      fetched: new Date().toISOString()
    });

  } catch (e) {
    console.error("PGA handler error:", e.message);
    res.status(500).json({ error: e.message });
  }
}
