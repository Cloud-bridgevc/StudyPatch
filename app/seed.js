/* Seed data: ALL FICTIONAL. Names, classes, scores and dates are invented for demonstration. */
(function () {
  const SP = (window.SP = window.SP || {});

  SP.seed = function () {
    const r = SP.rng(20261009);
    const bank = SP.baseQuestions.map(q => JSON.parse(JSON.stringify(q)));

    const users = [
      { id: 'T1', name: 'Ms. Grace Okafor', role: 'teacher', email: 'g.okafor@demo-school.example', status: 'active', mfa: true, classes: ['C1', 'C2'] },
      { id: 'T2', name: 'Mr. Daniel Reyes', role: 'teacher', email: 'd.reyes@demo-school.example', status: 'active', mfa: true, classes: [] },
      { id: 'A1', name: 'Mr. Samir Patel', role: 'admin', email: 's.patel@demo-school.example', status: 'active', mfa: true, classes: [] }
    ];
    const classes = [
      { id: 'C1', name: 'Year 7 Maths: Set A', teacherId: 'T1', year: 'Year 7' },
      { id: 'C2', name: 'Year 7 Maths: Set B', teacherId: 'T1', year: 'Year 7' }
    ];
    const namesA = ['Ines Park', 'Mateo Alvarez', 'Amara Okoye', 'Leo Fischer', 'Priya Nair', 'Jonas Berg', 'Sofia Rossi', 'Tariq Haddad', 'Maya Chen', 'Elliot Brooks', 'Zara Ahmed', 'Noah Kowalski'];
    const namesB = ['Lucas Moreau', 'Aisha Bello', 'Ravi Menon', 'Hannah Lee', 'Diego Santos', 'Freya Nilsson', 'Kofi Mensah', 'Yuki Tanaka'];
    const students = [];
    namesA.forEach((n, i) => students.push({ id: 'S' + String(i + 1).padStart(2, '0'), pid: '7A-' + String(i + 1).padStart(2, '0'), name: n, classId: 'C1', active: true }));
    namesB.forEach((n, i) => students.push({ id: 'S' + String(i + 13).padStart(2, '0'), pid: '7B-' + String(i + 1).padStart(2, '0'), name: n, classId: 'C2', active: true }));

    const mean = { DEC: 3.6, FRC: 3.4, FOP: 2.4, INT: 2.8, OOP: 3.4, RAT: 3.0, PCT: 3.2, EXP: 3.0, EQN: 2.3, GEO: 3.8 };
    const misBySkill = {};
    Object.entries(SP.mis).forEach(([id, m]) => (misBySkill[m.skill] = misBySkill[m.skill] || []).push(id));

    const profiles = {};
    students.forEach(s => {
      const shift = s.classId === 'C2' ? 0.3 : 0;
      const levels = {}, held = [];
      SP.skills.forEach(k => {
        const L = Math.max(0.6, Math.min(5.5, mean[k.id] + shift + (r() - 0.5) * 2.2));
        levels[k.id] = L;
        if (L < 3.0 && r() < 0.75) held.push(misBySkill[k.id][r() < 0.65 ? 0 : Math.min(1, misBySkill[k.id].length - 1)]);
      });
      profiles[s.id] = { levels, held };
    });
    // Demo student "Ines Park" has a deliberate, readable profile.
    profiles.S01 = { levels: { DEC: 3.6, FRC: 3.4, FOP: 1.6, INT: 1.9, OOP: 3.3, RAT: 3.0, PCT: 3.2, EXP: 3.0, EQN: 2.2, GEO: 3.8 }, held: ['FRAC_ACROSS', 'NEG_SIGN', 'EQN_OPS'] };

    const allSkills = SP.skills.map(s => s.id);
    const assessments = [
      { id: 'A1', title: 'Autumn baseline diagnostic', skills: allSkills, classIds: ['C1', 'C2'], status: 'published', created: '2026-09-08', due: '2026-09-12',
        config: { minQ: 14, maxQ: 22, minDiff: 1, maxDiff: 5, startDiff: 2, maxPerSkill: 3, followUps: true, showSummary: true } },
      { id: 'A2', title: 'Fractions, integers & operations check-in', skills: ['FRC', 'FOP', 'INT', 'OOP'], classIds: ['C1', 'C2'], status: 'published', created: '2026-09-29', due: '2026-10-02',
        config: { minQ: 8, maxQ: 12, minDiff: 1, maxDiff: 4, startDiff: 2, maxPerSkill: 3, followUps: true, showSummary: true } },
      { id: 'A3', title: 'Algebra readiness check', skills: ['EXP', 'EQN', 'OOP', 'INT'], classIds: ['C1', 'C2'], status: 'published', created: '2026-10-08', due: '2026-10-16',
        config: { minQ: 8, maxQ: 12, minDiff: 1, maxDiff: 5, startDiff: 2, maxPerSkill: 3, followUps: true, showSummary: true } }
    ];

    const attempts = [];
    let aid = 1;
    function run(a, date, prof, sid) {
      const sess = SP.engine.simulate(a, bank, prof, r);
      attempts.push({ id: 'AT' + aid++, assessmentId: a.id, studentId: sid, date, complete: true, responses: sess.responses });
    }
    students.forEach(s => run(assessments[0], '2026-09-1' + (1 + Math.floor(r() * 2)), profiles[s.id], s.id));
    students.forEach((s, i) => {
      if (i === 5 || i === 15) return; // absent for the check-in
      const p = JSON.parse(JSON.stringify(profiles[s.id]));
      const worked = r() < 0.6;
      ['FRC', 'FOP', 'INT', 'OOP'].forEach(k => { p.levels[k] += worked ? 0.6 + r() * 0.6 : (r() - 0.6) * 0.5; });
      if (s.id === 'S01') { p.levels.FOP += 0.2; p.levels.INT += 0.1; }
      p.held = p.held.filter(m => !(['FRC', 'FOP', 'INT', 'OOP'].includes(SP.mis[m].skill) && worked && r() < 0.4 && s.id !== 'S01'));
      run(assessments[1], '2026-10-0' + (1 + Math.floor(r() * 2)), p, s.id);
    });

    const D = { v: 1, users, classes, students, bank, assessments, attempts, practiceSets: [], practiceResponses: [], audit: [], objectives: {},
      settings: { retentionAssessmentMonths: 24, retentionPracticeMonths: 12, retentionAuditMonths: 36, pseudonymiseAfterMonths: 12, deleteOnLeavingDays: 90, dailyGenCap: 40, studentHints: true, minCell: 5 } };

    // Seed pre-approved practice for the demo student, and two drafts awaiting review.
    function mk(skill, mis, targets, status, classId) {
      const ps = SP.ai.generatePractice({ skill, mis, rng: r, bank, targets, classId });
      ps.status = status;
      if (status === 'approved') { ps.reviewer = 'T1'; ps.reviewedOn = '2026-10-05'; ps.note = 'Take your time with the fraction strips. Ask me if a step is unclear.'; }
      D.practiceSets.push(ps);
      return ps;
    }
    mk('FOP', 'FRAC_ACROSS', ['S01'], 'approved');
    mk('INT', 'NEG_SIGN', ['S01'], 'approved');
    const withMis = m => SP.analytics.classMisconceptions(D, students.filter(s => s.classId === 'C1').map(s => s.id)).find(x => x.id === m);
    ['OOP_LTR', 'EQN_OPS'].forEach(m => {
      const f = withMis(m);
      if (f) mk(SP.mis[m].skill, m, f.students.map(x => x.id), 'draft', 'C1');
    });
    const dr = SP.ai.generateQuestions({ skill: 'FOP', d: 3, n: 3, rng: r });
    dr.forEach(q => bank.push(q));

    D.audit.push({ t: '2026-10-09T08:02:00', who: 'Ms. Grace Okafor', role: 'teacher', ev: 'Signed in (MFA)', detail: 'Demo session' });
    return D;
  };
})();
