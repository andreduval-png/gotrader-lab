import type { EdgeStatistics } from "@/lib/statistics/edgeStatistics";

export interface EdgeAuditorReview {
  agentId: "edge-auditor-agent";
  name: "Edge Auditor";
  verdict: "insufficient_sample" | "overfit_risk" | "weak_edge" | "positive_edge";
  overfitFlags: string[];
  summary: string;
  confidence: number;
  source: "deterministic" | "llm";
}

export function reviewEdgeStatistics(edge?: EdgeStatistics, walkForwardPassed?: boolean): EdgeAuditorReview {
  const flags: string[] = [];
  if (!edge || edge.sampleSize === 0) {
    return {
      agentId: "edge-auditor-agent",
      name: "Edge Auditor",
      verdict: "insufficient_sample",
      overfitFlags: ["no_trades"],
      summary: "No realized trades available; edge cannot be audited.",
      confidence: 0.95,
      source: "deterministic"
    };
  }

  if (edge.sampleSize < edge.minimumSampleSize) {
    flags.push("below_minimum_sample");
  }
  if (edge.meanR > 0 && edge.expectancyLower95 <= 0) {
    flags.push("positive_mean_negative_ci_lower_bound");
  }
  if (!walkForwardPassed) {
    flags.push("walk_forward_not_passed");
  }
  if (edge.winRate > 0.72 && edge.sampleSize < edge.minimumSampleSize * 2) {
    flags.push("high_win_rate_small_sample");
  }

  const verdict =
    edge.verdict === "insufficient_sample"
      ? "insufficient_sample"
      : flags.includes("positive_mean_negative_ci_lower_bound") || flags.includes("walk_forward_not_passed")
        ? "overfit_risk"
        : edge.verdict === "positive_edge"
          ? "positive_edge"
          : edge.verdict === "weak_edge"
            ? "weak_edge"
            : "overfit_risk";

  return {
    agentId: "edge-auditor-agent",
    name: "Edge Auditor",
    verdict,
    overfitFlags: flags,
    summary:
      verdict === "positive_edge"
        ? edge.summary
        : flags.length
          ? `Edge audit flagged: ${flags.map((flag) => flag.replace(/_/g, " ")).join(", ")}. ${edge.summary}`
          : edge.summary,
    confidence: verdict === "positive_edge" ? 0.82 : 0.68,
    source: "deterministic"
  };
}
