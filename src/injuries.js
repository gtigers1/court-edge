// api/injuries.js — Vercel serverless function
// Proxies ESPN injury requests server-side to avoid CORS blocks

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { teamId } = req.query;
  if (!teamId) return res.status(400).json({ error: "teamId required" });

  try {
    // Step 1: get list of injury reference URLs
    const listResp = await fetch(
      `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/teams/${teamId}/injuries?limit=20`,
      { headers: { "User-Agent": "Mozilla/5.0" } }
    );
    if (!listResp.ok) return res.status(200).json({ injuries: [] });
    const listData = await listResp.json();
    const items = (listData.items || []).slice(0, 8);

    // Step 2: fetch each injury detail
    const injuries = [];
    for (const item of items) {
      try {
        const detailResp = await fetch(item.$ref, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (!detailResp.ok) continue;
        const d = await detailResp.json();

        // Get player name from nested ref if needed
        let playerName = d.athlete?.displayName || d.athlete?.shortName || "";
        if (!playerName && d.athlete?.$ref) {
          const pResp = await fetch(d.athlete.$ref, { headers: { "User-Agent": "Mozilla/5.0" } });
          if (pResp.ok) {
            const pData = await pResp.json();
            playerName = pData.displayName || pData.fullName || "";
          }
        }
        if (!playerName) continue;

        const rawStatus = (d.status || d.type?.description || "questionable").toLowerCase();
        const status = rawStatus.includes("out") ? "OUT"
          : rawStatus.includes("doubt") ? "DOUBTFUL"
          : "QUESTIONABLE";
        const reason = (d.shortComment || d.longComment || d.type?.description || "Injury")
          .replace(/^Injury\/Illness - /i, "");

        injuries.push({ name: playerName, status, reason });
      } catch (_) {}
    }

    return res.status(200).json({ injuries });
  } catch (err) {
    return res.status(200).json({ injuries: [] }); // fail silently
  }
}
