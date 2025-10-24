import { useState, useEffect } from "react";
import {
  submitVoteToFirebase,
  getVotesForWeek,
  hasUserVoted,
  listenToVotes,
  type PollVote,
} from "../../services/pollService";

export interface Manager {
  id: string;
  name: string;
}

export interface Votes {
  [position: string]: string | null;
}

export interface PollResult {
  id: string;
  name: string;
  record: string;
  trend: string;
  pollPoints: number;
  firstPlaceVotes: number;
}

interface Team {
  id: number;
  name: string;
  wins: number;
  losses: number;
}

const POSITIONS = [
  "1st",
  "2nd",
  "3rd",
  "4th",
  "5th",
  "6th",
  "7th",
  "8th",
  "9th",
  "10th",
];
const POINTS_MAP: { [key: string]: number } = {
  "1st": 10,
  "2nd": 9,
  "3rd": 8,
  "4th": 7,
  "5th": 6,
  "6th": 5,
  "7th": 4,
  "8th": 3,
  "9th": 2,
  "10th": 1,
};

const WEEK_7_RANKINGS: { [managerName: string]: number } = {
  "Stuart Iverson": 1,
  "Andrew Casazza": 5,
  "Jeremy Stojakovich": 3,
  "Connor Bowser": 2,
  "Brett Gilbert": 6,
  "Demarco Moore": 7,
  "Josh Hartless": 4,
  "Tyler Gilbert": 8,
  "Danny Stiles": 9,
  "Daniel Dixon": 10,
};

export const getEmptyVotes = (): Votes =>
  Object.fromEntries(POSITIONS.map((pos) => [pos, null]));

export const getUserId = (): string => {
  let id = localStorage.getItem("poll_user_id");
  if (!id) {
    id = "user_" + Math.random().toString(36).substr(2, 9);
    localStorage.setItem("poll_user_id", id);
  }
  return id;
};

export const getCurrentWeek = () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const septemberFirst = new Date(currentYear, 8, 1);
  const firstTuesday = new Date(septemberFirst);
  firstTuesday.setDate(1 + ((9 - septemberFirst.getDay()) % 7));

  const timeDiff = now.getTime() - firstTuesday.getTime();
  const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
  const weekNum = Math.floor(daysDiff / 7) + 1;

  return Math.max(1, Math.min(weekNum, 18));
};

export const shouldShowResults = () => {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();

  // Show results from Thursday 10 AM through Monday (all day)
  if (day === 4 && hour >= 19) return true; // Thursday from 7 PM
  if (day === 5 || day === 6 || day === 0 || day === 1) return true; // Friday, Saturday, Sunday, Monday (all day)
  if (day === 2 && hour < 10) return true; // Tuesday until 9:59 AM

  return false;
};

const saveVotesToLocalStorage = (week: number, votes: Votes) => {
  localStorage.setItem(`managerPollSubmitted_week${week}`, "true");
  localStorage.setItem(`managerPollVotes_week${week}`, JSON.stringify(votes));
};

