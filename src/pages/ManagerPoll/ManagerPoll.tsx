import { useState } from "react";
import {
  useCurrentSeason,
  useStandings,
} from "../home/components/Standings/standingss";
import "./ManagerPoll.css";
import {
  usePollData,
  getUserId,
  getCurrentWeek,
  shouldShowResults,
  type PollResult,
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

function ManagerPoll() {
  const { year } = useCurrentSeason(LEAGUE_ID);
  const teams = useStandings(LEAGUE_ID, year);
  const currentWeek = getCurrentWeek();
  const [userId] = useState(getUserId);
  const [showResults, setShowResults] = useState(shouldShowResults());

  const {
    votes,
    hasSubmitted,
    pollResults,
    managers,
    handleVote,
    handleSubmit,
  } = usePollData(userId, currentWeek, teams);

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
    if (pollResults.length === 0) return <div>Loading results...</div>;

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
              {pollResults.map((result: PollResult, index: number) => {
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
        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <button
            onClick={() => setShowResults(false)}
            style={{ padding: "10px 20px", fontSize: "16px" }}
          >
            Back to Poll
          </button>
        </div>
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
            {POSITIONS.map((position) => (
              <span key={position}>{position}</span>
            ))}
          </div>
          <div className="poll-card-content">
            {managers.map((manager) => (
              <div key={manager.id} className="poll-card">
                <span className="manager-poll-name">{manager.name}</span>
                {POSITIONS.map((position) => (
                  <div key={`${manager.id}-${position}`} className="vote-cell">
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
            ))}

            <div className="poll-card not-selected">
              <span className="manager-poll-name">Not selected</span>
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
