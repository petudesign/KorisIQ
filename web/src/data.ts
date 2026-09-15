export type ViewKey = "overview" | "story" | "matches" | "players" | "player-detail" | "season" | "data" | "teams";
export type PlayerRole = "C" | "PF" | "SF" | "SG" | "PG" | null;

export type BoxScore = {
  minutes: string | null;
  points: number | null;
  twoPM: number | null;
  twoPA: number | null;
  twoPct: number | null;
  threePM: number | null;
  threePA: number | null;
  threePct: number | null;
  ftm: number | null;
  fta: number | null;
  ftPct: number | null;
  offensiveRebounds: number | null;
  defensiveRebounds: number | null;
  rebounds: number | null;
  assists: number | null;
  turnovers: number | null;
  steals: number | null;
  blocks: number | null;
  blocksReceived: number | null;
  fouls: number | null;
  foulsDrawn: number | null;
  plusMinus: number | null;
  efficiency: number | null;
};

export type Player = {
  name: string;
  team: string;
  teamColor: "coral" | "mint";
  number: number | null;
  role: PlayerRole;
  starter: boolean;
  stats: BoxScore;
};

export type TeamStats = BoxScore & {
  leadTime: string | null;
  leadChanges: number | null;
  biggestLead: number | null;
  longestRun: number | null;
};

function stats(values: Partial<BoxScore> = {}): BoxScore {
  return {
    minutes: null,
    points: null,
    twoPM: null,
    twoPA: null,
    twoPct: null,
    threePM: null,
    threePA: null,
    threePct: null,
    ftm: null,
    fta: null,
    ftPct: null,
    offensiveRebounds: null,
    defensiveRebounds: null,
    rebounds: null,
    assists: null,
    turnovers: null,
    steals: null,
    blocks: null,
    blocksReceived: null,
    fouls: null,
    foulsDrawn: null,
    plusMinus: null,
    efficiency: null,
    ...values,
  };
}

export const match = {
  competition: "Naisten Korisliiga",
  season: "2025–26",
  date: "1.10.2025",
  time: "18:30",
  venue: "MLL Areena · Kouvola",
  sourceMatchId: "968948",
  source: "Basket.fi / statistics",
  status: "Lopputulos",
  home: { name: "Kouvottaret", score: 47, color: "coral" },
  away: { name: "BC Nokia", score: 70, color: "mint" },
  periods: [
    { label: "1Q", home: 7, away: 18 },
    { label: "2Q", home: 18, away: 22 },
    { label: "3Q", home: 15, away: 16 },
    { label: "4Q", home: 7, away: 14 },
  ],
  eventCount: 123,
  lineupCount: 19,
};

