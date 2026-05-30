import { useEffect, useMemo, useState, useRef } from "react";

export interface YearRow {
  year: number;
  w: number;
  l: number;
  playoff: boolean;
  avgPts: string;
  avgPa: string;
}
export interface FinishDot {
  year: number;
  position: number;
  color: "gold" | "silver" | "bronze" | "black";
}
export interface ManagerCareer {
  championships: number;
  playoffAppearances: number;
  playoffRecord: string;
  record: string;
  winPct: string;
  rank: number;
  num1Weeks: number;
  num10Weeks: number;
  yearly: YearRow[];
  finishes: FinishDot[];
}

const ESPN_BASE = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl";
const START_SEASON = 2021;

// Authoritative final standings (1 = champion ... 10 = last). ESPN's bracket
// data doesn't fully match how this league records finishes (consolation games,
// non-standard playoff size in some years), so for known years we keep an
// explicit ordering of manager display names. Years not listed here fall back
// to the auto-derive in computeFinalStandings.
const manualFinalStandings: Record<number, string[]> = {
  2021: [
    "Connor Bowser",
    "Jake",
    "Brett Gilbert",
    "Tyler Gilbert",
    "Jeremy Stojakovich",
    "Drew",
    "Josh Hartless",
    "Andrew Casazza",
    "Daniel Dixon",
    "Travis",
  ],
  2022: [
    "Danny Stiles",
    "Jeremy Stojakovich",
    "Connor Bowser",
    "Josh Hartless",
    "Tyler Gilbert",
    "Andrew Casazza",
    "Demarco Moore",
    "Jake",
    "Daniel Dixon",
    "Brett Gilbert",
  ],
  2023: [
    "Daniel Dixon",
    "Danny Stiles",
    "Tyler Gilbert",
    "Jeremy Stojakovich",
    "Connor Bowser",
    "Josh Hartless",
    "Jake",
    "Andrew Casazza",
    "Demarco Moore",
    "Brett Gilbert",
  ],
  2024: [
    "Connor Bowser",
    "Andrew Casazza",
    "Danny Stiles",
    "Josh Hartless",
    "Daniel Dixon",
    "Brett Gilbert",
    "Jeremy Stojakovich",
    "Demarco Moore",
    "Tyler Gilbert",
    "Stuart Iverson",
  ],
  2025: [
    "Brett Gilbert",
    "Connor Bowser",
    "Jeremy Stojakovich",
    "Stuart Iverson",
    "Josh Hartless",
    "Demarco Moore",
    "Andrew Casazza",
    "Danny Stiles",
    "Tyler Gilbert",
    "Daniel Dixon",
  ],
};

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const teamManagerMapRaw: Record<string, string> = {
  "Terribly Well-Balanced": "Stuart Iverson",
  "Fat Hammered Thor": "Jeremy Stojakovich",
  "Genius, Plaiboi, Champion": "Connor Bowser",
  "Wolverine's Bubs": "Andrew Casazza",
  "Bruce Raising Banners": "Josh Hartless",
  "I NEVER Freeze!": "Demarco Moore",
  "Anyone Can Wear The Mask": "Brett Gilbert",
  "The Doom": "Danny Stiles",
  Jarvis: "Tyler Gilbert",
  "I Can Do This All Day": "Daniel Dixon",
};
const teamManagerMap: Record<string, string> = Object.fromEntries(
  Object.entries(teamManagerMapRaw).map(([k, v]) => [normalize(k), v])
);
const managerEq = (a: string, b: string) => normalize(a) === normalize(b);

// Enhanced cache with permanent storage for the session
class DataStore {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private allSeasonDataCache = new Map<string, Promise<Map<number, any>>>();
  private managerCareersCache = new Map<string, ManagerCareer>();
  private rankingsCache: Record<string, number> | null = null;

  // Store promises to prevent duplicate fetches
  private fetchPromises = new Map<string, Promise<any>>();

  async fetchJSON(url: string): Promise<any> {
    // Check if we're already fetching this URL
    if (this.fetchPromises.has(url)) {
      return this.fetchPromises.get(url);
    }

    // Check cache
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.timestamp < 30 * 60 * 1000) {
      // 30 min cache
      return cached.data;
    }

