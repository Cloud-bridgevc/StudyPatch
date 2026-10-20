/* Public site behaviour: mobile menu, sample assessment demo, demo-request form. */
(function () {
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const mb = $('#menuBtn'), nav = $('#mainnav');
  mb.addEventListener('click', () => { const o = nav.classList.toggle('open'); mb.setAttribute('aria-expanded', o); });
  nav.addEventListener('click', e => { if (e.target.tagName === 'A') { nav.classList.remove('open'); mb.setAttribute('aria-expanded', false); } });

  /* ---------- Sample maths assessment (fictional learner, fictional questions) ---------- */
  const MIS = {
    FRAC_ACROSS: { name: 'Adding across numerators and denominators', why: 'Choosing 2/5 for 1/2 + 1/3 is consistent with adding the tops and the bottoms separately.',
      ex: ['What is 1/4 + 1/3?', 'What is 1/2 + 1/5?', 'What is 2/3 + 1/4?'], hint: 'Hint: what must be true about the pieces before you can add them?', worked: 'Worked example: 1/2 + 1/3 → common denominator 6 → 3/6 + 2/6 = 5/6.' },
    NEG_SIGN: { name: 'Sign errors when subtracting negatives', why: 'Answering −2 for −3 − 5 is consistent with subtracting the smaller size from the larger rather than moving left on the number line.',
      ex: ['What is −4 − 6?', 'The temperature is −2°C and falls by 5°C. What is it now?', 'What is −7 − 3?'], hint: 'Hint: subtracting moves you left on a number line.', worked: 'Worked example: −3 − 5 → start at −3, move 5 left → −8.' },
    OOP_LTR: { name: 'Working strictly left to right', why: 'Choosing 20 for 2 + 3 × 4 is consistent with calculating from left to right without giving multiplication priority.',
      ex: ['What is 5 + 2 × 6?', 'What is 3 + 4 × 5?', 'What is 10 + 3 × 2?'], hint: 'Hint: which operation groups tighter, + or ×?', worked: 'Worked example: 2 + 3 × 4 → 3 × 4 = 12 first → 2 + 12 = 14.' },
    PCT_WHOLE: { name: 'Treating the percent as a plain number', why: 'Answering 20 for “20% of 60” is consistent with reporting the percent figure itself.',
      ex: ['What is 10% of 80?', 'What is 25% of 40?', 'What is 50% of 30?'], hint: 'Hint: 20% means 20 out of every 100.', worked: 'Worked example: 20% of 60 → 60 × 20 ÷ 100 = 12.' },
    EQN_OPS: { name: 'Stopping early when solving equations', why: 'Answering x = 21 for 3x − 5 = 16 is consistent with undoing the “−5” but not dividing by 3.',
      ex: ['Solve 2x + 3 = 11', 'Solve 4x − 2 = 14', 'Solve 3x + 5 = 20'], hint: 'Hint: undo the last operation first, then the one before it.', worked: 'Worked example: 3x − 5 = 16 → +5 → 3x = 21 → ÷3 → x = 7.' }
  };
  const QS = [
    { q: 'What is 1/2 + 1/3?', o: ['2/5', '5/6', '1/6'], a: 1, m: { 0: 'FRAC_ACROSS' } },
    { q: 'What is −3 − 5?', o: ['−2', '−8', '8'], a: 1, m: { 0: 'NEG_SIGN' } },
    { q: 'What is 2 + 3 × 4?', o: ['20', '14', '24'], a: 1, m: { 0: 'OOP_LTR' } },
    { q: 'What is 20% of 60?', o: ['20', '12', '80'], a: 1, m: { 0: 'PCT_WHOLE' } },
    { q: 'Solve 3x − 5 = 16', o: ['x = 21', 'x = 7', 'x = 9'], a: 1, m: { 0: 'EQN_OPS' } }
  ];
  const qbox = $('#sampleQs');
  qbox.innerHTML = QS.map((x, i) => `<fieldset class="dq" style="border:1px solid var(--line)"><legend style="padding:0 .3rem"><b>Question ${i + 1}</b></legend><p>${esc(x.q)}</p>${x.o.map((t, j) => `<label><input type="radio" name="q${i}" value="${j}"> ${esc(t)}</label>`).join('')}</fieldset>`).join('');

  function showResults(ev) {
    ev && ev.preventDefault();
    const out = $('#sampleOut'), picks = QS.map((x, i) => { const r = document.querySelector(`input[name=q${i}]:checked`); return r ? Number(r.value) : null; });
    if (picks.some(p => p === null)) { out.innerHTML = '<h3>Almost there</h3><p>Please answer all five questions, or choose “Show example mistakes”.</p>'; return; }
    const found = []; let right = 0;
    picks.forEach((p, i) => { if (p === QS[i].a) right++; else if (QS[i].m[p]) found.push(QS[i].m[p]); });
    let html = `<h3>${right} of ${QS.length} correct</h3><p class="hint">Here’s what a teacher would see. It’s evidence from five items, not a verdict on the learner.</p>`;
    if (!found.length) html += '<div class="result good">No repeated reasoning patterns detected. A teacher might offer extension questions.</div>';
    found.forEach(id => { html += `<div class="result"><strong>${esc(MIS[id].name)}</strong><br>${esc(MIS[id].why)}</div>`; });
    if (found.length) {
      const m = MIS[found[0]];
      html += `<h3>Proposed targeted practice</h3><div class="ex" id="exBox"><span class="badge badge-ai">✦ AI-generated draft</span><span class="state badge badge-warn" id="exState">Waiting for teacher review</span>
        <p style="margin:.6rem 0 .3rem"><strong>Patch: ${esc(m.name)}</strong></p><p class="hint">${esc(m.worked)}</p><ol>${m.ex.map(e => `<li>${esc(e)}</li>`).join('')}</ol><p class="hint">${esc(m.hint)}</p>
        <div class="cta" style="margin:.5rem 0 0"><button class="btn btn-primary btn-sm" data-s="Approved &amp; assigned" data-c="badge-ok">Approve &amp; assign</button><button class="btn btn-secondary btn-sm" data-s="Edited by teacher" data-c="badge-indigo">Edit</button><button class="btn btn-danger btn-sm" data-s="Rejected" data-c="badge-muted">Reject</button></div></div>
        <p class="hint">Nothing reaches a student until the teacher approves. In production the draft comes from Amazon Bedrock; this demo uses pre-written examples.</p>`;
      if (found.length > 1) html += `<p class="hint">Other patterns would each get their own draft in the review queue.</p>`;
    }
    out.innerHTML = html;
    const box = $('#exBox');
    if (box) box.addEventListener('click', e => { const b = e.target.closest('button[data-s]'); if (!b) return; const s = $('#exState'); s.className = 'state badge ' + b.dataset.c; s.innerHTML = b.dataset.s; });
  }
  $('#sample').addEventListener('submit', showResults);
  $('#fillMistakes').addEventListener('click', () => { QS.forEach((x, i) => { const el = document.querySelector(`input[name=q${i}][value="${i % 2 === 0 ? 0 : x.a}"]`); el.checked = true; }); const el = document.querySelector('input[name=q4][value="0"]'); el.checked = true; showResults(); });
  $('#resetSample').addEventListener('click', () => { $('#sample').reset(); $('#sampleOut').innerHTML = '<h3>Your results will appear here</h3><p class="hint">All questions and the fictional learner in this demo are made up. Nothing is stored or sent anywhere.</p>'; });

  /* ---------- Demo request form ---------- */
  const form = $('#demoForm');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(form), err = $('#formErr'), v = k => String(fd.get(k) || '').trim();
    err.textContent = '';
    if (v('website')) return; // honeypot
    if (!v('name') || !v('org') || !v('type')) { err.textContent = 'Please complete name, organisation and type.'; return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v('email'))) { err.textContent = 'Please enter a valid work email.'; return; }
    if (!fd.get('consent')) { err.textContent = 'Please agree to be contacted so we can respond.'; return; }
    const [first, ...rest] = v('name').split(/\s+/), cfg = (window.STUDYPATCH_CONFIG || {}).hubspot || {};
    const payload = {
      fields: [['firstname', first], ['lastname', rest.join(' ')], ['email', v('email')], ['company', v('org')], ['jobtitle', v('role')], ['organisation_type', v('type')], ['student_count_band', v('size')], ['demo_message', v('message')]]
        .filter(f => f[1]).map(f => ({ objectTypeId: '0-1', name: f[0], value: f[1] })),
      context: { pageUri: location.href.split('#')[0], pageName: document.title },
      legalConsentOptions: { consent: { consentToProcess: true, text: 'I agree that StudyPatch may contact me about this request.',
        communications: fd.get('marketing') && cfg.marketingSubscriptionTypeId ? [{ value: true, subscriptionTypeId: Number(cfg.marketingSubscriptionTypeId), text: 'Send me occasional product updates.' }] : [] } }
    };
    const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      if (cfg.portalId && cfg.formGuid) {
        const r = await fetch(`https://api.hsforms.com/submissions/v3/integration/submit/${encodeURIComponent(cfg.portalId)}/${encodeURIComponent(cfg.formGuid)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!r.ok) throw new Error('HubSpot responded ' + r.status);
      }
      form.hidden = true; $('#formOk').hidden = false; $('#formOk').focus();
    } catch (x) { err.textContent = 'Sorry, we couldn’t send that. Please try again in a moment.'; btn.disabled = false; }
  });
})();
