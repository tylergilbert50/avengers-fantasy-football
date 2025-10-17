import { useState, useEffect } from "react";

interface SeasonInfo {
  year: number;
}

interface Team {
  id: number;
  name: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  gamesPlayed: number;
}

// Add caching outside the hooks
const seasonCache = new Map<string, number>();
const standingsCache = new Map<string, Team[]>();

export const useCurrentSeason = (leagueId: string): SeasonInfo => {
  const [year, setYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    // Check cache first
    if (seasonCache.has(leagueId)) {
      setYear(seasonCache.get(leagueId)!);
      return;
    }

    const fetchCurrentSeason = async () => {
      const response = await fetch(
        `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${leagueId}?view=mSettings`
      );

      const data = await response.json();

      if (data.seasonId) {
        setYear(data.seasonId);
        seasonCache.set(leagueId, data.seasonId);
      }
    };

    if (leagueId) {
      fetchCurrentSeason();
    }
  }, [leagueId]); // REMOVED 'year' from dependencies - this was causing the loop!

  return { year };
};

export const useStandings = (leagueId: string, year: number): Team[] => {
  const [teams, setTeams] = useState<Team[]>([]);

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

  const teamManagerMapRaw: { [teamName: string]: string } = {
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

  const teamManagerMap: { [normalizedTeamName: string]: string } =
    Object.fromEntries(
      Object.entries(teamManagerMapRaw).map(([k, v]) => [normalize(k), v])
    );

  useEffect(() => {
    const cacheKey = `${leagueId}-${year}`;
    
    // Check cache first
    if (standingsCache.has(cacheKey)) {
      setTeams(standingsCache.get(cacheKey)!);
      return;
    }

    const fetchStandings = async () => {
      const response = await fetch(
        `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${leagueId}?view=mTeam&view=mStandings`
      );
      const data = await response.json();

      const teamData: Team[] = data.teams.map((team: any) => {
        const teamName = team.name || `Team ${team.id}`;
        const managerName = teamManagerMap[normalize(teamName)] || teamName;

        return {
          id: team.id,
          name: managerName,
          wins: team.record.overall.wins,
          losses: team.record.overall.losses,
          ties: team.record.overall.ties,
          pointsFor: team.record.overall.pointsFor,
          pointsAgainst: team.record.overall.pointsAgainst,
          gamesPlayed:
            team.record.overall.wins +
            team.record.overall.losses +
            team.record.overall.ties,
        };
      });

      teamData.sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.pointsFor - a.pointsFor;
      });

      setTeams(teamData);
      standingsCache.set(cacheKey, teamData);
    };

    if (year) {
      fetchStandings();
    }
  }, [leagueId, year]);

  return teams;
};