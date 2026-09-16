import { Download, MoreHorizontal, Save, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  blankCase, createAction, createGap, generateCouncilNotes, resolveSessionPrompt,
  generateMarkdown, loadCases, saveCases, titleFromIdea,
} from "../court";
import type { ActionItem, CourtCase, EvidenceGap, Verdict } from "../types";
import { copyText, downloadText } from "../utils/browser";
import { CaseSidebar } from "./CaseSidebar";
import { IntakePanel } from "./IntakePanel";
import { CouncilPanel } from "./CouncilPanel";
import { VerdictPanel } from "./VerdictPanel";

export function Workspace() {
  const [cases, setCases] = useState<CourtCase[]>(() => loadCases());
  const [activeId, setActiveId] = useState(() => cases[0]?.id ?? "");
  const [copied, setCopied] = useState<"prompt" | "markdown" | null>(null);
  const [search, setSearch] = useState("");

  const activeCase = cases.find((item) => item.id === activeId) ?? cases[0];
  const sessionPrompt = useMemo(() => resolveSessionPrompt(activeCase), [activeCase]);

  useEffect(() => {
    saveCases(cases);
  }, [cases]);

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
    const refreshed = resolveSessionPrompt({ ...activeCase, sessionPrompt: "" });
    updateActive((item) => ({
      ...item,
      councilNotes,
      sessionPrompt: refreshed.prompt,
      sessionPromptSource: "core-v1",
    }));
  };

  const copyPrompt = async () => {
    if (sessionPrompt.error !== null) return;
    if (await copyText(sessionPrompt.prompt)) {
      setCopied("prompt");
      setTimeout(() => setCopied(null), 1600);
    }
  };

  const copyMarkdown = async () => {
    if (sessionPrompt.error !== null) return;
    if (await copyText(generateMarkdown(activeCase))) {
      setCopied("markdown");
      setTimeout(() => setCopied(null), 1600);
    }
  };

  const exportMarkdown = () => {
    if (sessionPrompt.error !== null) return;
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
    <div className="app-shell" id="playground">
      <CaseSidebar
        filteredCases={filteredCases}
        activeId={activeCase.id}
        caseCount={cases.length}
        search={search}
        newCase={newCase}
        setSearch={setSearch}
        setActiveId={setActiveId}
      />
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
            <button className="ghost-button" onClick={copyMarkdown} disabled={sessionPrompt.error !== null}>
              <Share2 size={17} />
              {copied === "markdown" ? "Copied" : "Share"}
            </button>
            <button className="ghost-button" onClick={exportMarkdown} disabled={sessionPrompt.error !== null}>
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
          <CouncilPanel activeCase={activeCase} sessionPrompt={sessionPrompt} previewCast={previewCast} copyPrompt={copyPrompt} copied={copied} />
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
  );
}
