export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ODDS_API_KEY not set" });

  const { sport, homeTeam, awayTeam } = req.body || {};
  if (!sport || !homeTeam || !awayTeam) return res.status(400).json({ error: "sport, homeTeam, awayTeam required" });

  const sportKey = sport === "nba" ? "basketball_nba" : sport === "nhl" ? "icehockey_nhl" : "basketball_ncaab";

  // Normalize for fuzzy matching
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");

  // Known name differences between our app and the odds API
  const ALIASES = {
    "LA Clippers": "Los Angeles Clippers",
    "Utah Mammoth": "Utah Hockey Club",
  };
  const resolvedHome = ALIASES[homeTeam] || homeTeam;
  const resolvedAway = ALIASES[awayTeam] || awayTeam;

  try {
    const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${apiKey}&regions=us,eu&markets=h2h,spreads,totals&oddsFormat=american&bookmakers=draftkings,fanduel,betmgm,caesars,pinnacle`;
    const resp = await fetch(url);

    const creditsRemaining = resp.headers.get("x-requests-remaining");
    const creditsUsed = resp.headers.get("x-requests-used");

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      return res.status(resp.status).json({ error: err.message || "Odds API error " + resp.status });
    }

    const games = await resp.json();

    // Match game: try full name first, then last word (nickname), then first 6 chars
    const homeNorm = norm(resolvedHome);
    const awayNorm = norm(resolvedAway);
    const homeLast = norm(resolvedHome.split(" ").slice(-1)[0]);
    const awayLast = norm(resolvedAway.split(" ").slice(-1)[0]);

    let game = games.find(g => {
      const h = norm(g.home_team), a = norm(g.away_team);
      return (h === homeNorm || h.includes(homeNorm.slice(0, 7)) || homeNorm.includes(h.slice(0, 7))) &&
             (a === awayNorm || a.includes(awayNorm.slice(0, 7)) || awayNorm.includes(a.slice(0, 7)));
    });

    // Fallback: match by team nickname only
    if (!game && homeLast.length >= 4 && awayLast.length >= 4) {
      game = games.find(g => norm(g.home_team).includes(homeLast) && norm(g.away_team).includes(awayLast));
    }

    if (!game) {
      const available = games.slice(0, 12).map(g => `${g.away_team} @ ${g.home_team}`);
      return res.status(404).json({
        error: "Game not found - may not be scheduled today or lines not yet posted",
        searched: `${awayTeam} @ ${homeTeam}`,
        availableGames: available,
      });
    }

    // Parse each bookmaker's lines
    const bookData = {};
    for (const bk of game.bookmakers) {
      bookData[bk.key] = {};
      for (const mkt of bk.markets) {
        const findTeam = (outcomes, teamName) => {
          const n = norm(teamName);
          return outcomes.find(o => norm(o.name) === n || n.includes(norm(o.name).slice(0, 6)) || norm(o.name).includes(n.slice(0, 6)));
        };
        if (mkt.key === "h2h") {
          const home = findTeam(mkt.outcomes, game.home_team);
          const away = findTeam(mkt.outcomes, game.away_team);
          if (home) bookData[bk.key].homeML = Math.round(home.price);
          if (away) bookData[bk.key].awayML = Math.round(away.price);
        } else if (mkt.key === "spreads") {
          const home = findTeam(mkt.outcomes, game.home_team);
          if (home != null) {
            bookData[bk.key].homeSpread = home.point;
            bookData[bk.key].homeSpreadOdds = Math.round(home.price);
          }
        } else if (mkt.key === "totals") {
          const over = mkt.outcomes.find(o => o.name === "Over");
          if (over) bookData[bk.key].total = over.point;
        }
      }
    }

    // Consensus from US public books
    const pubKeys = ["draftkings", "fanduel", "betmgm", "caesars"].filter(k => bookData[k]?.homeML != null);
    const avg = vals => vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    const fmtML = v => v == null ? null : (v > 0 ? "+" + Math.round(v) : String(Math.round(v)));

    const homeMLs = pubKeys.map(k => bookData[k].homeML);
    const awayMLs = pubKeys.map(k => bookData[k].awayML);
    const spreads = pubKeys.filter(k => bookData[k].homeSpread != null).map(k => bookData[k].homeSpread);
    const totals = pubKeys.filter(k => bookData[k].total != null).map(k => bookData[k].total);

    const consHomeML = avg(homeMLs);
    const pinnacle = bookData["pinnacle"];

    // Sharp money detection: Pinnacle (sharpest book) vs public consensus
    let sharpIndicator = null;
    if (pinnacle?.homeML != null && consHomeML != null) {
      const toImpl = ml => ml > 0 ? 100 / (ml + 100) : Math.abs(ml) / (Math.abs(ml) + 100);
      const consImpl = toImpl(consHomeML);
      const pinImpl = toImpl(pinnacle.homeML);
      const diff = pinImpl - consImpl;
      if (Math.abs(diff) >= 0.04) {
        const sharpSide = diff > 0 ? homeTeam : awayTeam;
        const sharpML = diff > 0 ? fmtML(pinnacle.homeML) : fmtML(pinnacle.awayML);
        const pubML = diff > 0 ? fmtML(Math.round(consHomeML)) : fmtML(Math.round(avg(awayMLs)));
        sharpIndicator = {
          side: diff > 0 ? "home" : "away",
          team: sharpSide,
          desc: `Pinnacle ${sharpML} vs public consensus ${pubML} on ${sharpSide} - sharp money signal`,
        };
      }
    }

    const avgSpread = avg(spreads);
    const avgTotal = avg(totals);

    res.status(200).json({
      homeML: fmtML(consHomeML),
      awayML: fmtML(avg(awayMLs)),
      homeSpread: avgSpread != null ? (avgSpread > 0 ? "+" : "") + avgSpread.toFixed(1) : null,
      total: avgTotal != null ? avgTotal.toFixed(1) : null,
      pinnacleHomeML: pinnacle?.homeML != null ? fmtML(pinnacle.homeML) : null,
      pinnacleAwayML: pinnacle?.awayML != null ? fmtML(pinnacle.awayML) : null,
      sharpIndicator,
      gameTime: game.commence_time,
      booksUsed: pubKeys,
      creditsRemaining,
      creditsUsed,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
