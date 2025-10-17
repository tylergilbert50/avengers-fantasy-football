import {
  useCurrentSeason,
  useStandings,
} from "../../../hooks/useFantasyLeague";
import "./standings.css";

function Standings() {
  const LEAGUE_ID = "1268500224";
  const { year } = useCurrentSeason(LEAGUE_ID);
  const teams = useStandings(LEAGUE_ID, year);

  const wildcardTeamId =
    teams.length > 5
      ? teams
          .slice(5)
          .reduce((max, team) => (team.pointsFor > max.pointsFor ? team : max))
          .id
      : null;

  return (
    <div className="standings-wrapper">
      <div className="standings">
        <div className="standings-content">
          <div className="standings-title">{year} STANDINGS</div>
          <div className="standings-header">
            <span></span>
            <span>TEAM</span>
            <span>RECORD</span>
            <span>AVG PF</span>
            <span>AVG PA</span>
          </div>
          <div className="standings-card-content">
            {teams.map((team, index) => {
              const isTop5 = index < 5;
              const isWildcard = team.id === wildcardTeamId;

              return (
                <div key={team.id} className="standings-card">
                  <div
                    className={`standings-rank ${isTop5 ? "top-5" : ""} ${
                      isWildcard ? "wildcard" : ""
                    }`}
                  >
                    {index + 1}
                  </div>
                  <span>{team.name}</span>
                  <span>
                    {team.wins}-{team.losses}
                    {team.ties > 0 ? `-${team.ties}` : ""}
                  </span>
                  <span>
                    {team.gamesPlayed > 0
                      ? (team.pointsFor / team.gamesPlayed).toFixed(2)
                      : "0.00"}
                  </span>
                  <span>
                    {team.gamesPlayed > 0
                      ? (team.pointsAgainst / team.gamesPlayed).toFixed(2)
                      : "0.00"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Standings;
