import { Link } from "react-router-dom";
import "./Managers.css";

function Managers() {
  return (
    <div className="container">
      <h1 className="avengers-text">MANAGERS</h1>
      <hr className="dashed-line" />
      <div className="manager-buttons-wrapper">
        <div className="manager-item">
          <img src="/images/managers/andrew.avif" />
          <Link to="/andrew" className="manager-button">
            ANDREW
          </Link>
        </div>
        <div className="manager-item">
          <img src="/images/managers/brett.avif" />
          <Link to="/brett" className="manager-button">
            BRETT
          </Link>
        </div>
        <div className="manager-item">
          <img src="/images/managers/connor.png" />
          <Link to="/connor" className="manager-button">
            CONNOR
          </Link>
        </div>
        <div className="manager-item">
          <img src="/images/managers/daniel.avif" />
          <Link to="/daniel" className="manager-button">
            DANIEL
          </Link>
        </div>
        <div className="manager-item">
          <img src="/images/managers/danny.avif" />
          <Link to="/danny" className="manager-button">
            DANNY
          </Link>
        </div>
        <div className="manager-item">
          <img src="/images/managers/demarco.avif" />
          <Link to="/demarco" className="manager-button">
            DEMARCO
          </Link>
        </div>
        <div className="manager-item">
          <img src="/images/managers/jeremy.avif" />
          <Link to="/jeremy" className="manager-button">
            JEREMY
          </Link>
        </div>
        <div className="manager-item">
          <img src="/images/managers/josh.avif" />
          <Link to="/josh" className="manager-button">
            JOSH
          </Link>
        </div>
        <div className="manager-item">
          <img src="/images/managers/stuart.avif" />
          <Link to="/stuart" className="manager-button">
            STUART
          </Link>
        </div>
        <div className="manager-item">
          <img src="/images/managers/tyler.avif" />
          <Link to="/tyler" className="manager-button">
            TYLER
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Managers;
