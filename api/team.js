export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });
  const { team, sport } = req.body || {};
  if (!team) return res.status(400).json({ error: "team required" });

  // ESPN API team slugs (confirmed from espn.com)
  const NBA_SLUG = {"Atlanta Hawks":"atl","Boston Celtics":"bos","Brooklyn Nets":"bkn","Charlotte Hornets":"cha","Chicago Bulls":"chi","Cleveland Cavaliers":"cle","Dallas Mavericks":"dal","Denver Nuggets":"den","Detroit Pistons":"det","Golden State Warriors":"gs","Houston Rockets":"hou","Indiana Pacers":"ind","LA Clippers":"lac","Los Angeles Lakers":"lal","Memphis Grizzlies":"mem","Miami Heat":"mia","Milwaukee Bucks":"mil","Minnesota Timberwolves":"min","New Orleans Pelicans":"no","New York Knicks":"ny","Oklahoma City Thunder":"okc","Orlando Magic":"orl","Philadelphia 76ers":"phi","Phoenix Suns":"phx","Portland Trail Blazers":"por","Sacramento Kings":"sac","San Antonio Spurs":"sa","Toronto Raptors":"tor","Utah Jazz":"utah","Washington Wizards":"wsh"};
  const NHL_SLUG = {"Anaheim Ducks":"ana","Boston Bruins":"bos","Buffalo Sabres":"buf","Calgary Flames":"cgy","Carolina Hurricanes":"car","Chicago Blackhawks":"chi","Colorado Avalanche":"col","Columbus Blue Jackets":"cbj","Dallas Stars":"dal","Detroit Red Wings":"det","Edmonton Oilers":"edm","Florida Panthers":"fla","Los Angeles Kings":"la","Minnesota Wild":"min","Montreal Canadiens":"mtl","Nashville Predators":"nsh","New Jersey Devils":"nj","New York Islanders":"nyi","New York Rangers":"nyr","Ottawa Senators":"ott","Philadelphia Flyers":"phi","Pittsburgh Penguins":"pit","San Jose Sharks":"sj","Seattle Kraken":"sea","St. Louis Blues":"stl","Tampa Bay Lightning":"tb","Toronto Maple Leafs":"tor","Utah Mammoth":"utah","Vancouver Canucks":"van","Vegas Golden Knights":"vgk","Washington Capitals":"wsh","Winnipeg Jets":"wpg"};

  const slug = sport === "nhl" ? NHL_SLUG[team] : NBA_SLUG[team];
  if (!slug) return res.status(400).json({ error: "Unknown team: " + team });

  try {
    // Step 1: Fetch full roster from ESPN public API
    const espnSport = sport === "nhl" ? "hockey/nhl" : "basketball/nba";
    const rosterUrl = `https://site.api.espn.com/apis/site/v2/sports/${espnSport}/teams/${slug}/roster`;
    const rosterResp = await fetch(rosterUrl);
    const rosterJson = await rosterResp.json();

    // Step 2: Fetch team record/stats from ESPN
    const teamUrl = `https://site.api.espn.com/apis/site/v2/sports/${espnSport}/teams/${slug}`;
    const teamResp = await fetch(teamUrl);
    const teamJson = await teamResp.json();

    // Extract team record
    const record = teamJson?.team?.record?.items?.[0]?.stats || [];
    const getStat = (name) => parseFloat(record.find(s => s.name === name)?.value || 0);
    const wins = getStat("wins") || parseInt(teamJson?.team?.record?.items?.[0]?.summary?.split("-")[0]) || 30;
    const losses = getStat("losses") || parseInt(teamJson?.team?.record?.items?.[0]?.summary?.split("-")[1]) || 20;

    // Step 3: Extract players from ESPN roster API
    const athletes = rosterJson?.athletes || [];
    // NBA returns flat array, NHL returns grouped by position group
    let allPlayers = [];
    if (Array.isArray(athletes) && athletes.length > 0) {
      if (athletes[0]?.items) {
        // NHL: grouped format [{position:"Forwards",items:[...]}, ...]
        for (const group of athletes) {
          allPlayers = allPlayers.concat(group.items || []);
        }
      } else {
        allPlayers = athletes;
      }
    }

    // Get player names and positions
    const playerNames = allPlayers.map(p => ({
      name: p.fullName || p.displayName || "Unknown",
      position: p.position?.abbreviation || "F",
      jersey: p.jersey || ""
    })).filter(p => p.name !== "Unknown").slice(0, 25);

    if (playerNames.length === 0) {
      return res.status(500).json({ error: "ESPN roster empty for " + team, rosterUrl });
    }

    // Step 4: Get stats via Haiku search (only stats, not names - we have those)
    const search = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: sport === "nhl"
          ? team + " 2025-26 NHL season wins losses goals-per-game goals-against power-play% penalty-kill% shots-per-game top scorers points goals assists last 10 games"
          : team + " 2025-26 NBA season wins losses points-per-game opponent-points-per-game eFG% turnover-rate offensive-rebound-rate free-throw-rate last 10 games top players scoring rebounds assists averages"
        }]
      })
    });
    const sd = await search.json();
    const searchText = (sd.content || []).filter(b => b.type === "text").map(b => b.text).join("").slice(0, 2000);

    // Step 5: Sonnet formats with exact ESPN names + stats
    const playerList = playerNames.map(p => p.name + (sport === "nhl" ? " (" + p.position + ")" : "")).join(", ");
    const nbaSchema = '{"wins":0,"losses":0,"ppg":112,"opp":110,"efg_pct":0.52,"tov_rate":13,"oreb_pct":0.25,"ftr":0.22,"opp_efg_pct":0.52,"opp_tov_rate":13,"opp_oreb_pct":0.25,"opp_ftr":0.22,"last10":"5-5","last10_ppg":112,"last10_opp":110,"roster":[{"name":"exact name from list","ppg":20.0,"rpg":5.0,"apg":3.0,"per":17.0,"role":"STAR","status":"PLAYING"}]}';
    const nhlSchema = '{"wins":0,"losses":0,"otl":0,"points":0,"gf_pg":3.0,"ga_pg":2.8,"shots_pg":30,"shots_against_pg":28,"pp_pct":22,"pk_pct":80,"last10_gf":3.0,"last10_ga":2.8,"goalie":{"name":"exact goalie name","save_pct":0.910,"gaa":2.80,"status":"PLAYING"},"roster":[{"name":"exact name","goals":10,"assists":20,"points":30,"plus_minus":5,"position":"LW","role":"KEY","status":"PLAYING"}]}';

    const fmt = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2500,
        system: "Output only a single raw JSON object. No markdown, no explanation, no code fences.",
        messages: [{ role: "user", content: "Build JSON for " + team + " " + sport.toUpperCase() + ".\n\nALL players (use EXACT names, include ALL of them):\n" + playerList + "\n\nStats data:\n" + searchText + "\n\nSchema:\n" + (sport === "nhl" ? nhlSchema : nbaSchema) + "\n\nCRITICAL: Include EVERY player in the list above in the roster array. " + (sport === "nhl" ? "Separate goalies from skaters - put starting goalie in goalie field, rest in roster. role=STAR if points>40, KEY if points>20, else ROLE. Use position from the list." : "role=STAR if ppg>20, KEY if ppg>11, else ROLE. per=ppg*0.9+rpg*0.3+apg*0.5 (e.g. 25ppg/10rpg/8apg = 30.5). Include rpg and apg for each player.") }]
      })
    });
    const fd = await fmt.json();
    if (!fmt.ok) return res.status(502).json({ error: fd.error?.message || "Format error" });
    const raw = (fd.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();

    let parsed = null;
    try { parsed = JSON.parse(raw); } catch(_) {}
    if (!parsed) { try { parsed = JSON.parse(raw.replace(/^```json\s*/i,"").replace(/\s*```$/,"")); } catch(_) {} }
    if (!parsed) { try { const i=raw.indexOf("{"),j=raw.lastIndexOf("}"); if(i>=0&&j>i) parsed=JSON.parse(raw.slice(i,j+1)); } catch(_) {} }
    if (!parsed) return res.status(500).json({ error: "Parse failed", espnPlayerCount: playerNames.length, raw: raw.slice(0,200) });

    // Normalize
    if (sport === "nhl") {
      parsed.wins=parsed.wins||wins; parsed.losses=parsed.losses||losses; parsed.otl=parsed.otl??5;
      parsed.points=parsed.points||(parsed.wins*2+parsed.otl); parsed.gf_pg=parsed.gf_pg||3.0;
      parsed.ga_pg=parsed.ga_pg||2.8; parsed.shots_pg=parsed.shots_pg||30;
      parsed.shots_against_pg=parsed.shots_against_pg||28; parsed.pp_pct=parsed.pp_pct||20;
      parsed.pk_pct=parsed.pk_pct||80; parsed.last10_gf=parsed.last10_gf||parsed.gf_pg;
      parsed.last10_ga=parsed.last10_ga||parsed.ga_pg;
      parsed.roster=(parsed.roster||[]).map(p=>({name:p.name||"Unknown",goals:p.goals??0,assists:p.assists??0,points:p.points??0,plus_minus:p.plus_minus??0,position:p.position||"F",role:p.role||"ROLE",status:"PLAYING"}));
      if(parsed.goalie){parsed.goalie.status="PLAYING";}
    } else {
      parsed.wins=parsed.wins||wins; parsed.losses=parsed.losses||losses;
      parsed.ppg=parsed.ppg||112; parsed.opp=parsed.opp||112;
      parsed.efg_pct=parsed.efg_pct||0.52; parsed.tov_rate=parsed.tov_rate||13.5;
      parsed.oreb_pct=parsed.oreb_pct||0.26; parsed.ftr=parsed.ftr||0.22;
      parsed.opp_efg_pct=parsed.opp_efg_pct||0.52; parsed.opp_tov_rate=parsed.opp_tov_rate||13.5;
      parsed.opp_oreb_pct=parsed.opp_oreb_pct||0.26; parsed.opp_ftr=parsed.opp_ftr||0.22;
      parsed.last10=parsed.last10||"5-5"; parsed.last10_ppg=parsed.last10_ppg||parsed.ppg;
      parsed.last10_opp=parsed.last10_opp||parsed.opp;
      parsed.roster=(parsed.roster||[]).map(p=>({name:p.name||"Unknown",ppg:p.ppg||10,rpg:p.rpg||3,apg:p.apg||1,per:p.per||((p.ppg||10)*0.9+(p.rpg||3)*0.3+(p.apg||1)*0.5),role:p.role||"ROLE",status:"PLAYING"}));
    }
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}