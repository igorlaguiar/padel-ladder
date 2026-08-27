"use client";

import {
  ArrowDown,
  ArrowRight,
  ArrowRightLeft,
  ArrowUp,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  CircleCheckBig,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Crown,
  Flame,
  House,
  History,
  Info,
  ListOrdered,
  Medal,
  Percent,
  RefreshCw,
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
import type { CareerProfile, ConfirmedSetResult, LadderBox, LadderData, LadderWeek, Movement, PlayerProfile, PlayerResult, SeasonData, SeasonDefinition } from "@/lib/types";
import { boxHasResult, buildHeadToHeadRecord, buildLadderData, isRosterStatAppearance, sortBoxPlayers } from "@/lib/ladder";
import { buildLeagueHighlights, type LeagueHighlightKind } from "@/lib/leagueHighlights";
import { buildWeeklyAwards, type WeeklyAwardKind } from "@/lib/weeklyAwards";
import { buildCareerProfiles, SEASON_SHEETS } from "@/lib/seasons";

export type LadderSection = "home" | "upcoming" | "results" | "stats" | "head-to-head" | "seasons" | "season";
type StatsMode = "leaders" | "ranking";

const SELECTED_PLAYER_STORAGE_KEY = "my-league-live.selected-player";
const INSTALL_BANNER_DISMISSAL_STORAGE_KEY = "my-league-live.install-banner-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function InstallPromptBanner() {
  const [platform, setPlatform] = useState<"ios" | "android" | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(true);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(userAgent) || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
    const isAndroid = /Android/.test(userAgent);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (isStandalone || (!isIos && !isAndroid)) return;

    setPlatform(isIos ? "ios" : "android");
    setIsDismissed(window.localStorage.getItem(INSTALL_BANNER_DISMISSAL_STORAGE_KEY) === "true");

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  function dismiss() {
    window.localStorage.setItem(INSTALL_BANNER_DISMISSAL_STORAGE_KEY, "true");
    setIsDismissed(true);
    setShowInstructions(false);
  }

  async function installOnAndroid() {
    if (!installPrompt) return;
    const prompt = installPrompt;
    setInstallPrompt(null);
    const result = await prompt.prompt();
    if (result.outcome === "accepted") setIsInstalled(true);
  }

  if (!platform || isDismissed || (platform === "android" && !installPrompt && !isInstalled)) return null;

  return (
    <>
      <aside className={`install-prompt${isInstalled ? " is-installed" : ""}`} aria-label="Install MyLeague">
        <div className="install-prompt-copy">
          <strong>{isInstalled ? "Installed. Open MyLeague from your Home Screen." : "Use MyLeague like an app."}</strong>
        </div>
        <div className="install-prompt-controls">
          {isInstalled ? null : <button type="button" className="install-prompt-action" onClick={platform === "ios" ? () => setShowInstructions(true) : installOnAndroid}>Install</button>}
          <button type="button" className="install-prompt-dismiss" onClick={dismiss} aria-label="Dismiss install prompt"><X size={18} /></button>
        </div>
      </aside>

      {showInstructions ? <div className="install-instructions-backdrop" role="presentation" onClick={() => setShowInstructions(false)}>
        <section className="install-instructions" role="dialog" aria-modal="true" aria-labelledby="install-instructions-title" onClick={(event) => event.stopPropagation()}>
          <div className="install-instructions-head">
            <div><span>INSTALL MYLEAGUE</span><h2 id="install-instructions-title">Add it to your Home Screen.</h2></div>
            <button type="button" onClick={() => setShowInstructions(false)} aria-label="Close install instructions"><X size={20} /></button>
          </div>
          <ol>
            <li><Share2 size={19} /><span>Open this page in Safari and tap <strong>Share</strong>.</span></li>
            <li><House size={19} /><span>Select <strong>Add to Home Screen</strong>.</span></li>
            <li><CircleCheckBig size={19} /><span>Tap <strong>Add</strong>. Later, open MyLeague from your Home Screen.</span></li>
          </ol>
          <button type="button" className="install-instructions-done" onClick={() => setShowInstructions(false)}>Got it</button>
        </section>
      </div> : null}
    </>
  );
}

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
    logo.src = "/my-league-live-logo-dark.png";
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
  pendingResult,
  showRecentResults,
  showSubstituteOnly,
  isSelectedPlayer,
  onSelect,
  index,
}: {
  player: PlayerResult;
  profile?: PlayerProfile;
  showResult: boolean;
  pendingResult: boolean;
  showRecentResults: boolean;
  showSubstituteOnly: boolean;
  isSelectedPlayer: boolean;
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
        <span className={`avatar${isSelectedPlayer ? " is-selected-player" : ""}`}>{initials(player.name)}</span>
        {showRecentResults && profile && profile.streak >= 2 ? (
          <span className="streak-fire" aria-label={`${profile.streak}-week UP streak`} title={`${profile.streak}-week UP streak`}>🔥</span>
        ) : null}
      </span>
      <span className="player-copy">
        <strong className={showResult && player.substitute ? "substitute-name" : undefined}>
          <span>{showResult && player.substitute ? player.substitute : player.name}</span>
          {showResult && player.substitute ? <ArrowRightLeft className="substitute-icon" size={14} aria-hidden="true" /> : null}
        </strong>
        {player.substitute ? <small>{showResult ? `For: ${player.name}` : `Sub: ${player.substitute}`}</small> : showSubstituteOnly ? null : <small>{movement ? `Last: ${movement.toLowerCase()}` : "Ready to play"}</small>}
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
      ) : pendingResult ? <span className="pending-result-mark" aria-label="Result not reported">?</span> : movement ? <span className={`movement-badge ${movement.toLowerCase()}`}>{movementIcon(movement)}</span> : <ChevronRight size={18} />}
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
  selectedPlayerName,
  onSelect,
}: {
  box: LadderBox;
  profiles: Map<string, PlayerProfile>;
  showResult: boolean;
  showRecentResults: boolean;
  showSubstituteOnly: boolean;
  showWeekday: boolean;
  selectedPlayerName?: string | null;
  onSelect: (name: string) => void;
}) {
  const awaitingResult = showResult && !boxHasResult(box);
  const orderedPlayers = sortBoxPlayers(box.players, showResult ? "result" : "ranking", [...profiles.values()]
    .filter((profile) => profile.rank !== null)
    .map((profile) => ({ name: profile.name, rank: profile.rank!, box: profile.currentBox, movement: "" as Movement })));
  return (
    <article className={`box-card${awaitingResult ? " awaiting-result" : ""}`} id={`box-${box.number}`}>
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
            pendingResult={awaitingResult}
            showRecentResults={showRecentResults}
            showSubstituteOnly={showSubstituteOnly}
            isSelectedPlayer={player.name === selectedPlayerName}
            onSelect={() => onSelect(player.name)}
            index={index}
          />
        ))}
      </div>
      {awaitingResult ? <p className="awaiting-result-label">Result not reported yet</p> : null}
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

  async function shareWeeklyAwards() {
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
      } while (size > 22 && ctx.measureText(text).width > maxWidth);
      ctx.fillText(text, x, y);
    };

    const wrapText = (text: string, maxWidth: number) => {
      const lines: string[] = [];
      let line = "";
      text.split(/\s+/).forEach((word) => {
        const candidate = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(candidate).width > maxWidth) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      });
      if (line) lines.push(line);
      return lines;
    };

    const drawWrappedFitText = (
      text: string,
      x: number,
      y: number,
      maxWidth: number,
      maxSize: number,
      minSize: number,
      maxLines: number,
      weight = 700,
      lineHeightRatio = 1.12,
    ) => {
      let size = maxSize;
      let lines: string[] = [];
      do {
        ctx.font = `${weight} ${size}px Arial`;
        lines = wrapText(text, maxWidth);
        if (lines.length <= maxLines) break;
        size -= 2;
      } while (size >= minSize);
      const lineHeight = size * lineHeightRatio;
      lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
      return y + (lines.length - 1) * lineHeight;
    };

    const drawAwardCard = (
      award: (typeof awards)[number],
      x: number,
      y: number,
      width: number,
      height: number,
      background: string,
      featured = false,
    ) => {
      const dark = "#11251e";
      const muted = "#586a61";
      const padding = featured ? 40 : 32;
      ctx.fillStyle = background;
      ctx.fillRect(x, y, width, height);

      ctx.textAlign = "left";
      ctx.fillStyle = dark;
      ctx.font = `800 ${featured ? 22 : 18}px Arial`;
      ctx.fillText(award.title.toUpperCase(), x + padding, y + (featured ? 48 : 42));

      ctx.textAlign = "left";
      ctx.fillStyle = dark;
      let namesBottom: number;
      if (award.kind === "personal-best") {
        const lineHeight = 38;
        const nameSize = 25;
        const startY = y + 91;
        award.recipients.forEach((recipient, recipientIndex) => {
          const lineY = startY + recipientIndex * lineHeight;
          ctx.fillStyle = dark;
          ctx.font = `800 ${nameSize}px Arial`;
          ctx.fillText(recipient.name, x + padding, lineY);
          const nameWidth = ctx.measureText(recipient.name).width;
          if (recipient.note) {
            ctx.fillStyle = muted;
            ctx.font = "700 16px Arial";
            ctx.fillText(recipient.note, x + padding + nameWidth + 10, lineY);
          }
        });
        namesBottom = startY + (award.recipients.length - 1) * lineHeight;
      } else {
        const recipients = award.recipients.map((recipient) => recipient.name).join(" · ");
        namesBottom = drawWrappedFitText(
          recipients,
          x + padding,
          y + (featured ? 118 : 91),
          width - padding * 2,
          featured ? 60 : width > 600 ? 42 : 31,
          featured ? 38 : width > 600 ? 30 : 23,
          featured ? 2 : 3,
          800,
        );
      }

      const notes = award.kind === "personal-best"
        ? []
        : award.recipients.flatMap((recipient) => recipient.note ? [`${recipient.name} · ${recipient.note}`] : []);
      const honorable = award.honorableMentions?.length
        ? `Honorable · ${award.honorableMentions.map((recipient) => recipient.name).join(" · ")}`
        : "";
      const secondary = [...notes, honorable].filter(Boolean).join("   ");
      if (secondary) {
        ctx.fillStyle = muted;
        drawWrappedFitText(
          secondary,
          x + padding,
          namesBottom + (featured ? 30 : 27),
          width - padding * 2,
          width > 600 ? 21 : 18,
          15,
          width > 600 ? 2 : 4,
          600,
          1.25,
        );
      }

      ctx.fillStyle = muted;
      ctx.font = `500 ${featured ? 19 : 17}px Arial`;
      ctx.fillText(award.detail, x + padding, y + height - 25);
    };

    ctx.fillStyle = "#11251e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawShareLogo(ctx, logo);
    ctx.textAlign = "right";
    ctx.fillStyle = "#a6b1a9";
    ctx.font = "500 24px Arial";
    ctx.fillText("PADEL+PiCKLE STL", 1008, 116);

    ctx.textAlign = "left";
    ctx.fillStyle = "#d9ff57";
    ctx.font = "800 25px Arial";
    ctx.fillText("WEEKLY AWARDS", 72, 245);
    ctx.fillStyle = "#f4f1e8";
    drawFitText(week.date, 72, 325, 936, 62, 700);

    drawAwardCard(awards[0], 72, 375, 936, awards.length === 1 ? 430 : 210, "#d9ff57", true);
    if (awards.length === 2) {
      drawAwardCard(awards[1], 72, 609, 936, 410, "#b9ebdc");
    } else if (awards.length === 3) {
      drawAwardCard(awards[1], 72, 609, 456, 430, "#b9ebdc");
      drawAwardCard(awards[2], 552, 609, 456, 430, "#f4f1e8");
    } else if (awards.length >= 4) {
      drawAwardCard(awards[1], 72, 609, 936, 220, "#b9ebdc");
      drawAwardCard(awards[2], 72, 853, 456, 330, "#f4f1e8");
      drawAwardCard(awards[3], 552, 853, 456, 330, "#f4f1e8");
    }

    ctx.strokeStyle = "#3a4e46";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(72, 1240);
    ctx.lineTo(1008, 1240);
    ctx.stroke();
    ctx.fillStyle = "#d9ff57";
    ctx.font = "700 28px Arial";
    ctx.textAlign = "left";
    ctx.fillText("FIND YOUR BOX. CLIMB THE LADDER.", 72, 1295);
    ctx.textAlign = "right";
    ctx.fillStyle = "#a6b1a9";
    ctx.font = "500 22px Arial";
    ctx.fillText("WEEKLY AWARDS", 1008, 1295);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    await sharePng(blob, `${week.dateKey}-weekly-awards.png`);
  }

  return (
    <section className="weekly-awards" aria-labelledby="weekly-awards-title">
      <header>
        <h3 id="weekly-awards-title">Awards</h3>
        <button type="button" className="weekly-share-button" onClick={shareWeeklyAwards}><Share2 size={16} /> Share awards card</button>
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
                      <span id={`award-${award.kind}-honorable`} className="award-tooltip" role="tooltip">Won all three sets this week.</span>
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
  selectedPlayerName,
  onSelect,
}: {
  week: LadderWeek | null;
  profiles: Map<string, PlayerProfile>;
  showResult: boolean;
  showRecentResults?: boolean;
  showSubstituteOnly?: boolean;
  showWeekday?: boolean;
  selectedPlayerName?: string | null;
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
          selectedPlayerName={selectedPlayerName}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function RankingTrend({ history }: { history: PlayerProfile["rankingHistory"] }) {
  const points = history.slice(-6);
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

function BoxTrend({ history, rankings }: { history: PlayerResult[]; rankings: PlayerProfile["rankingHistory"] }) {
  const weekByDate = new Map(rankings.map((point) => [point.dateKey, point.week]));
  const points = history.filter((item) => item.movement).slice(0, 6).reverse().map((item, index) => ({ ...item, week: weekByDate.get(item.dateKey) || index + 1 }));
  if (!points.length) return <div className="ranking-trend-empty">Box history is not available.</div>;
  const boxes = points.map((point) => point.box);
  const minBox = Math.min(...boxes);
  const maxBox = Math.max(...boxes);
  const coordinates = points.map((point, index) => ({ ...point, x: points.length === 1 ? 210 : 24 + (index * 372) / (points.length - 1), y: minBox === maxBox ? 52 : 18 + ((point.box - minBox) * 68) / (maxBox - minBox) }));
  return <div className="ranking-trend box-trend"><svg viewBox="0 0 420 118" role="img" aria-label={`Weekly box position from Box ${points[0].box} to Box ${points.at(-1)?.box}`}><line x1="24" y1="86" x2="396" y2="86" />{coordinates.length > 1 ? <polyline points={coordinates.map((point) => `${point.x},${point.y}`).join(" ")} /> : null}{coordinates.map((point) => <g key={point.dateKey} className={point.movement.toLowerCase()}><circle cx={point.x} cy={point.y} r="12" /><text x={point.x} y={point.y + 4} textAnchor="middle">{point.box}</text><text className="week-label" x={point.x} y="110" textAnchor="middle">W{point.week}</text></g>)}</svg></div>;
}

function ProfilePanel({
  profile: initialProfile,
  seasons,
  career,
  initialSeasonId,
  canViewCurrentBox,
  onViewCurrentBox,
  onViewSeasonRank,
  isSelectedPlayer,
  onToggleSelectedPlayer,
  onClose,
}: {
  profile: PlayerProfile;
  seasons: SeasonData[];
  career?: CareerProfile;
  initialSeasonId: SeasonDefinition["id"];
  canViewCurrentBox: boolean;
  onViewCurrentBox: () => void;
  onViewSeasonRank: (season: SeasonDefinition) => void;
  isSelectedPlayer: boolean;
  onToggleSelectedPlayer: (name: string) => void;
  onClose: () => void;
}) {
  const initialSeason = career?.seasons.find((entry) => entry.season.id === initialSeasonId) || career?.seasons.find((entry) => entry.season.status === "current") || career?.seasons[0];
  const [profileScope, setProfileScope] = useState<string>(initialSeason?.season.id || "career");
  const seasonEntry = career?.seasons.find((entry) => entry.season.id === profileScope);
  const profile = seasonEntry?.profile || initialProfile;
  const isCareer = profileScope === "career";
  const isCurrentSeason = seasonEntry?.season.status === "current";
  const weeks = seasons.find((entry) => entry.season.id === seasonEntry?.season.id)?.data.weeks || [];
  const latest = profile.history[0];
  const boxRangeCount = profile.history.filter((item) => item.movement).slice(0, 6).length;
  const rankRangeCount = profile.rankingHistory.slice(-6).length;
  const historyBoxes = new Map<string, LadderBox>();
  for (const week of weeks) {
    for (const box of week.boxes) {
      for (const player of box.players) {
        if (player.name === profile.name) historyBoxes.set(`${player.dateKey}-${box.number}`, box);
      }
    }
  }
  const latestResult = profile.history.find(isRosterStatAppearance);
  const latestResultBox = latestResult ? historyBoxes.get(`${latestResult.dateKey}-${latestResult.box}`) : undefined;
  const latestSetRecord = latestResultBox?.setResults.reduce((record, set) => {
    const team = set.teams.find((candidate) => candidate.players.includes(profile.name));
    const opponent = set.teams.find((candidate) => candidate !== team);
    if (!team || !opponent) return record;
    return { played: record.played + 1, won: record.won + (team.games > opponent.games ? 1 : 0) };
  }, { played: 0, won: 0 }) || { played: 0, won: 0 };

  async function shareProfile() {
    const logo = await loadShareLogo();
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1640;
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

    const latestSetScores = latestResultBox?.setResults.flatMap((set) => {
      const playerTeam = set.teams.find((team) => team.players.includes(profile.name));
      const opponentTeam = set.teams.find((team) => team !== playerTeam);
      return playerTeam && opponentTeam ? [`${playerTeam.games}-${opponentTeam.games}`] : [];
    }).join(", ") || "";
    const asOf = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date());

    ctx.fillStyle = "#11251e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawShareLogo(ctx, logo);
    ctx.textAlign = "right";
    ctx.fillStyle = "#a6b1a9";
    ctx.font = "500 24px Arial";
    ctx.fillText("PADEL+PiCKLE STL", 1008, 116);
    ctx.textAlign = "left";
    ctx.fillStyle = "#f4f1e8";
    drawFitText(profile.name, 72, 285, 936, 82, 700);
    ctx.fillStyle = "#a6b1a9";
    ctx.font = "500 24px Arial";
    ctx.fillText(isCurrentSeason ? `AS OF ${asOf.toUpperCase()}` : `${seasonEntry?.season.label.toUpperCase()} FINAL`, 72, 350);

    const movement = latestResult?.movement || "RESULT";
    const movementColor = movement === "UP" ? "#d9ff57" : movement === "DOWN" ? "#ff6b4a" : "#b7efdc";
    ctx.fillStyle = "#f4f1e8";
    ctx.fillRect(72, 390, 936, 430);
    ctx.fillStyle = "#d9ff57";
    ctx.fillRect(72, 390, 360, 430);
    ctx.fillStyle = "#11251e";
    ctx.font = "700 24px Arial";
    ctx.fillText(isCurrentSeason ? "LEAGUE RANK" : "FINAL LEAGUE RANK", 112, 470);
    ctx.font = "800 160px Arial";
    ctx.fillText(profile.rank ? `#${profile.rank}` : "—", 105, 650);
    ctx.font = "700 31px Arial";
    ctx.fillText(`${isCurrentSeason ? "BOX" : "FINAL BOX"} ${profile.currentBox}`, 112, 725);
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
    drawFitText(latestSetScores ? `SCORES  ${latestSetScores}` : "SET SCORES UNAVAILABLE", 480, 735, 470, 25, 500);

    ctx.fillStyle = "#a6b1a9";
    ctx.font = "500 23px Arial";
    ctx.fillText("SEASON TO DATE", 72, 895);
    const seasonMetrics = [
      { value: String(profile.promotions), label: "MOVES UP" },
      { value: String(profile.setsWon), label: "SETS WON" },
      { value: profile.averageGames.toFixed(1), label: "GAMES WON/WK" },
    ];
    seasonMetrics.forEach((metric, index) => {
      const x = 72 + index * 318;
      if (index) {
        ctx.strokeStyle = "#3a4e46";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 28, 925);
        ctx.lineTo(x - 28, 1018);
        ctx.stroke();
      }
      ctx.fillStyle = "#f4f1e8";
      ctx.font = "800 46px Arial";
      ctx.fillText(metric.value, x, 970);
      ctx.fillStyle = "#a6b1a9";
      ctx.font = "700 18px Arial";
      ctx.fillText(metric.label, x, 1010);
    });

    ctx.fillStyle = "#a6b1a9";
    ctx.font = "700 19px Arial";
    ctx.fillText("RECENT FORM", 72, 1094);
    ctx.textAlign = "right";
    ctx.font = "500 17px Arial";
    ctx.fillText("LAST 6 WEEKS", 1008, 1094);
    ctx.textAlign = "left";
    ctx.strokeStyle = "#3a4e46";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(72, 1280);
    ctx.lineTo(1008, 1280);
    ctx.stroke();

    const drawTrendRow = (label: string, values: number[], top: number) => {
      const plotX = 218;
      const plotWidth = 760;
      const plotTop = top + 4;
      const plotHeight = 94;
      ctx.fillStyle = "#f4f1e8";
      ctx.font = "700 24px Arial";
      ctx.fillText(label, 72, top + 60);

      ctx.strokeStyle = "#3a4e46";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(plotX, plotTop + plotHeight / 2);
      ctx.lineTo(plotX + plotWidth, plotTop + plotHeight / 2);
      ctx.stroke();
      if (!values.length) return;

      const min = Math.min(...values);
      const max = Math.max(...values);
      const coordinates = values.map((point, index) => ({
        x: plotX + (values.length === 1 ? plotWidth : (index * plotWidth) / (values.length - 1)),
        y: min === max ? plotTop + plotHeight / 2 : plotTop + ((point - min) * plotHeight) / (max - min),
      }));
      if (values.length === 1) coordinates[0].x = plotX + plotWidth;
      ctx.strokeStyle = "#f4f1e8";
      ctx.lineWidth = 4;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      coordinates.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.stroke();
      coordinates.forEach((point, index) => {
        const current = index === coordinates.length - 1;
        ctx.fillStyle = current ? "#d9ff57" : "#f4f1e8";
        ctx.beginPath();
        ctx.arc(point.x, point.y, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#11251e";
        ctx.lineWidth = current ? 4 : 3;
        ctx.stroke();
        ctx.fillStyle = "#11251e";
        ctx.textAlign = "center";
        ctx.font = "800 22px Arial";
        ctx.fillText(String(values[index]), point.x, point.y + 8);
      });
      ctx.textAlign = "left";
    };
    const recentRankings = profile.rankingHistory.slice(-6);
    const boxPoints = recentRankings.map((item) => item.box);
    const rankPoints = recentRankings.map((item) => item.rank);
    drawTrendRow("BOX", boxPoints, 1130);
    drawTrendRow("RANK", rankPoints, 1320);
    ctx.lineJoin = "miter";
    ctx.lineCap = "butt";

    ctx.strokeStyle = "#3a4e46";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(72, 1530);
    ctx.lineTo(1008, 1530);
    ctx.stroke();
    ctx.fillStyle = "#d9ff57";
    ctx.font = "700 28px Arial";
    ctx.fillText("FIND YOUR BOX. CLIMB THE LADDER.", 72, 1585);
    ctx.textAlign = "right";
    ctx.fillStyle = "#a6b1a9";
    ctx.font = "500 22px Arial";
    ctx.fillText("PLAYER CARD", 1008, 1585);
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
        {isSelectedPlayer ? <button type="button" className="selected-player-tag" onClick={() => onToggleSelectedPlayer(profile.name)} aria-pressed="true"><UserRound size={14} /> This is you</button> : <button
          type="button"
          className="selected-player-button"
          onClick={() => onToggleSelectedPlayer(profile.name)}
        >
          <UserRound size={18} /> This is me
        </button>}
        <div className="profile-mode-tabs" aria-label="Player profile scope">
          {career?.seasons.map((entry) => <button key={entry.season.id} className={profileScope === entry.season.id ? "active" : ""} onClick={() => setProfileScope(entry.season.id)}>{entry.season.shortLabel}</button>)}
          <button className={isCareer ? "active" : ""} onClick={() => setProfileScope("career")}>Career</button>
        </div>
        {isCareer && career ? <>
          <div className="career-profile-summary">
            <div><strong>{career.seasonsPlayed}</strong><span>Seasons</span></div>
            <div><strong>{career.weeksPlayed}</strong><span>Weeks</span></div>
            <div><strong>{career.promotions}</strong><span>Moves up</span></div>
            <div><strong>{career.setsWon}</strong><span>Sets won</span></div>
          </div>
          <section className="career-season-history">
            <h3>Season history</h3>
            {career.seasons.map((entry) => <article key={entry.season.id}>
              <div><strong>{entry.season.label}</strong><span>{entry.season.status === "current" ? "CURRENT" : "ARCHIVE"}</span></div>
              <dl><div><dt>Rank</dt><dd>{entry.profile.rank ? `#${entry.profile.rank}` : "—"}</dd></div><div><dt>Best box</dt><dd>{entry.profile.highestBox}</dd></div><div><dt>Weeks</dt><dd>{entry.profile.weeksPlayed}</dd></div><div><dt>UP</dt><dd>{entry.profile.promotions}</dd></div><div><dt>Sets</dt><dd>{entry.profile.setsWon}</dd></div></dl>
            </article>)}
          </section>
        </> : <><div className="profile-position">
          <button
            type="button"
            className="profile-rank-highlight profile-rank-position"
            onClick={() => seasonEntry && onViewSeasonRank(seasonEntry.season)}
            disabled={!seasonEntry}
            aria-label={isCurrentSeason ? "View season rank" : "View season final rank"}
          >
            <span>{isCurrentSeason ? "SEASON RANK" : "SEASON FINAL RANK"}</span>
            <strong>{profile.rank ? `#${profile.rank}` : "—"}</strong>
            {seasonEntry ? <span className="profile-box-link">VIEW RANKING <ArrowRight size={14} /></span> : null}
          </button>
          <button
            type="button"
            className="profile-box-position"
            onClick={onViewCurrentBox}
            disabled={!isCurrentSeason || !canViewCurrentBox}
            aria-label={isCurrentSeason ? `View upcoming matches for Box ${profile.currentBox}` : `Final position: Box ${profile.currentBox}`}
          >
            <span>{isCurrentSeason ? "CURRENT BOX" : "FINAL BOX"}</span>
            <strong>BOX {profile.currentBox}</strong>
            {isCurrentSeason ? <small>{latest?.time || ""} · Court {latest?.court || "TBD"}</small> : null}
            {isCurrentSeason && canViewCurrentBox ? <span className="profile-box-link">VIEW BOX <ArrowRight size={14} /></span> : null}
          </button>
        </div>
        <button className="share-card-button" onClick={shareProfile}><Share2 size={18} /> Share my ladder card</button>
        <div className="profile-stats">
          <div><strong>{profile.highestBox}</strong><span>Highest box</span></div>
          <div><strong>{profile.promotions}</strong><span>Moves up</span></div>
          <div><strong>{profile.rank ? `#${profile.rank}` : "—"}</strong><span>{isCurrentSeason ? "Current season rank" : "Season final rank"}</span></div>
          <div><strong>{profile.highestRank ? `#${profile.highestRank}` : "—"}</strong><span>Highest league rank</span></div>
          <div><strong>{profile.weeksPlayed}</strong><span>Weeks played</span></div>
          <div><strong>{profile.setsWon}</strong><span>Sets won</span></div>
        </div>
        <section className="history-section">
          <div className="trend-section-title"><h3>Recent Box Form</h3><span>LAST {boxRangeCount} {boxRangeCount === 1 ? "WEEK" : "WEEKS"}</span></div>
          <BoxTrend history={profile.history} rankings={profile.rankingHistory} />
          <div className="trend-section-title"><h3>Weekly Ladder Rank</h3><span>LAST {rankRangeCount} {rankRangeCount === 1 ? "WEEK" : "WEEKS"}</span></div>
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
        </>}
      </aside>
    </div>
  );
}

function RankingView({ profiles, selectedPlayerName, onSelect }: { profiles: PlayerProfile[]; selectedPlayerName?: string | null; onSelect: (name: string) => void }) {
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
            <span className="ranking-player"><span className={`avatar small${profile.name === selectedPlayerName ? " is-selected-player" : ""}`}>{initials(profile.name)}</span><strong>{profile.name}</strong></span>
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

function LeaderboardPager({ page, count, pageSize = 10, onChange }: { page: number; count: number; pageSize?: number; onChange: (page: number) => void }) {
  const pages = Math.ceil(count / pageSize);
  if (pages <= 1) return null;
  return <nav className="leaderboard-pager" aria-label="Leaderboard pages"><button disabled={page === 0} onClick={() => onChange(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button><span>{page + 1} / {pages}</span><button disabled={page >= pages - 1} onClick={() => onChange(page + 1)} aria-label="Next page"><ChevronRight size={16} /></button></nav>;
}

function SeasonLeaderboard({ title, icon, entries, selectedPlayerName, onSelect, value, detail }: { title: string; icon: React.ReactNode; entries: PlayerProfile[]; selectedPlayerName?: string | null; onSelect: (name: string) => void; value: (profile: PlayerProfile) => React.ReactNode; detail: (profile: PlayerProfile) => string }) {
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const visible = entries.slice(page * pageSize, (page + 1) * pageSize);
  return <section className="leaderboard-card"><header>{icon}<h3>{title}</h3></header>{visible.map((profile, index) => <button key={profile.name} onClick={() => onSelect(profile.name)}><span className="rank">{page * pageSize + index + 1}</span><span className={`avatar small${profile.name === selectedPlayerName ? " is-selected-player" : ""}`}>{initials(profile.name)}</span><span className="leader-name"><strong>{profile.name}</strong><small>{detail(profile)}</small></span><strong className="lime-number">{value(profile)}</strong></button>)}<LeaderboardPager page={page} count={entries.length} onChange={setPage} /></section>;
}

function CareerLeaderboard({ title, icon, entries, selectedPlayerName, onSelect, value, detail, tooltip }: { title: string; icon: React.ReactNode; entries: CareerProfile[]; selectedPlayerName?: string | null; onSelect: (name: string) => void; value: (profile: CareerProfile) => React.ReactNode; detail: (profile: CareerProfile) => string; tooltip?: string }) {
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const visible = entries.slice(page * pageSize, (page + 1) * pageSize);
  return <section className="leaderboard-card career-leaderboard"><header>{icon}<div className="leaderboard-title"><h3>{title}</h3>{tooltip ? <button type="button" className="leaderboard-info" aria-label={`About ${title}`}><Info size={13} /><span className="leaderboard-tooltip" role="tooltip">{tooltip}</span></button> : null}</div></header>{visible.map((profile, index) => <button key={profile.name} onClick={() => onSelect(profile.name)}><span className="rank">{page * pageSize + index + 1}</span><span className={`avatar small${profile.name === selectedPlayerName ? " is-selected-player" : ""}`}>{initials(profile.name)}</span><span className="leader-name"><strong>{profile.name}</strong><small>{detail(profile)}</small></span><strong className="lime-number">{value(profile)}</strong></button>)}<LeaderboardPager page={page} count={entries.length} onChange={setPage} /></section>;
}

function StatsView({ profiles, selectedPlayerName, onSelect }: { profiles: PlayerProfile[]; selectedPlayerName?: string | null; onSelect: (name: string) => void }) {
  const active = profiles.filter((profile) => profile.weeksPlayed > 0);
  const climbers = [...active].sort((a, b) => b.promotions - a.promotions || a.currentBox - b.currentBox);
  const setWinners = [...active].sort((a, b) => b.setsWon - a.setsWon || b.setsPlayed - a.setsPlayed || a.currentBox - b.currentBox);
  const boxClimbers = [...active].sort((a, b) => {
    const aStart = [...a.history].filter(isRosterStatAppearance).sort((x, y) => x.dateKey.localeCompare(y.dateKey))[0]?.box ?? a.currentBox;
    const bStart = [...b.history].filter(isRosterStatAppearance).sort((x, y) => x.dateKey.localeCompare(y.dateKey))[0]?.box ?? b.currentBox;
    return (bStart - b.currentBox) - (aStart - a.currentBox) || a.currentBox - b.currentBox;
  });
  const hot = [...active].filter((profile) => profile.streak >= 2).sort((a, b) => b.streak - a.streak || b.promotions - a.promotions).slice(0, 5);
  return (
    <div className="stats-layout">
      <section className="hot-card">
        <header><Flame size={20} /><h3>Hot streaks</h3></header>
        <div>{hot.length ? hot.map((profile) => <button key={profile.name} onClick={() => onSelect(profile.name)}><strong>{profile.name}</strong><span>{profile.streak}× UP</span></button>) : <p className="hot-empty">No active UP streaks.</p>}</div>
      </section>
      <SeasonLeaderboard title="Most moves up" icon={<TrendingUp size={20} />} entries={climbers} selectedPlayerName={selectedPlayerName} onSelect={onSelect} value={(profile) => profile.promotions} detail={(profile) => `Current box: ${profile.currentBox}`} />
      <SeasonLeaderboard title="Biggest climbers" icon={<ChartNoAxesColumnIncreasing size={20} />} entries={boxClimbers} selectedPlayerName={selectedPlayerName} onSelect={onSelect} value={(profile) => { const start = [...profile.history].filter(isRosterStatAppearance).sort((a, b) => a.dateKey.localeCompare(b.dateKey))[0]?.box ?? profile.currentBox; const change = start - profile.currentBox; return `${change > 0 ? "+" : ""}${change}`; }} detail={(profile) => { const start = [...profile.history].filter(isRosterStatAppearance).sort((a, b) => a.dateKey.localeCompare(b.dateKey))[0]?.box ?? profile.currentBox; return `Box ${start} to Box ${profile.currentBox}`; }} />
      <SeasonLeaderboard title="Most sets won" icon={<CircleCheckBig size={20} />} entries={setWinners} selectedPlayerName={selectedPlayerName} onSelect={onSelect} value={(profile) => profile.setsWon} detail={(profile) => `${profile.setsPlayed} sets played`} />
    </div>
  );
}

function CareerStatsView({ profiles, seasons, selectedPlayerName, onSelect }: { profiles: CareerProfile[]; seasons: SeasonData[]; selectedPlayerName?: string | null; onSelect: (name: string) => void }) {
  const moves = [...profiles].sort((a, b) => b.promotions - a.promotions || b.weeksPlayed - a.weeksPlayed);
  const sets = [...profiles].sort((a, b) => b.setsWon - a.setsWon || b.setsPlayed - a.setsPlayed);
  const rates = [...profiles].filter((profile) => profile.setsPlayed >= 15).sort((a, b) => (b.setsWon / b.setsPlayed) - (a.setsWon / a.setsPlayed) || b.setsPlayed - a.setsPlayed);
  const confirmedMatches = seasons.reduce((sum, season) => sum + season.data.weeks.reduce((weekSum, week) => weekSum + week.boxes.filter(boxHasResult).length, 0), 0);
  const mostMatches = [...profiles].sort((a, b) => {
    const weekDifference = b.weeksPlayed - a.weeksPlayed;
    if (weekDifference) return weekDifference;
    const aWinRate = a.setsPlayed ? a.setsWon / a.setsPlayed : 0;
    const bWinRate = b.setsPlayed ? b.setsWon / b.setsPlayed : 0;
    return bWinRate - aWinRate || a.name.localeCompare(b.name);
  })[0];
  return (
    <div className="career-stats-layout">
      <section className="career-summary-card">
        <header><span>LEAGUE HISTORY</span><small>{seasons.length} seasons included</small></header>
        <div><strong>{profiles.length}</strong><small>Participants</small></div>
        <div><strong>{confirmedMatches}</strong><small>Total matches played</small></div>
        <div className="career-summary-name"><strong>{mostMatches?.name || "—"}</strong><small>Most weeks played · {mostMatches?.weeksPlayed || 0}</small></div>
      </section>
      <CareerLeaderboard title="Most career moves up" icon={<TrendingUp size={20} />} entries={moves} selectedPlayerName={selectedPlayerName} onSelect={onSelect} value={(profile) => profile.promotions} detail={(profile) => `${profile.weeksPlayed} weeks played`} />
      <CareerLeaderboard title="Best set win rate" icon={<Percent size={20} />} entries={rates} selectedPlayerName={selectedPlayerName} onSelect={onSelect} value={(profile) => `${Math.round((profile.setsWon / profile.setsPlayed) * 100)}%`} detail={(profile) => `${profile.setsWon} of ${profile.setsPlayed} sets won`} tooltip="Players must have at least 15 confirmed sets to qualify." />
      <CareerLeaderboard title="Most confirmed sets won" icon={<CircleCheckBig size={20} />} entries={sets} selectedPlayerName={selectedPlayerName} onSelect={onSelect} value={(profile) => profile.setsWon} detail={(profile) => `${profile.setsPlayed} recorded sets`} />
    </div>
  );
}

function careerAsProfiles(careers: CareerProfile[]): PlayerProfile[] {
  return careers.map((career) => {
    const current = career.seasons.find((entry) => entry.season.status === "current")?.profile || career.seasons[0].profile;
    return {
      ...current,
      rank: current.rank,
      highestRank: career.bestRank,
      highestBox: career.highestBox,
      weeksPlayed: career.weeksPlayed,
      promotions: career.promotions,
      demotions: career.demotions,
      stays: career.stays,
      setsPlayed: career.setsPlayed,
      setsWon: career.setsWon,
      totalGames: career.totalGames,
      averageGames: career.weeksPlayed ? career.totalGames / career.weeksPlayed : 0,
      history: career.seasons.flatMap((entry) => entry.profile.history).sort((a, b) => b.dateKey.localeCompare(a.dateKey)),
      rankingHistory: current.rankingHistory,
    };
  });
}

function CompareView({ seasons, careers, selectedSeason, selectedPlayerName, onSelect, allTime = false }: { seasons: SeasonData[]; careers: CareerProfile[]; selectedSeason: SeasonDefinition; selectedPlayerName?: string | null; onSelect: (name: string) => void; allTime?: boolean }) {
  const router = useRouter();
  const allProfiles = useMemo(() => careerAsProfiles(careers), [careers]);
  const scopedSeason = seasons.find((entry) => entry.season.id === selectedSeason.id) || seasons[0];
  const scopedProfiles = allTime ? allProfiles : scopedSeason.data.profiles;
  const weeks = allTime ? seasons.flatMap((entry) => entry.data.weeks) : scopedSeason.data.weeks;
  const active = allProfiles
    .filter((profile) => profile.weeksPlayed > 0)
    .sort((a, b) => firstName(a.name).localeCompare(firstName(b.name)) || a.name.localeCompare(b.name));
  const [leftName, setLeftName] = useState("");
  const [rightName, setRightName] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const leftParam = params.get("left");
    const rightParam = params.get("right");
    if (leftParam && active.some((profile) => profile.name === leftParam)) setLeftName(leftParam);
    else if (selectedPlayerName && active.some((profile) => profile.name === selectedPlayerName)) setLeftName((current) => current || selectedPlayerName);
    if (rightParam && active.some((profile) => profile.name === rightParam)) setRightName(rightParam);
  }, [active, selectedPlayerName]);
  const leftScoped = scopedProfiles.find((profile) => profile.name === leftName);
  const rightScoped = scopedProfiles.find((profile) => profile.name === rightName);
  const left = leftScoped || active.find((profile) => profile.name === leftName);
  const right = rightScoped || active.find((profile) => profile.name === rightName);
  const headToHead = left && right ? buildHeadToHeadRecord(weeks, left.name, right.name) : null;
  const sharedBoxes = left && right
    ? weeks
      .filter((week) => week.completed)
      .flatMap((week) => week.boxes.flatMap((box) => {
        const leftPlayer = box.players.find((player) => player.name === left.name);
        const rightPlayer = box.players.find((player) => player.name === right.name);
        return leftPlayer && rightPlayer && isRosterStatAppearance(leftPlayer) && isRosterStatAppearance(rightPlayer)
          ? [{ box, date: week.date, dateKey: week.dateKey }]
          : [];
      }))
      .sort((first, second) => second.dateKey.localeCompare(first.dateKey))
    : [];
  const metrics = leftScoped && rightScoped ? [
    ["Sets H2H", headToHead?.leftSetsWonAgainst || 0, headToHead?.rightSetsWonAgainst || 0, "higher"],
    [allTime ? "Best rank" : "League rank", allTime ? leftScoped.highestRank || 0 : leftScoped.rank || 0, allTime ? rightScoped.highestRank || 0 : rightScoped.rank || 0, "lower"],
    [allTime ? "Best box" : "Current box", allTime ? leftScoped.highestBox : leftScoped.currentBox, allTime ? rightScoped.highestBox : rightScoped.currentBox, "lower"],
    ["Highest box", leftScoped.highestBox, rightScoped.highestBox, "lower"],
    ["Moves up", leftScoped.promotions, rightScoped.promotions, "higher"],
    ["Weeks played", leftScoped.weeksPlayed, rightScoped.weeksPlayed, "higher"],
    ["Sets won", leftScoped.setsWon, rightScoped.setsWon, "higher"],
    ["Games won", leftScoped.totalGames, rightScoped.totalGames, "higher"],
  ] as const : [];
  const leftCareer = careers.find((career) => career.name === leftName);
  const rightCareer = careers.find((career) => career.name === rightName);
  const sharedSeasonIds = new Set(leftCareer?.seasons.filter((entry) => rightCareer?.seasons.some((rightEntry) => rightEntry.season.id === entry.season.id)).map((entry) => entry.season.id) || []);
  const scopeHref = (path: string, leftValue = leftName, rightValue = rightName) => `${path}?${new URLSearchParams({ left: leftValue, right: rightValue }).toString()}`;
  const selectPlayer = (side: "left" | "right", name: string) => {
    const nextLeft = side === "left" ? name : leftName;
    const nextRight = side === "right" ? name : rightName;
    if (side === "left") setLeftName(name); else setRightName(name);
    if (!nextLeft || !nextRight) return;
    const leftEntry = careers.find((career) => career.name === nextLeft);
    const rightEntry = careers.find((career) => career.name === nextRight);
    const bothCurrent = leftEntry?.seasons.some((entry) => entry.season.status === "current") && rightEntry?.seasons.some((entry) => entry.season.status === "current");
    router.push(scopeHref(bothCurrent ? "/head-to-head" : "/head-to-head/all-time", nextLeft, nextRight));
  };

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
    ctx.fillText("PADEL+PiCKLE STL", 1008, 116);

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
      ctx.font = "600 24px Arial";
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
    ctx.fillText("H2H", 1008, 1295);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    const fileName = `${left.name}-vs-${right.name}-padel.png`.replace(/\s+/g, "-").toLowerCase();
    await sharePng(blob, fileName);
  }

  return (
    <div className="compare-card">
      <div className="compare-pickers">
        <label><span>PLAYER ONE</span><select value={leftName} onChange={(event) => selectPlayer("left", event.target.value)}><option value="">Select a player</option>{active.map((profile) => <option key={profile.name}>{profile.name}</option>)}</select></label>
        <span className="versus">VS</span>
        <label><span>PLAYER TWO</span><select value={rightName} onChange={(event) => selectPlayer("right", event.target.value)}><option value="">Select a player</option>{active.map((profile) => <option key={profile.name}>{profile.name}</option>)}</select></label>
      </div>
      {left && right ? <>
        <div className="h2h-scope" aria-label="Head-to-head scope">
          {seasons.filter(({ season }) => sharedSeasonIds.has(season.id)).map(({ season }) => <Link key={season.id} className={!allTime && season.id === selectedSeason.id ? "active" : ""} href={scopeHref(season.status === "current" ? "/head-to-head" : `/seasons/${season.id}/head-to-head`)}>{season.shortLabel}</Link>)}
          <Link className={allTime ? "active" : ""} href={scopeHref("/head-to-head/all-time")}>ALL TIME</Link>
        </div>
        <div className="compare-names">
          <button onClick={() => onSelect(left.name)}><span className="profile-avatar mini">{initials(left.name)}</span><strong>{left.name}</strong></button>
          <button onClick={() => onSelect(right.name)}><span className="profile-avatar mini">{initials(right.name)}</span><strong>{right.name}</strong></button>
        </div>
        {leftScoped && rightScoped ? <button className="share-card-button compare-share-button" onClick={shareHeadToHead}><Share2 size={18} /> Share head-to-head card</button> : <p className="h2h-no-season-data">One or both players have no record in {selectedSeason.label}.</p>}
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

const pulseIcons: Record<LeagueHighlightKind, React.ReactNode> = {
  leader: <Crown size={17} />,
  player: <Trophy size={17} />,
  "personal-best": <TrendingUp size={17} />,
  "bounce-back": <RotateCcw size={17} />,
  streak: <Flame size={17} />,
  perfect: <Medal size={17} />,
  up: <ArrowUp size={17} />,
};

function LeaguePulse({ data, compact }: { data: LadderData; compact: boolean }) {
  const highlights = useMemo(() => buildLeagueHighlights(data), [data]);

  const sequence = (hidden = false) => (
    <ul className="pulse-sequence" aria-hidden={hidden || undefined}>
      {highlights.map((highlight) => (
        <li key={`${hidden ? "copy-" : ""}${highlight.id}`}>
          <span className={`pulse-icon pulse-${highlight.kind}`}>{pulseIcons[highlight.kind]}</span>
          <strong>{highlight.label}</strong>
          <span>{highlight.text}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <section
      className={`league-pulse${compact ? " compact" : ""}`}
      aria-label="League highlights"
      style={{ "--pulse-duration": `${Math.max(34, highlights.length * 7)}s` } as React.CSSProperties}
    >
      <strong className="pulse-heading"><span>LEAGUE</span><span>PULSE</span></strong>
      <div className="pulse-window">
        {highlights.length ? <div className="pulse-track">{sequence()}{sequence(true)}</div> : <p>Updates will appear as results come in.</p>}
      </div>
    </section>
  );
}

function localWeekday(value: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/Chicago" }).format(new Date(value));
}

function scheduledStart(dateKey: string, time: string): Date | null {
  const date = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const clock = time.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!date || !clock) return null;

  const year = Number(date[1]);
  const month = Number(date[2]) - 1;
  const day = Number(date[3]);
  let hour = Number(clock[1]);
  const minute = Number(clock[2] || 0);
  if (hour < 1 || hour > 12 || minute > 59) return null;
  if (clock[3].toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (clock[3].toUpperCase() === "AM" && hour === 12) hour = 0;

  const start = new Date(year, month, day, hour, minute);
  return start.getFullYear() === year && start.getMonth() === month && start.getDate() === day ? start : null;
}

function nextGameForPlayer(weeks: LadderWeek[], name: string, now: Date) {
  return weeks.flatMap((week) => week.boxes.flatMap((box) => {
    const start = scheduledStart(week.dateKey, box.time);
    return start && start > now && box.players.some((player) => player.name === name) ? [{ start, boxNumber: box.number, court: box.court }] : [];
  })).sort((left, right) => left.start.getTime() - right.start.getTime())[0];
}

function formatNextGame(start: Date): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }).format(start);
}

function seasonBasePath(season: SeasonDefinition): string {
  return season.status === "current" ? "/" : `/seasons/${season.id}`;
}

function SeasonBar({ selected, allTime, seasons, section }: { selected: SeasonDefinition; allTime: boolean; seasons: SeasonData[]; section: LadderSection }) {
  const sectionPath = (season: SeasonDefinition) => {
    if (season.status === "current") return section === "results" ? "/results" : section === "stats" ? "/stats" : "/";
    return `/seasons/${season.id}${section === "results" ? "/results" : section === "stats" ? "/stats" : ""}`;
  };
  return (
    <div className="season-bar">
      <details className="season-picker">
        <summary className="season-current">
          <strong>{allTime ? "All time" : selected.label}</strong>
          <ChevronDown size={17} />
        </summary>
        <div className="season-picker-menu">
          {seasons.map(({ season }) => <Link className={!allTime && season.id === selected.id ? "active" : ""} href={sectionPath(season)} key={season.id}>{season.label}</Link>)}
          {section === "stats" ? <Link className={allTime ? "active" : ""} href="/stats/all-time">All time</Link> : null}
        </div>
      </details>
      {selected.status === "archived" ? (
        <nav aria-label={`${selected.label} sections`}>
          <Link href={seasonBasePath(selected)}>Overview</Link>
          <Link href={`${seasonBasePath(selected)}/results`}>Results</Link>
          <Link href={`${seasonBasePath(selected)}/stats`}>Stats</Link>
        </nav>
      ) : null}
    </div>
  );
}

function SeasonsView({ seasons }: { seasons: SeasonData[] }) {
  return (
    <div className="seasons-view">
      <div className="section-head season-page-head"><div><h2>Seasons</h2><p>Results and stats of recent seasons.</p></div></div>
      <div className="season-card-grid">
        {seasons.map(({ season, data }) => {
          const leader = data.ranking[0];
          const completed = data.weeks.filter((week) => week.completed).length;
          const href = seasonBasePath(season);
          return (
            <Link href={href} className={`season-card ${season.status}`} key={season.id}>
              <span>{season.status === "current" ? "CURRENT" : "ARCHIVE"}</span>
              <h3>{season.label}</h3>
              <p>{season.dateRange}</p>
              <div><strong>{completed}</strong><small>recorded weeks</small></div>
              <div><strong>{data.profiles.filter((profile) => profile.weeksPlayed).length}</strong><small>roster players</small></div>
              <div className="season-card-footer"><span>{leader ? `${season.status === "current" ? "Leader" : "Final leader"}: ${leader.name}` : "Season record"}</span><ArrowRight size={20} /></div>
            </Link>
          );
        })}
      </div>
      <div className="archive-all-time">
        <div><span>CAREER RECORDS</span><h3>All-time league numbers</h3><p>Compare players across Winter, Spring, and Summer 2026.</p></div>
        <div><Link href="/stats/all-time">All-time stats <ArrowRight size={18} /></Link><Link href="/head-to-head/all-time">All-time H2H <ArrowRight size={18} /></Link></div>
      </div>
    </div>
  );
}

function SeasonOverview({ season, data, selectedPlayerName, onSelect }: { season: SeasonDefinition; data: LadderData; selectedPlayerName?: string | null; onSelect: (name: string) => void }) {
  const active = data.profiles.filter((profile) => profile.weeksPlayed);
  const leader = data.ranking[0];
  const mostUp = [...active].sort((a, b) => b.promotions - a.promotions)[0];
  const mostSets = [...active].sort((a, b) => b.setsWon - a.setsWon)[0];
  return (
    <div className="season-overview">
      <header className="season-masthead"><span>ARCHIVED SEASON</span><h1>{season.label}</h1><p>{season.dateRange}</p></header>
      <div className="season-recap-grid">
        <article className="season-recap-feature"><span>TOP OF THE TABLE</span><strong>{leader?.name || "Not recorded"}</strong><small>{leader ? `Box ${leader.box} · Rank #${leader.rank}` : ""}</small></article>
        <article><span>MOST MOVES UP</span><strong>{mostUp?.name || "—"}</strong><small>{mostUp ? `${mostUp.promotions} moves` : ""}</small></article>
        <article><span>MOST SETS WON</span><strong>{mostSets?.name || "—"}</strong><small>{mostSets ? `${mostSets.setsWon} confirmed` : ""}</small></article>
      </div>
      <div className="season-overview-actions"><Link href={`/seasons/${season.id}/results`}>Browse weekly results <ArrowRight size={18} /></Link><Link href={`/seasons/${season.id}/stats`}>View season stats <ArrowRight size={18} /></Link></div>
      <div className="section-head"><div><h2>Final Season Ranking</h2><p>Last recorded ladder position for each player.</p></div></div>
      <RankingView profiles={data.profiles} selectedPlayerName={selectedPlayerName} onSelect={onSelect} />
    </div>
  );
}

function HomeDashboard({ data, upcoming, isNewWeek }: { data: LadderData; upcoming: LadderWeek | null; isNewWeek: boolean }) {
  const latest = data.latestResults;
  const resultsLead = !isNewWeek && Boolean(latest && latest.status !== "scheduled");
  const resultLabel = latest?.status === "partial" ? "RESULTS COMING IN" : "LATEST RESULTS";
  const upcomingLabel = latest?.status === "partial" && upcoming?.dateKey === latest.dateKey ? "STILL TO PLAY" : "NEXT UP";
  const resultDetail = latest?.status === "partial"
    ? `${latest.reportedBoxCount} of ${latest.scheduledBoxCount} boxes reported`
    : latest ? `${latest.scheduledBoxCount} boxes complete` : "Results will appear here";
  const upcomingDetail = upcoming
    ? `${upcoming.boxes.length} ${upcoming.boxes.length === 1 ? "box" : "boxes"} scheduled`
    : "Schedule to be announced";

  const statusCards = [
    {
      id: "results",
      href: "/results",
      label: resultLabel,
      title: latest?.status === "partial" ? "Latest results" : "See what happened",
      detail: resultDetail,
      date: latest?.date || "No reported week",
      icon: <CircleCheckBig size={28} />,
      primary: resultsLead,
    },
    {
      id: "upcoming",
      href: "/upcoming",
      label: upcomingLabel,
      title: latest?.status === "partial" && upcoming?.dateKey === latest.dateKey ? "Remaining matches" : "See upcoming matches",
      detail: upcomingDetail,
      date: upcoming?.date || "Date to be announced",
      icon: <CalendarDays size={28} />,
      primary: !resultsLead,
    },
  ].sort((left, right) => Number(right.primary) - Number(left.primary));

  return (
    <div className="home-dashboard">
      <section className="home-section" aria-label="League updates">
        <div className="home-status-grid">
          {statusCards.map((card) => (
            <Link key={card.id} href={card.href} className={`home-route-card${card.primary ? " primary" : ""}`}>
              <span className="home-card-icon">{card.icon}</span>
              <span className="home-card-label">{card.label}</span>
              <h3>{card.title}</h3>
              <p>{card.detail}</p>
              <span className="home-card-footer"><span>{card.date}</span><ArrowRight size={20} /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-section" aria-labelledby="explore-title">
        <div className="home-section-head"><h2 id="explore-title">Explore the league</h2></div>
        <div className="home-explore-grid">
          <Link href="/stats" className="home-explore-card"><ListOrdered size={25} /><span><strong>Stats & ranking</strong><small>Leaders, form, and the live table</small></span><ArrowRight size={20} /></Link>
          <Link href="/head-to-head" className="home-explore-card"><UsersRound size={25} /><span><strong>Head to head</strong><small>Compare records and shared sets</small></span><ArrowRight size={20} /></Link>
          <Link href="/seasons" className="home-explore-card"><History size={25} /><span><strong>Previous seasons</strong><small>Browse past results and final rankings</small></span><ArrowRight size={20} /></Link>
        </div>
      </section>
    </div>
  );
}

export function LadderApp({
  data: initialData,
  section,
  selectedSeason,
  seasons: initialSeasons,
  allTime = false,
  showPwaInstallTest = false,
}: {
  data: LadderData;
  section: LadderSection;
  selectedSeason: SeasonDefinition;
  seasons: SeasonData[];
  careerProfiles: CareerProfile[];
  allTime?: boolean;
  showPwaInstallTest?: boolean;
}) {
  const router = useRouter();
  const [seasons, setSeasons] = useState(initialSeasons);
  const data = seasons.find((entry) => entry.season.id === selectedSeason.id)?.data || initialData;
  const careerProfiles = useMemo(() => buildCareerProfiles(seasons), [seasons]);
  const [compactMobileHeader, setCompactMobileHeader] = useState(false);
  const [statsMode, setStatsMode] = useState<StatsMode>("leaders");
  const [resultsWeekKey, setResultsWeekKey] = useState(data.latestResults?.dateKey || "");
  const [weekday, setWeekday] = useState(() => localWeekday(data.updatedAt));
  const [query, setQuery] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedPlayerName, setSelectedPlayerName] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const allTimeProfiles = useMemo(() => careerAsProfiles(careerProfiles), [careerProfiles]);
  const displayProfiles = allTime || section === "head-to-head" ? allTimeProfiles : data.profiles;
  const profiles = useMemo(() => new Map(displayProfiles.map((profile) => [profile.name, profile])), [displayProfiles]);
  const resultsWeeks = useMemo(() => data.weeks.filter((candidate) => candidate.status !== "scheduled"), [data.weeks]);
  const searchResults = query.trim().length > 1
    ? allTimeProfiles.filter((profile) => profile.name.toLowerCase().includes(query.toLowerCase())).slice(0, 7)
    : [];
  const selected = selectedName ? allTimeProfiles.find((profile) => profile.name === selectedName) : undefined;
  const selectedCareer = selectedName ? careerProfiles.find((profile) => profile.name === selectedName) : undefined;
  const resultsWeek = resultsWeeks.find((candidate) => candidate.dateKey === resultsWeekKey) || data.latestResults;
  const resultsWeekIndex = resultsWeeks.findIndex((candidate) => candidate.dateKey === resultsWeek?.dateKey);
  const previousResultsWeek = resultsWeeks[resultsWeekIndex - 1];
  const nextResultsWeek = resultsWeeks[resultsWeekIndex + 1];
  const isNewWeek = ["Mon", "Tue"].includes(weekday);
  const nextScheduledWeek = data.weeks.find((candidate) =>
    candidate.status === "scheduled" && (!data.latestResults || candidate.dateKey > data.latestResults.dateKey),
  ) || null;
  const upcoming = isNewWeek ? nextScheduledWeek : data.upcoming;
  const week = section === "upcoming" ? upcoming : resultsWeek;
  const selectedPlayer = selectedPlayerName ? allTimeProfiles.find((profile) => profile.name === selectedPlayerName) : undefined;
  const nextGame = selectedPlayer && now ? nextGameForPlayer(data.weeks, selectedPlayer.name, now) : undefined;
  useEffect(() => {
    const controller = new AbortController();
    const source = SEASON_SHEETS["summer-2026"];
    const url = `https://docs.google.com/spreadsheets/d/${source.sheetId}/gviz/tq?tqx=out:csv&gid=${source.gid}&refresh=${Date.now()}`;
    fetch(url, { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Sheet returned ${response.status}`);
        return response.text();
      })
      .then((csv) => {
        const liveData = buildLadderData(csv, "live");
        setSeasons((current) => current.map((entry) => entry.season.id === "summer-2026" ? { ...entry, data: liveData } : entry));
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const updateWeekday = () => setWeekday(localWeekday(new Date().toISOString()));
    updateWeekday();
    const interval = window.setInterval(updateWeekday, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const storedPlayer = window.localStorage.getItem(SELECTED_PLAYER_STORAGE_KEY);
    if (storedPlayer) setSelectedPlayerName(storedPlayer);
  }, []);

  useEffect(() => {
    const updateNow = () => setNow(new Date());
    updateNow();
    const interval = window.setInterval(updateNow, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedPlayerName && !allTimeProfiles.some((profile) => profile.name === selectedPlayerName)) {
      window.localStorage.removeItem(SELECTED_PLAYER_STORAGE_KEY);
      setSelectedPlayerName(null);
    }
  }, [allTimeProfiles, selectedPlayerName]);

  useEffect(() => {
    if (data.source === "live") setResultsWeekKey(data.latestResults?.dateKey || "");
  }, [data.source, data.updatedAt, data.latestResults?.dateKey]);

  useEffect(() => {
    const updateHeader = () => {
      const scrollY = window.scrollY;
      setCompactMobileHeader((isCompact) => isCompact ? scrollY > 8 : scrollY > 88);
    };
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
  }, []);

  useEffect(() => {
    if (window.location.hash === "#ranking") setStatsMode("ranking");
  }, []);

  function viewUpcomingBox(box: number) {
    if (!upcoming?.boxes.some((candidate) => candidate.number === box)) return;
    setSelectedName(null);
    router.push(`/upcoming#box-${box}`);
  }

  function viewSeasonRank(season: SeasonDefinition) {
    setSelectedName(null);
    setStatsMode("ranking");
    router.push(`${season.status === "current" ? "/stats" : `/seasons/${season.id}/stats`}#ranking`);
  }

  function toggleSelectedPlayer(name: string) {
    if (selectedPlayerName === name) {
      window.localStorage.removeItem(SELECTED_PLAYER_STORAGE_KEY);
      setSelectedPlayerName(null);
      return;
    }
    window.localStorage.setItem(SELECTED_PLAYER_STORAGE_KEY, name);
    setSelectedPlayerName(name);
  }

  const destinations: { id: LadderSection; href: string; label: string; mobileLabel: string; icon: React.ReactNode }[] = [
    { id: "home", href: "/", label: "Home", mobileLabel: "Home", icon: <House size={18} /> },
    { id: "upcoming", href: "/upcoming", label: "Upcoming", mobileLabel: "Upcoming", icon: <CalendarDays size={18} /> },
    { id: "results", href: "/results", label: "Results", mobileLabel: "Results", icon: <CircleCheckBig size={18} /> },
    { id: "stats", href: "/stats", label: "Stats", mobileLabel: "Stats", icon: <ListOrdered size={18} /> },
    { id: "head-to-head", href: "/head-to-head", label: "Head to Head", mobileLabel: "H2H", icon: <UsersRound size={18} /> },
  ];

  return (
    <main className="ladder-app">
      <header className={`site-header${section === "home" ? " pulse-home-header" : ""}${compactMobileHeader ? " mobile-compact" : ""}`}>
        <Link className="brand" href="/" aria-label="Open home">
          <Image className="header-logo header-logo-default" src="/my-league-live-logo.png" width={677} height={254} alt="My League Live" unoptimized />
          <Image className="header-logo header-logo-compact" src="/my-league-live-logo-horizontal.png" width={852} height={88} alt="" aria-hidden="true" unoptimized />
        </Link>
        <button type="button" className="header-refresh" onClick={() => window.location.reload()} aria-label="Refresh league data">
          <RefreshCw size={18} />
        </button>
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
      {showPwaInstallTest ? <InstallPromptBanner /> : null}

      {section === "home" ? <LeaguePulse data={data} compact={compactMobileHeader} /> : null}

      {section === "home" ? <><section className="hero">
        <div className="hero-copy">
          <span className={`eyebrow${selectedPlayer ? " greeting" : ""}`}><i /> {selectedPlayer ? `Hello, ${firstName(selectedPlayer.name)}!` : "PADEL+PICKLE ST. LOUIS"}</span>
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
        {searchResults.length ? <div className="search-results">{searchResults.map((profile) => { const career = careerProfiles.find((entry) => entry.name === profile.name); const season = career?.seasons.find((entry) => entry.season.status === "current") || career?.seasons[0]; return <button key={profile.name} onClick={() => { setSelectedName(profile.name); setQuery(""); }}><span className="avatar small">{initials(profile.name)}</span><span><strong>{profile.name}</strong><small>{season ? `${season.season.label} · ${season.season.status === "current" ? "Box" : "Final Box"} ${season.profile.currentBox}` : "Career profile"}</small></span><ChevronRight size={18} /></button>; })}</div> : null}
      </section>
      {selectedPlayer ? <div className="my-profile-actions"><button type="button" className="my-profile-link" onClick={() => setSelectedName(selectedPlayer.name)}><UserRound size={17} /><span>My Profile</span><ArrowRight size={18} /></button>{nextGame ? <Link className="next-game-link" href={`/upcoming#box-${nextGame.boxNumber}`}><span className="next-game-label"><span className="next-game-label-desktop">Next match:</span><span className="next-game-label-mobile"><Clock3 size={16} /></span></span><span>{formatNextGame(nextGame.start)}, Ct. {nextGame.court}</span><ArrowRight size={18} /></Link> : null}</div> : null}
      </> : null}

      <section className="content-shell">
        {["results", "stats", "season"].includes(section) ? <SeasonBar selected={selectedSeason} allTime={allTime} seasons={seasons} section={section} /> : null}
        {section === "home" ? <HomeDashboard data={data} upcoming={upcoming} isNewWeek={isNewWeek} /> : null}

        {section === "seasons" ? <SeasonsView seasons={seasons} /> : null}

        {section === "season" ? <SeasonOverview season={selectedSeason} data={data} selectedPlayerName={selectedPlayerName} onSelect={setSelectedName} /> : null}

        {section === "upcoming" ? <>
          <div className="section-head upcoming-section-head">
            <div className="upcoming-title">
              <h2>{data.latestResults?.status === "partial" && week?.dateKey === data.latestResults.dateKey ? "Remaining this week" : "Upcoming matches"}</h2>
            </div>
            <p className="upcoming-date">{week?.date || "Date to be announced"}</p>
            <Link className="ladder-view-switch" href="/results">
              <span className="link-label"><span className="link-label-desktop">View current results</span><span className="link-label-mobile">Results</span></span>
              <ArrowRight size={17} />
            </Link>
          </div>
          <LadderGrid
            week={week}
            profiles={profiles}
            showResult={false}
            showRecentResults
            showSubstituteOnly
            showWeekday
            selectedPlayerName={selectedPlayerName}
            onSelect={setSelectedName}
          />
        </> : null}

        {section === "results" ? <>
          <div className="section-head">
            <div><h2>{selectedSeason.status === "archived" ? `${selectedSeason.label} results` : "Weekly results"}</h2><p>Review scores and ladder movement by week.</p></div>
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
          {resultsWeek?.completed ? <WeeklyAwards week={resultsWeek} weeks={data.weeks} /> : null}
          {resultsWeek ? <h3 className="results-label">{resultsWeek.status === "partial" ? `${resultsWeek.reportedBoxCount} of ${resultsWeek.scheduledBoxCount} boxes reported` : "Results"}</h3> : null}
          <LadderGrid
            week={resultsWeek}
            profiles={profiles}
            showResult
            showRecentResults={false}
            showSubstituteOnly
            showWeekday
            selectedPlayerName={selectedPlayerName}
            onSelect={setSelectedName}
          />
        </> : null}

        {section === "stats" ? <>
          <div className="section-head"><div><h2>{allTime ? "All-time numbers" : `${selectedSeason.label} numbers`}</h2></div></div>
          {!allTime ? <div className="stats-tabs" aria-label="Stats views">
            <button type="button" className={statsMode === "leaders" ? "active" : ""} aria-pressed={statsMode === "leaders"} onClick={() => setStatsMode("leaders")}>Stats</button>
            <button type="button" className={statsMode === "ranking" ? "active" : ""} aria-pressed={statsMode === "ranking"} onClick={() => setStatsMode("ranking")}>Ranking</button>
          </div> : null}
          {allTime ? <CareerStatsView profiles={careerProfiles} seasons={seasons} selectedPlayerName={selectedPlayerName} onSelect={setSelectedName} /> : statsMode === "leaders" ? <StatsView profiles={data.profiles} selectedPlayerName={selectedPlayerName} onSelect={setSelectedName} /> : <>
            <p className="ranking-explanation">Your ladder rank is your place in the next round of boxes. Movement sets the first and last positions in each box. Recent non-sub game totals order the players who stay.</p>
            <RankingView profiles={data.profiles} selectedPlayerName={selectedPlayerName} onSelect={setSelectedName} />
          </>}
        </> : null}

        {section === "head-to-head" ? <><div className="section-head compare-section-head"><div><h2>Compare players</h2></div></div><CompareView seasons={seasons} careers={careerProfiles} selectedSeason={selectedSeason} selectedPlayerName={selectedPlayerName} onSelect={setSelectedName} allTime={allTime} /></> : null}
      </section>

      <footer>Built by Igor Aguiar</footer>
      {selected ? (
        <ProfilePanel
          key={selected.name}
          profile={selected}
          seasons={seasons}
          career={selectedCareer}
          initialSeasonId={selectedSeason.id}
          canViewCurrentBox={selectedSeason.status === "current" && Boolean(upcoming?.boxes.some((box) => box.number === selected.currentBox))}
          onViewCurrentBox={() => viewUpcomingBox(selected.currentBox)}
          onViewSeasonRank={viewSeasonRank}
          isSelectedPlayer={selectedPlayerName === selected.name}
          onToggleSelectedPlayer={toggleSelectedPlayer}
          onClose={() => setSelectedName(null)}
        />
      ) : null}
    </main>
  );
}
