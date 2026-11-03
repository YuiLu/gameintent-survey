"use client";
import { studyApi as api } from "../lib/study/client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Pause,
  Play,
  ShieldCheck,
  Video,
  X,
} from "lucide-react";
import {
  GAMES,
  LABEL_OPTIONS,
  DESCRIPTION_OPTIONS,
} from "@/lib/study/constants";
type Any = any;
type Language = "zh" | "en";
const Locale = createContext({
  language: "zh" as Language,
  setLanguage: (_v: Language) => {},
  t: (zh: string, _en: string) => zh,
});
export function LanguageProvider({
  children,
  initialLanguage = "zh",
}: {
  children: ReactNode;
  initialLanguage?: Language;
}) {
  const [language, setLanguage] = useState<Language>(initialLanguage);
  useEffect(() => {
    try {
      if (localStorage.getItem("gi-language") === "en") setLanguage("en");
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    document.title =
      language === "zh"
        ? "Game-Intention · 意图标注研究"
        : "Game-Intention · Annotation Study";
    try {
      localStorage.setItem("gi-language", language);
    } catch {}
  }, [language]);
  return (
    <Locale.Provider
      value={{
        language,
        setLanguage,
        t: (zh, en) => (language === "zh" ? zh : en),
      }}
    >
      {children}
    </Locale.Provider>
  );
}
export const useLanguage = () => useContext(Locale);

function errorText(message: string, language: Language) {
  if (language === "zh") return message;
  const known: Record<string, string> = {
    "研究尚未开放正式参与，可先体验演示。":
      "The study is not open for participation yet.",
    "这款游戏目前名额已满，请稍后再试。":
      "All places for this game are currently filled. Please try again later.",
    "当前名额刚被分配完。你的练习已保存，可稍后再试。":
      "The last place was just taken. Your examples are saved; please try again later.",
    "请先播放视频。如无法加载，可报告播放问题。":
      "Please play the video before submitting. Report a playback issue if it does not load.",
    "研究已暂停或关闭，请稍后继续。":
      "The study is paused or closed. Please return later.",
    "请登录研究者后台。": "Please sign in to the researcher workspace.",
    "本次说明检查未通过，感谢你的参与。":
      "The instruction check was not passed. Thank you for your time.",
    "请重读说明：不能用常识补充画面里没有的证据。":
      "Please review the instructions: do not substitute general knowledge for missing visual evidence.",
  };
  return (
    known[message] ||
    "The request could not be completed. Your saved progress is retained. Please try again."
  );
}
function Button({
  children,
  onClick,
  disabled = false,
  secondary = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <button
      type="button"
      className={"button " + (secondary ? "secondary" : "")}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={"notice " + (error ? "error" : "")}
      role={error ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
function Steps({ active }: { active: number }) {
  const { t } = useLanguage();
  return (
    <nav className="study-steps" aria-label={t("问卷步骤", "Study steps")}>
      {[
        [t("研究说明", "Overview")],
        [t("选择游戏", "Your game")],
        [t("入门示例", "Examples")],
        [t("视频评价", "Review")],
      ].map(([label], i) => (
        <span
          key={i}
          aria-current={active === i ? "step" : undefined}
          className={active === i ? "active" : active > i ? "complete" : ""}
        >
          <i>{active > i ? <Check size={12} /> : i + 1}</i>
          {label}
        </span>
      ))}
    </nav>
  );
}
function Pair({
  zh,
  en,
  className = "",
}: {
  zh: string;
  en: string;
  className?: string;
}) {
  const { language } = useLanguage();
  return (
    <div className={"bilingual-copy " + className}>
      <p lang={language === "zh" ? "zh-CN" : "en"}>
        {language === "zh" ? zh : en}
      </p>
      <p className="secondary-copy" lang={language === "zh" ? "en" : "zh-CN"}>
        {language === "zh" ? en : zh}
      </p>
    </div>
  );
}
const optionDetails: Record<string, string> = {
  supported:
    "The goal matches the visible evidence. Other simultaneous goals do not invalidate it.",
  partly_supported: "Only part of the label meaning or label set is supported.",
  contradicted: "The stated goal or actor conflicts with what is visible.",
  insufficient:
    "The clip does not provide enough evidence to judge the goal or actor.",
  unfamiliar:
    "You lack the game knowledge needed to judge this particular situation.",
  fully_supported:
    "Both the main goal and meaningful details are grounded; harmless wording differences are acceptable.",
  goal_supported_details_unverified:
    "The goal is supported, but added actors, motives, or tactical details are not established.",
  goal_incorrect:
    "The main goal or actor in the description conflicts with the video.",
};
function Options({
  items,
  value,
  onChange,
  name,
}: {
  items: readonly Any[];
  value: string;
  onChange: (v: string) => void;
  name: string;
}) {
  const { language } = useLanguage();
  return (
    <div className="options">
      {items.map((o) => (
        <label
          className={"option " + (value === o.value ? "selected" : "")}
          key={o.value}
        >
          <input
            type="radio"
            name={name}
            checked={value === o.value}
            value={o.value}
            onChange={() => onChange(o.value)}
          />
          <span className="radio-indicator">
            {value === o.value && <span />}
          </span>
          <span>
            <strong>{language === "zh" ? o.title : o.en}</strong>
            {o.detail && (
              <p>{language === "zh" ? o.detail : optionDetails[o.value]}</p>
            )}
          </span>
        </label>
      ))}
    </div>
  );
}
export function Player({
  src,
  onLoaded,
  onTime,
}: {
  src: string;
  onLoaded: (v: boolean) => void;
  onTime: (v: number) => void;
}) {
  const { t } = useLanguage();
  const ref = useRef<HTMLVideoElement>(null);
  const callbacks = useRef({ onLoaded, onTime });
  callbacks.current = { onLoaded, onTime };
  const manualRetry = useRef(() => {});
  const [state, setState] = useState<
    "loading" | "ready" | "retrying" | "failed"
  >("loading");
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let attempts = 0,
      watched = 0,
      last = 0,
      resumeAt = 0;
    let wantsPlay = false,
      restarting = false,
      disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {
      clearTimeout(retryTimer);
      clearTimeout(watchdog);
    };
    const arm = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => retry(false), 20000);
    };
    const retry = (manual: boolean) => {
      if (disposed || restarting) return;
      clear();
      callbacks.current.onLoaded(false);
      resumeAt = Math.max(resumeAt, video.currentTime || 0);
      if (!manual && attempts >= 2) {
        setState("failed");
        return;
      }
      if (manual) attempts = 0;
      restarting = true;
      setState("retrying");
      retryTimer = setTimeout(
        () => {
          if (disposed) return;
          attempts++;
          const url = new URL(src, window.location.href);
          url.searchParams.set("_retry", String(Date.now()));
          video.src = url.href;
          video.load();
          restarting = false;
          arm();
        },
        manual ? 0 : attempts === 0 ? 600 : 1800,
      );
    };
    const ready = () => {
      clearTimeout(watchdog);
      setState("ready");
      callbacks.current.onLoaded(true);
      if (resumeAt > 0) {
        video.currentTime = Math.min(
          resumeAt,
          Math.max(0, video.duration - 0.1),
        );
        last = video.currentTime;
        resumeAt = 0;
      }
      if (wantsPlay && video.paused) void video.play().catch(() => {});
    };
    const play = () => {
      wantsPlay = true;
    };
    const playing = () => {
      clearTimeout(watchdog);
      setState("ready");
    };
    const pause = () => {
      if (!restarting && !video.error) wantsPlay = false;
    };
    const waiting = () => {
      if (video.ended || (video.paused && video.readyState >= 2)) return;
      setState("loading");
      arm();
    };
    const progress = () => {
      if (video.readyState < 2 || (!video.paused && video.readyState < 3))
        arm();
    };
    const error = () => retry(false);
    const time = () => {
      const delta = video.currentTime - last;
      if (delta > 0 && delta < 2.5) watched += delta;
      last = video.currentTime;
      callbacks.current.onTime(watched);
    };
    const events = {
      loadeddata: ready,
      canplay: ready,
      play,
      playing,
      pause,
      waiting,
      stalled: waiting,
      progress,
      error,
      timeupdate: time,
    };
    for (const [event, handler] of Object.entries(events))
      video.addEventListener(event, handler);
    manualRetry.current = () => retry(true);
    callbacks.current.onLoaded(false);
    callbacks.current.onTime(0);
    setState("loading");
    // Check cached data in case the element loaded before this effect attached.
    if (video.readyState >= 2) ready();
    else arm();
    return () => {
      disposed = true;
      clear();
      for (const [event, handler] of Object.entries(events))
        video.removeEventListener(event, handler);
    };
  }, [src]);
  return (
    <div className="player-shell">
      <video
        ref={ref}
        src={src}
        controls
        muted
        playsInline
        preload="auto"
        controlsList="nodownload"
        onVolumeChange={(e) => {
          e.currentTarget.muted = true;
        }}
      />
      <div className="video-meta">
        <span>
          {t(
            "无声播放 · 可暂停、重播与全屏",
            "Muted video · pause, replay, or go full screen",
          )}
        </span>
      </div>
      {(state === "loading" || state === "retrying") && (
        <div className="video-loading" role="status">
          <Loader2 className="spin" size={16} />
          <span>
            {state === "retrying"
              ? t(
                  "连接中断，正在重新加载…",
                  "Connection interrupted. Retrying…",
                )
              : t("正在加载视频…", "Loading video…")}
          </span>
          <button type="button" onClick={() => manualRetry.current()}>
            {t("重新加载", "Reload")}
          </button>
        </div>
      )}
      {state === "failed" && (
        <div className="video-error" role="alert">
          <Video />
          <p>
            {t(
              "视频暂时无法加载，答题进度已保留",
              "The video could not be loaded. Your answers are saved.",
            )}
          </p>
          <Button secondary onClick={() => manualRetry.current()}>
            {t("重新加载", "Reload video")}
          </Button>
        </div>
      )}
    </div>
  );
}

