# HubSpot CRM integration plan

Scope: **prospects and customers (adults at institutions) only.** No student data, assessment data or student names ever enter HubSpot.

## 1. Data model

| HubSpot object | Use | Key custom properties |
|---|---|---|
| Contact | Teacher, head of department, school leader, tutoring-centre owner | `organisation_type`, `role_group`, `student_count_band`, `demo_message`, `marketing_consent`, `lead_source`, `utm_*` |
| Company | School, tutoring centre, network | `org_type` (primary / secondary / tutoring / network), `student_count`, `country`, `curriculum`, `data_region`, `studypatch_tenant_id` (post-signup) |
| Deal | One per opportunity, 3 pipelines (below) | `pilot_start`, `pilot_end`, `licence_students`, `dpa_status`, `sso_required` |
| Ticket | Onboarding tasks and support | `onboarding_stage` |

## 2. Pipelines

**School prospects:** New request → Qualified (size, curriculum, decision maker) → Demo scheduled → Demo held → Pilot proposed → Pilot running → Contract & DPA → Closed won / lost.

**Tutoring-centre leads:** New lead → Contacted → Demo → Trial (≤30 learners, 4 weeks) → Offer → Closed won / lost. Shorter cycle, card-payment path.

**Institutional onboarding (post-win):** Kick-off → DPA signed → SSO/rostering configured → Curriculum & skill map imported → Teacher training → First assessment run → 30-day review → Steady state.

## 3. Workflows

1. **Demo request intake** (trigger: Demo-request form submitted)
   - Dedupe on email, associate/create Company by domain.
   - Set lifecycle to *Lead*, `lead_status = New`; set org-type-based pipeline (school vs tutoring) and create Deal.
   - Round-robin owner by region/org type. Internal Slack/email notification and a task: *respond within 1 business day*.
   - Send confirmation email (plain, no tracking pixels to non-consenting contacts) with calendar link.
   - If no meeting booked in 3 days → reminder email; at 7 days → task to call.
2. **Lead qualification:** scoring on org size, role group, curriculum fit, timeline. Score ≥ threshold → MQL → Sales Qualified when a meeting is booked. Disqualify reasons required.
3. **Demo follow-up:** after meeting outcome *Held*, send recap with the prototype link and a one-page safeguards summary; create *Pilot proposal* task.
4. **Nurture (consent only):** educator-benefit content, safeguard explainers, case-study invitations. Honour unsubscribe and region-specific consent rules (GDPR double opt-in where required).
5. **Onboarding:** Deal closed-won → create Ticket pipeline and tasks (DPA, SSO, roster, training), assign Customer Success, send welcome sequence to the school admin contact. Each stage completion updates `onboarding_stage`.
6. **Renewal & health:** 90 days before term end, create renewal Deal and task. Product-health properties (below) feed a simple red/amber/green company property.

## 4. Website and product touchpoints

- **Demo form** (`index.html#request`): posts to the HubSpot Forms API v3 when `portalId` and `formGuid` are set in `assets/config.js`. Includes a consent statement, a separate optional marketing opt-in, honeypot spam field, and hidden `utm` capture (add before launch). Student information is explicitly discouraged in the free-text field; a workflow flags submissions containing likely personal data patterns for review.
- **Tracking:** HubSpot tracking script loaded only after cookie consent (not included in the prototype).
- **Product → HubSpot (server-side, optional):** a nightly Lambda writes **account-level aggregates only** to the Company record: active teachers, active students (count), assessments run in the last 30 days, % AI drafts approved, last activity date. No names, no student-level data.

## 5. Reporting

Pipeline conversion by org type, speed-to-lead, demo-to-pilot, pilot-to-paid, onboarding time-to-first-assessment, and activation (first assessment within 14 days of kick-off).

## 6. Governance

Private-app token with minimal scopes stored in Secrets Manager; HubSpot data region aligned to customer region; retention rules for lost prospects (delete or anonymise after 24 months); subject-request process documented; HubSpot listed as a sub-processor for prospect data only.

## 7. Implementation checklist

1. Create custom properties and the three pipelines.
2. Build the Demo-request form (fields match `assets/site.js` payload: `firstname, lastname, email, company, jobtitle, organisation_type, student_count_band, demo_message`).
3. Add the form GUID and portal id to `assets/config.js`.
4. Build workflows 1 to 3, test with internal contacts, then enable 4 to 6.
5. Configure the nightly aggregate sync after the production API exists.
