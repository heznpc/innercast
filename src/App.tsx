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
  deriveVerdict,
  generateCouncilNotes,
  generateHandoffPrompt,
  generateMarkdown,
  generateRationale,
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
  judge: {
    title: "Verdict",
    tag: "Director",
    icon: Play,
    tone: "dark",
    prompts: ["Weigh arguments", "Make a recommendation", "Define success & next steps"],
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
    nav: ["Personas", "Flow", "Playground"],
    ctaPrimary: "Try the playground",
    ctaSecondary: "Download kit",
    heroTitle: "Give every idea an inner cast before you build.",
    heroText:
      "Innercast turns a vague idea into a named multi-agent review: Doubt breaks it, Spark saves the smallest viable version, Forge scopes the proof, and Verdict decides Kill, Narrow, or Build.",
    proof: ["Codex agents", "Claude agents", "Prompt handoff"],
    rolesTitle: "The default cast",
    roles: [
      { name: "Doubt", role: "Skeptic", text: "Finds the reason not to build." },
      { name: "Spark", role: "Advocate", text: "Protects the strongest surviving use case." },
      { name: "Forge", role: "Builder", text: "Cuts the work down to a 7-day proof." },
      { name: "Verdict", role: "Director", text: "Returns one hard signal." },
    ],
    flowTitle: "Use it where the work already happens.",
    flow: ["Install the native agent pack.", "Run the cast before implementation.", "Copy the final handoff into your AI builder."],
    boundaryTitle: "Not another required service",
    boundary:
      "The default product is agent-native. This page is for discovery, docs, and a lightweight playground, while the real loop stays inside Codex, Claude, and prompt handoffs.",
  },
  ko: {
    nav: ["페르소나", "흐름", "플레이그라운드"],
    ctaPrimary: "플레이그라운드 열기",
    ctaSecondary: "키트 다운로드",
    heroTitle: "빌드하기 전에 모든 아이디어를 내면의 캐스트에 올려보세요.",
    heroText:
      "Innercast는 막연한 아이디어를 이름 붙은 멀티 에이전트 검토로 바꿉니다. Doubt는 부수고, Spark는 살아남을 가능성을 찾고, Forge는 검증 가능한 범위로 줄이며, Verdict는 Kill, Narrow, Build 중 하나로 결론냅니다.",
    proof: ["Codex 에이전트", "Claude 에이전트", "프롬프트 핸드오프"],
    rolesTitle: "기본 캐스트",
    roles: [
      { name: "Doubt", role: "Skeptic", text: "만들지 말아야 할 이유를 찾습니다." },
      { name: "Spark", role: "Advocate", text: "살아남을 가장 작은 사용 순간을 지킵니다." },
      { name: "Forge", role: "Builder", text: "작업을 7일짜리 증명으로 줄입니다." },
      { name: "Verdict", role: "Director", text: "하나의 강한 신호로 결론냅니다." },
    ],
    flowTitle: "이미 일하는 곳 안에서 사용합니다.",
    flow: ["네이티브 에이전트 팩을 설치합니다.", "구현 전에 캐스트를 실행합니다.", "최종 핸드오프를 AI 빌더에 넘깁니다."],
    boundaryTitle: "또 하나의 필수 서비스가 아닙니다",
    boundary:
      "기본 제품은 에이전트 네이티브입니다. 이 페이지는 발견, 문서, 가벼운 플레이그라운드를 위한 것이고, 실제 루프는 Codex, Claude, 프롬프트 핸드오프 안에 남습니다.",
  },
  ja: {
    nav: ["ペルソナ", "流れ", "プレイグラウンド"],
    ctaPrimary: "プレイグラウンドを試す",
    ctaSecondary: "キットをダウンロード",
    heroTitle: "作る前に、すべてのアイデアを内なるキャストへ。",
    heroText:
      "Innercastは、曖昧なアイデアを名前付きのマルチエージェントレビューに変えます。Doubtが壊し、Sparkが残る可能性を守り、Forgeが検証範囲へ削り、VerdictがKill、Narrow、Buildを決めます。",
    proof: ["Codex agents", "Claude agents", "Prompt handoff"],
    rolesTitle: "デフォルトキャスト",
    roles: [
      { name: "Doubt", role: "Skeptic", text: "作らない理由を見つけます。" },
      { name: "Spark", role: "Advocate", text: "残すべき最小の利用場面を守ります。" },
      { name: "Forge", role: "Builder", text: "7日で試せる証明へ削ります。" },
      { name: "Verdict", role: "Director", text: "ひとつの強い判断を返します。" },
    ],
    flowTitle: "作業がすでにある場所で使います。",
    flow: ["ネイティブエージェントパックを入れる。", "実装前にキャストを走らせる。", "最終ハンドオフをAIビルダーへ渡す。"],
    boundaryTitle: "必須の別サービスではありません",
    boundary:
      "基本の製品はエージェントネイティブです。このページは発見、ドキュメント、軽いプレイグラウンド用で、実際のループはCodex、Claude、プロンプトハンドオフ内に残ります。",
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

  const runCouncil = () => {
    const verdict = deriveVerdict(activeCase);
    const councilNotes = generateCouncilNotes(activeCase);
    updateActive((item) => ({
      ...item,
      verdict,
      confidence: verdict === "Kill" ? "Low" : "High",
      rationale: generateRationale(verdict, item),
      councilNotes,
      handoffPrompt: generateHandoffPrompt(item),
    }));
  };

  const copyPrompt = async () => {
    const prompt = activeCase.handoffPrompt || generateHandoffPrompt(activeCase);
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
            <p>Give ideas a cast.</p>
          </div>
        </div>

        <div className="new-case-row">
          <button className="primary-block" onClick={newCase}>
            <Plus size={17} />
            New idea
          </button>
          <button className="square-button" aria-label="Open template library">
            <Library size={17} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          <a className="nav-link" href="#dashboard">
            <LayoutDashboard size={18} />
            Dashboard
          </a>
          <a className="nav-link active" href="#cases">
            <Folder size={18} />
            Cases
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
          <span>Recent ideas</span>
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
              <strong>Local handoff ready</strong>
              <small>Codex, Claude, Gemini, or generic</small>
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
          <CouncilPanel activeCase={activeCase} runCouncil={runCouncil} copyPrompt={copyPrompt} copied={copied} />
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
            <strong>Kill / Narrow / Build</strong>
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
      <PanelTitle number="1." title="Intake" subtitle="Give the cast something concrete to react to." />
      <TextAreaField
        label="Idea"
        value={activeCase.idea}
        onChange={(value) => setField("idea", value)}
        placeholder="An AI code review bot that comments on pull requests, suggests improvements, and learns team preferences."
        minRows={5}
      />
      <TextAreaField
        label="Target user"
        value={activeCase.targetUser}
        onChange={(value) => setField("targetUser", value)}
        placeholder="Indie devs and small teams using GitHub who want faster, higher-quality code reviews."
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
        label="Tempted build"
        value={activeCase.temptedBuild}
        onChange={(value) => setField("temptedBuild", value)}
        placeholder="Full PR analysis, inline comments, risk scoring, auto-fix suggestions, team standards learning, and dashboards."
        minRows={4}
      />
      <label className="field-block">
        <span>Tags</span>
        <input
          value={activeCase.tags}
          onChange={(event) => setField("tags", event.target.value)}
          placeholder="e.g. devtools, ai, productivity"
        />
      </label>
      <label className="field-block">
        <span>Template</span>
        <select value={activeCase.template} onChange={(event) => setField("template", event.target.value)}>
          <option>Default Cast (Doubt, Spark, Forge, Verdict)</option>
          <option>Launch Risk Review</option>
          <option>Pre-Build Scope Review</option>
        </select>
      </label>
    </section>
  );
}