// Basket.fi:n stats-sivulla tämän ottelun #-kenttä ei palauta numeroita.
// Roolit ovat toistaiseksi KorisIQ:n karkea näyttöluokitus, eivät lähteen virallinen positio.
export const players: Player[] = [
  { name: "Lawrence Laila", team: "BC Nokia", teamColor: "mint", number: null, role: "SF", starter: true, stats: stats({ minutes: "24:44", points: 20, twoPM: 8, twoPA: 15, twoPct: 53.33, threePM: 0, threePA: 0, threePct: 0, ftm: 4, fta: 4, ftPct: 100, offensiveRebounds: 1, defensiveRebounds: 5, rebounds: 6, assists: 2, turnovers: 2, steals: 4, blocks: 0, blocksReceived: 0, fouls: 3, foulsDrawn: 7, plusMinus: 10, efficiency: 23 }) },
  { name: "Brown Raiana", team: "Kouvottaret", teamColor: "coral", number: null, role: "C", starter: true, stats: stats({ minutes: "30:47", points: 14, twoPM: 5, twoPA: 12, twoPct: 41.67, threePM: 0, threePA: 3, threePct: 0, ftm: 4, fta: 6, ftPct: 66.67, offensiveRebounds: 3, defensiveRebounds: 3, rebounds: 6, assists: 0, turnovers: 3, steals: 0, blocks: 0, blocksReceived: 0, fouls: 2, foulsDrawn: 5, plusMinus: -15, efficiency: 5 }) },
  { name: "Patrikainen Venla", team: "BC Nokia", teamColor: "mint", number: null, role: "PG", starter: false, stats: stats({ minutes: "19:08", points: 12, twoPM: 4, twoPA: 4, twoPct: 100, threePM: 1, threePA: 3, threePct: 33.33, ftm: 1, fta: 3, ftPct: 33.33, offensiveRebounds: 4, defensiveRebounds: 5, rebounds: 9, assists: 4, turnovers: 1, steals: 3, blocks: 0, blocksReceived: 0, fouls: 3, foulsDrawn: 2, plusMinus: 14, efficiency: 23 }) },
  { name: "Jones Jasmina", team: "Kouvottaret", teamColor: "coral", number: null, role: "SG", starter: true, stats: stats({ minutes: "25:56", points: 11, twoPM: 0, twoPA: 1, twoPct: 0, threePM: 3, threePA: 5, threePct: 60, ftm: 2, fta: 2, ftPct: 100, offensiveRebounds: 1, defensiveRebounds: 4, rebounds: 5, assists: 1, turnovers: 0, steals: 1, blocks: 0, blocksReceived: 0, fouls: 4, foulsDrawn: 3, plusMinus: -12, efficiency: 15 }) },
  { name: "Drake Unique", team: "BC Nokia", teamColor: "mint", number: null, role: "SG", starter: true, stats: stats({ minutes: "27:50", points: 11, twoPM: 3, twoPA: 10, twoPct: 30, threePM: 1, threePA: 5, threePct: 20, ftm: 2, fta: 3, ftPct: 66.67, offensiveRebounds: 0, defensiveRebounds: 1, rebounds: 1, assists: 4, turnovers: 0, steals: 1, blocks: 0, blocksReceived: 0, fouls: 1, foulsDrawn: 1, plusMinus: 24, efficiency: 5 }) },
  { name: "Timo Tuulia", team: "BC Nokia", teamColor: "mint", number: null, role: "SG", starter: false, stats: stats({ minutes: "20:20", points: 9, twoPM: 2, twoPA: 2, twoPct: 100, threePM: 1, threePA: 3, threePct: 33.33, ftm: 2, fta: 2, ftPct: 100, offensiveRebounds: 0, defensiveRebounds: 4, rebounds: 4, assists: 1, turnovers: 0, steals: 1, blocks: 0, blocksReceived: 0, fouls: 2, foulsDrawn: 2, plusMinus: 10, efficiency: 13 }) },
  { name: "Nurminen Anni", team: "BC Nokia", teamColor: "mint", number: null, role: "PG", starter: true, stats: stats({ minutes: "30:26", points: 7, twoPM: 0, twoPA: 3, twoPct: 0, threePM: 2, threePA: 6, threePct: 33.33, ftm: 1, fta: 2, ftPct: 50, offensiveRebounds: 2, defensiveRebounds: 1, rebounds: 3, assists: 3, turnovers: 1, steals: 2, blocks: 0, blocksReceived: 0, fouls: 1, foulsDrawn: 4, plusMinus: 16, efficiency: 6 }) },
  { name: "Vähäuski Henriikka", team: "Kouvottaret", teamColor: "coral", number: null, role: "PF", starter: true, stats: stats({ minutes: "25:12", points: 5, twoPM: 2, twoPA: 5, twoPct: 40, threePM: 0, threePA: 5, threePct: 0, ftm: 1, fta: 2, ftPct: 50, offensiveRebounds: 4, defensiveRebounds: 3, rebounds: 7, assists: 2, turnovers: 0, steals: 0, blocks: 0, blocksReceived: 0, fouls: 5, foulsDrawn: 2, plusMinus: -17, efficiency: 5 }) },
  { name: "Räty Johanna", team: "Kouvottaret", teamColor: "coral", number: null, role: "PG", starter: true, stats: stats({ minutes: "25:29", points: 5, twoPM: 1, twoPA: 3, twoPct: 33.33, threePM: 1, threePA: 5, threePct: 20, ftm: 0, fta: 0, ftPct: 0, offensiveRebounds: 1, defensiveRebounds: 1, rebounds: 2, assists: 2, turnovers: 5, steals: 0, blocks: 0, blocksReceived: 0, fouls: 2, foulsDrawn: 0, plusMinus: -25, efficiency: -2 }) },
  { name: "Heikkilä Elli", team: "Kouvottaret", teamColor: "coral", number: null, role: "C", starter: false, stats: stats({ minutes: "22:17", points: 5, twoPM: 1, twoPA: 2, twoPct: 50, threePM: 0, threePA: 2, threePct: 0, ftm: 3, fta: 4, ftPct: 75, offensiveRebounds: 2, defensiveRebounds: 8, rebounds: 10, assists: 0, turnovers: 4, steals: 0, blocks: 2, blocksReceived: 0, fouls: 3, foulsDrawn: 4, plusMinus: -10, efficiency: 9 }) },
  { name: "Lampinen Lila", team: "Kouvottaret", teamColor: "coral", number: null, role: "SF", starter: false, stats: stats({ minutes: "29:56", points: 4, twoPM: 2, twoPA: 5, twoPct: 40, threePM: 0, threePA: 1, threePct: 0, ftm: 0, fta: 1, ftPct: 0, offensiveRebounds: 2, defensiveRebounds: 3, rebounds: 5, assists: 5, turnovers: 2, steals: 0, blocks: 0, blocksReceived: 1, fouls: 1, foulsDrawn: 4, plusMinus: -10, efficiency: 7 }) },
  { name: "Seppä Eevi", team: "BC Nokia", teamColor: "mint", number: null, role: "PF", starter: true, stats: stats({ minutes: "17:47", points: 4, twoPM: 1, twoPA: 1, twoPct: 100, threePM: 0, threePA: 6, threePct: 0, ftm: 2, fta: 2, ftPct: 100, offensiveRebounds: 2, defensiveRebounds: 3, rebounds: 5, assists: 0, turnovers: 2, steals: 1, blocks: 0, blocksReceived: 0, fouls: 1, foulsDrawn: 1, plusMinus: 14, efficiency: 2 }) },
  { name: "Frimodig Roosa", team: "Kouvottaret", teamColor: "coral", number: null, role: "SG", starter: true, stats: stats({ minutes: "26:27", points: 3, twoPM: 0, twoPA: 2, twoPct: 0, threePM: 1, threePA: 4, threePct: 25, ftm: 0, fta: 0, ftPct: 0, offensiveRebounds: 1, defensiveRebounds: 1, rebounds: 2, assists: 2, turnovers: 3, steals: 1, blocks: 0, blocksReceived: 0, fouls: 3, foulsDrawn: 1, plusMinus: -18, efficiency: 0 }) },
  { name: "Salmi Ninni", team: "BC Nokia", teamColor: "mint", number: null, role: "C", starter: true, stats: stats({ minutes: "20:24", points: 2, twoPM: 1, twoPA: 3, twoPct: 33.33, threePM: 0, threePA: 2, threePct: 0, ftm: 0, fta: 0, ftPct: 0, offensiveRebounds: 3, defensiveRebounds: 4, rebounds: 7, assists: 2, turnovers: 1, steals: 0, blocks: 0, blocksReceived: 1, fouls: 1, foulsDrawn: 0, plusMinus: 6, efficiency: 6 }) },
  { name: "Viitanen Mila", team: "BC Nokia", teamColor: "mint", number: null, role: "SF", starter: false, stats: stats({ minutes: "15:17", points: 2, twoPM: 1, twoPA: 3, twoPct: 33.33, threePM: 0, threePA: 1, threePct: 0, ftm: 0, fta: 2, ftPct: 0, offensiveRebounds: 1, defensiveRebounds: 2, rebounds: 3, assists: 3, turnovers: 3, steals: 3, blocks: 0, blocksReceived: 0, fouls: 2, foulsDrawn: 4, plusMinus: 13, efficiency: 3 }) },
  { name: "Etu-Seppälä Mona", team: "BC Nokia", teamColor: "mint", number: null, role: "PF", starter: false, stats: stats({ minutes: "16:17", points: 2, twoPM: 1, twoPA: 3, twoPct: 33.33, threePM: 0, threePA: 1, threePct: 0, ftm: 0, fta: 0, ftPct: 0, offensiveRebounds: 1, defensiveRebounds: 1, rebounds: 2, assists: 2, turnovers: 0, steals: 0, blocks: 0, blocksReceived: 1, fouls: 1, foulsDrawn: 0, plusMinus: 11, efficiency: 3 }) },
  { name: "Niskanen Viivi", team: "BC Nokia", teamColor: "mint", number: null, role: "SG", starter: false, stats: stats({ minutes: "07:50", points: 1, twoPM: 0, twoPA: 0, twoPct: 0, threePM: 0, threePA: 1, threePct: 0, ftm: 1, fta: 2, ftPct: 50, offensiveRebounds: 0, defensiveRebounds: 0, rebounds: 0, assists: 1, turnovers: 0, steals: 1, blocks: 0, blocksReceived: 0, fouls: 4, foulsDrawn: 1, plusMinus: -3, efficiency: 1 }) },
  { name: "Laurema Enni", team: "Kouvottaret", teamColor: "coral", number: null, role: "SF", starter: false, stats: stats({ minutes: "DNP" }) },
  { name: "Lampinen Helmi", team: "Kouvottaret", teamColor: "coral", number: null, role: "PG", starter: false, stats: stats({ minutes: "14:00", points: 0, twoPM: 0, twoPA: 1, twoPct: 0, threePM: 0, threePA: 3, threePct: 0, ftm: 0, fta: 0, ftPct: 0, offensiveRebounds: 0, defensiveRebounds: 2, rebounds: 2, assists: 0, turnovers: 1, steals: 0, blocks: 0, blocksReceived: 0, fouls: 2, foulsDrawn: 0, plusMinus: -8, efficiency: -3 }) },
];

