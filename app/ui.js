/* App shell: store, router, role-based access, shared UI helpers and charts. */
(function () {
  const SP = (window.SP = window.SP || {});
  const U = (SP.ui = {});
  SP.views = { teacher: {}, student: {}, admin: {} };
  SP.actions = {};
  SP.changes = {};
  SP.submits = {};
  const KEY = 'studypatch.demo.v1';
  let D = null;
  U.V = {}; // transient view state (filters, selections)
  U.ctx = { role: 'teacher', studentId: 'S01' };

  /* ---------- store ---------- */
  U.init = function () {
    try { const s = localStorage.getItem(KEY); if (s) { const d = JSON.parse(s); if (d && d.v === 1) D = d; } } catch (e) { /* storage unavailable */ }
    if (!D) D = SP.seed();
    try { const c = JSON.parse(sessionStorage.getItem('studypatch.ctx') || 'null'); if (c) U.ctx = Object.assign(U.ctx, c); } catch (e) { /* ignore */ }
    U.save();
  };
  U.D = () => D;
  U.save = () => { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) { /* ignore */ } };
  U.saveCtx = () => { try { sessionStorage.setItem('studypatch.ctx', JSON.stringify(U.ctx)); } catch (e) { /* ignore */ } };
  U.reset = function () { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } D = SP.seed(); U.save(); U.go(defaultRoute(U.ctx.role)); U.toast('Demo data reset'); };

  /* ---------- helpers ---------- */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  U.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);
  const esc = U.esc;
  U.fmtDate = d => { if (!d) return '–'; const x = new Date(d.length === 10 ? d + 'T12:00:00' : d); return x.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
  U.pct = v => Math.round(v * 100) + '%';
  U.skillName = id => (SP.skillById[id] ? SP.skillById[id].name : id);
  U.student = id => D.students.find(s => s.id === id);
  U.studentName = id => { const s = U.student(id); return s ? s.name : 'Unknown'; };
  U.cls = id => D.classes.find(c => c.id === id);
  U.user = () => (U.ctx.role === 'teacher' ? D.users.find(u => u.id === 'T1') : U.ctx.role === 'admin' ? D.users.find(u => u.id === 'A1') : null);
  U.who = () => (U.ctx.role === 'student' ? U.studentName(U.ctx.studentId) : U.user().name);
  U.log = (ev, detail) => { D.audit.unshift({ t: new Date().toISOString(), who: U.who(), role: U.ctx.role, ev, detail: detail || '' }); D.audit = D.audit.slice(0, 300); };
  U.scopeClasses = () => (U.ctx.role === 'teacher' ? D.classes.filter(c => c.teacherId === 'T1') : []);
  U.scopeStudents = classId => {
    const ids = U.scopeClasses().map(c => c.id);
    return D.students.filter(s => s.active && ids.includes(s.classId) && (!classId || classId === 'all' || s.classId === classId));
  };
  U.pill = label => `<span class="pill st-${SP.engine.labelClass[label] || 'none'}">${esc(label)}</span>`;
  U.aiBadge = (txt) => `<span class="badge badge-ai" title="${esc(SP.ai.labelText)}"><svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z"/></svg>${esc(txt || 'AI-generated')}</span>`;
  U.statusBadge = st => ({ approved: '<span class="badge badge-ok">Approved</span>', draft: '<span class="badge badge-warn">Draft: needs review</span>', pending_review: '<span class="badge badge-warn">Draft: needs review</span>', rejected: '<span class="badge badge-muted">Rejected</span>', published: '<span class="badge badge-ok">Published</span>' }[st] || `<span class="badge badge-muted">${esc(st)}</span>`);
  U.pageHead = (title, sub, actions) => `<div class="pagehead"><div><h1 id="pagetitle">${esc(title)}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div><div class="pagehead-actions">${actions || ''}</div></div>`;
  U.empty = msg => `<div class="empty">${msg}</div>`;

  U.toast = function (msg) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
    t.textContent = msg; t.className = 'show';
    clearTimeout(U._tt); U._tt = setTimeout(() => (t.className = ''), 2800);
  };

  /* ---------- modal ---------- */
  U.modal = function (html, wide) {
    U.closeModal(true);
    const m = document.createElement('div');
    m.id = 'modal'; m.className = 'modal-back';
    m.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="mtitle"><button class="modal-x btn btn-ghost btn-sm" data-act="closeModal" aria-label="Close dialog">✕</button>${html}</div>`;
    U._prevFocus = document.activeElement;
    document.body.appendChild(m);
    const f = m.querySelector('input,select,textarea,button:not(.modal-x)') || m.querySelector('.modal-x');
    if (f) f.focus();
  };
  U.closeModal = function (silent) {
    const m = document.getElementById('modal'); if (m) m.remove();
    if (!silent && U._prevFocus && document.contains(U._prevFocus)) U._prevFocus.focus();
  };

  /* ---------- charts ---------- */
  U.COLORS = ['#4f46e5', '#0d9488', '#d97706', '#475569', '#7c3aed', '#0891b2'];
  U.lineChart = function (series, labels, aria) {
    const W = 560, H = 230, L = 40, R = 14, T = 14, B = 34;
    const x = i => L + (labels.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (labels.length - 1));
    const y = v => T + (1 - v) * (H - T - B);
    let g = '';
    [0, 0.25, 0.5, 0.75, 1].forEach(t => { g += `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="#e2e8f0"/><text x="${L - 8}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="#64748b">${Math.round(t * 100)}%</text>`; });
    labels.forEach((lb, i) => { g += `<text x="${x(i)}" y="${H - 12}" text-anchor="middle" font-size="11" fill="#475569">${esc(lb)}</text>`; });
    series.forEach((s, si) => {
      const c = U.COLORS[si % U.COLORS.length];
      const pts = s.points.map(p => (p.y == null ? null : [x(p.i), y(p.y), p])).filter(Boolean);
      if (pts.length > 1) g += `<polyline fill="none" stroke="${c}" stroke-width="2.5" points="${pts.map(p => p[0] + ',' + p[1]).join(' ')}"/>`;
      pts.forEach(p => { g += `<circle cx="${p[0]}" cy="${p[1]}" r="4.5" fill="#fff" stroke="${c}" stroke-width="2.5"><title>${esc(s.name)}: ${Math.round(p[2].y * 100)}% (${p[2].n} questions)</title></circle>`; });
    });
    const legend = series.map((s, si) => `<span class="lg"><i style="background:${U.COLORS[si % U.COLORS.length]}"></i>${esc(s.name)}</span>`).join('');
    return `<figure class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(aria)}">${g}</svg><figcaption class="legend">${legend}</figcaption></figure>`;
  };

  U.stackBar = function (d) {
    const T = d.total || 1, parts = [['Secure', 'secure'], ['Developing', 'dev'], ['Needs practice', 'need'], ['Not enough evidence', 'none']];
    return `<div class="stack" role="img" aria-label="${parts.map(p => `${d[p[0]]} ${p[0]}`).join(', ')}">${parts.map(p => d[p[0]] ? `<span class="seg seg-${p[1]}" style="width:${(d[p[0]] / T) * 100}%" title="${p[0]}: ${d[p[0]]}">${d[p[0]]}</span>` : '').join('')}</div>`;
  };
  U.stackLegend = () => `<div class="legend"><span class="lg"><i class="seg-secure"></i>Secure</span><span class="lg"><i class="seg-dev"></i>Developing</span><span class="lg"><i class="seg-need"></i>Needs practice</span><span class="lg"><i class="seg-none"></i>Not enough evidence</span></div>`;

  /* ---------- routing ---------- */
  const NAV = {
    teacher: [['dashboard', 'Dashboard'], ['classes', 'Classes & students'], ['assessments', 'Assessments'], ['bank', 'Question bank'], ['skills', 'Skills & objectives'], ['review', 'Review queue'], ['reports', 'Class reports']],
    student: [['home', 'My home'], ['practice', 'Practice'], ['progress', 'My progress']],
    admin: [['overview', 'Overview'], ['users', 'Users & roles'], ['policy', 'Data & AI policy'], ['audit', 'Audit log'], ['permissions', 'Permissions']]
  };
  const ROLE_LABEL = { teacher: 'Teacher', student: 'Student', admin: 'Administrator' };
  const defaultRoute = role => `#/${role}/${NAV[role][0][0]}`;
  U.go = h => { if (location.hash === h) U.render(); else location.hash = h; };
  U.parse = () => {
    const p = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    return { role: p[0], page: p[1], param: p[2] };
  };
  U.pendingReviews = () => D.practiceSets.filter(p => p.status === 'draft').length + D.bank.filter(q => q.status === 'pending_review').length;

  U.render = function (keepScroll) {
    const y = window.scrollY;
    let { role, page, param } = U.parse();
    if (!NAV[role]) { U.go(defaultRoute(U.ctx.role)); return; }
    const urlRole = role; role = U.ctx.role; // the signed-in demo role decides what is allowed, not the URL
    const views = urlRole === role ? SP.views[role] : {};
    const nav = NAV[role].map(([id, label]) => {
      const cur = id === page || (page === 'student' && id === 'classes') || (page === 'assessment-new' && id === 'assessments') || (page === 'take' && id === 'home');
      const badge = role === 'teacher' && id === 'review' && U.pendingReviews() ? `<span class="count">${U.pendingReviews()}</span>` : '';
      return `<a href="#/${role}/${id}" class="${cur ? 'cur' : ''}" ${cur ? 'aria-current="page"' : ''}>${label}${badge}</a>`;
    }).join('');
    const body = views[page]
      ? views[page](param)
      : `<div class="card denied"><h1>Access restricted</h1><p>The <strong>${ROLE_LABEL[role]}</strong> role does not include this page${urlRole !== role ? ' (' + ROLE_LABEL[urlRole] + ' area)' : ''}. Permissions follow least privilege: each role only sees the data it needs.</p><a class="btn btn-primary" href="${defaultRoute(role)}">Back to your home</a></div>`;
    const studentSel = role === 'student'
      ? `<label class="sr-only" for="stusel">Demo student</label><select id="stusel" data-change="setStudent">${D.students.filter(s => s.active).map(s => `<option value="${s.id}" ${s.id === U.ctx.studentId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>` : '';
    document.getElementById('app').innerHTML = `
      <a class="skip" href="#main">Skip to content</a>
      <div class="shell">
        <aside class="side">
          <a class="brand" href="../index.html" title="Back to public website"><svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#4f46e5"/><path d="M9 17.5l4.5 4.5L23 11" fill="none" stroke="#fbbf24" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>StudyPatch</span></a>
          <div class="role-tag">${ROLE_LABEL[role]} view</div>
          <nav aria-label="Primary">${nav}</nav>
          <div class="side-foot"><span class="dot"></span>All students, classes and results in this demo are fictional.</div>
        </aside>
        <div class="content">
          <header class="top">
            <div class="demo-as"><label for="rolesel">Demo as</label>
              <select id="rolesel" data-change="setRole">${Object.keys(ROLE_LABEL).map(r => `<option value="${r}" ${r === role ? 'selected' : ''}>${ROLE_LABEL[r]}</option>`).join('')}</select>${studentSel}</div>
            <div class="top-r"><span class="badge badge-warn">Prototype · fictional data</span><button class="btn btn-ghost btn-sm" data-act="resetDemo">Reset demo data</button></div>
          </header>
          <main id="main" tabindex="-1">${body}</main>
        </div>
      </div>`;
    const h1 = document.querySelector('#pagetitle, main h1');
    document.title = (h1 ? h1.textContent + ' · ' : '') + 'StudyPatch prototype';
    window.scrollTo(0, keepScroll ? y : 0);
  };
  U.rerender = () => { U.save(); U.render(true); };

  /* ---------- events ---------- */
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (el && SP.actions[el.dataset.act]) { e.preventDefault(); SP.actions[el.dataset.act](el, e); }
  });
  document.addEventListener('change', e => {
    const el = e.target.closest('[data-change]');
    if (el && SP.changes[el.dataset.change]) SP.changes[el.dataset.change](el, e);
  });
  document.addEventListener('input', e => {
    const el = e.target.closest('[data-input]');
    if (el && SP.changes[el.dataset.input]) SP.changes[el.dataset.input](el, e);
  });
  document.addEventListener('submit', e => {
    const f = e.target.closest('form[data-submit]');
    if (f) { e.preventDefault(); const fn = SP.submits[f.dataset.submit]; if (fn) fn(f, new FormData(f)); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') U.closeModal(); });
  document.addEventListener('click', e => { if (e.target.id === 'modal') U.closeModal(); });
  window.addEventListener('hashchange', () => { U.closeModal(true); U.render(false); });

  SP.actions.closeModal = () => U.closeModal();
  SP.actions.resetDemo = () => { if (confirm('Reset all demo data back to the original fictional dataset?')) U.reset(); };
  SP.changes.setRole = el => { U.ctx.role = el.value; U.saveCtx(); U.log('Switched demo role', el.value); U.save(); U.go(defaultRoute(el.value)); };
  SP.changes.setStudent = el => { U.ctx.studentId = el.value; U.saveCtx(); U.session = null; U.go(defaultRoute('student')); };

  U.start = function () {
    U.init();
    if (!location.hash) location.hash = defaultRoute(U.ctx.role); else U.render();
  };
})();
