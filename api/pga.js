export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();

  const pplxKey = process.env.PERPLEXITY_API_KEY;
  if (!pplxKey) return res.status(500).json({ error: "PERPLEXITY_API_KEY not set" });

  const TIMEOUT = 50000;
  const safe = async (fn) => { try { return await fn(); } catch { return null; } };
  const fetchT = (url, opts = {}) => Promise.race([
    fetch(url, opts),
    new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), TIMEOUT))
  ]);

  // Robust JSON extractor — handles raw JSON, ```json fences, and JSON buried in prose
  function extractJSON(raw) {
    if (!raw) return null;
    // Try markdown code fence first
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fence) {
      try { return JSON.parse(fence[1]); } catch {}
    }
    // Try to find JSON array
    const arr = raw.match(/\[[\s\S]*\]/);
    if (arr) {
      try { return JSON.parse(arr[0]); } catch {}
    }
    // Try to find JSON object
    const obj = raw.match(/\{[\s\S]*\}/);
    if (obj) {
      try { return JSON.parse(obj[0]); } catch {}
    }
    // Direct parse as last resort
    try { return JSON.parse(raw.trim()); } catch {}
    return null;
  }

  try {
    // ESPN Golf — find active PLAYERS Championship event for field context
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
      espnNames = comps.slice(0, 40).map(c => c.athlete?.displayName || c.displayName || "").filter(Boolean);
    }

    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const fieldHint = espnNames.length > 5
      ? `Players currently in the field: ${espnNames.slice(0, 25).join(", ")}.`
      : "Include top contenders from the 2025-26 PGA TOUR season.";

    // Ask Perplexity for a JSON ARRAY (simpler, more reliable parsing)
    const prompt = `Today is ${today}. ${fieldHint}

Predict the top 25 finishers at THE PLAYERS Championship 2026, TPC Sawgrass, based on 2025-26 PGA TOUR season data.

Return ONLY a JSON array — no other text, no markdown, no explanation — starting with [ and ending with ]:

[
  {
    "rank": 1,
    "name": "Player Full Name",
    "sg_total": 2.85,
    "sg_approach": 1.10,
    "sg_off_tee": 0.65,
    "driving_accuracy": 62.5,
    "scoring_avg": 68.8,
    "recent_top10": 4,
    "recent_cut_rate": 0.88,
    "best_finish_players": 3,
    "has_top20_players": 1,
    "preview_rank": 1,
    "reason": "Brief reason (1 sentence)"
  }
]

Field definitions:
- rank: predicted finish 1-25
- sg_total, sg_approach, sg_off_tee: 2025-26 season averages (use null if unknown)
- driving_accuracy: season driving accuracy % (use null if unknown)
- scoring_avg: season scoring average, lower is better (use null if unknown)
- recent_top10: top-10 finishes in last 8 PGA TOUR events
- recent_cut_rate: fraction of cuts made in last 8 events (0.0-1.0)
- best_finish_players: best career finish position at THE PLAYERS (use 99 if never played or no history)
- has_top20_players: 1 if career top-20 at THE PLAYERS, else 0
- preview_rank: expert consensus rank (1=top overall pick, 99 if not in previews)
- reason: one-sentence reason this player is predicted to contend`;

    const pplxResp = await fetchT("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + pplxKey },
      body: JSON.stringify({
        model: "llama-3.1-sonar-large-128k-online",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 6000
      })
    });

    const pplxJson = await pplxResp.json();
    const raw = pplxJson?.choices?.[0]?.message?.content || "";

    const parsed = extractJSON(raw);
    const rawArray = Array.isArray(parsed) ? parsed
      : Array.isArray(parsed?.players) ? parsed.players : [];

    const players = rawArray
      .filter(p => p && p.name)
      .slice(0, 25)
      .map((p, i) => ({
        name: String(p.name).trim(),
        predicted_finish: typeof p.rank === "number" ? p.rank : i + 1,
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

    // Debug: log raw if empty
    if (!players.length) {
      console.error("PGA: 0 players parsed. Raw:", raw.slice(0, 500));
    }

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
    console.error("PGA handler error:", e);
    res.status(500).json({ error: e.message });
  }
}
