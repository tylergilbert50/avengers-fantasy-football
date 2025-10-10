import { useCurrentSeason, useTopTeams } from "./TopTeam";
import "./TopTeam.css";

function TopTeam() {
  const LEAGUE_ID = "1268500224";
  const { year } = useCurrentSeason(LEAGUE_ID);
  const weeks = useTopTeams(LEAGUE_ID, year);

  return (
    <div className="top-team-wrapper">
      <div className="top-team">
        <div className="top-team-content">
          <div className="top-team-title">TOP TEAM OF THE WEEK</div>
          <div className="top-team-grid">
            {weeks.map((week) => (
              <div key={week.week} className="top-team-card">
                <div className="top-team-week">WEEK {week.week}</div>
                <div className="top-team-card-inner">
                  {week.score && (
                    <>
                      <div className="top-team-score">{week.score}</div>
                      <img
                        src={week.image}
                        alt={week.name}
                        className="top-team-image"
                      />
                      <div className="top-team-name">{week.name}</div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TopTeam;