    // Create fetch promise
    const fetchPromise = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}: ${url}`);
        return r.json();
      })
      .then((data) => {
        this.cache.set(url, { data, timestamp: Date.now() });
        this.fetchPromises.delete(url);
        return data;
      })
      .catch((err) => {
        this.fetchPromises.delete(url);
        throw err;
      });

    this.fetchPromises.set(url, fetchPromise);
    return fetchPromise;
  }

  getAllSeasonDataPromise(
    leagueId: string
  ): Promise<Map<number, any>> | undefined {
    return this.allSeasonDataCache.get(leagueId);
  }

  setAllSeasonDataPromise(
    leagueId: string,
    promise: Promise<Map<number, any>>
  ) {
    this.allSeasonDataCache.set(leagueId, promise);
  }

  getManagerCareer(key: string): ManagerCareer | undefined {
    return this.managerCareersCache.get(key);
  }

  setManagerCareer(key: string, career: ManagerCareer) {
    this.managerCareersCache.set(key, career);
  }

  getRankings(): Record<string, number> | null {
    return this.rankingsCache;
  }

  setRankings(rankings: Record<string, number>) {
    this.rankingsCache = rankings;
  }
}

// Global singleton store
const dataStore = new DataStore();

const fetchJSON = (url: string) => dataStore.fetchJSON(url);

const seasonSettings = (leagueId: string, y: number) =>
  fetchJSON(
    `${ESPN_BASE}/seasons/${y}/segments/0/leagues/${leagueId}?view=mSettings`
  );
const seasonTeamsAndStandings = (leagueId: string, y: number) =>
  fetchJSON(
    `${ESPN_BASE}/seasons/${y}/segments/0/leagues/${leagueId}?view=mTeam&view=mStandings`
  );
const seasonMatchups = (leagueId: string, y: number) =>
  fetchJSON(
    `${ESPN_BASE}/seasons/${y}/segments/0/leagues/${leagueId}?view=mMatchup`
  );

const getCurrentSeason = async (leagueId: string, fallback: number) => {
  try {
    const d = await seasonSettings(leagueId, fallback);
    return d?.seasonId ?? fallback;
  } catch {
    return fallback;
  }
};

const getOwnerIdForManager = (
  tsCurrent: any,
  managerDisplayName: string
): string | null => {
  for (const t of tsCurrent?.teams ?? []) {
    const mapped = teamManagerMap[normalize(t?.name ?? "")];
    if (mapped && managerEq(mapped, managerDisplayName)) {
      return t?.primaryOwner ?? null;
    }
  }
  return null;
};

// Resolve a manager's ESPN ownerId by scanning every available season's team
// list — not just the current one. Returning the first match means we still
// identify a manager even when their team has been renamed between seasons,
// or when the current season's data isn't published yet.
const findOwnerIdAcrossYears = (
  dataByYear: Map<number, any>,
  tsCurrent: any,
  managerDisplayName: string
): string | null => {
  const currentMatch = getOwnerIdForManager(tsCurrent, managerDisplayName);
  if (currentMatch) return currentMatch;
  for (const [, yearData] of dataByYear) {
    const match = getOwnerIdForManager(yearData?.teams, managerDisplayName);
    if (match) return match;
  }
  return null;
};

const rankTeams = (
  teams: Array<{ id: number; wins: number; pf: number }>,
  id: number
) => {
  const s = [...teams].sort((a, b) => b.wins - a.wins || b.pf - a.pf);
  const i = s.findIndex((t) => t.id === id);
  return i >= 0 ? i + 1 : teams.length;
};

const finishColor = (pos: number) =>
  pos === 1 ? "gold" : pos === 2 ? "silver" : pos === 3 ? "bronze" : "black";

// Auto-derive final 1-N standings for a season. Only seeds 1-6 make the
// playoffs, so:
//   - Teams seeded 7+ keep their pre-playoff seed as their final finish —
//     consolation games never shuffle them.
//   - Teams seeded 1-6 take their final 1-6 placement from ESPN's
//     rankCalculatedFinal (which correctly reflects the playoff bracket
//     in this league even though playoffTierType isn't tagged).
//   - If a playoff team's ESPN rank is missing/out-of-range, fall back to
//     their regular-season seed.
const PLAYOFF_SPOTS = 6;

const computeFinalStandings = (yearData: any): Map<number, number> => {
  const teams: any[] = yearData?.teams?.teams ?? [];
  const result = new Map<number, number>();
  if (!teams.length) return result;

  for (const t of teams) {
    const seed = t?.playoffSeed ?? 0;
    if (seed > PLAYOFF_SPOTS) result.set(t.id, seed);
  }

  const playoffTeams = teams.filter((t) => {
    const seed = t?.playoffSeed ?? 0;
    return seed >= 1 && seed <= PLAYOFF_SPOTS;
  });

  const espnRanks = new Map<number, number>();
  for (const t of playoffTeams) {
    const r = t?.rankCalculatedFinal;
    if (Number.isInteger(r) && r >= 1 && r <= PLAYOFF_SPOTS) {
      espnRanks.set(t.id, r);
    }
  }
  const distinctRanks = new Set(espnRanks.values());
  if (
    espnRanks.size === playoffTeams.length &&
    distinctRanks.size === playoffTeams.length
  ) {
    for (const [id, rank] of espnRanks) result.set(id, rank);
    return result;
  }

  const placedRanks = new Set(result.values());
  const unplaced = playoffTeams.filter((t) => !result.has(t.id));
  unplaced.sort((a, b) => (a?.playoffSeed ?? 99) - (b?.playoffSeed ?? 99));
  let nextRank = 1;
  for (const t of unplaced) {
    while (placedRanks.has(nextRank)) nextRank++;
    result.set(t.id, nextRank);
    placedRanks.add(nextRank);
  }

  return result;
};

const countWeeklyExtremes = (matchupData: any, teamId: number) => {
  const schedule: any[] = matchupData?.schedule ?? [];
  const byWeek = new Map<number, Array<{ id: number; pts: number }>>();

  for (const m of schedule) {
    if (!m.matchupPeriodId && !m.matchupPeriod && !m.week) continue;

    const wk = m.matchupPeriodId ?? m.matchupPeriod ?? m.week;

    if (m.home && m.away) {
      const homeId = m.home.teamId;
      const awayId = m.away.teamId;
      const homePts = m.home.totalPoints ?? m.home.points ?? m.home.score ?? 0;
      const awayPts = m.away.totalPoints ?? m.away.points ?? m.away.score ?? 0;

      if (!byWeek.has(wk)) byWeek.set(wk, []);
      if (homePts > 0) byWeek.get(wk)!.push({ id: homeId, pts: homePts });
      if (awayPts > 0) byWeek.get(wk)!.push({ id: awayId, pts: awayPts });
    } else if (m.teams && Array.isArray(m.teams)) {
      for (const t of m.teams) {
        const id = t.teamId ?? t.id;
        const pts =
          t.totalPoints ?? t.points ?? t.score ?? t.totalPointsLive ?? 0;

        if (!byWeek.has(wk)) byWeek.set(wk, []);
        if (pts > 0) byWeek.get(wk)!.push({ id, pts });
      }
    }
  }

  let top = 0;
  let bottom = 0;

  for (const [, arr] of byWeek) {
    if (arr.length < 2) continue;
    arr.sort((a, b) => b.pts - a.pts);
    const me = arr.find((x) => x.id === teamId);
    if (!me) continue;
    if (me.pts === arr[0].pts && me.pts > 0) top += 1;
    if (me.pts === arr[arr.length - 1].pts && me.pts > 0) bottom += 1;
  }

  return { top, bottom };
};

// Fetch all season data with deduplication
async function fetchAllSeasonData(
  leagueId: string,
  currentSeason: number
): Promise<Map<number, any>> {
  // Check if we're already fetching this data
  const existingPromise = dataStore.getAllSeasonDataPromise(leagueId);
  if (existingPromise) {
    return existingPromise;
  }

  // Create new fetch promise
  const fetchPromise = (async () => {
    const years = [];
    for (let year = START_SEASON; year < currentSeason; year++) {
      years.push(year);
    }

    // Fetch all data in parallel
    const [allTeamsData, allMatchupData] = await Promise.all([
      Promise.all(years.map((year) => seasonTeamsAndStandings(leagueId, year))),
      Promise.all(
        years.map((year) => seasonMatchups(leagueId, year).catch(() => null))
      ),
    ]);

    // Create a map for easy access
    const dataByYear = new Map();
    years.forEach((year, index) => {
      dataByYear.set(year, {
        teams: allTeamsData[index],
        matchups: allMatchupData[index],
      });
    });

    return dataByYear;
  })();

  // Store promise to prevent duplicate fetches
  dataStore.setAllSeasonDataPromise(leagueId, fetchPromise);

  return fetchPromise;
}

// Process manager data from the fetched season data
async function processManagerCareer(
  _leagueId: string,
  managerDisplayName: string,
  dataByYear: Map<number, any>,
  tsCurrent: any,
  currentSeason: number
): Promise<ManagerCareer> {
  const ownerId = findOwnerIdAcrossYears(
    dataByYear,
    tsCurrent,
    managerDisplayName
  );

  let W = 0,
    L = 0,
    champ = 0,
    pW = 0,
    pL = 0,
    n1 = 0,
    n10 = 0;
  const yearly: YearRow[] = [];
  const finishes: FinishDot[] = [];

  for (let year = START_SEASON; year < currentSeason; year++) {
    const yearData = dataByYear.get(year);
    if (!yearData) continue;

    const ts = yearData.teams;
    const teams: any[] = ts?.teams ?? [];

    let my = teams.find((t: any) => ownerId && t.primaryOwner === ownerId);
    if (!my) {
      my = teams.find((t: any) => {
        const mapped = teamManagerMap[normalize(t?.name ?? "")];
        return mapped && managerEq(mapped, managerDisplayName);
      });
    }
    if (!my) continue;

    const rec = my?.record?.overall ?? {};
    const w = rec.wins ?? 0;
    const l = rec.losses ?? 0;
    const t = rec.ties ?? 0;
    const gp = w + l + t;
    const pf = rec.pointsFor ?? 0;
    const pa = rec.pointsAgainst ?? 0;

    W += w;
    L += l;

    const playoffSpots = 6;

    let position: number | undefined;
    const manual = manualFinalStandings[year];
    if (manual) {
      const idx = manual.findIndex((name) =>
        managerEq(name, managerDisplayName)
      );
      if (idx !== -1) position = idx + 1;
    }
    if (position === undefined) {
      const finalStandings = computeFinalStandings(yearData);
      position = finalStandings.get(my.id);
    }
    if (position === undefined) {
      const rankedTeams = teams.map((t: any) => ({
        id: t.id,
        wins: t?.record?.overall?.wins ?? 0,
        pf: t?.record?.overall?.pointsFor ?? 0,
      }));
      position = rankTeams(rankedTeams, my.id);
    }

    const madePO = position <= playoffSpots;

    let pw = 0;
    let pl = 0;

    if (madePO) {
      if (my?.record?.postseason) {
        pw = my.record.postseason.wins ?? 0;
        pl = my.record.postseason.losses ?? 0;
      }

      if (pw === 0 && pl === 0 && my?.playoffRecord) {
        pw = my.playoffRecord.wins ?? 0;
        pl = my.playoffRecord.losses ?? 0;
      }

      if (pw === 0 && pl === 0 && yearData.matchups) {
        const schedule: any[] = yearData.matchups?.schedule ?? [];
        const playoffMatchups = schedule
          .filter((m) => {
            const week = m.matchupPeriodId ?? m.matchupPeriod ?? m.week;
            return week >= 15 && week <= 17;
          })
          .sort((a, b) => {
            const weekA = a.matchupPeriodId ?? a.matchupPeriod ?? a.week;
            const weekB = b.matchupPeriodId ?? b.matchupPeriod ?? b.week;
            return weekA - weekB;
          });

        let eliminated = false;
        for (const m of playoffMatchups) {
          if (eliminated) break;
          let myScore = 0;
          let oppScore = 0;
          let foundMyTeam = false;

          if (m.home && m.away) {
            if (m.home.teamId === my.id) {
              myScore = m.home.totalPoints ?? m.home.points ?? 0;
              oppScore = m.away.totalPoints ?? m.away.points ?? 0;
              foundMyTeam = true;
            } else if (m.away.teamId === my.id) {
              myScore = m.away.totalPoints ?? m.away.points ?? 0;
              oppScore = m.home.totalPoints ?? m.home.points ?? 0;
              foundMyTeam = true;
            }
          } else if (m.teams) {
            const myTeam = m.teams.find(
              (t: any) => (t.teamId ?? t.id) === my.id
            );
            if (myTeam) {
              foundMyTeam = true;
              myScore = myTeam.totalPoints ?? myTeam.points ?? 0;
              const oppTeam = m.teams.find(
                (t: any) => (t.teamId ?? t.id) !== my.id
              );
              oppScore = oppTeam
                ? oppTeam.totalPoints ?? oppTeam.points ?? 0
                : 0;
            }
          }

          if (foundMyTeam && myScore > 0 && oppScore > 0) {
            if (myScore > oppScore) {
              pw++;
            } else if (oppScore > myScore) {
              pl++;
              eliminated = true;
            }
          }
        }
      }
    }

    pW += pw;
    pL += pl;

    if (position === 1) champ += 1;

    if (yearData.matchups) {
      const { top, bottom } = countWeeklyExtremes(yearData.matchups, my.id);
      n1 += top;
      n10 += bottom;
    }

    yearly.push({
      year,
      w,
      l,
      playoff: madePO,
      avgPts: gp ? (pf / gp).toFixed(1) : "0.0",
      avgPa: gp ? (pa / gp).toFixed(1) : "0.0",
    });

    finishes.push({ year, position, color: finishColor(position) });
  }

  const winPct = W + L ? W / (W + L) : 0;

  return {
    championships: champ,
    playoffAppearances: yearly.filter((y) => y.playoff).length,
    playoffRecord: `${pW}-${pL}`,
    record: `${W}-${L}`,
    winPct: `${(winPct * 100).toFixed(1)}%`,
    rank: 0,
    num1Weeks: n1,
    num10Weeks: n10,
    yearly: yearly.sort((a, b) => a.year - b.year),
    finishes: finishes.sort((a, b) => a.year - b.year),
  };
}

// Preload all data for all managers
export function preloadAllManagers(leagueId: string) {
  if (!leagueId) return;

  (async () => {
    try {
      const now = new Date().getFullYear();
      const [currentSeason, tsCurrent] = await Promise.all([
        getCurrentSeason(leagueId, now),
        seasonTeamsAndStandings(leagueId, now).catch(() => null),
      ]);

      // Start fetching all season data
      const dataByYear = await fetchAllSeasonData(leagueId, currentSeason);

      // Process all managers in parallel
      const managerPromises = Object.values(teamManagerMapRaw).map(
        async (managerName) => {
          const cacheKey = `${leagueId}-${managerName}`;

          // Skip if already cached
          if (dataStore.getManagerCareer(cacheKey)) {
            return;
          }

          const career = await processManagerCareer(
            leagueId,
            managerName,
            dataByYear,
            tsCurrent,
            currentSeason
          );

          dataStore.setManagerCareer(cacheKey, career);
        }
      );

      await Promise.all(managerPromises);

      // Also calculate rankings while we have all the data
      const managerStats: Array<{ name: string; winPct: number }> = [];

      for (const managerName of Object.values(teamManagerMapRaw)) {
        const cacheKey = `${leagueId}-${managerName}`;
        const career = dataStore.getManagerCareer(cacheKey);
        if (career) {
          const winPct = parseFloat(career.winPct);
          managerStats.push({ name: managerName, winPct });
        }
      }

      managerStats.sort((a, b) => b.winPct - a.winPct);
      const rankMap: Record<string, number> = {};
      managerStats.forEach((stat, index) => {
        rankMap[stat.name] = index + 1;
      });

      dataStore.setRankings(rankMap);
    } catch (e) {
      console.error("Preload error:", e);
    }
  })();
}

/** MAIN HOOK: Returns cached data immediately if available */
export const useManagerCareer = (
  leagueId: string,
  managerDisplayName: string
): ManagerCareer | null => {
  const [data, setData] = useState<ManagerCareer | null>(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!leagueId || !managerDisplayName) return;

    const cacheKey = `${leagueId}-${managerDisplayName}`;

    // Check cache first
    const cached = dataStore.getManagerCareer(cacheKey);
    if (cached) {
      setData(cached);
      return;
    }

    // Prevent duplicate fetches
    if (loadingRef.current) return;
    loadingRef.current = true;

    (async () => {
      try {
        const now = new Date().getFullYear();
        const [currentSeason, tsCurrent] = await Promise.all([
          getCurrentSeason(leagueId, now),
          seasonTeamsAndStandings(leagueId, now).catch(() => null),
        ]);

        const dataByYear = await fetchAllSeasonData(leagueId, currentSeason);

        const career = await processManagerCareer(
          leagueId,
          managerDisplayName,
          dataByYear,
          tsCurrent,
          currentSeason
        );

        dataStore.setManagerCareer(cacheKey, career);
        setData(career);
      } catch (e) {
        console.error(e);
        setData(null);
      } finally {
        loadingRef.current = false;
      }
    })();
  }, [leagueId, managerDisplayName]);

  return useMemo(() => data, [data]);
};

export const useAllManagersRanking = (leagueId: string) => {
  const [rankings, setRankings] = useState<Record<string, number>>({});
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!leagueId) return;

    // Check cache first
    const cached = dataStore.getRankings();
    if (cached) {
      setRankings(cached);
      return;
    }

    if (loadingRef.current) return;
    loadingRef.current = true;

    (async () => {
      try {
        const now = new Date().getFullYear();
        const currentSeason = await getCurrentSeason(leagueId, now);
        const dataByYear = await fetchAllSeasonData(leagueId, currentSeason);
        const tsCurrent = await seasonTeamsAndStandings(
          leagueId,
          currentSeason
        );

        const managerStats: Array<{ name: string; winPct: number }> = [];

        for (const [_teamName, managerName] of Object.entries(
          teamManagerMapRaw
        )) {
          const ownerId = findOwnerIdAcrossYears(
            dataByYear,
            tsCurrent,
            managerName
          );

          let W = 0,
            L = 0;

          for (let year = START_SEASON; year < currentSeason; year++) {
            const yearData = dataByYear.get(year);
            if (!yearData) continue;

            const ts = yearData.teams;
            const teams: any[] = ts?.teams ?? [];

            let my = teams.find(
              (t: any) => ownerId && t.primaryOwner === ownerId
            );
            if (!my) {
              my = teams.find((t: any) => {
                const mapped = teamManagerMap[normalize(t?.name ?? "")];
                return mapped && managerEq(mapped, managerName);
              });
            }
            if (!my) continue;

            const rec = my?.record?.overall ?? {};
            W += rec.wins ?? 0;
            L += rec.losses ?? 0;
          }

          const winPct = W + L ? W / (W + L) : 0;
          managerStats.push({ name: managerName, winPct });
        }

        managerStats.sort((a, b) => b.winPct - a.winPct);
        const rankMap: Record<string, number> = {};
        managerStats.forEach((stat, index) => {
          rankMap[stat.name] = index + 1;
        });

        dataStore.setRankings(rankMap);
        setRankings(rankMap);
      } catch (e) {
        console.error(e);
      } finally {
        loadingRef.current = false;
      }
    })();
  }, [leagueId]);

  return rankings;
};

// Live team name for the manager, pulled from the current ESPN season.
// Renames in ESPN propagate without code changes as long as the manager's
// ESPN owner is still resolvable through teamManagerMap or a prior identification.
export const useCurrentTeamName = (
  leagueId: string,
  managerDisplayName: string
): string | null => {
  const [teamName, setTeamName] = useState<string | null>(null);

  useEffect(() => {
    if (!leagueId || !managerDisplayName) return;
    let cancelled = false;

    (async () => {
      try {
        const now = new Date().getFullYear();
        const currentSeason = await getCurrentSeason(leagueId, now);

        // Step 1: Find this manager's stable ESPN ownerId by walking from the
        // current season backwards. We use teamManagerMap to match by name in
        // any year where the team's name is one we recognize.
        let ownerId: string | null = null;
        for (let y = currentSeason; y >= START_SEASON; y--) {
          const ts = await seasonTeamsAndStandings(leagueId, y).catch(
            () => null
          );
          const teams: any[] = ts?.teams ?? [];
          if (!teams.length) continue;
          const team = teams.find((t: any) => {
            const mapped = teamManagerMap[normalize(t?.name ?? "")];
            return mapped && managerEq(mapped, managerDisplayName);
          });
          if (team?.primaryOwner) {
            ownerId = team.primaryOwner;
            break;
          }
        }
        if (!ownerId || cancelled) return;

        // Step 2: With the stable ownerId, find the team's most recent name —
        // even if the team has since been renamed to something not in the map.
        for (let y = currentSeason; y >= START_SEASON; y--) {
          const ts = await seasonTeamsAndStandings(leagueId, y).catch(
            () => null
          );
          const teams: any[] = ts?.teams ?? [];
          if (!teams.length) continue;
          const team = teams.find((t: any) => t.primaryOwner === ownerId);
          if (team?.name) {
            if (!cancelled) setTeamName(team.name);
            return;
          }
        }
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [leagueId, managerDisplayName]);

  return teamName;
};
