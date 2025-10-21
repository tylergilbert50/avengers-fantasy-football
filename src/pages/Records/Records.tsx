import "./Records.css";

function Records() {
  const highestScoringWeek = [
    { rank: 1, team: "DANIEL", score: "202.36", opponent: "BRETT, 2023" },
    { rank: 2, team: "DANNY", score: "196.52", opponent: "JOSH, 2023" },
    { rank: 3, team: "DANNY", score: "193.92", opponent: "DEMARCO, 2024" },
    { rank: 4, team: "BRETT", score: "193.80", opponent: "TYLER, 2024" },
    { rank: 5, team: "DANIEL", score: "189.18", opponent: "DANNY, 2024" },
  ];

  const lowestScoringWeek = [
    { rank: 1, team: "ANDREW", score: "42.26", opponent: "DEMARCO, 2023" },
    { rank: 2, team: "DANIEL", score: "58.20", opponent: "BRETT, 2021" },
    { rank: 3, team: "CONNOR", score: "62.70", opponent: "DANNY, 2022" },
    { rank: 4, team: "ANDREW", score: "63.10", opponent: "JEREMY, 2021" },
    { rank: 5, team: "JOSH", score: "63.50", opponent: "DANNY, 2023" },
  ];

  const highestCombinedScore = [
    {
      rank: 1,
      matchup: "DANIEL VS. BRETT",
      score: "202.36 - 167.50",
      year: "2021",
    },
    {
      rank: 2,
      matchup: "BRETT VS. ANDREW",
      score: "178.06 - 174.22",
      year: "2023",
    },
    {
      rank: 3,
      matchup: "DANIEL VS. BRETT",
      score: "174.88 - 162.70",
      year: "2023",
    },
    {
      rank: 4,
      matchup: "CONNOR VS. DREW",
      score: "169.12 - 165.82",
      year: "2021",
    },
    {
      rank: 5,
      matchup: "JOSH VS. DEMARCO",
      score: "166.46 - 163.12",
      year: "2022",
    },
  ];

  const lowestCombinedScore = [
    {
      rank: 1,
      matchup: "DEMARCO VS. ANDREW",
      score: "106.18 - 42.26",
      year: "2023",
    },
    {
      rank: 2,
      matchup: "JEREMY VS. DEMARCO",
      score: "90.42 - 69.30",
      year: "2022",
    },
    {
      rank: 3,
      matchup: "DANNY VS. CONNOR",
      score: "111.40 - 62.70",
      year: "2022",
    },
    {
      rank: 4,
      matchup: "JEREMY VS. DREW",
      score: "113.00 - 65.46",
      year: "2021",
    },
    {
      rank: 5,
      matchup: "DREW VS. JAKE",
      score: "109.06 - 70.10",
      year: "2021",
    },
  ];

  const largestMarginOfVictory = [
    {
      rank: 1,
      matchup: "DANNY VS. JOSH",
      score: "196.52 - 63.50",
      year: "2023",
    },
    {
      rank: 2,
      matchup: "JEREMY VS. ANDREW",
      score: "176.18 - 63.10",
      year: "2021",
    },
    {
      rank: 3,
      matchup: "JOSH VS. DANNY",
      score: "186.50 - 93.98",
      year: "2022",
    },
    {
      rank: 4,
      matchup: "STUART VS. JEREMY",
      score: "186.52 - 96.42",
      year: "2025",
    },
    {
      rank: 5,
      matchup: "DANNY VS DEMARCO",
      score: "161.72 - 74.26",
      year: "2023",
    },
  ];

  const smallestMarginOfVictory = [
    {
      rank: 1,
      matchup: "ANDREW VS. JOSH",
      score: "113.36 - 113.36",
      year: "2021",
    },
    {
      rank: 2,
      matchup: "CONNOR VS. JEREMY",
      score: "132.02 - 132.06",
      year: "2024",
    },
    {
      rank: 3,
      matchup: "CONNOR VS. TRAVIS",
      score: "99.18 - 98.80",
      year: "2021",
    },
    {
      rank: 4,
      matchup: "DANNY VS. DEMARCO",
      score: "143.68 - 142.76",
      year: "2023",
    },
    {
      rank: 5,
      matchup: "CONNOR VS. BRETT",
      score: "135.46 - 134.42",
      year: "2024",
    },
  ];

  const highestSeasonalPoints = [
    { rank: 1, team: "DANNY", ppg: "143.14", points: "2004", year: "2023" },
    { rank: 2, team: "DANIEL", ppg: "140.10", points: "1965.74", year: "2023" },
    { rank: 3, team: "JOSH", ppg: "136.55", points: "1911.68", year: "2022" },
    { rank: 4, team: "DANNY", ppg: "136.20", points: "1906.80", year: "2024" },
    { rank: 5, team: "ANDREW", ppg: "135.39", points: "1895.42", year: "2024" },
  ];

  const lowestSeasonalPoints = [
    { rank: 1, team: "DANIEL", ppg: "104.95", points: "1469.28", year: "2022" },
    { rank: 2, team: "BRETT", ppg: "109.03", points: "1526.38", year: "2022" },
    { rank: 3, team: "JAKE", ppg: "110.92", points: "1552.88", year: "2022" },
    { rank: 4, team: "STUART", ppg: "111.68", points: "1563.6", year: "2024" },
    { rank: 5, team: "TRAVIS", ppg: "113.27", points: "1585.74", year: "2022" },
  ];

  const highestPointsAgainst = [
    { rank: 1, team: "BRETT", papg: "138.91", points: "1944.70", year: "2023" },
    {
      rank: 2,
      team: "CONNOR",
      papg: "133.90",
      points: "1874.62",
      year: "2021",
    },
    {
      rank: 3,
      team: "DANIEL",
      papg: "132.84",
      points: "1859.78",
      year: "2023",
    },
    { rank: 4, team: "BRETT", papg: "132.01", points: "1848.16", year: "2022" },
    { rank: 5, team: "TYLER", papg: "131.19", points: "1836.66", year: "2024" },
  ];

  const lowestPointsAgainst = [
    { rank: 1, team: "JOSH", papg: "108.98", points: "1525.78", year: "2022" },
    { rank: 2, team: "JAKE", papg: "110.04", points: "1540.56", year: "2021" },
    { rank: 3, team: "DANNY", papg: "110.59", points: "1548.22", year: "2023" },
    {
      rank: 4,
      team: "JEREMY",
      papg: "112.30",
      points: "1569.72",
      year: "2022",
    },
    {
      rank: 5,
      team: "CONNOR",
      papg: "112.30",
      points: "1572.18",
      year: "2022",
    },
  ];

  const longestWinningStreaks = [
    { rank: 1, team: "DANNY", games: "11", span: "W15 2022 - W12 2023" },
    { rank: 2, team: "CONNOR", games: "9", span: "W11 2021 - W2 2022" },
    { rank: 3, team: "CONNOR", games: "8", span: "W4 2022 - W11 2022" },
    { rank: 4, team: "JOSH", games: "8", span: "W8 2022 - W11 2022" },
    { rank: 5, team: "DANNY", games: "8", span: "W1 2024 - W8 2024" },
  ];

  const longestLosingStreaks = [
    { rank: 1, team: "BRETT", games: "11", span: "W11 2022 - W7 2023" },
    { rank: 2, team: "ANDREW", games: "9", span: "W7 2022 - W15 2022" },
    { rank: 3, team: "JAKE", games: "7", span: "W17 2021 - W6 2022" },
    { rank: 4, team: "JOSH", games: "6", span: "W2 2021 - W7 2021" },
    { rank: 5, team: "JEREMY", games: "6", span: "W12 2012 - W1 2022" },
  ];

  const renderCard = (title, headers, data, type) => {
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
            highestScoringWeek,
            "simple"
          )}
          {renderCard(
            "LOWEST SCORING WEEK",
            ["TEAM", "SCORE", "OPPONENT/YEAR"],
            lowestScoringWeek,
            "simple"
          )}
          {renderCard(
            "HIGHEST COMBINED SCORE",
            ["WINNER VS. LOSER", "SCORE", "YEAR"],
            highestCombinedScore,
            "matchup"
          )}
          {renderCard(
            "LOWEST COMBINED SCORE",
            ["WINNER VS. LOSER", "SCORE", "YEAR"],
            lowestCombinedScore,
            "matchup"
          )}
          {renderCard(
            "LARGEST MARGIN OF VICTORY",
            ["WINNER VS. LOSER", "SCORE", "YEAR"],
            largestMarginOfVictory,
            "matchup"
          )}
          {renderCard(
            "SMALLEST MARGIN OF VICTORY",
            ["WINNER VS. LOSER", "SCORE", "YEAR"],
            smallestMarginOfVictory,
            "matchup"
          )}
          {renderCard(
            "HIGHEST SEASONAL POINTS TOTAL",
            ["TEAM", "PPG", "POINTS", "YEAR"],
            highestSeasonalPoints,
            "seasonal"
          )}
          {renderCard(
            "LOWEST SEASONAL POINTS TOTAL",
            ["TEAM", "PPG", "POINTS", "YEAR"],
            lowestSeasonalPoints,
            "seasonal"
          )}
          {renderCard(
            "HIGHEST SEASONAL POINTS AGAINST TOTAL",
            ["TEAM", "PAPG", "PTS AGAINST", "YEAR"],
            highestPointsAgainst,
            "seasonal"
          )}
          {renderCard(
            "LOWEST SEASONAL POINTS AGAINST TOTAL",
            ["TEAM", "PAPG", "PTS AGAINST", "YEAR"],
            lowestPointsAgainst,
            "seasonal"
          )}
          {renderCard(
            "LONGEST WINNING STREAKS",
            ["TEAM", "GAMES", "SPAN"],
            longestWinningStreaks,
            "streak"
          )}
          {renderCard(
            "LONGEST LOSING STREAKS",
            ["TEAM", "GAMES", "SPAN"],
            longestLosingStreaks,
            "streak"
          )}
        </div>
      </div>
    </div>
  );
}

export default Records;