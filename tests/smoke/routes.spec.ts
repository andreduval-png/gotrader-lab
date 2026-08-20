import { expect, test, type Page } from "@playwright/test";

const primaryRoutes = [
  "/dashboard",
  "/advisor",
  "/research-advisor",
  "/market-data",
  "/autonomous-research",
  "/walk-forward",
  "/self-improvement",
  "/readiness-gate",
  "/performance",
  "/communications",
  "/settings"
];

const advancedRoutes = [
  "/research-lab",
  "/ict-lab",
  "/replay",
  "/paper-demo",
  "/backtest-lab",
  "/validation",
  "/research-quality",
  "/auto-research",
  "/research",
  "/agent-debate",
  "/agent-audit",
  "/llm-agents",
  "/evidence-quality",
  "/research-maturity",
  "/strategy-library",
  "/simulation-runbook",
  "/advisory-agents",
  "/agents",
  "/prompt-lab"
];

// Expected coverage: every non-redirect route from src/App.tsx. Operator
// routes use the four-item primary navigation; specialist routes remain
// directly reachable through Advanced Research. Excluded: "/" and "*" redirects
// and the "/agents/:id" detail route. Keep this list in sync with
// scripts/smoke-routes.mjs.
const allRoutes = [...primaryRoutes, ...advancedRoutes];
const chartRoutes = ["/research-lab", "/ict-lab", "/replay", "/backtest-lab", "/market-data"];
const sourceStatusRoutes = [
  "/research-advisor",
  "/market-data",
  "/ict-lab",
  "/backtest-lab",
  "/paper-demo",
  "/replay",
  "/walk-forward",
  "/agent-debate",
  "/self-improvement",
  "/evidence-quality",
  "/research-maturity",
  "/strategy-library"
];
const unsafeExecutionControls = [
  "Place Order",
  "Buy Market",
  "Sell Market",
  "Enable Live Trading",
  "Connect Live Broker"
];
const pageErrorsByTest = new Map<string, string[]>();
const consoleErrorsByTest = new Map<string, string[]>();
const routeHeadingTimeoutMs = 30_000;

const expectedHeadings: Record<string, RegExp> = {
  "/dashboard": /Operator Console/i,
  "/advisor": /Decision Inbox/i,
  "/research-advisor": /Research Advisor/i,
  "/research-lab": /MT5-first research cockpit/i,
  "/market-data": /Market Data/i,
  "/autonomous-research": /Autonomous Research/i,
  "/walk-forward": /Walk-Forward/i,
  "/self-improvement": /Self-Improvement/i,
  "/readiness-gate": /Readiness/i,
  "/performance": /Performance/i,
  "/communications": /Communications/i,
  "/settings": /Settings/i,
  "/ict-lab": /ICT Lab/i,
  "/replay": /Replay/i,
  "/paper-demo": /Paper-Demo Operations/i,
  "/backtest-lab": /Backtest Lab/i,
  "/validation": /Validation/i,
  "/research-quality": /Research Quality/i,
  "/auto-research": /Auto Research/i,
  "/research": /AI Research Workbench/i,
  "/agent-debate": /Agent Debate/i,
  "/agent-audit": /Agent Audit/i,
  "/llm-agents": /LLM/i,
  "/evidence-quality": /Evidence Quality/i,
  "/research-maturity": /Research Maturity/i,
  "/strategy-library": /Strategy Library/i,
  "/simulation-runbook": /Verification Runbook|Simulation verification/i,
  "/advisory-agents": /OpenClaw \/ Hermes Planning/i,
  "/agents": /Research Agents/i,
  "/prompt-lab": /Prompt Lab/i
};

