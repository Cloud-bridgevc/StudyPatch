/* Adaptive assessment engine + learning-gap analytics.
   Pure functions, no DOM. The same rules are mirrored in lambda/process_assessment. */
(function () {
  const SP = (window.SP = window.SP || {});

  // Seeded PRNG so the demo data is reproducible.
  SP.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /* ---------- Adaptive selection ----------
     Teacher-configured limits (assessment.config):
       minQ, maxQ, minDiff, maxDiff, startDiff, maxPerSkill, followUps (bool) */
  const E = (SP.engine = {});

  E.startSession = function (assessment) {
    const st = {};
    assessment.skills.forEach(s => (st[s] = { n: 0, correct: 0, est: assessment.config.startDiff, follow: 0, last: null }));
    return { skills: st, responses: [], used: new Set(), lastSkill: null, lastWrong: false, lastD: null };
  };

  function pool(session, assessment, bank, skill) {
    const c = assessment.config;
    return bank.filter(q => q.status === 'approved' && q.skill === skill && !session.used.has(q.id) && q.d >= c.minDiff && q.d <= c.maxDiff);
  }

  E.isDone = function (session, assessment) {
    const c = assessment.config;
    const n = session.responses.length;
    if (n >= c.maxQ) return true;
    if (n < c.minQ) return false;
    // Stop once every skill has >= 2 items and no skill has a split (1 right / 1 wrong) result still worth a third item.
    return assessment.skills.every(s => {
      const k = session.skills[s];
      if (k.n >= c.maxPerSkill) return true;
      if (k.n < 2) return false;
      return !(k.n === 2 && k.correct === 1);
    });
  };

  E.next = function (session, assessment, bank, rng) {
    rng = rng || Math.random;
    const c = assessment.config;
    if (E.isDone(session, assessment)) return null;
    let skill = null, why = '';
    const ls = session.lastSkill && session.skills[session.lastSkill];
    // 1. Follow-up probe after an incorrect answer, one per skill.
    if (c.followUps && session.lastWrong && ls && ls.follow < 1 && ls.n < c.maxPerSkill) {
      const targetD = clamp(session.lastD - 1, c.minDiff, c.maxDiff);
      const cand = pool(session, assessment, bank, session.lastSkill);
      if (cand.length) {
        ls.follow++;
        const q = pick(cand, targetD, rng);
        return { q, why: 'Follow-up: an easier question in the same skill to find where understanding starts to hold (teacher setting: follow-ups on).' };
      }
    }
    // 2. Otherwise cover the skill with least evidence; prefer unresolved splits.
    const order = assessment.skills.filter(s => session.skills[s].n < c.maxPerSkill && pool(session, assessment, bank, s).length);
    if (!order.length) return null;
    order.sort((a, b) => {
      const A = session.skills[a], B = session.skills[b];
      if (A.n !== B.n) return A.n - B.n;
      const sa = A.n === 2 && A.correct === 1 ? 0 : 1, sb = B.n === 2 && B.correct === 1 ? 0 : 1;
      return sa - sb;
    });
    skill = order[0];
    const k = session.skills[skill];
    const target = clamp(Math.round(k.est), c.minDiff, c.maxDiff);
    const q = pick(pool(session, assessment, bank, skill), target, rng);
    why = k.n === 0
      ? `Starting ${SP.skillById[skill].name} at difficulty ${target} (teacher start level ${c.startDiff}).`
      : k.n === 2 && k.correct === 1
        ? `Mixed results so far in ${SP.skillById[skill].name}; one more item at difficulty ${target} to clarify.`
        : `Adjusted to difficulty ${target} based on earlier answers in ${SP.skillById[skill].name}.`;
    return { q, why };
  };

  function pick(cand, target, rng) {
    const best = Math.min(...cand.map(q => Math.abs(q.d - target)));
    const tied = cand.filter(q => Math.abs(q.d - target) === best);
    return tied[Math.floor(rng() * tied.length)];
  }

  E.answer = function (session, assessment, q, choice) {
    const c = assessment.config;
    const correct = choice === q.ans;
    const opt = q.opts[choice];
    session.used.add(q.id);
    session.responses.push({ qid: q.id, skill: q.skill, d: q.d, choice, correct, mis: correct ? null : (opt && opt.m) || null });
    const k = session.skills[q.skill];
    k.n++; if (correct) k.correct++;
    k.est = clamp(k.est + (correct ? 1 : -1), c.minDiff, c.maxDiff);
    session.lastSkill = q.skill; session.lastWrong = !correct; session.lastD = q.d;
    return correct;
  };

  /* ---------- Evidence summary ---------- */
  E.label = function (score, n) {
    if (n < 2) return 'Not enough evidence';
    if (score >= 0.75) return 'Secure';
    if (score >= 0.4) return 'Developing';
    return 'Needs practice';
  };
  E.labelClass = { 'Secure': 'secure', 'Developing': 'dev', 'Needs practice': 'need', 'Not enough evidence': 'none' };

  E.summarise = function (responses) {
    const out = {};
    responses.forEach(r => {
      const s = (out[r.skill] = out[r.skill] || { n: 0, correct: 0, w: 0, wc: 0, mis: {}, hi: 0 });
      s.n++; s.w += r.d;
      if (r.correct) { s.correct++; s.wc += r.d; s.hi = Math.max(s.hi, r.d); }
      if (r.mis) s.mis[r.mis] = (s.mis[r.mis] || 0) + 1;
    });
    Object.values(out).forEach(s => { s.score = s.w ? s.wc / s.w : 0; s.label = E.label(s.score, s.n); });
    return out;
  };

  /* ---------- Simulated student (demo data + path preview) ---------- */
  E.simulate = function (assessment, bank, profile, rng) {
    const session = E.startSession(assessment);
    let guard = 0;
    while (guard++ < 60) {
      const nx = E.next(session, assessment, bank, rng);
      if (!nx) break;
      const q = nx.q;
      const L = profile.levels[q.skill] != null ? profile.levels[q.skill] : 2.5;
      const p = 1 / (1 + Math.exp(-(L - q.d) * 1.4));
      let choice = q.ans;
      if (rng() > p) {
        const wrong = q.opts.map((o, i) => ({ o, i })).filter(x => x.i !== q.ans);
        const weights = wrong.map(x => (x.o.m && profile.held.includes(x.o.m) ? 4 : 1));
        let r = rng() * weights.reduce((a, b) => a + b, 0), idx = 0;
        for (; idx < wrong.length; idx++) { r -= weights[idx]; if (r <= 0) break; }
        choice = wrong[Math.min(idx, wrong.length - 1)].i;
      }
      E.answer(session, assessment, q, choice);
      session.path = session.path || [];
      session.path.push({ qid: q.id, why: nx.why, correct: choice === q.ans });
    }
    return session;
  };

  /* ---------- Analytics over stored attempts ---------- */
  const A = (SP.analytics = {});

  A.attemptsFor = (D, studentId) => D.attempts.filter(a => a.studentId === studentId).sort((a, b) => a.date.localeCompare(b.date));

  // Latest evidence per skill for one student, with history for trend.
  A.status = function (D, studentId) {
    const res = {};
    A.attemptsFor(D, studentId).forEach(at => {
      const sum = E.summarise(at.responses);
      Object.entries(sum).forEach(([sk, v]) => {
        const h = (res[sk] = res[sk] || { history: [] });
        h.history.push({ date: at.date, attemptId: at.id, assessmentId: at.assessmentId, score: v.score, n: v.n, label: v.label, mis: v.mis });
      });
    });
    Object.values(res).forEach(h => {
      const cur = h.history[h.history.length - 1];
      Object.assign(h, { score: cur.score, n: cur.n, label: cur.label, date: cur.date, mis: cur.mis });
      const prev = h.history.length > 1 ? h.history[h.history.length - 2] : null;
      h.change = null;
      if (prev && prev.n >= 2 && cur.n >= 2) {
        const d = cur.score - prev.score;
        h.change = d >= 0.2 ? 'up' : d <= -0.2 ? 'down' : 'steady';
      }
    });
    return res;
  };

  A.classDistribution = function (D, studentIds) {
    const dist = {};
    SP.skills.forEach(s => (dist[s.id] = { Secure: 0, Developing: 0, 'Needs practice': 0, 'Not enough evidence': 0, total: 0 }));
    studentIds.forEach(id => {
      const st = A.status(D, id);
      SP.skills.forEach(s => {
        const e = st[s.id];
        const lab = e ? e.label : 'Not enough evidence';
        dist[s.id][lab]++; dist[s.id].total++;
      });
    });
    return dist;
  };

  A.classMisconceptions = function (D, studentIds) {
    const m = {};
    studentIds.forEach(id => {
      const st = A.status(D, id);
      Object.entries(st).forEach(([sk, e]) => {
        Object.entries(e.mis || {}).forEach(([mid, cnt]) => {
          const r = (m[mid] = m[mid] || { id: mid, students: [], repeated: 0 });
          r.students.push({ id, count: cnt });
          if (cnt >= 2) r.repeated++;
        });
      });
    });
    return Object.values(m).sort((a, b) => b.students.length - a.students.length);
  };
})();
