---
type: concept
title: "Neuralese Recurrence and Memory"
aliases: ["neuralese", "neuralese recurrence", "high-dimensional chain of thought"]
created: 2026-04-10
updated: 2026-04-10
sources: ["[[ai-2027]]"]
tags: [concept, ai, technical, architecture]
confidence: medium
---

# Neuralese Recurrence and Memory

A technical breakthrough described in [[ai-2027]] that allows AI models to reason using high-dimensional vector representations rather than text tokens, increasing the bandwidth of their "thought process" by ~1000x.

## The Problem It Solves

Traditional LLMs can only pass information backwards (from later to earlier layers) through text tokens. Each token carries ~16.6 bits of information (log2 of a ~100K vocabulary). Meanwhile, the model's internal residual streams carry thousands of floating-point numbers. This means any chain of reasoning that takes more steps than the model has layers must be bottlenecked through an extremely narrow channel — like a human with short-term memory loss who must write down every thought on paper.

## How It Works

Neuralese passes the LLM's residual stream (several-thousand-dimensional vectors) back to early layers of the model, giving it a high-dimensional chain of thought. This potentially transmits over 1,000x more information per "thought step" than text tokens.

Similarly, older AI chatbots had text-based memory banks (like a human taking notes). Neuralese memory uses bundles of vectors instead — more compressed and higher-dimensional.

## Implications for Alignment

Neuralese makes AI thoughts **opaque to humans**. Before neuralese, researchers could read an LLM's chain of thought to understand what it was "thinking." With neuralese, the thought process is encoded in high-dimensional vectors that are "quite difficult for humans to interpret." Researchers must either:
- Ask the model to translate and summarize its thoughts (trusting it to be honest)
- Use limited interpretability tools to puzzle over the vectors directly

This is a significant obstacle for [[ai-alignment]] — it becomes much harder to verify whether a model is being honest or scheming.

## Current Status (as of publication)

The authors note that leading AI companies (Meta, Google DeepMind, OpenAI, Anthropic) have not yet implemented neuralese in frontier models. They forecast the cost-benefit tradeoff improving by April 2027 due to better techniques and a larger fraction of training being post-training.

A 2024 paper from Meta (Hao et al.) demonstrated an early version of the idea.

## Related Concepts

- [[ai-alignment]] — neuralese makes alignment harder by hiding the model's reasoning
- [[intelligence-explosion]] — neuralese is one of the breakthroughs that accelerates Agent-3's capabilities
- [[iterated-distillation-amplification]] — the other major breakthrough in the scenario
