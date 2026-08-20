"use client";

import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  CircleCheckBig,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Crown,
  Flame,
  Info,
  ListOrdered,
  Medal,
  RotateCcw,
  Search,
  Share2,
  Trophy,
  TrendingUp,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ConfirmedSetResult, LadderBox, LadderData, LadderWeek, Movement, PlayerProfile, PlayerResult } from "@/lib/types";
import { buildHeadToHeadRecord, sortBoxPlayers } from "@/lib/ladder";
import { buildWeeklyAwards, type WeeklyAwardKind } from "@/lib/weeklyAwards";

export type LadderSection = "week" | "results" | "stats" | "head-to-head";
type StatsMode = "leaders" | "ranking";

const heroScoreFrames = [
  { point: "0 - 0", first: "5", second: "2" },
  { point: "0 - 15", first: "5", second: "2" },
  { point: "0 - 30", first: "5", second: "2" },
  { point: "15 - 30", first: "5", second: "2" },
  { point: "15 - 40", first: "5", second: "2", matchPoint: true },
];

function HeroScoreboard() {
  const [frame, setFrame] = useState(0);
  const [showMatch, setShowMatch] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const rootRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { threshold: 0.1 });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || showMatch) return;
    const interval = window.setInterval(() => setFrame((current) => (current + 1) % heroScoreFrames.length), 3600);
    return () => window.clearInterval(interval);
  }, [isVisible, showMatch]);

  const score = heroScoreFrames[frame];

  return (
    <button
      ref={rootRef}
      type="button"
      className="hero-scoreboard"
      aria-label={showMatch ? "Semi-final result: 6 to 4, 6 to 2. Select to return to the live score." : "Live semi-final score. Select to show the match result."}
      aria-pressed={showMatch}
      onClick={() => setShowMatch((current) => !current)}
    >
      <span className="scoreboard-court" aria-hidden="true">
        <span className="court-net" />
        <span className="court-service-line" />
      </span>
      <span className="scoreboard-card" aria-hidden="true">
        <span className="scoreboard-meta">
          <span><i /> LIVE</span>
          <span>COURT 03</span>
        </span>
        <span className="scoreboard-set">SET 2</span>
        <span className="scoreboard-score" key={frame}>
          <span>{score.first}</span>
          <i>–</i>
          <span>{score.second}</span>
        </span>
        <span className="scoreboard-point" key={`point-${frame}`}>{score.point}</span>
        {score.matchPoint ? <span className="scoreboard-match-point" key={`match-point-${frame}`}>MATCH POINT</span> : null}
        <span className="scoreboard-prompt">SEMI-FINAL</span>
        <span className="scoreboard-match">
          <small>SEMI-FINAL</small>
          <strong>GAME<br />SET<br />MATCH</strong>
          <i>6–4&nbsp;&nbsp;6–2</i>
        </span>
      </span>
    </button>
  );
}

function HeroOrbit() {
  const [isVisible, setIsVisible] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { threshold: 0.1 });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="hero-orbit" data-visible={isVisible} aria-hidden="true">
      <span>UP</span>
      <span>STAY</span>
      <span>DOWN</span>
    </div>
  );
}

const initials = (name: string) =>
  name
    .replace(/[^a-zA-Z ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

async function sharePng(blob: Blob, fileName: string) {
  const file = new File([blob], fileName, { type: "image/png" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file] });
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
}

async function loadShareLogo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const logo = new window.Image();
    logo.onload = () => resolve(logo);
    logo.onerror = () => resolve(null);
    logo.src = "/my-league-live-logo.png";
  });
}

function drawShareLogo(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null) {
  if (logo) ctx.drawImage(logo, 72, 54, 320, 120);
}

const abbreviatedWeekday = (day: string) => {
  const normalized = day.trim().toLowerCase();
  const abbreviations: Record<string, string> = {
    sun: "Sun",
    sunday: "Sun",
    mon: "Mon",
    monday: "Mon",
    tue: "Tue",
    tues: "Tue",
    tuesday: "Tue",
    wed: "Wed",
    wednesday: "Wed",
    thu: "Thu",
    thur: "Thu",
    thurs: "Thu",
    thursday: "Thu",
    fri: "Fri",
    friday: "Fri",
    sat: "Sat",
    saturday: "Sat",
  };
  return abbreviations[normalized] || day.trim();
};

const movementIcon = (movement: Movement) => {
  if (movement === "UP") return <ArrowUp size={14} strokeWidth={3} />;
  if (movement === "DOWN") return <ArrowDown size={14} strokeWidth={3} />;
  return <ArrowRight size={14} strokeWidth={3} />;
};

function lastCompletedResults(profile?: PlayerProfile): PlayerResult[] {
  return recentMovementSequence(profile, 3);
}

function recentMovementSequence(profile: PlayerProfile | undefined, limit: number): PlayerResult[] {
  return profile?.history.filter((item) => item.movement).slice(0, limit).reverse() || [];
}

