import { Link } from "react-router-dom";
import "./DraftHistory.css";

function DraftHistory() {
  const draftPicks = [
    {
      year: "2021",
      position: "RB",
      playerName: "CHRISTIAN MCCAFFREY",
      drafter: "Andrew Casazza",
      imageName: "mccaffrey",
    },
    {
      year: "2022",
      position: "RB",
      playerName: "JONATHAN TAYLOR",
      drafter: "Tyler Gilbert",
      imageName: "taylor",
    },
    {
      year: "2023",
      position: "WR",
      playerName: "JUSTIN JEFFERSON",
      drafter: "Brett Gilbert",
      imageName: "jefferson",
    },
    {
      year: "2024",
      position: "RB",
      playerName: "CHRISTIAN MCCAFFREY",
      drafter: "Tyler Gilbert",
      imageName: "mccaffrey",
    },
    {
      year: "2025",
      position: "WR",
      playerName: "JA'MARR \n CHASE",
      drafter: "Connor Bowser",
      imageName: "chase",
    },
  ];

  return (
    <div className="container">
      <h1 className="avengers-text">DRAFT HISTORY</h1>
      <hr className="dashed-line" />
      <div className="draft-button-wrapper">
        <Link
          to="https://fantasy.espn.com/football/league/draftrecap?leagueId=1268500224&seasonId=2021"
          className="draft-button"
        >
          2021
        </Link>
        <Link
          to="https://fantasy.espn.com/football/league/draftrecap?leagueId=1268500224&seasonId=2022"
          className="draft-button"
        >
          2022
        </Link>
        <Link
          to="https://fantasy.espn.com/football/league/draftrecap?leagueId=1268500224&seasonId=2023"
          className="draft-button"
        >
          2023
        </Link>
        <Link
          to="https://fantasy.espn.com/football/league/draftrecap?leagueId=1268500224&seasonId=2024"
          className="draft-button"
        >
          2024
        </Link>
        <Link
          to="https://fantasy.espn.com/football/league/draftrecap?leagueId=1268500224&seasonId=2025"
          className="draft-button"
        >
          2025
        </Link>
      </div>
      <div className="draft-player-container">
        {draftPicks.map((pick, index) => (
          <div key={index} className="draft-player-card">
            <div className="card-header">
              <div className="card-year">{pick.year}</div>
              <span
                className={`position-badge position-${pick.position.toLowerCase()}`}
              >
                {pick.position}
              </span>
            </div>
            <div className="player-image">
              <img
                src={`/images/players/${pick.imageName}.png`}
                alt={pick.playerName}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
            <div>
              <div className="player-name">{pick.playerName}</div>
              <div className="drafter-name">{pick.drafter}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DraftHistory;
