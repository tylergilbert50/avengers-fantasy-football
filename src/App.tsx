import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";
import { useEffect } from "react";
import ManagerPoll from "./pages/ManagerPoll/ManagerPoll.tsx";
import Home from "./pages/home/Home";
import ManagerProfile from "./pages/ManagerProfile/ManagerProfile.tsx";
import Standings from "./pages/Standings/Standings";
import Managers from "./pages/Managers/Managers";
import DraftHistory from "./pages/DraftHistory/DraftHistory.tsx";
import { DataPreloader } from "./pages/ManagerProfile/DataPreloader";

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function App() {
  return (
    <Router>
      <DataPreloader />
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/standings" element={<Standings />} />
        <Route path="/managers" element={<Managers />} />
        <Route path="/manager-poll" element={<ManagerPoll />} />
        <Route path="/:managerName" element={<ManagerProfile />} />
        <Route path="/draft-history" element={<DraftHistory />} />
      </Routes>
    </Router>
  );
}

export default App;
