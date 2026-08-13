import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Gauge,
  LayoutDashboard,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Settings,
  ShieldCheck,
  type LucideIcon
} from "lucide-react";
import { ValidationChainCard } from "@/components/common/ValidationChainCard";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface HubItem {
  href: string;
  label: string;
  /** Working route kept for URL compatibility but hidden from tabs. */
  hidden?: boolean;
}

interface NavigationHub {
  id: string;
  label: string;
  icon: LucideIcon;
  items: HubItem[];
  /** Advanced routes remain addressable without crowding primary navigation. */
  hidden?: boolean;
}

/**
 * Operator-facing information architecture. Detailed research routes remain
 * mapped under the hidden Advanced hub so old URLs keep working.
 */
const navigationHubs: NavigationHub[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    items: [{ href: "/dashboard", label: "Operator Console" }]
  },
  {
    id: "decisions",
    label: "Decisions",
    icon: MessageSquareText,
    items: [{ href: "/advisor", label: "Decision Inbox" }]
  },
  {
    id: "results",
    label: "Results",
    icon: BarChart3,
    items: [{ href: "/performance", label: "Results" }]
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    items: [{ href: "/settings", label: "Settings" }]
  },
  {
    id: "advanced",
    label: "Advanced Research",
    icon: Gauge,
    hidden: true,
    items: [
      { href: "/research-lab", label: "Mission Control" },
      { href: "/research-advisor", label: "Research Advisor" },
      { href: "/market-data", label: "Market Data" },
      { href: "/ict-lab", label: "ICT Lab" },
      { href: "/research", label: "Research Workbench" },
      { href: "/replay", label: "Replay" },
      { href: "/walk-forward", label: "Walk-Forward" },
      { href: "/backtest-lab", label: "Backtest Lab" },
      { href: "/validation", label: "Validation Suite" },
      { href: "/research-quality", label: "Research Quality" },
      { href: "/paper-demo", label: "Paper-Demo Ops" },
      { href: "/evidence-quality", label: "Evidence Quality" },
      { href: "/research-maturity", label: "Research Maturity" },
      { href: "/readiness-gate", label: "Readiness Gate" },
      { href: "/strategy-library", label: "Strategy Library" },
      { href: "/agent-audit", label: "Agent Audit" },
      { href: "/simulation-runbook", label: "Simulation Runbook" },
      { href: "/self-improvement", label: "Self-Improvement" },
      { href: "/autonomous-research", label: "Autonomous Research" },
      { href: "/auto-research", label: "Parameter Search" },
      { href: "/prompt-lab", label: "Prompt Lab" },
      { href: "/agent-debate", label: "Research Committee" },
      { href: "/advisory-agents", label: "OpenClaw Bridge" },
      { href: "/agents", label: "Agent Roster" },
      { href: "/llm-agents", label: "LLM Agents" },
      { href: "/communications", label: "Communications" }
    ]
  }
];

const NAV_COLLAPSED_STORAGE_KEY = "gotrader-ai-lab-nav-collapsed";
const CONTEXT_PANEL_STORAGE_KEY = "gotrader-ai-lab-context-panel-open";

const loadStoredFlag = (key: string) => {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
};

const saveStoredFlag = (key: string, value: boolean) => {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Navigation preferences are optional and must never break the shell.
  }
};

const routeMatchesItem = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

