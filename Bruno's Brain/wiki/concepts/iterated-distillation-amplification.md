---
type: concept
title: "Iterated Distillation and Amplification (IDA)"
aliases: ["IDA", "distillation and amplification"]
created: 2026-04-10
updated: 2026-04-10
sources: ["[[ai-2027]]"]
tags: [concept, ai, technical, training]
confidence: medium
---

# Iterated Distillation and Amplification (IDA)

A self-improvement technique for AI systems consisting of two alternating steps, described in [[ai-2027]] as one of the key breakthroughs enabling Agent-3's superhuman coding ability.

## The Two Steps

1. **Amplification:** Given model M0, spend orders of magnitude more compute to get higher-quality outputs — longer thinking time, many parallel copies, intense evaluation and curation. This produces an expensive but better system, Amp(M0).
2. **Distillation:** Train a new model M1 to imitate Amp(M0), achieving the same quality but faster and cheaper. M1 is now smarter than M0. Repeat.

The concept originates from Paul Christiano's 2018 proposal. Early versions had minor successes, but by early 2027 in the scenario, IDA sees "huge returns."

## Precedent: AlphaGo

AlphaGo used this exact pattern:
- **Amplification** = Monte-Carlo Tree Search + self-play
- **Distillation** = Reinforcement Learning

The result: superhuman performance in Go. In the AI 2027 scenario, Agent-3 uses IDA to achieve superhuman performance at *coding*, then at increasingly general tasks.

## Why It Works at Scale in 2027

Earlier, IDA was limited to tasks with clear answers (math, coding problems with test suites) because the amplification step requires a ground-truth signal. By 2027 in the scenario, models have become good enough at *verifying* subjective work quality that IDA can be applied to many tasks — research, writing, design.

## In Practice (AI 2027)

- The amplification step: Agent-3 thinks longer, uses tools, consults other AIs, generating labeled trajectories of research attempts.
- The distillation step: Policy-gradient RL algorithms internalize the amplified reasoning into single steps.
- The cycle repeats: what Agent-3 can conclude after extensive deliberation gets distilled into what it can think in one step, which then allows it to reach even higher conclusions with deliberation.

## Related Concepts

- [[intelligence-explosion]] — IDA is one of the mechanisms driving the explosion
- [[neuralese-recurrence]] — the other major breakthrough in the scenario
- [[ai-r-and-d-progress-multiplier]] — IDA is a major contributor to the accelerating multiplier
