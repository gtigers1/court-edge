export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).end();

  try {
    const oddsKey = process.env.ODDS_API_KEY;
    const dateParam = req.query.date; // YYYYMMDD, defaults to today

    // ESPN scoreboard URL - supports ?dates=YYYYMMDD
    const sbUrl = dateParam
      ? `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateParam}`
      : `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard`;

    // Odds API: 24h window starting at noon ET (17:00 UTC) on the requested date
    // Returns empty for past dates, current/future lines for upcoming games
    let oddsUrl = `https://api.the-odds-api.com/v4/sports/basketball_nba/odds/?apiKey=${oddsKey}&regions=us&markets=h2h,spreads,totals&bookmakers=fanduel&oddsFormat=american`;
    if (oddsKey && dateParam) {
      const y=dateParam.slice(0,4), m=dateParam.slice(4,6), d=dateParam.slice(6,8);
      const tFrom = new Date(`${y}-${m}-${d}T17:00:00Z`); // noon ET
      const tTo   = new Date(tFrom.getTime() + 24*60*60*1000);
      oddsUrl += `&commenceTimeFrom=${tFrom.toISOString()}&commenceTimeTo=${tTo.toISOString()}`;
    }

    // Fetch ESPN scoreboard + FanDuel odds in parallel
    const [sbResp, fdRaw] = await Promise.all([
      fetch(sbUrl),
      oddsKey
        ? fetch(oddsUrl).then(r => r.ok ? r.json() : null).catch(() => null)
        : Promise.resolve(null),
    ]);

    const sb = await sbResp.json();
    const events = sb.events || [];
    if (events.length === 0) return res.status(200).json({ games: [], date: new Date().toISOString() });

    // Build FanDuel odds map keyed by lowercase home team name
    const fdMap = {};
    if (Array.isArray(fdRaw)) {
      for (const g of fdRaw) {
        const fd = g.bookmakers?.find(b => b.key === "fanduel");
        if (!fd) continue;
        const h2h     = fd.markets?.find(m => m.key === "h2h");
        const spreads = fd.markets?.find(m => m.key === "spreads");
        const totals  = fd.markets?.find(m => m.key === "totals");
        const ht = g.home_team, at = g.away_team;
        const homeML    = h2h?.outcomes?.find(o => o.name === ht)?.price ?? null;
        const awayML    = h2h?.outcomes?.find(o => o.name === at)?.price ?? null;
        const spread    = spreads?.outcomes?.find(o => o.name === ht)?.point ?? null;
        const overUnder = totals?.outcomes?.find(o => o.name === "Over")?.point ?? null;
        fdMap[ht.toLowerCase()] = { spread, overUnder, homeML, awayML, source: "fanduel" };
      }
    }

    // Collect unique team IDs and fetch season stats in parallel
    const teamIdSet = new Set();
    for (const ev of events) {
      for (const c of (ev.competitions?.[0]?.competitors || [])) {
        if (c.team?.id) teamIdSet.add(c.team.id);
      }
    }
    const teamIds = [...teamIdSet];
    const teamStatResults = await Promise.all(
      teamIds.map(id =>
        fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${id}/statistics?season=2026`)
          .then(r => r.ok ? r.json() : null).catch(() => null)
      )
    );

    const teamStats = {};
    for (let i = 0; i < teamIds.length; i++) {
      const d = teamStatResults[i];
      if (!d) continue;
      const flat = (d?.results?.stats?.categories || []).flatMap(c => c.stats || []);
      const tStat = n => { const s = flat.find(x => x.name === n); return s ? parseFloat(s.value) : null; };
      teamStats[teamIds[i]] = {
        ppg: tStat("avgPoints") || 112,
        opp: tStat("avgPointsAllowed") || 112,
      };
    }

    // Build game objects with model predictions
    const games = events.map(ev => {
      const comp = ev.competitions?.[0];
      if (!comp) return null;
      const homeComp = comp.competitors?.find(c => c.homeAway === "home");
      const awayComp = comp.competitors?.find(c => c.homeAway === "away");
      if (!homeComp || !awayComp) return null;

      const homeId   = homeComp.team?.id;
      const awayId   = awayComp.team?.id;
      const homeName = homeComp.team?.displayName || "";

      // Season records
      const getRec = (competitor) => {
        const r = competitor.records?.find(r => r.type === "total") || competitor.records?.[0];
        return r?.summary || "0-0";
      };
      const homeRecStr = getRec(homeComp);
      const awayRecStr = getRec(awayComp);
      const parseRec = s => { const [w, l] = (s || "0-0").split("-").map(Number); return [w || 0, l || 0]; };
      const [homeW, homeL] = parseRec(homeRecStr);
      const [awayW, awayL] = parseRec(awayRecStr);

      // Odds priority: FanDuel > ESPN scoreboard > null
      const fdOdds = fdMap[homeName.toLowerCase()] || null;
      const espnOdds = comp.odds?.[0] || {};
      const spread    = fdOdds?.spread    ?? (espnOdds.spread    != null ? parseFloat(espnOdds.spread)    : null);
      const overUnder = fdOdds?.overUnder ?? (espnOdds.overUnder != null ? parseFloat(espnOdds.overUnder) : null);
      const homeML    = fdOdds?.homeML    ?? espnOdds.homeTeamOdds?.moneyLine ?? null;
      const awayML    = fdOdds?.awayML    ?? espnOdds.awayTeamOdds?.moneyLine ?? null;
      const oddsSource = fdOdds ? "fanduel" : (espnOdds.provider ? "espn" : null);

      // --- Scoring model ---
      const hSt = teamStats[homeId] || { ppg: 112, opp: 112 };
      const aSt = teamStats[awayId] || { ppg: 112, opp: 112 };
      const HOME_COURT = 1.75;
      const predHome   = (hSt.ppg + aSt.opp) / 2 + HOME_COURT;
      const predAway   = (aSt.ppg + hSt.opp) / 2 - HOME_COURT;
      const predMargin = predHome - predAway;
      const predTotal  = predHome + predAway;

      // --- Pythagorean win probability ---
      const homeGP  = homeW + homeL || 1;
      const awayGP  = awayW + awayL || 1;
      const homeWR  = homeW / homeGP;
      const awayWR  = awayW / awayGP;
      const denom   = homeWR + awayWR + 0.08;
      const pythProb = denom > 0 ? (homeWR + 0.04) / denom : 0.54;

      // --- Scoring-based win prob ---
      const scoringProb = 0.5 + Math.sign(predMargin) * Math.min(0.45, Math.abs(predMargin) / 40);
      const homeWinProb = pythProb * 0.5 + scoringProb * 0.5;

      // --- Picks ---
      const mlPick    = homeWinProb >= 0.5 ? "home" : "away";
      const spreadPick = spread != null ? (predMargin + spread > 0 ? "home" : "away") : mlPick;
      const totalPick  = overUnder != null ? (predTotal > overUnder ? "over" : "under") : (predMargin >= 0 ? "over" : "under");

      return {
        id: ev.id,
        time: ev.date,
        status: comp.status?.type?.state || "pre",
        statusDetail: comp.status?.type?.shortDetail || "",
        homeTeam: {
          id: homeId,
          name: homeName,
          abbr: homeComp.team?.abbreviation,
          logo: homeComp.team?.logo,
          record: homeRecStr,
          score: comp.status?.type?.state !== "pre" ? homeComp.score : null,
        },
        awayTeam: {
          id: awayId,
          name: awayComp.team?.displayName,
          abbr: awayComp.team?.abbreviation,
          logo: awayComp.team?.logo,
          record: awayRecStr,
          score: comp.status?.type?.state !== "pre" ? awayComp.score : null,
        },
        odds: { spread, overUnder, homeML, awayML, source: oddsSource },
        prediction: {
          mlPick, spreadPick, totalPick,
          homeWinProb: parseFloat(homeWinProb.toFixed(3)),
          predMargin:  parseFloat(predMargin.toFixed(1)),
          predTotal:   parseFloat(predTotal.toFixed(1)),
        },
      };
    }).filter(Boolean);

    return res.status(200).json({ games, date: new Date().toISOString() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
