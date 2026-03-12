export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();

  const pplxKey = process.env.PERPLEXITY_API_KEY;
  if (!pplxKey) return res.status(500).json({ error: "PERPLEXITY_API_KEY not set" });

  const TIMEOUT = 28000;
  const safe = async (fn) => { try { return await fn(); } catch { return null; } };
  const fetchT = (url, opts = {}) => Promise.race([
    fetch(url, opts),
    new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), TIMEOUT))
  ]);

  try {
    // 1. Try ESPN Golf API for the PLAYERS Championship field
    const scoreResp = await safe(() => fetchT(
      "https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard"
    ));
    const scoreJson = scoreResp ? await scoreResp.json().catch(() => null) : null;

    const events = scoreJson?.events || [];
    const playersEvent = events.find(e =>
      (e.name || e.shortName || "").toLowerCase().includes("players")
    );

    // 2. Get ESPN field if event found
    let espnNames = [];
    if (playersEvent?.id) {
      const ldrResp = await safe(() => fetchT(
        `https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?event=${playersEvent.id}`
      ));
      const ldrJson = ldrResp ? await ldrResp.json().catch(() => null) : null;
      const comps = ldrJson?.events?.[0]?.competitions?.[0]?.competitors || [];
      espnNames = comps.slice(0, 60).map(c => c.athlete?.displayName || c.displayName || "").filter(Boolean);
    }

    const fieldHint = espnNames.length
      ? `\nKnown field players: ${espnNames.slice(0, 30).join(", ")} (and more)`
      : "";

    // 3. Use Perplexity to get comprehensive player stats with current 2025-26 data
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    const prompt = `Today is ${today}. Provide THE PLAYERS Championship 2026 prediction data from the 2025-26 PGA TOUR season.${fieldHint}

Return ONLY valid JSON (no markdown fences, no explanation) with this exact structure:
{
  "tournament": "The Players Championship 2026",
  "course": "TPC Sawgrass",
  "players": [
    {
      "name": "Player Full Name",
      "sg_total": 1.23,
      "sg_approach": 0.45,
      "sg_off_tee": 0.38,
      "driving_accuracy": 63.5,
      "scoring_avg": 70.2,
      "recent_avg_finish": 18.5,
      "recent_top10": 3,
      "recent_cut_rate": 0.85,
      "best_finish_players": 2,
      "has_top20_players": 1,
      "preview_rank": 1,
      "sources": ["pgatour", "espn"]
    }
  ]
}

Definitions:
- sg_total/sg_approach/sg_off_tee: 2025-26 season strokes gained averages (null if unavailable)
- driving_accuracy: season driving accuracy percentage
- scoring_avg: season scoring average (lower is better)
- recent_avg_finish: average finish position in last 8 events (lower is better)
- recent_top10: count of top-10 finishes in last 8 events
- recent_cut_rate: fraction of cuts made in last 8 events (0.0-1.0)
- best_finish_players: best career finish position at THE PLAYERS Championship (999 if no history)
- has_top20_players: 1 if player has ever had a top-20 at THE PLAYERS, else 0
- preview_rank: 1 for top expert/analyst pick, 2 for second, 999 if not in previews
- sources: list of source labels used

Include top 50 players. Order by win likelihood. Return ONLY the JSON object.`;

    const pplxResp = await fetchT("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + pplxKey },
      body: JSON.stringify({
        model: "llama-3.1-sonar-large-128k-online",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 5000
      })
    });

    const pplxJson = await pplxResp.json();
    const raw = pplxJson?.choices?.[0]?.message?.content || "{}";

    let parsed;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      parsed = { players: [] };
    }

    const players = (parsed.players || [])
      .filter(p => p && p.name)
      .map(p => ({
        name: String(p.name).trim(),
        sg_total: typeof p.sg_total === "number" ? p.sg_total : null,
        sg_approach: typeof p.sg_approach === "number" ? p.sg_approach : null,
        sg_off_tee: typeof p.sg_off_tee === "number" ? p.sg_off_tee : null,
        driving_accuracy: typeof p.driving_accuracy === "number" ? p.driving_accuracy : null,
        scoring_avg: typeof p.scoring_avg === "number" ? p.scoring_avg : null,
        recent_avg_finish: typeof p.recent_avg_finish === "number" ? p.recent_avg_finish : null,
        recent_top10: typeof p.recent_top10 === "number" ? p.recent_top10 : null,
        recent_cut_rate: typeof p.recent_cut_rate === "number" ? p.recent_cut_rate : null,
        best_finish_players: typeof p.best_finish_players === "number" ? p.best_finish_players : null,
        has_top20_players: p.has_top20_players === 1 ? 1 : 0,
        preview_rank: typeof p.preview_rank === "number" ? p.preview_rank : 999,
        sources: Array.isArray(p.sources) ? p.sources : ["perplexity"]
      }));

    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
    res.status(200).json({
      players,
      tournament: parsed.tournament || "The Players Championship 2026",
      course: parsed.course || "TPC Sawgrass",
      espnEventFound: !!playersEvent,
      espnFieldSize: espnNames.length,
      fetched: new Date().toISOString()
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
