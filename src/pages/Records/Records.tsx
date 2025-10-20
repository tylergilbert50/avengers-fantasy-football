import "./Records.css";

function Records() {
  return (
    <div>
      <div className="container">
        <h2 className="records-top-text">THE HALL OF</h2>
        <h1 className="avengers-text">RECORDS</h1>
        <h2 className="records-bottom-text">
          *HISTORY SHEET HAS MORE IN-DEPTH RECORDS AND STATS
        </h2>
        <div className="records-container">
          <div className="records-card">
            <div className="records-card-title">HIGHEST SCORING WEEK</div>
            <div className="records-card-content">
              <div className="records-header-box">TEAM</div>
              <div className="records-header-box">SCORE</div>
              <div className="records-header-box">OPPONENT/YEAR</div>
              <div className="records-card-box"></div>
              <div className="records-card-box"></div>
              <div className="records-card-box"></div>
              <div className="records-card-box"></div>
              <div className="records-card-box"></div>
              <div className="records-card-box"></div>
              <div className="records-card-box"></div>
              <div className="records-card-box"></div>
              <div className="records-card-box"></div>
              <div className="records-card-box"></div>
              <div className="records-card-box"></div>
              <div className="records-card-box"></div>
              <div className="records-card-box"></div>
              <div className="records-card-box"></div>
              <div className="records-card-box"></div>
            </div>
          </div>
          <div className="records-card">
            <div className="records-card-title">LOWEST SCORING WEEK</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Records;
