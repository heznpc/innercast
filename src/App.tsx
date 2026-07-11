import {
  Archive,
  Check,
  ChevronRight,
  CircleHelp,
  Copy,
  Download,
  FileText,
  Folder,
  Languages,
  LayoutDashboard,
  Library,
  ListPlus,
  MoreHorizontal,
  Play,
  Plus,
  Save,
  Search,
  Settings,
  Share2,
  Shield,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  blankCase,
  confidenceLevels,
  createAction,
  createGap,
  generateCouncilNotes,
  generateSessionPrompt,
  generateMarkdown,
  loadCases,
  roleOrder,
  saveCases,
  titleFromIdea,
  verdictTone,
} from "./court";
import type { ActionItem, Confidence, CouncilRole, CourtCase, EvidenceGap, Verdict } from "./types";

const roleMeta: Record<CouncilRole, {
  title: string;
  tag: string;
  icon: typeof Sparkles;
  tone: string;
  prompts: string[];
}> = {
  skeptic: {
    title: "Doubt",
    tag: "Skeptic",
    icon: CircleHelp,
    tone: "danger",
    prompts: ["What could go wrong?", "What assumptions are shaky?", "What will users not adopt?"],
  },
  advocate: {
    title: "Spark",
    tag: "Advocate",
    icon: Shield,
    tone: "neutral",
    prompts: ["Why is this worth building?", "What problem does it solve well?", "Why now?"],
  },
  builder: {
    title: "Forge",
    tag: "Builder",
    icon: Wrench,
    tone: "success",
    prompts: ["What's the simplest path?", "What are the key milestones?", "What would v1 look like?"],
  },
};

const formatCaseDate = (iso: string) => {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
};

const downloadText = (filename: string, text: string) => {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  }
};

type Locale = "en" | "ko" | "ja";

const localeLabels: Record<Locale, string> = {
  en: "EN",
  ko: "KO",
  ja: "JA",
};

