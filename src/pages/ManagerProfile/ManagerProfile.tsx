// ManagerProfile.tsx
import "./ManagerProfile.css";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { useManagerCareer, useAllManagersRanking } from "./ManagerProfile";
import type { ManagerCareer } from "./ManagerProfile";

type FinishPoint = {
  year: number;
  position: number;
  color: "gold" | "silver" | "bronze" | "black";
};

const LEAGUE_ID = "1268500224";

const displayMeta: Record<
  string,
  { displayName: string; name: string; nickname: string; image: string }
> = {
  tyler: {
    displayName: "Tyler Gilbert",
    name: "TYLER",
    nickname: "JARVIS",
    image: "images/managers/tyler.avif",
  },
  connor: {
    displayName: "Connor Boswer",
    name: "CONNOR",
    nickname: "GENIUS, PLAIBOI, CHAMPION",
    image: "images/managers/connor.avif",
  },
  andrew: {
    displayName: "Andrew Casazza",
    name: "ANDREW",
    nickname: "WOLVERINE'S BUBS",
    image: "images/managers/andrew.avif",
  },
  jeremy: {
    displayName: "Jeremy Stojakovich",
    name: "JEREMY",
    nickname: "FAT HAMMERED THOR",
    image: "images/managers/jeremy.avif",
  },
  josh: {
    displayName: "Josh Hartless",
    name: "JOSH",
    nickname: "BRUCE RAISING BANNERS",
    image: "images/managers/josh.avif",
  },
  demarco: {
    displayName: "Demarco Moore",
    name: "DEMARCO",
    nickname: "I NEVER FREEZE!",
    image: "images/managers/demarco.avif",
  },
  brett: {
    displayName: "Brett Gilbert",
    name: "BRETT",
    nickname: "ANYONE CAN WEAR THE MASK",
    image: "images/managers/brett.avif",
  },
  danny: {
    displayName: "Danny Stiles",
    name: "DANNY",
    nickname: "THE DOOM",
    image: "images/managers/danny.avif",
  },
  daniel: {
    displayName: "Daniel Dixon",
    name: "DANIEL",
    nickname: "I CAN DO THIS ALL DAY",
    image: "images/managers/daniel.avif",
  },
  stuart: {
    displayName: "Stuart Iverson",
    name: "STUART",
    nickname: "TERRIBLY WELL-BALANCED",
    image: "images/managers/stuart.avif",
  },
};

