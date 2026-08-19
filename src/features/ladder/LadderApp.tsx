"use client";

import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Clock3,
  GitCompareArrows,
  Search,
  Share2,
  Sparkles,
  Trophy,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { LadderBox, LadderData, LadderWeek, Movement, PlayerProfile, PlayerResult } from "@/lib/types";

type View = "ladder" | "projection" | "stats" | "compare";
type LadderMode = "upcoming" | "results";

const initials = (name: string) =>
  name
    .replace(/[^a-zA-Z ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const movementIcon = (movement: Movement) => {
  if (movement === "UP") return <ArrowUp size={14} strokeWidth={3} />;
  if (movement === "DOWN") return <ArrowDown size={14} strokeWidth={3} />;
  return <ArrowRight size={14} strokeWidth={3} />;
};

function lastCompletedResult(profile: PlayerProfile): PlayerResult | undefined {
  return profile.history.find((item) => item.movement);
}

function PlayerRow({
  player,
  profile,
  showResult,
  onSelect,
  index,
}: {
  player: PlayerResult;
  profile?: PlayerProfile;
  showResult: boolean;
  onSelect: () => void;
  index: number;
}) {
  const previous = lastCompletedResult(profile || ({ history: [] } as unknown as PlayerProfile));
  const movement = showResult ? player.movement : previous?.movement || "";
  return (
    <button
      className={`player-row movement-${movement.toLowerCase() || "none"}`}
      style={{ "--delay": `${index * 60}ms` } as React.CSSProperties}
      onClick={onSelect}
    >
      <span className="avatar">{initials(player.name)}</span>
      <span className="player-copy">
        <strong>{player.name}</strong>
        {player.substitute ? <small>Sub: {player.substitute}</small> : <small>{movement ? `Last: ${movement.toLowerCase()}` : "Ready to play"}</small>}
      </span>
      {showResult && player.total !== null ? (
        <span className="score-stack">
          <strong>{player.total}</strong>
          <small>{player.rawScore}</small>
        </span>
      ) : null}
      {movement ? <span className={`movement-badge ${movement.toLowerCase()}`}>{movementIcon(movement)}</span> : <ChevronRight size={18} />}
    </button>
  );
}

function BoxCard({
  box,
  profiles,
  showResult,
  onSelect,
}: {
  box: LadderBox;
  profiles: Map<string, PlayerProfile>;
  showResult: boolean;
  onSelect: (name: string) => void;
}) {
  return (
    <article className="box-card">
      <header className="box-head">
        <div>
          <span>BOX</span>
          <strong>{String(box.number).padStart(2, "0")}</strong>
        </div>
        <div className="box-meta">
          <span><Clock3 size={14} /> {box.time}</span>
          <span>Court {box.court}</span>
        </div>
      </header>
      <div className="player-list">
        {box.players.map((player, index) => (
          <PlayerRow
            key={`${player.name}-${index}`}
            player={player}
            profile={profiles.get(player.name)}
            showResult={showResult}
            onSelect={() => onSelect(player.name)}
            index={index}
          />
        ))}
      </div>
    </article>
  );
}

function LadderGrid({
  week,
  profiles,
  showResult,
  onSelect,
}: {
  week: LadderWeek | null;
  profiles: Map<string, PlayerProfile>;
  showResult: boolean;
  onSelect: (name: string) => void;
}) {
  if (!week) return <div className="empty-state">No ladder is available yet.</div>;
  return (
    <div className="box-grid">
      {week.boxes.map((box) => (
        <BoxCard key={box.number} box={box} profiles={profiles} showResult={showResult} onSelect={onSelect} />
      ))}
    </div>
  );
}

function ProfilePanel({ profile, onClose }: { profile: PlayerProfile; onClose: () => void }) {
  const latest = profile.history[0];
  const trend = profile.history
    .filter((item) => item.movement)
    .slice(0, 6)
    .reverse();

  async function shareProfile() {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#11251e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#d9ff57";
    ctx.fillRect(72, 72, 170, 70);
    ctx.fillStyle = "#11251e";
    ctx.font = "700 36px Arial";
    ctx.fillText("PADEL /", 94, 120);
    ctx.fillStyle = "#f4f1e8";
    ctx.font = "700 82px Arial";
    ctx.fillText(profile.name, 72, 315);
    ctx.fillStyle = "#a6b1a9";
    ctx.font = "500 36px Arial";
    ctx.fillText("CURRENT LADDER POSITION", 72, 405);
    ctx.fillStyle = "#d9ff57";
    ctx.font = "800 250px Arial";
    ctx.fillText(`#${profile.currentBox}`, 62, 680);
    ctx.fillStyle = "#f4f1e8";
    ctx.font = "700 46px Arial";
    ctx.fillText(`${profile.promotions} moves up  •  ${profile.weeksPlayed} weeks`, 72, 810);
    ctx.strokeStyle = "#3a4e46";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(72, 880);
    ctx.lineTo(1008, 880);
    ctx.stroke();
    ctx.fillStyle = "#a6b1a9";
    ctx.font = "500 32px Arial";
    ctx.fillText("HIGHEST BOX", 72, 960);
    ctx.fillText("AVERAGE GAMES", 560, 960);
    ctx.fillStyle = "#f4f1e8";
    ctx.font = "800 76px Arial";
    ctx.fillText(String(profile.highestBox), 72, 1050);
    ctx.fillText(profile.averageGames.toFixed(1), 560, 1050);
    ctx.fillStyle = "#d9ff57";
    ctx.font = "700 30px Arial";
    ctx.fillText("KEEP CLIMBING.", 72, 1250);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    const file = new File([blob], `${profile.name.replace(/\s+/g, "-").toLowerCase()}-ladder.png`, { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: `${profile.name} — Padel Ladder`, text: `Box ${profile.currentBox} on the Padel Ladder`, files: [file] });
    } else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(url);
    }
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
          <span>CURRENT POSITION</span>
          <strong>BOX {profile.currentBox}</strong>
          <small>{latest?.time || ""} · Court {latest?.court || "TBD"}</small>
        </div>
        <button className="share-card-button" onClick={shareProfile}><Share2 size={18} /> Share my ladder card</button>
        <div className="profile-stats">
          <div><strong>{profile.highestBox}</strong><span>Highest box</span></div>
          <div><strong>{profile.promotions}</strong><span>Moves up</span></div>
          <div><strong>{profile.weeksPlayed}</strong><span>Weeks played</span></div>
          <div><strong>{profile.averageGames.toFixed(1)}</strong><span>Avg. games</span></div>
        </div>
        <section className="history-section">
          <h3>Recent form</h3>
          <div className="trend-line">
            {trend.map((item) => <span key={`${item.dateKey}-${item.box}`} className={item.movement.toLowerCase()} title={`${item.date}: Box ${item.box}`}>{item.box}</span>)}
          </div>
          <div className="history-list">
            {profile.history.filter((item) => item.total !== null).slice(0, 8).map((item) => (
              <div key={`${item.dateKey}-${item.box}`}>
                <span><strong>{item.date}</strong><small>Box {item.box} · {item.rawScore}</small></span>
                <span className={`history-move ${item.movement.toLowerCase()}`}>{movementIcon(item.movement)} {item.movement}</span>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function StatsView({ profiles, onSelect }: { profiles: PlayerProfile[]; onSelect: (name: string) => void }) {
  const active = profiles.filter((profile) => profile.weeksPlayed > 0);
  const climbers = [...active].sort((a, b) => b.promotions - a.promotions || a.currentBox - b.currentBox).slice(0, 8);
  const steady = [...active].sort((a, b) => b.weeksPlayed - a.weeksPlayed || b.stays - a.stays).slice(0, 8);
  const hot = [...active].sort((a, b) => b.streak - a.streak || b.promotions - a.promotions).slice(0, 5);
  return (
    <div className="stats-layout">
      <section className="stat-feature">
        <span className="eyebrow">LEAGUE PULSE</span>
        <h2>{active.length}</h2>
        <p>players have competed this season.</p>
        <div className="stat-feature-row"><strong>{profiles.reduce((sum, profile) => sum + profile.weeksPlayed, 0)}</strong><span>player appearances</span></div>
      </section>
      <section className="leaderboard-card">
        <header><Trophy size={20} /><h3>Most moves up</h3></header>
        {climbers.map((profile, index) => (
          <button key={profile.name} onClick={() => onSelect(profile.name)}>
            <span className="rank">{index + 1}</span><span className="avatar small">{initials(profile.name)}</span>
            <span className="leader-name"><strong>{profile.name}</strong><small>Box {profile.currentBox}</small></span>
            <strong className="lime-number">{profile.promotions}</strong>
          </button>
        ))}
      </section>
      <section className="leaderboard-card">
        <header><CalendarDays size={20} /><h3>Most active</h3></header>
        {steady.map((profile, index) => (
          <button key={profile.name} onClick={() => onSelect(profile.name)}>
            <span className="rank">{index + 1}</span><span className="avatar small">{initials(profile.name)}</span>
            <span className="leader-name"><strong>{profile.name}</strong><small>{profile.stays} stays</small></span>
            <strong>{profile.weeksPlayed}w</strong>
          </button>
        ))}
      </section>
      <section className="hot-card">
        <header><Sparkles size={20} /><h3>Hot streaks</h3></header>
        <div>{hot.map((profile) => <button key={profile.name} onClick={() => onSelect(profile.name)}><strong>{profile.name}</strong><span>{profile.streak ? `${profile.streak}× UP` : `${profile.promotions} total UP`}</span></button>)}</div>
      </section>
    </div>
  );
}

function CompareView({ profiles, onSelect }: { profiles: PlayerProfile[]; onSelect: (name: string) => void }) {
  const active = profiles.filter((profile) => profile.weeksPlayed > 0);
  const [leftName, setLeftName] = useState(active[0]?.name || "");
  const [rightName, setRightName] = useState(active[1]?.name || "");
  const left = active.find((profile) => profile.name === leftName);
  const right = active.find((profile) => profile.name === rightName);
  const shared = left && right
    ? left.history.filter((entry) => right.history.some((other) => other.dateKey === entry.dateKey && other.box === entry.box && entry.total !== null))
    : [];
  const metrics = left && right ? [
    ["Current box", left.currentBox, right.currentBox, "lower"],
    ["Highest box", left.highestBox, right.highestBox, "lower"],
    ["Moves up", left.promotions, right.promotions, "higher"],
    ["Weeks played", left.weeksPlayed, right.weeksPlayed, "higher"],
    ["Avg. games", left.averageGames.toFixed(1), right.averageGames.toFixed(1), "higher"],
  ] as const : [];
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
        <div className="metric-list">
          {metrics.map(([label, a, b, preference]) => {
            const leftWins = preference === "lower" ? Number(a) < Number(b) : Number(a) > Number(b);
            const rightWins = preference === "lower" ? Number(b) < Number(a) : Number(b) > Number(a);
            return <div key={label}><strong className={leftWins ? "winner" : ""}>{a}</strong><span>{label}</span><strong className={rightWins ? "winner" : ""}>{b}</strong></div>;
          })}
        </div>
        <div className="shared-boxes"><UsersRound size={20} /><strong>{shared.length}</strong><span>shared box sessions</span></div>
      </> : null}
    </div>
  );
}

export function LadderApp({ data }: { data: LadderData }) {
  const [view, setView] = useState<View>("ladder");
  const [ladderMode, setLadderMode] = useState<LadderMode>(data.upcoming ? "upcoming" : "results");
  const [query, setQuery] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const profiles = useMemo(() => new Map(data.profiles.map((profile) => [profile.name, profile])), [data.profiles]);
  const searchResults = query.trim().length > 1
    ? data.profiles.filter((profile) => profile.name.toLowerCase().includes(query.toLowerCase())).slice(0, 7)
    : [];
  const selected = selectedName ? profiles.get(selectedName) : undefined;
  const week = ladderMode === "upcoming" ? data.upcoming : data.latestCompleted;

  const views: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: "ladder", label: "Ladder", icon: <UsersRound size={18} /> },
    { id: "projection", label: "Next week", icon: <Sparkles size={18} /> },
    { id: "stats", label: "Stats", icon: <BarChart3 size={18} /> },
    { id: "compare", label: "Compare", icon: <GitCompareArrows size={18} /> },
  ];

  return (
    <main>
      <header className="site-header">
        <button className="brand" onClick={() => setView("ladder")}><span className="brand-mark">P/</span><span>PADEL<br />LADDER</span></button>
        <nav>{views.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>{item.icon}{item.label}</button>)}</nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><i /> LIVE LEAGUE</span>
          <h1>Find your box.<br /><em>Make your move.</em></h1>
          <p>Weekly positions, results, player form, and the race up the ladder.</p>
        </div>
        <div className="hero-orbit" aria-hidden="true"><span>UP</span><span>STAY</span><span>DOWN</span><strong>↗</strong></div>
      </section>

      <section className="search-wrap">
        <Search size={21} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a player…" aria-label="Find a player" />
        {query ? <button onClick={() => setQuery("")} aria-label="Clear search"><X size={18} /></button> : <span className="search-hint">⌘ K</span>}
        {searchResults.length ? <div className="search-results">{searchResults.map((profile) => <button key={profile.name} onClick={() => { setSelectedName(profile.name); setQuery(""); }}><span className="avatar small">{initials(profile.name)}</span><span><strong>{profile.name}</strong><small>Box {profile.currentBox} · {profile.weeksPlayed} weeks</small></span><ChevronRight size={18} /></button>)}</div> : null}
      </section>

      <section className="content-shell">
        <div className="mobile-tabs">{views.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>{item.icon}<span>{item.label}</span></button>)}</div>

        {view === "ladder" ? <>
          <div className="section-head">
            <div><span className="eyebrow">THE LADDER</span><h2>{week?.date || "Latest ladder"}</h2></div>
            <div className="segmented">
              {data.upcoming ? <button className={ladderMode === "upcoming" ? "active" : ""} onClick={() => setLadderMode("upcoming")}>Upcoming</button> : null}
              <button className={ladderMode === "results" ? "active" : ""} onClick={() => setLadderMode("results")}>Results</button>
            </div>
          </div>
          <LadderGrid week={week} profiles={profiles} showResult={ladderMode === "results"} onSelect={setSelectedName} />
        </> : null}

        {view === "projection" ? <>
          <div className="section-head">
            <div><span className="eyebrow">AUTOMATIC PROJECTION</span><h2>Next week’s boxes</h2><p>Based on the latest UP, STAY, and DOWN results.</p></div>
            <span className="projection-pill"><Sparkles size={16} /> PROJECTED</span>
          </div>
          <LadderGrid week={data.projected} profiles={profiles} showResult={false} onSelect={setSelectedName} />
          <p className="projection-note">This is a preview. Absences and substitutes can change the official boxes.</p>
        </> : null}

        {view === "stats" ? <><div className="section-head"><div><span className="eyebrow">NUMBERS DON'T LIE</span><h2>League leaders</h2></div></div><StatsView profiles={data.profiles} onSelect={setSelectedName} /></> : null}
        {view === "compare" ? <><div className="section-head"><div><span className="eyebrow">HEAD TO HEAD</span><h2>Compare players</h2></div></div><CompareView profiles={data.profiles} onSelect={setSelectedName} /></> : null}
      </section>

      <footer><span className="brand-mark">P/</span><span>Updated when the league sheet is rebuilt.</span><span>{data.profiles.length} players · {data.weeks.length} weeks</span></footer>
      {selected ? <ProfilePanel profile={selected} onClose={() => setSelectedName(null)} /> : null}
    </main>
  );
}
