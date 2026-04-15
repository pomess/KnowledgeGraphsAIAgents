import { useState } from "react";
import { ShieldCheck, FileText, Unlink, FileQuestion, AlertTriangle, CheckCircle, Wrench, Loader2 } from "lucide-react";
import { runLint, solveLintIssue } from "../lib/api";

interface LintIssue {
  type: string;
  severity: string;
  description: string;
  page: string;
  suggestion: string;
}

interface LintResult {
  issues: LintIssue[];
  summary: string;
  stats: { total_pages: number; orphans: number; missing_pages: number };
}

interface SolveResult {
  success: boolean;
  summary?: string;
  pages_touched?: string[];
  error?: string;
}

interface LintPanelProps {
  onNavigate: (slug: string) => void;
  brain?: string;
}

export default function LintPanel({ onNavigate, brain }: LintPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LintResult | null>(null);
  const [solvingIndex, setSolvingIndex] = useState<number | null>(null);
  const [solvedIssues, setSolvedIssues] = useState<Record<number, SolveResult>>({});

  const handleLint = async () => {
    setLoading(true);
    setSolvedIssues({});
    setSolvingIndex(null);
    try {
      const res = await runLint(brain);
      setResult(res);
    } catch {
      setResult({
        issues: [],
        summary: "Lint failed. Is the backend running?",
        stats: { total_pages: 0, orphans: 0, missing_pages: 0 },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSolve = async (issue: LintIssue, index: number) => {
    setSolvingIndex(index);
    try {
      const res = await solveLintIssue(issue, brain);
      setSolvedIssues((prev) => ({ ...prev, [index]: res }));
    } catch {
      setSolvedIssues((prev) => ({
        ...prev,
        [index]: { success: false, error: "Request failed. Is the backend running?" },
      }));
    } finally {
      setSolvingIndex(null);
    }
  };

  return (
    <div className="lint-panel">
      <h2>Wiki Health Check</h2>
      <p className="lint-desc">Analyze your wiki for orphaned pages, missing links, and structural issues.</p>

      <button className="action-btn" onClick={handleLint} disabled={loading}>
        {loading ? (
          <>
            <div className="spinner" />
            Scanning wiki...
          </>
        ) : (
          <>
            <ShieldCheck size={16} />
            Run Health Check
          </>
        )}
      </button>

      {result && (
        <>
          <div className="lint-stats">
            <div className="lint-stat-card">
              <div className="lint-stat-icon pages">
                <FileText size={16} />
              </div>
              <div className="number">{result.stats.total_pages}</div>
              <div className="label">Total Pages</div>
            </div>
            <div className="lint-stat-card">
              <div className="lint-stat-icon orphans">
                <Unlink size={16} />
              </div>
              <div className="number">{result.stats.orphans}</div>
              <div className="label">Orphans</div>
            </div>
            <div className="lint-stat-card">
              <div className="lint-stat-icon missing">
                <FileQuestion size={16} />
              </div>
              <div className="number">{result.stats.missing_pages}</div>
              <div className="label">Missing</div>
            </div>
            <div className="lint-stat-card">
              <div className="lint-stat-icon issues">
                <AlertTriangle size={16} />
              </div>
              <div className="number">{result.issues.length}</div>
              <div className="label">Issues</div>
            </div>
          </div>

          <p className="lint-summary">{result.summary}</p>

          <div className="lint-issues-list">
            {result.issues.map((issue, i) => {
              const solved = solvedIssues[i];
              const isSolving = solvingIndex === i;
              const isBusy = solvingIndex !== null;

              return (
                <div
                  key={i}
                  className={`lint-issue severity-${issue.severity}${solved?.success ? " solved" : ""}`}
                >
                  <div className="lint-issue-header">
                    <span className={`lint-badge ${issue.severity}${solved?.success ? " solved" : ""}`}>
                      {solved?.success ? "solved" : issue.severity}
                    </span>
                    <span className="lint-issue-type">{issue.type}</span>
                    {issue.page && (
                      <span
                        className="wiki-link"
                        style={{ marginLeft: "auto", fontSize: 12 }}
                        onClick={() => onNavigate(issue.page)}
                      >
                        {issue.page}
                      </span>
                    )}
                  </div>
                  <p>{issue.description}</p>
                  {issue.suggestion && (
                    <p className="suggestion">{issue.suggestion}</p>
                  )}

                  {solved?.success ? (
                    <div className="lint-solve-result">
                      <CheckCircle size={13} />
                      <span>{solved.summary}</span>
                    </div>
                  ) : solved && !solved.success ? (
                    <div className="lint-solve-result error">
                      <AlertTriangle size={13} />
                      <span>{solved.error || "Failed to solve issue."}</span>
                    </div>
                  ) : (
                    <button
                      className="lint-solve-btn"
                      onClick={() => handleSolve(issue, i)}
                      disabled={isBusy}
                    >
                      {isSolving ? (
                        <>
                          <Loader2 size={13} className="spin" />
                          Solving...
                        </>
                      ) : (
                        <>
                          <Wrench size={13} />
                          Solve
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
            {result.issues.length === 0 && (
              <div className="lint-empty">
                <div className="lint-empty-icon">
                  <CheckCircle size={22} />
                </div>
                <p>No issues found. Your wiki is healthy.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
