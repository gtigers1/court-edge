export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });
  const { team, sport } = req.body || {};
  if (!team) return res.status(400).json({ error: "team required" });

  // ESPN URL slugs - from espn.com/nba/players and espn.com/nhl/teams
  const NBA_ESPN = {"Atlanta Hawks":"atl","Boston Celtics":"bos","Brooklyn Nets":"bkn","Charlotte Hornets":"cha","Chicago Bulls":"chi","Cleveland Cavaliers":"cle","Dallas Mavericks":"dal","Denver Nuggets":"den","Detroit Pistons":"det","Golden State Warriors":"gs","Houston Rockets":"hou","Indiana Pacers":"ind","LA Clippers":"lac","Los Angeles Lakers":"lal","Memphis Grizzlies":"mem","Miami Heat":"mia","Milwaukee Bucks":"mil","Minnesota Timberwolves":"min","New Orleans Pelicans":"no","New York Knicks":"ny","Oklahoma City Thunder":"okc","Orlando Magic":"orl","Philadelphia 76ers":"phi","Phoenix Suns":"phx","Portland Trail Blazers":"por","Sacramento Kings":"sac","San Antonio Spurs":"sa","Toronto Raptors":"tor","Utah Jazz":"utah","Washington Wizards":"wsh"};
  const NHL_ESPN = {"Anaheim Ducks":"ana","Boston Bruins":"bos","Buffalo Sabres":"buf","Calgary Flames":"cgy","Carolina Hurricanes":"car","Chicago Blackhawks":"chi","Colorado Avalanche":"col","Columbus Blue Jackets":"cbj","Dallas Stars":"dal","Detroit Red Wings":"det","Edmonton Oilers":"edm","Florida Panthers":"fla","Los Angeles Kings":"la","Minnesota Wild":"min","Montreal Canadiens":"mtl","Nashville Predators":"nsh","New Jersey Devils":"nj","New York Islanders":"nyi","New York Rangers":"nyr","Ottawa Senators":"ott","Philadelphia Flyers":"phi","Pittsburgh Penguins":"pit","San Jose Sharks":"sj","Seattle Kraken":"sea","St. Louis Blues":"stl","Tampa Bay Lightning":"tb","Toronto Maple Leafs":"tor","Utah Mammoth":"utah","Vancouver Canucks":"van","Vegas Golden Knights":"vgk","Washington Capitals":"wsh","Winnipeg Jets":"wpg"};

  try {
    const abbr = sport === "nhl" ? NHL_ESPN[team] : NBA_ESPN[team];
    if (!abbr) return res.status(400).json({ error: "Unknown team: " + team });

    // Correct ESPN roster URL format
    const espnUrl = sport === "nhl"
      ? "https://www.espn.com/nhl/team/roster/_/name/" + abbr
      : "https://www.espn.com/nba/team/roster/_/name/" + abbr;

    const rosterResp = await fetch(espnUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36", "Accept": "text/html,application/xhtml+xml" }
    });
    const html = await rosterResp.text();

    // Extract player names from ESPN player links
    const sport_path = sport === "nhl" ? "nhl" : "nba";
    const re = new RegExp('/' + sport_path + '/player/_/id/\\d+/([a-z0-9-]+)"', 'g');
    const slugs = [...new Set([...html.matchAll(re)].map(m => m[1]))];
    const names = slugs
      .filter(s => s.length > 3 && !s.includes("team") && !s.includes("roster"))
      .map(s => s.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "))
      .slice(0, 25);

    // Get team stats via Haiku search
    const search = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: sport === "nhl"
          ? team + " NHL 2025-26 stats: wins losses OTL goals-per-game goals-against power-play% penalty-kill% player points goals assists"
          : team + " NBA 2025-26 stats: wins losses points-per-game opponent-ppg each player individual ppg averages"
        }]
      })
    });
    const sd = await search.json();
    const searchText = (sd.content || []).filter(b => b.type === "text").map(b => b.text).join("").slice(0, 2000);

    // Sonnet formats using ESPN names + search stats
    const nbaSchema = '{"wins":0,"losses":0,"ppg":112,"opp":110,"efg_pct":0.52,"tov_rate":13,"oreb_pct":0.25,"ftr":0.22,"opp_efg_pct":0.52,"opp_tov_rate":13,"opp_oreb_pct":0.25,"opp_ftr":0.22,"last10":"5-5","last10_ppg":112,"last10_opp":110,"roster":[{"name":"Player Name","ppg":20.0,"per":17.0,"role":"STAR","status":"PLAYING"}]}';
    const nhlSchema = '{"wins":0,"losses":0,"otl":0,"points":0,"gf_pg":3.0,"ga_pg":2.8,"shots_pg":30,"shots_against_pg":28,"pp_pct":22,"pk_pct":80,"last10_gf":3.0,"last10_ga":2.8,"goalie":{"name":"Starter","save_pct":0.910,"gaa":2.80,"status":"PLAYING"},"roster":[{"name":"Player","goals":20,"assists":30,"points":50,"plus_minus":5,"position":"LW","role":"STAR","status":"PLAYING"}]}';

    const playerList = names.length > 0 ? "ESPN roster players: " + names.join(", ") : "Use your knowledge of the current " + team + " roster.";

    const fmt = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: "Output only a single raw JSON object. No markdown, no explanation, no code fences.",
        messages: [{ role: "user", content: playerList + "\n\nStats:\n" + searchText + "\n\nBuild JSON for " + team + " " + sport.toUpperCase() + " using schema:\n" + (sport === "nhl" ? nhlSchema : nbaSchema) + "\n\nUse the player names above. Fill stats from data. " + (sport === "nhl" ? "role=STAR if points>40, KEY if points>20, else ROLE. Include position." : "role=STAR if ppg>20, KEY if ppg>11, else ROLE. per=ppg*0.85.") }]
      })
    });
    const fd = await fmt.json();
    if (!fmt.ok) return res.status(502).json({ error: fd.error?.message || "Format error" });
    const raw = (fd.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();

    let parsed = null;
    try { parsed = JSON.parse(raw); } catch(_) {}
    if (!parsed) { try { parsed = JSON.parse(raw.replace(/^```json\s*/i,"").replace(/\s*```$/,"")); } catch(_) {} }
    if (!parsed) { try { const i=raw.indexOf("{"),j=raw.lastIndexOf("}"); if(i>=0&&j>i) parsed=JSON.parse(raw.slice(i,j+1)); } catch(_) {} }
    if (!parsed) return res.status(500).json({ error: "Parse failed", espnNames: names, raw: raw.slice(0,200) });

    if (sport === "nhl") {
      parsed.wins=parsed.wins??30; parsed.losses=parsed.losses??25; parsed.otl=parsed.otl??5;
      parsed.points=parsed.points??(parsed.wins*2+parsed.otl); parsed.gf_pg=parsed.gf_pg??3.0;
      parsed.ga_pg=parsed.ga_pg??2.8; parsed.shots_pg=parsed.shots_pg??30;
      parsed.shots_against_pg=parsed.shots_against_pg??28; parsed.pp_pct=parsed.pp_pct??20;
      parsed.pk_pct=parsed.pk_pct??80; parsed.last10_gf=parsed.last10_gf??parsed.gf_pg;
      parsed.last10_ga=parsed.last10_ga??parsed.ga_pg;
      parsed.roster=(parsed.roster||[]).map(p=>({name:p.name||"Unknown",goals:p.goals??0,assists:p.assists??0,points:p.points??0,plus_minus:p.plus_minus??0,position:p.position||"F",role:p.role||"ROLE",status:"PLAYING"}));
      if(parsed.goalie){parsed.goalie.status="PLAYING";}
    } else {
      parsed.wins=parsed.wins??30; parsed.losses=parsed.losses??30;
      parsed.ppg=parsed.ppg??112; parsed.opp=parsed.opp??112;
      parsed.efg_pct=parsed.efg_pct??0.52; parsed.tov_rate=parsed.tov_rate??13.5;
      parsed.oreb_pct=parsed.oreb_pct??0.26; parsed.ftr=parsed.ftr??0.22;
      parsed.opp_efg_pct=parsed.opp_efg_pct??0.52; parsed.opp_tov_rate=parsed.opp_tov_rate??13.5;
      parsed.opp_oreb_pct=parsed.opp_oreb_pct??0.26; parsed.opp_ftr=parsed.opp_ftr??0.22;
      parsed.last10=parsed.last10??"5-5"; parsed.last10_ppg=parsed.last10_ppg??parsed.ppg;
      parsed.last10_opp=parsed.last10_opp??parsed.opp;
      parsed.roster=(parsed.roster||[]).map(p=>({name:p.name||"Unknown",ppg:p.ppg??10,per:p.per??(p.ppg??10)*0.85,role:p.role||"ROLE",status:"PLAYING"}));
    }
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}