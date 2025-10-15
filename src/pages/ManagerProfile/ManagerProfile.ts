// ManagerProfile.ts (owner-ID based)
import { useEffect, useMemo, useState } from "react";

export interface YearRow {
  year: number;
  w: number;
  l: number;
  playoff: boolean;
  avgPts: number;
  avgPa: number;
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

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const teamManagerMapRaw: Record<string, string> = {
  "Terribly Well-Balanced": "Stuart Iverson",
  "Fat Hammered Thor": "Jeremy Stojakovich",
  "Genius, Plaiboi, Champion": "Connor Boswer",
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

const fetchJSON = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}: ${url}`);
  return r.json();
};
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

// Find the stable owner GUID for this manager from CURRENT season
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

const countWeeklyExtremes = (matchupData: any, teamId: number) => {
  const schedule: any[] = matchupData?.schedule ?? [];
  const byWeek = new Map<number, Array<{ id: number; pts: number }>>();

  for (const m of schedule) {
    // Skip playoff weeks or bye weeks
    if (!m.matchupPeriodId && !m.matchupPeriod && !m.week) continue;

    const wk = m.matchupPeriodId ?? m.matchupPeriod ?? m.week;

    // Handle different matchup data structures
    if (m.home && m.away) {
      // Structure: { home: {...}, away: {...} }
      const homeId = m.home.teamId;
      const awayId = m.away.teamId;
      const homePts = m.home.totalPoints ?? m.home.points ?? m.home.score ?? 0;
      const awayPts = m.away.totalPoints ?? m.away.points ?? m.away.score ?? 0;

      if (!byWeek.has(wk)) byWeek.set(wk, []);
      if (homePts > 0) byWeek.get(wk)!.push({ id: homeId, pts: homePts });
      if (awayPts > 0) byWeek.get(wk)!.push({ id: awayId, pts: awayPts });
    } else if (m.teams && Array.isArray(m.teams)) {
      // Structure: { teams: [{...}, {...}] }
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
    if (arr.length < 2) continue; // Need at least 2 teams to compare

    // Sort by points descending
    arr.sort((a, b) => b.pts - a.pts);

    const me = arr.find((x) => x.id === teamId);
    if (!me) continue;

    // Check if this team had the highest score this week
    if (me.pts === arr[0].pts && me.pts > 0) top += 1;

    // Check if this team had the lowest score this week
    if (me.pts === arr[arr.length - 1].pts && me.pts > 0) bottom += 1;
  }

  return { top, bottom };
};

/** MAIN HOOK: owner-ID matching across seasons */
export const useManagerCareer = (
  leagueId: string,
  managerDisplayName: string
): ManagerCareer | null => {
  const [data, setData] = useState<ManagerCareer | null>(null);

  useEffect(() => {
    if (!leagueId || !managerDisplayName) return;

    (async () => {
      try {
        const now = new Date().getFullYear();
        const currentSeason = await getCurrentSeason(leagueId, now);

        // Get current-season teams to discover the stable primaryOwner for this manager
        const tsCurrent = await seasonTeamsAndStandings(
          leagueId,
          currentSeason
        );
        const ownerId = getOwnerIdForManager(tsCurrent, managerDisplayName);

        // If we still don't have an ownerId, we'll fallback to name-matching each year
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
          const ts = await seasonTeamsAndStandings(leagueId, year);
          const teams: any[] = ts?.teams ?? [];

          // Find the team for this manager: prefer by ownerId, else by name map
          let my = teams.find((t) => ownerId && t.primaryOwner === ownerId);
          if (!my) {
            my = teams.find((t) => {
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

          // Try to get playoff record from multiple possible sources
          let pw = 0;
          let pl = 0;

          // Option 1: Check record.postseason
          if (my?.record?.postseason) {
            pw = my.record.postseason.wins ?? 0;
            pl = my.record.postseason.losses ?? 0;
          }

          // Option 2: Check playoffRecord directly
          if (pw === 0 && pl === 0 && my?.playoffRecord) {
            pw = my.playoffRecord.wins ?? 0;
            pl = my.playoffRecord.losses ?? 0;
          }

          // Option 3: Try to derive from matchup data
          if (pw === 0 && pl === 0) {
            try {
              const mu = await seasonMatchups(leagueId, year);
              const schedule: any[] = mu?.schedule ?? [];

              for (const m of schedule) {
                // Check if this is a playoff matchup
                const isPlayoff =
                  m.playoffTierType !== undefined ||
                  m.playoff === true ||
                  (m.matchupPeriodId && m.matchupPeriodId >= 15);

                if (!isPlayoff) continue;

                // Check if our team is in this matchup
                let myScore = 0;
                let oppScore = 0;

                if (m.home && m.away) {
                  if (m.home.teamId === my.id) {
                    myScore = m.home.totalPoints ?? m.home.points ?? 0;
                    oppScore = m.away.totalPoints ?? m.away.points ?? 0;
                  } else if (m.away.teamId === my.id) {
                    myScore = m.away.totalPoints ?? m.away.points ?? 0;
                    oppScore = m.home.totalPoints ?? m.home.points ?? 0;
                  }
                } else if (m.teams) {
                  const myTeam = m.teams.find(
                    (t: any) => (t.teamId ?? t.id) === my.id
                  );
                  if (myTeam) {
                    myScore = myTeam.totalPoints ?? myTeam.points ?? 0;
                    const oppTeam = m.teams.find(
                      (t: any) => (t.teamId ?? t.id) !== my.id
                    );
                    oppScore = oppTeam
                      ? oppTeam.totalPoints ?? oppTeam.points ?? 0
                      : 0;
                  }
                }

                if (myScore > 0 && oppScore > 0) {
                  if (myScore > oppScore) pw++;
                  else if (oppScore > myScore) pl++;
                }
              }
            } catch {}
          }

          pW += pw;
          pL += pl;

          // ✅ FIXED: Playoff detection - only count as playoff appearance if they have a valid playoff seed
          const playoffSpots = 6; // Adjust this to your league's playoff spots
          const madePO =
            my?.playoffSeed &&
            my.playoffSeed > 0 &&
            my.playoffSeed <= playoffSpots;

          // Determine final position
          const finalRank =
            my?.rankCalculatedFinal ??
            my?.rankFinal ??
            my?.finalStanding ??
            undefined;

          const position =
            typeof finalRank === "number"
              ? finalRank
              : rankTeams(
                  teams.map((t: any) => ({
                    id: t.id,
                    wins: t?.record?.overall?.wins ?? 0,
                    pf: t?.record?.overall?.pointsFor ?? 0,
                  })),
                  my.id
                );

          // Count championship if finished 1st place
          // Championship requires either playoff wins or being ranked 1st in a league with playoffs
          if (position === 1) {
            champ += 1;
          }

          try {
            const mu = await seasonMatchups(leagueId, year);
            const { top, bottom } = countWeeklyExtremes(mu, my.id);
            n1 += top;
            n10 += bottom;
          } catch {}

          yearly.push({
            year,
            w,
            l,
            playoff: madePO,
            avgPts: gp ? Number((pf / gp).toFixed(2)) : 0,
            avgPa: gp ? Number((pa / gp).toFixed(2)) : 0,
          });

          finishes.push({ year, position, color: finishColor(position) });
        }

        const winPct = W + L ? W / (W + L) : 0;

        setData({
          championships: champ,
          playoffAppearances: yearly.filter((y) => y.playoff).length,
          playoffRecord: `${pW}-${pL}`,
          record: `${W}-${L}`,
          winPct: winPct.toFixed(3).replace(/^0/, ""),
          rank: 0, // We'll calculate this externally
          num1Weeks: n1,
          num10Weeks: n10,
          yearly: yearly.sort((a, b) => a.year - b.year),
          finishes: finishes.sort((a, b) => a.year - b.year),
        });
      } catch (e) {
        console.error(e);
        setData(null);
      }
    })();
  }, [leagueId, managerDisplayName]);

  return useMemo(() => data, [data]);
};

export const useAllManagersRanking = (leagueId: string) => {
  const [rankings, setRankings] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!leagueId) return;

    (async () => {
      try {
        const now = new Date().getFullYear();
        const currentSeason = await getCurrentSeason(leagueId, now);
        const tsCurrent = await seasonTeamsAndStandings(
          leagueId,
          currentSeason
        );

        // Calculate winning % for each manager
        const managerStats: Array<{ name: string; winPct: number }> = [];

        for (const [_teamName, managerName] of Object.entries(
          teamManagerMapRaw
        )) {
          const ownerId = getOwnerIdForManager(tsCurrent, managerName);

          let W = 0,
            L = 0;

          for (let year = START_SEASON; year < currentSeason; year++) {
            const ts = await seasonTeamsAndStandings(leagueId, year);
            const teams: any[] = ts?.teams ?? [];

            let my = teams.find((t) => ownerId && t.primaryOwner === ownerId);
            if (!my) {
              my = teams.find((t) => {
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

        // Sort by winning percentage (highest first) and assign ranks
        managerStats.sort((a, b) => b.winPct - a.winPct);

        const rankMap: Record<string, number> = {};
        managerStats.forEach((stat, index) => {
          rankMap[stat.name] = index + 1;
        });

        setRankings(rankMap);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [leagueId]);

  return rankings;
};
