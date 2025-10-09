import ManagerButtons from "./components/Manager Buttons/ManagerButtons";
import MenuButtons from "./components/MenuButtons/MenuButtons";
import Standings from "./components/Standings/standings";
import "./home.css";

function Home() {
  return (
    <div className="main-container">
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
    </div>
  );
}

export default Home;
