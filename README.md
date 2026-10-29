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

## Design system

Patients range from teenagers to grandparents booking for the whole family, so the UI is built on a small design system tuned for legibility and trust. Browse it live at **http://localhost:3000/design-system** (`npm run dev`). Every page renders the real components, each demo is shown in light and dark side by side, and the sidebar has the theme and text-size controls.

| Page | What it covers |
| --- | --- |
| Foundations | Color ramps, semantic roles, intents, typography, radius, elevation, motion, sizing, z-index, icons |
| Controls | Button, IconButton, Field, Input, Textarea, Select, Checkbox, Switch, SegmentedControl: every state |
| Surfaces & feedback | Card, Badge, Alert, Avatar, Dialog, Toast |
| Loaders | Spinner, Skeleton, ProgressBar, ToothLoader, reduced-motion behavior |
| Chat | A fully assembled conversation (new patient, "none of these times work", vague dates, family back-to-back, emergency), then bubbles, typing indicator, quick replies, slot picker, appointment card, emergency and staff notices, composer, header |

**Three token tiers** (`apps/web/src/styles/`), each referencing only the one below:

1. **Primitives** (`primitives.css`): 7 OKLCH ramps × 12 steps on one shared lightness ladder, with separately tuned light and dark ramps.
2. **Semantic** (`semantic.css`): surfaces, text, borders, six intents (brand, accent, success, warning, danger, info), focus, elevation. Each token is a `light-dark()` pair, so this is the only tier that knows about themes.
3. **Component** (`components.css`): button, input, bubble, chip, slot, composer and loader tokens, plus `data-tone` scopes that let Badge, Alert and the emergency notice share one implementation.

**How it plugs into Tailwind v4** (`theme.css`): the default palette is switched off and only semantic roles are exposed as utilities (`bg-canvas`, `text-muted`, `border-strong`, `bg-brand-solid`, `text-on-brand`). Off-system colors can't be typed. Custom variants (`hovered:`, `pressed:`, `focused:`, `is-disabled:`) match both the live state and a forced `data-state`, which is how the catalog freezes every state without duplicated CSS.

**Accessibility, built in at the token level**

- Atkinson Hyperlegible Next (designed for low-vision readers) at 17px body text. Nothing patient-facing goes below 14px.
- 44px minimum touch targets, above the WCAG 2.2 AA minimum of 24px.
- A patient-facing **text-size setting** (A / A+ / A++). Everything is in rem, so type, controls and spacing scale together.
- Light, dark and system themes, applied before first paint so there's no flash.
- Solid focus outlines, status never conveyed by color alone, and reduced-motion support (loaders always carry a text label).
- Native `<select>`, `<dialog>`, radios and checkboxes wherever possible.

**Guarded by tests** (`npm test`, run in CI):

- `apps/web/test/tokens.test.mjs` computes WCAG contrast for 95 color pairs in each theme. Every pair must reach AA, body text must reach AAA (7:1), and control borders and focus rings must reach 3:1.
- `token-usage.test.mjs` fails if a component uses a primitive, a raw color, a default-palette class or `dark:`.

**No new dependencies.** Icons are inline SVGs, fonts are self-hosted by `next/font`, and the contrast math is hand-written.
