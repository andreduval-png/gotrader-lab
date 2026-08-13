# GoTrader V2 Phase 0 Strategy Manifest

## Purpose

The machine source of truth is `src/lib/v2Baseline/strategyBaselineManifest.ts`. It derives catalog metadata from the existing Strategy Library and supplements only migration metadata and legacy engines that are outside that registry. It does not alter detector behavior.

The term **golden** applies to preserved output fixtures, not to every strategy. Manifest classes mean:

- `positive_canary`: known strong behavior whose identity and outputs must be protected.
- `negative_control`: known weak or degraded independent behavior that must remain blocked.
- `behavioral_fixture`: deterministic behavior to preserve without claiming profitability.
- `placeholder`: catalog-only definition that cannot emit a candidate or evidence.
- `diagnostic`: context-only output with no trade geometry or evidence authority.
- `experimental`: forward candidate that has not earned migration authority.

## Inventory

| Strategy ID | Classification | Detector status | Profile | Current status |
|---|---|---|---|---|
| `silver_bullet_v1` | behavioral_fixture | executable_research | v1 | replay_required |
| `silver_bullet_v2_refined_research` | behavioral_fixture | executable_research | v2 | replay_required |
| `camerons_model_research_v1` | placeholder | placeholder | v1 | research_only |
| `ifvg_v1` | behavioral_fixture | executable_research | v1 | replay_required |
| `ifvg_filtered_v2_research` | negative_control | executable_research | v2 | replay_required |
| `ifvg_fresh_retest_v3_research` | positive_canary | executable_research | v3 | evidence_building |
| `ifvg_fresh_retest_v4_candidate` | experimental | experimental | v4 | evidence_building |
| `turtle_soup_v1` | behavioral_fixture | executable_research | v1 | replay_required |
| `crt_research_v1` | placeholder | placeholder | v1 | research_only |
| `ote_research_v1` | placeholder | placeholder | v1 | research_only |
| `cisd_v1` | behavioral_fixture | executable_research | v1 | replay_required |
| `amd_power_of_three_research_v1` | placeholder | placeholder | v1 | research_only |
| `ict_cmd_short_paper_watchlist_v1` | behavioral_fixture | placeholder | v1 | replay_required |
| `cmd_high_displacement_v2_research` | experimental | experimental | v2 | replay_required |
| `grinch_reversal_expansion_confirmation_v1` | behavioral_fixture | placeholder | v1 | replay_required |
| `grinch_model_1_research_v1` | behavioral_fixture | placeholder | v1 | research_only |
| `grinch_consolidation_research_v1` | behavioral_fixture | placeholder | v1 | research_only |
| `pd_array_setup_research_v1` | placeholder | placeholder | v1 | research_only |
| `scalp_setup_research_v1` | placeholder | placeholder | v1 | research_only |
| `nasdaq_london_raid_ny_reversal_v1` | behavioral_fixture | executable_research | v1 | replay_required |
| `nasdaq_london_raid_ny_reversal_v2_filtered_research` | behavioral_fixture | executable_research | v2 | replay_required |
| `market_map_only_diagnostic_v1` | diagnostic | diagnostic | v1 | retired |
| `ict-bread-and-butter-buy` | behavioral_fixture | executable_research | phase2_v1 | research_only |
| `ict-bread-and-butter-sell` | behavioral_fixture | executable_research | phase2_v1 | research_only |
| `ict-one-shot-one-kill` | behavioral_fixture | executable_research | phase2_v1 | research_only |
| `ict-order-block-taxonomy` | diagnostic | diagnostic | phase2_v1 | research_only |
| `universal_recognition_service` | diagnostic | diagnostic | v1 | research_only |

All entries carry `executionAuthority: none`, `brokerAuthority: none`, and `readinessOverrideAuthority: none`.

## Fixture coverage

Phase 0 stores compact normalized output snapshots for IFVG v3, IFVG v2, and the complete behavior catalog. Other families are protected by the deterministic commands referenced in the manifest. Their `baselineFixtureIds` identify the expected fixture class; they do not imply that a serialized profitability fixture exists. Missing trustworthy serialized behavior is explicitly a blocked baseline, not a fabricated expectation.
