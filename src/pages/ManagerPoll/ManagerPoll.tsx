import { useState, useMemo, useEffect } from "react";
import { useCurrentSeason, useStandings } from "../hooks/useFantasyLeague";
import "./ManagerPoll.css";
import {
  usePollData,
  getUserId,
  getCurrentWeek,
  shouldShowResults,
  type PollResult,
  type Manager,
  getEmptyVotes,
} from "./ManagerPoll";

const LEAGUE_ID = "1268500224";
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

// Default team names to show immediately
const DEFAULT_MANAGERS = [
  "Andrew Casazza",
  "Brett Gilbert",
  "Connor Bowser",
  "Daniel Dixon",
  "Danny Stiles",
  "Demarco Moore",
  "Jeremy Stojakovich",
  "Josh Hartless",
  "Stuart Iverson",
  "Tyler Gilbert",
].sort();

function ManagerPoll() {
  const { year } = useCurrentSeason(LEAGUE_ID);
  const teams = useStandings(LEAGUE_ID, year);
  const currentWeek = getCurrentWeek();
  const [userId] = useState(getUserId);
  const [showResults] = useState(shouldShowResults());

  // Use default managers initially to render immediately
  const [managers, setManagers] = useState<Manager[]>(
    DEFAULT_MANAGERS.map((name, idx) => ({
      id: `temp_${idx}`,
      name,
    }))
  );

  // Initialize with empty state to render immediately
  const [votes, setVotes] = useState(getEmptyVotes());
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [pollResults, setPollResults] = useState<PollResult[]>([]);
  const [pollDataReady, setPollDataReady] = useState(false);

  // Get real poll data
  const pollData = usePollData(userId, currentWeek, teams || []);

  // Update managers when teams data arrives
  useEffect(() => {
    if (teams && teams.length > 0) {
      const realManagers = teams
        .map((team) => ({
          id: team.id.toString(),
          name: team.name,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setManagers(realManagers);
    }
  }, [teams]);

  // Update poll data when it's ready
  useEffect(() => {
    if (pollData.managers.length > 0) {
      setManagers(pollData.managers);
      setVotes(pollData.votes);
      setHasSubmitted(pollData.hasSubmitted);
      setPollResults(pollData.pollResults);
      setPollDataReady(true);
    }
  }, [
    pollData.managers,
    pollData.votes,
    pollData.hasSubmitted,
    pollData.pollResults,
  ]);

  const handleVote = (managerId: string, position: string) => {
    if (hasSubmitted) return;

    if (pollDataReady) {
      pollData.handleVote(managerId, position);
    } else {
      // Local optimistic update before poll data is ready
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
    }
  };

  const handleSubmit = () => {
    if (pollDataReady) {
      pollData.handleSubmit();
    } else {
      alert("Please wait for the poll to fully load before submitting.");
    }
  };

  const isManagerSelected = (managerId: string, position: string) =>
    votes[position] === managerId;

  const isManagerVotedElsewhere = (
    managerId: string,
    currentPosition: string
  ) =>
    Object.entries(votes).some(
      ([pos, votedManagerId]) =>
        pos !== currentPosition && votedManagerId === managerId
    );

  const isVoteDisabled = (managerId: string, position: string) =>
    isManagerVotedElsewhere(managerId, position) ||
    hasSubmitted ||
    (votes[position] !== null && votes[position] !== managerId);

  const renderResults = () => {
    // Show placeholder results if data isn't ready yet
    const resultsToShow =
      pollResults.length > 0
        ? pollResults
        : managers.map((m, idx) => ({
            id: m.id,
            name: m.name,
            record: "0-0",
            trend: "-",
            pollPoints: 0,
            firstPlaceVotes: 0,
          }));

    return (
      <div className="poll-wrapper">
        <div className="poll">
          <div className="poll-content">
            <div className="results-title">WEEK {currentWeek} POLL RESULTS</div>
            <div className="results-header">
              <span></span>
              <span className="team-header">TEAM</span>
              <span className="record-header">RECORD</span>
              <span className="trend-header">TREND</span>
              <span className="points-header">POLL PTS</span>
            </div>
            <div className="results-content">
              {resultsToShow.map((result: PollResult, index: number) => {
                const trendClass = result.trend.includes("▲")
                  ? "trend-up"
                  : result.trend.includes("▼")
                  ? "trend-down"
                  : "trend-same";

                return (
                  <div key={result.id} className="result-card">
                    <div className={`rank-circle ${index < 5 ? "top-5" : ""}`}>
                      {index + 1}
                    </div>
                    <span className="result-name">{result.name}</span>
                    <span className="result-record">{result.record}</span>
                    <span className={`result-trend ${trendClass}`}>
                      {result.trend}
                    </span>
                    <span className="result-points">{result.pollPoints}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (showResults) {
    return (
      <div>
        {renderResults()}
        <div style={{ textAlign: "center", marginTop: "20px" }}></div>
      </div>
    );
  }

  // Build stats lookup from standings
  const teamStatsByManager = useMemo(() => {
    const get = (t: any, ...keys: string[]) =>
      keys.reduce((v, k) => (v ??= t?.[k]), undefined);
    const map = new Map<
      string,
      { record: string; avgPf: string; avgPa: string }
    >();
    (teams ?? []).forEach((t: any) => {
      const wins = get(t, "wins", "w") ?? 0;
      const losses = get(t, "losses", "l") ?? 0;
      const gp = Math.max(Number(wins) + Number(losses), 1);
      const pfTotal = get(t, "points_for", "pf", "pointsFor", "fpts") ?? 0;
      const paTotal =
        get(t, "points_against", "pa", "pointsAgainst", "fpts_against") ?? 0;
      const avgPf = (Number(pfTotal) / gp).toFixed(1);
      const avgPa = (Number(paTotal) / gp).toFixed(1);
      const owner =
        get(t, "owner", "owner_id", "user", "owner.display_name") ??
        get(t, "display_name", "team_name", "name") ??
        "";
      const norm = (s: string) => String(s).trim().toLowerCase();
      [owner, get(t, "display_name"), get(t, "team_name"), get(t, "name")]
        .filter((s): s is string => typeof s === "string" && !!s)
        .map((s) => norm(s))
        .forEach((k: string) => {
          if (!map.has(k))
            map.set(k, { record: `${wins}-${losses}`, avgPf, avgPa });
        });
    });
    return map;
  }, [teams]);

  return (
    <div className="poll-wrapper">
      <div className="poll">
        <div className="poll-content">
          <div className="poll-title">WEEK {currentWeek}</div>
          <div className="poll-header">
            <span></span>
            <span className="custom-col-header">RECORD</span>
            <span className="custom-col-header avgpfpa-col">
              <span className="avgpfpa-label">AVG PF</span>
              <span className="avgpfpa-label">AVG PA</span>
            </span>
            {POSITIONS.map((position) => (
              <span key={position}>{position}</span>
            ))}
          </div>
          <div className="poll-card-content">
            {managers.map((manager) => {
              const norm = (s: string) => String(s).trim().toLowerCase();
              const stats = teamStatsByManager.get(norm(manager.name)) ?? {
                record: "-",
                avgPf: "-",
                avgPa: "-",
              };
              return (
                <div key={manager.id} className="poll-card">
                  <span className="manager-poll-name">{manager.name}</span>
                  <span className="custom-col">{stats.record}</span>
                  <span className="avgpfpa-col">
                    <span className="avgpfpa-value">{stats.avgPf}</span>
                    <span className="avgpfpa-value">{stats.avgPa}</span>
                  </span>
                  {POSITIONS.map((position) => (
                    <div
                      key={`${manager.id}-${position}`}
                      className="vote-cell"
                    >
                      <button
                        className={`vote-button ${
                          isManagerSelected(manager.id, position)
                            ? "selected"
                            : ""
                        } ${
                          isVoteDisabled(manager.id, position) ? "disabled" : ""
                        }`}
                        onClick={() => handleVote(manager.id, position)}
                        disabled={isVoteDisabled(manager.id, position)}
                      >
                        <div className="vote-circle"></div>
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}

            <div className="poll-card not-selected">
              <span className="manager-poll-name">Not selected</span>
              <span className="custom-col"></span>
              <span className="avgpfpa-col"></span>
              {POSITIONS.map((position) => (
                <div key={`not-selected-${position}`} className="vote-cell">
                  <button
                    className={`vote-button ${
                      votes[position] === null ? "selected" : ""
                    } ${hasSubmitted ? "disabled" : ""}`}
                    onClick={() => handleVote("", position)}
                    disabled={hasSubmitted}
                  >
                    <div className="vote-circle"></div>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            className={`submit-button ${hasSubmitted ? "disabled" : ""}`}
            onClick={handleSubmit}
            disabled={hasSubmitted}
          >
            {hasSubmitted ? "ALREADY SUBMITTED" : "SUBMIT"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ManagerPoll;