function PlayerRow({
  player,
  profile,
  showResult,
  showRecentResults,
  showSubstituteOnly,
  onSelect,
  index,
}: {
  player: PlayerResult;
  profile?: PlayerProfile;
  showResult: boolean;
  showRecentResults: boolean;
  showSubstituteOnly: boolean;
  onSelect: () => void;
  index: number;
}) {
  const recentResults = lastCompletedResults(profile);
  const previous = recentResults[0];
  const movement = showResult ? player.movement : previous?.movement || "";
  return (
    <button
      className={`player-row movement-${movement.toLowerCase() || "none"}`}
      style={{ "--delay": `${index * 60}ms` } as React.CSSProperties}
      onClick={onSelect}
    >
      <span className="avatar-wrap">
        <span className="avatar">{initials(player.name)}</span>
        {showRecentResults && profile && profile.streak >= 2 ? (
          <span className="streak-fire" aria-label={`${profile.streak}-week UP streak`} title={`${profile.streak}-week UP streak`}>🔥</span>
        ) : null}
      </span>
      <span className="player-copy">
        <strong>{player.name}</strong>
        {player.substitute ? <small>Sub: {player.substitute}</small> : showSubstituteOnly ? null : <small>{movement ? `Last: ${movement.toLowerCase()}` : "Ready to play"}</small>}
      </span>
      {showResult && player.total !== null ? (
        <span className="score-stack">
          <strong>{player.total}</strong>
          <small>{player.rawScore}</small>
        </span>
      ) : null}
      {showRecentResults ? (
        recentResults.length ? (
          <span className="recent-movements" aria-label="Last three results, oldest to newest">
            {recentResults.map((result) => (
              <span key={`${result.dateKey}-${result.box}`} className={`movement-badge ${result.movement.toLowerCase()}`} title={`${result.date}: ${result.movement.toLowerCase()}`}>
                {movementIcon(result.movement)}
              </span>
            ))}
          </span>
        ) : <ChevronRight size={18} />
      ) : movement ? <span className={`movement-badge ${movement.toLowerCase()}`}>{movementIcon(movement)}</span> : <ChevronRight size={18} />}
    </button>
  );
}

