/* Administrator experience: aggregate-only school overview, users & roles, data/AI policy, audit, permissions. */
(function () {
  const SP = window.SP, U = SP.ui, esc = U.esc, V = U.V;
  const Ad = SP.views.admin, A = SP.actions, C = SP.changes;
  const D = () => U.D();
  const opt = (v, l, sel) => `<option value="${esc(v)}" ${String(sel) === String(v) ? 'selected' : ''}>${esc(l)}</option>`;

  Ad.overview = function () {
    const d = D(), min = d.settings.minCell, active = d.students.filter(s => s.active);
    const dist = SP.analytics.classDistribution(d, active.map(s => s.id));
    const ai = d.practiceSets, approved = ai.filter(p => p.status === 'approved').length, rejected = ai.filter(p => p.status === 'rejected').length;
    return `${U.pageHead('School overview', 'Aggregate information only. Administrators manage the platform but do not see individual students’ answers.')}
    <div class="kpis"><div class="kpi"><b>${active.length}</b><span>active students</span></div><div class="kpi"><b>${d.classes.length}</b><span>classes</span></div><div class="kpi"><b>${d.attempts.length}</b><span>assessments completed</span></div><div class="kpi"><b>${approved}/${ai.length}</b><span>AI practice sets approved by teachers</span></div></div>
    <div class="grid2"><section class="card"><h2>Skill evidence across the school</h2>${SP.skills.map(s => `<div class="skillrow"><span>${esc(s.name)}</span>${dist[s.id].total >= min ? U.stackBar(dist[s.id]) : '<span class="hint">Hidden: fewer than ' + min + ' students</span>'}</div>`).join('')}${U.stackLegend()}
      <p class="hint">Small-number suppression: groups under ${min} are hidden to protect individuals.</p></section>
    <section class="card"><h2>Human oversight of AI</h2><ul class="plain"><li>${approved} approved · ${rejected} rejected · ${ai.length - approved - rejected} awaiting review</li><li>AI question drafts: ${d.bank.filter(q => q.source === 'ai').length} (${d.bank.filter(q => q.source === 'ai' && q.status === 'approved').length} approved)</li><li>Teacher approval before student access: <span class="badge badge-ok">Always on · locked</span></li></ul>
      <h3>Data held</h3><p class="hint">Display name, pseudonymous ID, class, assessment responses, practice responses. <strong>Not collected:</strong> date of birth, contact details, address, health or special-needs information, photos, free-text student input to AI.</p></section></div>`;
  };

  Ad.users = function () {
    const d = D();
    return `${U.pageHead('Users & roles', 'Staff accounts are created through your identity provider (SSO) and assigned a role. Students are managed by teachers.')}
    <div class="card"><div class="tablewrap"><table><thead><tr><th>Name</th><th>Role</th><th>MFA</th><th>Classes</th><th>Status</th></tr></thead><tbody>
    ${d.users.map(u => `<tr><td>${esc(u.name)}<br><span class="hint">${esc(u.email)}</span></td><td><select aria-label="Role for ${esc(u.name)}" data-change="roleU" data-id="${u.id}">${opt('teacher', 'Teacher', u.role)}${opt('admin', 'Administrator', u.role)}</select></td><td>${u.mfa ? '<span class="badge badge-ok">Enabled</span>' : '<span class="badge badge-warn">Not set</span>'}</td><td>${u.classes.length}</td><td><button class="btn btn-sm ${u.status === 'active' ? 'btn-secondary' : 'btn-primary'}" data-act="toggleU" data-id="${u.id}">${u.status === 'active' ? 'Deactivate' : 'Reactivate'}</button> <span class="badge ${u.status === 'active' ? 'badge-ok' : 'badge-muted'}">${u.status}</span></td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="card"><h2>Invite staff</h2><form class="inline-form" data-submit="invite"><div><label for="ie">Work email</label><input id="ie" name="email" type="email" required></div><div><label for="ir">Role</label><select id="ir" name="role">${opt('teacher', 'Teacher', 'teacher')}${opt('admin', 'Administrator', 'teacher')}</select></div><button class="btn btn-primary">Send invite</button></form><p class="hint">Prototype: no email is sent. Production: invites go through Cognito with SSO and enforced MFA.</p></div>`;
  };
  C.roleU = el => { const u = D().users.find(x => x.id === el.dataset.id); u.role = el.value; U.log('Role changed', `${u.name} → ${el.value}`); U.rerender(); };
  A.toggleU = el => { const u = D().users.find(x => x.id === el.dataset.id); u.status = u.status === 'active' ? 'inactive' : 'active'; U.log('User status changed', `${u.name}: ${u.status}`); U.rerender(); };
  SP.submits.invite = (f, fd) => { const e = String(fd.get('email')).trim(); D().users.push({ id: 'U' + Date.now(), name: e.split('@')[0], role: fd.get('role'), email: e, status: 'active', mfa: false, classes: [] }); U.log('Staff invited', e); U.rerender(); U.toast('Invite recorded (prototype: no email sent)'); };

  Ad.policy = function () {
    const d = D(), s = d.settings, months = n => { const x = new Date(SP.today + 'T12:00:00'); x.setMonth(x.getMonth() - n); return x.toISOString().slice(0, 10); };
    const a = d.attempts.filter(t => t.date < months(s.retentionAssessmentMonths)).length, pr = d.attempts.filter(t => t.date < months(s.pseudonymiseAfterMonths)).length;
    const sel = (key, vals, suffix) => `<select data-change="setPol" data-key="${key}" aria-label="${key}">${vals.map(v => opt(v, v + ' ' + suffix, s[key])).join('')}</select>`;
    return `${U.pageHead('Data & AI policy', 'Retention, minimisation and AI guardrails for your school. Changes are written to the audit log.')}
    <div class="grid2"><section class="card"><h2>Retention</h2>
      <div class="field"><label>Assessment responses kept for</label>${sel('retentionAssessmentMonths', [12, 24, 36], 'months')}</div>
      <div class="field"><label>Practice responses kept for</label>${sel('retentionPracticeMonths', [6, 12, 24], 'months')}</div>
      <div class="field"><label>Replace names with pseudonyms after</label>${sel('pseudonymiseAfterMonths', [6, 12, 24], 'months')}</div>
      <div class="field"><label>Delete records after a student leaves</label>${sel('deleteOnLeavingDays', [30, 90, 180], 'days')}</div>
      <div class="field"><label>Audit log kept for</label>${sel('retentionAuditMonths', [12, 36, 60], 'months')}</div>
      <div class="callout">Retention preview as of ${U.fmtDate(SP.today)}: <strong>${a}</strong> assessment attempts would be deleted and <strong>${pr}</strong> would have names removed. Jobs run nightly via EventBridge → Lambda.</div></section>
    <section class="card"><h2>AI guardrails</h2>
      <label class="check"><input type="checkbox" checked disabled> Teacher approval required before students see AI content <span class="badge badge-ok">locked</span></label>
      <label class="check"><input type="checkbox" checked disabled> Student names and answers never sent to the AI model <span class="badge badge-ok">locked</span></label>
      <label class="check"><input type="checkbox" checked disabled> Students cannot type free text to the AI <span class="badge badge-ok">locked</span></label>
      <label class="check"><input type="checkbox" ${s.studentHints ? 'checked' : ''} data-change="setHints"> Allow students to reveal hints in practice</label>
      <div class="field"><label for="cap">Daily AI generation cap (items per school)</label><input id="cap" type="number" min="10" max="500" value="${s.dailyGenCap}" data-change="setCap"> <span class="hint">${d.genCount || 0} used in this demo session</span></div>
      <h3>Data-minimisation checklist</h3><ul class="plain"><li>✓ Pseudonymous student IDs in analytics &amp; exports</li><li>✓ No DOB, contact details or health / SEN fields exist in the schema</li><li>✓ No diagnosis or ability labels; only skill evidence</li><li>✓ Encryption at rest (KMS) and in transit (TLS 1.2+)</li></ul></section></div>`;
  };
  C.setPol = el => { const k = el.dataset.key, v = Number(el.value); D().settings[k] = v; U.log('Policy changed', `${k} = ${v}`); U.rerender(); };
  C.setHints = el => { D().settings.studentHints = el.checked; U.log('Policy changed', 'studentHints = ' + el.checked); U.rerender(); };
  C.setCap = el => { const v = Math.max(10, Math.min(500, Number(el.value) || 40)); D().settings.dailyGenCap = v; U.log('Policy changed', 'dailyGenCap = ' + v); U.save(); };

  Ad.audit = function () {
    const f = V.auditF || '', rows = D().audit.filter(r => !f || r.role === f);
    return `${U.pageHead('Audit log', 'Who did what, and when. Logs hold IDs and event types, not student answers.', `<select aria-label="Filter by role" data-change="auditF">${opt('', 'All roles', f)}${opt('teacher', 'Teacher', f)}${opt('student', 'Student', f)}${opt('admin', 'Administrator', f)}</select>`)}
    <div class="card"><div class="tablewrap"><table><thead><tr><th>Time</th><th>Who</th><th>Role</th><th>Event</th><th>Detail</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(new Date(r.t).toLocaleString('en-GB'))}</td><td>${esc(r.who)}</td><td>${esc(r.role)}</td><td>${esc(r.ev)}</td><td class="hint">${esc(r.detail)}</td></tr>`).join('') || `<tr><td colspan="5">${U.empty('No events.')}</td></tr>`}</tbody></table></div></div>`;
  };
  C.auditF = el => { V.auditF = el.value; U.render(true); };

  Ad.permissions = function () {
    const rows = [['Create classes & add students', 1, 0, 0], ['View individual student results', 1, 'Own only', 0], ['Take assessments & practice', 0, 1, 0], ['Create assessments & question bank items', 1, 0, 0], ['Generate AI content', 1, 0, 0], ['Approve / reject AI content', 1, 0, 0], ['View class reports & exports', 1, 0, 0], ['View school-wide aggregates', 0, 0, 1], ['Manage staff users & roles', 0, 0, 1], ['Set retention & AI policy', 0, 0, 1], ['View audit log', 0, 0, 1]];
    const c = v => (v === 1 ? '<span class="badge badge-ok">Yes</span>' : v ? `<span class="badge badge-warn">${v}</span>` : '<span class="badge badge-muted">No</span>');
    return `${U.pageHead('Permissions matrix', 'Least privilege by role. Enforced in the prototype UI; in production enforced server-side with IAM, API authorisers and PostgreSQL row-level security.')}
    <div class="card"><div class="tablewrap"><table><thead><tr><th>Capability</th><th>Teacher</th><th>Student</th><th>Administrator</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r[0]}</td><td>${c(r[1])}</td><td>${c(r[2])}</td><td>${c(r[3])}</td></tr>`).join('')}</tbody></table></div></div>
    <p class="hint">Try it: switch “Demo as” to Student and open a teacher URL such as <code>#/teacher/reports</code>.</p>`;
  };
})();
