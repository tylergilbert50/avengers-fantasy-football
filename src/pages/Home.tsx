function Home() {
  return (
    <div>
      <h2 className="quote-text">"There was an idea..."</h2>
      <h1 className="avengers-text">
        AVENGERS FANTASY <br />
        FOOTBALL LEAGUE
      </h1>
      <hr className="dashed-line" />

      <div className="image-button-container">
        <a href="/standings" className="image-button">
          <img src="/images/standings.avif" />
        </a>
        <a href="/managers" className="image-button">
          <img src="/images/managers.avif" />
        </a>
        <a href="/managers" className="image-button">
          <img src="/images/champions.avif" />
        </a>
        <a href="/managers" className="image-button">
          <img src="/images/draft-history.avif" />
        </a>
      </div>
    </div>
  );
}

export default Home;