const landingCopy: Record<Locale, {
  nav: string[];
  ctaPrimary: string;
  ctaSecondary: string;
  heroTitle: string;
  heroText: string;
  proof: string[];
  rolesTitle: string;
  roles: Array<{ name: string; role: string; text: string }>;
  flowTitle: string;
  flow: string[];
  boundaryTitle: string;
  boundary: string;
}> = {
  en: {
    nav: ["Characters", "Runtime", "Playground"],
    ctaPrimary: "Preview the cast",
    ctaSecondary: "Download engine kit",
    heroTitle: "One AI task. A stable inner cast. A decision that stays yours.",
    heroText:
      "Define named character agents once, then run them inside the AI tool you already use. The cast deliberates from distinct perspectives; the root or main agent weighs the voices and makes the final call.",
    proof: ["Codex native", "Claude Code native", "Gemini CLI native", "Generic fallback"],
    rolesTitle: "The cast and its decision owner",
    roles: [
      { name: "Doubt", role: "Skeptic", text: "Challenges assumptions, risks, and the urge to rush." },
      { name: "Spark", role: "Advocate", text: "Protects the strongest possibility worth pursuing." },
      { name: "Forge", role: "Builder", text: "Turns the surviving direction into an executable next move." },
      { name: "Root", role: "Decision owner", text: "Synthesizes the tension, accepts the risk, and makes the final call." },
    ],
    flowTitle: "The same cast, adapted to each runtime.",
    flow: ["Define or install the cast once.", "Invoke its characters inside the current AI task.", "Let the root or main agent synthesize and continue the work."],
    boundaryTitle: "An engine, not a separate room",
    boundary:
      "Innercast uses native named agents where the host supports them and an explicit prompt fallback elsewhere. Host capabilities differ, so fallback mode cannot promise the same UI identity or parallelism as native agents.",
  },
  ko: {
    nav: ["캐릭터", "런타임", "플레이그라운드"],
    ctaPrimary: "캐스트 미리보기",
    ctaSecondary: "엔진 키트 다운로드",
    heroTitle: "하나의 AI 작업, 익숙한 내면 캐스트, 그리고 내가 내리는 결정.",
    heroText:
      "이름과 성격이 고정된 캐릭터 에이전트를 한 번 정의하고, 이미 사용하는 AI 안에서 실행합니다. 캐스트는 서로 다른 관점으로 숙의하고, 루트 또는 메인 에이전트가 의견을 종합해 최종 결정을 내립니다.",
    proof: ["Codex 네이티브", "Claude Code 네이티브", "Gemini CLI 네이티브", "범용 폴백"],
    rolesTitle: "기본 캐스트와 결정 주체",
    roles: [
      { name: "Doubt", role: "Skeptic", text: "가정과 위험, 서두르려는 충동을 의심합니다." },
      { name: "Spark", role: "Advocate", text: "계속 살려볼 가장 강한 가능성을 지킵니다." },
      { name: "Forge", role: "Builder", text: "살아남은 방향을 실행 가능한 다음 행동으로 만듭니다." },
      { name: "Root", role: "Decision owner", text: "긴장을 종합하고 감수할 위험을 밝힌 뒤 최종 결정을 내립니다." },
    ],
    flowTitle: "같은 캐스트를 각 AI 런타임에 맞게 적용합니다.",
    flow: ["캐스트를 한 번 정의하거나 설치합니다.", "현재 AI 작업 안에서 캐릭터들을 호출합니다.", "루트 또는 메인 에이전트가 종합하고 작업을 이어갑니다."],
    boundaryTitle: "별도의 대화방이 아니라 내부 엔진입니다",
    boundary:
      "호스트가 지원하면 네이티브 이름형 에이전트를 사용하고, 그렇지 않으면 폴백 프롬프트임을 명시합니다. 호스트 기능이 다르므로 폴백은 네이티브와 같은 UI 정체성이나 병렬 실행을 보장하지 않습니다.",
  },
  ja: {
    nav: ["キャラクター", "ランタイム", "プレイグラウンド"],
    ctaPrimary: "キャストをプレビュー",
    ctaSecondary: "エンジンキットをダウンロード",
    heroTitle: "ひとつのAIタスク、馴染みの内なるキャスト、そして自分の決定。",
    heroText:
      "名前と性格を持つキャラクターエージェントを一度定義し、普段使うAIの中で動かします。キャストが異なる視点で議論し、ルートまたはメインエージェントが意見を統合して最終決定します。",
    proof: ["Codex native", "Claude Code native", "Gemini CLI native", "Generic fallback"],
    rolesTitle: "デフォルトキャストと決定者",
    roles: [
      { name: "Doubt", role: "Skeptic", text: "前提、リスク、急ぐ衝動を疑います。" },
      { name: "Spark", role: "Advocate", text: "追う価値のある最も強い可能性を守ります。" },
      { name: "Forge", role: "Builder", text: "残った方向を実行可能な次の一手にします。" },
      { name: "Root", role: "Decision owner", text: "対立を統合し、受け入れるリスクを示して最終決定します。" },
    ],
    flowTitle: "同じキャストを各AIランタイムへ適応します。",
    flow: ["キャストを一度定義またはインストールする。", "現在のAIタスク内でキャラクターを呼び出す。", "ルートまたはメインエージェントが統合して作業を続ける。"],
    boundaryTitle: "別の会話サービスではなく、内部エンジンです",
    boundary:
      "ホストが対応する場合はネイティブの名前付きエージェントを使い、それ以外ではプロンプトフォールバックであることを明示します。フォールバックはネイティブと同じUI上の人格表示や並列実行を保証しません。",
  },
};

