# LexiGuide visual system

LexiGuide is a reading and preparation tool for people facing unfamiliar legal documents. The interface should feel like a calm, well-edited desk: clear hierarchy, generous margins, visible source material, and restrained colour. It must never imply that AI output is legal advice or that a citation proves an interpretation.

## Research

- [Notion's design notes in awesome-design-md](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/notion/DESIGN.md) reinforced the value of quiet surfaces, readable density, and consistent spacing. This is inspiration, not a copied brand system.
- [LegalZoom Doc Assist](https://www.legalzoom.com/ai/doc-assist) demonstrates the consumer need to explain documents in everyday language and surface important details.
- [Juro's responsible AI review guide](https://intercom.help/juro/en/articles/13714999-ai-review-data-protection-and-responsible-use-guide) highlights human review and transparent processing as product requirements.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) informs focus visibility, contrast, responsive reflow, and target sizes.

## Visual language

- Paper: warm off-white `#f5f2eb`; content surface `#fffdf9`; subdued surface `#ebe7dd`.
- Ink: deep green-black `#1c302d`; body `#34423f`; secondary `#5e6b66`.
- Action: evergreen `#24584d`; hover `#17463c`; accent rust `#a6563c` for editorial details and review cues.
- Type: system sans for controls and dense information; Georgia for short display headings and document excerpts.
- Shape: fine rules, flat panels, modest 3–8px radii. A document can have a subtle physical shadow. Avoid glass, neon, animated gradients, and decorative AI imagery.
- Motion: only short state transitions; respect reduced motion.

## Page patterns

- Public page: asymmetric editorial hero with a real HTML document explanation specimen, then concise capability and trust sections.
- Workspaces: a clear title and purpose, source first, task controls nearby, evidence status legible in words and colour.
- Narrow viewports: single column content; all controls remain reachable without horizontal page scrolling.
- Information labels distinguish quoted source, AI explanation, and professional review. Examples are labelled as illustrations.

## Content and accessibility

- State capabilities precisely. Avoid guarantees such as “every claim verified,” unsupported privacy promises, fake metrics, and claimed savings.
- Place the legal information notice where a person starts analysis and near interpretations.
- Use direct actions: “Upload document,” “Compare versions,” “Prepare questions.”
- Keyboard focus is visible, navigation is semantic, and links are never wrapped around buttons.
- Text contrast targets WCAG AA. Every form control has a visible label; errors use text and `role="alert"`.
- Verify 320px, 768px, and desktop widths, and reduced motion.
