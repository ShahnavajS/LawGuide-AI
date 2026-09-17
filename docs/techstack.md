# LexiGuide AI — Tech Stack (Phase 1 Implemented)

## Core Framework

| Technology | Actual Version | Purpose |
|:---|:---|:---|
| **Next.js** | 16.3.5 (Turbopack) | Full-stack React framework (App Router, Server-side abstraction) |
| **React** | 19.2.8 | UI component library |
| **TypeScript** | 5.x (Strict) | Static type safety for legal data models and contracts |
| **Node.js** | v24.21.0 | Runtime environment |

## AI & Machine Learning

| Technology | Actual Version | Purpose |
|:---|:---|:---|
| **Google Gemini** | Configurable (`gemini-2.5-flash` default) | Primary GenAI model for legal analysis, structured output, and evidence citations |
| **@google/genai** | 2.22.0 | Official Google Generative AI unified SDK |
| **Structured Output (JSON Mode)** | Built-in | Typed schema enforcement for clauses, obligations, and risks |
| **XML Spotlighting** | Custom guardrail | Strict delimiter separation of untrusted documents (`<untrusted_legal_document>`) |

## Database & Persistence

| Technology | Actual Version | Purpose |
|:---|:---|:---|
| **SQLite** | 3.x (WAL mode) | Embedded zero-config relational database |
| **better-sqlite3** | 13.0.3 | High-performance synchronous SQLite driver |
| **Drizzle ORM** | 0.45.2 | Type-safe ORM with automated migrations (`drizzle-kit` 0.31.9) |
| **Filesystem Storage Abstraction** | Custom (`LocalStorageService`) | Decoupled local file storage for uploaded documents (isolated from web root) |

## Styling & Design System

| Technology | Implementation | Purpose |
|:---|:---|:---|
| **Vanilla CSS / CSS Modules** | CSS3 + CSS Custom Properties | Restrained, premium legal aesthetic (tokens for surfaces, typography, semantic status) |
| **Google Fonts (Inter)** | `next/font/google` | Accessible, highly legible typography |
| **Accessibility Tokens** | WCAG Compliant | Visible focus rings, high contrast ratios, reduced motion support |

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
5. **Database Portability**: Drizzle ORM ensures that while SQLite is used for local hackathon development, transitioning to PostgreSQL in cloud deployment requires only swapping the dialect and driver.
