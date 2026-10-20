# StudyPatch

Website: studypatch.site. AI-native learning diagnostics and personalised practice for schools and tutoring centres. This repository holds:

| Path | What it is |
|---|---|
| `index.html`, `assets/` | Public website: product, sample maths assessment, use cases, safeguards, pricing, demo-request form, FAQ |
| `app/` | **Interactive prototype** (teacher, student, administrator). Vanilla JS, no build step |
| `docs/architecture.md` | AWS design: Bedrock, PostgreSQL, S3, Lambda, encryption, access control, retention |
| `docs/hubspot-plan.md` | CRM objects, pipelines, workflows, form integration |
| `docs/safeguards.md` | Educational safeguards, language guidelines, test plan |
| `db/schema.sql` | PostgreSQL schema with row-level security (verified to load on a local PostgreSQL) |
| `lambda/` | Python Lambdas: `process_assessment` and `generate_practice` (Bedrock) |

## Run it

```bash
python3 -m http.server 8765
```

Open <http://localhost:8765/> for the website and <http://localhost:8765/app/> for the prototype.

## Prototype tour

- **Demo as** (top bar) switches between Teacher, Student (pick a fictional student) and Administrator. Reset demo data restores the seed.
- **Student:** open *Algebra readiness check* → answer the adaptive questions → see the strengths-first summary. Open *Practice* to try approved, AI-labelled practice.
- **Teacher:** *Dashboard* (assistant summaries) → *Class reports* (heat map, response patterns, **Draft practice**) → *Review queue* (edit, approve, reject) → *Assessments → New* (set limits, preview adaptive paths) → *Question bank* (generate / approve) → *Skills & objectives* (skill map).
- **Administrator:** aggregate-only overview, users & roles, retention & AI policy (with retention preview), audit log, permissions matrix.

## What is real and what is simulated

Real in the prototype: adaptive selection within teacher limits, skill-evidence scoring, misconception tagging, class/individual analytics, review-and-approve workflow, role-based views, audit log, retention preview.

Simulated: AI generation (deterministic templates that produce the same schema Bedrock would, with computed answers), authentication (role switch), persistence (browser `localStorage`), email/HubSpot submission (off until `assets/config.js` is filled in). Pricing on the website is illustrative.

All people, classes and results are fictional. No legal review has been done; see the notes in `docs/architecture.md`.
