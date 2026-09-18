# Frontend research and design rationale

## User task

A person arrives with a document they may need to sign or discuss. Their immediate questions are: What does this say? Where does the document say it? What changed? What should I ask a professional? The interface follows those questions, with direct actions for documents, comparison, matters, preparation, and general information.

## Benchmarks

- [LegalZoom Doc Assist](https://www.legalzoom.com/ai/doc-assist) presents consumer legal document help around understandable summaries and important details. We use the same clarity goal, while avoiding a visual imitation or claims that analysis is conclusive.
- [Juro AI Review responsible use](https://intercom.help/juro/en/articles/13714999-ai-review-data-protection-and-responsible-use-guide) describes a review workflow with human judgment and transparent use of AI. Our interface keeps the original PDF visible and labels interpretation separately from quoted evidence.
- [Spellbook overview](https://help.spellbook.legal/en/articles/9926203-spellbook-overview) frames AI review as assistance with drafting and review. The useful pattern is a focused task surface beside a document, rather than a general chat-first landing page.
- [VoltAgent awesome-design-md](https://github.com/VoltAgent/awesome-design-md) is a collection of product design notes. Its [Notion notes](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/notion/DESIGN.md) informed the quiet surfaces and systematic spacing; LexiGuide's tokens and layout are original.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) supplies the accessibility baseline: readable contrast, visible focus, responsive reflow, meaningful labels, and usable controls.

## Findings in the existing frontend

- The landing page used bright blue cards while core workspaces used dark gold panels. The product lacked a consistent identity.
- Several links contained buttons, creating nested interactive elements.
- Small screens showed a navigation action beside the menu and could scroll horizontally.
- Several headings and trust claims overstated what AI analysis and citations establish. The upload screen used a broad privacy claim without a visible supporting policy.
- The product had useful core workflows. These were retained; the redesign changes hierarchy, text, colour, and control markup rather than introducing a large graphics dependency.

## Applied direction

Warm paper, evergreen ink, one rust accent, editorial display type, fine rules, and a real HTML clause specimen. This gives the product a recognizable legal document context without gavels, justice imagery, glass effects, glowing gradients, or decorative 3D. The viewer retains a dark surrounding area so white PDF pages remain visually distinct. Workspaces use light reading surfaces and restrained task controls.

## Interaction and content principles

1. Start with the document and keep the source reachable.
2. Use plain actions and headings; avoid unexplained legal or AI jargon.
3. Distinguish a quotation from an AI explanation and a point for professional review.
4. Keep legal information notices near the point of use.
5. Do not claim a particular legal outcome, financial saving, perfect verification, or absolute privacy.

The concrete tokens and page patterns are in [DESIGN.md](../DESIGN.md).