const homeStats: TeamStats = {
  ...stats({ minutes: "200:00", points: 47, twoPM: 11, twoPA: 31, twoPct: 35.48, threePM: 5, threePA: 28, threePct: 17.86, ftm: 10, fta: 15, ftPct: 66.67, offensiveRebounds: 15, defensiveRebounds: 29, rebounds: 44, assists: 12, turnovers: 18, steals: 2, blocks: 2, blocksReceived: 0, fouls: 22, foulsDrawn: 19, efficiency: 41 }),
  leadTime: "0:00",
  leadChanges: 0,
  biggestLead: 0,
  longestRun: 6,
};

const awayStats: TeamStats = {
  ...stats({ minutes: "200:00", points: 70, twoPM: 21, twoPA: 44, twoPct: 47.73, threePM: 5, threePA: 28, threePct: 17.86, ftm: 13, fta: 20, ftPct: 65, offensiveRebounds: 21, defensiveRebounds: 29, rebounds: 50, assists: 22, turnovers: 10, steals: 16, blocks: 0, blocksReceived: 2, fouls: 19, foulsDrawn: 22, efficiency: 95 }),
  leadTime: "39:24",
  leadChanges: 0,
  biggestLead: 26,
  longestRun: 14,
};

export const teamSummary = {
  home: { name: "Kouvottaret", stats: homeStats },
  away: { name: "BC Nokia", stats: awayStats },
};

