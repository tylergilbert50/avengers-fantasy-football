import { useEffect, useState } from "react";

interface Game {
  week: number;
  year: number;
  team1: string;
  team1Score: number;
  team2: string;
  team2Score: number;
}

interface SeasonStats {
  team: string;
  year: number;
  totalPoints: number;
  pointsAgainst: number;
  gamesPlayed: number;
}

interface Record {
  rank: number;
  team?: string;
  score?: string;
  opponent?: string;
  matchup?: string;
  year?: string;
  ppg?: string;
  papg?: string;
  points?: string;
  games?: string;
  span?: string;
}

const ESPN_BASE = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl";
const START_SEASON = 2021;

const teamManagerMapRaw: { [key: string]: string } = {
  "Terribly Well-Balanced": "STUART",
  "Fat Hammered Thor": "JEREMY",
  "Genius, Plaiboi, Champion": "CONNOR",
  "Wolverine's Bubs": "ANDREW",
  "Bruce Raising Banners": "JOSH",
  "I NEVER Freeze!": "DEMARCO",
  "Anyone Can Wear The Mask": "BRETT",
  "The Doom": "DANNY",
  Jarvis: "TYLER",
  "I Can Do This All Day": "DANIEL",
};

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const teamManagerMap: { [key: string]: string } = Object.fromEntries(
  Object.entries(teamManagerMapRaw).map(([k, v]) => [normalize(k), v])
);

class RecordsDataStore {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private gamesCache: Game[] | null = null;
  private fetchPromise: Promise<Game[]> | null = null;