function CouncilPanel({
  activeCase,
  runCouncil,
  copyPrompt,
  copied,
}: {
  activeCase: CourtCase;
  runCouncil: () => void;
  copyPrompt: () => void;
  copied: "prompt" | "markdown" | null;
}) {
  const generatedPrompt = activeCase.handoffPrompt || generateHandoffPrompt(activeCase);

  return (
    <section className="panel cast-panel">
      <div className="panel-head with-action">
        <PanelTitle number="2." title="Cast" subtitle="Four instincts. One clearer move." />
        <button className="run-button" onClick={runCouncil}>
          <Play size={15} />
          Run Innercast
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
            <h3>Agent handoff</h3>
            <p>Generated from intake + cast context.</p>
          </div>
          <button className="dark-button" onClick={runCouncil}>
            <Sparkles size={15} />
            Generate handoff
          </button>
        </div>
        <textarea value={generatedPrompt} readOnly aria-label="Generated agent handoff" />
        <div className="prompt-actions">
          <button className="ghost-button" onClick={copyPrompt}>
            <Copy size={16} />
            {copied === "prompt" ? "Copied" : "Copy handoff"}
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
      <PanelTitle number="3." title="Signal & Journal" subtitle="Decide, document, move forward." />

      <div className="section-label">
        <span>Signal</span>
        <CircleHelp size={15} />
      </div>
      <div className="segmented" role="radiogroup" aria-label="Signal">
        {(Object.keys(verdictTone) as Verdict[]).map((verdict) => (
          <button
            key={verdict}
            className={`segment ${activeCase.verdict === verdict ? "active" : ""} ${verdict.toLowerCase()}`}
            onClick={() => setField("verdict", verdict)}
            role="radio"
            aria-checked={activeCase.verdict === verdict}
          >
            <span>{verdict === "Build" ? <Check size={20} /> : verdict === "Narrow" ? "−" : "×"}</span>
            {verdict}
          </button>
        ))}
      </div>

      <TextAreaField
        label="Rationale"
        value={activeCase.rationale}
        onChange={(value) => setField("rationale", value)}
        placeholder="Strong problem fit for target users. Feasible within constraints with a focused v1."
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
              <strong>{decisionStats[verdict]} {verdict}</strong>
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
  return <span className={`verdict-badge ${verdict.toLowerCase()}`}>{verdict}</span>;
}