export const insights = [
  {
    eyebrow: "Avaus",
    title: "BC Nokia karkasi heti",
    body: "Ottelu alkoi Kouvottarien kannalta 0–8-tappiolla. Nokia piti johtoasemaa koko ensimmäisen neljänneksen ajan.",
    accent: "mint",
  },
  {
    eyebrow: "Käänne",
    title: "Kolmas neljännes oli lähes tasan",
    body: "Nokia voitti kolmannen neljänneksen vain pisteellä 15–16, mutta kokonaisero pysyi liian suurena.",
    accent: "amber",
  },
  {
    eyebrow: "Loppu",
    title: "Nokia sulki pelin hallitusti",
    body: "Viimeinen neljännes päättyi 7–14. Ottelun lopun tapahtumat vahvistivat Nokian 23 pisteen voiton.",
    accent: "coral",
  },
];

export const availability = [
  { label: "Ottelun metadata", value: "Saatavilla", tone: "ready", detail: "joukkueet · aika · paikka" },
  { label: "Box score -tilastot", value: "Saatavilla", tone: "ready", detail: "19 pelaajaa · MIN · heitot · levypallot · muut kentät" },
  { label: "Tapahtumat", value: "Saatavilla", tone: "ready", detail: "123 tapahtumaa" },
  { label: "Johdetut tehokkuusluvut", value: "Arvio", tone: "warning", detail: "pallonhallinnat lasketaan box score -kaavalla" },
  { label: "Laukaisukoordinaatit", value: "Ei tässä lähteessä", tone: "muted", detail: "vaatii uuden datalähteen" },
  { label: "Peliminuutit", value: "Saatavilla", tone: "ready", detail: "tilastosivun MIN-kenttä" },
];