  async fetchJSON(url: string): Promise<any> {
    const cached = this.cache.get(url);
    // Increase cache time to 24 hours for historical data
    if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
      return cached.data;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}: ${url}`);
    }
    const data = await response.json();
    this.cache.set(url, { data, timestamp: Date.now() });
    return data;
  }

  getGamesCache(): Game[] | null {
    return this.gamesCache;
  }

  setGamesCache(games: Game[]) {
    this.gamesCache = games;
  }

  getFetchPromise(): Promise<Game[]> | null {
    return this.fetchPromise;
  }

  setFetchPromise(promise: Promise<Game[]> | null) {
    this.fetchPromise = promise;
  }

  clearCache() {
    this.cache.clear();
    this.gamesCache = null;
  }
}
const recordsDataStore = new RecordsDataStore();

async function fetchAllGames(leagueId: string): Promise<Game[]> {
  const cached = recordsDataStore.getGamesCache();
  if (cached) {
    return cached;
  }

  const existingPromise = recordsDataStore.getFetchPromise();
  if (existingPromise) {
    return existingPromise;
  }

  const fetchPromise = (async () => {
    const now = new Date().getFullYear();
    const years = [];
    for (let year = START_SEASON; year <= now; year++) {
      years.push(year);
    }

    // Fetch all years in parallel with higher concurrency
    const yearResults = await Promise.all(
      years.map(async (year) => {
        try {
          // Fetch both endpoints simultaneously
          const [matchupData, teamsData] = await Promise.all([
            recordsDataStore.fetchJSON(
              `${ESPN_BASE}/seasons/${year}/segments/0/leagues/${leagueId}?view=mMatchup`
            ),
            recordsDataStore.fetchJSON(
              `${ESPN_BASE}/seasons/${year}/segments/0/leagues/${leagueId}?view=mTeam`
            ),
          ]);

          const teamIdToName = new Map<number, string>();
          for (const team of teamsData?.teams ?? []) {
            const teamName = team?.name ?? "";
            const normalizedName = normalize(teamName);
            const managerName = teamManagerMap[normalizedName];
            if (managerName) {
              teamIdToName.set(team.id, managerName);
            }
          }

          const schedule: any[] = matchupData?.schedule ?? [];
          const yearGames: Game[] = [];

          // Process matchups more efficiently
          for (const matchup of schedule) {
            if (!matchup.home || !matchup.away) continue;

            const week =
              matchup.matchupPeriodId ?? matchup.matchupPeriod ?? matchup.week;
            const team1Id = matchup.home.teamId;
            const team2Id = matchup.away.teamId;
            const team1Score =
              matchup.home.totalPoints ?? matchup.home.points ?? 0;
            const team2Score =
              matchup.away.totalPoints ?? matchup.away.points ?? 0;

            const team1Name = teamIdToName.get(team1Id);
            const team2Name = teamIdToName.get(team2Id);

            if (team1Name && team2Name && team1Score > 0 && team2Score > 0) {
              yearGames.push({
                week,
                year,
                team1: team1Name,
                team1Score,
                team2: team2Name,
                team2Score,
              });
            }
          }

          return yearGames;
        } catch (error) {
          console.error(`Error fetching data for year ${year}:`, error);
          return [];
        }
      })
    );

    const games = yearResults.flat();
    recordsDataStore.setGamesCache(games);
    recordsDataStore.setFetchPromise(null);
    return games;
  })();

  recordsDataStore.setFetchPromise(fetchPromise);
  return fetchPromise;
}

export class RecordsCalculator {
  private games: Game[];

  constructor(games: Game[]) {
    this.games = games;
  }

  getHighestScoringWeeks(limit: number = 5): Record[] {
    const allScores: Array<{
      team: string;
      score: number;
      opponent: string;
      year: number;
    }> = [];

    this.games.forEach((game) => {
      allScores.push({
        team: game.team1,
        score: game.team1Score,
        opponent: game.team2,
        year: game.year,
      });
      allScores.push({
        team: game.team2,
        score: game.team2Score,
        opponent: game.team1,
        year: game.year,
      });
    });

    return allScores
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item, index) => ({
        rank: index + 1,
        team: item.team,
        score: item.score.toFixed(2),
        opponent: `${item.opponent}, ${item.year}`,
      }));
  }

  getLowestScoringWeeks(limit: number = 5): Record[] {
    const allScores: Array<{
      team: string;
      score: number;
      opponent: string;
      year: number;
    }> = [];

    this.games.forEach((game) => {
      allScores.push({
        team: game.team1,
        score: game.team1Score,
        opponent: game.team2,
        year: game.year,
      });
      allScores.push({
        team: game.team2,
        score: game.team2Score,
        opponent: game.team1,
        year: game.year,
      });
    });

    return allScores
      .sort((a, b) => a.score - b.score)
      .slice(0, limit)
      .map((item, index) => ({
        rank: index + 1,
        team: item.team,
        score: item.score.toFixed(2),
        opponent: `${item.opponent}, ${item.year}`,
      }));
  }

  getHighestCombinedScores(limit: number = 5): Record[] {
    return this.games
      .map((game) => {
        const total = game.team1Score + game.team2Score;
        const winner =
          game.team1Score > game.team2Score ? game.team1 : game.team2;
        const loser =
          game.team1Score > game.team2Score ? game.team2 : game.team1;
        const winnerScore = Math.max(game.team1Score, game.team2Score);
        const loserScore = Math.min(game.team1Score, game.team2Score);

        return {
          total,
          matchup: `${winner} VS. ${loser}`,
          score: `${winnerScore.toFixed(2)} - ${loserScore.toFixed(2)}`,
          year: game.year.toString(),
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, limit)
      .map((item, index) => ({
        rank: index + 1,
        matchup: item.matchup,
        score: item.score,
        year: item.year,
      }));
  }

  getLowestCombinedScores(limit: number = 5): Record[] {
    return this.games
      .map((game) => {
        const total = game.team1Score + game.team2Score;
        const winner =
          game.team1Score > game.team2Score ? game.team1 : game.team2;
        const loser =
          game.team1Score > game.team2Score ? game.team2 : game.team1;
        const winnerScore = Math.max(game.team1Score, game.team2Score);
        const loserScore = Math.min(game.team1Score, game.team2Score);

        return {
          total,
          matchup: `${winner} VS. ${loser}`,
          score: `${winnerScore.toFixed(2)} - ${loserScore.toFixed(2)}`,
          year: game.year.toString(),
        };
      })
      .sort((a, b) => a.total - b.total)
      .slice(0, limit)
      .map((item, index) => ({
        rank: index + 1,
        matchup: item.matchup,
        score: item.score,
        year: item.year,
      }));
  }

  getLargestMarginsOfVictory(limit: number = 5): Record[] {
    return this.games
      .map((game) => {
        const margin = Math.abs(game.team1Score - game.team2Score);
        const winner =
          game.team1Score > game.team2Score ? game.team1 : game.team2;
        const loser =
          game.team1Score > game.team2Score ? game.team2 : game.team1;
        const winnerScore = Math.max(game.team1Score, game.team2Score);
        const loserScore = Math.min(game.team1Score, game.team2Score);

        return {
          margin,
          matchup: `${winner} VS. ${loser}`,
          score: `${winnerScore.toFixed(2)} - ${loserScore.toFixed(2)}`,
          year: game.year.toString(),
        };
      })
      .sort((a, b) => b.margin - a.margin)
      .slice(0, limit)
      .map((item, index) => ({
        rank: index + 1,
        matchup: item.matchup,
        score: item.score,
        year: item.year,
      }));
  }

  getSmallestMarginsOfVictory(limit: number = 5): Record[] {
    return this.games
      .map((game) => {
        const margin = Math.abs(game.team1Score - game.team2Score);
        const winner =
          game.team1Score >= game.team2Score ? game.team1 : game.team2;
        const loser =
          game.team1Score >= game.team2Score ? game.team2 : game.team1;
        const winnerScore = Math.max(game.team1Score, game.team2Score);
        const loserScore = Math.min(game.team1Score, game.team2Score);

        return {
          margin,
          matchup: `${winner} VS. ${loser}`,
          score: `${winnerScore.toFixed(2)} - ${loserScore.toFixed(2)}`,
          year: game.year.toString(),
        };
      })
      .sort((a, b) => a.margin - b.margin)
      .slice(0, limit)
      .map((item, index) => ({
        rank: index + 1,
        matchup: item.matchup,
        score: item.score,
        year: item.year,
      }));
  }

  private calculateSeasonalStats(): SeasonStats[] {
    const seasonMap = new Map<string, SeasonStats>();

    this.games.forEach((game) => {
      const key1 = `${game.team1}-${game.year}`;
      if (!seasonMap.has(key1)) {
        seasonMap.set(key1, {
          team: game.team1,
          year: game.year,
          totalPoints: 0,
          pointsAgainst: 0,
          gamesPlayed: 0,
        });
      }
      const stats1 = seasonMap.get(key1)!;
      stats1.totalPoints += game.team1Score;
      stats1.pointsAgainst += game.team2Score;
      stats1.gamesPlayed += 1;

      const key2 = `${game.team2}-${game.year}`;
      if (!seasonMap.has(key2)) {
        seasonMap.set(key2, {
          team: game.team2,
          year: game.year,
          totalPoints: 0,
          pointsAgainst: 0,
          gamesPlayed: 0,
        });
      }
      const stats2 = seasonMap.get(key2)!;
      stats2.totalPoints += game.team2Score;
      stats2.pointsAgainst += game.team1Score;
      stats2.gamesPlayed += 1;
    });

    return Array.from(seasonMap.values());
  }

  getHighestSeasonalPoints(limit: number = 5): Record[] {
    const seasonalStats = this.calculateSeasonalStats();

    return seasonalStats
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, limit)
      .map((stats, index) => ({
        rank: index + 1,
        team: stats.team,
        ppg: (stats.totalPoints / stats.gamesPlayed).toFixed(2),
        points: stats.totalPoints.toFixed(2),
        year: stats.year.toString(),
      }));
  }

  getLowestSeasonalPoints(limit: number = 5): Record[] {
    const seasonalStats = this.calculateSeasonalStats();

    return seasonalStats
      .sort((a, b) => a.totalPoints - b.totalPoints)
      .slice(0, limit)
      .map((stats, index) => ({
        rank: index + 1,
        team: stats.team,
        ppg: (stats.totalPoints / stats.gamesPlayed).toFixed(2),
        points: stats.totalPoints.toFixed(2),
        year: stats.year.toString(),
      }));
  }

  getHighestPointsAgainst(limit: number = 5): Record[] {
    const seasonalStats = this.calculateSeasonalStats();

    return seasonalStats
      .sort((a, b) => b.pointsAgainst - a.pointsAgainst)
      .slice(0, limit)
      .map((stats, index) => ({
        rank: index + 1,
        team: stats.team,
        papg: (stats.pointsAgainst / stats.gamesPlayed).toFixed(2),
        points: stats.pointsAgainst.toFixed(2),
        year: stats.year.toString(),
      }));
  }

  getLowestPointsAgainst(limit: number = 5): Record[] {
    const seasonalStats = this.calculateSeasonalStats();

    return seasonalStats
      .sort((a, b) => a.pointsAgainst - b.pointsAgainst)
      .slice(0, limit)
      .map((stats, index) => ({
        rank: index + 1,
        team: stats.team,
        papg: (stats.pointsAgainst / stats.gamesPlayed).toFixed(2),
        points: stats.pointsAgainst.toFixed(2),
        year: stats.year.toString(),
      }));
  }

  private calculateStreaks(): Array<{
    team: string;
    type: "win" | "loss";
    length: number;
    startWeek: number;
    startYear: number;
    endWeek: number;
    endYear: number;
  }> {
    const sortedGames = [...this.games].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.week - b.week;
    });

    const teamStreaks = new Map<
      string,
      {
        currentType: "win" | "loss" | null;
        currentLength: number;
        currentStart: { week: number; year: number };
        allStreaks: Array<{
          type: "win" | "loss";
          length: number;
          startWeek: number;
          startYear: number;
          endWeek: number;
          endYear: number;
        }>;
      }
    >();

    sortedGames.forEach((game) => {
      [game.team1, game.team2].forEach((team) => {
        if (!teamStreaks.has(team)) {
          teamStreaks.set(team, {
            currentType: null,
            currentLength: 0,
            currentStart: { week: 0, year: 0 },
            allStreaks: [],
          });
        }
      });

      const team1Won = game.team1Score > game.team2Score;
      const team1Data = teamStreaks.get(game.team1)!;
      const team2Data = teamStreaks.get(game.team2)!;

      const updateStreak = (
        teamData: typeof team1Data,
        won: boolean,
        week: number,
        year: number
      ) => {
        const resultType = won ? "win" : "loss";

        if (teamData.currentType === resultType) {
          teamData.currentLength++;
        } else {
          if (teamData.currentType !== null && teamData.currentLength > 0) {
            teamData.allStreaks.push({
              type: teamData.currentType,
              length: teamData.currentLength,
              startWeek: teamData.currentStart.week,
              startYear: teamData.currentStart.year,
              endWeek: week,
              endYear: year,
            });
          }
          teamData.currentType = resultType;
          teamData.currentLength = 1;
          teamData.currentStart = { week, year };
        }
      };

      updateStreak(team1Data, team1Won, game.week, game.year);
      updateStreak(team2Data, !team1Won, game.week, game.year);
    });

    teamStreaks.forEach((data) => {
      if (data.currentType !== null && data.currentLength > 0) {
        const lastGame = sortedGames[sortedGames.length - 1];
        data.allStreaks.push({
          type: data.currentType,
          length: data.currentLength,
          startWeek: data.currentStart.week,
          startYear: data.currentStart.year,
          endWeek: lastGame.week,
          endYear: lastGame.year,
        });
      }
    });

    const allStreaks: Array<{
      team: string;
      type: "win" | "loss";
      length: number;
      startWeek: number;
      startYear: number;
      endWeek: number;
      endYear: number;
    }> = [];

    teamStreaks.forEach((data, team) => {
      data.allStreaks.forEach((streak) => {
        allStreaks.push({ team, ...streak });
      });
    });

    return allStreaks;
  }

  getLongestWinningStreaks(limit: number = 5): Record[] {
    const streaks = this.calculateStreaks();

    return streaks
      .filter((s) => s.type === "win")
      .sort((a, b) => b.length - a.length)
      .slice(0, limit)
      .map((streak, index) => ({
        rank: index + 1,
        team: streak.team,
        games: streak.length.toString(),
        span: `W${streak.startWeek} ${streak.startYear} - W${streak.endWeek} ${streak.endYear}`,
      }));
  }

  getLongestLosingStreaks(limit: number = 5): Record[] {
    const streaks = this.calculateStreaks();

    return streaks
      .filter((s) => s.type === "loss")
      .sort((a, b) => b.length - a.length)
      .slice(0, limit)
      .map((streak, index) => ({
        rank: index + 1,
        team: streak.team,
        games: streak.length.toString(),
        span: `W${streak.startWeek} ${streak.startYear} - W${streak.endWeek} ${streak.endYear}`,
      }));
  }

  getAllRecords() {
    return {
      highestScoringWeek: this.getHighestScoringWeeks(),
      lowestScoringWeek: this.getLowestScoringWeeks(),
      highestCombinedScore: this.getHighestCombinedScores(),
      lowestCombinedScore: this.getLowestCombinedScores(),
      largestMarginOfVictory: this.getLargestMarginsOfVictory(),
      smallestMarginOfVictory: this.getSmallestMarginsOfVictory(),
      highestSeasonalPoints: this.getHighestSeasonalPoints(),
      lowestSeasonalPoints: this.getLowestSeasonalPoints(),
      highestPointsAgainst: this.getHighestPointsAgainst(),
      lowestPointsAgainst: this.getLowestPointsAgainst(),
      longestWinningStreaks: this.getLongestWinningStreaks(),
      longestLosingStreaks: this.getLongestLosingStreaks(),
    };
  }
}

export const useRecordsData = (leagueId: string) => {
  const [records, setRecords] = useState<ReturnType<
    RecordsCalculator["getAllRecords"]
  > | null>(null);

  useEffect(() => {
    if (!leagueId) return;

    fetchAllGames(leagueId)
      .then((games) => {
        const calculator = new RecordsCalculator(games);
        setRecords(calculator.getAllRecords());
      })
      .catch((error) => {
        console.error("Error fetching records:", error);
        setRecords(null);
      });
  }, [leagueId]);

  return { records };
};

export function preloadRecordsData(leagueId: string) {
  if (!leagueId) return;
  // Start fetching immediately without waiting
  fetchAllGames(leagueId).catch(console.error);
}

preloadRecordsData("1268500224");