export const usePollData = (
  userId: string,
  currentWeek: number,
  teams: Team[]
) => {
  const [votes, setVotes] = useState<Votes>(getEmptyVotes());
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [allVotes, setAllVotes] = useState<PollVote[]>([]);
  const [pollResults, setPollResults] = useState<PollResult[]>([]);

  const managers: Manager[] = teams
    .map((team) => ({ id: team.id.toString(), name: team.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    const checkUserVoteStatus = async () => {
      const hasVoted = await hasUserVoted(userId, currentWeek);
      setHasSubmitted(hasVoted);

      if (hasVoted) {
        const weekVotes = await getVotesForWeek(currentWeek);
        const userVote = weekVotes.find((vote) => vote.userId === userId);
        if (userVote) setVotes(userVote.votes);
      }
    };

    checkUserVoteStatus();
    const unsubscribe = listenToVotes(currentWeek, setAllVotes);
    return () => unsubscribe();
  }, [currentWeek, userId]);

  useEffect(() => {
    const fetchResults = async () => {
      const results = await calculatePollResults(
        allVotes,
        managers,
        teams,
        currentWeek
      );
      setPollResults(results);
    };
    fetchResults();
  }, [allVotes, currentWeek]);

  const handleVote = (managerId: string, position: string) => {
    if (hasSubmitted) return;

    setVotes((prevVotes) => {
      const newVotes = { ...prevVotes };

      if (prevVotes[position] === managerId) {
        newVotes[position] = null;
        return newVotes;
      }

      if (prevVotes[position] !== null && prevVotes[position] !== managerId) {
        return prevVotes;
      }

      Object.keys(newVotes).forEach((pos) => {
        if (newVotes[pos] === managerId) newVotes[pos] = null;
      });

      newVotes[position] = managerId;
      return newVotes;
    });
  };

  const handleSubmit = async () => {
    if (hasSubmitted) {
      alert("You have already submitted your vote from this device.");
      return;
    }

    const selectedVotes = Object.values(votes).filter((v) => v !== null);
    if (selectedVotes.length < 10) {
      alert("Please select a manager for all 10 positions before submitting.");
      return;
    }

    const success = await submitVoteToFirebase(userId, currentWeek, votes);
    if (success) {
      saveVotesToLocalStorage(currentWeek, votes);
      setHasSubmitted(true);
      alert("Poll submitted successfully!");
    } else {
      alert("Error submitting poll. Please try again.");
    }
  };

  return {
    votes,
    hasSubmitted,
    pollResults,
    managers,
    handleVote,
    handleSubmit,
  };
};

const calculateFirstPlaceVotes = (allVotes: PollVote[]) => {
  const counts: { [key: string]: number } = {};
  allVotes.forEach((vote) => {
    const firstPlace = vote.votes["1st"];
    if (firstPlace) counts[firstPlace] = (counts[firstPlace] || 0) + 1;
  });
  return counts;
};

const calculatePreviousWeekRankings = async (
  currentWeek: number,
  managers: Manager[]
) => {
  const previousWeek = currentWeek - 1;
  if (previousWeek < 1) return {};

  const previousWeekVotes = await getVotesForWeek(previousWeek);

  if (previousWeekVotes.length === 0) {
    if (previousWeek === 7) {
      const rankings: { [id: string]: number } = {};
      managers.forEach((manager) => {
        const rank = WEEK_7_RANKINGS[manager.name];
        if (rank) rankings[manager.id] = rank;
      });
      return rankings;
    }
    return {};
  }

  const previousResults = managers.map((manager) => ({
    id: manager.id,
    pollPoints: 0,
  }));

  previousWeekVotes.forEach((vote) => {
    Object.entries(vote.votes).forEach(([position, managerId]) => {
      if (managerId) {
        const result = previousResults.find((r) => r.id === managerId);
        if (result) result.pollPoints += POINTS_MAP[position] || 0;
      }
    });
  });

  const rankings: { [id: string]: number } = {};
  previousResults
    .sort((a, b) => b.pollPoints - a.pollPoints)
    .forEach((result, index) => {
      rankings[result.id] = index + 1;
    });

  return rankings;
};

const calculateTrend = (
  currentRank: number,
  previousRank: number | undefined,
  hasVotes: boolean
) => {
  if (!previousRank || !hasVotes) return "-";

  const change = previousRank - currentRank;
  if (change > 0) return `▲${change}`;  // Up arrow
  if (change < 0) return `▼${Math.abs(change)}`;  // Down arrow
  return "-";
};

const calculatePollResults = async (
  allVotes: PollVote[],
  managers: Manager[],
  teams: Team[],
  currentWeek: number
): Promise<PollResult[]> => {
  const firstPlaceVotes = calculateFirstPlaceVotes(allVotes);
  const previousRankings = await calculatePreviousWeekRankings(
    currentWeek,
    managers
  );
  const hasVotes = allVotes.length > 0;

  const results = managers.map((manager) => {
    const team = teams.find((t) => t.id.toString() === manager.id);
    const firstPlaceCount = firstPlaceVotes[manager.id] || 0;
    const displayName =
      firstPlaceCount > 0
        ? `${manager.name} (${firstPlaceCount})`
        : manager.name;

    return {
      id: manager.id,
      name: displayName,
      record: team ? `${team.wins}-${team.losses}` : "0-0",
      trend: "-",
      pollPoints: 0,
      firstPlaceVotes: firstPlaceCount,
    };
  });

  allVotes.forEach((vote) => {
    Object.entries(vote.votes).forEach(([position, managerId]) => {
      if (managerId) {
        const result = results.find((r) => r.id === managerId);
        if (result) result.pollPoints += POINTS_MAP[position] || 0;
      }
    });
  });

  const sortedResults = results.sort((a, b) => b.pollPoints - a.pollPoints);

  sortedResults.forEach((result, index) => {
    result.trend = calculateTrend(
      index + 1,
      previousRankings[result.id],
      hasVotes
    );
  });

  return sortedResults;
};