test.describe("GoTrader browser route smoke", () => {
  test.beforeEach(async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        const rendered = `${message.text()} ${message.location().url ?? ""}`;
        if (!isExpectedOptionalLocalBridgeError(rendered)) {
          consoleErrors.push(rendered);
        }
      }
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    pageErrorsByTest.set(test.info().testId, pageErrors);
    consoleErrorsByTest.set(test.info().testId, consoleErrors);
  });

  test.afterEach(async () => {
    const pageErrors = pageErrorsByTest.get(test.info().testId) ?? [];
    const consoleErrors = consoleErrorsByTest.get(test.info().testId) ?? [];
    expect([...pageErrors, ...consoleErrors], "No severe browser errors should occur").toEqual([]);
  });

  for (const route of allRoutes) {
    test(`${route} loads without crashing`, async ({ page }) => {
      await gotoRoute(page, route);
      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator("main")).toContainText(expectedHeadings[route], { timeout: routeHeadingTimeoutMs });
      await expect(page.locator("vite-error-overlay,#vite-error-overlay")).toHaveCount(0);
      await expect(page.getByText(/Internal server error|\[plugin:vite|Transform failed/i)).toHaveCount(0);
      await expectNoVisibleExecutionControls(page);
    });
  }

  test("sidebar navigation works without full refresh", async ({ page }) => {
    await gotoRoute(page, "/dashboard");
    await page.evaluate(() => {
      (window as Window & { __gotraderSmokeNavigationMarker?: string }).__gotraderSmokeNavigationMarker = crypto.randomUUID();
    });
    const marker = await page.evaluate(() => (window as Window & { __gotraderSmokeNavigationMarker?: string }).__gotraderSmokeNavigationMarker);

    for (const route of ["/advisor", "/performance", "/settings", "/dashboard"]) {
      await page.locator(`nav a[href="${route}"]`).click();
      await expect(page).toHaveURL(new RegExp(`${route.replace("/", "\\/")}$`));
      await expect(page.locator("main")).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => (window as Window & { __gotraderSmokeNavigationMarker?: string }).__gotraderSmokeNavigationMarker))
        .toBe(marker);
    }
  });

  test("dashboard shows the compact operator console and guarded cycle controls", async ({ page }) => {
    await gotoRoute(page, "/dashboard");
    await expect(page.getByTestId("operator-console")).toBeVisible();
    await expect(page.getByTestId("operator-start-cycle")).toBeVisible();
    await expect(page.getByTestId("operator-market-brief")).toBeVisible();
    await expect(page.getByTestId("operator-prediction-summary")).toBeVisible();
    await expect(page.getByTestId("operator-decision-summary")).toBeVisible();
    await expect(page.getByTestId("operator-gbrain-memory-summary")).toBeVisible();
    await expect(page.getByTestId("operator-gbrain-memory-summary")).toContainText(/Stored cycles/i);
    await expect(page.getByTestId("operator-research-risk-preview")).toBeVisible();
    await expect(page.getByTestId("operator-research-risk-preview")).toContainText(/Entry price/i);
    await expect(page.getByTestId("operator-research-risk-preview")).toContainText(/Informational only/i);
    await expect(page.getByTestId("operator-target-provenance")).toBeVisible();
    await expect(page.getByTestId("operator-target-provenance")).toContainText(/Target type/i);
    await expect(page.getByTestId("operator-target-provenance")).toContainText(/Source timeframe/i);
    await expect(page.getByTestId("operator-target-provenance")).toContainText(/Distance/i);
    await expect(page.getByTestId("operator-target-provenance")).toContainText(/RR gate/i);
    const probabilityValue = page.getByTestId("operator-plan-probability-value");
    await expect(probabilityValue).toBeVisible();
    await expect(probabilityValue).toHaveText(/^(?:Unavailable · --|(?:Low|Medium|High) · \d+(?:\.\d)?%)$/);
    expect(
      await probabilityValue.evaluate((element) => element.scrollWidth <= element.clientWidth),
      "trade-plan probability must not be visually clipped"
    ).toBe(true);
    await expect(page.locator("main")).toContainText(/supervised research cycle/i);
    await expect(page.locator("main")).toContainText(/Research trades/i);
    await expect(page.locator("main")).toContainText(/Advanced Research Lab/i);
    await expect(page.locator("main")).toContainText(/authority none/i);
    await expectNoVisibleExecutionControls(page);
  });

  test("dashboard links to the canonical results workspace", async ({ page }) => {
    await gotoRoute(page, "/performance");
    await expectUpgradedResultsPage(page);

    await gotoRoute(page, "/dashboard");
    await page.locator('a[href="/performance"]').first().click();
    await expect(page).toHaveURL(/\/performance$/);
    await expectUpgradedResultsPage(page);
    await expectNoVisibleExecutionControls(page);
  });

  test("simulation runbook exposes evidence state without editable truth checkboxes", async ({ page }) => {
    await gotoRoute(page, "/simulation-runbook");
    await expect(page.getByRole("button", { name: /Refresh Evidence/i })).toBeVisible();
    await expect(page.locator("main")).toContainText(/Canonical status/i);
    await expect(page.locator("main")).toContainText(/Ledger evidence/i);
    await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);
    await expect(page.locator("main")).toContainText(/Unavailable|Verified/i);
  });

  test("Results MCP state and Backtest tab remain usable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoRoute(page, "/performance");
    await expect(page.getByTestId("performance-results-page")).toBeVisible();
    await expect(page.getByText(/GoTrader MCP (?:disconnected|blocked|Direct|TradingView)/i).first()).toBeVisible();
    await page.getByRole("tab", { name: "Backtest" }).click();
    await expect(page.getByRole("tab", { name: "Backtest" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "Statistics" })).toBeVisible();
    const viewport = await page.evaluate(() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.width + 1);
  });

  test("ICT Strategy Suite panels remain available in the advanced advisor workspace", async ({ page }) => {
    await gotoRoute(page, "/research-advisor");
    await expect(page.locator("main")).toContainText(/Research Advisor/i);
    // Advisor workspace tabs: Chat is the default tab so chat is never buried.
    await expect(page.getByTestId("advisor-workspace-tabs")).toBeVisible();
    for (const tab of ["chat", "source", "validation", "openclaw", "notes"]) {
      await expect(page.getByTestId(`advisor-tab-${tab}`)).toBeVisible();
    }
    await expect(page.getByTestId("research-advisor-chat-card")).toBeVisible();
    await expect(page.getByTestId("advisor-workspace-summary")).toBeVisible();
    await expect(page.getByTestId("advisor-strategy-library-section")).toContainText(/Strategy Library/i);
    await expect(page.getByTestId("research-advisor-chat-input")).toBeVisible();
    await expect(page.getByTestId("research-advisor-quick-actions")).toContainText(/Explain this cycle/i);
    await expect(page.getByRole("button", { name: "Activate Market" }).first()).toBeVisible();
    await expect(page.getByTestId("activate-market-progress")).toBeVisible();
    await expect(page.getByTestId("activate-market-progress")).toContainText(/Activate Market Workflow/i);
    await expect(page.locator("main")).toContainText(/Setup/i);

    await page.getByTestId("advisor-tab-source").click();
    await expect(page.getByTestId("research-advisor-source-controls")).toBeVisible();
    await expect(page.getByTestId("research-advisor-source-controls")).toContainText(/Requested GoTrader symbol/i);
    await expect(page.getByTestId("research-advisor-source-controls")).toContainText(/MT5 broker symbol/i);
    await expect(page.getByTestId("research-advisor-source-controls")).toContainText(/Primary timeframe/i);
    await expect(page.getByTestId("research-advisor-source-controls")).toContainText(/Higher-timeframe context/i);

    await page.getByTestId("advisor-tab-validation").click();
    await expect(page.locator("main")).toContainText(/Replay/i);
    await expect(page.locator("main")).toContainText(/Scorecard/i);

    await page.getByTestId("advisor-tab-openclaw").click();
    await expect(page.locator("main")).toContainText(/Packet Safety Contract/i);

    await page.getByTestId("advisor-tab-notes").click();
    await expect(page.locator("main")).toContainText(/ICT Strategy Suite|ICT Advisor is waiting/i);

    await gotoRoute(page, "/research-advisor");
    await expect(page.locator("main")).toContainText(/Research Advisor/i);
    await expect(page.locator("main")).toContainText(/Clean research workspace for Activate Market/i);
    await expect(page.locator("main")).toContainText(/MT5 Read Only/i);
    await expect(page.locator("main")).toContainText(/Research Only/i);
    await expect(page.locator("main")).toContainText(/Authority: None/i);

    await page.getByTestId("advisor-tab-source").click();
    await expect(page.getByTestId("research-advisor-source-controls")).toContainText(/MT5 Research Source/i);
    await expect(page.getByTestId("research-advisor-source-controls")).toContainText(/display\/reference only/i);
    await expect(page.getByTestId("research-advisor-source-controls")).toContainText(/Each timeframe is cached as a separate canonical MT5 read-only source key/i);

    await page.getByTestId("advisor-tab-chat").click();
    await expect(page.getByTestId("ict-current-read-panel")).toContainText(/Current Read/i);
    await expect(page.getByTestId("ict-current-read-panel")).toContainText(/Phase 1/i);
    await expect(page.getByTestId("ict-current-read-panel")).toContainText(/Phase 2/i);
    await expect(page.getByTestId("ict-current-read-panel")).toContainText(/Model lane/i);
    await expect(page.getByTestId("ict-current-read-panel")).toContainText(/Paper Sim|Paper-watchlist eligibility/i);
    await expect(page.getByTestId("ict-current-read-panel")).toContainText(/Execution Disabled|Execution/i);
    await expect(page.getByTestId("ict-current-read-panel")).toContainText(/Next action/i);
    await expect(page.getByRole("button", { name: "Activate Market" }).first()).toBeVisible();
    await expect(page.getByTestId("activate-market-progress")).toBeVisible();
    await expect(page.getByTestId("activate-market-progress")).toContainText(/Activate Market Workflow/i);
    await expect(page.getByTestId("research-advisor-chat-card")).toBeVisible();
    await expect(page.getByTestId("advisor-workspace-summary")).toBeVisible();
    await expect(page.getByTestId("research-advisor-chat-input")).toBeVisible();
    await expect(page.getByTestId("research-advisor-quick-actions")).toContainText(/Explain this cycle/i);
    await expect(page.getByTestId("research-advisor-quick-actions")).toContainText(/Why is this blocked/i);
    await expect(page.getByTestId("research-advisor-quick-actions")).toContainText(/What should I test next/i);
    await expect(page.getByTestId("research-advisor-quick-actions")).toContainText(/Suggest calibration/i);
    await expect(page.getByTestId("research-advisor-quick-actions")).toContainText(/Review self-improvement/i);
    await expect(page.getByTestId("research-advisor-quick-actions")).toContainText(/Review Paper-Demo checklist/i);
    await expect(page.getByTestId("research-advisor-quick-actions")).toContainText(/Review auto paper-demo cycle/i);
    // Chat is the default tab; heavy manual panels only mount on the Validation tab.
    await expect(page.getByTestId("ict-manual-replay-review")).toHaveCount(0);
    await expect(page.getByTestId("ict-market-scorecard")).toHaveCount(0);

    await page.getByTestId("advisor-tab-validation").click();
    await expect(page.getByTestId("advisor-manual-replay-section")).toContainText(/deferred/i);
    await expect(page.getByTestId("advisor-market-scorecard-section")).toContainText(/deferred/i);
    await expect(page.getByTestId("ict-manual-replay-review")).toHaveCount(0);
    await expect(page.getByTestId("ict-market-scorecard")).toHaveCount(0);

    await expandDeferredDetails(page, "advisor-manual-replay-section");
    await expect(page.getByTestId("ict-manual-replay-review")).toContainText(/Manual ICT Replay Review/i);
    await expect(page.getByTestId("ict-manual-replay-status")).toContainText(/idle/i);
    await expect(page.getByRole("button", { name: "Run Real Replay Review" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save Replay Report" })).toBeVisible();
    await expect(page.getByTestId("ict-monte-carlo-robustness")).toContainText(/Monte Carlo Robustness/i);
    await expect(page.getByTestId("ict-monte-carlo-status")).toContainText(/idle/i);
    await expect(page.getByTestId("ict-monte-carlo-robustness")).toContainText(/Run Replay Review first/i);
    await expect(page.getByRole("button", { name: "Run Monte Carlo Robustness" })).toBeVisible();
    await page.getByRole("button", { name: "Run Monte Carlo Robustness" }).click();
    await expect(page.getByTestId("ict-monte-carlo-status")).toContainText(/unavailable/i);
    await expect(page.getByTestId("ict-monte-carlo-robustness")).toContainText(/Run Replay Review first/i);
    await expect(page.locator("vite-error-overlay,#vite-error-overlay")).toHaveCount(0);

    await expandDeferredDetails(page, "advisor-profile-optimizer-section");
    await expect(page.getByTestId("ict-approved-profile-optimizer")).toContainText(/Optimize Approved Profile/i);
    await expect(page.getByTestId("ict-approved-profile-optimizer-status")).toContainText(/idle/i);
    await expect(page.getByRole("button", { name: "Run Profile Optimization" })).toBeVisible();

    await expandDeferredDetails(page, "advisor-market-scorecard-section");
    await expect(page.getByTestId("ict-market-scorecard")).toContainText(/ICT Market Scorecard/i);
    await expect(page.getByTestId("ict-market-scorecard-status")).toContainText(/idle/i);
    await expect(page.getByTestId("ict-market-scorecard").getByRole("button", { name: "Run Market Scorecard" })).toBeVisible();
    await expect(page.getByTestId("ict-market-scorecard").getByRole("button", { name: "Save Scorecard Report" })).toBeVisible();

    await page.getByTestId("advisor-tab-notes").click();
    await expandDeferredDetails(page, "advisor-ict-suite-section");
    await expect(page.locator("main")).toContainText(/ICT Strategy Suite|ICT Advisor is waiting/i);
    await expect(page.locator("main")).toContainText(/Strategy Calibration|ICT Advisor is waiting/i);
    await expect(page.getByTestId("ict-current-read-data-flow")).toContainText(/Current Read Data Flow/i);
    await expandDeferredDetails(page, "ict-current-read-data-flow");
    await expect(page.getByTestId("ict-current-read-data-flow")).toContainText(/Model quality lane/i);
    await expect(page.locator("main")).toContainText(/raw candles|Raw candles/i);
    await expect(page.locator("main")).not.toContainText(/\"candles\"\\s*:/i);
    await expect(page.locator("main")).not.toContainText(/accountNumber|orderId|positionId/i);
    await expandDeferredDetails(page, "advisor-saved-reports-section");
    await expect(page.getByTestId("ict-saved-research-reports")).toContainText(/Saved Research Reports/i);

    // Returning to Chat keeps chat front-and-center and unmounts manual panels.
    await page.getByTestId("advisor-tab-chat").click();
    await expect(page.getByTestId("research-advisor-chat-card")).toBeVisible();
    await expect(page.getByTestId("ict-manual-replay-review")).toHaveCount(0);

    await gotoRoute(page, "/dashboard");
    await expect(page.getByTestId("operator-market-brief")).toBeVisible();
    await expect(page.getByTestId("operator-market-brief")).toContainText(/Current market brief/i);
    await expect(page.getByRole("link", { name: /Advanced Research Lab/i })).toBeVisible();
    await gotoRoute(page, "/strategy-library");
    await expect(page.getByTestId("strategy-library-view")).toBeVisible();
    await expect(page.getByTestId("strategy-library-cmd-card")).toContainText(/CMD/i);
    await expect(page.getByTestId("strategy-library-current-intake")).toContainText(/Authority/i);
  });

  test("shared source status banner appears on key pages", async ({ page }) => {
    for (const route of sourceStatusRoutes) {
      await gotoRoute(page, route);
      const banner = page.getByTestId("source-status-banner").first();
      await expect(banner, `${route} should render the shared source status banner`).toBeVisible();
      await expect(banner).toContainText(/Authority: none/i);
      await expect
        .poll(
          async () => (await banner.textContent()) ?? "",
          { message: `${route} source banner should resolve a source status` }
        )
        .toMatch(/MT5 read-only|Imported historical|TradingView MCP|Mock\/sample data|Source unavailable/i);
    }
  });

  test("recognition-to-validation chain surfaces render with safe defaults", async ({ page }) => {
    // ICT Lab recognition cards expose a validation CTA (queue or activate-MT5).
    await gotoRoute(page, "/ict-lab");
    const ictCta = page.getByTestId("ict-recognition-cta").first();
    await expect(ictCta).toBeVisible();
    await expect(ictCta).toContainText(/Queue replay validation|Activate MT5 before validation/i);
    await expect(ictCta).toContainText(/Open Replay/i);
    await expect(page.getByTestId("validation-chain-card").first()).toBeVisible();

    // Replay page shows the validation chain status.
    await gotoRoute(page, "/replay");
    const replayChain = page.getByTestId("replay-validation-chain");
    await expect(replayChain).toBeVisible({ timeout: 30000 });
    await expect(replayChain).toContainText(/Validation chain/i);
    await expect(replayChain.getByTestId("validation-chain-status")).toBeVisible();
    await expect(replayChain).toContainText(/Authority: none/i);

    // Walk-Forward page shows the chain next action/status.
    await gotoRoute(page, "/walk-forward");
    const wfChain = page.getByTestId("walk-forward-validation-chain");
    await expect(wfChain).toBeVisible();
    await expect(wfChain.getByTestId("validation-chain-status")).toBeVisible();

    // Advisor surfaces the validation chain status card on the Validation tab.
    await gotoRoute(page, "/research-advisor");
    await page.getByTestId("advisor-tab-validation").click();
    const advisorChain = page.getByTestId("advisor-validation-chain");
    await expect(advisorChain).toBeVisible();
    await expect(advisorChain).toContainText(/Validation chain/i);
    await expect(advisorChain).toContainText(/Recognition is not evidence|Recognition only/i);

    // Dashboard keeps validation compact and links to the detailed lab.
    await gotoRoute(page, "/dashboard");
    await expect(page.getByTestId("operator-console")).toBeVisible();
    await expect(page.getByRole("link", { name: /Advanced Research Lab/i })).toBeVisible();
  });

  test("advisor provider status and OpenClaw pilot clarity surfaces render safely", async ({ page }) => {
    await seedOpenClawPilotDrafts(page);
    await gotoRoute(page, "/research-advisor");

    // Deterministic chat is labeled as local deterministic guidance on the default Chat tab.
    await expect(page.getByTestId("research-advisor-chat-mode")).toContainText(/Chat ready|Deterministic fallback|LLM online/i);
    await expect(page.getByTestId("research-advisor-chat-card")).toContainText(/Advisor context|Deterministic fallback|LLM online/i);
    const chatTranscript = page.getByTestId("research-advisor-chat-transcript");
    await expect(chatTranscript).toBeVisible();
    expect(await chatTranscript.evaluate((element) => getComputedStyle(element).overflowY)).toBe("scroll");

    // Validation-chain explanation panel: detailed rows + recognition is not evidence.
    await page.getByTestId("advisor-tab-validation").click();
    const advisorChain = page.getByTestId("advisor-validation-chain");
    await expect(advisorChain).toBeVisible();
    await expect(advisorChain.getByTestId("validation-chain-recognition-is-evidence")).toContainText(
      /Recognition is evidence: false/i
    );

    // Provider status header with mode, status chip, last checked, and authority none.
    await page.getByTestId("advisor-tab-openclaw").click();
    const providerHeader = page.getByTestId("advisor-provider-status");
    await expect(providerHeader).toBeVisible();
    await expect(providerHeader.getByTestId("advisor-provider-mode")).toBeVisible();
    await expect(providerHeader.getByTestId("advisor-provider-authority")).toContainText(/Authority: none/i);
    await expect(providerHeader.getByTestId("advisor-provider-last-checked")).toBeVisible();
    await expect(providerHeader).toContainText(/LLM Advisory \(local bridge\)|Deterministic fallback/i);

    // Status chip reports the result of the active health check without changing authority.
    const statusChip = providerHeader.getByTestId("advisor-provider-status-chip");
    await expect(statusChip).toBeVisible();
    const statusChipText = (await statusChip.innerText()).trim();
    expect(statusChipText).toMatch(/online|not checked|not configured|config missing|disabled|deterministic|stub|offline|timeout/i);

    // OpenClaw pilot card: advisory/proposal-only with auto-apply locked off.
    const pilotCard = page.getByTestId("openclaw-pilot-card");
    await expect(pilotCard).toBeVisible();
    await expect(pilotCard).toContainText(/advisory\/proposal-only/i);
    await expect(pilotCard.getByTestId("openclaw-pilot-auto-apply")).toContainText(/autoApplyAllowed: false/i);
    await expect(pilotCard).toContainText(/executionAuthority: none/i);
    await expect(pilotCard).toContainText(/readinessOverrideAuthority: none/i);
    await expect(pilotCard.getByTestId("openclaw-pilot-chain-status")).toBeVisible();
    await expect(pilotCard).toContainText(/Review CMD paper-watchlist context/i);
    await expect(pilotCard).toContainText(/autoApplyAllowed true is blocked/i);

    const proposalPanel = page.getByTestId("openclaw-proposal-intent-panel");
    await expect(proposalPanel).toBeVisible();
    await expect(proposalPanel).toContainText(/Draft only/i);
    await expect(proposalPanel.getByTestId("openclaw-pilot-safe-draft")).toContainText(/Review CMD paper-watchlist context/i);
    await expect(proposalPanel.getByTestId("openclaw-pilot-safe-draft")).toContainText(/safe draft/i);
    await expect(proposalPanel.getByTestId("openclaw-pilot-blocked-draft")).toContainText(/autoApplyAllowed true is blocked/i);
    await expect(proposalPanel.getByTestId("openclaw-pilot-draft-authority")).toContainText(/authority none/i);
    await expect(proposalPanel.getByTestId("openclaw-pilot-draft-auto-apply")).toContainText(/autoApplyAllowed false/i);
    await expect(proposalPanel).toContainText(/Queue deterministic validation/i);
    await expect(proposalPanel).not.toContainText(/applyCalibration|approveCalibrationProposal|active_calibration/i);

    await gotoRoute(page, "/self-improvement");
    const pilotDrafts = page.getByTestId("openclaw-pilot-drafts-section");
    await expect(pilotDrafts).toBeVisible();
    await expect(pilotDrafts).toContainText(/OpenClaw Pilot Drafts/i);
    await expect(pilotDrafts).toContainText(/Review CMD paper-watchlist context/i);
    await expect(pilotDrafts).toContainText(/Draft only/i);
    await expect(pilotDrafts).toContainText(/Dismiss draft/i);
    await expect(pilotDrafts).not.toContainText(/rawCandles|"candles"\s*:|accountNumber|orderId|positionId/i);

    // Dashboard remains an operator summary and never mounts the advisor chat.
    await gotoRoute(page, "/dashboard");
    await expect(page.getByTestId("operator-console")).toBeVisible();
    expect(await page.getByTestId("operator-console").locator("input, textarea").count()).toBe(0);
  });

  test("operator app shell shows four primary destinations and a static safety strip", async ({ page }) => {
    await gotoRoute(page, "/dashboard");

    for (const hub of ["overview", "decisions", "results", "settings"]) {
      await expect(page.getByTestId(`nav-hub-${hub}`)).toBeVisible();
    }
    for (const hiddenHub of ["data", "validate", "evidence", "automate", "agents"]) {
      await expect(page.getByTestId(`nav-hub-${hiddenHub}`)).toHaveCount(0);
    }

    await expect(page.getByTestId("app-breadcrumb")).toContainText(/Overview/i);
    await expect(page.getByTestId("app-breadcrumb")).toContainText(/Operator Console/i);
    await expect(page.getByTestId("workspace-tabs")).toHaveCount(0);

    const strip = page.getByTestId("footer-safety-strip");
    await expect(strip).toBeVisible();
    await expect(strip).toContainText(/Research operations/i);
    await expect(strip).toContainText(/MT5 read-only/i);
    await expect(strip).toContainText(/Execution authority none/i);
    await expect(strip).toContainText(/Broker authority none/i);
    await expect(strip).toContainText(/Readiness override none/i);
    await expect(strip).toContainText(/Research only/i);

    // Detailed context remains available on advanced routes only.
    await gotoRoute(page, "/research-lab");
    await page.getByTestId("context-panel-toggle").click();
    await expect(page.getByTestId("context-panel")).toBeVisible();
    await expect(page.getByTestId("context-panel-validation-chain")).toBeVisible();
    await expect(page.getByTestId("context-panel-validation-chain")).toContainText(/Authority: none/i);
    await page.getByTestId("context-panel-toggle").click();
    await expect(page.getByTestId("context-panel")).toHaveCount(0);

    await expectNoVisibleExecutionControls(page);
  });

  test("validate and evidence workspaces show summary strips and safe empty states", async ({ page }) => {
    await gotoRoute(page, "/replay");
    await expect(page.getByTestId("validate-workspace-summary")).toBeVisible();
    await expect(page.getByTestId("replay-empty-snapshot")).toBeVisible();

    await gotoRoute(page, "/walk-forward");
    await expect(page.getByTestId("validate-workspace-summary")).toBeVisible();
    await expect(page.getByTestId("walk-forward-empty-result")).toBeVisible();

    await gotoRoute(page, "/backtest-lab");
    await expect(page.getByTestId("validate-workspace-summary")).toBeVisible();
    await expect(page.getByTestId("backtest-validation-chain")).toBeVisible();

    await gotoRoute(page, "/evidence-quality");
    await expect(page.getByTestId("evidence-workspace-summary")).toBeVisible();

    await gotoRoute(page, "/research-maturity");
    await expect(page.getByTestId("evidence-workspace-summary")).toBeVisible();
    await expectNoVisibleExecutionControls(page);
  });

  test("key routes avoid horizontal page overflow at laptop width", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const route of ["/dashboard", "/research-advisor", "/replay", "/evidence-quality"]) {
      await gotoRoute(page, route);
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth - doc.clientWidth;
      });
      expect(overflow, `${route} should not horizontally overflow`).toBeLessThanOrEqual(8);
    }
  });

  test("chart surfaces render canvas or a safe fallback", async ({ page }) => {
    for (const route of chartRoutes) {
      await gotoRoute(page, route);
      await expectChartOrFallback(page, route);
      await expectNoVisibleExecutionControls(page);
    }
  });

  test("replay page still renders after chart-route navigation", async ({ page }) => {
    await gotoRoute(page, "/ict-lab");
    await expectChartOrFallback(page, "/ict-lab");
    await gotoRoute(page, "/replay");
    await expect(page.locator("main")).toContainText(/Replay/i);
    await expectChartOrFallback(page, "/replay");
  });

  test("multi-broker architecture status is visible and locked", async ({ page }) => {
    await gotoRoute(page, "/settings");
    await expect(page.getByText("Multi-Broker Architecture")).toBeVisible();
    await expect(page.getByText("TradingView MCP", { exact: true })).toBeVisible();
    await expect(page.getByText("TradingView MCP Evidence Bridge")).toBeVisible();
    await expect(page.getByText(/chart evidence only|analysis/i).first()).toBeVisible();
    await expect(page.getByText("Tradovate").first()).toBeVisible();
    await expect(page.getByText("MT5").first()).toBeVisible();
    await expect(page.getByText("Broker execution").first()).toBeVisible();
    await expect(page.getByText(/Live trading/i).first()).toBeVisible();
    await expect(page.getByText(/Readiness override/i).first()).toBeVisible();
  });

  test("paper-demo operations workspace renders manual workflow safely", async ({ page }) => {
    await gotoRoute(page, "/paper-demo");
    await expect(page.locator("main")).toContainText(/Paper-Demo Operations/i);
    await expect(page.getByTestId("paper-demo-tabs")).toBeVisible();
    await expect(page.getByTestId("paper-demo-tabs")).toContainText(/Overview/i);
    await expect(page.getByTestId("paper-demo-tabs")).toContainText(/Watchlist/i);
    await expect(page.getByTestId("paper-demo-tabs")).toContainText(/Auto Cycle/i);
    await expect(page.getByTestId("paper-demo-tabs")).toContainText(/Daily Checklist/i);
    await expect(page.getByTestId("paper-demo-overview")).toBeVisible();

    const paperDemoTabs = page.getByTestId("paper-demo-tabs");
    await paperDemoTabs.getByRole("button", { name: "Watchlist" }).click();
    await expect(page.getByTestId("paper-demo-watchlist")).toBeVisible();

    await paperDemoTabs.getByRole("button", { name: "Auto Cycle" }).click();
    const autoCyclePanel = page.getByTestId("paper-demo-auto-cycle-panel");
    await expect(autoCyclePanel).toBeVisible();
    await expect(autoCyclePanel).toContainText(/Auto Paper-Demo Cycle/i);
    await expect(autoCyclePanel.getByRole("button", { name: "Run cycle now" })).toBeVisible();
    await expect(autoCyclePanel.getByRole("button", { name: "Stop cycle" })).toBeVisible();

    await paperDemoTabs.getByRole("button", { name: "Daily Checklist" }).click();
    await expect(page.getByTestId("paper-demo-daily-checklist")).toBeVisible();
    await expect(page.locator("main")).toContainText(/No execution authority confirmed/i);
    await expect(page.getByTestId("footer-safety-strip")).toContainText(/Execution authority none/i);
    await expectNoVisibleExecutionControls(page);
  });
});