const resolveActiveContext = (pathname: string) => {
  for (const hub of navigationHubs) {
    const item = hub.items.find((candidate) => routeMatchesItem(pathname, candidate.href));
    if (item) {
      return { hub, item };
    }
  }
  return { hub: navigationHubs[0], item: navigationHubs[0].items[0] };
};

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef<HTMLElement | null>(null);
  const [navCollapsed, setNavCollapsed] = useState(() => loadStoredFlag(NAV_COLLAPSED_STORAGE_KEY));
  const [contextOpen, setContextOpen] = useState(() => loadStoredFlag(CONTEXT_PANEL_STORAGE_KEY));

  const { hub: activeHub, item: activeItem } = resolveActiveContext(location.pathname);
  const visibleTabs = activeHub.items.filter((item) => !item.hidden);
  const showWorkspaceTabs = !activeHub.hidden && visibleTabs.length > 1;
  const showAdvancedContext = Boolean(activeHub.hidden);

  useEffect(() => {
    saveStoredFlag(NAV_COLLAPSED_STORAGE_KEY, navCollapsed);
  }, [navCollapsed]);

  useEffect(() => {
    saveStoredFlag(CONTEXT_PANEL_STORAGE_KEY, contextOpen);
  }, [contextOpen]);

  // Native capture-phase click handler keeps SPA navigation reliable even if
  // a page-level error boundary interferes with React's synthetic events.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) {
      return undefined;
    }

    const onNativeClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) {
        return;
      }

      const target = event.target instanceof Element ? event.target : undefined;
      const anchor = target?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || !nav.contains(anchor)) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/")) {
        return;
      }

      event.preventDefault();
      navigate(href);
    };

    nav.addEventListener("click", onNativeClick, { capture: true });
    return () => nav.removeEventListener("click", onNativeClick, { capture: true });
  }, [navigate]);

  const shellStyle = {
    "--app-sidebar-width": navCollapsed ? "4.5rem" : "13.5rem"
  } as CSSProperties;

  return (
    <div className="min-h-screen terminal-grid lg:h-screen lg:overflow-hidden">
      <div
        className="mx-auto min-h-screen w-full lg:grid lg:h-screen lg:grid-cols-[var(--app-sidebar-width)_minmax(0,1fr)]"
        style={shellStyle}
      >
        <aside
          data-testid="app-sidebar"
          className={cn(
            "min-w-0 border-b border-white/10 bg-black/45 backdrop-blur-2xl transition-[width] duration-200 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[var(--app-sidebar-width)] lg:flex-col lg:border-b-0 lg:border-r"
          )}
        >
          <div
            className={cn(
              "flex shrink-0 items-center justify-between gap-3 px-4 py-4",
              navCollapsed && "lg:flex-col lg:justify-start lg:px-2"
            )}
          >
            <div className={cn("flex min-w-0 items-center gap-3", navCollapsed && "lg:justify-center")}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
                <Gauge className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div className={cn("min-w-0", navCollapsed && "lg:hidden")}>
                <h1 className="truncate text-base font-semibold tracking-normal">GoTrader AI Lab</h1>
                <p className="truncate text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">Research terminal</p>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-muted-foreground transition-colors hover:bg-white/[0.10] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              onClick={() => setNavCollapsed((value) => !value)}
              aria-label={navCollapsed ? "Expand navigation" : "Collapse navigation"}
              title={navCollapsed ? "Expand navigation" : "Collapse navigation"}
              aria-pressed={navCollapsed}
            >
              {navCollapsed ? <PanelLeftOpen className="h-4 w-4" aria-hidden="true" /> : <PanelLeftClose className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>

          <nav
            ref={navRef}
            className={cn(
              "scrollbar-thin flex min-w-0 gap-1 overflow-x-auto px-3 pb-3 lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:overscroll-contain lg:pb-4",
              navCollapsed && "lg:items-center lg:px-2"
            )}
            aria-label="Primary navigation"
          >
            {navigationHubs.filter((hub) => !hub.hidden).map((hub) => {
              const hubActive = hub.id === activeHub.id;
              return (
                <Link
                  key={hub.id}
                  to={hub.items[0].href}
                  data-testid={`nav-hub-${hub.id}`}
                  className={cn(
                    "flex min-w-fit items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/[0.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99] lg:min-w-0",
                    hubActive && "border border-white/10 bg-white/[0.09] text-foreground shadow-sm",
                    navCollapsed && "lg:mx-auto lg:w-10 lg:justify-center lg:px-0"
                  )}
                  aria-label={`${hub.label} hub`}
                  aria-current={hubActive ? "page" : undefined}
                  title={navCollapsed ? hub.label : undefined}
                >
                  <hub.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className={cn("truncate", navCollapsed && "lg:hidden")}>{hub.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className={cn("hidden shrink-0 border-t border-border/70 px-4 pb-4 pt-3 lg:block", navCollapsed && "lg:hidden")}>
            <div className="premium-surface-soft rounded-2xl p-3 text-xs text-muted-foreground">
              <div className="mb-1.5 flex items-center gap-2 text-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                Research only
              </div>
              One supervised research cycle at a time. MT5 stays read-only and operator authority remains none.
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col lg:h-screen">
          <header
            data-testid="app-top-bar"
            className="z-10 shrink-0 border-b border-white/10 bg-black/35 backdrop-blur-2xl"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
              <div data-testid="app-breadcrumb" className="flex min-w-0 max-w-full items-center gap-2 text-sm">
                <span className="shrink-0 text-muted-foreground">{activeHub.label}</span>
                <span className="shrink-0 text-muted-foreground/50">/</span>
                <span className="truncate font-semibold text-foreground">{activeItem.label}</span>
              </div>
              <div className="min-w-0 flex-1" />
              {showAdvancedContext ? <button
                type="button"
                data-testid="context-panel-toggle"
                className="hidden h-8 shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/[0.10] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:inline-flex"
                onClick={() => setContextOpen((value) => !value)}
                aria-pressed={contextOpen}
                aria-label={contextOpen ? "Hide context panel" : "Show context panel"}
              >
                {contextOpen ? <PanelRightClose className="h-3.5 w-3.5" aria-hidden="true" /> : <PanelRightOpen className="h-3.5 w-3.5" aria-hidden="true" />}
                Context
              </button> : null}
            </div>
            {showWorkspaceTabs ? (
              <nav
                data-testid="workspace-tabs"
                aria-label="Workspace tabs"
                className="scrollbar-thin flex gap-1 overflow-x-auto border-t border-border/60 px-4 pb-2 pt-1.5 sm:px-6"
              >
                {visibleTabs.map((item) => {
                  const tabActive = routeMatchesItem(location.pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={cn(
                    "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/[0.07] hover:text-foreground",
                    tabActive && "border border-white/10 bg-white/[0.09] text-foreground shadow-sm"
                      )}
                      aria-current={tabActive ? "page" : undefined}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            ) : null}
          </header>

          <div className="flex min-h-0 flex-1">
            <main
              data-testid="app-main-content"
              className="scrollbar-thin min-w-0 flex-1 overflow-x-hidden px-4 py-5 sm:px-6 lg:overflow-y-auto xl:px-8"
            >
              <div className="min-w-0">{children}</div>
            </main>
            {contextOpen && showAdvancedContext ? (
              <aside
                data-testid="context-panel"
                className="scrollbar-thin hidden w-[340px] shrink-0 space-y-3 overflow-y-auto border-l border-white/10 bg-black/30 p-4 backdrop-blur-2xl xl:block"
              >
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Research context
                </p>
                <ValidationChainCard testId="context-panel-validation-chain" detailed />
                <div className="premium-surface-soft rounded-2xl px-4 py-3 text-xs leading-5 text-slate-400">
                  <p className="text-[0.65rem] uppercase tracking-[0.14em] text-slate-500">Quick links</p>
                  <div className="mt-2 flex flex-col gap-1.5">
                    <Link className="text-sky-300 underline underline-offset-2" to="/research-advisor">
                      Research Advisor
                    </Link>
                    <Link className="text-sky-300 underline underline-offset-2" to="/replay">
                      Replay validation
                    </Link>
                    <Link className="text-sky-300 underline underline-offset-2" to="/walk-forward">
                      Walk-forward validation
                    </Link>
                    <Link className="text-sky-300 underline underline-offset-2" to="/evidence-quality">
                      Evidence quality
                    </Link>
                  </div>
                </div>
              </aside>
            ) : null}
          </div>

          <footer
            data-testid="footer-safety-strip"
            className="shrink-0 border-t border-white/10 bg-black/35 px-4 py-2 backdrop-blur-2xl sm:px-6"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.7rem] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden="true" />
              <span>Research operations</span>
              <span aria-hidden="true">/</span>
              <span>MT5 read-only market-data contract</span>
              <span aria-hidden="true">/</span>
              <span>Execution authority none</span>
              <span aria-hidden="true">/</span>
              <span>Broker authority none</span>
              <span aria-hidden="true">/</span>
              <span>Readiness override none</span>
              <Badge variant="warning" className="ml-auto hidden sm:inline-flex">
                Research only
              </Badge>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
