import { useState, useEffect } from "react";

export interface WeekWinner {
  week: number;
  score: string;
  name: string;
  image: string;
}

export const useCurrentSeason = (leagueId: string) => {
  const [year, setYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    const fetchCurrentSeason = async () => {
      try {
        const response = await fetch(
          `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${leagueId}?view=mSettings`
        );
        const data = await response.json();
        if (data.seasonId) {
          setYear(data.seasonId);
        }
      } catch (error) {
        console.error("Error fetching current season:", error);
      }
    };

    if (leagueId) {
      fetchCurrentSeason();
    }
  }, [leagueId, year]);

  return { year };
};

export const useTopTeams = (leagueId: string, year: number) => {
  const [weeks, setWeeks] = useState<WeekWinner[]>([]);

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

  const managerImageMap: { [key: string]: string } = {
    "Stuart Iverson": "/images/managers/stuart.png",
    "Jeremy Stojakovich": "/images/managers/jeremy.png",
    "Connor Bowser": "/images/managers/connor.png",
    "Andrew Casazza": "/images/managers/andrew.png",
    "Josh Hartless": "/images/managers/josh.png",
    "Demarco Moore": "/images/managers/demarco.png",
    "Brett Gilbert": "/images/managers/brett.png",
    "Danny Stiles": "/images/managers/danny.png",
    "Tyler Gilbert": "/images/managers/tyler.png",
    "Daniel Dixon": "/images/managers/daniel.png",
  };

  useEffect(() => {
    const fetchTopTeams = async () => {
      try {
        const response = await fetch(
          `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${leagueId}?view=mMatchup&view=mTeam`
        );
        const data = await response.json();

        const weekWinners: WeekWinner[] = [];
        const currentWeek = data.scoringPeriodId || 1;

        for (let week = 1; week <= Math.min(currentWeek, 14); week++) {
          let highestScore = 0;
          let winnerTeamId: number | null = null;

          if (data.schedule) {
            const weekMatchups = data.schedule.filter(
              (matchup: any) => matchup.matchupPeriodId === week
            );

            weekMatchups.forEach((matchup: any) => {
              if (matchup.home?.totalPoints > highestScore) {
                highestScore = matchup.home.totalPoints;
                winnerTeamId = matchup.home.teamId;
              }
              if (matchup.away?.totalPoints > highestScore) {
                highestScore = matchup.away.totalPoints;
                winnerTeamId = matchup.away.teamId;
              }
            });
          }

          if (winnerTeamId && data.teams) {
            const winningTeam = data.teams.find(
              (team: any) => team.id === winnerTeamId
            );
            if (winningTeam) {
              const teamName = winningTeam.name || `Team ${winnerTeamId}`;
              const managerName =
                teamManagerMap[normalize(teamName)] || teamName;
              const firstName = managerName.split(" ")[0].toUpperCase();

              weekWinners.push({
                week,
                score: highestScore.toFixed(2),
                name: firstName,
                image: managerImageMap[managerName] || "",
              });
            }
          }
        }

        for (let week = weekWinners.length + 1; week <= 14; week++) {
          weekWinners.push({
            week,
            score: "",
            name: "",
            image: "",
          });
        }

        setWeeks(weekWinners);
      } catch (error) {
        console.error("Error fetching top teams:", error);
      }
    };

    if (year) {
      fetchTopTeams();
    }
  }, [leagueId, year]);

  return weeks;
};
