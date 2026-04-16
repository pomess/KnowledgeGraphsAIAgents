# Knowledge Brain for T&T AI Barcelona

## What is it?

A chatbot inside Microsoft Teams that gives every member of T&T AI Barcelona their own AI-powered knowledge base — plus a shared department one and project-specific ones. You talk to it in natural language, and it answers based on everything the team has ever documented, decided, or learned.

Think of it as a team member who has read every document, remembers every decision, and can instantly connect dots across all your files — but scoped so people only see what they're supposed to see.

## How it works

When you message the bot, it searches across the knowledge bases you have access to, synthesizes an answer, and cites its sources. Behind the scenes, an LLM reads your raw documents (meeting notes, specs, reports, PDFs) and compiles them into a structured wiki — summarizing key points, connecting related topics, flagging contradictions, and keeping everything up to date.

The wiki is the real product. The chat is just the easiest way to access it.

## Three layers of knowledge

### 1. Personal Brain

Every member of T&T AI gets one. It lives in a folder on their OneDrive.

- **What goes in:** Your own notes, reference material, papers, anything you want to remember.
- **Who can see it:** Only you.
- **Who can edit it:** Only you (via the bot or by dropping files into the folder).
- **Example:** "What were the key takeaways from that RAG paper I read last month?" or "Summarize everything I know about knowledge graphs."

### 2. T&T AI Department Brain

One shared brain for the whole department. It lives in a folder in the T&T AI Teams channel.

- **What goes in:** Department-wide knowledge — best practices, internal standards, reusable frameworks, lessons learned from past engagements, onboarding material, tool evaluations, architecture patterns.
- **Who can see it:** Everyone in T&T AI Barcelona.
- **Who can edit it:** Maintainers only (team leads, senior engineers). Everyone else can read and query, but cannot modify the wiki or ingest new sources.
- **Example:** "What's our standard approach for deploying AI solutions?" or "What lessons did we learn from the last client engagement?"

### 3. Project Brains

One per active client engagement or internal project. Each lives in a folder in that project's Teams channel.

- **What goes in:** Project-specific knowledge — client requirements, architecture decisions, meeting notes, status updates, technical specs, deliverable summaries.
- **Who can see it:** Everyone staffed on that project.
- **Who can edit it:** Maintainers only (project leads, architects). Everyone else can query but not modify.
- **Example:** "What did the client say about the data pipeline requirements?" or "What's the current status of the model evaluation?"

## Permissions

| Action | Personal Brain | Department Brain | Project Brain |
|--------|---------------|-----------------|--------------|
| Ask questions | Owner only | All T&T AI | Project team |
| Ingest new sources | Owner only | Maintainers | Maintainers |
| Run health checks | Owner only | Maintainers | Maintainers |
| Fix detected issues | Owner only | Maintainers | Maintainers |
| Browse wiki files | Owner only | All T&T AI | Project team |

"Maintainer" is not a Teams admin role. It is a list of people configured per brain. Department and project leads decide who gets maintainer access.

Everyone can always read and ask questions. The restriction is only on who can change the compiled knowledge.

## What talking to the bot looks like

**You DM the bot:**
> **You:** What do I know about transformer fine-tuning?
>
> **Brain:** From your personal brain: You ingested a paper on fine-tuning techniques in March. Key points were [...]. You also have notes from a past project where you applied this approach.

**You @mention the bot in the T&T AI channel:**
> **You:** @Brain What's our recommended approach for building AI agents?
>
> **Brain:** From the department brain: The current recommendation is [...]. This was documented after the internal evaluation in Q1.

**You @mention the bot in a project channel:**
> **You:** @Brain Summarize the client's requirements from the kickoff meeting.
>
> **Brain:** From the project brain: The kickoff meeting established three main requirements: [...]. These were captured from the meeting notes ingested the following day.

**Cross-brain query in a DM:**
> **You:** What does the department recommend for RAG, and have I worked with it before?
>
> **Brain:** From T&T AI brain: The department standard is [...]. From your personal brain: You have certification and hands-on experience with RAG from a previous project.

## How knowledge gets in

1. **Drop a file** into the brain's folder in the Teams Files tab. The bot detects it and auto-ingests — reading the document, creating wiki pages, cross-referencing with existing knowledge.

2. **Tell the bot to ingest.** Paste text or attach a file in the chat and say "ingest this into the department brain." The bot processes it (if you're a maintainer for that brain).

3. **The bot maintains itself.** Every time new knowledge is added, the bot updates all related wiki pages, the index, and the overview. It flags contradictions, identifies gaps, and keeps cross-references current. The knowledge base gets more valuable with every document added.

## Why this matters for T&T AI

- **Onboarding.** New joiners ask the bot instead of interrupting senior people. The department brain has accumulated answers to every common question.
- **Client handoffs.** When someone rolls off a project, the project brain retains everything they knew. The next person picks up without a knowledge gap.
- **Reusability.** Lessons from one engagement feed into the department brain. The team stops solving the same problems twice.
- **Personal productivity.** Everyone builds a personal knowledge base that compounds over time — papers, certifications, project notes, all searchable and cross-referenced.

## Technical summary

| Component | Choice |
|-----------|--------|
| Platform | Microsoft Teams (bot + SharePoint/OneDrive file storage) |
| Backend | FastAPI (Python), deployed on Azure App Service |
| LLM | Azure OpenAI or equivalent (configurable per org policy) |
| Storage | Markdown files in OneDrive (personal) and SharePoint (shared) |
| Auth | Azure AD, on-behalf-of flow; permissions follow Teams channel membership |
| Wiki format | Standard markdown with YAML frontmatter and internal links |

## Data handling and privacy

All content ingested into the knowledge graphs and processed by the LLMs will be adequately anonymized and free of sensitive information. Specifically:

- **No client-confidential data** will be ingested. Source documents must be reviewed and sanitized before being added to any shared brain. Personally identifiable information (PII), protected financial data, and client proprietary material are excluded.
- **Anonymization is enforced at the ingestion boundary.** Maintainers are responsible for ensuring that documents dropped into a brain's source folder comply with Deloitte's data classification and handling policies.
- **LLM processing stays within approved infrastructure.** The LLM provider is configured to comply with organizational policy. No data is used for model training. All API calls use enterprise-grade endpoints with appropriate data processing agreements in place.
- **Access controls follow existing Teams permissions.** No new data exposure is introduced — if you cannot access a Teams channel, you cannot access that channel's brain. The system inherits and respects the organization's existing permission model.

## PoC scope

The proof of concept targets **T&T AI Barcelona only**. If successful, the model can be replicated to other departments — each gets their own department brain, and the architecture scales without code changes since every brain is just a folder with the same markdown structure.
