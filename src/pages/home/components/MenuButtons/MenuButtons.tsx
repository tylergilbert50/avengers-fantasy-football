import "./MenuButtons.css";

function MenuButtons() {
  return (
    <div className="menu-button-wrapper">
      <a href="/standings" className="menu-button">
        <img src="/images/buttons/standings.avif" />
      </a>
      <a href="/managers" className="menu-button">
        <img src="/images/buttons/managers.avif" />
      </a>
      <a href="/champions" className="menu-button">
        <img src="/images/buttons/champions.avif" />
      </a>
      <a href="/draft-history" className="menu-button">
        <img src="/images/buttons/draft-history.avif" />
      </a>
      <a href="/records" className="menu-button">
        <img src="/images/buttons/records.avif" />
      </a>
      <a href="/manager-poll" className="menu-button">
        <img src="/images/buttons/manager-poll.avif" />
      </a>
      <a href="/schedule" className="menu-button">
        <img src="/images/buttons/schedule.avif" />
      </a>
      <a href="/history" className="menu-button">
        <img src="/images/buttons/history.avif" />
      </a>
      <a href="/trade-history" className="menu-button">
        <img src="/images/buttons/trade-history.avif" />
      </a>
      <a href="/waiver-history" className="menu-button">
        <img src="/images/buttons/waiver-history.avif" />
      </a>
    </div>
  );
}

export default MenuButtons;
