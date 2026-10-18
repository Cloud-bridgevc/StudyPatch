# Educational safeguards

## Principles and how the prototype shows them

| Safeguard | Implementation |
|---|---|
| Teachers review before assigning | AI practice is created as `draft`. Only **Approve & assign** (requires a "reviewed" confirmation, at least one question and one student) makes it visible to students. Students' API surface only lists `approved` sets targeted at them. Approved sets can be withdrawn. |
| AI content is labelled | "AI-generated" badge on drafts, question bank rows, review screens, and on the student practice page with reviewer and date. |
| Educator controls | Edit question text, remove questions, regenerate, choose recipients, add a note, reject with a reason. Assessment limits: min/max questions, difficulty range, start level, per-skill cap, follow-up on/off, student summary on/off. Only approved questions are ever used in assessments. |
| No unsupported diagnoses | Output describes *evidence on skills* ("Secure / Developing / Needs practice / Not enough evidence"). Response patterns use hedged language ("responses are consistent with…"), single observations are marked tentative, and every progress view states it is not a measure of ability or a diagnosis. Trend arrows require at least 2 questions in both assessments. |
| Strengths first, encouraging tone | Student summary leads with strengths; wrong answers get "Not quite, and that's okay" plus an explanation. |
| Fictional data | All students, staff, scores and dates in the prototype are invented. Banner and footer say so. |
| Least privilege | Teachers: own classes only. Students: own results only. Admins: aggregates only, small cells (<5) hidden. |
| Data minimisation | Name + pseudonymous ID only; exports use pseudonymous IDs; names never sent to the AI model. |
| Auditability | Audit log of approvals, rejections, generation, role changes, policy changes, exports. |

## Language guidelines (for UI copy and prompts)

- Say "responses on these questions suggest…", not "the student has / is / can't".
- Never use labels such as "weak", "low ability", "slow", "struggling", or any reference to learning disabilities, dyslexia, ADHD, etc. Direct any such concern to the school's specialist process.
- Describe skills, not people: "Fraction operations: needs practice".
- Keep the educator in the loop: every recommendation is a suggestion.

## Review checklist for generated content

1. Mathematically correct (exactly one right answer).
2. Appropriate reading level and context; no sensitive or culturally narrow scenarios.
3. Hints scaffold rather than give the answer away; explanations are correct and kind.
4. Distractor tags match the reasoning they claim to reveal.
5. No personal data, no ability judgements.

## Test plan (suggested)

- Unit: engine limits (never exceeds max questions or difficulty range, never serves unapproved questions), label thresholds, trend rules.
- Authorisation: student cannot read another student's attempts; teacher cannot read other classes; admin cannot read responses (also at DB level with RLS tests).
- Content: 100% of AI-generated items fail closed if validation fails; fuzz prompts with injection strings in teacher-entered text.
- Accessibility: keyboard-only walk-through, screen-reader labels for heat map and charts, contrast, reduced motion.
- Pilot: teachers rate usefulness and accuracy of drafts; track edit and rejection rates as a quality signal.
