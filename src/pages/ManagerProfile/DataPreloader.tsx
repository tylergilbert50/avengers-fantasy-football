import { useEffect } from "react";
import { preloadAllManagers } from "./ManagerProfile";

const LEAGUE_ID = "1268500224";

export function DataPreloader() {
  useEffect(() => {
    preloadAllManagers(LEAGUE_ID);
  }, []);

  return null;
}
