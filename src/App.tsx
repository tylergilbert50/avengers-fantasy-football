import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ManagerPoll from "./pages/ManagerPoll/ManagerPoll.tsx";
import Home from "./pages/home/Home";
import ManagerProfile from "./pages/ManagerProfile/ManagerProfile.tsx";
import Standings from "./pages/Standings/Standings";
import Managers from "./pages/Managers/Managers";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/standings" element={<Standings />} />
        <Route path="/managers" element={<Managers />} />
        <Route path="/manager-poll" element={<ManagerPoll />} />
        <Route path="/:managerName" element={<ManagerProfile />} />
      </Routes>
    </Router>
  );
}

export default App;
