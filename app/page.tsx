"use client";
import { studyApi as api } from "../lib/study/client";
import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Play,
  Pause,
  RotateCcw,
  ShieldCheck,
  Globe2,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  X,
  Settings2,
  LayoutDashboard,
  Database,
  Users,
  BarChart3,
  Upload,
  AlertCircle,
  CheckCircle2,
  LogOut,
  Loader2,
  Video,
  Eye,
  LockKeyhole,
  Save,
  ExternalLink,
} from "lucide-react";
import {
  GAMES,
  LABEL_OPTIONS,
  DESCRIPTION_OPTIONS,
} from "@/lib/study/constants";
import { LanguageProvider, ParticipantStudy, useLanguage } from "./study";
type Any = any;

const pct = (n: Any) =>
  n === null || n === undefined ? "—" : (n * 100).toFixed(1) + "%";
function Mark() {
  return (
    <span className="mark" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
function Button({
  children,
  onClick,
  disabled = false,
  secondary = false,
  className = "",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  secondary?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={"button " + (secondary ? "secondary " : "") + className}
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
      role={error ? "alert" : "status"}
      className={"notice " + (error ? "error" : "")}
    >
      <AlertCircle size={16} />
      <span>{children}</span>
    </div>
  );
}
function Header({
  admin = false,
  onHome,
  onAdmin,
}: {
  admin?: boolean;
  onHome: () => void;
  onAdmin: () => void;
}) {
  const { language, setLanguage, t } = useLanguage();
  return (
    <header className="site-header">
      <button className="brand" onClick={onHome}>
        <Mark />
        <span>
          Game-Intention<small>ANNOTATION STUDY</small>
        </span>
      </button>
      <div className="header-right">
        {!admin && (
          <div
            className="language"
            role="group"
            aria-label={t("界面语言", "Interface language")}
          >
            <Globe2 size={14} />
            <button
              type="button"
              lang="zh-CN"
              aria-pressed={language === "zh"}
              onClick={() => setLanguage("zh")}
            >
              中文
            </button>
            <button
              type="button"
              lang="en"
              aria-pressed={language === "en"}
              onClick={() => setLanguage("en")}
            >
              English
            </button>
          </div>
        )}
        <span className="header-rule" />
        <button className="text-button" onClick={admin ? onHome : onAdmin}>
          {admin
            ? t("返回研究", "Back to study")
            : t("研究者入口", "Researcher access")}
          <ArrowRight size={14} />
        </button>
      </div>
    </header>
  );
}
function Researcher({ onHome }: { onHome: () => void }) {
  const [key, setKey] = useState(""),
    [data, setData] = useState<Any>(null),
    [tab, setTab] = useState("overview"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [questions, setQuestions] = useState<Any[]>([]),
    [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [settings, setSettings] = useState<Any>(null),
    [result, setResult] = useState<Any>(null),
    [message, setMessage] = useState(""),
    [edit, setEdit] = useState<Any>(null);
  const load = useCallback(async () => {
    const d = await api("admin/overview");
    setData(d);
    setSettings(d.study.config);
    if (d.last_analysis) setResult(d.last_analysis.result);
  }, []);
  useEffect(() => {
    load().catch((e) => { if (!/请登录/.test(e.message)) setError(e.message); });
  }, [load]);
  async function action(f: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await f();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function showPool() {
    setTab("pool");
    try {
      const d = await api("admin/pool");
      setQuestions(d.questions);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!data)
    return (
      <div className="center-card">
        <div className="success-mark">
          <LockKeyhole />
        </div>
        <span className="eyebrow">RESEARCH WORKSPACE</span>
        <h1>研究者登录</h1>
        <p>查看题库、收集进度及统计结果。此入口与参与者分离。</p>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="研究者访问密钥"
          autoComplete="current-password"
        />
        {error && <Notice error>{error}</Notice>}
        <Button
          disabled={!key || busy}
          onClick={() =>
            action(async () => {
              await api("admin/login", { key });
              setKey("");
            })
          }
        >
          进入工作台 <ArrowRight size={16} />
        </Button>
      </div>
    );
  const tabs = [
    ["overview", "概览", LayoutDashboard],
    ["pool", "题目池", Database],
    ["participants", "参与者", Users],
    ["analysis", "结果分析", BarChart3],
    ["settings", "研究设置", Settings2],
  ] as const;
  return (
    <div className="admin-shell">
      <aside className="admin-nav">
        <span className="eyebrow">WORKSPACE</span>
        {tabs.map(([id, l, Icon]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => (id === "pool" ? showPool() : setTab(id))}
          >
            <Icon size={17} />
            {l}
          </button>
        ))}
        <div className="sidebar-note">
          <span className={"status-pill " + data.study.status}>
            {data.study.status.toUpperCase()}
          </span>
          <p>
            Protocol 2.0
            <br />
            公开入口 · 去标识评价
          </p>
        </div>
      </aside>
      <main className="admin-content">
        <div className="section-heading">
          <div>
            <span className="eyebrow">GAME-INTENTION / RESEARCH</span>
            <h1>{tabs.find((t) => t[0] === tab)?.[1]}</h1>
          </div>
          <button className="text-button" onClick={() => action(load)}>
            <RotateCcw size={14} />
            刷新
          </button>
        </div>
        {error && <Notice error>{error}</Notice>}
        {message && <Notice>{message}</Notice>}
        {busy && (
          <div className="working">
            <Loader2 className="spin" size={16} />
            处理中，请不要关闭页面…
          </div>
        )}
        {tab === "overview" && (
          <>
            <div className="stat-grid">
              <div>
                <small>题目池</small>
                <strong>{data.pool_count}</strong>
                <span>包括练习与检查</span>
              </div>
              <div>
                <small>已回收评价</small>
                <strong>{data.response_count}</strong>
                <span>原始回答保存在数据库</span>
              </div>
              <div>
                <small>参与者</small>
                <strong>{data.participants.length}</strong>
                <span>
                  {
                    data.participants.filter(
                      (p: Any) => p.status === "completed",
                    ).length
                  }{" "}
                  人已完成
                </span>
              </div>
              <div>
                <small>正式题目标</small>
                <strong>{settings.clipsPerGame * 11}</strong>
                <span>每视频 {settings.ratersPerClip} 位评审</span>
              </div>
            </div>
            <section className="admin-card">
              <div className="card-heading">
                <h2>开放前检查</h2>
                <span
                  className={"tag " + (data.readiness.ready ? "green" : "")}
                >
                  {data.readiness.ready
                    ? "准备就绪"
                    : data.readiness.errors.length + " 项待完成"}
                </span>
              </div>
              <p>
                冻结题库后无法覆盖标注。双语文本、视频来源及检查题需要完整保留。
              </p>
              <div className="readiness-list">
                {data.readiness.errors
                  .slice(0, 12)
                  .map((e: string, i: number) => (
                    <div key={i}>
                      <span className="pending-dot" />
                      {e}
                    </div>
                  ))}
              </div>
              <button className="text-button" onClick={showPool}>
                查看题目池 <ArrowRight size={15} />
              </button>
            </section>
            <section className="admin-card">
              <h2>分配与研究状态</h2>
              <p>
                分配会冻结题库与配置。正式开放后，自报熟悉该游戏的参与者在完成练习后认领一个空闲组。
              </p>
              <div className="actions">
                <Button
                  disabled={busy || !data.readiness.ready}
                  onClick={() =>
                    action(async () => {
                      for (const g of GAMES) {
                        setMessage("正在分配 " + g.en);
                        await api("admin/allocate", { game: g.id });
                      }
                      setMessage("各游戏分配已生成，题库已冻结。");
                    })
                  }
                >
                  生成平衡分配
                </Button>
                <Button secondary disabled={busy || !data.pilot_readiness?.ready} onClick={() => action(async () => { await api("admin/status", {status:"pilot"}); setMessage("线上测试已开放，试填回答不进入正式分析。"); })}>开放线上测试</Button>
                <Button
                  secondary
                  disabled={busy || !data.readiness.ready}
                  onClick={() =>
                    action(async () => {
                      if (
                        confirm(
                          "确认正式开放？之后提交的正式题会进入研究分析。",
                        )
                      )
                        await api("admin/status", { status: "live" });
                    })
                  }
                >
                  开放正式收集
                </Button>
                <Button
                  secondary
                  disabled={busy}
                  onClick={() =>
                    action(async () => {
                      await api("admin/status", { status: "closed" });
                    })
                  }
                >
                  暂停收集
                </Button>
              </div>
              <div className="allocation-chips">
                {data.panels.map((p: Any) => (
                  <span className="tag" key={p.game}>
                    {p.game} · {p.n} 组
                  </span>
                ))}
              </div>
            </section>
            <section className="admin-card">
              <h2>最近操作</h2>
              <div className="audit-list">
                {data.events.slice(0, 10).map((e: Any) => (
                  <div key={e.id}>
                    <span>{e.action}</span>
                    <small>{new Date(e.created_at).toLocaleString()}</small>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
        {tab === "pool" && (
          <>
            <div className="admin-card">
              <div className="card-heading">
                <h2>可追溯的双语题库</h2>
                <label
                  className={
                    "button secondary " +
                    (data.study.frozen_at ? "disabled" : "")
                  }
                >
                  <Upload size={15} />
                  导入 JSON / JSONL
                  <input
                    type="file"
                    accept=".json,.jsonl"
                    disabled={!!data.study.frozen_at || busy}
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f)
                        action(async () => {
                          const t = await f.text();
                          let q;
                          try {
                            q = JSON.parse(t);
                          } catch {
                            q = t
                              .split("\n")
                              .filter(Boolean)
                              .map((l) => JSON.parse(l));
                          }
                          const r = await api("admin/pool", q);
                          setMessage("已导入 " + r.imported + " 段");
                          await showPool();
                        });
                    }}
                  />
                </label>
              </div>
              <p>
                英文原文、中文对照、标签解释及媒体状态缺一不可。生成分配后题目与目标将冻结。
              </p>
              <div className="actions">
                <label className="button secondary">
                  <Upload size={15} />
                  导入 COS 校验清单
                  <input
                    type="file"
                    accept=".json"
                    hidden
                    disabled={busy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f)
                        action(async () => {
                          const receipt = JSON.parse(await f.text());
                          if (
                            !Array.isArray(receipt.assets) ||
                            !receipt.assets.length
                          )
                            throw new Error("没有可校验的视频");
                          let n = 0;
                          for (let i = 0; i < receipt.assets.length; i += 10) {
                            const r = await api("admin/cos-media", {
                              assets: receipt.assets.slice(i, i + 10),
                            });
                            n += r.imported;
                            setMessage(
                              "已核对 COS 视频 " +
                                n +
                                "/" +
                                receipt.assets.length,
                            );
                          }
                          await showPool();
                          setMessage("COS 视频已完成入库核对：" + n + " 段");
                        });
                    }}
                  />
                </label>
                <small>
                  文件名为“题目ID.mp4”；相同内容可重复上传，服务端会跳过。
                </small>
              </div>
              <div className="table-toolbar">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索题目 ID、描述或标签"
                />
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">所有游戏</option>
                  {GAMES.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.en}
                    </option>
                  ))}
                </select>
                <a className="text-button" href="/api/admin/export" download>
                  <Download size={15} />
                  导出完整快照
                </a>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>题目 / 来源</th>
                      <th>标签</th>
                      <th>类型</th>
                      <th>双语 / 媒体</th>
                    </tr>
                  </thead>
                  <tbody>
                    {questions
                      .filter(
                        (q) =>
                          (filter === "all" || q.game === filter) &&
                          JSON.stringify(q)
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                      )
                      .slice(0, 120)
                      .map((q) => (
                        <tr key={q.id}>
                          <td>
                            <strong>
                              {q.game} · {q.id.slice(-24)}
                            </strong>
                            <small>{q.description_en.slice(0, 95)}</small>
                            <button
                              className="text-button"
                              disabled={!!data.study.frozen_at}
                              onClick={() =>
                                setEdit(JSON.parse(JSON.stringify(q)))
                              }
                            >
                              预览与复核
                            </button>
                            <details>
                              <summary>查看双语内容</summary>
                              <div className="pool-detail">
                                <p>{q.description_en}</p>
                                <p>{q.description_zh}</p>
                                {q.labels.map((l: Any) => (
                                  <p key={l.id}>
                                    <code>{l.en}</code> · {l.zh}
                                    <br />
                                    {l.definition_en}
                                    <br />
                                    {l.definition_zh}
                                  </p>
                                ))}
                                <small>
                                  Source: {q.source_cluster_id}
                                  <br />
                                  Revision: {q.dataset_revision}
                                </small>
                              </div>
                            </details>
                          </td>
                          <td>{q.labels.map((l: Any) => l.id).join(", ")}</td>
                          <td>
                            <span className="tag">{q.kind}</span>
                          </td>
                          <td>
                            <small>
                              {q.translation_status === "pending"
                                ? "待翻译"
                                : "英中对照"}
                              <br />
                              {q.media_verified ? "媒体已校验" : "媒体待校验"}
                              <br />
                              {q.reviewed ? "已复核" : "未人工复核"}
                            </small>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <small>最多显示匹配的前120条，完整数据请导出快照。</small>
            </div>
          </>
        )}
        {tab === "participants" && (
          <div className="admin-card">
            <div className="card-heading">
              <h2>去标识的参与记录</h2>
              <a
                className="button secondary"
                href="/api/admin/export?format=csv"
                download
              >
                <Download size={15} />
                回答 CSV
              </a>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>参与者</th>
                    <th>游戏 / 经验</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {data.participants.map((p: Any) => (
                    <tr key={p.id}>
                      <td>
                        <code>{p.id.slice(0, 8)}</code>
                        <small>
                          {new Date(p.created_at).toLocaleDateString()}
                        </small>
                      </td>
                      <td>
                        {p.game}
                        <small>
                          熟悉度 {p.profile.familiarity || "—"} ·{" "}
                          {p.profile.experience?.join(" / ")}
                        </small>
                      </td>
                      <td>
                        <span className="tag">{p.status}</span>
                        {p.exclusion_reason && (
                          <small>{p.exclusion_reason}</small>
                        )}
                      </td>
                      <td>
                        {["excluded", "withdrawn"].includes(p.status) ? (
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() =>
                              action(async () => {
                                await api("admin/refill", {
                                  participant_id: p.id,
                                });
                                setMessage("已创建新的空闲补位组");
                              })
                            }
                          >
                            创建补位
                          </button>
                        ) : (
                          <button
                            className="text-button danger"
                            disabled={busy}
                            onClick={() => {
                              const reason = prompt(
                                "请输入预注册规则对应的排除理由。不能因与 GT 不同而排除。",
                              );
                              if (reason)
                                action(async () => {
                                  await api("admin/exclude", {
                                    participant_id: p.id,
                                    reason,
                                  });
                                });
                            }}
                          >
                            按规则排除
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {tab === "analysis" && (
          <>
            <div className="admin-card">
              <div className="card-heading">
                <div>
                  <h2>数据质量分析</h2>
                  <p>
                    逐票计算，再按视频与游戏聚合；不足五份有效评价的片段不进入主结果。
                  </p>
                </div>
                <Button
                  disabled={busy}
                  onClick={() =>
                    action(async () => {
                      const r = await api("admin/analyze", {});
                      setResult(r.result);
                      setMessage("分析快照已保存");
                    })
                  }
                >
                  <BarChart3 size={15} />
                  计算并保存
                </Button>
              </div>
              <div className="actions">
                <a href="/api/admin/export" download className="text-button">
                  <Download size={15} />
                  完整 JSON 快照
                </a>
                <a
                  href="/api/admin/export?format=csv"
                  download
                  className="text-button"
                >
                  <Download size={15} />
                  原始回答 CSV
                </a>
              </div>
            </div>
            {result ? (
              <>
                <div className="stat-grid">
                  <div>
                    <small>完整评价视频</small>
                    <strong>{result.coverage.complete_clips}</strong>
                    <span>/ {result.coverage.expected_clips} 段</span>
                  </div>
                  <div>
                    <small>有效正式评价</small>
                    <strong>{result.coverage.eligible_ratings}</strong>
                    <span>{result.coverage.unique_participants} 位参与者</span>
                  </div>
                  <div>
                    <small>游戏覆盖</small>
                    <strong>
                      {result.coverage.covered_games}
                      <em>/11</em>
                    </strong>
                    <span>
                      {result.status === "complete"
                        ? "配额完整"
                        : "当前为阶段性统计"}
                    </span>
                  </div>
                  <div>
                    <small>重采样</small>
                    <strong>
                      {result.bootstrap.replicates.toLocaleString()}
                    </strong>
                    <span>来源 × 评审者</span>
                  </div>
                </div>
                <div className="admin-card">
                  <div className="card-heading">
                    <h2>核心结果</h2>
                    <span className="tag">
                      {result.status === "complete" ? "完整配额" : "阶段性结果"}
                    </span>
                  </div>
                  <div className="table-scroll">
                    <table className="metrics-table">
                      <thead>
                        <tr>
                          <th>Game</th>
                          <th>N</th>
                          <th>Label ↑</th>
                          <th>Description ↑</th>
                          <th>Joint ↑</th>
                          <th>Insufficient ↓</th>
                        </tr>
                      </thead>
                      <tbody>
                        {GAMES.map((g) => {
                          const r = result.games[g.id];
                          return (
                            <tr key={g.id}>
                              <td>{g.en}</td>
                              <td>{r?.clips || 0}</td>
                              {[
                                "label_support",
                                "description_grounding",
                                "joint_validity",
                                "insufficient_evidence",
                              ].map((k) => (
                                <td key={k}>
                                  <strong>{pct(r?.metrics[k].value)}</strong>
                                  {r?.metrics[k].ci95 && (
                                    <small>
                                      {pct(r.metrics[k].ci95[0])}–
                                      {pct(r.metrics[k].ci95[1])}
                                    </small>
                                  )}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                        {[
                          ["Game-macro", result.game_macro],
                          ["Dataset-weighted", result.dataset_weighted],
                        ].map(([name, r]: Any) => (
                          <tr className="summary-row" key={name}>
                            <td colSpan={2}>{name}</td>
                            {[
                              "label_support",
                              "description_grounding",
                              "joint_validity",
                              "insufficient_evidence",
                            ].map((k) => (
                              <td key={k}>
                                <strong>{pct(r?.[k].value)}</strong>
                                {r?.[k].ci95 && (
                                  <small>
                                    {pct(r[k].ci95[0])}–{pct(r[k].ci95[1])}
                                  </small>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="analysis-note">
                    区间为95%置信区间。信息不足与不熟悉的有效票保留在分母；所有11款游戏尚未覆盖时不输出完整总体值。支持率不等于人类盲测准确率。
                  </p>
                </div>
                <div className="admin-card">
                  {result.four_choice && <>
                    <h2>四选一意图组合</h2>
                    <p>独立评价 {result.four_choice.ratings} 份，完整五人评价 {result.four_choice.complete_clips} 段。以下统计与原标注组合的一致率；不与全标签盲选 F1 混合。选择四项时的随机一致率为 25%。画面不足／不熟悉计入总体分母。</p>
                    <div className="table-scroll"><table><thead><tr><th>游戏</th><th>完整视频</th><th>与原标注一致</th><th>作答后的一致率</th><th>多数人一致</th><th>无法判断</th><th>描述支持</th></tr></thead><tbody>
                      {Object.entries(result.four_choice.games).map(([game,r]:Any)=><tr key={game}><td>{game}</td><td>{r.complete_clips}</td><td>{pct(r.reference_agreement)}</td><td>{pct(r.agreement_given_selection)}</td><td>{pct(r.majority_reference_agreement)}</td><td>{pct(r.abstention_rate)}</td><td>{pct(r.description_grounding)}</td></tr>)}
                    </tbody></table></div>
                  </>}
                  <h2>全标签盲选与自动标注</h2>{result.blind&&<><p>独立盲选评价 {result.blind.ratings} 份；已有曝光记录 {result.blind.excluded_preexposed_ratings} 份不进入 F1。以下以五人中至少三人选择的标签作参考，评价自动标注；无共识视频单独统计。</p><div className="table-scroll"><table><thead><tr><th>游戏</th><th>可评分视频</th><th>无共识</th><th>Precision</th><th>Recall</th><th>Micro-F1</th><th>Macro-F1</th><th>集合全对</th></tr></thead><tbody>{Object.entries(result.blind.games).map(([game,r]:Any)=><tr key={game}><td>{game}</td><td>{r.scored_clips}</td><td>{r.no_consensus_clips}</td><td>{pct(r.precision)}</td><td>{pct(r.recall)}</td><td>{pct(r.micro_f1)}</td><td>{pct(r.macro_f1)}</td><td>{pct(r.exact_match)}</td></tr>)}</tbody></table></div><p>画面不足／不熟悉比例：{pct(result.blind.abstention_rate)}；描述依据充分比例：{pct(result.blind.description_grounding)}</p></>}<h2>旧题型一致性与诊断</h2>
                  <div className="diagnostic-grid">
                    <div>
                      <small>标签 α · 游戏中位数</small>
                      <strong>
                        {result.agreement_summary.label.median?.toFixed(3) ??
                          "—"}
                      </strong>
                    </div>
                    <div>
                      <small>描述 α · 游戏中位数</small>
                      <strong>
                        {result.agreement_summary.description.median?.toFixed(
                          3,
                        ) ?? "—"}
                      </strong>
                    </div>
                    <div>
                      <small>重复回答一致率</small>
                      <strong>
                        {pct(result.diagnostics.repeats.exact_agreement)}
                      </strong>
                    </div>
                    <div>
                      <small>检查题通过率</small>
                      <strong>{pct(result.diagnostics.controls.rate)}</strong>
                    </div>
                  </div>
                  <small>
                    α 无定义时留空。检查题、练习题和重复题不进入核心质量指标。
                  </small>
                  <div className="table-scroll"><table><thead><tr><th>游戏</th><th>标签 Fleiss κ</th><th>描述 Fleiss κ</th></tr></thead><tbody>{GAMES.map(g => <tr key={g.id}><td>{g.en}</td><td>{result.games[g.id]?.agreement.label.fleiss_kappa?.toFixed(3) ?? "—"}</td><td>{result.games[g.id]?.agreement.description.fleiss_kappa?.toFixed(3) ?? "—"}</td></tr>)}</tbody></table></div>
                  <details>
                    <summary>快照与复现信息</summary>
                    <pre>
                      {JSON.stringify(
                        {
                          input_hash: result.input_hash,
                          pool_hash: result.pool_hash,
                          dataset_revision: result.dataset_revision,
                          bootstrap: result.bootstrap,
                          diagnostics: result.diagnostics,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <BarChart3 size={30} />
                <h2>等待第一份分析</h2>
                <p>正式回答回收后，点击计算以生成可导出的统计快照。</p>
              </div>
            )}
          </>
        )}
        {tab === "settings" && settings && (
          <div className="admin-card settings-form">
            <h2>冻结前的研究设置</h2>
            <p>分配题目后锁定设置，保留问卷与分析的一致版本。</p>
            {[
              ["datasetRevision", "冻结数据版本"],
              ["contact", "研究联系邮箱或联系方式"],
              ["privacy", "隐私说明（中文）"],
              ["privacyEn", "Privacy notice (English)"],
            ].map(([k, l]) => (
              <label key={k}>
                <span className="field-label">{l}</span>
                {k === "privacy" || k === "privacyEn" ? (
                  <textarea
                    disabled={!!data.study.frozen_at}
                    value={settings[k]}
                    onChange={(e) =>
                      setSettings({ ...settings, [k]: e.target.value })
                    }
                  />
                ) : (
                  <input
                    disabled={!!data.study.frozen_at}
                    value={settings[k]}
                    onChange={(e) =>
                      setSettings({ ...settings, [k]: e.target.value })
                    }
                  />
                )}
              </label>
            ))}
            <label>
              <span className="field-label">正式规模</span>
              <select
                disabled={!!data.study.frozen_at}
                value={settings.clipsPerGame}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    clipsPerGame: +e.target.value,
                    participantsPerGame: { 30: 15, 40: 20, 50: 25 }[
                      +e.target.value as 30 | 40 | 50
                    ],
                  })
                }
              >
                <option value={30}>330 段 · 165 人 · 每视频5人</option>
                <option value={40}>440 段 · 220 人 · 每视频5人（推荐）</option>
                <option value={50}>550 段 · 275 人 · 每视频5人</option>
              </select>
            </label>
            <Button
              disabled={busy || !!data.study.frozen_at}
              onClick={() =>
                action(async () => {
                  await api("admin/config", settings);
                  setMessage("设置已保存");
                })
              }
            >
              <Save size={15} />
              保存设置
            </Button>
            {data.study.pool_hash && (
              <div className="hash-note">
                POOL SHA-256
                <br />
                <code>{data.study.pool_hash}</code>
              </div>
            )}
          </div>
        )}
      </main>
      {edit && (
        <div className="modal-backdrop">
          <div className="modal question-editor">
            <button className="modal-close" onClick={() => setEdit(null)}>
              <X size={20} />
            </button>
            <span className="eyebrow">QUESTION REVIEW / {edit.game}</span>
            <h2>复核题目</h2>
            <video
              src={"/api/media/" + encodeURIComponent(edit.id)}
              controls
              muted
              playsInline
              className="editor-video"
            />
            <label className="field-label">英文原标注</label>
            <textarea
              value={edit.description_en}
              disabled={edit.kind === "main"}
              onChange={(e) =>
                setEdit({ ...edit, description_en: e.target.value })
              }
            />
            <label className="field-label">中文标注 / 对照译文</label>
            <textarea
              value={edit.description_zh}
              onChange={(e) =>
                setEdit({ ...edit, description_zh: e.target.value })
              }
            />
            {edit.labels.map((l: Any, i: number) => (
              <div className="editor-label" key={i}>
                {edit.kind === "control_negative" ? (
                  <select
                    aria-label="负检查标签"
                    value={l.id}
                    onChange={(e) => {
                      const replacement = questions
                        .filter((q) => q.game === edit.game)
                        .flatMap((q) => q.labels)
                        .find((x) => x.id === e.target.value);
                      if (replacement) {
                        const labels = [...edit.labels];
                        labels[i] = { ...replacement };
                        setEdit({ ...edit, labels });
                      }
                    }}
                  >
                    {Array.from(
                      new Set(
                        questions
                          .filter((q) => q.game === edit.game)
                          .flatMap((q) => q.labels.map((x: Any) => x.id)),
                      ),
                    )
                      .sort()
                      .map((id) => (
                        <option value={id as string} key={id as string}>
                          {id as string}
                        </option>
                      ))}
                  </select>
                ) : (
                  <code>{l.id}</code>
                )}
                <input
                  aria-label="标签中文"
                  value={l.zh}
                  onChange={(e) => {
                    const labels = [...edit.labels];
                    labels[i] = { ...l, zh: e.target.value };
                    setEdit({ ...edit, labels });
                  }}
                />
                <textarea
                  aria-label="标签中文解释"
                  value={l.definition_zh}
                  onChange={(e) => {
                    const labels = [...edit.labels];
                    labels[i] = { ...l, definition_zh: e.target.value };
                    setEdit({ ...edit, labels });
                  }}
                />
              </div>
            ))}
            {edit.kind !== "main" && (
              <>
                <p>
                  练习和检查真值需要依据视频核对。负检查应与画面明确冲突，不能直接把原标注当成负例。
                </p>
                <label className="field-label">练习／检查的标签真值</label>
                <select
                  value={edit.expected?.label_support || ""}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      expected: {
                        ...edit.expected,
                        label_support: e.target.value,
                      },
                    })
                  }
                >
                  <option value="">请选择</option>
                  {LABEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.title}
                    </option>
                  ))}
                </select>
                <label className="field-label">练习／检查的描述真值</label>
                <select
                  value={edit.expected?.description_support || ""}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      expected: {
                        ...edit.expected,
                        description_support: e.target.value,
                      },
                    })
                  }
                >
                  <option value="">请选择</option>
                  {DESCRIPTION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.title}
                    </option>
                  ))}
                </select>
              </>
            )}
            <label className="editor-check">
              <input
                type="checkbox"
                checked={edit.reviewed}
                onChange={(e) =>
                  setEdit({ ...edit, reviewed: e.target.checked })
                }
              />
              已依据视频复核该练习／检查及双语文本
            </label>
            <label className="editor-check">
              <input
                type="checkbox"
                checked={edit.media_verified}
                onChange={(e) =>
                  setEdit({ ...edit, media_verified: e.target.checked })
                }
              />
              已确认视频可正常播放
            </label>
            <Button
              disabled={busy}
              onClick={() =>
                action(async () => {
                  await api("admin/pool", [
                    {
                      ...edit,
                      translation_status: edit.reviewed
                        ? "reviewed"
                        : edit.translation_status,
                      provenance: {
                        ...edit.provenance,
                        reviewed_in_admin: true,
                      },
                    },
                  ]);
                  setEdit(null);
                  await showPool();
                  setMessage("题目复核已保存");
                })
              }
            >
              <Save size={15} />
              保存复核
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
function StudyShell() {
  const { t } = useLanguage(),
    [admin, setAdmin] = useState(false);
  useEffect(() => {
    setAdmin(new URLSearchParams(location.search).get("view") === "admin");
  }, []);
  const show = (v: boolean) => {
    setAdmin(v);
    history.replaceState(null, "", v ? "/?view=admin" : "/");
    window.scrollTo(0, 0);
  };
  return (
    <>
      <Header
        admin={admin}
        onHome={() => show(false)}
        onAdmin={() => show(true)}
      />
      {admin ? <Researcher onHome={() => show(false)} /> : <ParticipantStudy />}
      {!admin && (
        <footer>
          <span>
            Game-Intention · {t("竞技游戏意图研究", "Game intent study")}
          </span>
          <span>
            {t(
              "只依据画面，无需猜测。",
              "Use the video evidence. No guessing needed.",
            )}
          </span>
        </footer>
      )}
    </>
  );
}
export default function App() {
  return (
    <LanguageProvider>
      <StudyShell />
    </LanguageProvider>
  );
}
