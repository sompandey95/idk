import { useEffect, useRef, useState } from "react";
import {
  Award,
  Check,
  ChevronRight,
  Cloud,
  Download,
  Upload,
  Globe,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  Sparkles,
  Trophy,
  UserRound,
  Volume2,
  Vibrate,
  Wind,
  Copy,
  Swords,
} from "lucide-react";
import { Dialog } from "./Dialog";
import { sound } from "../services/sound";
import {
  exportBackup,
  importBackup,
  loadPlayer,
  savePlayer,
} from "../services/player";
import type { PlayerState } from "../services/player";
import type { GameCopy } from "../services/copy";
import type { Preferences } from "../services/preferences";
import type { CloudState } from "../hooks/useCloud";
import type { ScoreEntry } from "../services/firebase";
import { getLanguageName } from "../services/i18n";
import { achievementCopy } from "../services/achievementCopy";

interface Props {
  panel: string;
  close: () => void;
  copy: GameCopy;
  player: PlayerState;
  preferences: Preferences;
  setPreferences: (p: Preferences) => void;
  cloud: CloudState;
  open: (panel: string) => void;
  roomId: string;
  setRoomId: (id: string) => void;
  roomStatus: string;
}

function SettingsPanel({ copy: c, preferences, setPreferences }: Props) {
  const [audio, setAudio] = useState(sound.isSoundEnabled());
  const [haptic, setHaptic] = useState(sound.isHapticsEnabled());
  const toggles = [
    {
      label: c.sound,
      Icon: Volume2,
      value: audio,
      action: () => setAudio(sound.toggleSound()),
    },
    {
      label: c.haptics,
      Icon: Vibrate,
      value: haptic,
      action: () => setHaptic(sound.toggleHaptics()),
    },
    {
      label: c.motion,
      Icon: Wind,
      value: preferences.reducedMotion,
      action: () =>
        setPreferences({
          ...preferences,
          reducedMotion: !preferences.reducedMotion,
        }),
    },
  ];
  return (
    <div className="settings-panel">
      {toggles.map(({ label, Icon, value, action }) => (
        <div className="setting-row" key={label}>
          <span>
            <Icon size={19} />
            {label}
          </span>
          <button
            className={`toggle ${value ? "on" : ""}`}
            role="switch"
            aria-checked={value}
            aria-label={label}
            onClick={action}
          >
            <i />
          </button>
        </div>
      ))}
      <label className="setting-row">
        <span>
          <Globe size={19} />
          {c.language}
        </span>
        <select
          aria-label={c.language}
          value={preferences.language}
          onChange={(e) =>
            setPreferences({
              ...preferences,
              language: e.target.value as Preferences["language"],
            })
          }
        >
          {(["en", "es", "de", "fr", "ja", "zh", "ko"] as const).map((lang) => (
            <option value={lang} key={lang}>
              {getLanguageName(lang)}
            </option>
          ))}
        </select>
      </label>
      <p className="panel-note">{c.focusDescription}</p>
    </div>
  );
}

