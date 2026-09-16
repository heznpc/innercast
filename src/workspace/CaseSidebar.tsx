import { Check, FileText, Folder, LayoutDashboard, Library, Plus, Search, Settings, Sparkles } from "lucide-react";
import type { CourtCase } from "../types";
import { VerdictBadge } from "./panel-ui";

const formatCaseDate = (iso: string) => {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
};

export function CaseSidebar({
  filteredCases, activeId, caseCount, search, newCase, setSearch, setActiveId,
}: {
  filteredCases: CourtCase[];
  activeId: string;
  caseCount: number;
  search: string;
  newCase: () => void;
  setSearch: (search: string) => void;
  setActiveId: (id: string) => void;
}) {
  return (
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
            className={`case-row ${item.id === activeId ? "selected" : ""}`}
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
            <small>{caseCount} innercasts</small>
          </div>
        </div>
      </div>
    </aside>
  );
}
