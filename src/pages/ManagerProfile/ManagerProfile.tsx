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

type FinishPoint = {
  year: number;
  position: number;
  color: "gold" | "silver" | "bronze" | "black";
};

type YearlyStats = {
  year: number;
  w: number;
  l: number;
  playoff: boolean;
  avgPts: string;
  avgPa: string;
};

type ManagerCareer = {
  championships: number;
  playoffAppearances: number;
  playoffRecord: string;
  record: string;
  winPct: string;
  rank: number;
  num1Weeks: number;
  num10Weeks: number;
  yearly: YearlyStats[];
  finishes: FinishPoint[];
};

// Hardcoded manager metadata
const displayMeta: Record<
  string,
  { displayName: string; name: string; nickname: string; image: string }
> = {
  tyler: {
    displayName: "Tyler Gilbert",
    name: "TYLER",
    nickname: "JARVIS",
    image: "images/managers/tyler.png",
  },
  connor: {
    displayName: "Connor Bowser",
    name: "CONNOR",
    nickname: "GENIUS, PLAIBOI, CHAMPION",
    image: "images/managers/connor.png",
  },
  andrew: {
    displayName: "Andrew Casazza",
    name: "ANDREW",
    nickname: "WOLVERINE'S BUBS",
    image: "images/managers/andrew.png",
  },
  jeremy: {
    displayName: "Jeremy Stojakovich",
    name: "JEREMY",
    nickname: "FAT HAMMERED THOR",
    image: "images/managers/jeremy.png",
  },
  josh: {
    displayName: "Josh Hartless",
    name: "JOSH",
    nickname: "BRUCE RAISING BANNERS",
    image: "images/managers/josh.png",
  },
  demarco: {
    displayName: "Demarco Moore",
    name: "DEMARCO",
    nickname: "I NEVER FREEZE!",
    image: "images/managers/demarco.png",
  },
  brett: {
    displayName: "Brett Gilbert",
    name: "BRETT",
    nickname: "ANYONE CAN WEAR THE MASK",
    image: "images/managers/brett.png",
  },
  danny: {
    displayName: "Danny Stiles",
    name: "DANNY",
    nickname: "THE DOOM",
    image: "images/managers/danny.png",
  },
  daniel: {
    displayName: "Daniel Dixon",
    name: "DANIEL",
    nickname: "I CAN DO THIS ALL DAY",
    image: "images/managers/daniel.png",
  },
  stuart: {
    displayName: "Stuart Iverson",
    name: "STUART",
    nickname: "TERRIBLY WELL-BALANCED",
    image: "images/managers/stuart.png",
  },
};

