# Smile Desk

An AI front-desk assistant for dental practices. It talks with patients the way a good receptionist would: it registers new patients, books, reschedules and cancels appointments, coordinates back-to-back family visits, answers insurance and payment questions, and alerts staff when something is urgent.

> 🚧 Work in progress. Sections marked _TBD_ are filled in as the build lands.

## Quick start

```bash
git clone https://github.com/FKande/smile-desk.git
cd smile-desk
cp .env.example .env        # add ANTHROPIC_API_KEY (or OPENAI_API_KEY + LLM_PROVIDER=openai)
npm install
npm run dev                 # web → http://localhost:3000, api → http://localhost:4000
```

Requires Node 20+.

## Architecture overview

```
apps/
  web/   Next.js 16 + Tailwind: chat UI (thin client)
  api/   NestJS 12: conversation engine, LLM tool calls, scheduling, data
```

_TBD: request flow diagram, tool list, data model._

## Technologies used

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Backend | Node, NestJS 12 |
| LLM | Anthropic Claude (default), OpenAI (switch with `LLM_PROVIDER`) |
| Data | _TBD_ |
| Tests | Vitest |

## Design decisions and rationale

_TBD._

## Prioritization and scope

_TBD: what's load-bearing vs nice-to-have at 10k+ conversations/day, plus risk and failure modes._

## Setup and usage

_TBD: environment variables, seed data, sample conversations to try._