export function Evaluation({
  question,
  draft,
  draftKey,
  onDraft,
  onSubmit,
  busy = false,
  practice = false,
}: {
  question: Any;
  draft?: Any;
  draftKey?: string;
  onDraft?: (v: Any) => void;
  onSubmit: (v: Any) => void;
  busy?: boolean;
  practice?: boolean;
}) {
  const { t, language } = useLanguage();
  const [revealed, setRevealed] = useState<Any>(
      question.blind_locked ? question : null,
    ),
    [selected, setSelected] = useState<string[]>(
      question.blind_response?.labels || draft?.blind_labels || [],
    ),
    [status, setStatus] = useState(
      question.blind_response?.status || draft?.blind_status || "selected",
    ),
    [description, setDescription] = useState(draft?.description_support || ""),
    [comment, setComment] = useState(draft?.comment || ""),
    [loaded, setLoaded] = useState(false),
    [seconds, setSeconds] = useState(0),
    [locking, setLocking] = useState(false),
    [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const q = revealed || question,
    locked = !!revealed;
  useEffect(() => {
    const answer = {
      blind_labels: selected,
      blind_status: status,
      description_support: description,
      comment,
    };
    if (draftKey) localStorage.setItem(draftKey, JSON.stringify(answer));
    const timer = setTimeout(() => onDraft?.(answer), 600);
    return () => clearTimeout(timer);
  }, [selected, status, description, comment, draftKey]);
  async function lock() {
    setLocking(true);
    setError("");
    try {
      const r = await api("blind-lock", {
        ...(practice
          ? { question_id: question.id }
          : { assignment_id: question.assignment_id }),
        blind_labels: status === "selected" ? selected : [],
        blind_status: status,
        video_loaded: loaded,
        playback_seconds: seconds,
      });
      setRevealed(r.question);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLocking(false);
    }
  }
  return (
    <>
      <div className="review-top">
        <div>
          <span className="eyebrow">
            {practice
              ? t("入门示例", "GUIDED EXAMPLE")
              : t("视频评价", "VIDEO REVIEW")}
          </span>
          <h1>
            {
              GAMES.find((g) => g.id === q.game)?.[
                language === "zh" ? "zh" : "en"
              ]
            }
          </h1>
        </div>
        <span className="tag">
          {Math.round(q.duration)} {t("秒", "sec")}
        </span>
      </div>
      <div className="evaluation-layout">
        <div className="stimulus">
          <Player
            src={question.video_url}
            onLoaded={setLoaded}
            onTime={setSeconds}
          />
          <section className="annotation-card">
            <div className="task">
              <small>{t("所问对象与任务", "ACTOR AND TASK")}</small>
              <Pair zh={q.task_zh} en={q.task_en} />
            </div>
            {locked && (
              <>
                <p>
                  {t("你的盲选（已锁定）：", "Your locked selection: ")}
                  {q.blind_response?.status === "selected"
                    ? q.blind_response.labels.join(", ")
                    : q.blind_response?.status}
                </p>
                <div className="card-label">
                  {t("原始标注", "Original annotation")}
                </div>
                <div className="label-list">
                  {q.labels.map((l: Any) => (
                    <div className="label-item" key={l.id}>
                      <code>{l.en}</code> · {l.zh}
                      <Pair zh={l.definition_zh} en={l.definition_en} />
                    </div>
                  ))}
                </div>
                <div className="description">
                  <small>{t("意图描述", "INTENT DESCRIPTION")}</small>
                  <Pair zh={q.description_zh} en={q.description_en} />
                </div>
              </>
            )}
          </section>
        </div>
        <div className="judgments">
          <nav className="judgment-pages">
            <span>
              {locked
                ? t(
                    "1 盲选已锁定 → 2 描述评价",
                    "1 Answers locked → 2 Description",
                  )
                : t(
                    "1 盲选标签 → 2 描述评价",
                    "1 Choose labels → 2 Description",
                  )}
            </span>
          </nav>
          <section className="question-card">
            <h2>
              {locked
                ? t(
                    "意图描述是否得到画面支持？",
                    "Is the intent description visually grounded?",
                  )
                : t(
                    "画面中的对象正在试图做什么？",
                    "What is the target trying to do?",
                  )}
            </h2>
            <p>
              {locked
                ? t(
                    "盲选答案已保存，不能返回修改。",
                    "Your blind selection is saved and cannot be changed.",
                  )
                : t(
                    "可多选。只依据画面，选择所有有依据的目标；标签名称与解释均提供中英文。",
                    "Select all goals supported by the video. Labels and definitions are bilingual.",
                  )}
            </p>
            {locked ? (
              <Options
                name="description"
                items={DESCRIPTION_OPTIONS}
                value={description}
                onChange={setDescription}
              />
            ) : (
              <>
                <input
                  aria-label={t("搜索标签", "Search labels")}
                  placeholder={t(
                    "搜索中英文标签",
                    "Search English or Chinese labels",
                  )}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="options blind-options">
                  {(q.label_choices || [])
                    .filter((l: Any) =>
                      (
                        l.en +
                        " " +
                        l.zh +
                        " " +
                        l.definition_en +
                        " " +
                        l.definition_zh
                      )
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                    )
                    .map((l: Any) => (
                      <label
                        className={
                          "option " +
                          (selected.includes(l.id) && status === "selected"
                            ? "selected"
                            : "")
                        }
                        key={l.id}
                      >
                        <input
                          type="checkbox"
                          checked={
                            status === "selected" && selected.includes(l.id)
                          }
                          onChange={() => {
                            setStatus("selected");
                            setSelected((a) =>
                              a.includes(l.id)
                                ? a.filter((v) => v !== l.id)
                                : [...a, l.id],
                            );
                          }}
                        />
                        <span>
                          <strong>
                            {l.en} · {l.zh}
                          </strong>
                          <Pair zh={l.definition_zh} en={l.definition_en} />
                        </span>
                      </label>
                    ))}
                </div>
                <Options
                  name="blind-status"
                  items={[
                    {
                      value: "insufficient",
                      title: "画面信息不足",
                      en: "Insufficient visual evidence",
                    },
                    {
                      value: "unfamiliar",
                      title: "不熟悉这个局面",
                      en: "Unfamiliar situation",
                    },
                  ]}
                  value={status}
                  onChange={(v) => {
                    setStatus(v);
                    setSelected([]);
                  }}
                />
              </>
            )}
          </section>
          {locked && (
            <textarea
              value={comment}
              maxLength={2000}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t(
                "补充说明（选填）",
                "Additional comments (optional)",
              )}
            />
          )}
          {error && <Notice error>{errorText(error, language)}</Notice>}
          <div className="submit-row">
            <small>
              {t(
                "请先播放视频；进度自动保存。",
                "Play the video first. Progress saves automatically.",
              )}
            </small>
            <Button
              disabled={
                busy ||
                locking ||
                (!locked &&
                  (!loaded ||
                    seconds < 1 ||
                    (status === "selected" && !selected.length))) ||
                (locked && !description)
              }
              onClick={() =>
                locked
                  ? onSubmit({
                      description_support: description,
                      comment,
                      video_loaded: true,
                      playback_seconds: Math.max(seconds, 1),
                      ui_language: language,
                    })
                  : lock()
              }
            >
              {locking ? (
                <Loader2 className="spin" />
              ) : locked ? (
                t("提交并继续", "Submit and continue")
              ) : (
                t("锁定答案并查看原标注", "Lock answers and reveal annotation")
              )}
            </Button>
          </div>
          <button
            className="text-button"
            onClick={async () => {
              try {
                await api("technical", {
                  ...(practice
                    ? { question_id: q.id }
                    : { assignment_id: q.assignment_id }),
                  note: "Playback issue reported",
                });
                setError(
                  t(
                    "播放问题已记录，进度已保留。",
                    "Playback issue recorded. Progress retained.",
                  ),
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {t("报告播放问题", "Report playback issue")}
          </button>
        </div>
      </div>
    </>
  );
}
export function Entry({
  config,
  onStart,
  busy,
  error,
}: {
  config: Any;
  onStart: (v: Any) => void;
  busy: boolean;
  error: string;
}) {
  const { t, language } = useLanguage(),
    [page, setPage] = useState(0),
    [games, setGames] = useState<string[]>([]),
    [familiarity, setFamiliarity] = useState(3),
    [experience, setExperience] = useState<string[]>([]),
    [consent, setConsent] = useState(false);
  const open = ["live", "pilot"].includes(config?.status);
  if (page === 0)
    return (
      <main className="welcome">
        <Steps active={0} />
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">GAME-INTENTION STUDY</span>
            <h1>
              {t(
                "看一段比赛，判断一个意图。",
                "Watch a play. Judge the intent.",
              )}
            </h1>
            <p>
              {t(
                "帮助我们评价：游戏中的战术目标能否从画面中被理解。",
                "Help us evaluate whether tactical goals in games can be understood from video.",
              )}
            </p>
            <div className="hero-facts">
              <div>
                <strong>{t("自选", "Your choice")}</strong>
                <small>{t("熟悉的游戏", "familiar games")}</small>
              </div>
              <div>
                <strong>2</strong>
                <small>{t("项独立判断", "independent judgments")}</small>
              </div>
              <div>
                <strong>
                  <ShieldCheck size={24} />
                </strong>
                <small>{t("进度自动保存", "automatic saving")}</small>
              </div>
            </div>
            <Button
              onClick={() => {
                setPage(1);
                window.scrollTo(0, 0);
              }}
            >
              {t("进入问卷", "Enter the study")}
              <ArrowRight size={17} />
            </Button>
          </div>
          <div className="intro-panel">
            <div className="intro-steps">
              {[
                [
                  t("选择你熟悉的游戏", "Choose familiar games"),
                  t(
                    "不需要账号或实名。",
                    "No account or real name is required.",
                  ),
                ],
                [
                  t("自动进入示例引导", "Follow the guided examples"),
                  t(
                    "先完成两个简短示例，了解判断标准。",
                    "Two brief examples introduce the judgment criteria.",
                  ),
                ],
                [
                  t("逐页完成评价", "Review one page at a time"),
                  t(
                    "每段分别判断标签和描述，可随时暂停。",
                    "Review labels and descriptions separately. You can pause at any time.",
                  ),
                ],
              ].map(([title, detail], i) => (
                <div key={i}>
                  <span>0{i + 1}</span>
                  <p>
                    <strong>{title}</strong>
                    <small>{detail}</small>
                  </p>
                </div>
              ))}
            </div>
            <div className="panel-foot">
              {t(
                "可随时关闭页面，同一浏览器重新打开即可继续。请勿清除浏览器站点数据。",
                "You can close the page and return in the same browser. Keep this site’s browser data to retain your session.",
              )}
            </div>
          </div>
        </section>
      </main>
    );
  return (
    <main className="welcome">
      <Steps active={1} />
      <section className="enrollment paged-enrollment">
        <div className="section-heading">
          <h1>
            {t(
              "选择你熟悉的游戏（可多选）",
              "Choose the games you know (select all that apply)",
            )}
          </h1>
          <button className="text-button" onClick={() => setPage(0)}>
            <ArrowLeft size={15} />
            {t("上一页", "Back")}
          </button>
        </div>
        <div className="game-grid">
          {(config?.games || GAMES).map((g: Any) => (
            <button
              key={g.id}
              aria-pressed={games.includes(g.id)}
              className={"game-card " + (games.includes(g.id) ? "chosen" : "")}
              onClick={() =>
                setGames((values) =>
                  values.includes(g.id)
                    ? values.filter((v) => v !== g.id)
                    : [...values, g.id],
                )
              }
            >
              <span
                className="game-monogram"
                style={{ "--game-color": g.color } as React.CSSProperties}
              >
                {g.id.toUpperCase().slice(0, 3)}
              </span>
              <div>
                <strong>{language === "zh" ? g.zh : g.en}</strong>
                <small>{language === "zh" ? g.en : g.zh}</small>
              </div>
              <span className="game-genre">{g.genre}</span>
              {games.includes(g.id) && <CheckCircle2 size={17} />}
            </button>
          ))}
        </div>
        {games.length > 0 && (
          <div className="profile-grid">
            <label>
              <span className="field-label">
                {t(
                  "你对所选游戏有多熟悉？",
                  "How familiar are you with the selected games?",
                )}
              </span>
              <select
                value={familiarity}
                onChange={(e) => setFamiliarity(+e.target.value)}
              >
                <option value={3}>
                  {t(
                    "能理解常见局面和战术目标",
                    "I understand common situations and tactical goals",
                  )}
                </option>
                <option value={4}>
                  {t(
                    "经常游玩或观赛，熟悉常见战术",
                    "I regularly play or watch and know common tactics",
                  )}
                </option>
                <option value={5}>
                  {t(
                    "有长期竞技、战队、教练或解说经验",
                    "I have extensive competitive, team, coaching, or casting experience",
                  )}
                </option>
              </select>
            </label>
            <div>
              <span className="field-label">
                {t(
                  "经验主要来自哪里？",
                  "Where does your experience come from?",
                )}
              </span>
              <div className="check-chips">
                {[
                  ["play", t("自己游玩", "Playing")],
                  ["watch", t("观赛或教学", "Watching or tutorials")],
                  [
                    "professional",
                    t("战队、教练或解说", "Team, coaching, or casting"),
                  ],
                ].map(([v, label]) => (
                  <label
                    key={v}
                    className={experience.includes(v) ? "checked" : ""}
                  >
                    <input
                      type="checkbox"
                      checked={experience.includes(v)}
                      onChange={() =>
                        setExperience((a) =>
                          a.includes(v) ? a.filter((x) => x !== v) : [...a, v],
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="consent-box">
          <p>
            {language === "zh"
              ? config?.config?.privacy ||
                "不收集真实姓名、游戏账号或联系方式。我们记录回答与观看状态，研究数据去标识保存和发布。"
              : config?.config?.privacyEn ||
                "We do not collect real names, gaming accounts, or contact details. Responses and playback information are stored and released in de-identified form."}
          </p>
          <p>
            {t(
              "参与自愿，可停止或撤回。",
              "Participation is voluntary. You may stop or withdraw.",
            )}
            {config?.config?.contact &&
              " " +
                t("研究联系：", "Research contact: ") +
                config.config.contact}
          </p>
          <label>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            {t(
              "我已阅读说明，愿意参加，并能理解所选游戏的常见局面。",
              "I have read the information, consent to participate, and understand common situations in the selected game.",
            )}
          </label>
        </div>
        {!open && (
          <Notice>
            {t(
              "问卷正在准备中，暂未开放正式参与。",
              "The study is being prepared and is not open for participation yet.",
            )}
          </Notice>
        )}
        {error && <Notice error>{errorText(error, language)}</Notice>}
        <div className="join-bottom">
          <p>
            {t(
              "下一页将自动展示所选游戏的入门示例。",
              "The next page automatically shows examples for your selected game.",
            )}
          </p>
          <Button
            disabled={
              !open || !games.length || !consent || !experience.length || busy
            }
            onClick={() =>
              onStart({
                games,
                familiarity,
                experience,
                consent,
                ui_language: language,
              })
            }
          >
            {busy ? <Loader2 size={17} className="spin" /> : null}
            {t("继续", "Continue")}
            <ArrowRight size={16} />
          </Button>
        </div>
      </section>
    </main>
  );
}
function Training({
  state,
  refresh,
  setError,
}: {
  state: Any;
  refresh: () => Promise<void>;
  setError: (v: string) => void;
}) {
  const { t, language } = useLanguage(),
    [feedback, setFeedback] = useState<Any>(null),
    [choice, setChoice] = useState(""),
    [busy, setBusy] = useState(false),
    next = state.practice.find((p: Any) => !p.response);
  if (feedback)
    return (
      <div className="center-card">
        <BookOpen />
        <h1>{t("示例反馈", "Example feedback")}</h1>
        <p>
          {t(
            "只判断画面是否提供证据。多个目标可共存，没有依据时不用猜测。",
            "Judge only the visible evidence. Multiple goals may coexist; do not guess when evidence is missing.",
          )}
        </p>
        <div className="feedback">
          {!feedback.label_support && (
            <p>
              {t(
                "测试示例尚未制定人工参考答案；你的选择已保存。",
                "This pilot example has no manually verified reference answer yet. Your judgments are saved.",
              )}
            </p>
          )}
          <p>
            {t("标签：", "Labels: ")}
            {
              (
                LABEL_OPTIONS.find(
                  (o) => o.value === feedback.label_support,
                ) as Any
              )?.[language === "zh" ? "title" : "en"]
            }
          </p>
          <p>
            {t("描述：", "Description: ")}
            {
              (
                DESCRIPTION_OPTIONS.find(
                  (o) => o.value === feedback.description_support,
                ) as Any
              )?.[language === "zh" ? "title" : "en"]
            }
          </p>
        </div>
        <Button onClick={() => setFeedback(null)}>
          {t("继续", "Continue")}
          <ArrowRight size={16} />
        </Button>
      </div>
    );
  if (next)
    return (
      <div className="review-wrap">
        <Steps active={2} />
        <div className="session-strip">
          <span>
            {t("示例", "Example")}{" "}
            {state.practice.filter((p: Any) => p.response).length + 1} / 2
          </span>
          <span>
            {t("不计入正式结果", "Not included in the study results")}
          </span>
        </div>
        <Evaluation
          key={next.question.id}
          question={next.question}
          practice
          draftKey={
            "gi-practice-" + state.participant.id + "-" + next.question.id
          }
          draft={(() => {
            try {
              return JSON.parse(
                localStorage.getItem(
                  "gi-practice-" +
                    state.participant.id +
                    "-" +
                    next.question.id,
                ) || "null",
              );
            } catch {
              return null;
            }
          })()}
          onDraft={(a) => {
            try {
              localStorage.setItem(
                "gi-practice-" + state.participant.id + "-" + next.question.id,
                JSON.stringify(a),
              );
            } catch {}
          }}
          busy={busy}
          onSubmit={async (a) => {
            setBusy(true);
            try {
              const result = await api("practice", {
                ...a,
                question_id: next.question.id,
              });
              try {
                localStorage.removeItem(
                  "gi-practice-" +
                    state.participant.id +
                    "-" +
                    next.question.id,
                );
              } catch {}
              setFeedback(result.expected || {});
              await refresh();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </div>
    );
  return (
    <div className="center-card">
      <Steps active={2} />
      <h1>{t("开始前，确认一下", "One quick check")}</h1>
      <p>
        {t(
          "如果标注听起来合理，但画面没有判断依据，应该怎么办？",
          "If an annotation sounds plausible but the video lacks evidence, what should you do?",
        )}
      </p>
      <Options
        name="qualification"
        value={choice}
        onChange={setChoice}
        items={[
          {
            value: "agree",
            title: "常识合理就认为支持",
            en: "Mark it supported if it seems plausible",
          },
          {
            value: "insufficient",
            title: "选择“画面信息不足”",
            en: "Choose “Insufficient visual evidence”",
          },
          {
            value: "guess",
            title: "按最常见的情况猜测",
            en: "Guess the most common situation",
          },
        ]}
      />
      <Button
        disabled={!choice || busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await api("qualify", { choice });
            if (!r.qualified)
              setError(
                r.remaining
                  ? "请重读说明：不能用常识补充画面里没有的证据。"
                  : "本次说明检查未通过，感谢你的参与。",
              );
            await refresh();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {t("开始正式评价", "Start reviewing")}
        <ArrowRight size={16} />
      </Button>
    </div>
  );
}
export function ParticipantStudy() {
  const { t, language } = useLanguage(),
    [config, setConfig] = useState<Any>(null),
    [state, setState] = useState<Any>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(""),
    [paused, setPaused] = useState(false),
    queues = useRef<Record<string, Promise<void>>>({}),
    currentId = useRef("");
  const refresh = useCallback(async () => {
    let s = await api("me");
    if (s.participant.profile.protocol !== "blind-v1") {
      await api("blind/start", {});
      s = await api("me");
    }
    setState(s);
    currentId.current = s.assignment?.id || "";
  }, []);
  useEffect(() => {
    let live = true;
    Promise.allSettled([
      api("config").then((v) => {
        if (live) setConfig(v);
      }),
      refresh(),
    ]).then((results) => {
      if (live) {
        if (results[0].status === "rejected")
          setError(String(results[0].reason?.message || ""));
        setLoading(false);
      }
    });
    return () => {
      live = false;
    };
  }, [refresh]);
  async function start(data: Any) {
    setBusy(true);
    setError("");
    try {
      await api("enroll", { ...data, protocol: "blind-v1" });
      await refresh();
      window.scrollTo(0, 0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function saveDraft(id: string, answer: Any) {
    const body = JSON.stringify({ ...answer, assignment_id: id });
    try {
      localStorage.setItem("gi-draft-" + id, body);
    } catch {}
    setSaved("saving");
    queues.current[id] = (queues.current[id] || Promise.resolve())
      .catch(() => {})
      .then(async () => {
        try {
          await api("draft", JSON.parse(body));
          try {
            if (localStorage.getItem("gi-draft-" + id) === body)
              localStorage.removeItem("gi-draft-" + id);
          } catch {}
          if (currentId.current === id) setSaved("saved");
        } catch {
          if (currentId.current === id) setSaved("local");
        }
      });
  }
  async function submit(answer: Any) {
    setBusy(true);
    setError("");
    const id = state.assignment.id;
    try {
      await api("submit", { ...answer, assignment_id: id });
      try {
        localStorage.removeItem("gi-draft-" + id);
      } catch {}
      setSaved("");
      await refresh();
      window.scrollTo(0, 0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function finish() {
    setBusy(true);
    setError("");
    try {
      await api("finish", {});
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function more() {
    setBusy(true);
    setError("");
    try {
      const result = await api("more", {});
      if (!result.added)
        setError(
          t(
            "所选游戏暂时没有更多待评价样本。",
            "There are no more available clips in your selected games.",
          ),
        );
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function withdraw() {
    if (
      !confirm(
        t(
          "确认撤回参与及已提交的回答？",
          "Withdraw your participation and submitted responses?",
        ),
      )
    )
      return;
    setBusy(true);
    try {
      await api("withdraw", {});
      setState(null);
      setPaused(false);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  let content: ReactNode;
  if (loading)
    content = (
      <div className="center-card">
        <Loader2 className="spin" />
        <p>{t("正在读取进度…", "Loading your progress…")}</p>
      </div>
    );
  else if (!state)
    content = (
      <Entry config={config} onStart={start} busy={busy} error={error} />
    );
  else if (state.participant.status === "completed")
    content = (
      <div className="center-card">
        <div className="success-mark">
          <CheckCircle2 />
        </div>
        <h1>
          {t("感谢你的认真判断。", "Thank you for your thoughtful judgments.")}
        </h1>
        <p>
          {t(
            "全部回答已自动保存。",
            "All responses have been saved automatically.",
          )}
        </p>
        <div className="receipt">
          <span>
            {state.progress.main_done}{" "}
            {t("道正式视频题已完成", "main video questions completed")}
          </span>
          <small>{t("参与记录", "Participation record")}</small>
          <code>{state.participant.id}</code>
        </div>
        <button className="text-button danger" onClick={withdraw}>
          {t("撤回参与及回答", "Withdraw participation and responses")}
        </button>
      </div>
    );
  else if (
    ["ineligible", "excluded", "withdrawn"].includes(state.participant.status)
  )
    content = (
      <div className="center-card">
        <h1>{t("本次参与已结束", "Your participation has ended")}</h1>
        <p>
          {t(
            "感谢你的时间。研究联系：",
            "Thank you for your time. Research contact: ",
          )}
          {state.study.config.contact}
        </p>
      </div>
    );
  else if (paused)
    content = (
      <div className="center-card">
        <Pause />
        <h1>{t("可以休息一下。", "Take a break.")}</h1>
        <p>
          {t(
            "回答与草稿会自动保存。可以关闭页面，稍后在同一浏览器打开继续。",
            "Your responses and drafts save automatically. Close this page and return in the same browser to continue.",
          )}
        </p>
        {state.progress.can_finish && (
          <Button secondary disabled={busy} onClick={finish}>
            {t("结束并提交", "Finish study")}
          </Button>
        )}
        <Button onClick={() => setPaused(false)}>
          <Play size={16} />
          {t("继续评价", "Continue reviewing")}
        </Button>
        <button
          className="text-button danger"
          disabled={busy}
          onClick={withdraw}
        >
          {t("撤回参与及回答", "Withdraw participation and responses")}
        </button>
      </div>
    );
  else if (!state.participant.qualified_at)
    content = <Training state={state} refresh={refresh} setError={setError} />;
  else if (state.assignment) {
    const id = state.assignment.id;
    let draft = state.assignment.draft;
    try {
      draft =
        JSON.parse(localStorage.getItem("gi-draft-" + id) || "null") || draft;
    } catch {}
    content = (
      <div className="review-wrap">
        <Steps active={3} />
        <div className="session-strip">
          <span>
            {t("已完成", "Reviewed")} {state.progress.done}{" "}
            {t("段视频", "clips")}
          </span>
          <span className="save-status" role="status">
            {saved === "saving"
              ? t("正在自动保存…", "Saving automatically…")
              : saved === "local"
                ? t(
                    "草稿保留在本机，稍后同步",
                    "Draft retained on this device; waiting to sync",
                  )
                : t("进度自动保存", "Progress saved automatically")}
          </span>
          {state.progress.can_finish && (
            <Button secondary disabled={busy} onClick={finish}>
              {t("结束并提交", "Finish study")}
            </Button>
          )}
          <button onClick={() => setPaused(true)}>
            <Pause size={14} />
            {t("暂停", "Pause")}
          </button>
        </div>
        <div className="progress-track">
          <i
            style={{
              width: (100 * state.progress.done) / state.progress.total + "%",
            }}
          />
        </div>
        <Evaluation
          key={id}
          question={{ ...state.assignment.question, assignment_id: id }}
          draft={draft}
          draftKey={"gi-draft-" + id}
          onDraft={(a) => saveDraft(id, a)}
          onSubmit={submit}
          busy={busy}
        />
      </div>
    );
  } else if (state.progress.batch_done && state.participant.profile.flexible)
    content = (
      <div className="center-card">
        <h1>{t("回答已保存", "Your responses are saved")}</h1>
        <Button disabled={busy} onClick={more}>
          {t("继续评价", "Review more clips")}
        </Button>
        {state.progress.can_finish && (
          <Button secondary disabled={busy} onClick={finish}>
            {t("结束并提交", "Finish study")}
          </Button>
        )}
      </div>
    );
  else
    content = (
      <div className="center-card">
        <p>{t("正在同步题目…", "Syncing the next question…")}</p>
        <Button onClick={() => refresh().catch((e) => setError(e.message))}>
          {t("重新同步", "Retry")}
        </Button>
      </div>
    );
  return (
    <>
      {(config?.status === "pilot" || state?.study?.status === "pilot") && (
        <div className="global-error">
          <Notice>
            {t(
              "测试问卷 · 本轮为研究人员试填，回答不进入正式研究结果。",
              "Pilot study · Researcher testing only. These responses are excluded from the research results.",
            )}
          </Notice>
        </div>
      )}
      {state && error && (
        <div className="global-error">
          <Notice error>{errorText(error, language)}</Notice>
        </div>
      )}
      {content}
    </>
  );
}