async function gotoRoute(page: Page, route: string) {
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
}

async function seedOpenClawPilotDrafts(page: Page) {
  await page.addInitScript(() => {
    const authority = {
      executionAuthority: "none",
      brokerAuthority: "none",
      readinessOverrideAuthority: "none"
    };
    window.localStorage.setItem(
      "gotrader.openclaw-pilot-drafts.v1",
      JSON.stringify({
        updatedAt: "2026-06-11T18:00:00.000Z",
        latestDraftId: "openclaw_pilot_draft_safe_smoke",
        latestBlockedId: "openclaw_pilot_draft_blocked_smoke",
        authority,
        drafts: [
          {
            id: "openclaw_pilot_draft_safe_smoke",
            timestamp: "2026-06-11T18:00:00.000Z",
            programVersion: "0.1.0",
            dryRunAuditId: "openclaw_pilot_dry_run_safe_smoke",
            sourceFingerprint: "mt5_read_only|MNQ|USTECH|5m|1000|first|last",
            requestedSymbol: "MNQ",
            brokerSymbol: "USTECH",
            timeframe: "5m",
            sourceProvider: "mt5_read_only",
            validationChainId: "validation_chain_smoke",
            proposalTitle: "Review CMD paper-watchlist context",
            targetSubsystem: "ICT Strategy Suite",
            candidateFamilies: ["ict_hypothesis_validation"],
            requiresReplay: true,
            requiresWalkForward: true,
            autoApplyAllowed: false,
            authority,
            validationStatus: "safe_draft",
            blockedFields: [],
            requiredValidationGates: ["Replay snapshot", "Walk-forward", "Evidence quality", "Research maturity"],
            nextAction: "Queue deterministic validation; replay and walk-forward must pass before progression.",
            compactSummary: "MNQ via USTECH on mt5_read_only: passed OpenClaw pilot dry-run validation."
          },
          {
            id: "openclaw_pilot_draft_blocked_smoke",
            timestamp: "2026-06-11T18:01:00.000Z",
            programVersion: "0.1.0",
            dryRunAuditId: "openclaw_pilot_dry_run_blocked_smoke",
            sourceFingerprint: "mt5_read_only|MNQ|USTECH|5m|1000|first|last",
            requestedSymbol: "MNQ",
            brokerSymbol: "USTECH",
            timeframe: "5m",
            sourceProvider: "mt5_read_only",
            proposalTitle: "Unsafe calibration request",
            targetSubsystem: "ICT Strategy Suite",
            candidateFamilies: ["ict_hypothesis_validation"],
            requiresReplay: true,
            requiresWalkForward: true,
            autoApplyAllowed: false,
            authority,
            validationStatus: "blocked",
            blockedReason: "autoApplyAllowed true is blocked by the OpenClaw pilot dry-run.",
            blockedFields: ["autoApply:$.selfImprovementProposalIntent.autoApplyAllowed"],
            requiredValidationGates: ["Replay snapshot", "Walk-forward", "Evidence quality", "Research maturity"],
            nextAction: "Remove blocked fields and rerun the OpenClaw pilot dry-run.",
            compactSummary: "MNQ via USTECH on mt5_read_only: blocked unsafe field."
          }
        ]
      })
    );
  });
}