export function App() {
  const [cases, setCases] = useState<CourtCase[]>(() => loadCases());
  const [activeId, setActiveId] = useState(() => cases[0]?.id ?? "");
  const [copied, setCopied] = useState<"prompt" | "markdown" | null>(null);
  const [search, setSearch] = useState("");
  const [locale, setLocale] = useState<Locale>("en");

  const activeCase = cases.find((item) => item.id === activeId) ?? cases[0];

  useEffect(() => {
    saveCases(cases);
  }, [cases]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const filteredCases = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return cases;
    return cases.filter((item) => {
      return `${item.title} ${item.idea} ${item.tags}`.toLowerCase().includes(query);
    });
  }, [cases, search]);

  const decisionStats = useMemo(() => {
    return cases.reduce(
      (acc, item) => {
        acc[item.verdict] += 1;
        return acc;
      },
      { Kill: 0, Narrow: 0, Build: 0 } as Record<Verdict, number>,
    );
  }, [cases]);

  const updateActive = (recipe: (draft: CourtCase) => CourtCase) => {
    setCases((current) =>
      current.map((item) => {
        if (item.id !== activeCase.id) return item;
        return { ...recipe(item), updatedAt: new Date().toISOString() };
      }),
    );
  };

  const setField = <Key extends keyof CourtCase>(key: Key, value: CourtCase[Key]) => {
    updateActive((item) => {
      const next = { ...item, [key]: value };
      if (key === "idea") {
        next.title = titleFromIdea(String(value));
      }
      return next;
    });
  };

  const newCase = () => {
    const fresh = blankCase();
    setCases((current) => [fresh, ...current]);
    setActiveId(fresh.id);
  };

  const previewCast = () => {
    const councilNotes = generateCouncilNotes(activeCase);
    updateActive((item) => ({
      ...item,
      councilNotes,
      sessionPrompt: generateSessionPrompt(item),
    }));
  };

  const copyPrompt = async () => {
    const prompt = activeCase.sessionPrompt || generateSessionPrompt(activeCase);
    if (await copyText(prompt)) {
      setCopied("prompt");
      setTimeout(() => setCopied(null), 1600);
    }
  };

  const copyMarkdown = async () => {
    if (await copyText(generateMarkdown(activeCase))) {
      setCopied("markdown");
      setTimeout(() => setCopied(null), 1600);
    }
  };

  const exportMarkdown = () => {
    const safeTitle = activeCase.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "innercast";
    downloadText(`${safeTitle}-signal.md`, generateMarkdown(activeCase));
  };

  const updateGap = (gapId: string, patch: Partial<EvidenceGap>) => {
    updateActive((item) => ({
      ...item,
      evidenceGaps: item.evidenceGaps.map((gap) => (gap.id === gapId ? { ...gap, ...patch } : gap)),
    }));
  };

  const updateAction = (actionId: string, patch: Partial<ActionItem>) => {
    updateActive((item) => ({
      ...item,
      nextActions: item.nextActions.map((action) => (action.id === actionId ? { ...action, ...patch } : action)),
    }));
  };

  if (!activeCase) {
    return null;
  }

  return (
    <div className="site-shell">
      <LandingPage locale={locale} setLocale={setLocale} />
      <div className="app-shell" id="playground">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={28} strokeWidth={2.2} />
          </div>
          <div>
            <h1>Innercast</h1>
            <p>One task. Many voices.</p>
          </div>
        </div>

        <div className="new-case-row">
          <button className="primary-block" onClick={newCase}>
            <Plus size={17} />
            New decision
          </button>
          <button className="square-button" aria-label="Open template library">
            <Library size={17} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          <a className="nav-link" href="#dashboard">
            <LayoutDashboard size={18} />
            Overview
          </a>
          <a className="nav-link active" href="#cases">
            <Folder size={18} />
            Decisions
          </a>
          <a className="nav-link" href="#templates">
            <FileText size={18} />
            Templates
          </a>
          <a className="nav-link" href="#settings">
            <Settings size={18} />
            Settings
          </a>
        </nav>

        <div className="recent-header">
          <span>Recent decisions</span>
          <div className="search-mini">
            <Search size={15} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search cases" />
          </div>
        </div>

        <div className="case-list">
          {filteredCases.map((item) => (
            <button
              className={`case-row ${item.id === activeCase.id ? "selected" : ""}`}
              key={item.id}
              onClick={() => setActiveId(item.id)}
            >
              <span>
                <strong>{item.title}</strong>
                <small>{formatCaseDate(item.updatedAt)}</small>
              </span>
              <VerdictBadge verdict={item.verdict} />
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="connection-card">
            <span className="connected-icon">
              <Check size={16} />
            </span>
            <div>
              <strong>Adapter engine ready</strong>
              <small>Native where supported, fallback elsewhere</small>
            </div>
          </div>
          <div className="profile-card">
            <span className="avatar">PC</span>
            <div>
              <strong>Local workspace</strong>
              <small>{cases.length} innercasts</small>
            </div>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="title-row">
            <input
              className="title-input"
              value={activeCase.title}
              onChange={(event) => setField("title", event.target.value)}
              aria-label="Case title"
            />
            <span className="active-pill">Active</span>
          </div>
          <div className="top-actions">
            <button className="ghost-button" onClick={() => setCases([...cases])}>
              <Save size={17} />
              Save draft
            </button>
            <button className="ghost-button" onClick={copyMarkdown}>
              <Share2 size={17} />
              {copied === "markdown" ? "Copied" : "Share"}
            </button>
            <button className="ghost-button" onClick={exportMarkdown}>
              <Download size={17} />
              Export
            </button>
            <button className="icon-button" aria-label="More actions">
              <MoreHorizontal size={18} />
            </button>
          </div>
        </header>

        <section className="stage-grid">
          <IntakePanel activeCase={activeCase} setField={setField} />
          <CouncilPanel activeCase={activeCase} previewCast={previewCast} copyPrompt={copyPrompt} copied={copied} />
          <VerdictPanel
            activeCase={activeCase}
            decisionStats={decisionStats}
            setField={setField}
            updateGap={updateGap}
            updateAction={updateAction}
            addGap={() => updateActive((item) => ({ ...item, evidenceGaps: [...item.evidenceGaps, createGap("New evidence gap")] }))}
            addAction={() => updateActive((item) => ({ ...item, nextActions: [...item.nextActions.slice(0, 2), createAction("New next action")] }))}
            removeGap={(gapId) =>
              updateActive((item) => ({ ...item, evidenceGaps: item.evidenceGaps.filter((gap) => gap.id !== gapId) }))
            }
            removeAction={(actionId) =>
              updateActive((item) => ({ ...item, nextActions: item.nextActions.filter((action) => action.id !== actionId) }))
            }
          />
        </section>
      </main>
      </div>
    </div>
  );
}

function LandingPage({ locale, setLocale }: { locale: Locale; setLocale: (locale: Locale) => void }) {
  const copy = landingCopy[locale];

  return (
    <section className="landing" id="top">
      <header className="landing-nav">
        <a className="landing-brand" href="#top" aria-label="Innercast home">
          <span className="landing-mark">
            <Sparkles size={22} />
          </span>
          <span>Innercast</span>
        </a>
        <nav aria-label="Landing navigation">
          <a href="#personas">{copy.nav[0]}</a>
          <a href="#flow">{copy.nav[1]}</a>
          <a href="#playground">{copy.nav[2]}</a>
        </nav>
        <div className="locale-switch" aria-label="Language selector">
          <Languages size={16} />
          {(Object.keys(localeLabels) as Locale[]).map((item) => (
            <button key={item} className={item === locale ? "active" : ""} onClick={() => setLocale(item)}>
              {localeLabels[item]}
            </button>
          ))}
        </div>
      </header>

      <div className="landing-hero">
        <div className="hero-copy">
          <h1>{copy.heroTitle}</h1>
          <p>{copy.heroText}</p>
          <div className="hero-actions">
            <a className="hero-primary" href="#playground">
              {copy.ctaPrimary}
            </a>
            <a className="hero-secondary" href="./innercast-kit.zip" download>
              {copy.ctaSecondary}
            </a>
          </div>
          <div className="proof-strip">
            {copy.proof.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>

        <div className="cast-stage" id="personas" aria-label={copy.rolesTitle}>
          <div className="stage-header">
            <span>{copy.rolesTitle}</span>
            <strong>Advisory voices → main agent decides</strong>
          </div>
          <div className="persona-grid">
            {copy.roles.map((role) => (
              <article key={role.name} className={`persona-card ${role.name.toLowerCase()}`}>
                <h2>{role.name}</h2>
                <span>{role.role}</span>
                <p>{role.text}</p>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="landing-flow" id="flow">
        <div>
          <h2>{copy.flowTitle}</h2>
          <p>{copy.boundary}</p>
        </div>
        <ol>
          {copy.flow.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </div>

      <div className="landing-boundary">
        <strong>{copy.boundaryTitle}</strong>
        <span>{copy.boundary}</span>
      </div>
    </section>
  );
}

function IntakePanel({
  activeCase,
  setField,
}: {
  activeCase: CourtCase;
  setField: <Key extends keyof CourtCase>(key: Key, value: CourtCase[Key]) => void;
}) {
  return (
    <section className="panel intake-panel">
      <PanelTitle number="1." title="Decision context" subtitle="Give the inner cast one concrete decision to examine." />
      <TextAreaField
        label="Decision or goal"
        value={activeCase.idea}
        onChange={(value) => setField("idea", value)}
        placeholder="Should we replace the current review workflow, narrow it, or keep it for another cycle?"
        minRows={5}
      />
      <TextAreaField
        label="People or system affected"
        value={activeCase.targetUser}
        onChange={(value) => setField("targetUser", value)}
        placeholder="The team using the workflow, the repository it affects, and anyone who must maintain the result."
        minRows={4}
      />
      <TextAreaField
        label="Constraints"
        value={activeCase.constraints}
        onChange={(value) => setField("constraints", value)}
        placeholder="- Initial build in 4 weeks&#10;- <$100/month infra&#10;- Must integrate with GitHub"
        minRows={4}
      />
      <TextAreaField
        label="Current impulse"
        value={activeCase.temptedBuild}
        onChange={(value) => setField("temptedBuild", value)}
        placeholder="What the main agent currently wants to do before hearing the cast."
        minRows={4}
      />
      <label className="field-block">
        <span>Tags</span>
        <input
          value={activeCase.tags}
          onChange={(event) => setField("tags", event.target.value)}
          placeholder="e.g. repository, product, workflow"
        />
      </label>
      <label className="field-block">
        <span>Template</span>
        <select value={activeCase.template} onChange={(event) => setField("template", event.target.value)}>
          <option>Default Inner Cast (Doubt, Spark, Forge)</option>
          <option>Product Decision Cast</option>
          <option>Implementation Decision Cast</option>
        </select>
      </label>
    </section>
  );
}

function CouncilPanel({
  activeCase,
  previewCast,
  copyPrompt,
  copied,
}: {
  activeCase: CourtCase;
  previewCast: () => void;
  copyPrompt: () => void;
  copied: "prompt" | "markdown" | null;
}) {
  const generatedPrompt = activeCase.sessionPrompt || generateSessionPrompt(activeCase);

  return (
    <section className="panel cast-panel">
      <div className="panel-head with-action">
        <PanelTitle number="2." title="Inner cast" subtitle="Three advisory voices. The main agent owns the call." />
        <button className="run-button" onClick={previewCast}>
          <Play size={15} />
          Preview voices
        </button>
      </div>

      <div className="role-stack">
        {roleOrder.map((role) => (
          <RoleCard key={role} role={role} notes={activeCase.councilNotes[role]} />
        ))}
      </div>

      <div className="prompt-box">
        <div className="prompt-head">
          <div>
            <h3>Current-task session prompt</h3>
            <p>This browser is a preview. Native adapters run the live cast inside your AI task.</p>
          </div>
          <button className="dark-button" onClick={previewCast}>
            <Sparkles size={15} />
            Refresh prompt
          </button>
        </div>
        <textarea value={generatedPrompt} readOnly aria-label="Generated current-task session prompt" />
        <div className="prompt-actions">
          <button className="ghost-button" onClick={copyPrompt}>
            <Copy size={16} />
            {copied === "prompt" ? "Copied" : "Copy session prompt"}
          </button>
          <a className="ghost-button link-button" href="./innercast-kit.zip" download>
            <Download size={16} />
            Download kit
          </a>
        </div>
      </div>
    </section>
  );
}

function VerdictPanel({
  activeCase,
  decisionStats,
  setField,
  updateGap,
  updateAction,
  addGap,
  addAction,
  removeGap,
  removeAction,
}: {
  activeCase: CourtCase;
  decisionStats: Record<Verdict, number>;
  setField: <Key extends keyof CourtCase>(key: Key, value: CourtCase[Key]) => void;
  updateGap: (gapId: string, patch: Partial<EvidenceGap>) => void;
  updateAction: (actionId: string, patch: Partial<ActionItem>) => void;
  addGap: () => void;
  addAction: () => void;
  removeGap: (gapId: string) => void;
  removeAction: (actionId: string) => void;
}) {
  return (
    <section className="panel signal-panel">
      <PanelTitle number="3." title="Main decision & journal" subtitle="The root or main agent decides after hearing the cast." />

      <div className="section-label">
        <span>Decision direction</span>
        <CircleHelp size={15} />
      </div>
      <div className="segmented" role="radiogroup" aria-label="Decision direction">
        {(Object.keys(verdictTone) as Verdict[]).map((verdict) => (
          <button
            key={verdict}
            className={`segment ${activeCase.verdict === verdict ? "active" : ""} ${verdict.toLowerCase()}`}
            onClick={() => setField("verdict", verdict)}
            role="radio"
            aria-checked={activeCase.verdict === verdict}
          >
            <span>{verdict === "Build" ? <Check size={20} /> : verdict === "Narrow" ? "−" : "×"}</span>
            {verdictTone[verdict].label}
          </button>
        ))}
      </div>

      <TextAreaField
        label="Root/main rationale"
        value={activeCase.rationale}
        onChange={(value) => setField("rationale", value)}
        placeholder="State which character tensions mattered and why the main agent chose this direction."
        minRows={3}
        compact
      />

      <label className="field-block confidence-row">
        <span>
          Confidence
          <CircleHelp size={14} />
        </span>
        <select value={activeCase.confidence} onChange={(event) => setField("confidence", event.target.value as Confidence)}>
          {confidenceLevels.map((level) => (
            <option key={level}>{level}</option>
          ))}
        </select>
      </label>

      <EditableList
        title="Evidence gaps"
        items={activeCase.evidenceGaps.map((gap) => ({ id: gap.id, text: gap.text, checked: gap.resolved }))}
        addLabel="Add gap"
        onAdd={addGap}
        onRemove={removeGap}
        onToggle={(gapId, checked) => updateGap(gapId, { resolved: checked })}
        onTextChange={(gapId, text) => updateGap(gapId, { text })}
      />

      <EditableList
        title="Next 3 actions"
        items={activeCase.nextActions.map((action) => ({ id: action.id, text: action.text, checked: action.done }))}
        addLabel="Add action"
        onAdd={addAction}
        onRemove={removeAction}
        onToggle={(actionId, checked) => updateAction(actionId, { done: checked })}
        onTextChange={(actionId, text) => updateAction(actionId, { text })}
        numbered
      />

      <div className="decision-log">
        <h3>Decision log</h3>
        {(Object.keys(decisionStats) as Verdict[]).map((verdict) => (
          <div className={`log-row ${verdict.toLowerCase()}`} key={verdict}>
            <span className="log-dot" />
            <div>
              <strong>{decisionStats[verdict]} {verdictTone[verdict].label}</strong>
              <small>{verdictTone[verdict].description}</small>
            </div>
            <VerdictBadge verdict={verdict} />
          </div>
        ))}
        <button className="journal-button">
          <Archive size={17} />
          View full journal
          <ChevronRight size={17} />
        </button>
      </div>
    </section>
  );
}

function RoleCard({ role, notes }: { role: CouncilRole; notes: string[] }) {
  const meta = roleMeta[role];
  const Icon = meta.icon;
  const body = notes.length ? notes : meta.prompts;

  return (
    <article className={`role-card ${meta.tone}`}>
      <div className="role-icon">
        <Icon size={24} />
      </div>
      <div className="role-content">
        <div className="role-title">
          <h3>{meta.title}</h3>
          <span>{meta.tag}</span>
        </div>
        <ul>
          {body.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div className="role-status">
        <span>{notes.length ? "Ready" : "Pending"}</span>
        <ChevronRight size={17} />
      </div>
    </article>
  );
}

function EditableList({
  title,
  items,
  addLabel,
  onAdd,
  onRemove,
  onToggle,
  onTextChange,
  numbered,
}: {
  title: string;
  items: { id: string; text: string; checked: boolean }[];
  addLabel: string;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onToggle: (id: string, checked: boolean) => void;
  onTextChange: (id: string, text: string) => void;
  numbered?: boolean;
}) {
  return (
    <div className="editable-list">
      <div className="list-head">
        <span>{title}</span>
        <button onClick={onAdd}>
          <ListPlus size={15} />
          {addLabel}
        </button>
      </div>
      <div className="list-items">
        {items.map((item, index) => (
          <div className="list-item" key={item.id}>
            {numbered ? (
              <span className="number-badge">{index + 1}</span>
            ) : (
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(event) => onToggle(item.id, event.target.checked)}
                aria-label={`Toggle ${item.text}`}
              />
            )}
            <input value={item.text} onChange={(event) => onTextChange(item.id, event.target.value)} />
            <button className="trash-button" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.text}`}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  minRows,
  compact,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  minRows: number;
  compact?: boolean;
}) {
  return (
    <label className={`field-block ${compact ? "compact" : ""}`}>
      <span>{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={minRows}
      />
    </label>
  );
}

function PanelTitle({ number, title, subtitle }: { number: string; title: string; subtitle: string }) {
  return (
    <div className="panel-title">
      <h2>
        <span>{number}</span>
        {title}
      </h2>
      <p>{subtitle}</p>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return <span className={`verdict-badge ${verdict.toLowerCase()}`}>{verdictTone[verdict].label}</span>;
}
