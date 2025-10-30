import "./Champions.css";

function Champions() {
  return (
    <div className="container">
      <h1 className="avengers-text">2024 CHAMPION</h1>
      <div className="champion-card-mobile-wrapper">
        <div className="champion-card">
          <div className="left-box">
            <img src="./images/hammer.png" className="hammer-logo" />
          </div>

          <div className="middle-box">
            <img
              src="./images/managers/connor.png"
              alt="Connor"
              className="manager-image"
            />
            <div className="manager-name">CONNOR</div>
          </div>

          <div className="right-box">
            <div className="statistics-box">
              <div className="statistics-title">Statistics</div>

              <div className="stat-item">
                <div className="stat-label">RECORD</div>
                <div className="stat-divider"></div>
                <div className="stat-value">7-7</div>
              </div>

              <div className="stat-item">
                <div className="stat-label">POINTS PER WEEK</div>
                <div className="stat-divider"></div>
                <div className="stat-value">123.28</div>
              </div>
            </div>
          </div>

          <div className="confetti-container">
            <img
              src="./images/confetti.gif"
              alt="Confetti Left"
              className="confetti-overlay confetti-left"
            />
            <img
              src="./images/confetti.gif"
              alt="Confetti Right"
              className="confetti-overlay confetti-right"
            />
          </div>
        </div>
      </div>
      <h1 className="avengers-bottom-text">PAST CHAMPIONS</h1>

      <div className="banners-container">
        <div className="championship-banner">
          <div className="banner-year">2021</div>
          <div className="banner-champion-text">Champion</div>
          <div className="banner-team-name">CAPTAIN KAMARICA</div>
          <div className="banner-manager-name">Connor Bowser</div>
          <img
            src="./images/avengers.png"
            className="banner-logo"
            alt="Avengers Logo"
          />
        </div>

        <div className="championship-banner">
          <div className="banner-year">2022</div>
          <div className="banner-champion-text">Champion</div>
          <div className="banner-team-name">A FRIEND FROM WORK</div>
          <div className="banner-manager-name">Danny Stiles</div>
          <img
            src="./images/avengers.png"
            className="banner-logo"
            alt="Avengers Logo"
          />
        </div>

        <div className="championship-banner">
          <div className="banner-year">2023</div>
          <div className="banner-champion-text">Champion</div>
          <div className="banner-team-name">I CAN DO THIS ALL DAY</div>
          <div className="banner-manager-name">Daniel Dixon</div>
          <img
            src="./images/avengers.png"
            className="banner-logo"
            alt="Avengers Logo"
          />
        </div>

        <div className="championship-banner">
          <div className="banner-year">2024</div>
          <div className="banner-champion-text">Champion</div>
          <div className="banner-team-name">MARVEL JESUS</div>
          <div className="banner-manager-name">Connor Bowser</div>
          <img
            src="./images/avengers.png"
            className="banner-logo"
            alt="Avengers Logo"
          />
        </div>
      </div>
    </div>
  );
}

export default Champions;