async function expectChartOrFallback(page: Page, route: string) {
  const canvasCount = await page.locator("canvas").count();
  if (canvasCount > 0) {
    expect(canvasCount, `${route} should render at least one chart canvas`).toBeGreaterThan(0);
    return;
  }
  const chartAttribution = page.getByRole("link", { name: /Charting by TradingView/i });
  if (await chartAttribution.count()) {
    await expect(chartAttribution.first()).toBeVisible();
    return;
  }
  const chartApplication = page.getByRole("application");
  if (await chartApplication.count()) {
    await expect(chartApplication.first()).toBeVisible();
    return;
  }
  await expect(page.locator("main")).toContainText(
    /Chart unavailable|No candles|No chart data|preview unavailable|data unavailable|ICT Candle Map|Structure Tape|Chart input/i
  );
}

async function expectNoVisibleExecutionControls(page: Page) {
  for (const label of unsafeExecutionControls) {
    const locator = page.getByRole("button", { name: label }).or(page.getByRole("link", { name: label }));
    await expect(locator).toHaveCount(0);
  }
}

async function expectUpgradedResultsPage(page: Page) {
  const main = page.locator("main");
  await expect(page.getByTestId("performance-results-page")).toBeVisible();
  await expect(page.getByTestId("results-tabs")).toBeVisible();
  await expect(page.getByTestId("results-calendar")).toBeVisible();
  await expect(page.getByTestId("results-calendar")).toContainText(/Monthly dated outcome/i);
  await expect(main).toContainText(/Research Results/i);
  await expect(page.getByTestId("results-tab-overview")).toContainText(/Frozen research profile/i);
  await page.getByRole("tab", { name: "Backtest" }).click();
  await expect(main).toContainText(/Performance Curve/i);
  await expect(main).toContainText(/Outcome Log/i);
  await expect(main).toContainText(/authority none|in_sample/i);
  await expect(main).not.toContainText(/Simulation results cockpit/i);
  await expect(main).not.toContainText(/Monte Carlo Robustness|Run Real Replay Review|Run Market Scorecard/i);
  await expect(main).not.toContainText(/"candles"\s*:|accountNumber|orderId|positionId/i);
}

async function expandDeferredDetails(page: Page, testId: string) {
  const details = page.getByTestId(testId);
  await expect(details).toBeVisible();
  const isOpen = await details.evaluate((element) => (element as HTMLDetailsElement).open);
  if (!isOpen) {
    await details.locator("summary").click();
  }
}

function isExpectedOptionalLocalBridgeError(message: string) {
  return message.includes("127.0.0.1:8787/health") || message.includes("localhost:8787/health");
}