// Hardcoded career data for all managers (2021-2025)
const managerCareers: Record<string, ManagerCareer> = {
  connor: {
    championships: 2,
    playoffAppearances: 5,
    playoffRecord: "8-4",
    record: "49-25",
    winPct: "66.2%",
    rank: 1,
    num1Weeks: 10,
    num10Weeks: 2,
    yearly: [
      {
        year: 2021,
        w: 8,
        l: 6,
        playoff: true,
        avgPts: "128.9",
        avgPa: "133.9",
      },
      {
        year: 2022,
        w: 11,
        l: 3,
        playoff: true,
        avgPts: "131.3",
        avgPa: "112.3",
      },
      {
        year: 2023,
        w: 8,
        l: 6,
        playoff: true,
        avgPts: "129.2",
        avgPa: "121.6",
      },
      {
        year: 2024,
        w: 12,
        l: 2,
        playoff: true,
        avgPts: "135.0",
        avgPa: "115.0",
      },
      {
        year: 2025,
        w: 10,
        l: 4,
        playoff: true,
        avgPts: "126.9",
        avgPa: "108.3",
      },
    ],
    finishes: [
      { year: 2021, position: 1, color: "gold" },
      { year: 2022, position: 3, color: "bronze" },
      { year: 2023, position: 5, color: "black" },
      { year: 2024, position: 1, color: "gold" },
      { year: 2025, position: 2, color: "silver" },
    ],
  },
  tyler: {
    championships: 0,
    playoffAppearances: 3,
    playoffRecord: "1-3",
    record: "33-37",
    winPct: "47.1%",
    rank: 6,
    num1Weeks: 4,
    num10Weeks: 7,
    yearly: [
      {
        year: 2021,
        w: 9,
        l: 5,
        playoff: true,
        avgPts: "120.0",
        avgPa: "120.0",
      },
      {
        year: 2022,
        w: 8,
        l: 6,
        playoff: true,
        avgPts: "123.4",
        avgPa: "121.5",
      },
      {
        year: 2023,
        w: 7,
        l: 7,
        playoff: true,
        avgPts: "117.6",
        avgPa: "124.8",
      },
      {
        year: 2024,
        w: 5,
        l: 9,
        playoff: false,
        avgPts: "118.0",
        avgPa: "128.0",
      },
      {
        year: 2025,
        w: 4,
        l: 10,
        playoff: false,
        avgPts: "112.1",
        avgPa: "116.5",
      },
    ],
    finishes: [
      { year: 2021, position: 4, color: "black" },
      { year: 2022, position: 5, color: "black" },
      { year: 2023, position: 3, color: "bronze" },
      { year: 2024, position: 9, color: "black" },
      { year: 2025, position: 9, color: "black" },
    ],
  },
  brett: {
    championships: 1,
    playoffAppearances: 3,
    playoffRecord: "4-2",
    record: "30-40",
    winPct: "42.9%",
    rank: 9,
    num1Weeks: 6,
    num10Weeks: 8,
    yearly: [
      {
        year: 2021,
        w: 9,
        l: 5,
        playoff: true,
        avgPts: "134.7",
        avgPa: "123.5",
      },
      {
        year: 2022,
        w: 3,
        l: 11,
        playoff: false,
        avgPts: "109.0",
        avgPa: "132.0",
      },
      {
        year: 2023,
        w: 4,
        l: 10,
        playoff: false,
        avgPts: "122.4",
        avgPa: "138.8",
      },
      {
        year: 2024,
        w: 8,
        l: 6,
        playoff: true,
        avgPts: "125.0",
        avgPa: "122.0",
      },
      {
        year: 2025,
        w: 6,
        l: 8,
        playoff: true,
        avgPts: "127.4",
        avgPa: "132.0",
      },
    ],
    finishes: [
      { year: 2021, position: 3, color: "bronze" },
      { year: 2022, position: 10, color: "black" },
      { year: 2023, position: 10, color: "black" },
      { year: 2024, position: 6, color: "black" },
      { year: 2025, position: 1, color: "gold" },
    ],
  },
  jeremy: {
    championships: 0,
    playoffAppearances: 4,
    playoffRecord: "2-4",
    record: "39-31",
    winPct: "55.7%",
    rank: 3,
    num1Weeks: 4,
    num10Weeks: 4,
    yearly: [
      {
        year: 2021,
        w: 7,
        l: 7,
        playoff: true,
        avgPts: "134.8",
        avgPa: "128.1",
      },
      {
        year: 2022,
        w: 9,
        l: 5,
        playoff: true,
        avgPts: "119.5",
        avgPa: "112.1",
      },
      {
        year: 2023,
        w: 7,
        l: 7,
        playoff: true,
        avgPts: "115.7",
        avgPa: "121.3",
      },
      {
        year: 2024,
        w: 7,
        l: 7,
        playoff: false,
        avgPts: "120.0",
        avgPa: "125.0",
      },
      {
        year: 2025,
        w: 9,
        l: 5,
        playoff: true,
        avgPts: "129.9",
        avgPa: "123.5",
      },
    ],
    finishes: [
      { year: 2021, position: 5, color: "black" },
      { year: 2022, position: 2, color: "silver" },
      { year: 2023, position: 4, color: "black" },
      { year: 2024, position: 7, color: "black" },
      { year: 2025, position: 3, color: "bronze" },
    ],
  },
  danny: {
    championships: 2,
    playoffAppearances: 4,
    playoffRecord: "7-3",
    record: "40-30",
    winPct: "57.1%",
    rank: 3,
    num1Weeks: 9,
    num10Weeks: 2,
    yearly: [
      {
        year: 2021,
        w: 7,
        l: 7,
        playoff: true,
        avgPts: "125.3",
        avgPa: "120.6",
      },
      {
        year: 2022,
        w: 7,
        l: 7,
        playoff: true,
        avgPts: "122.9",
        avgPa: "127.7",
      },
      {
        year: 2023,
        w: 11,
        l: 3,
        playoff: true,
        avgPts: "143.1",
        avgPa: "110.6",
      },
      {
        year: 2024,
        w: 11,
        l: 3,
        playoff: true,
        avgPts: "132.0",
        avgPa: "118.0",
      },
      {
        year: 2025,
        w: 4,
        l: 10,
        playoff: false,
        avgPts: "118.6",
        avgPa: "129.3",
      },
    ],
    finishes: [
      { year: 2021, position: 6, color: "black" },
      { year: 2022, position: 1, color: "gold" },
      { year: 2023, position: 2, color: "silver" },
      { year: 2024, position: 3, color: "bronze" },
      { year: 2025, position: 8, color: "black" },
    ],
  },
  josh: {
    championships: 0,
    playoffAppearances: 4,
    playoffRecord: "1-4",
    record: "43-27",
    winPct: "61.4%",
    rank: 2,
    num1Weeks: 7,
    num10Weeks: 3,
    yearly: [
      {
        year: 2021,
        w: 6,
        l: 8,
        playoff: false,
        avgPts: "126.2",
        avgPa: "119.6",
      },
      {
        year: 2022,
        w: 10,
        l: 4,
        playoff: true,
        avgPts: "136.5",
        avgPa: "109.0",
      },
      {
        year: 2023,
        w: 8,
        l: 6,
        playoff: true,
        avgPts: "123.2",
        avgPa: "130.2",
      },
      {
        year: 2024,
        w: 10,
        l: 4,
        playoff: true,
        avgPts: "128.0",
        avgPa: "120.0",
      },
      {
        year: 2025,
        w: 9,
        l: 5,
        playoff: true,
        avgPts: "129.2",
        avgPa: "121.1",
      },
    ],
    finishes: [
      { year: 2021, position: 7, color: "black" },
      { year: 2022, position: 4, color: "black" },
      { year: 2023, position: 6, color: "black" },
      { year: 2024, position: 4, color: "black" },
      { year: 2025, position: 5, color: "black" },
    ],
  },
  andrew: {
    championships: 0,
    playoffAppearances: 2,
    playoffRecord: "1-2",
    record: "35-37",
    winPct: "48.6%",
    rank: 4,
    num1Weeks: 4,
    num10Weeks: 6,
    yearly: [
      {
        year: 2021,
        w: 6,
        l: 8,
        playoff: false,
        avgPts: "117.9",
        avgPa: "125.5",
      },
      {
        year: 2022,
        w: 6,
        l: 8,
        playoff: true,
        avgPts: "124.9",
        avgPa: "124.1",
      },
      {
        year: 2023,
        w: 5,
        l: 9,
        playoff: false,
        avgPts: "126.0",
        avgPa: "121.9",
      },
      {
        year: 2024,
        w: 11,
        l: 3,
        playoff: true,
        avgPts: "130.0",
        avgPa: "116.0",
      },
      {
        year: 2025,
        w: 7,
        l: 7,
        playoff: false,
        avgPts: "121.7",
        avgPa: "121.0",
      },
    ],
    finishes: [
      { year: 2021, position: 8, color: "black" },
      { year: 2022, position: 6, color: "black" },
      { year: 2023, position: 9, color: "black" },
      { year: 2024, position: 2, color: "silver" },
      { year: 2025, position: 7, color: "black" },
    ],
  },
  daniel: {
    championships: 1,
    playoffAppearances: 2,
    playoffRecord: "3-1",
    record: "30-42",
    winPct: "41.7%",
    rank: 10,
    num1Weeks: 5,
    num10Weeks: 10,
    yearly: [
      {
        year: 2021,
        w: 5,
        l: 9,
        playoff: false,
        avgPts: "115.7",
        avgPa: "125.7",
      },
      {
        year: 2022,
        w: 4,
        l: 10,
        playoff: false,
        avgPts: "104.9",
        avgPa: "127.4",
      },
      {
        year: 2023,
        w: 9,
        l: 5,
        playoff: true,
        avgPts: "140.3",
        avgPa: "132.8",
      },
      {
        year: 2024,
        w: 9,
        l: 5,
        playoff: true,
        avgPts: "126.0",
        avgPa: "122.0",
      },
      {
        year: 2025,
        w: 3,
        l: 11,
        playoff: false,
        avgPts: "108.9",
        avgPa: "130.3",
      },
    ],
    finishes: [
      { year: 2021, position: 9, color: "black" },
      { year: 2022, position: 9, color: "black" },
      { year: 2023, position: 1, color: "gold" },
      { year: 2024, position: 5, color: "black" },
      { year: 2025, position: 10, color: "black" },
    ],
  },
  demarco: {
    championships: 0,
    playoffAppearances: 1,
    playoffRecord: "0-1",
    record: "27-29",
    winPct: "48.2%",
    rank: 5,
    num1Weeks: 3,
    num10Weeks: 5,
    yearly: [
      {
        year: 2022,
        w: 6,
        l: 8,
        playoff: false,
        avgPts: "122.8",
        avgPa: "122.6",
      },
      {
        year: 2023,
        w: 5,
        l: 9,
        playoff: false,
        avgPts: "117.4",
        avgPa: "125.3",
      },
      {
        year: 2024,
        w: 7,
        l: 7,
        playoff: false,
        avgPts: "119.0",
        avgPa: "124.0",
      },
      {
        year: 2025,
        w: 9,
        l: 5,
        playoff: true,
        avgPts: "111.0",
        avgPa: "113.5",
      },
    ],
    finishes: [
      { year: 2022, position: 7, color: "black" },
      { year: 2023, position: 8, color: "black" },
      { year: 2024, position: 8, color: "black" },
      { year: 2025, position: 6, color: "black" },
    ],
  },
  stuart: {
    championships: 0,
    playoffAppearances: 1,
    playoffRecord: "0-1",
    record: "13-15",
    winPct: "46.4%",
    rank: 7,
    num1Weeks: 2,
    num10Weeks: 4,
    yearly: [
      {
        year: 2024,
        w: 4,
        l: 10,
        playoff: false,
        avgPts: "115.0",
        avgPa: "130.0",
      },
      {
        year: 2025,
        w: 9,
        l: 5,
        playoff: true,
        avgPts: "128.1",
        avgPa: "118.3",
      },
    ],
    finishes: [
      { year: 2024, position: 10, color: "black" },
      { year: 2025, position: 4, color: "black" },
    ],
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

  if (!meta) {
    return (
      <div className="container">
        <h1 className="avengers-text">UNDER CONSTRUCTION</h1>
      </div>
    );
  }

  const career = managerCareers[slug] || {
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
  };

  const chartData: FinishPoint[] = career.finishes;

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

  const START_YEAR = 2021;
  const END_YEAR = 2025;

  const xTicks = Array.from(
    { length: END_YEAR - START_YEAR + 1 },
    (_, i) => START_YEAR + i
  );

  const xMin = START_YEAR - 0.5;
  const xMax = END_YEAR + 0.5;

  const chartDataFull: FinishPoint[] = xTicks.map((year) => {
    const existing = chartData.find((d) => d.year === year);
    return (
      existing ?? {
        year,
        position: null as any,
        color: "black",
      }
    );
  });

  const hasChart = chartData.some((d) => d.position != null);

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
              <div className="profile-header">
                <span className="profile-title">{meta.nickname}</span>
                {(slug === "tyler" || slug === "andrew") && (
                  <img
                    className="stan-lee-logo"
                    src="/images/stanleeaward.png"
                    alt="Stan Lee Award"
                  />
                )}
              </div>
              <hr className="profile-top-dashed-line" />
              <div className="stats-cards">
                <div className="stat-card">
                  <div className="stat-label">Championships</div>
                  <div className="stat-value">{career.championships}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Playoff Appearances</div>
                  <div className="stat-value">{career.playoffAppearances}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Playoff Record</div>
                  <div className="stat-value">{career.playoffRecord}</div>
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
                <div className="career-stat-value">{career.record}</div>
              </div>
              <div className="career-stat-card">
                <div className="career-stat-header">WINNING %</div>
                <div className="career-stat-value">{career.winPct}</div>
                <div className="rank-text">RANK: #{career.rank || "—"}</div>
              </div>
            </div>

            <div className="football-stats">
              <div className="football-stat">
                <div className="football-label">#1 WEEKS</div>
                <div className="football-icon">
                  <img src="images/football.avif" alt="Football" />
                  <span className="football-number">{career.num1Weeks}</span>
                </div>
              </div>
              <div className="football-stat">
                <div className="football-label">#10 WEEKS</div>
                <div className="football-icon">
                  <img src="images/football.avif" alt="Football" />
                  <span className="football-number">{career.num10Weeks}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="yearly-stats-section">
            <div className="yearly-stats-table">
              <div className="yearly-stats-header">
                <div className="yearly-stats-header-item">YEAR</div>
                <div className="yearly-stats-header-item">W - L</div>
                <div className="yearly-stats-header-item">PLAYOFF APP</div>
                <div className="yearly-stats-header-item">AVG PTS</div>
                <div className="yearly-stats-header-item">AVG PA</div>
              </div>

              {career.yearly.map((row) => (
                <div className="yearly-stats-row" key={row.year}>
                  <div className="year-badge">{row.year}</div>
                  <div className="record-value">
                    {row.w} - {row.l}
                  </div>
                  <div
                    className={`playoff-badge ${row.playoff ? "yes" : "no"}`}
                  >
                    {row.playoff ? "✓" : "✕"}
                  </div>
                  <div className="stats-value">{row.avgPts}</div>
                  <div className="stats-value">{row.avgPa}</div>
                </div>
              ))}

              {career.yearly.length === 0 && (
                <div className="yearly-stats-row" aria-hidden>
                  <div className="year-badge">—</div>
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
                    data={chartDataFull}
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
                        dy: -30,
                      }}
                      height={isMobile ? 60 : 50}
                      padding={{ left: 20, right: 20 }}
                    />
                    <YAxis
                      domain={[1, 10]}
                      reversed={true}
                      ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
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
                      activeDot={false}
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
