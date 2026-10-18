/* Student experience: home, adaptive assessment, approved practice, own progress. */
(function () {
  const SP = window.SP, U = SP.ui, esc = U.esc;
  const St = SP.views.student, A = SP.actions;
  const D = () => U.D();
  const me = () => U.ctx.studentId;

  const myAssessments = () => D().assessments.filter(a => a.status === 'published' && a.classIds.includes(U.student(me()).classId));
  const attemptOf = aid => D().attempts.find(t => t.assessmentId === aid && t.studentId === me());
  const mySets = () => D().practiceSets.filter(p => p.status === 'approved' && p.targets.includes(me()));
  const answered = p => D().practiceResponses.filter(r => r.setId === p.id && r.studentId === me()).length;

  St.home = function () {
    const s = U.student(me()), todo = myAssessments().filter(a => !attemptOf(a.id)), sets = mySets();
    return `${U.pageHead(`Hi ${esc(s.name.split(' ')[0])} 👋`, 'Short questions help your teacher find the best practice for you. There is no pass or fail.')}
    <div class="grid2"><section class="card"><h2>Assessments for you</h2>
      ${todo.length ? todo.map(a => `<div class="listitem"><div><strong>${esc(a.title)}</strong><br><span class="hint">${a.config.minQ}–${a.config.maxQ} questions · due ${U.fmtDate(a.due)}</span></div><a class="btn btn-primary" href="#/student/take/${a.id}">Start</a></div>`).join('') : U.empty('You are all caught up. Nice work!')}
      ${myAssessments().filter(a => attemptOf(a.id)).map(a => `<div class="listitem"><div>${esc(a.title)}<br><span class="hint">Completed ${U.fmtDate(attemptOf(a.id).date)}</span></div><span class="badge badge-ok">Done ✓</span></div>`).join('')}</section>
    <section class="card"><h2>Practice from your teacher</h2>
      ${sets.length ? sets.map(p => `<div class="listitem"><div><strong>${esc(U.skillName(p.skill))}</strong><br><span class="hint">${answered(p)}/${p.items.length} answered</span></div><a class="btn btn-secondary" href="#/student/practice/${p.id}">${answered(p) ? 'Continue' : 'Open'}</a></div>`).join('') : U.empty('No practice yet. After an assessment, your teacher may share some.')}
      <p class="hint">Practice here was written with AI help and checked by your teacher.</p></section></div>`;
  };

  /* ---------- Assessment ---------- */
  St.take = function (aid) {
    const a = D().assessments.find(x => x.id === aid);
    if (!a || !myAssessments().includes(a)) return `<div class="card denied"><h1>Not available</h1><p>This assessment isn’t assigned to you.</p><a class="btn btn-primary" href="#/student/home">Back</a></div>`;
    if (attemptOf(aid) && !(U.session && U.session.stage === 'done' && U.session.aid === aid)) return `<div class="card"><h1>${esc(a.title)}</h1><p>You have already completed this. Well done! Your teacher will use it to plan practice.</p><a class="btn btn-primary" href="#/student/home">Back</a></div>`;
    const s = U.session && U.session.aid === aid ? U.session : null;
    if (!s || s.stage === 'intro') return `<div class="focus card"><h1>${esc(a.title)}</h1><p>You’ll see about ${a.config.minQ}–${a.config.maxQ} questions. They get a little easier or harder depending on your answers, so don’t worry if some feel tricky: that’s how the questions find the right level.</p><ul class="plain"><li>Take your time and pick the answer you think is best.</li><li>It’s fine to make mistakes. They help your teacher choose useful practice.</li><li>This is not a grade or a measure of how clever you are.</li></ul><button class="btn btn-accent" data-act="startA" data-id="${a.id}">Let’s begin</button> <a class="btn btn-ghost" href="#/student/home">Not now</a></div>`;
    if (s.stage === 'done') return summary(a, s);
    const n = s.sess.responses.length + 1, q = s.cur.q;
    return `<div class="focus"><div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="${a.config.maxQ}" aria-valuenow="${n}" aria-label="Question ${n} of up to ${a.config.maxQ}"><i style="width:${(n / a.config.maxQ) * 100}%"></i></div>
      <p class="hint">Question ${n} (up to ${a.config.maxQ}) · ${esc(U.skillName(q.skill))}</p>
      <form class="card qcard" data-submit="answerA"><fieldset><legend class="qstem">${esc(q.stem)}</legend>
      ${q.opts.map((o, i) => `<label class="choice"><input type="radio" name="c" value="${i}" required><span>${esc(o.t)}</span></label>`).join('')}</fieldset>
      <div class="row between"><span class="hint">${q.source === 'ai' ? U.aiBadge('AI-generated, teacher-approved') : ''}</span><button class="btn btn-primary">Next</button></div></form></div>`;
  };
  A.startA = el => {
    const a = D().assessments.find(x => x.id === el.dataset.id), sess = SP.engine.startSession(a);
    const nx = SP.engine.next(sess, a, D().bank);
    if (!nx) { U.toast('Not enough approved questions for this assessment'); return; }
    U.session = { aid: a.id, stage: 'q', sess, cur: nx }; U.log('Assessment started', a.id); U.render();
  };
  SP.submits.answerA = (f, fd) => {
    const s = U.session, a = D().assessments.find(x => x.id === s.aid), ch = Number(fd.get('c'));
    if (Number.isNaN(ch)) return;
    SP.engine.answer(s.sess, a, s.cur.q, ch);
    const nx = SP.engine.next(s.sess, a, D().bank);
    if (nx) { s.cur = nx; U.render(); return; }
    D().attempts.push({ id: 'AT' + (D().attempts.length + 1) + Math.random().toString(36).slice(2, 4), assessmentId: a.id, studentId: me(), date: SP.today, complete: true, responses: s.sess.responses });
    s.stage = 'done'; U.log('Assessment completed', `${a.id} (${s.sess.responses.length} questions)`); U.save(); U.render();
  };
  function summary(a, s) {
    const sum = SP.engine.summarise(s.sess.responses), ks = Object.keys(sum);
    const strong = ks.filter(k => sum[k].label === 'Secure'), next = ks.filter(k => sum[k].label !== 'Secure');
    return `<div class="focus card"><h1>All done. Thank you! 🎉</h1><p>You answered ${s.sess.responses.length} questions.</p>
      ${a.config.showSummary ? `${strong.length ? `<h2>Where you shone</h2><p>${strong.map(k => `<span class="badge badge-ok">${esc(U.skillName(k))}</span>`).join(' ')}</p>` : ''}
      ${next.length ? `<h2>Good places to practise next</h2><p>${next.map(k => `<span class="badge badge-indigo">${esc(U.skillName(k))}</span>`).join(' ')}</p><p class="hint">These are based on just a few questions, so your teacher will use their own judgement too.</p>` : ''}` : '<p>Your teacher will talk to you about how it went.</p>'}
      <a class="btn btn-primary" href="#/student/home" data-act="endSession">Back to home</a></div>`;
  }
  A.endSession = () => { U.session = null; };

  /* ---------- Practice ---------- */
  St.practice = function (id) {
    if (!id) {
      const sets = mySets();
      return `${U.pageHead('Practice', 'Questions chosen for you by your teacher.')}${sets.length ? sets.map(p => `<div class="card listitem"><div><h3>${esc(U.skillName(p.skill))}</h3><p class="hint">${U.aiBadge('AI-generated, teacher-approved')} · ${answered(p)}/${p.items.length} answered</p></div><a class="btn btn-primary" href="#/student/practice/${p.id}">${answered(p) ? 'Continue' : 'Start'}</a></div>`).join('') : U.empty('Nothing assigned yet.')}`;
    }
    const p = mySets().find(x => x.id === id);
    if (!p) return `<div class="card denied"><h1>Not available</h1><p>This practice isn’t assigned to you or hasn’t been approved yet.</p><a class="btn btn-primary" href="#/student/practice">Back</a></div>`;
    const prog = U.prac && U.prac.id === id ? U.prac : (U.prac = { id, i: Math.min(answered(p), p.items.length), checked: null, hints: 0 });
    const teacher = U.user ? 'Ms. Okafor' : 'your teacher';
    const head = `<p class="banner">${U.aiBadge('AI-generated')} Written with AI help and <strong>approved by ${teacher}</strong> on ${U.fmtDate(p.reviewedOn)}.${p.note ? `<br>“${esc(p.note)}”` : ''}</p>`;
    if (prog.i >= p.items.length) {
      const rs = D().practiceResponses.filter(r => r.setId === id && r.studentId === me());
      return `<div class="focus card">${head}<h1>Practice complete 🌟</h1><p>You got ${rs.filter(r => r.correct).length} of ${p.items.length} on the first try. Every attempt builds understanding. Your teacher can see how it went and decide what’s next.</p><a class="btn btn-primary" href="#/student/practice" data-act="resetPrac">Back to practice</a></div>`;
    }
    const it = p.items[prog.i], ck = prog.checked;
    return `<div class="focus">${head}
      ${prog.i === 0 && ck === null ? `<details class="card" open><summary><strong>Worked example</strong></summary><p>${esc(p.worked.stem)}</p><ol>${p.worked.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></details>` : ''}
      <div class="progress" aria-hidden="true"><i style="width:${((prog.i + (ck ? 1 : 0)) / p.items.length) * 100}%"></i></div>
      <form class="card qcard" data-submit="checkP"><fieldset ${ck ? 'disabled' : ''}><legend class="qstem">${prog.i + 1}. ${esc(it.stem)}</legend>
      ${it.opts.map((o, i) => `<label class="choice ${ck ? (i === it.ans ? 'right' : i === ck.choice ? 'wrong' : '') : ''}"><input type="radio" name="c" value="${i}" required ${ck && ck.choice === i ? 'checked' : ''}><span>${esc(o.t)}</span></label>`).join('')}</fieldset>
      ${prog.hints ? `<div class="hintbox" aria-live="polite">${it.hints.slice(0, prog.hints).map((h, i) => `<p><strong>Hint ${i + 1}:</strong> ${esc(h)}</p>`).join('')}</div>` : ''}
      ${ck ? `<div class="feedback ${ck.correct ? 'ok' : 'try'}" role="status"><strong>${ck.correct ? 'Yes, nicely done!' : 'Not quite, and that’s okay.'}</strong> Here’s how it works:<ol>${it.explanation.map(e => `<li>${esc(e)}</li>`).join('')}</ol></div>` : ''}
      <div class="row between wrap">${!ck && D().settings.studentHints && prog.hints < 3 ? '<button type="button" class="btn btn-ghost" data-act="moreHint">Show a hint</button>' : '<span></span>'}
      ${ck ? '<button type="button" class="btn btn-primary" data-act="nextP">Next</button>' : '<button class="btn btn-primary">Check my answer</button>'}</div></form></div>`;
  };
  SP.submits.checkP = (f, fd) => {
    const p = mySets().find(x => x.id === U.prac.id), it = p.items[U.prac.i], ch = Number(fd.get('c')), ok = ch === it.ans;
    U.prac.checked = { choice: ch, correct: ok };
    D().practiceResponses.push({ setId: p.id, studentId: me(), itemIdx: U.prac.i, choice: ch, correct: ok, hintsUsed: U.prac.hints, date: SP.today });
    U.save(); U.render(true);
  };
  A.moreHint = () => { U.prac.hints++; U.render(true); };
  A.nextP = () => { U.prac.i++; U.prac.checked = null; U.prac.hints = 0; U.render(); };
  A.resetPrac = () => { U.prac = null; };

  St.progress = function () {
    return `${U.pageHead('My progress', 'See how things are going over time, starting with your strengths.')}${U.progress(me(), 'student')}`;
  };
})();
