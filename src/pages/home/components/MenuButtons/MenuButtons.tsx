import { Link } from "react-router-dom";
import "./MenuButtons.css";

function MenuButtons() {
  return (
    <div className="menu-button-wrapper">
      <Link to="/standings" className="menu-button">
        <img src="/images/buttons/standings.avif" />
      </Link>
      <Link to="/managers" className="menu-button">
        <img src="/images/buttons/managers.avif" />
      </Link>
      <Link to="/champions" className="menu-button">
        <img src="/images/buttons/champions.avif" />
      </Link>
      <Link to="/draft-history" className="menu-button">
        <img src="/images/buttons/draft-history.avif" />
      </Link>
      <Link to="/records" className="menu-button">
        <img src="/images/buttons/records.avif" />
      </Link>
      <Link to="/manager-poll" className="menu-button">
        <img src="/images/buttons/manager-poll.avif" />
      </Link>
      <Link to="/schedule" className="menu-button">
        <img src="/images/buttons/schedule.avif" />
      </Link>
      <a
        href="https://docs.google.com/spreadsheets/d/1QygMGu_XW0hOnu2AId1ClXWijLGTmEFlsWs-ZHqf_ho/edit?usp=sharing"
        className="menu-button"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img src="/images/buttons/history.avif" />
      </a>
      <Link to="/trade-history" className="menu-button">
        <img src="/images/buttons/trade-history.avif" />
      </Link>
      <Link to="/waiver-history" className="menu-button">
        <img src="/images/buttons/waiver-history.avif" />
      </Link>
    </div>
  );
}

export default MenuButtons;