function ProfilePanel({ copy: c, player, cloud }: Props) {
  const [name, setName] = useState(player.displayName);
  const [region, setRegion] = useState(player.region);
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setName(player.displayName);
    setRegion(player.region);
  }, [player.displayName, player.region]);
  const download = () => {
    const url = URL.createObjectURL(
      new Blob([exportBackup()], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `synapse-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <div className="profile-identity">
        <span className="profile-avatar">
          {player.displayName.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <h3>{player.displayName}</h3>
          <span className="small muted">{cloud.user?.email || c.local}</span>
        </div>
        <span className="tier-badge">
          {c.tier} {player.seasonTier}
        </span>
      </div>
      <form
        className="profile-form"
        onSubmit={(e) => {
          e.preventDefault();
          const latest = loadPlayer();
          savePlayer({
            ...latest,
            displayName: name.trim().slice(0, 24) || "Operator",
            region,
          });
          setNotice(c.saved);
        }}
      >
        <label>
          {c.callsign}
          <input
            maxLength={24}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          {c.region}
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value as PlayerState["region"])}
          >
            <option value="NA">{c.northAmerica}</option>
            <option value="EU">{c.europe}</option>
            <option value="ASIA">{c.asia}</option>
          </select>
        </label>
        <button className="button button-secondary" type="submit">
          <Check size={15} />
          {c.save}
        </button>
      </form>
      <div className="profile-metrics">
        <div>
          <span>{c.runs}</span>
          <strong>{player.totalGames.toLocaleString()}</strong>
        </div>
        <div>
          <span>{c.best}</span>
          <strong>{player.highScore.toLocaleString()}</strong>
        </div>
        <div>
          <span>{c.routed}</span>
          <strong>{player.totalPacketsClassified.toLocaleString()}</strong>
        </div>
      </div>
      <div className="cloud-card">
        <Cloud size={24} />
        <div>
          <h3>{c.cloud}</h3>
          <p>{c.cloudDescription}</p>
        </div>
        <button
          className="button button-primary"
          disabled={cloud.status === "syncing"}
          onClick={() => void (cloud.user ? cloud.sync() : cloud.connect())}
        >
          {cloud.status === "syncing" ? (
            <LoaderCircle size={16} className="spin" />
          ) : cloud.user ? (
            <RefreshCw size={16} />
          ) : (
            <Globe size={16} />
          )}
          {cloud.status === "syncing"
            ? c.syncing
            : cloud.user
              ? c.sync
              : c.connect}
        </button>
      </div>
      {cloud.status === "error" && (
        <p className="notice notice-error" role="status">
          {c.syncError}
        </p>
      )}
      {cloud.status === "connected" && (
        <p className="notice" role="status">
          <Check size={14} />
          {c.connected} · {player.pendingSyncQueue.length} {c.pending}
        </p>
      )}
      <div className="backup-row">
        <p>{c.backupDescription}</p>
        <div>
          <button className="text-button" onClick={download}>
            <Download size={15} />
            {c.backup}
          </button>
          <button
            className="text-button"
            onClick={() => input.current?.click()}
          >
            <Upload size={15} />
            {c.restore}
          </button>
        </div>
        <input
          hidden
          ref={input}
          type="file"
          accept="application/json,.json"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file)
              setNotice(
                file.size <= 2000000 && importBackup(await file.text())
                  ? c.saved
                  : c.backupError,
              );
            e.target.value = "";
          }}
        />
      </div>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <div className="history-heading">
        <h3>{c.career}</h3>
        <span className="mono small">{player.history.length}</span>
      </div>
      {player.history.length ? (
        <div className="history-list">
          {player.history
            .slice(-5)
            .reverse()
            .map((run) => (
              <div key={run.id}>
                <span className={`history-dot ${run.mode}`} />
                <div>
                  <strong>{c[run.mode]}</strong>
                  <small>
                    {new Date(run.completedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    ·{" "}
                    {run.resolved
                      ? Math.round((run.correct / run.resolved) * 100)
                      : 100}
                    %
                  </small>
                </div>
                <strong>{run.score.toLocaleString()}</strong>
              </div>
            ))}
        </div>
      ) : (
        <p className="panel-note">{c.noRuns}</p>
      )}
    </>
  );
}

function CollectionPanel({ copy: c, player, preferences }: Props) {
  const [tab, setTab] = useState("skins");
  const skins = [
    { id: "mint", name: c.mint, color: "#76e5dc", xp: 0 },
    { id: "violet", name: c.violet, color: "#b5a0ff", xp: 1000 },
    { id: "amber", name: c.amber, color: "#ecc77c", xp: 3000 },
  ];
  return (
    <>
      <div className="panel-tabs">
        <button
          className={tab === "skins" ? "active" : ""}
          onClick={() => setTab("skins")}
        >
          {c.skins}
        </button>
        <button
          className={tab === "achievements" ? "active" : ""}
          onClick={() => setTab("achievements")}
        >
          {c.unlocked}
          <span>{player.achievements.filter((a) => a.unlocked).length}/8</span>
        </button>
      </div>
      {tab === "skins" ? (
        <>
          <div className="collection-heading">
            <p>{c.skinHint}</p>
            <span className="mono">{player.seasonExp.toLocaleString()} XP</span>
          </div>
          <div className="skin-grid">
            {skins.map((s) => (
              <div
                key={s.id}
                className={`skin-card ${player.equippedSkin === s.id ? "equipped" : ""}`}
                style={{ "--skin": s.color } as React.CSSProperties}
              >
                <div className="skin-preview">
                  <i />
                  <i />
                  <i />
                  <b />
                </div>
                <h3>{s.name}</h3>
                <span className="small muted">
                  {s.xp === 0 ? c.tier + " 1" : `${s.xp.toLocaleString()} XP`}
                </span>
                <button
                  className="button button-secondary"
                  disabled={
                    player.seasonExp < s.xp || player.equippedSkin === s.id
                  }
                  onClick={() =>
                    savePlayer({
                      ...loadPlayer(),
                      equippedSkin: s.id as PlayerState["equippedSkin"],
                    })
                  }
                >
                  {player.equippedSkin === s.id ? (
                    <Check size={14} />
                  ) : player.seasonExp < s.xp ? (
                    <LockKeyhole size={14} />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  {player.equippedSkin === s.id
                    ? c.equipped
                    : player.seasonExp < s.xp
                      ? c.locked
                      : c.equip}
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="achievement-list">
          {player.achievements.map((a) => (
            <div
              className={a.unlocked ? "achievement-unlocked" : ""}
              key={a.id}
            >
              <div className="achievement-icon">
                {a.unlocked ? <Award size={22} /> : <LockKeyhole size={18} />}
              </div>
              <div>
                <h3>{achievementCopy(preferences.language, a).name}</h3>
                <p>{achievementCopy(preferences.language, a).description}</p>
                <div className="achievement-track">
                  <i
                    style={{ width: `${(a.progress / a.maxProgress) * 100}%` }}
                  />
                </div>
              </div>
              <span>
                {a.unlocked ? (
                  <Check size={17} />
                ) : (
                  `${a.progress}/${a.maxProgress}`
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function RankingsPanel({ copy: c, cloud, player }: Props) {
  const [mode, setMode] = useState("adaptive");
  const [region, setRegion] = useState("GLOBAL");
  const [entries, setEntries] = useState<ScoreEntry[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "cached" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  const [personal, setPersonal] = useState<{
    entry: ScoreEntry;
    rank: number;
  } | null>(null);
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    setState("loading");
    setEntries([]);
    setPersonal(null);
    const timeout = setTimeout(() => {
      if (active) setState((s) => (s === "loading" ? "error" : s));
    }, 12000);
    import("../services/firebase")
      .then((service) => {
        if (!active) return;
        unsubscribe = service.subscribeBoard(
          mode,
          region,
          (scores, cached) => {
            if (!active) return;
            setEntries(scores);
            setState(cached ? "cached" : "ready");
            if (cloud.user)
              void service
                .getPersonalRank(cloud.user.uid, mode, region)
                .then((rank) => {
                  if (active) setPersonal(rank);
                })
                .catch(() => {});
          },
          () => {
            if (active) setState("error");
          },
        );
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
      clearTimeout(timeout);
      unsubscribe?.();
    };
  }, [mode, region, attempt, cloud.user]);
  return (
    <>
      <p className="panel-description">{c.leaderboardDescription}</p>
      <div className="panel-tabs">
        {(["adaptive", "daily", "sprint"] as const).map((m) => (
          <button
            className={mode === m ? "active" : ""}
            key={m}
            onClick={() => setMode(m)}
          >
            {c[m]}
          </button>
        ))}
      </div>
      <div className="ranking-filters">
        <div className="region-buttons">
          {["GLOBAL", "NA", "EU", "ASIA"].map((r) => (
            <button
              key={r}
              className={region === r ? "active" : ""}
              onClick={() => setRegion(r)}
            >
              {r === "GLOBAL" ? c.global : r}
            </button>
          ))}
        </div>
        <span className="small muted">
          <span className="status-dot" />
          {!cloud.online || state === "cached" ? c.offline : c.casual}
        </span>
      </div>
      {state === "loading" ? (
        <div className="empty-state">
          <LoaderCircle className="spin" size={28} />
          <p>{c.loading}</p>
        </div>
      ) : state === "error" ? (
        <div className="empty-state">
          <Cloud size={32} />
          <p>{c.boardError}</p>
          <button
            className="button button-secondary"
            onClick={() => setAttempt((a) => a + 1)}
          >
            <RefreshCw size={14} />
            {c.retry}
          </button>
        </div>
      ) : !entries.length ? (
        <div className="empty-state">
          <Trophy size={35} />
          <h3>{c.emptyBoard}</h3>
          <p>{state === "cached" ? c.offline : c.emptyBoardDescription}</p>
        </div>
      ) : (
        <div className="ranking-table-wrap">
          <table className="ranking-table">
            <thead>
              <tr>
                <th>{c.rank}</th>
                <th>{c.player}</th>
                <th>{c.region}</th>
                <th>{c.score}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => (
                <tr
                  key={entry.uid}
                  className={entry.uid === cloud.user?.uid ? "own-score" : ""}
                >
                  <td>
                    {1 + entries.filter((e) => e.score > entry.score).length}
                  </td>
                  <td>
                    <span className="ranking-avatar">
                      {entry.displayName.slice(0, 1).toUpperCase()}
                    </span>
                    {entry.displayName}
                    {entry.uid === cloud.user?.uid && (
                      <span className="you-label">{c.you}</span>
                    )}
                  </td>
                  <td>{entry.region}</td>
                  <td>{entry.score.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {personal && !entries.some((e) => e.uid === personal.entry.uid) && (
        <div className="personal-rank">
          <span>#{personal.rank}</span>
          <strong>{personal.entry.displayName}</strong>
          <span>{personal.entry.score.toLocaleString()}</span>
        </div>
      )}
      <div className="panel-bottom-note">
        <span>{c.casual}</span>
        <span>
          {player.pendingSyncQueue.length} {c.pending}
        </span>
      </div>
    </>
  );
}

function DuelPanel({
  copy: c,
  cloud,
  player,
  open,
  roomId,
  setRoomId,
  roomStatus,
}: Props) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const perform = async (host: boolean) => {
    setBusy(true);
    setError(false);
    try {
      const service = await import("../services/firebase");
      if (host) setRoomId(await service.createRoom(player.displayName));
      else {
        const id = code.trim().toUpperCase();
        if (!/^[A-F0-9]{8}$/.test(id)) throw new Error("Invalid code");
        await service.joinRoom(id, player.displayName);
        setRoomId(id);
      }
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="duel-panel">
      <div className="duel-emblem">
        <Swords size={34} />
      </div>
      <p className="panel-description">{c.duelInfo}</p>
      {!cloud.user ? (
        <>
          <p>{c.duelRequires}</p>
          <button
            className="button button-primary"
            onClick={() => open("profile")}
          >
            <UserRound size={16} />
            {c.profile}
            <ChevronRight size={16} />
          </button>
        </>
      ) : roomId ? (
        <div className="room-waiting">
          <p className="eyebrow">{c.room}</p>
          <button
            className="room-code"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(roomId);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {roomId}
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
          <p>
            <LoaderCircle size={15} className="spin" />
            {roomStatus || c.waiting}
          </p>
        </div>
      ) : (
        <>
          <button
            className="button button-primary"
            disabled={busy || !cloud.online}
            onClick={() => void perform(true)}
          >
            {busy ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Swords size={16} />
            )}
            {c.host}
          </button>
          <div className="duel-divider" />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void perform(false);
            }}
          >
            <label>
              {c.room}
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="A1B2C3D4"
                maxLength={8}
                autoComplete="off"
                spellCheck={false}
                required
              />
            </label>
            <button
              className="button button-secondary"
              disabled={busy || code.trim().length !== 8 || !cloud.online}
            >
              {c.join}
              <ChevronRight size={16} />
            </button>
          </form>
        </>
      )}
      {error && (
        <p role="status" className="notice notice-error">
          {c.roomError}
        </p>
      )}
    </div>
  );
}

export default function Panels(props: Props) {
  const c = props.copy;
  const titles: Record<string, string> = {
    settings: c.settings,
    profile: c.profile,
    collection: c.collection,
    rankings: c.rankings,
    duel: c.duel,
  };
  return (
    <Dialog
      title={titles[props.panel] || ""}
      eyebrow="SYNAPSE / OVERDRIVE"
      onClose={props.close}
      closeLabel={c.close}
      wide={props.panel !== "settings" && props.panel !== "duel"}
    >
      {props.panel === "settings" && <SettingsPanel {...props} />}
      {props.panel === "profile" && <ProfilePanel {...props} />}
      {props.panel === "collection" && <CollectionPanel {...props} />}
      {props.panel === "rankings" && <RankingsPanel {...props} />}
      {props.panel === "duel" && <DuelPanel {...props} />}
    </Dialog>
  );
}
