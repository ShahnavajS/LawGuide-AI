# LexiGuide AI — Tech Stack (Phase 1 record)

## 2026-09-17 audit corrections

**2026-09-18 implementation update:** See [implementation-status.md](./implementation-status.md). The app now uses a system font, has a private-workspace proxy, and Compose maps host 3000 to container 8080. The historical bullets below describe the pre-fix audit.

This is a historical stack record. The current code review is [review-findings.md](./review-findings.md), and the independent design baseline is [independent-research.md](./independent-research.md).

- Development used Node 24.21.0; the Dockerfile uses Node 22.
- Gemini structured responses are prompted as JSON, parsed, and cast to a TypeScript type. There is no runtime output-schema enforcement.
- XML document delimiters are a prompt instruction, not a security boundary.
- SQLite uses WAL in local development and DELETE journal by default in production.
- The accessibility styles do not establish WCAG conformance; modal focus behavior needs repair.
- Moving from SQLite to PostgreSQL requires schema and migration work and regression testing, not only a driver swap.
- Dockerfile listens on 8080; Compose currently maps and checks container port 3000.

## Core Framework

| Technology | Actual Version | Purpose |
|:---|:---|:---|
| **Next.js** | 16.3.5 (Turbopack) | Full-stack React framework (App Router, Server-side abstraction) |
| **React** | 19.2.8 | UI component library |
| **TypeScript** | 5.x (Strict) | Static type safety for legal data models and contracts |
| **Node.js** | v24.21.0 locally, v22 in Dockerfile | Runtime environment |

## AI & Machine Learning

| Technology | Actual Version | Purpose |
|:---|:---|:---|
| **Google Gemini** | Configurable (`gemini-2.5-flash` default) | Primary GenAI model for legal analysis, structured output, and evidence citations |
| **@google/genai** | 2.22.0 | Official Google Generative AI unified SDK |
| **Structured Output** | Prompted JSON plus JSON.parse | TypeScript cast only; runtime schema validation is pending |
| **XML Spotlighting** | Prompt-only guardrail | Marks document text as untrusted for the model; not an enforceable security boundary |

## Database & Persistence

| Technology | Actual Version | Purpose |
|:---|:---|:---|
| **SQLite** | 3.x (WAL locally; DELETE journal in production by default) | Embedded relational database |
| **better-sqlite3** | 13.0.3 | High-performance synchronous SQLite driver |
| **Drizzle ORM** | 0.45.2 | Type-safe ORM with automated migrations (`drizzle-kit` 0.31.9) |
| **Filesystem Storage Abstraction** | Custom (`LocalStorageService`) | Decoupled local file storage for uploaded documents (isolated from web root) |

## Styling & Design System

| Technology | Implementation | Purpose |
|:---|:---|:---|
| **Vanilla CSS / CSS Modules** | CSS3 + CSS Custom Properties | Restrained, premium legal aesthetic (tokens for surfaces, typography, semantic status) |
| **System font stack** | Local OS fonts | No build-time font download or remote dependency |
| **Accessibility Tokens** | Present; WCAG conformance unverified | Visible focus rings and reduced-motion styles; modal focus needs repair |

## Testing & Quality

| Technology | Actual Version | Purpose |
|:---|:---|:---|
| **Vitest** | 5.0.1 | Unit and integration testing |
| **ESLint** | 9.x (`eslint-config-next` 16.3.5) | Static code quality and Next.js best practices |
| **TypeScript Compiler** | 5.x (`tsc --noEmit`) | Strict type checking script |

---

## Technical Decisions & Phase 0 Evolutions

1. **Next.js Version**: Phase 0 suggested Next.js 15.x. The current stable release bootstrapped is Next.js 16.3.5 with React 19.2.8 and Turbopack compiler.
2. **Gemini SDK Package**: Verified official current SDK is `@google/genai` (v2.22.0), superseding legacy `@google/generative-ai`.
3. **Gemini Model Configuration**: Model selection is decoupled via `GEMINI_MODEL` environment variable, defaulting to `gemini-2.5-flash` with support for `gemini-2.0-flash` and `gemini-2.5-pro`.
4. **Node 24 Compatibility**: Dependencies were aligned to `@types/node` 24.x to ensure harmonious peer-dependency resolution with Vitest 5.
5. **Database Portability**: A move to PostgreSQL requires schema, migrations, and behavior tests; it is not only a driver swap.