function ManagerProfile() {
  const { managerName } = useParams<{ managerName: string }>();
  const slug = (managerName || "").toLowerCase();
  const meta = displayMeta[slug];

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const allRankings = useAllManagersRanking(LEAGUE_ID);

  if (!meta) {
    return (
      <div className="container">
        <div className="profile-wrapper">
          <div className="profile">
            <h2 style={{ textAlign: "center", marginTop: 80 }}>
              Manager Not Found
            </h2>
          </div>
        </div>
      </div>
    );
  }

  const [careerCache, setCareerCache] = useState<Record<string, ManagerCareer>>(
    {}
  );

  const latest = useManagerCareer(LEAGUE_ID, meta.displayName);

  useEffect(() => {
    if (latest) {
      setCareerCache((prev) => ({
        ...prev,
        [meta.displayName]: latest,
      }));
    }
  }, [latest, meta.displayName]);

  const cachedCareer = careerCache[meta.displayName];

  const safeCareer: ManagerCareer =
    cachedCareer ??
    ({
      championships: 0,
      playoffAppearances: 0,
      playoffRecord: "-",
      record: "-",
      winPct: "-",
      rank: 0,
      num1Weeks: 0,
      num10Weeks: 0,
      yearly: [],
      finishes: [],
    } as ManagerCareer);

  const actualRank = meta?.displayName ? allRankings[meta.displayName] || 0 : 0;

  const chartData: FinishPoint[] = safeCareer.finishes;

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload || !payload.position) return null;

    const colorMap = {
      black: "#000000",
      bronze: "#cd7f32",
      silver: "#c0c0c0",
      gold: "#ffd700",
    } as const;

    const fillColor =
      colorMap[payload.color as keyof typeof colorMap] || "#000000";
    const textColor = payload.color === "gold" ? "#000000" : "#ffffff";
    const dotRadius = isMobile ? 18 : 24;
    const fontSize = isMobile ? 16 : 20;

    return (
      <g>
        <circle cx={cx} cy={cy} r={dotRadius} fill={fillColor} stroke="none" />
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill={textColor}
          fontSize={fontSize}
          fontWeight="bold"
          fontFamily="Arial, sans-serif"
        >
          {payload.position}
        </text>
      </g>
    );
  };

  const xYears = chartData.map((d) => d.year);
  const hasChart = xYears.length > 0;
  const xMin = hasChart ? Math.min(...xYears) - 0.5 : 2020.5;
  const xMax = hasChart ? Math.max(...xYears) + 0.5 : 2024.5;
  const xTicks = hasChart ? xYears : [2021, 2022, 2023, 2024];

  return (
    <div className="container">
      <div className="profile-wrapper">
        <div className="profile">
          <div className="profile-content">
            <div className="profile-image-section">
              <div className="profile-image">
                <img src={meta.image} alt={meta.name} />
              </div>
              <div className="manager-name">{meta.name}</div>
            </div>

            <div className="profile-text-section">
              <span className="profile-title">{meta.nickname}</span>
              <hr className="profile-top-dashed-line" />
              <div className="stats-cards">
                <div className="stat-card">
                  <div className="stat-label">Championships</div>
                  <div className="stat-value">{safeCareer.championships}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Playoff Appearances</div>
                  <div className="stat-value">
                    {safeCareer.playoffAppearances}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Playoff Record</div>
                  <div className="stat-value">{safeCareer.playoffRecord}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="profile-dashed-line">
            <span className="dashed-line-text">Career Stats</span>
          </div>

          <div className="career-stats-section">
            <div className="career-stats-cards">
              <div className="career-stat-card">
                <div className="career-stat-header">RECORD</div>
                <div className="career-stat-value">{safeCareer.record}</div>
              </div>
              <div className="career-stat-card">
                <div className="career-stat-header">WINNING %</div>
                <div className="career-stat-value">{safeCareer.winPct}</div>
                <div className="rank-text">
                  RANK: #{actualRank || safeCareer.rank || "—"}
                </div>
              </div>
            </div>

            <div className="football-stats">
              <div className="football-stat">
                <div className="football-label">#1 WEEKS</div>
                <div className="football-icon">
                  <img src="images/football.avif" alt="Football" />
                  <span className="football-number">
                    {safeCareer.num1Weeks}
                  </span>
                </div>
              </div>
              <div className="football-stat">
                <div className="football-label">#10 WEEKS</div>
                <div className="football-icon">
                  <img src="images/football.avif" alt="Football" />
                  <span className="football-number">
                    {safeCareer.num10Weeks}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="yearly-stats-section">
            <div className="yearly-stats-table">
              <div className="yearly-stats-header">
                <div className="yearly-stats-header-item">YEAR</div>
                <div className="yearly-stats-header-item">W</div>
                <div className="yearly-stats-header-item">L</div>
                <div className="yearly-stats-header-item">PLAYOFF APP</div>
                <div className="yearly-stats-header-item">AVG PTS</div>
                <div className="yearly-stats-header-item">AVG PA</div>
              </div>

              {(safeCareer.yearly.length ? safeCareer.yearly : []).map(
                (row) => (
                  <div className="yearly-stats-row" key={row.year}>
                    <div className="year-badge">{row.year}</div>
                    <div className="record-value">{row.w}</div>
                    <div className="record-value">{row.l}</div>
                    <div
                      className={`playoff-badge ${row.playoff ? "yes" : "no"}`}
                    >
                      {row.playoff ? "✓" : "✕"}
                    </div>
                    <div className="stats-value">{row.avgPts}</div>
                    <div className="stats-value">{row.avgPa}</div>
                  </div>
                )
              )}

              {safeCareer.yearly.length === 0 && (
                <div className="yearly-stats-row" aria-hidden>
                  <div className="year-badge">—</div>
                  <div className="record-value">—</div>
                  <div className="record-value">—</div>
                  <div className="playoff-badge no">—</div>
                  <div className="stats-value">—</div>
                  <div className="stats-value">—</div>
                </div>
              )}
            </div>
          </div>

          <div className="career-finishes-section">
            <div className="career-finishes-header">
              <span className="career-finishes-title">Career Finishes</span>
            </div>

            <div
              className="career-finishes-graph"
              style={{
                padding: "20px",
                height: "500px",
                boxSizing: "border-box",
              }}
            >
              {hasChart ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 30, right: 30, left: 30, bottom: 30 }}
                  >
                    <CartesianGrid
                      strokeDasharray="none"
                      stroke="#d0d0d0"
                      strokeWidth={1.5}
                      horizontal={true}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="year"
                      type="number"
                      scale="linear"
                      domain={[xMin, xMax]}
                      ticks={xTicks}
                      tickFormatter={(v) => v.toString()}
                      axisLine={false}
                      tickLine={false}
                      orientation="top"
                      angle={isMobile ? -45 : 0}
                      textAnchor={isMobile ? "end" : "middle"}
                      tick={{
                        fontSize: isMobile ? 10 : 18,
                        fontWeight: 700,
                        fontStyle: "italic",
                        fontFamily: "Georgia, serif",
                        fill: "#000",
                      }}
                      height={isMobile ? 60 : 50}
                      padding={{ left: 20, right: 20 }}
                    />
                    <YAxis
                      domain={[0.3, 11]}
                      reversed={true}
                      ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]}
                      tickFormatter={(v) => `${v}`}
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fontSize: isMobile ? 14 : 22,
                        fontWeight: 700,
                        fontFamily: "Georgia, serif",
                        fill: "#000",
                      }}
                      width={isMobile ? 30 : 35}
                      interval={0}
                    />
                    <Line
                      type="linear"
                      dataKey="position"
                      stroke="#000000"
                      strokeWidth={3}
                      strokeDasharray="8 8"
                      dot={<CustomDot />}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: 0.5,
                    fontStyle: "italic",
                    border: "1px dashed #d0d0d0",
                    borderRadius: 16,
                  }}
                >
                  Stats will appear here…
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ManagerProfile;
