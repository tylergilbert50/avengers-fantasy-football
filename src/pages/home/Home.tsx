import MenuButtons from "./components/MenuButtons/MenuButtons";
import ManagerButtons from "./components/ManagerButtons/ManagerButtons";
import Standings from "./components/Standings/standings";
import TopTeam from "./components/TopTeam/TopTeam";
import "./home.css";

function Home() {
  return (
    <div className="container">
      <h2 className="quote-text">"There was an idea..."</h2>
      <h1 className="avengers-text">
        AVENGERS FANTASY <br />
        FOOTBALL LEAGUE
      </h1>

      <hr className="dashed-line" />

      <MenuButtons />

      <hr className="dashed-line" />

      <h1 className="avengers-text">MANAGERS</h1>

      <ManagerButtons />
      <Standings />
      <TopTeam />
    </div>
  );
}

export default Home;
