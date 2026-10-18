/* Teacher experience: dashboard, classes, assessments, question bank, skills, review queue, reports, progress. */
(function () {
  const SP = window.SP, U = SP.ui, V = U.V, esc = U.esc;
  const T = SP.views.teacher, A = SP.actions, C = SP.changes, S = SP.submits;
  const D = () => U.D();
  const opt = (v, label, sel) => `<option value="${esc(v)}" ${String(sel) === String(v) ? 'selected' : ''}>${esc(label)}</option>`;
  const skillOpts = sel => SP.skills.map(s => opt(s.id, `${s.id} · ${s.name}`, sel)).join('');
  const shortDate = d => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const inScope = id => U.scopeStudents().some(s => s.id === id);

  /* =============== Dashboard =============== */
  T.dashboard = function () {
    const d = D(), cls = V.dashClass || 'all', studs = U.scopeStudents(cls), ids = studs.map(s => s.id);
    const dist = SP.analytics.classDistribution(d, ids);
    const attempts = d.attempts.filter(a => ids.includes(a.studentId)).length;
    const needy = SP.skills.filter(s => dist[s.id]['Needs practice'] / (ids.length || 1) >= 0.4).length;
    const kind = V.assist || 'summary';
    const res = V.assistFree || SP.ai.assistant(d, ids, kind);
    const chips = [['summary', 'Summarise class performance'], ['reteach', 'What should we reteach?'], ['starter', 'Suggest a starter activity'], ['groups', 'Possible small groups']];
    return `${U.pageHead(`Good morning, ${esc(U.user().name.split(' ').slice(0, 2).join(' '))}`, 'A snapshot of what your classes have demonstrated so far, and where practice could help.',
      `<label class="sr-only" for="dc">Class</label><select id="dc" data-change="dashClass">${opt('all', 'All my classes', cls)}${U.scopeClasses().map(c => opt(c.id, c.name, cls)).join('')}</select>`)}
    <div class="kpis">
      <div class="kpi"><b>${ids.length}</b><span>students in view</span></div>
      <div class="kpi"><b>${attempts}</b><span>assessments completed</span></div>
      <div class="kpi"><b>${needy}</b><span>skills where 40%+ need practice</span></div>
      <a class="kpi kpi-link" href="#/teacher/review"><b>${U.pendingReviews()}</b><span>AI drafts awaiting your review</span></a>
    </div>
    <div class="grid2">
      <section class="card assistant" aria-labelledby="ast">
        <div class="row between"><h2 id="ast">Teacher Intelligence Assistant</h2>${U.aiBadge('AI-assisted summary')}</div>
        <div class="chips" role="group" aria-label="Assistant prompts">${chips.map(c => `<button class="chip ${!V.assistFree && kind === c[0] ? 'on' : ''}" data-act="assist" data-kind="${c[0]}">${c[1]}</button>`).join('')}</div>
        <div class="assist-out" aria-live="polite">
          <h3>${esc(res.title)}</h3>
          <ul>${res.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>
          ${res.actions ? `<div class="row wrap">${res.actions.map(a => `<button class="btn btn-secondary btn-sm" data-act="genPractice" data-mis="${a.mis}" data-class="${cls}">${esc(a.label)}</button>`).join('')}</div>` : ''}
          <p class="caution">⚠ ${esc(res.caution)}</p>
        </div>
        <form class="ask" data-submit="assistAsk"><label class="sr-only" for="aq">Ask the assistant</label><input id="aq" name="q" type="text" placeholder="Ask e.g. “which concepts should we reteach?”" maxlength="140"><button class="btn btn-primary">Ask</button></form>
        <p class="hint">Answers are generated only from your classes’ stored responses. The assistant does not label students’ ability or make diagnoses.</p>
      </section>
      <section class="card" aria-labelledby="mst"><h2 id="mst">Skill picture</h2>
        <p class="hint">Latest evidence per skill, for ${ids.length} students.</p>
        ${SP.skills.map(s => `<div class="skillrow"><a href="#/teacher/skills/${s.id}">${esc(s.name)}</a>${U.stackBar(dist[s.id])}</div>`).join('')}
        ${U.stackLegend()}
      </section>
    </div>`;
  };
  C.dashClass = el => { V.dashClass = el.value; V.assistFree = null; U.render(true); };
  A.assist = el => { V.assist = el.dataset.kind; V.assistFree = null; U.render(true); };
  S.assistAsk = (f, fd) => {
    const q = String(fd.get('q') || '').toLowerCase();
    const k = /reteach|revisit|misunderst|concept/.test(q) ? 'reteach' : /starter|activity|lesson|warm/.test(q) ? 'starter' : /group|support|who/.test(q) ? 'groups' : /summar|perform|overview|how/.test(q) ? 'summary' : null;
    const ids = U.scopeStudents(V.dashClass || 'all').map(s => s.id);
    V.assistFree = SP.ai.assistant(D(), ids, k || 'none'); V.assist = k; U.render(true);
  };
  A.genPractice = el => {
    const d = D(), mis = el.dataset.mis, cls = el.dataset.class || 'all';
    let targets = el.dataset.students ? el.dataset.students.split(',') : null;
    const ids = U.scopeStudents(cls).map(s => s.id);
    if (!targets) targets = (SP.analytics.classMisconceptions(d, ids).find(m => m.id === mis) || { students: [] }).students.map(x => x.id);
    if (!targets.length) { U.toast('No students currently show this pattern'); return; }
    if ((d.genCount || 0) + 3 > d.settings.dailyGenCap) { U.toast('Daily AI generation cap reached (set by your administrator)'); return; }
    d.genCount = (d.genCount || 0) + 3;
    const ps = SP.ai.generatePractice({ skill: SP.mis[mis].skill, mis, bank: d.bank, targets, classId: cls === 'all' ? null : cls, author: 'AI draft for ' + U.user().name });
    d.practiceSets.unshift(ps);
    U.log('AI practice draft generated', `${ps.id} · ${SP.mis[mis].name} · ${targets.length} students (no student names sent to model)`);
    V.reviewTab = 'practice'; U.save(); U.toast('Draft created. Review it before anything reaches students.'); U.go('#/teacher/review');
  };

  /* =============== Classes & students =============== */
  T.classes = function (id) {
    const d = D();
    if (id) {
      const c = U.scopeClasses().find(x => x.id === id);
      if (!c) return `<div class="card denied"><h1>Class not found</h1><p>You can only open classes assigned to you.</p><a class="btn btn-primary" href="#/teacher/classes">Back to classes</a></div>`;
      const studs = U.scopeStudents(c.id);
      return `${U.pageHead(c.name, `${studs.length} students · ${c.year}`, '<a class="btn btn-secondary" href="#/teacher/classes">All classes</a> <a class="btn btn-primary" href="#/teacher/reports" data-act="openReport" data-class="' + c.id + '">Class report</a>')}
      <div class="card"><div class="tablewrap"><table><thead><tr><th>Student</th><th>Pseudonymous ID</th><th>Assessments</th><th>Secure</th><th>Needs practice</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>
      ${studs.map(s => { const st = SP.analytics.status(d, s.id), v = Object.values(st); return `<tr><td><a href="#/teacher/student/${s.id}">${esc(s.name)}</a></td><td>${esc(s.pid)}</td><td>${SP.analytics.attemptsFor(d, s.id).length}</td><td>${v.filter(x => x.label === 'Secure').length}</td><td>${v.filter(x => x.label === 'Needs practice').length}</td><td class="right"><button class="btn btn-ghost btn-sm" data-act="archiveStudent" data-id="${s.id}">Remove from class</button></td></tr>`; }).join('')}
      </tbody></table></div></div>
      <div class="card"><h2>Add a student</h2>
        <form class="inline-form" data-submit="addStudent"><input type="hidden" name="classId" value="${c.id}">
          <div><label for="sn">Display name</label><input id="sn" name="name" type="text" required maxlength="60" autocomplete="off"></div>
          <button class="btn btn-primary">Add student</button></form>
        <p class="hint">Data minimisation: only a display name and a generated pseudonymous ID are stored. No date of birth, email, address, or special-needs / health information.</p></div>`;
    }
    return `${U.pageHead('Classes & students', 'Classes assigned to you. Teachers only see their own classes.')}
      <div class="cards">${U.scopeClasses().map(c => { const n = U.scopeStudents(c.id).length; return `<a class="card classcard" href="#/teacher/classes/${c.id}"><h2>${esc(c.name)}</h2><p>${n} students</p><span class="btn btn-secondary btn-sm">Open class</span></a>`; }).join('')}</div>
      <div class="card"><h2>Create a class</h2><form class="inline-form" data-submit="addClass"><div><label for="cn">Class name</label><input id="cn" name="name" type="text" required maxlength="60"></div><div><label for="cy">Year / level</label><input id="cy" name="year" type="text" value="Year 7" maxlength="20"></div><button class="btn btn-primary">Create class</button></form></div>`;
  };
  A.openReport = el => { V.repClass = el.dataset.class; };
  S.addStudent = (f, fd) => {
    const d = D(), name = String(fd.get('name') || '').trim(), cid = fd.get('classId');
    if (!name || !U.scopeClasses().some(c => c.id === cid)) return;
    const n = d.students.length + 1, id = 'S' + String(n).padStart(2, '0') + Math.random().toString(36).slice(2, 4);
    const pid = (cid === 'C1' ? '7A-' : cid === 'C2' ? '7B-' : 'X-') + String(d.students.filter(s => s.classId === cid).length + 1).padStart(2, '0');
    d.students.push({ id, pid, name, classId: cid, active: true });
    U.log('Student added', `${pid} to ${cid}`); U.rerender(); U.toast('Student added');
  };
  S.addClass = (f, fd) => {
    const d = D(), name = String(fd.get('name') || '').trim(); if (!name) return;
    d.classes.push({ id: 'C' + (d.classes.length + 1) + Math.random().toString(36).slice(2, 4), name, teacherId: 'T1', year: String(fd.get('year') || '') });
    U.log('Class created', name); U.rerender();
  };
  A.archiveStudent = el => {
    const s = U.student(el.dataset.id); if (!s || !inScope(s.id)) return;
    if (!confirm(`Remove ${s.name} from this class? Their records are retained per the retention policy and can be restored by an administrator.`)) return;
    s.active = false; U.log('Student removed from class', s.pid); U.rerender();
  };

  /* =============== Student progress (shared) =============== */
  U.progress = function (sid, mode) {
    const d = D(), s = U.student(sid), st = SP.analytics.status(d, sid), atts = SP.analytics.attemptsFor(d, sid), t = mode === 'teacher';
    const skills = SP.skills.filter(k => st[k.id]);
    const secure = skills.filter(k => st[k.id].label === 'Secure'), focus = skills.filter(k => ['Needs practice', 'Developing'].includes(st[k.id].label));
    const series = skills.filter(k => st[k.id].history.length >= 2).map(k => ({ name: k.name, points: atts.map((a, i) => { const h = st[k.id].history.find(x => x.attemptId === a.id); return { i, y: h ? h.score : null, n: h ? h.n : 0 }; }) }));
    const chart = atts.length >= 2 && series.length ? U.lineChart(series.slice(0, 6), atts.map(a => shortDate(a.date)), `Demonstrated mastery by assessment date for ${s.name}`) : U.empty('A trend appears after two assessments that cover the same skill.');
    const arrow = { up: '<span class="trend up">▲ more secure than last time</span>', down: '<span class="trend down">▼ less secure than last time</span>', steady: '<span class="trend">● similar to last time</span>' };
    const sets = d.practiceSets.filter(p => p.status === 'approved' && p.targets.includes(sid));
    const done = p => d.practiceResponses.filter(r => r.setId === p.id && r.studentId === sid).length;
    const mis = Object.values(st).flatMap(e => Object.entries(e.mis || {}));
    return `<div class="card"><h2>${t ? 'Skills' : 'What you have shown so far'}</h2>
      ${secure.length ? `<p class="strengths"><strong>${t ? 'Secure on' : 'Great work on'}:</strong> ${secure.map(k => `<span class="badge badge-ok">${esc(k.name)}</span>`).join(' ')}</p>` : ''}
      <div class="tablewrap"><table><thead><tr><th>Skill</th><th>Latest evidence</th><th>Questions</th><th>Change</th></tr></thead><tbody>
      ${SP.skills.map(k => { const e = st[k.id]; return `<tr><td>${esc(k.name)}</td><td>${U.pill(e ? e.label : 'Not enough evidence')}</td><td>${e ? e.n : 0}</td><td>${e && e.change ? arrow[e.change] : '<span class="hint">–</span>'}</td></tr>`; }).join('')}
      </tbody></table></div>
      <p class="hint">${t ? 'Based on a handful of questions per skill at specific points in time. It describes responses on these items, not a student’s ability, and is not a diagnosis. Combine with your own knowledge of the student.' : 'This shows how your answers went on these questions on those days. It isn’t a grade and it isn’t about how smart you are. It helps your teacher pick useful practice.'}</p></div>
    <div class="card"><h2>${t ? 'Progress over time' : 'Your progress over time'}</h2>${chart}</div>
    ${t ? `<div class="card"><h2>Response patterns observed</h2>${mis.length ? `<ul class="plain">${mis.map(([m, n]) => `<li><strong>${esc(SP.mis[m].name)}</strong> <span class="badge badge-muted">${n === 1 ? 'seen once: tentative' : 'seen ' + n + '×: repeated'}</span><br><span class="hint">${esc(SP.mis[m].desc)}</span><br><button class="btn btn-secondary btn-sm" data-act="genPractice" data-mis="${m}" data-students="${sid}" data-class="${s.classId}">Draft targeted practice</button></li>`).join('')}</ul>` : U.empty('No repeated response patterns found.')}<p class="hint">Patterns are hypotheses about reasoning on specific items. Check with a quick conversation before acting.</p></div>` : ''}
    <div class="card"><h2>${t ? 'Assigned practice (teacher-approved)' : 'Practice from your teacher'}</h2>${sets.length ? `<ul class="plain">${sets.map(p => `<li>${esc(p.title)} · ${done(p)}/${p.items.length} questions answered ${t ? '' : `<a class="btn btn-primary btn-sm" href="#/student/practice/${p.id}">Open</a>`}</li>`).join('')}</ul>` : U.empty('No approved practice assigned yet.')}</div>
    ${t ? `<div class="card"><h2>Teacher notes <span class="badge badge-muted">only visible to teachers</span></h2><form data-submit="saveNote"><input type="hidden" name="sid" value="${sid}"><label class="sr-only" for="nt">Note</label><textarea id="nt" name="note" maxlength="600" placeholder="Observations, next steps. Avoid sensitive personal information.">${esc((d.notes || {})[sid] || '')}</textarea><button class="btn btn-secondary">Save note</button></form></div>` : ''}`;
  };
  T.student = function (id) {
    const s = U.student(id);
    if (!s || !inScope(id)) return `<div class="card denied"><h1>Access restricted</h1><p>This student is not in one of your classes.</p><a class="btn btn-primary" href="#/teacher/classes">Back</a></div>`;
    return `${U.pageHead(s.name, `${esc(U.cls(s.classId).name)} · ID ${esc(s.pid)} · fictional student`, '<a class="btn btn-secondary" href="#/teacher/classes/' + s.classId + '">Back to class</a>')}${U.progress(id, 'teacher')}`;
  };
  S.saveNote = (f, fd) => { const d = D(); d.notes = d.notes || {}; if (inScope(fd.get('sid'))) { d.notes[fd.get('sid')] = String(fd.get('note') || '').slice(0, 600); U.log('Teacher note saved', fd.get('sid')); U.rerender(); U.toast('Note saved'); } };

  /* =============== Assessments =============== */
  T.assessments = function () {
    const d = D();
    return `${U.pageHead('Assessments', 'Short adaptive assessments. You set the limits; the engine adapts within them.', '<a class="btn btn-primary" href="#/teacher/assessment-new">New assessment</a>')}
    <div class="card"><div class="tablewrap"><table><thead><tr><th>Assessment</th><th>Skills</th><th>Limits</th><th>Status</th><th>Completed</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>
    ${d.assessments.map(a => { const ids = U.scopeStudents().filter(s => a.classIds.includes(s.classId)).map(s => s.id); const n = new Set(d.attempts.filter(t => t.assessmentId === a.id && ids.includes(t.studentId)).map(t => t.studentId)).size; const c = a.config;
      return `<tr><td><strong>${esc(a.title)}</strong><br><span class="hint">${esc(a.classIds.map(i => (U.cls(i) || {}).name).join(', '))} · due ${U.fmtDate(a.due)}</span></td><td>${a.skills.map(s => `<span class="badge badge-indigo">${s}</span>`).join(' ')}</td><td class="hint">${c.minQ}–${c.maxQ} questions<br>difficulty ${c.minDiff}–${c.maxDiff}, start ${c.startDiff}</td><td>${U.statusBadge(a.status)}</td><td>${n}/${ids.length}</td><td class="right"><a class="btn btn-secondary btn-sm" href="#/teacher/reports" data-act="openReportA" data-a="${a.id}">Results</a> ${a.status === 'draft' ? `<button class="btn btn-primary btn-sm" data-act="publishA" data-id="${a.id}">Publish</button>` : ''}</td></tr>`; }).join('')}
    </tbody></table></div></div>`;
  };
  A.openReportA = el => { V.repAssessment = el.dataset.a; };
  A.publishA = el => { const a = D().assessments.find(x => x.id === el.dataset.id); a.status = 'published'; U.log('Assessment published', a.title); U.rerender(); };

  function poolCount(skill, minD, maxD) { return D().bank.filter(q => q.status === 'approved' && q.skill === skill && q.d >= minD && q.d <= maxD).length; }
  T['assessment-new'] = function () {
    return `${U.pageHead('New assessment', 'Choose skills and set the adaptive limits. Only teacher-approved questions are ever used.', '<a class="btn btn-secondary" href="#/teacher/assessments">Cancel</a>')}
    <form class="card form" data-submit="saveAssessment" id="afrm" novalidate>
      <div class="field"><label for="at">Title</label><input id="at" name="title" type="text" required maxlength="80" placeholder="e.g. Fractions check-in"></div>
      <fieldset><legend>Skills to assess</legend><div class="checks">${SP.skills.map(s => `<label class="check"><input type="checkbox" name="skills" value="${s.id}" data-input="poolRefresh"> ${esc(s.name)} <span class="hint" data-pool="${s.id}"></span></label>`).join('')}</div></fieldset>
      <fieldset><legend>Adaptive limits (you control these)</legend><div class="grid4">
        <div><label for="minQ">Min questions</label><input id="minQ" name="minQ" type="number" min="3" max="40" value="8" data-input="poolRefresh"></div>
        <div><label for="maxQ">Max questions</label><input id="maxQ" name="maxQ" type="number" min="3" max="40" value="12" data-input="poolRefresh"></div>
        <div><label for="mpS">Max per skill</label><input id="mpS" name="maxPerSkill" type="number" min="2" max="6" value="3"></div>
        <div><label for="sd">Start difficulty</label><select id="sd" name="startDiff">${[1, 2, 3, 4, 5].map(n => opt(n, n, 2)).join('')}</select></div>
        <div><label for="mnD">Lowest difficulty</label><select id="mnD" name="minDiff" data-input="poolRefresh">${[1, 2, 3, 4, 5].map(n => opt(n, n, 1)).join('')}</select></div>
        <div><label for="mxD">Highest difficulty</label><select id="mxD" name="maxDiff" data-input="poolRefresh">${[1, 2, 3, 4, 5].map(n => opt(n, n, 4)).join('')}</select></div>
      </div>
      <label class="check"><input type="checkbox" name="followUps" checked> Allow one easier follow-up question after an incorrect answer to locate the gap</label>
      <label class="check"><input type="checkbox" name="showSummary" checked> Show students a strengths-first summary at the end</label></fieldset>
      <fieldset><legend>Assign to</legend><div class="checks">${U.scopeClasses().map(c => `<label class="check"><input type="checkbox" name="classIds" value="${c.id}" checked> ${esc(c.name)}</label>`).join('')}</div>
        <div class="field short"><label for="due">Due date</label><input id="due" name="due" type="text" value="2026-10-23" pattern="\\d{4}-\\d{2}-\\d{2}"></div></fieldset>
      <div id="aerr" class="err" role="alert"></div>
      <div class="row wrap"><button type="button" class="btn btn-secondary" data-act="previewPath">Preview an adaptive path</button><button type="submit" class="btn btn-primary" name="go" value="publish">Save &amp; publish</button><button type="button" class="btn btn-ghost" data-act="saveDraftA">Save as draft</button></div>
      <div id="pathPreview"></div>
    </form>`;
  };
  function readA(f) {
    const fd = new FormData(f), n = k => Number(fd.get(k));
    const a = { id: 'A' + (D().assessments.length + 1) + Math.random().toString(36).slice(2, 4), title: String(fd.get('title') || '').trim(), skills: fd.getAll('skills'), classIds: fd.getAll('classIds'), due: String(fd.get('due') || ''), created: SP.today, status: 'published',
      config: { minQ: n('minQ'), maxQ: n('maxQ'), maxPerSkill: n('maxPerSkill'), startDiff: n('startDiff'), minDiff: n('minDiff'), maxDiff: n('maxDiff'), followUps: !!fd.get('followUps'), showSummary: !!fd.get('showSummary') } };
    const c = a.config, errs = [];
    if (!a.title) errs.push('Add a title.');
    if (!a.skills.length) errs.push('Choose at least one skill.');
    if (c.minQ > c.maxQ) errs.push('Minimum questions cannot exceed maximum.');
    if (c.minDiff > c.maxDiff) errs.push('Lowest difficulty cannot exceed highest.');
    if (c.startDiff < c.minDiff || c.startDiff > c.maxDiff) errs.push('Start difficulty must sit inside the difficulty range.');
    a.skills.forEach(s => { if (poolCount(s, c.minDiff, c.maxDiff) < 2) errs.push(`${SP.skillById[s].name} has fewer than 2 approved questions in this range.`); });
    if (!a.classIds.length) errs.push('Assign to at least one class.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.due)) errs.push('Due date must look like 2026-10-23.');
    return { a, errs };
  }
  C.poolRefresh = el => {
    const f = el.closest('form'), fd = new FormData(f), lo = Number(fd.get('minDiff')), hi = Number(fd.get('maxDiff'));
    f.querySelectorAll('[data-pool]').forEach(sp => (sp.textContent = `(${poolCount(sp.dataset.pool, lo, hi)} approved questions)`));
  };
  A.previewPath = el => {
    const f = el.closest('form'), { a, errs } = readA(f), box = document.getElementById('pathPreview'), er = document.getElementById('aerr');
    const e2 = errs.filter(e => !/title|due|class/i.test(e)); er.textContent = e2.join(' ');
    if (e2.length) { box.innerHTML = ''; return; }
    box.innerHTML = [['Needs more support', 1.6], ['Mixed profile', 2.8], ['Confident', 4.2]].map(([name, L]) => {
      const sess = SP.engine.simulate(a, D().bank, { levels: Object.fromEntries(SP.skills.map(s => [s.id, L])), held: [] }, SP.rng(L * 100));
      return `<div class="card soft"><h3>Simulated path: ${name} <span class="badge badge-muted">${sess.responses.length} questions</span></h3><ol class="path">${sess.path.map((p, i) => { const q = D().bank.find(x => x.id === p.qid); return `<li><span class="${p.correct ? 'ok' : 'no'}">${p.correct ? '✓' : '✗'}</span> <strong>${esc(q.skill)} d${q.d}</strong> ${esc(q.stem)}<br><span class="hint">${esc(p.why)}</span></li>`; }).join('')}</ol></div>`;
    }).join('') + '<p class="hint">Simulated learners are fictional and only illustrate how the limits shape the path.</p>';
  };
  function saveA(f, status) {
    const { a, errs } = readA(f); document.getElementById('aerr').textContent = errs.join(' ');
    if (errs.length) return; a.status = status; D().assessments.push(a);
    U.log(status === 'draft' ? 'Assessment saved as draft' : 'Assessment published', a.title); U.save(); U.go('#/teacher/assessments'); U.toast('Assessment saved');
  }
  S.saveAssessment = f => saveA(f, 'published');
  A.saveDraftA = el => saveA(el.closest('form'), 'draft');

  /* =============== Question bank =============== */
  T.bank = function () {
    const d = D(), f = Object.assign({ skill: '', source: '', status: '', q: '' }, V.bank);
    const rows = d.bank.filter(q => (!f.skill || q.skill === f.skill) && (!f.source || q.source === f.source) && (!f.status || q.status === f.status) && (!f.q || q.stem.toLowerCase().includes(f.q.toLowerCase())));
    const srcLabel = q => q.source === 'ai' ? U.aiBadge('AI-generated') : q.source === 'teacher' ? '<span class="badge badge-muted">Teacher-written</span>' : '<span class="badge badge-muted">Library</span>';
    return `${U.pageHead('Question bank', `${d.bank.length} questions. AI-generated questions are clearly labelled and cannot be used in assessments until you approve them.`, '<button class="btn btn-secondary" data-act="openAddQ">Write a question</button> <button class="btn btn-primary" data-act="openGenQ">Generate with AI</button>')}
    <div class="card filters"><div><label for="fs">Skill</label><select id="fs" data-change="bankF" data-key="skill">${opt('', 'All skills', f.skill)}${skillOpts(f.skill)}</select></div>
      <div><label for="fso">Source</label><select id="fso" data-change="bankF" data-key="source">${opt('', 'All', f.source)}${opt('library', 'Library', f.source)}${opt('teacher', 'Teacher-written', f.source)}${opt('ai', 'AI-generated', f.source)}</select></div>
      <div><label for="fst">Status</label><select id="fst" data-change="bankF" data-key="status">${opt('', 'All', f.status)}${opt('approved', 'Approved', f.status)}${opt('pending_review', 'Awaiting review', f.status)}${opt('rejected', 'Rejected', f.status)}</select></div>
      <div><label for="fq">Search</label><input id="fq" type="search" value="${esc(f.q)}" data-change="bankF" data-key="q" placeholder="Search question text"></div></div>
    <div class="card"><div class="tablewrap"><table><thead><tr><th>Question</th><th>Skill</th><th>Level</th><th>Source</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>
    ${rows.map(q => `<tr><td>${esc(q.stem)}</td><td>${q.skill}</td><td>${q.d}</td><td>${srcLabel(q)}</td><td>${U.statusBadge(q.status)}</td><td class="right"><button class="btn btn-ghost btn-sm" data-act="previewQ" data-id="${q.id}">Preview</button>${q.status === 'pending_review' ? ` <button class="btn btn-primary btn-sm" data-act="approveQ" data-id="${q.id}">Approve</button> <button class="btn btn-danger btn-sm" data-act="rejectQ" data-id="${q.id}">Reject</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="6">${U.empty('No questions match these filters.')}</td></tr>`}
    </tbody></table></div></div>`;
  };
  C.bankF = el => { V.bank = Object.assign({}, V.bank, { [el.dataset.key]: el.value }); U.render(true); const q = document.getElementById('fq'); if (el.dataset.key === 'q' && q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } };
  A.previewQ = el => {
    const q = D().bank.find(x => x.id === el.dataset.id);
    U.modal(`<h2 id="mtitle">Question preview</h2>${q.source === 'ai' ? `<p>${U.aiBadge('AI-generated')} ${U.statusBadge(q.status)}</p>` : ''}<p class="qstem">${esc(q.stem)}</p>
      <ul class="plain">${q.opts.map((o, i) => `<li>${i === q.ans ? '✅' : '▫️'} ${esc(o.t)} ${o.m ? `<span class="badge badge-warn">reveals: ${esc(SP.mis[o.m].name)}</span>` : i === q.ans ? '<span class="badge badge-ok">correct</span>' : '<span class="badge badge-muted">no specific pattern</span>'}</li>`).join('')}</ul>
      <p class="hint">Skill ${q.skill} · difficulty ${q.d} · ${esc(q.author)} · ${U.fmtDate(q.created)}</p>`);
  };
  A.approveQ = el => { const q = D().bank.find(x => x.id === el.dataset.id); q.status = 'approved'; q.reviewer = U.user().name; U.log('AI question approved', q.id); U.rerender(); U.toast('Question approved. It can now be used in assessments.'); };
  A.rejectQ = el => { const q = D().bank.find(x => x.id === el.dataset.id); q.status = 'rejected'; U.log('AI question rejected', q.id); U.rerender(); };
  A.openGenQ = () => U.modal(`<h2 id="mtitle">Generate questions with AI</h2><p>${U.aiBadge('AI-generated')} Drafts are added as <em>awaiting review</em>. Nothing is used until you approve it.</p>
    <form data-submit="genQ" class="form"><div class="field"><label for="gs">Skill</label><select id="gs" name="skill">${skillOpts('')}</select></div>
    <div class="grid2s"><div><label for="gd">Proposed difficulty</label><select id="gd" name="d">${[1, 2, 3, 4, 5].map(n => opt(n, n, 3)).join('')}</select></div><div><label for="gn">How many</label><input id="gn" name="n" type="number" min="1" max="6" value="3"></div></div>
    <p class="hint">Prompts contain only the skill, difficulty and curriculum text, never student data. Prototype note: drafts come from a deterministic template generator; production calls Amazon Bedrock with the same checks.</p>
    <button class="btn btn-primary">Generate drafts</button></form>`);
  S.genQ = (f, fd) => {
    const d = D(), n = Math.max(1, Math.min(6, Number(fd.get('n')) || 3));
    if ((d.genCount || 0) + n > d.settings.dailyGenCap) { U.toast('Daily AI generation cap reached'); return; }
    const out = SP.ai.generateQuestions({ skill: fd.get('skill'), d: Number(fd.get('d')), n, rng: Math.random });
    if (!out.length) { U.toast('No generator for that skill yet. Write one manually.'); return; }
    d.genCount = (d.genCount || 0) + out.length; out.forEach(q => d.bank.unshift(q));
    U.log('AI questions generated', `${out.length} for ${fd.get('skill')}`); U.closeModal(); V.bank = { status: 'pending_review' }; U.rerender(); U.toast(`${out.length} drafts awaiting your review`);
  };
  A.openAddQ = () => {
    const misOpts = '<option value="">No specific pattern</option>' + Object.entries(SP.mis).map(([id, m]) => `<option value="${id}">${esc(m.name)}</option>`).join('');
    U.modal(`<h2 id="mtitle">Write a question</h2><form class="form" data-submit="addQ">
      <div class="field"><label for="qs">Question</label><textarea id="qs" name="stem" required maxlength="300"></textarea></div>
      <div class="grid2s"><div><label for="qk">Skill</label><select id="qk" name="skill">${skillOpts('')}</select></div><div><label for="qd">Difficulty</label><select id="qd" name="d">${[1, 2, 3, 4, 5].map(n => opt(n, n, 2)).join('')}</select></div></div>
      <fieldset><legend>Options: choose the correct one and, for wrong options, the reasoning it reveals</legend>
      ${[0, 1, 2, 3].map(i => `<div class="optrow"><input type="radio" name="ans" value="${i}" ${i === 0 ? 'checked' : ''} aria-label="Option ${i + 1} is correct"><input type="text" name="o${i}" required maxlength="80" placeholder="Option ${i + 1}" aria-label="Option ${i + 1} text"><select name="m${i}" aria-label="Pattern revealed by option ${i + 1}">${misOpts}</select></div>`).join('')}</fieldset>
      <div id="qerr" class="err" role="alert"></div><button class="btn btn-primary">Add to bank</button></form>`, true);
  };
  S.addQ = (f, fd) => {
    const opts = [0, 1, 2, 3].map(i => ({ t: String(fd.get('o' + i) || '').trim(), m: fd.get('m' + i) || null }));
    const ans = Number(fd.get('ans')), err = document.getElementById('qerr');
    if (!String(fd.get('stem')).trim()) { err.textContent = 'Add the question text.'; return; }
    if (opts.some(o => !o.t) || new Set(opts.map(o => o.t)).size < 4) { err.textContent = 'All four options must be filled in and different.'; return; }
    opts[ans].m = null;
    D().bank.unshift({ id: 'T-' + Math.random().toString(36).slice(2, 6).toUpperCase(), skill: fd.get('skill'), d: Number(fd.get('d')), stem: String(fd.get('stem')).trim(), opts, ans, source: 'teacher', status: 'approved', author: U.user().name, created: SP.today });
    U.log('Question added', fd.get('skill')); U.closeModal(); U.rerender(); U.toast('Question added');
  };

  /* =============== Skills & objectives =============== */
  T.skills = function (sel) {
    const d = D(), ids = U.scopeStudents().map(s => s.id), dist = SP.analytics.classDistribution(d, ids);
    const depth = {}; const dep = id => (depth[id] != null ? depth[id] : (depth[id] = SP.skillById[id].pre.length ? 1 + Math.max(...SP.skillById[id].pre.map(dep)) : 0));
    SP.skills.forEach(s => dep(s.id));
    const cols = {}; SP.skills.forEach(s => (cols[depth[s.id]] = cols[depth[s.id]] || []).push(s.id));
    const pos = {}; const nw = 150, nh = 52, gx = 70, gy = 18;
    Object.entries(cols).forEach(([c, arr]) => arr.forEach((id, i) => (pos[id] = { x: 10 + c * (nw + gx), y: 10 + i * (nh + gy) })));
    const W = 20 + (Math.max(...Object.keys(cols).map(Number)) + 1) * (nw + gx), H = 20 + Math.max(...Object.values(cols).map(a => a.length)) * (nh + gy);
    let svg = '<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#94a3b8"/></marker></defs>';
    SP.skills.forEach(s => s.pre.forEach(p => { const a = pos[p], b = pos[s.id]; svg += `<path d="M${a.x + nw} ${a.y + nh / 2} C ${a.x + nw + 35} ${a.y + nh / 2}, ${b.x - 35} ${b.y + nh / 2}, ${b.x} ${b.y + nh / 2}" fill="none" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#ar)"/>`; }));
    SP.skills.forEach(s => {
      const dd = dist[s.id], share = dd['Needs practice'] / (dd.total || 1), fill = share >= 0.5 ? '#fef3c7' : share >= 0.25 ? '#eef2ff' : '#f0fdfa', stroke = share >= 0.5 ? '#d97706' : share >= 0.25 ? '#6366f1' : '#0d9488';
      svg += `<g data-act="selSkill" data-id="${s.id}" role="button" tabindex="0" aria-label="${esc(s.name)}: ${dd['Needs practice']} of ${dd.total} students need practice" style="cursor:pointer"><rect x="${pos[s.id].x}" y="${pos[s.id].y}" width="${nw}" height="${nh}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="${sel === s.id ? 3.5 : 1.5}"/><text x="${pos[s.id].x + 10}" y="${pos[s.id].y + 22}" font-size="12.5" font-weight="700" fill="#1e1b4b">${esc(s.name.length > 22 ? s.name.slice(0, 21) + '…' : s.name)}</text><text x="${pos[s.id].x + 10}" y="${pos[s.id].y + 40}" font-size="11" fill="#475569">${dd['Needs practice']}/${dd.total} need practice</text></g>`;
    });
    const detail = sel && SP.skillById[sel] ? (() => {
      const s = SP.skillById[sel], extra = d.objectives[s.id] || [], qs = d.bank.filter(q => q.skill === s.id && q.status === 'approved'), dd = dist[s.id];
      return `<div class="card"><h2>${esc(s.name)} <span class="badge badge-muted">${esc(s.ref)}</span></h2>
      <p class="hint">Prerequisites: ${s.pre.length ? s.pre.map(p => `<a href="#/teacher/skills/${p}">${esc(U.skillName(p))}</a>`).join(', ') : 'none'}</p>
      <h3>Learning objectives</h3><ul class="plain">${s.obj.map(o => `<li>${esc(o)}</li>`).join('')}${extra.map((o, i) => `<li>${esc(o)} <span class="badge badge-muted">yours</span> <button class="btn btn-ghost btn-sm" data-act="delObj" data-id="${s.id}" data-i="${i}" aria-label="Remove objective">✕</button></li>`).join('')}</ul>
      <form class="inline-form" data-submit="addObj"><input type="hidden" name="id" value="${s.id}"><div><label for="ob">Add a local objective</label><input id="ob" name="o" type="text" maxlength="120" required></div><button class="btn btn-secondary">Add</button></form>
      <h3>Evidence</h3>${U.stackBar(dd)}${U.stackLegend()}<p class="hint">${qs.length} approved questions: ${[1, 2, 3, 4, 5].map(n => `L${n}: ${qs.filter(q => q.d === n).length}`).join(' · ')}</p></div>`;
    })() : '<div class="card"><p class="hint">Select a skill on the map to see objectives, prerequisites and class evidence.</p></div>';
    return `${U.pageHead('Skills & learning objectives', `${esc(SP.curriculum)}. Arrows point from prerequisite to dependent skill; colour shows how many students currently need practice.`)}
    <div class="card"><div class="mapwrap"><svg viewBox="0 0 ${W} ${H}" width="${W}" role="group" aria-label="Skill map">${svg}</svg></div>
    <div class="legend"><span class="lg"><i style="background:#f0fdfa;border:2px solid #0d9488"></i>&lt;25% need practice</span><span class="lg"><i style="background:#eef2ff;border:2px solid #6366f1"></i>25–49%</span><span class="lg"><i style="background:#fef3c7;border:2px solid #d97706"></i>50%+</span></div></div>${detail}`;
  };
  A.selSkill = el => U.go('#/teacher/skills/' + el.dataset.id);
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('g[role=button]')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
  S.addObj = (f, fd) => { const d = D(), id = fd.get('id'); (d.objectives[id] = d.objectives[id] || []).push(String(fd.get('o')).trim()); U.log('Objective added', id); U.rerender(); };
  A.delObj = el => { D().objectives[el.dataset.id].splice(Number(el.dataset.i), 1); U.rerender(); };

  /* =============== Review queue =============== */
  T.review = function () {
    const d = D(), tab = V.reviewTab || 'practice';
    const sets = d.practiceSets.filter(p => U.scopeClasses().some(c => c.id === p.classId) || p.targets.some(inScope));
    const qs = d.bank.filter(q => q.source === 'ai');
    const card = p => `<div class="card setcard"><div class="row between wrap"><h3>${esc(p.title)}</h3><div>${U.aiBadge('AI-generated')} ${U.statusBadge(p.status)}</div></div>
      <p class="hint">${esc(SP.mis[p.mis].desc)}</p><p>${p.items.length} practice questions · worked example · 3 hints each · for <strong>${p.targets.length}</strong> student${p.targets.length === 1 ? '' : 's'}${p.reviewedOn ? ` · reviewed ${U.fmtDate(p.reviewedOn)}` : ''}</p>
      <button class="btn ${p.status === 'draft' ? 'btn-primary' : 'btn-secondary'} btn-sm" data-act="openSet" data-id="${p.id}">${p.status === 'draft' ? 'Review &amp; decide' : 'View'}</button></div>`;
    return `${U.pageHead('Review queue', 'Nothing AI-generated reaches a student until a teacher approves it. You can edit, regenerate, or reject anything.')}
    <div class="tabs" role="tablist"><button role="tab" aria-selected="${tab === 'practice'}" class="${tab === 'practice' ? 'on' : ''}" data-act="revTab" data-t="practice">Practice sets (${sets.filter(p => p.status === 'draft').length} to review)</button><button role="tab" aria-selected="${tab === 'questions'}" class="${tab === 'questions' ? 'on' : ''}" data-act="revTab" data-t="questions">Question drafts (${qs.filter(q => q.status === 'pending_review').length} to review)</button></div>
    ${tab === 'practice' ? (sets.length ? sets.map(card).join('') : U.empty('No practice sets yet. Generate one from the dashboard or a class report.')) :
      `<div class="card"><div class="tablewrap"><table><thead><tr><th>AI question draft</th><th>Skill</th><th>Level</th><th>Status</th><th></th></tr></thead><tbody>${qs.map(q => `<tr><td>${esc(q.stem)}</td><td>${q.skill}</td><td>${q.d}</td><td>${U.statusBadge(q.status)}</td><td class="right"><button class="btn btn-ghost btn-sm" data-act="previewQ" data-id="${q.id}">Preview</button>${q.status === 'pending_review' ? ` <button class="btn btn-primary btn-sm" data-act="approveQ" data-id="${q.id}">Approve</button> <button class="btn btn-danger btn-sm" data-act="rejectQ" data-id="${q.id}">Reject</button>` : ''}</td></tr>`).join('')}</tbody></table></div></div>`}`;
  };
  A.revTab = el => { V.reviewTab = el.dataset.t; U.render(true); };
  function setForm(p) {
    const roster = U.scopeStudents().filter(s => !p.classId || s.classId === p.classId || p.targets.includes(s.id));
    const editable = p.status === 'draft';
    return `<h2 id="mtitle">${esc(p.title)}</h2><p>${U.aiBadge('AI-generated')} ${U.statusBadge(p.status)} <span class="hint">Pattern targeted: ${esc(SP.mis[p.mis].name)}</span></p>
    <div class="callout">⚠ Review every question, hint and explanation for accuracy and tone before approving. Automated checks: single correct answer ${p.checks.singleCorrectAnswer ? '✓' : '✗'} · distinct options ${p.checks.uniqueOptions ? '✓' : '✗'} · answers verified by code ${p.checks.answersComputedByCode ? '✓' : 'n/a (bank items)'}. <span class="hint">${esc(p.checks.sourceNote)}</span></div>
    <form id="setform" data-set="${p.id}" class="form">
    <h3>Worked example</h3><div class="card soft"><p><strong>${esc(p.worked.stem)}</strong></p><ol>${p.worked.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>${p.worked.answer ? `<p>Answer: <strong>${esc(p.worked.answer)}</strong></p>` : ''}</div>
    <h3>Practice questions</h3>${p.items.map((it, i) => `<div class="card soft" data-item="${i}"><label for="st${i}">Question ${i + 1}</label><textarea id="st${i}" name="stem${i}" ${editable ? '' : 'readonly'} maxlength="300">${esc(it.stem)}</textarea>
      <ul class="plain">${it.opts.map((o, j) => `<li>${j === it.ans ? '✅' : '▫️'} ${esc(o.t)} ${o.m ? `<span class="hint">(${esc(SP.mis[o.m].name)})</span>` : ''}</li>`).join('')}</ul>
      <details><summary>Hints &amp; explanation</summary><ol>${it.hints.map(h => `<li>${esc(h)}</li>`).join('')}</ol><p><strong>Explanation:</strong> ${it.explanation.map(esc).join(' ')}</p></details>
      ${editable ? `<label class="check"><input type="checkbox" name="drop${i}"> Remove this question</label>` : ''}</div>`).join('')}
    <h3>Assigned to</h3><div class="checks">${roster.map(s => `<label class="check"><input type="checkbox" name="tg" value="${s.id}" ${p.targets.includes(s.id) ? 'checked' : ''} ${editable ? '' : 'disabled'}> ${esc(s.name)}</label>`).join('')}</div>
    <div class="field"><label for="nt">Note to students (optional)</label><textarea id="nt" name="note" maxlength="240" ${editable ? '' : 'readonly'}>${esc(p.note)}</textarea></div>
    ${editable ? `<label class="check"><input type="checkbox" id="ok" name="ok"> I have reviewed all questions, hints and explanations in this set.</label>
    <div class="field"><label for="rr">Reason if rejecting (kept in the audit log)</label><input id="rr" name="rr" type="text" maxlength="160"></div>
    <div id="serr" class="err" role="alert"></div>
    <div class="row wrap"><button type="button" class="btn btn-primary" data-act="setApprove">Approve &amp; assign</button><button type="button" class="btn btn-secondary" data-act="setSave">Save edits</button><button type="button" class="btn btn-secondary" data-act="setRegen">Regenerate</button><button type="button" class="btn btn-danger" data-act="setReject">Reject</button></div>`
      : (p.status === 'approved' ? `<button type="button" class="btn btn-danger" data-act="setRevoke">Withdraw from students</button>` : `<p class="hint">Reason: ${esc(p.rejectReason || '–')}</p>`)}</form>`;
  }
  A.openSet = el => U.modal(setForm(D().practiceSets.find(x => x.id === el.dataset.id)), true);
  function applyForm(btn) {
    const f = btn.closest('form'), p = D().practiceSets.find(x => x.id === f.dataset.set), fd = new FormData(f);
    p.items = p.items.map((it, i) => Object.assign({}, it, { stem: String(fd.get('stem' + i) || it.stem).trim() || it.stem })).filter((it, i) => !fd.get('drop' + i));
    p.targets = fd.getAll('tg').filter(inScope); p.note = String(fd.get('note') || '').slice(0, 240);
    return { p, fd };
  }
  A.setSave = el => { applyForm(el); U.log('Practice set edited', ''); U.closeModal(); U.rerender(); U.toast('Edits saved'); };
  A.setApprove = el => {
    const { p, fd } = applyForm(el), err = document.getElementById('serr');
    if (!fd.get('ok')) { err.textContent = 'Please confirm you have reviewed the content.'; return; }
    if (!p.items.length) { err.textContent = 'A set needs at least one question.'; return; }
    if (!p.targets.length) { err.textContent = 'Choose at least one student to assign this to.'; return; }
    p.status = 'approved'; p.reviewer = 'T1'; p.reviewedOn = SP.today;
    U.log('AI practice approved & assigned', `${p.id} · ${p.targets.length} students`); U.closeModal(); U.rerender(); U.toast('Approved. Assigned students can now see it.');
  };
  A.setReject = el => { const { p, fd } = applyForm(el); p.status = 'rejected'; p.rejectReason = String(fd.get('rr') || 'No reason given'); U.log('AI practice rejected', `${p.id}: ${p.rejectReason}`); U.closeModal(); U.rerender(); };
  A.setRevoke = el => { const p = D().practiceSets.find(x => x.id === el.closest('form').dataset.set); p.status = 'draft'; U.log('Approved practice withdrawn', p.id); U.closeModal(); U.rerender(); U.toast('Withdrawn. It is a draft again.'); };
  A.setRegen = el => {
    const { p } = applyForm(el), d = D();
    if ((d.genCount || 0) + 3 > d.settings.dailyGenCap) { U.toast('Daily AI generation cap reached'); return; }
    d.genCount = (d.genCount || 0) + 3;
    const n = SP.ai.generatePractice({ skill: p.skill, mis: p.mis, bank: d.bank, targets: p.targets, classId: p.classId });
    Object.assign(p, { items: n.items, worked: n.worked, checks: n.checks });
    U.log('Practice set regenerated', p.id); U.closeModal(); U.rerender(); A.openSet({ dataset: { id: p.id } });
  };

  /* =============== Reports =============== */
  T.reports = function () {
    const d = D(), cls = V.repClass || 'all', studs = U.scopeStudents(cls), ids = studs.map(s => s.id), dist = SP.analytics.classDistribution(d, ids), mis = SP.analytics.classMisconceptions(d, ids);
    const sym = { 'Secure': '●', 'Developing': '◐', 'Needs practice': '○', 'Not enough evidence': '–' };
    const asm = V.repAssessment && V.repAssessment !== 'all' ? d.assessments.find(a => a.id === V.repAssessment) : null;
    return `${U.pageHead('Class performance reports', 'Latest evidence per skill. Cells show weighted share of correct answers; fewer than 2 questions means not enough evidence.',
      `<select aria-label="Class" data-change="repClass">${opt('all', 'All my classes', cls)}${U.scopeClasses().map(c => opt(c.id, c.name, cls)).join('')}</select> <button class="btn btn-secondary" data-act="exportCsv">Export CSV</button> <button class="btn btn-ghost" onclick="window.print()">Print</button>`)}
    ${asm ? `<div class="callout">Showing all latest evidence. Completion for <strong>${esc(asm.title)}</strong>: ${new Set(d.attempts.filter(a => a.assessmentId === asm.id && ids.includes(a.studentId)).map(a => a.studentId)).size}/${ids.length} students. <button class="btn btn-ghost btn-sm" data-act="clearAsm">Clear</button></div>` : ''}
    <div class="card"><h2>Skill heat map</h2><div class="tablewrap"><table class="heat"><thead><tr><th>Student</th>${SP.skills.map(s => `<th title="${esc(s.name)}"><abbr title="${esc(s.name)}">${s.id}</abbr></th>`).join('')}</tr></thead><tbody>
    ${studs.map(s => { const st = SP.analytics.status(d, s.id); return `<tr><th scope="row"><a href="#/teacher/student/${s.id}">${esc(s.name)}</a></th>${SP.skills.map(k => { const e = st[k.id], lab = e ? e.label : 'Not enough evidence'; return `<td class="hc st-${SP.engine.labelClass[lab]}" title="${esc(k.name)}: ${lab}${e ? ' (' + e.n + ' questions)' : ''}"><span aria-hidden="true">${sym[lab]}</span> ${e && e.n >= 2 ? Math.round(e.score * 100) : ''}<span class="sr-only">${lab}</span></td>`; }).join('')}</tr>`; }).join('')}
    </tbody></table></div><div class="legend"><span class="lg">● Secure</span><span class="lg">◐ Developing</span><span class="lg">○ Needs practice</span><span class="lg">– Not enough evidence</span></div></div>
    <div class="grid2"><div class="card"><h2>Distribution by skill</h2>${SP.skills.map(s => `<div class="skillrow"><span>${esc(s.name)}</span>${U.stackBar(dist[s.id])}</div>`).join('')}${U.stackLegend()}</div>
    <div class="card"><h2>Commonly seen response patterns</h2>${mis.length ? `<ul class="plain">${mis.slice(0, 8).map(m => `<li><strong>${esc(SP.mis[m.id].name)}</strong> <span class="badge badge-indigo">${m.students.length} of ${ids.length}</span> <span class="hint">(${m.repeated} repeated)</span><br><span class="hint">${esc(SP.mis[m.id].move)}</span><br><button class="btn btn-secondary btn-sm" data-act="genPractice" data-mis="${m.id}" data-class="${cls}">Draft practice for these ${m.students.length} students</button></li>`).join('')}</ul>` : U.empty('No patterns yet.')}<p class="hint">A pattern seen once is tentative. Use it as a prompt to check understanding, not as a conclusion.</p></div></div>`;
  };
  C.repClass = el => { V.repClass = el.value; U.render(true); };
  A.clearAsm = () => { V.repAssessment = null; U.render(true); };
  A.exportCsv = () => {
    const d = D(), ids = U.scopeStudents(V.repClass || 'all');
    const rows = [['pseudonymous_id', 'class', ...SP.skills.map(s => s.id + '_status')]];
    ids.forEach(s => { const st = SP.analytics.status(d, s.id); rows.push([s.pid, s.classId, ...SP.skills.map(k => (st[k.id] ? st[k.id].label : 'Not enough evidence'))]); });
    const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'studypatch-class-report.csv'; document.body.appendChild(a); a.click(); a.remove();
    U.log('Report exported', `${ids.length} students, pseudonymous IDs only`); U.save(); U.toast('Exported with pseudonymous IDs only');
  };
})();
