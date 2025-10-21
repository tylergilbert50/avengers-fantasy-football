import "./Records.css";
import { useRecordsData } from "./Records";

interface RecordData {
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

type RecordType = "simple" | "matchup" | "seasonal" | "streak";

const LEAGUE_ID = "1268500224";

function Records() {
  const { records } = useRecordsData(LEAGUE_ID);

  const renderCard = (
    title: string,
    headers: string[],
    data: RecordData[],
    type: RecordType
  ) => {
    return (
      <div className="records-card">
        <div className="records-card-title">{title}</div>
        <div className="records-card-content">
          {headers.map((header, idx) => (
            <div key={`header-${idx}`} className="records-header-box">
              {header}
            </div>
          ))}
          {data.map((record, index) => (
            <>
              {type === "simple" && (
                <>
                  <div key={`name-${index}`} className="records-card-box">
                    <span className="records-rank-inline">{record.rank}</span>
                    {record.team}
                  </div>
                  <div
                    key={`value-${index}`}
                    className="records-card-box records-score-with-logo"
                  >
                    <span>
                      {record.score ||
                        record.ppg ||
                        record.papg ||
                        record.games}
                    </span>
                    <img
                      src="/images/espn.png"
                      alt="ESPN"
                      className="espn-logo"
                    />
                  </div>
                  <div
                    key={`detail-${index}`}
                    className="records-card-box records-opponent"
                  >
                    {record.opponent}
                  </div>
                </>
              )}
              {type === "matchup" && (
                <>
                  <div
                    key={`matchup-${index}`}
                    className="records-card-box records-matchup"
                  >
                    <span className="records-rank-inline">{record.rank}</span>
                    {record.matchup}
                  </div>
                  <div
                    key={`score-${index}`}
                    className="records-card-box records-score-with-logo"
                  >
                    <span>{record.score}</span>
                    <img
                      src="/images/espn.png"
                      alt="ESPN"
                      className="espn-logo"
                    />
                  </div>
                  <div
                    key={`year-${index}`}
                    className="records-card-box records-year"
                  >
                    {record.year}
                  </div>
                </>
              )}
              {type === "seasonal" && (
                <>
                  <div key={`team-${index}`} className="records-card-box">
                    <span className="records-rank-inline">{record.rank}</span>
                    {record.team}
                  </div>
                  <div key={`ppg-${index}`} className="records-card-box">
                    <span>{record.ppg || record.papg}</span>
                  </div>
                  <div key={`points-${index}`} className="records-card-box">
                    <span>{record.points}</span>
                  </div>
                  <div
                    key={`year-${index}`}
                    className="records-card-box records-year"
                  >
                    {record.year}
                  </div>
                </>
              )}
              {type === "streak" && (
                <>
                  <div key={`team-${index}`} className="records-card-box">
                    <span className="records-rank-inline">{record.rank}</span>
                    {record.team}
                  </div>
                  <div key={`games-${index}`} className="records-card-box">
                    <span>{record.games}</span>
                  </div>
                  <div
                    key={`span-${index}`}
                    className="records-card-box records-span"
                  >
                    {record.span}
                  </div>
                </>
              )}
            </>
          ))}
        </div>
      </div>
    );
  };

  // Use empty arrays as fallback if loading or no data
  const safeRecords = records || {
    highestScoringWeek: [],
    lowestScoringWeek: [],
    highestCombinedScore: [],
    lowestCombinedScore: [],
    largestMarginOfVictory: [],
    smallestMarginOfVictory: [],
    highestSeasonalPoints: [],
    lowestSeasonalPoints: [],
    highestPointsAgainst: [],
    lowestPointsAgainst: [],
    longestWinningStreaks: [],
    longestLosingStreaks: [],
  };

  return (
    <div>
      <div className="container">
        <h2 className="records-top-text">THE HALL OF</h2>
        <h1 className="avengers-text">RECORDS</h1>
        <h2 className="records-bottom-text">
          *HISTORY SHEET HAS MORE IN-DEPTH RECORDS AND STATS
        </h2>
        <div className="records-container">
          {renderCard(
            "HIGHEST SCORING WEEK",
            ["TEAM", "SCORE", "OPPONENT/YEAR"],
            safeRecords.highestScoringWeek,
            "simple"
          )}
          {renderCard(
            "LOWEST SCORING WEEK",
            ["TEAM", "SCORE", "OPPONENT/YEAR"],
            safeRecords.lowestScoringWeek,
            "simple"
          )}
          {renderCard(
            "HIGHEST COMBINED SCORE",
            ["WINNER VS. LOSER", "SCORE", "YEAR"],
            safeRecords.highestCombinedScore,
            "matchup"
          )}
          {renderCard(
            "LOWEST COMBINED SCORE",
            ["WINNER VS. LOSER", "SCORE", "YEAR"],
            safeRecords.lowestCombinedScore,
            "matchup"
          )}
          {renderCard(
            "LARGEST MARGIN OF VICTORY",
            ["WINNER VS. LOSER", "SCORE", "YEAR"],
            safeRecords.largestMarginOfVictory,
            "matchup"
          )}
          {renderCard(
            "SMALLEST MARGIN OF VICTORY",
            ["WINNER VS. LOSER", "SCORE", "YEAR"],
            safeRecords.smallestMarginOfVictory,
            "matchup"
          )}
          {renderCard(
            "HIGHEST SEASONAL POINTS TOTAL",
            ["TEAM", "PPG", "POINTS", "YEAR"],
            safeRecords.highestSeasonalPoints,
            "seasonal"
          )}
          {renderCard(
            "LOWEST SEASONAL POINTS TOTAL",
            ["TEAM", "PPG", "POINTS", "YEAR"],
            safeRecords.lowestSeasonalPoints,
            "seasonal"
          )}
          {renderCard(
            "HIGHEST SEASONAL POINTS AGAINST TOTAL",
            ["TEAM", "PAPG", "PTS AGAINST", "YEAR"],
            safeRecords.highestPointsAgainst,
            "seasonal"
          )}
          {renderCard(
            "LOWEST SEASONAL POINTS AGAINST TOTAL",
            ["TEAM", "PAPG", "PTS AGAINST", "YEAR"],
            safeRecords.lowestPointsAgainst,
            "seasonal"
          )}
          {renderCard(
            "LONGEST WINNING STREAKS",
            ["TEAM", "GAMES", "SPAN"],
            safeRecords.longestWinningStreaks,
            "streak"
          )}
          {renderCard(
            "LONGEST LOSING STREAKS",
            ["TEAM", "GAMES", "SPAN"],
            safeRecords.longestLosingStreaks,
            "streak"
          )}
        </div>
      </div>
    </div>
  );
}

export default Records;
