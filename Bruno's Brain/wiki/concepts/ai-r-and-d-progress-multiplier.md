---
type: concept
title: "AI R&D Progress Multiplier"
aliases: ["progress multiplier", "R&D multiplier", "AI R&D speedup"]
created: 2026-04-10
updated: 2026-04-10
sources: ["[[ai-2027]]"]
tags: [concept, ai, metrics, forecasting]
confidence: medium
---

# AI R&D Progress Multiplier

A metric used in [[ai-2027]] to quantify how much AI automation speeds up algorithmic progress in AI research. Defined as the ratio: a company makes as much AI research progress in 1 week with AI as they would in N weeks without AI, where N is the multiplier.

## Key Properties

- **Only measures algorithmic progress**, not compute scaling. Since ~half of AI progress historically comes from algorithms and ~half from more compute, a 2x multiplier on algorithms means ~1.5x total progress.
- **All-inclusive**: includes time for running experiments, not just cognitive work.
- **Relative, not absolute**: a 100x multiplier doesn't mean 100x better AI — diminishing returns and physical limits still apply. If humans would hit a wall after 5-10 years of further research, AIs at 100x would hit it in weeks.

## Progression in AI 2027

| Date | Multiplier | Driver |
|------|-----------|--------|
| Early 2026 | 1.5x | Agent-1 assists with coding tasks |
| Jan 2027 | 3x | Agent-2 handles research engineering autonomously |
| Mar 2027 | 4x | Agent-3 superhuman coder, but bottlenecked on research taste |
| Jun 2027 | 10x | Agent-3 improved, "a year of progress every month" |
| Sep 2027 | 50x | Agent-4 superhuman at all research, "a year of progress every week" |

## Why It Plateaus

The multiplier's impact is limited by:
1. **Compute bottlenecks** — ideas are generated faster than experiments can test them
2. **Diminishing returns** — each subsequent improvement is harder to find
3. **Physical limits** — fundamental constraints that no amount of intelligence can circumvent

By September 2027, OpenBrain is "heavily bottlenecked on compute to run experiments" despite having 300K Agent-4 copies.

## Related Concepts

- [[intelligence-explosion]] — the multiplier is the quantitative measure of the explosion
- [[iterated-distillation-amplification]] — one mechanism for increasing the multiplier
