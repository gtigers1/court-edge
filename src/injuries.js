// api/injuries.js — Vercel serverless function
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { teamId } = req.query;
  if (!teamId) return res.status(400).json({ error: "teamId required" });

  const debug = [];

  try {
    const listUrl = `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/teams/${teamId}/injuries?limit=20`;
    debug.push(`Fetching: ${listUrl}`);

    const listResp = await fetch(listUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
    });

    debug.push(`Status: ${listResp.status}`);

    if (!listResp.ok) {
      const errText = await listResp.text();
      debug.push(`Error body: ${errText.slice(0, 200)}`);
      return res.status(200).json({ injuries: [], debug });
    }

    const listData = await listResp.json();
    debug.push(`Keys: ${Object.keys(listData).join(", ")}`);
    debug.push(`Items count: ${(listData.items || []).length}`);
    debug.push(`Raw sample: ${JSON.stringify(listData).slice(0, 300)}`);

    const items = (listData.items || []).slice(0, 8);
    const injuries = [];

    for (const item of items) {
      try {
        debug.push(`Item ref: ${item.$ref}`);
        const detailResp = await fetch(item.$ref, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
        });
        debug.push(`Detail status: ${detailResp.status}`);
        if (!detailResp.ok) continue;
        const d = await detailResp.json();
        debug.push(`Detail keys: ${Object.keys(d).join(", ")}`);
        debug.push(`Detail sample: ${JSON.stringify(d).slice(0, 300)}`);

        let playerName = d.athlete?.displayName || d.athlete?.shortName || "";
        if (!playerName && d.athlete?.$ref) {
          debug.push(`Fetching athlete: ${d.athlete.$ref}`);
          const pResp = await fetch(d.athlete.$ref, {
            headers: { "User-Agent": "Mozilla/5.0" }
          });
          if (pResp.ok) {
            const pData = await pResp.json();
            playerName = pData.displayName || pData.fullName || "";
            debug.push(`Athlete name: ${playerName}`);
          }
        }

        if (!playerName) { debug.push("No player name found"); continue; }

        const rawStatus = (d.status || d.type?.description || "questionable").toLowerCase();
        const status = rawStatus.includes("out") ? "OUT"
          : rawStatus.includes("doubt") ? "DOUBTFUL" : "QUESTIONABLE";
        const reason = (d.shortComment || d.longComment || d.type?.description || "Injury")
          .replace(/^Injury\/Illness - /i, "");

        injuries.push({ name: playerName, status, reason });
      } catch (e) {
        debug.push(`Item error: ${e.message}`);
      }
    }

    return res.status(200).json({ injuries, debug });
  } catch (err) {
    debug.push(`Top error: ${err.message}`);
    return res.status(200).json({ injuries: [], debug });
  }
}
