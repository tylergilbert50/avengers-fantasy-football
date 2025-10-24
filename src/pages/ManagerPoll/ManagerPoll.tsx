import { useState, useMemo, useEffect, useCallback } from "react";
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
  const userId = useMemo(() => getUserId(), []);
  const [showResults] = useState(shouldShowResults());

  // Seed immediate UI with placeholder managers
  const [managers, setManagers] = useState<Manager[]>(
    DEFAULT_MANAGERS.map((name, idx) => ({
      id: `temp_${idx}`,
      name,
    }))
  );

  // Immediate blank UI state
  const [votes, setVotes] = useState(getEmptyVotes());
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [pollResults, setPollResults] = useState<PollResult[]>([]);
  const [pollDataReady, setPollDataReady] = useState(false);

  // Kick off poll data fetch (standings are passed for enrichment, but the hook shouldn't block on them)
  const pollData = usePollData(userId, currentWeek, teams || []);

  // Destructure to keep effect deps stable (avoids re-running from object identity churn)
  const {
    managers: pdManagers,
    votes: pdVotes,
    hasSubmitted: pdHasSubmitted,
    pollResults: pdPollResults,
    handleVote: pdHandleVote,
    handleSubmit: pdHandleSubmit,
  } = pollData;

  // Once teams arrive (and before pollData is ready), hydrate managers exactly once
  useEffect(() => {
    if (!teams || teams.length === 0) return;
    if (pdManagers.length > 0) return;

    const realManagers = teams
      .map((team: any) => ({ id: String(team.id), name: team.name }))
      .sort((a: Manager, b: Manager) => a.name.localeCompare(b.name));

    setManagers(realManagers);
  }, [teams, pdManagers.length]);

  // When poll data becomes ready, replace local placeholders with real data
  useEffect(() => {
    if (pdManagers.length === 0) return;

    setManagers(pdManagers);
    setVotes(pdVotes);
    setHasSubmitted(pdHasSubmitted);
    setPollResults(pdPollResults);
    setPollDataReady(true);
  }, [pdManagers, pdVotes, pdHasSubmitted, pdPollResults]);

  // Stable hot-path predicates & handlers to avoid rebinds on every render
  const isManagerSelected = useCallback(
    (managerId: string, position: string) => votes[position] === managerId,
    [votes]
  );

  const isManagerVotedElsewhere = useCallback(
    (managerId: string, currentPosition: string) =>
      Object.entries(votes).some(
        ([pos, votedManagerId]) =>
          pos !== currentPosition && votedManagerId === managerId
      ),
    [votes]
  );

  const isVoteDisabled = useCallback(
    (managerId: string, position: string) =>
      isManagerVotedElsewhere(managerId, position) ||
      hasSubmitted ||
      (votes[position] !== null && votes[position] !== managerId),
    [hasSubmitted, votes, isManagerVotedElsewhere]
  );

  const handleVote = useCallback(
    (managerId: string, position: string) => {
      if (hasSubmitted) return;

      if (pollDataReady) {
        pdHandleVote(managerId, position);
      } else {
        // Local optimistic update before poll data is ready
        setVotes((prev) => {
          const next = { ...prev };

          // Toggle off if same pick
          if (prev[position] === managerId) {
            next[position] = null;
            return next;
          }

          // Block if trying to replace a different manager in a filled position
          if (prev[position] !== null && prev[position] !== managerId) {
            return prev;
          }

          // Ensure a manager isn't picked twice
          Object.keys(next).forEach((pos) => {
            if (next[pos] === managerId) next[pos] = null;
          });

          // Commit new pick
          next[position] = managerId;
          return next;
        });
      }
    },
    [hasSubmitted, pollDataReady, pdHandleVote]
  );

  const handleSubmit = useCallback(() => {
    if (pollDataReady) {
      pdHandleSubmit();
    } else {
      alert("Please wait for the poll to fully load before submitting.");
    }
  }, [pollDataReady, pdHandleSubmit]);

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

  const renderResults = () => {
    const resultsToShow =
      pollResults.length > 0
        ? pollResults
        : managers.map((m) => ({
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
                const trendClass = result.trend.includes("â–²")
                  ? "trend-up"
                  : result.trend.includes("â–¼")
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

  return (
    <div className="poll-wrapper">
      <div className="poll">
        <div className="poll-content">
          <div className="poll-title">WEEK {currentWeek}</div>

          <div className="poll-header">
            <span></span>
            <span className="custom-col-header">RECORD</span>
            <span className="custom-col-header avgpf-col">
              <span className="avgpf-label">AVG PF</span>
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
                  <span className="avgpf-col">
                    <span className="avgpf-value">{stats.avgPf}</span>
                  </span>

                  {POSITIONS.map((position) => (
                    <div
                      key={`${manager.id}-${position}`}
                      className="vote-cell"
                    >
                      <button
                        aria-label={`Vote ${manager.name} for ${position}`}
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
              <span className="avgpf-col"></span>
              {POSITIONS.map((position) => (
                <div key={`not-selected-${position}`} className="vote-cell">
                  <button
                    aria-label={`Clear pick for ${position}`}
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