function SetResults({ box }: { box: LadderBox }) {
  if (!box.setResults.length) return null;
  const displayName = (name: string) => {
    const player = box.players.find((candidate) => candidate.name === name);
    return player?.substitute || name;
  };
  return (
    <section className="set-results" aria-label="Confirmed set results">
      <header><span>SET-BY-SET</span></header>
      {box.setResults.map((set) => {
        const [first, second] = set.teams;
        const firstPlayers = first.players.map(displayName);
        const secondPlayers = second.players.map(displayName);
        const firstNames = firstPlayers.map(firstName).join(" + ");
        const secondNames = secondPlayers.map(firstName).join(" + ");
        return (
          <div
            key={set.number}
            className="set-result"
            aria-label={`Set ${set.number}: ${firstPlayers.join(" and ")} ${first.games}, ${secondPlayers.join(" and ")} ${second.games}`}
          >
            <span>SET {set.number}</span>
            <div>
              <span title={firstPlayers.join(" + ")}>{firstNames}</span>
              <strong>{first.games}–{second.games}</strong>
              <span title={secondPlayers.join(" + ")}>{secondNames}</span>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function BoxCard({
  box,
  profiles,
  showResult,
  showRecentResults,
  showSubstituteOnly,
  showWeekday,
  onSelect,
}: {
  box: LadderBox;
  profiles: Map<string, PlayerProfile>;
  showResult: boolean;
  showRecentResults: boolean;
  showSubstituteOnly: boolean;
  showWeekday: boolean;
  onSelect: (name: string) => void;
}) {
  const orderedPlayers = sortBoxPlayers(box.players, showResult ? "result" : "ranking", [...profiles.values()]
    .filter((profile) => profile.rank !== null)
    .map((profile) => ({ name: profile.name, rank: profile.rank!, box: profile.currentBox, movement: "" as Movement })));
  return (
    <article className="box-card" id={`box-${box.number}`}>
      <header className="box-head">
        <div>
          <span>BOX</span>
          <strong>{String(box.number).padStart(2, "0")}</strong>
        </div>
        <div className="box-meta">
          <span><Clock3 size={14} /> {box.time}{showWeekday && box.day ? ` · ${abbreviatedWeekday(box.day)}` : ""}</span>
          <span>Court {box.court}</span>
        </div>
      </header>
      <div className="player-list">
        {orderedPlayers.map((player, index) => (
          <PlayerRow
            key={`${player.name}-${index}`}
            player={player}
            profile={profiles.get(player.name)}
            showResult={showResult}
            showRecentResults={showRecentResults}
            showSubstituteOnly={showSubstituteOnly}
            onSelect={() => onSelect(player.name)}
            index={index}
          />
        ))}
      </div>
      {showResult ? <SetResults box={box} /> : null}
    </article>
  );
}

const awardIcons: Record<WeeklyAwardKind, React.ReactNode> = {
  top: <Crown size={19} />,
  player: <Medal size={19} />,
  "personal-best": <TrendingUp size={19} />,
  "bounce-back": <RotateCcw size={19} />,
};

function WeeklyAwards({ week, weeks }: { week: LadderWeek; weeks: LadderWeek[] }) {
  const awards = buildWeeklyAwards(week, weeks);
  if (!awards.length) return null;
  return (
    <section className="weekly-awards" aria-labelledby="weekly-awards-title">
      <header>
        <h3 id="weekly-awards-title">Awards</h3>
      </header>
      <div className="weekly-award-grid">
        {awards.map((award) => (
          <article key={award.kind} className="weekly-award">
            <span className="weekly-award-icon" aria-hidden="true">{awardIcons[award.kind]}</span>
            <div>
              <div className="weekly-award-title">
                <span>{award.title}</span>
                <button type="button" className="weekly-award-info" aria-label={`About ${award.title}`} aria-describedby={`award-${award.kind}-detail`}>
                  <Info size={13} />
                  <span id={`award-${award.kind}-detail`} className="award-tooltip" role="tooltip">{award.detail}</span>
                </button>
              </div>
              <div className="weekly-award-names">
                {award.recipients.map((recipient) => (
                  <strong key={`${recipient.name}-${recipient.note || ""}`}>
                    {recipient.name}{recipient.note ? <small>{recipient.note}</small> : null}
                  </strong>
                ))}
              </div>
              {award.honorableMentions?.length ? (
                <div className="weekly-award-honorable">
                  <div className="weekly-award-honorable-label">
                    <span>HONORABLE {award.honorableMentions.length > 1 ? "MENTIONS" : "MENTION"}</span>
                    <button type="button" className="weekly-award-info" aria-label="About honorable mentions" aria-describedby={`award-${award.kind}-honorable`}>
                      <Info size={12} />
                      <span id={`award-${award.kind}-honorable`} className="award-tooltip" role="tooltip">Also won all three sets, but did not enter this week after an UP result.</span>
                    </button>
                  </div>
                  <div>{award.honorableMentions.map((recipient) => <strong key={recipient.name}>{recipient.name}</strong>)}</div>
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function LadderGrid({
  week,
  profiles,
  showResult,
  showRecentResults = false,
  showSubstituteOnly = false,
  showWeekday = false,
  onSelect,
}: {
  week: LadderWeek | null;
  profiles: Map<string, PlayerProfile>;
  showResult: boolean;
  showRecentResults?: boolean;
  showSubstituteOnly?: boolean;
  showWeekday?: boolean;
  onSelect: (name: string) => void;
}) {
  if (!week) return <div className="empty-state">No ladder is available yet.</div>;
  return (
    <div className="box-grid">
      {week.boxes.map((box) => (
        <BoxCard
          key={box.number}
          box={box}
          profiles={profiles}
          showResult={showResult}
          showRecentResults={showRecentResults}
          showSubstituteOnly={showSubstituteOnly}
          showWeekday={showWeekday}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function RankingTrend({ history }: { history: PlayerProfile["rankingHistory"] }) {
  const points = history.slice(-8);
  if (!points.length) return <div className="ranking-trend-empty">Ranking history is not available.</div>;
  const ranks = points.map((point) => point.rank);
  const minRank = Math.min(...ranks);
  const maxRank = Math.max(...ranks);
  const coordinates = points.map((point, index) => ({
    ...point,
    x: points.length === 1 ? 210 : 24 + (index * 372) / (points.length - 1),
    y: minRank === maxRank ? 52 : 18 + ((point.rank - minRank) * 68) / (maxRank - minRank),
  }));
  const pointList = coordinates.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="ranking-trend">
      <svg viewBox="0 0 420 118" role="img" aria-label={`Weekly ladder ranking from ${points[0].rank} to ${points.at(-1)?.rank}`}>
        <line x1="24" y1="86" x2="396" y2="86" />
        {coordinates.length > 1 ? <polyline points={pointList} /> : null}
        {coordinates.map((point) => (
          <g key={point.dateKey}>
            <circle cx={point.x} cy={point.y} r="12" />
            <text x={point.x} y={point.y + 4} textAnchor="middle">{point.rank}</text>
            <text className="week-label" x={point.x} y="110" textAnchor="middle">W{point.week}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function ProfilePanel({
  profile,
  weeks,
  canViewCurrentBox,
  onViewCurrentBox,
  onClose,
}: {
  profile: PlayerProfile;
  weeks: LadderWeek[];
  canViewCurrentBox: boolean;
  onViewCurrentBox: () => void;
  onClose: () => void;
}) {
  const latest = profile.history[0];
  const trend = profile.history
    .filter((item) => item.movement)
    .slice(0, 6)
    .reverse();
  const trendMin = Math.min(...trend.map((item) => item.box));
  const trendMax = Math.max(...trend.map((item) => item.box));
  const trendCenter = (trendMin + trendMax) / 2;
  const trendStep = trendMax > trendMin ? Math.min(12, 36 / (trendMax - trendMin)) : 0;
  const historyBoxes = new Map<string, LadderBox>();
  for (const week of weeks) {
    for (const box of week.boxes) {
      for (const player of box.players) {
        if (player.name === profile.name) historyBoxes.set(`${player.dateKey}-${box.number}`, box);
      }
    }
  }
  const latestResult = profile.history.find((item) => item.total !== null && !item.substitute);
  const latestResultBox = latestResult ? historyBoxes.get(`${latestResult.dateKey}-${latestResult.box}`) : undefined;
  const latestResultWeek = latestResultBox ? weeks.find((week) => week.boxes.includes(latestResultBox)) : undefined;
  const latestSetRecord = latestResultBox?.setResults.reduce((record, set) => {
    const team = set.teams.find((candidate) => candidate.players.includes(profile.name));
    const opponent = set.teams.find((candidate) => candidate !== team);
    if (!team || !opponent) return record;
    return { played: record.played + 1, won: record.won + (team.games > opponent.games ? 1 : 0) };
  }, { played: 0, won: 0 }) || { played: 0, won: 0 };
  const recognition = latestResultWeek
    ? buildWeeklyAwards(latestResultWeek, weeks).flatMap((award) => {
      if (award.recipients.some((recipient) => recipient.name === profile.name)) {
        const label = award.kind === "player" ? "Player of the week" : award.title.replace(/s$/, "");
        return [label];
      }
      return award.honorableMentions?.some((recipient) => recipient.name === profile.name) ? ["Honorable mention"] : [];
    }).slice(0, 3)
    : [];

  async function shareProfile() {
    const logo = await loadShareLogo();
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawFitText = (text: string, x: number, y: number, maxWidth: number, maxSize: number, weight = 700) => {
      let size = maxSize;
      do {
        ctx.font = `${weight} ${size}px Arial`;
        size -= 2;
      } while (size > 28 && ctx.measureText(text).width > maxWidth);
      ctx.fillText(text, x, y);
    };

    ctx.fillStyle = "#11251e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawShareLogo(ctx, logo);
    ctx.textAlign = "right";
    ctx.fillStyle = "#a6b1a9";
    ctx.font = "500 24px Arial";
    ctx.fillText("PLAYER CARD", 1008, 116);
    ctx.textAlign = "left";
    ctx.fillStyle = "#f4f1e8";
    drawFitText(profile.name, 72, 285, 936, 82, 700);
    ctx.fillStyle = "#a6b1a9";
    ctx.font = "500 24px Arial";
    ctx.fillText("CURRENT LEAGUE POSITION", 72, 350);

    const movement = latestResult?.movement || "RESULT";
    const movementColor = movement === "UP" ? "#d9ff57" : movement === "DOWN" ? "#ff6b4a" : "#b7efdc";
    ctx.fillStyle = "#f4f1e8";
    ctx.fillRect(72, 390, 936, 430);
    ctx.fillStyle = "#d9ff57";
    ctx.fillRect(72, 390, 360, 430);
    ctx.fillStyle = "#11251e";
    ctx.font = "700 24px Arial";
    ctx.fillText("LEAGUE RANK", 112, 470);
    ctx.font = "800 160px Arial";
    ctx.fillText(profile.rank ? `#${profile.rank}` : "—", 105, 650);
    ctx.font = "700 31px Arial";
    ctx.fillText(`BOX ${profile.currentBox}`, 112, 725);
    ctx.textAlign = "left";

    ctx.fillStyle = "#647269";
    ctx.font = "500 24px Arial";
    ctx.fillText("LATEST COMPLETED WEEK", 480, 465);
    ctx.fillStyle = "#11251e";
    ctx.font = "800 48px Arial";
    ctx.fillText(movement, 480, 540);
    ctx.fillStyle = movementColor;
    ctx.fillRect(480, 558, 100, 10);
    ctx.fillStyle = "#647269";
    ctx.font = "500 22px Arial";
    ctx.fillText(latestResult?.date.toUpperCase() || "NO RESULT AVAILABLE", 480, 615);
    ctx.fillStyle = "#11251e";
    ctx.font = "700 30px Arial";
    ctx.fillText(
      latestSetRecord.played ? `${latestSetRecord.won} OF ${latestSetRecord.played} SETS WON` : "SET RESULTS UNAVAILABLE",
      480,
      675,
    );
    ctx.fillStyle = "#647269";
    ctx.font = "500 25px Arial";
    drawFitText(latestResult?.rawScore ? `SCORES  ${latestResult.rawScore}` : "", 480, 735, 470, 25, 500);

    let detailY = 900;
    if (profile.streak >= 2) {
      ctx.fillStyle = "#d9ff57";
      ctx.fillRect(72, detailY - 42, 936, 94);
      ctx.fillStyle = "#11251e";
      ctx.font = "800 37px Arial";
      ctx.fillText(`HOT STREAK  ·  ${profile.streak} CONSECUTIVE UP RESULTS`, 102, detailY + 15);
      detailY += 145;
    }

    if (recognition.length) {
      ctx.fillStyle = "#a6b1a9";
      ctx.font = "500 23px Arial";
      ctx.fillText("WEEKLY RECOGNITION", 72, detailY);
      detailY += 50;
      for (const award of recognition) {
        ctx.fillStyle = "#d9ff57";
        ctx.fillRect(72, detailY - 28, 22, 22);
        ctx.fillStyle = "#f4f1e8";
        drawFitText(award.toUpperCase(), 116, detailY, 890, 36, 700);
        detailY += 58;
      }
    } else if (profile.streak < 2) {
      ctx.fillStyle = "#a6b1a9";
      ctx.font = "500 23px Arial";
      ctx.fillText("SEASON TO DATE", 72, detailY);
      ctx.fillStyle = "#f4f1e8";
      ctx.font = "700 38px Arial";
      ctx.fillText(`${profile.setsWon} sets won  ·  ${profile.promotions} moves up`, 72, detailY + 58);
    }

    ctx.strokeStyle = "#3a4e46";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(72, 1240);
    ctx.lineTo(1008, 1240);
    ctx.stroke();
    ctx.fillStyle = "#d9ff57";
    ctx.font = "700 28px Arial";
    ctx.fillText("FIND YOUR BOX. CLIMB THE LADDER.", 72, 1295);
    ctx.textAlign = "right";
    ctx.fillStyle = "#a6b1a9";
    ctx.font = "500 22px Arial";
    ctx.fillText("PADEL LADDER", 1008, 1295);
    ctx.textAlign = "left";

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    await sharePng(blob, `${profile.name.replace(/\s+/g, "-").toLowerCase()}-ladder.png`);
  }

  return (
    <div className="panel-scrim" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="profile-panel" role="dialog" aria-modal="true" aria-label={`${profile.name} profile`}>
        <button className="icon-button panel-close" onClick={onClose} aria-label="Close profile"><X /></button>
        <div className="profile-hero">
          <span className="profile-avatar">{initials(profile.name)}</span>
          <div><span>PLAYER PROFILE</span><h2>{profile.name}</h2></div>
        </div>
        <div className="profile-position">
          <div className="profile-rank-highlight">
            <span>LEAGUE RANK</span>
            <strong>{profile.rank ? `#${profile.rank}` : "—"}</strong>
          </div>
          <button
            type="button"
            className="profile-box-position"
            onClick={onViewCurrentBox}
            disabled={!canViewCurrentBox}
            aria-label={`View upcoming matches for Box ${profile.currentBox}`}
          >
            <span>CURRENT BOX</span>
            <strong>BOX {profile.currentBox}</strong>
            <small>{latest?.time || ""} · Court {latest?.court || "TBD"}</small>
            {canViewCurrentBox ? <span className="profile-box-link">VIEW BOX <ArrowRight size={14} /></span> : null}
          </button>
        </div>
        <button className="share-card-button" onClick={shareProfile}><Share2 size={18} /> Share my ladder card</button>
        <div className="profile-stats">
          <div><strong>{profile.highestBox}</strong><span>Highest box</span></div>
          <div><strong>{profile.promotions}</strong><span>Moves up</span></div>
          <div><strong>{profile.rank ? `#${profile.rank}` : "—"}</strong><span>Current league rank</span></div>
          <div><strong>{profile.highestRank ? `#${profile.highestRank}` : "—"}</strong><span>Highest league rank</span></div>
          <div><strong>{profile.weeksPlayed}</strong><span>Weeks played</span></div>
          <div><strong>{profile.setsWon}</strong><span>Sets won</span></div>
        </div>
        <section className="history-section">
          <h3>Recent Box Form</h3>
          <div className="trend-line">
            {trend.map((item) => (
              <span
                key={`${item.dateKey}-${item.box}`}
                className={item.movement.toLowerCase()}
                style={{ transform: `translateY(${(item.box - trendCenter) * trendStep}px)` }}
                title={`${item.date}: Box ${item.box}`}
              >
                {item.box}
              </span>
            ))}
          </div>
          <h3>Weekly Ladder Rank</h3>
          <RankingTrend history={profile.rankingHistory} />
          <h3>Results</h3>
          <div className="history-list">
            {profile.history.filter((item) => item.total !== null).slice(0, 8).map((item) => {
              const box = historyBoxes.get(`${item.dateKey}-${item.box}`);
              return (
                <details key={`${item.dateKey}-${item.box}`}>
                  <summary>
                    <span className="history-copy"><strong>{item.date}</strong><small>Box {item.box} · {item.rawScore}</small></span>
                    <span className="history-actions">
                      {item.movement ? (
                        <span className={`movement-badge ${item.movement.toLowerCase()}`} aria-label={item.movement} title={item.movement}>
                          {movementIcon(item.movement)}
                        </span>
                      ) : null}
                      <ChevronDown className="history-chevron" size={17} aria-hidden="true" />
                    </span>
                  </summary>
                  {box?.setResults.length ? <SetResults box={box} /> : <p className="history-empty">Set details are not available.</p>}
                </details>
              );
            })}
          </div>
        </section>
      </aside>
    </div>
  );
}

function RankingView({ profiles, onSelect }: { profiles: PlayerProfile[]; onSelect: (name: string) => void }) {
  const ranked = profiles
    .filter((profile) => profile.rank !== null)
    .sort((left, right) => (left.rank || 0) - (right.rank || 0));

  return (
    <div className="ranking-table">
      <header><span>RANK</span><span>PLAYER</span><span>LAST 5</span></header>
      {ranked.map((profile) => {
        const recentResults = recentMovementSequence(profile, 5);
        return (
          <button key={profile.name} onClick={() => onSelect(profile.name)}>
            <strong className="club-rank">#{profile.rank}</strong>
            <span className="ranking-player"><span className="avatar small">{initials(profile.name)}</span><strong>{profile.name}</strong></span>
            <span className="recent-movements" aria-label={`${profile.name} last five results, oldest to newest`}>
              {recentResults.map((result) => (
                <span key={`${result.dateKey}-${result.box}`} className={`movement-badge ${result.movement.toLowerCase()}`} title={`${result.date}: ${result.movement.toLowerCase()}`}>
                  {movementIcon(result.movement)}
                </span>
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function StatsView({ profiles, onSelect }: { profiles: PlayerProfile[]; onSelect: (name: string) => void }) {
  const active = profiles.filter((profile) => profile.weeksPlayed > 0);
  const climbers = [...active].sort((a, b) => b.promotions - a.promotions || a.currentBox - b.currentBox).slice(0, 8);
  const setWinners = [...active].sort((a, b) => b.setsWon - a.setsWon || b.setsPlayed - a.setsPlayed || a.currentBox - b.currentBox).slice(0, 8);
  const hot = [...active].filter((profile) => profile.streak >= 2).sort((a, b) => b.streak - a.streak || b.promotions - a.promotions).slice(0, 5);
  return (
    <div className="stats-layout">
      <section className="hot-card">
        <header><Flame size={20} /><h3>Hot streaks</h3></header>
        <div>{hot.length ? hot.map((profile) => <button key={profile.name} onClick={() => onSelect(profile.name)}><strong>{profile.name}</strong><span>{profile.streak}× UP</span></button>) : <p className="hot-empty">No active UP streaks.</p>}</div>
      </section>
      <section className="leaderboard-card">
        <header><Trophy size={20} /><h3>Most moves up</h3></header>
        {climbers.map((profile, index) => (
          <button key={profile.name} onClick={() => onSelect(profile.name)}>
            <span className="rank">{index + 1}</span><span className="avatar small">{initials(profile.name)}</span>
            <span className="leader-name"><strong>{profile.name}</strong><small>Current box: {profile.currentBox}</small></span>
            <strong className="lime-number">{profile.promotions}</strong>
          </button>
        ))}
      </section>
      <section className="leaderboard-card">
        <header>
          <CircleCheckBig size={20} />
          <div>
            <div className="leaderboard-title"><h3>Most sets won</h3><button type="button" className="leaderboard-info" aria-label="About most sets won" aria-describedby="sets-won-detail"><Info size={13} /><span id="sets-won-detail" className="leaderboard-tooltip" role="tooltip">Substitute sets are excluded.</span></button></div>
          </div>
        </header>
        {setWinners.map((profile, index) => (
          <button key={profile.name} onClick={() => onSelect(profile.name)}>
            <span className="rank">{index + 1}</span><span className="avatar small">{initials(profile.name)}</span>
            <span className="leader-name"><strong>{profile.name}</strong><small>{profile.setsPlayed} sets played</small></span>
            <strong className="lime-number">{profile.setsWon}</strong>
          </button>
        ))}
      </section>
    </div>
  );
}

function CompareView({ profiles, weeks, onSelect }: { profiles: PlayerProfile[]; weeks: LadderWeek[]; onSelect: (name: string) => void }) {
  const active = profiles
    .filter((profile) => profile.weeksPlayed > 0)
    .sort((a, b) => firstName(a.name).localeCompare(firstName(b.name)) || a.name.localeCompare(b.name));
  const [leftName, setLeftName] = useState(active[0]?.name || "");
  const [rightName, setRightName] = useState(active[1]?.name || "");
  const left = active.find((profile) => profile.name === leftName);
  const right = active.find((profile) => profile.name === rightName);
  const headToHead = left && right ? buildHeadToHeadRecord(weeks, left.name, right.name) : null;
  const sharedBoxes = left && right
    ? weeks
      .filter((week) => week.completed)
      .flatMap((week) => week.boxes.flatMap((box) => {
        const leftPlayer = box.players.find((player) => player.name === left.name);
        const rightPlayer = box.players.find((player) => player.name === right.name);
        return leftPlayer && rightPlayer && !leftPlayer.substitute && !rightPlayer.substitute
          ? [{ box, date: week.date, dateKey: week.dateKey }]
          : [];
      }))
      .sort((first, second) => second.dateKey.localeCompare(first.dateKey))
    : [];
  const metrics = left && right ? [
    ["Sets H2H", headToHead?.leftSetsWonAgainst || 0, headToHead?.rightSetsWonAgainst || 0, "higher"],
    ["League rank", left.rank || 0, right.rank || 0, "lower"],
    ["Current box", left.currentBox, right.currentBox, "lower"],
    ["Highest box", left.highestBox, right.highestBox, "lower"],
    ["Moves up", left.promotions, right.promotions, "higher"],
    ["Weeks played", left.weeksPlayed, right.weeksPlayed, "higher"],
    ["Sets won", left.setsWon, right.setsWon, "higher"],
    ["Games won", left.totalGames, right.totalGames, "higher"],
  ] as const : [];

  async function shareHeadToHead() {
    if (!left || !right || !headToHead) return;
    const logo = await loadShareLogo();
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawFitText = (text: string, x: number, y: number, maxWidth: number, maxSize: number, weight = 700) => {
      let size = maxSize;
      do {
        ctx.font = `${weight} ${size}px Arial`;
        size -= 2;
      } while (size > 26 && ctx.measureText(text).width > maxWidth);
      ctx.fillText(text, x, y);
    };

    ctx.fillStyle = "#11251e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawShareLogo(ctx, logo);
    ctx.textAlign = "right";
    ctx.fillStyle = "#a6b1a9";
    ctx.font = "500 24px Arial";
    ctx.fillText("HEAD TO HEAD", 1008, 116);

    ctx.textAlign = "left";
    ctx.fillStyle = "#f4f1e8";
    drawFitText(left.name, 72, 275, 420, 60, 700);
    ctx.textAlign = "right";
    drawFitText(right.name, 1008, 275, 420, 60, 700);
    ctx.textAlign = "center";
    ctx.fillStyle = "#d9ff57";
    ctx.font = "800 28px Arial";
    ctx.fillText("VS", 540, 269);

    ctx.fillStyle = "#d9ff57";
    ctx.fillRect(72, 315, 936, 190);
    ctx.textAlign = "center";
    ctx.fillStyle = "#11251e";
    ctx.font = "800 112px Arial";
    ctx.fillText(String(headToHead.leftSetsWonAgainst), 370, 437);
    ctx.fillText(String(headToHead.rightSetsWonAgainst), 710, 437);
    ctx.beginPath();
    ctx.arc(540, 410, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d9ff57";
    ctx.font = "800 24px Arial";
    ctx.fillText("VS", 540, 401);
    ctx.font = "700 18px Arial";
    ctx.fillText("SETS", 540, 430);

    ctx.fillStyle = "#f4f1e8";
    ctx.fillRect(72, 545, 444, 170);
    ctx.fillRect(564, 545, 444, 170);
    ctx.textAlign = "left";
    ctx.fillStyle = "#647269";
    ctx.font = "500 21px Arial";
    ctx.fillText("LEAGUE RANK", 112, 603);
    ctx.fillStyle = "#11251e";
    ctx.font = "800 68px Arial";
    ctx.fillText(left.rank ? `#${left.rank}` : "—", 108, 680);
    ctx.textAlign = "right";
    ctx.font = "700 27px Arial";
    ctx.fillText(`BOX ${left.currentBox}`, 476, 673);
    ctx.textAlign = "left";
    ctx.fillStyle = "#647269";
    ctx.font = "500 21px Arial";
    ctx.fillText("LEAGUE RANK", 604, 603);
    ctx.fillStyle = "#11251e";
    ctx.font = "800 68px Arial";
    ctx.fillText(right.rank ? `#${right.rank}` : "—", 600, 680);
    ctx.textAlign = "right";
    ctx.font = "700 27px Arial";
    ctx.fillText(`BOX ${right.currentBox}`, 968, 673);

    ctx.textAlign = "left";
    metrics.slice(2).forEach(([label, leftValue, rightValue], index) => {
      const y = 770 + index * 62;
      ctx.strokeStyle = "#3a4e46";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(72, y - 35);
      ctx.lineTo(1008, y - 35);
      ctx.stroke();
      ctx.fillStyle = "#f4f1e8";
      ctx.font = "800 30px Arial";
      ctx.textAlign = "left";
      ctx.fillText(String(leftValue), 72, y);
      ctx.textAlign = "center";
      ctx.fillStyle = "#a6b1a9";
      ctx.font = "500 18px Arial";
      ctx.fillText(label.toUpperCase(), 540, y - 2);
      ctx.fillStyle = "#f4f1e8";
      ctx.font = "800 30px Arial";
      ctx.textAlign = "right";
      ctx.fillText(String(rightValue), 1008, y);
    });

    ctx.strokeStyle = "#3a4e46";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(72, 1240);
    ctx.lineTo(1008, 1240);
    ctx.stroke();
    ctx.fillStyle = "#d9ff57";
    ctx.font = "700 28px Arial";
    ctx.fillText("FIND YOUR BOX. CLIMB THE LADDER.", 72, 1295);
    ctx.textAlign = "right";
    ctx.fillStyle = "#a6b1a9";
    ctx.font = "500 22px Arial";
    ctx.fillText("PADEL LADDER", 1008, 1295);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    const fileName = `${left.name}-vs-${right.name}-padel.png`.replace(/\s+/g, "-").toLowerCase();
    await sharePng(blob, fileName);
  }

  return (
    <div className="compare-card">
      <div className="compare-pickers">
        <label><span>PLAYER ONE</span><select value={leftName} onChange={(event) => setLeftName(event.target.value)}>{active.map((profile) => <option key={profile.name}>{profile.name}</option>)}</select></label>
        <span className="versus">VS</span>
        <label><span>PLAYER TWO</span><select value={rightName} onChange={(event) => setRightName(event.target.value)}>{active.map((profile) => <option key={profile.name}>{profile.name}</option>)}</select></label>
      </div>
      {left && right ? <>
        <div className="compare-names">
          <button onClick={() => onSelect(left.name)}><span className="profile-avatar mini">{initials(left.name)}</span><strong>{left.name}</strong></button>
          <button onClick={() => onSelect(right.name)}><span className="profile-avatar mini">{initials(right.name)}</span><strong>{right.name}</strong></button>
        </div>
        <button className="share-card-button compare-share-button" onClick={shareHeadToHead}><Share2 size={18} /> Share head-to-head card</button>
        <div className="metric-list">
          {metrics.map(([label, a, b, preference]) => {
            const leftWins = preference === "lower" ? Number(a) < Number(b) : Number(a) > Number(b);
            const rightWins = preference === "lower" ? Number(b) < Number(a) : Number(b) > Number(a);
            return <div key={label}><strong className={leftWins ? "winner" : ""}>{a}</strong><span>{label}</span><strong className={rightWins ? "winner" : ""}>{b}</strong></div>;
          })}
        </div>
        <section className="shared-boxes" aria-labelledby="shared-boxes-title">
          <header>
            <UsersRound size={20} />
            <div><span id="shared-boxes-title">Shared box sessions</span><strong>{sharedBoxes.length}</strong></div>
          </header>
          <div className="shared-session-list">
            {sharedBoxes.length ? sharedBoxes.map(({ box, date, dateKey }) => (
              <article key={`${dateKey}-${box.number}`} className="shared-session">
                <header><strong>{date}</strong><span>Box {box.number} · Court {box.court}</span></header>
                {box.setResults.length ? <SetResults box={box} /> : <p>Set results are not available.</p>}
              </article>
            )) : <p>No completed shared box sessions.</p>}
          </div>
        </section>
      </> : null}
    </div>
  );
}

export function LadderApp({ data, section }: { data: LadderData; section: LadderSection }) {
  const router = useRouter();
  const [statsMode, setStatsMode] = useState<StatsMode>("leaders");
  const [resultsWeekKey, setResultsWeekKey] = useState(data.latestCompleted?.dateKey || "");
  const [query, setQuery] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const profiles = useMemo(() => new Map(data.profiles.map((profile) => [profile.name, profile])), [data.profiles]);
  const resultsWeeks = useMemo(() => data.weeks.filter((candidate) => candidate.completed), [data.weeks]);
  const searchResults = query.trim().length > 1
    ? data.profiles.filter((profile) => profile.name.toLowerCase().includes(query.toLowerCase())).slice(0, 7)
    : [];
  const selected = selectedName ? profiles.get(selectedName) : undefined;
  const resultsWeek = resultsWeeks.find((candidate) => candidate.dateKey === resultsWeekKey) || data.latestCompleted;
  const resultsWeekIndex = resultsWeeks.findIndex((candidate) => candidate.dateKey === resultsWeek?.dateKey);
  const previousResultsWeek = resultsWeeks[resultsWeekIndex - 1];
  const nextResultsWeek = resultsWeeks[resultsWeekIndex + 1];
  const week = section === "week" ? data.upcoming : resultsWeek;

  function viewUpcomingBox(box: number) {
    if (!data.upcoming?.boxes.some((candidate) => candidate.number === box)) return;
    setSelectedName(null);
    router.push(`/#box-${box}`);
  }

  const destinations: { id: LadderSection; href: string; label: string; mobileLabel: string; icon: React.ReactNode }[] = [
    { id: "week", href: "/", label: "Upcoming", mobileLabel: "Upcoming", icon: <CalendarDays size={18} /> },
    { id: "results", href: "/results", label: "Results", mobileLabel: "Results", icon: <CircleCheckBig size={18} /> },
    { id: "stats", href: "/stats", label: "Stats", mobileLabel: "Stats", icon: <ListOrdered size={18} /> },
    { id: "head-to-head", href: "/head-to-head", label: "Head to Head", mobileLabel: "H2H", icon: <UsersRound size={18} /> },
  ];

  return (
    <main className="ladder-app">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Open this week's ladder">
          <Image className="header-logo" src="/my-league-live-logo.png" width={677} height={254} alt="My League Live" unoptimized />
        </Link>
      </header>
      <nav className="primary-nav" aria-label="Ladder sections">
        {destinations.map((item) => (
          <Link key={item.id} href={item.href} className={section === item.id ? "active" : ""} aria-current={section === item.id ? "page" : undefined}>
            {item.icon}
            <span className="nav-label-desktop">{item.label}</span>
            <span className="nav-label-mobile">{item.mobileLabel}</span>
          </Link>
        ))}
      </nav>

      {section === "week" ? <><section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><i /> PADEL+PICKLE ST. LOUIS</span>
          <h1>Find your box.<br /><em>Climb the ladder.</em></h1>
          <p>Upcoming matches, weekly results, league stats and more.</p>
        </div>
        <HeroScoreboard />
        <HeroOrbit />
      </section>

      <section className="search-wrap">
        <Search size={21} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a player…" aria-label="Find a player" />
        {query ? <button onClick={() => setQuery("")} aria-label="Clear search"><X size={18} /></button> : null}
        {searchResults.length ? <div className="search-results">{searchResults.map((profile) => <button key={profile.name} onClick={() => { setSelectedName(profile.name); setQuery(""); }}><span className="avatar small">{initials(profile.name)}</span><span><strong>{profile.name}</strong><small>{profile.rank ? `#${profile.rank} in club · ` : ""}Box {profile.currentBox}</small></span><ChevronRight size={18} /></button>)}</div> : null}
      </section>
      </> : null}

      <section className="content-shell">
        {section === "week" ? <>
          <div className="section-head">
            <div>
              <h2>Upcoming matches</h2>
              <p>{week?.date || "Date to be announced"} · Match times and courts.</p>
            </div>
            <Link className="ladder-view-switch" href="/results">View past results <ArrowRight size={17} /></Link>
          </div>
          <LadderGrid
            week={week}
            profiles={profiles}
            showResult={false}
            showRecentResults
            showSubstituteOnly
            showWeekday
            onSelect={setSelectedName}
          />
        </> : null}

        {section === "results" ? <>
          <div className="section-head">
            <div><h2>Weekly results</h2><p>Review scores and ladder movement by week.</p></div>
          </div>
          {resultsWeek ? (
            <div className="results-week-nav" aria-label="Results week navigation">
              <button
                type="button"
                disabled={!previousResultsWeek}
                onClick={() => previousResultsWeek && setResultsWeekKey(previousResultsWeek.dateKey)}
                aria-label="Previous results week"
              >
                <ChevronLeft size={24} strokeWidth={2.5} />
              </button>
              <div>
                <span>WEEK {resultsWeekIndex + 1}</span>
                <strong>{resultsWeek.date}</strong>
              </div>
              <button
                type="button"
                disabled={!nextResultsWeek}
                onClick={() => nextResultsWeek && setResultsWeekKey(nextResultsWeek.dateKey)}
                aria-label="Next results week"
              >
                <ChevronRight size={24} strokeWidth={2.5} />
              </button>
            </div>
          ) : null}
          {resultsWeek ? <WeeklyAwards week={resultsWeek} weeks={data.weeks} /> : null}
          {resultsWeek ? <h3 className="results-label">Results</h3> : null}
          <LadderGrid
            week={resultsWeek}
            profiles={profiles}
            showResult
            showRecentResults={false}
            showSubstituteOnly
            showWeekday
            onSelect={setSelectedName}
          />
        </> : null}

        {section === "stats" ? <>
          <div className="section-head"><div><h2>League numbers</h2></div></div>
          <div className="stats-tabs" aria-label="Stats views">
            <button type="button" className={statsMode === "leaders" ? "active" : ""} aria-pressed={statsMode === "leaders"} onClick={() => setStatsMode("leaders")}>Stats</button>
            <button type="button" className={statsMode === "ranking" ? "active" : ""} aria-pressed={statsMode === "ranking"} onClick={() => setStatsMode("ranking")}>Ranking</button>
          </div>
          {statsMode === "leaders" ? <StatsView profiles={data.profiles} onSelect={setSelectedName} /> : <>
            <p className="ranking-explanation">Your ladder rank is your place in the next round of boxes. Movement sets the first and last positions in each box. Recent non-sub game totals order the players who stay.</p>
            <RankingView profiles={data.profiles} onSelect={setSelectedName} />
          </>}
        </> : null}

        {section === "head-to-head" ? <><div className="section-head compare-section-head"><div><h2>Compare players</h2></div></div><CompareView profiles={data.profiles} weeks={data.weeks} onSelect={setSelectedName} /></> : null}
      </section>

      <footer>Built by Igor Aguiar</footer>
      {selected ? (
        <ProfilePanel
          profile={selected}
          weeks={data.weeks}
          canViewCurrentBox={Boolean(data.upcoming?.boxes.some((box) => box.number === selected.currentBox))}
          onViewCurrentBox={() => viewUpcomingBox(selected.currentBox)}
          onClose={() => setSelectedName(null)}
        />
      ) : null}
    </main>
  );
}
