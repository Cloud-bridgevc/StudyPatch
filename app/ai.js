/* AI layer (PROTOTYPE).
   Production: question/explanation generation runs on Amazon Bedrock inside a Lambda (see lambda/generate_practice
   and docs/architecture.md). In this offline prototype the same output schema is produced by deterministic,
   misconception-targeted templates so every number can be verified by code. Nothing is ever sent over the network.
   Every generated artefact is labelled AI-generated and starts as a draft that a teacher must approve. */
(function () {
  const SP = (window.SP = window.SP || {});
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const frac = (n, d) => { const g = gcd(Math.abs(n), d) || 1; n /= g; d /= g; return d === 1 ? String(n) : `${n}/${d}`; };
  const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const neg = n => (n < 0 ? '−' + Math.abs(n) : String(n));

  function mcq(r, stem, correct, dis, hints, expl) {
    const seen = new Set([correct]);
    const opts = [{ t: correct, m: null }];
    dis.forEach(([t, m]) => { t = String(t); if (!seen.has(t)) { seen.add(t); opts.push({ t, m: m || null }); } });
    for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
    return { stem, opts, ans: opts.findIndex(o => o.t === correct), hints, explanation: expl };
  }

  const GEN = {
    FRAC_ACROSS(r) {
      let b, d; do { b = ri(r, 2, 6); d = ri(r, 2, 6); } while (b === d || gcd(b, d) !== 1);
      const a = 1, c = 1;
      const num = a * d + c * b, den = b * d;
      return mcq(r, `What is ${a}/${b} + ${c}/${d}?`, frac(num, den),
        [[`${a + c}/${b + d}`, 'FRAC_ACROSS'], [`${a + c}/${b * d}`, 'FRAC_ACROSS'], [`${num}/${b + d}`]],
        ['Can you add pieces of different sizes directly? What needs to match first?', `Find a number both ${b} and ${d} divide into: ${b} × ${d} = ${den}.`, `Rewrite ${a}/${b} as ${a * d}/${den} and ${c}/${d} as ${c * b}/${den}, then add only the numerators.`],
        [`The denominators ${b} and ${d} are different, so the pieces are different sizes.`, `Use a common denominator: ${den}.`, `${a}/${b} = ${a * d}/${den} and ${c}/${d} = ${c * b}/${den}.`, `Add numerators, keep the denominator: ${a * d} + ${c * b} = ${num}, so ${num}/${den}${frac(num, den) !== `${num}/${den}` ? ' = ' + frac(num, den) : ''}.`]);
    },
    BIGGER_DENOM(r) {
      const m = ri(r, 2, 6), n = m + ri(r, 2, 5);
      return mcq(r, `Which fraction is larger: 1/${m} or 1/${n}?`, `1/${m}`,
        [[`1/${n}`, 'BIGGER_DENOM'], ['They are equal'], ['It depends on the picture']],
        ['Imagine a chocolate bar. Which is bigger: a piece when shared between a few people or between many?', `Sharing between ${m} people gives bigger pieces than sharing between ${n}.`, 'The bigger the denominator, the smaller each piece.'],
        [`Both fractions have 1 piece.`, `1/${m} cuts the whole into ${m} equal pieces; 1/${n} cuts it into ${n}.`, `More pieces means each piece is smaller, so 1/${m} is larger.`]);
    },
    DEC_LONGER(r) {
      const t = ri(r, 3, 8), h = ri(r, 5, 9);
      return mcq(r, `Which is larger: 0.${t} or 0.${t - 1}${h}?`, `0.${t}`,
        [[`0.${t - 1}${h}`, 'DEC_LONGER'], ['They are equal']],
        ['Line up the digits by place value: tenths first.', `Compare the tenths digit: ${t} versus ${t - 1}.`, `Write 0.${t} as 0.${t}0 so both have two decimal places.`],
        [`Write both with two decimal places: 0.${t}0 and 0.${t - 1}${h}.`, `Compare tenths: ${t} tenths is more than ${t - 1} tenths.`, `So 0.${t} is larger, even though it has fewer digits.`]);
    },
    DEC_ALIGN(r) {
      const X = ri(r, 1, 5) * 100 + ri(r, 1, 9) * 10, Y = ri(r, 11, 98);
      const S = X + Y, x = (X / 100).toFixed(1), y = (Y / 100).toFixed(2);
      return mcq(r, `What is ${x} + ${y}?`, (S / 100).toFixed(2),
        [[`0.${(X / 10) + Y}`, 'DEC_ALIGN'], [(S / 10).toFixed(1), 'DEC_ALIGN'], [((S + 100) / 100).toFixed(2)]],
        ['Estimate first: about how big should the answer be?', 'Write the numbers in a column with the decimal points lined up.', `Write ${x} as ${x}0, then add hundredths, tenths, then units.`],
        [`Estimate: about ${Math.round(S / 100)}.`, `Line up decimal points: ${x}0 + ${y}.`, `Add from the right: the total is ${(S / 100).toFixed(2)}.`]);
    },
    NEG_SIGN(r) {
      if (r() < 0.5) {
        const a = ri(r, 2, 9), b = ri(r, 2, 9);
        return mcq(r, `What is −${a} − ${b}?`, neg(-(a + b)),
          [[neg(-Math.abs(a - b)), 'NEG_SIGN'], [String(Math.abs(a - b)), 'NEG_SIGN'], [String(a + b), 'NEG_SIGN']],
          ['Picture a number line. Where do you start?', 'Subtracting means moving left.', `Start at −${a} and move ${b} steps left.`],
          [`Start at −${a} on the number line.`, `Subtracting ${b} moves ${b} places to the left.`, `You land on ${neg(-(a + b))}.`]);
      }
      const a = ri(r, 2, 6), b = a + ri(r, 2, 6);
      return mcq(r, `The temperature is −${a}°C and rises by ${b}°C. What is the new temperature?`, `${b - a}°C`,
        [[`${neg(-(a + b))}°C`, 'NEG_SIGN'], [`${neg(-(b - a))}°C`, 'NEG_SIGN'], [`${a + b}°C`, 'NEG_SIGN']],
        ['Rising means moving up the thermometer.', `How many degrees to reach 0 from −${a}?`, `After reaching 0 you still have ${b - a} degrees of rise left.`],
        [`From −${a}, ${a} degrees of rise reaches 0.`, `The remaining rise is ${b} − ${a} = ${b - a}.`, `The new temperature is ${b - a}°C.`]);
    },
    NEG_MULT(r) {
      const a = ri(r, 2, 9), b = ri(r, 2, 9);
      return mcq(r, `What is (−${a}) × (−${b})?`, String(a * b),
        [[neg(-a * b), 'NEG_MULT'], [neg(-(a + b))], [String(a + b)]],
        ['Look at the pattern: 3 × (−2) = −6, 2 × (−2) = −4, 1 × (−2) = −2 ...', 'What happens to the answers as the first number goes down by 1?', 'Continue the pattern past zero.'],
        [`Same signs give a positive product.`, `${a} × ${b} = ${a * b}.`, `So (−${a}) × (−${b}) = ${a * b}.`]);
    },
    OOP_LTR(r) {
      const a = ri(r, 2, 9), b = ri(r, 2, 6), c = ri(r, 2, 6);
      return mcq(r, `What is ${a} + ${b} × ${c}?`, String(a + b * c),
        [[String((a + b) * c), 'OOP_LTR'], [String(a + b + c)], [String(a * b * c)]],
        ['Which operation should be done first, + or ×?', `Work out ${b} × ${c} first.`, `Then add ${a}.`],
        [`Multiplication comes before addition.`, `${b} × ${c} = ${b * c}.`, `${a} + ${b * c} = ${a + b * c}.`]);
    },
    PCT_WHOLE(r) {
      const p = [10, 20, 25, 50][ri(r, 0, 3)], n = [40, 60, 80, 120, 200][ri(r, 0, 4)];
      const ans = (n * p) / 100;
      return mcq(r, `What is ${p}% of ${n}?`, String(ans),
        [[String(p), 'PCT_WHOLE'], [String(+(n / p).toFixed(1)), 'PCT_WHOLE'], [String(n + p)]],
        [`${p}% means ${p} out of every 100.`, `Write ${p}% as a fraction: ${p}/100.`, `Multiply: ${n} × ${p}/100.`],
        [`${p}% = ${p}/100.`, `${n} × ${p} = ${n * p}.`, `${n * p} ÷ 100 = ${ans}.`]);
    },
    RATIO_ADD(r) {
      const x = ri(r, 2, 4), y = ri(r, 2, 4), k = ri(r, 2, 4), Y = y * k;
      return mcq(r, `A recipe uses ${x} cups of flour for ${y} people. How many cups are needed for ${Y} people?`, String(x * k),
        [[String(x + (Y - y)), 'RATIO_ADD'], [String(x * Y)], [String(x * k + 1)]],
        ['Does adding the same number to both parts keep the recipe the same?', `How many times bigger is ${Y} than ${y}?`, `Multiply the flour by ${k} too.`],
        [`${Y} people is ${k} times as many as ${y}.`, `Scale the flour by the same factor: ${x} × ${k} = ${x * k}.`, `Adding keeps the difference, not the proportion.`]);
    },
    EXP_LIKE(r) {
      const a = ri(r, 2, 6), b = ri(r, 2, 6), v = ['x', 'y', 'n', 'a'][ri(r, 0, 3)];
      return mcq(r, `Simplify ${a}${v} + ${b}${v}`, `${a + b}${v}`,
        [[`${a + b}${v}²`, 'EXP_LIKE'], [`${a * b}${v}`, 'EXP_LIKE'], [String(a + b)]],
        [`Think of ${v} as an object, like apples.`, `${a} apples plus ${b} apples is how many apples?`, 'You are counting objects, not multiplying them.'],
        [`${a}${v} means ${a} lots of ${v}.`, `${a} lots + ${b} lots = ${a + b} lots of ${v}.`, `So ${a + b}${v}.`]);
    },
    EXP_DISTRIB(r) {
      const k = ri(r, 2, 6), m = ri(r, 2, 9);
      return mcq(r, `Expand ${k}(x + ${m})`, `${k}x + ${k * m}`,
        [[`${k}x + ${m}`, 'EXP_DISTRIB'], [`x + ${k * m}`], [`${k}x + ${k + m}`]],
        ['Everything inside the bracket gets multiplied.', `Draw a rectangle ${k} tall and (x + ${m}) wide.`, `Find the area of each part: ${k} × x and ${k} × ${m}.`],
        [`Multiply each term in the bracket by ${k}.`, `${k} × x = ${k}x and ${k} × ${m} = ${k * m}.`, `So ${k}x + ${k * m}.`]);
    },
    EQN_OPS(r) {
      const a = ri(r, 2, 5), x = ri(r, 2, 9), b = ri(r, 2, 9), c = a * x - b;
      return mcq(r, `Solve ${a}x − ${b} = ${c}`, `x = ${x}`,
        [[`x = ${frac(c - b, a)}`, 'EQN_OPS'], [`x = ${c + b}`, 'EQN_OPS'], [`x = ${x + 1}`]],
        ['Undo the last operation that was applied to x first.', `Add ${b} to both sides.`, `Then divide both sides by ${a}.`],
        [`Add ${b} to both sides: ${a}x = ${c + b}.`, `Divide both sides by ${a}: x = ${x}.`, `Check: ${a} × ${x} − ${b} = ${c}.`]);
    },
    AREA_PERIM(r) {
      const l = ri(r, 4, 12), w = ri(r, 2, l - 1);
      return mcq(r, `A rectangle is ${l} cm by ${w} cm. What is its area?`, `${l * w} cm²`,
        [[`${2 * (l + w)} cm²`, 'AREA_PERIM'], [`${l + w} cm²`, 'AREA_PERIM'], [`${2 * l * w} cm²`]],
        ['Area is the space inside; perimeter is the distance around.', 'How many square centimetres tile the rectangle?', `Multiply length by width.`],
        [`Area = length × width.`, `${l} × ${w} = ${l * w}.`, `Units are square centimetres: ${l * w} cm².`]);
    },
    FRAC_EQUIV(r) {
      const pairs = [[2, 3], [3, 4], [2, 5], [3, 5]], [n, d] = pairs[ri(r, 0, 3)], k = ri(r, 2, 4);
      return mcq(r, `Which fraction is equivalent to ${n}/${d}?`, `${n * k}/${d * k}`,
        [[`${n + k}/${d + k}`, 'FRAC_EQUIV'], [`${n}/${d * k}`, 'FRAC_EQUIV'], [`${n * k}/${d}`, 'FRAC_EQUIV']],
        ['Equivalent fractions are the same amount cut into more pieces.', 'What do you do to the top and bottom?', `Multiply both by the same number, such as ${k}.`],
        [`Multiply numerator and denominator by ${k}.`, `${n} × ${k} = ${n * k}, ${d} × ${k} = ${d * k}.`, `So ${n}/${d} = ${n * k}/${d * k}.`]);
    }
  };
  SP.hasGenerator = id => !!GEN[id];

  function verify(items) {
    return items.every(it => it.opts.filter((o, i) => i === it.ans).length === 1 &&
      new Set(it.opts.map(o => o.t)).size === it.opts.length && it.ans >= 0);
  }

  SP.ai = {
    labelText: 'AI-generated draft: reviewed and approved by a teacher before students see it',

    generatePractice({ skill, mis, rng, bank, count = 3, targets = [], classId = null, author = 'AI draft' }) {
      const r = rng || Math.random, g = GEN[mis];
      const items = [], stems = new Set();
      let worked = null, fromBank = false;
      if (g) {
        let tries = 0;
        while (items.length < count + 1 && tries++ < 30) {
          const it = g(r);
          if (!stems.has(it.stem)) { stems.add(it.stem); items.push(it); }
        }
        const w = items.shift();
        worked = { stem: w.stem, steps: w.explanation, answer: w.opts[w.ans].t };
      } else {
        fromBank = true;
        (bank || []).filter(q => q.status === 'approved' && q.skill === skill && q.opts.some(o => o.m === mis)).slice(0, count)
          .forEach(q => items.push({ stem: q.stem, opts: q.opts.map(o => ({ ...o })), ans: q.ans,
            hints: ['Read the question again and underline what it asks for.', 'Try an easier version first.', 'Check your answer makes sense.'],
            explanation: [`The correct answer is ${q.opts[q.ans].t}.`] }));
        worked = { stem: 'Worked example to be written by the teacher for this misconception.', steps: [SP.mis[mis].move], answer: '' };
      }
      return {
        id: 'PS-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
        title: `Patch: ${SP.mis[mis].name}`,
        skill, mis, classId, targets: targets.slice(), items, worked,
        status: 'draft', aiGenerated: true, author, created: SP.today,
        reviewer: null, reviewedOn: null, note: '', rejectReason: '',
        checks: { singleCorrectAnswer: verify(items), uniqueOptions: verify(items), answersComputedByCode: !fromBank, sourceNote: fromBank ? 'Built from reviewed bank items (no generator for this misconception).' : 'Prototype template generator. Production uses Bedrock + the same automated checks.' }
      };
    },

    generateQuestions({ skill, d, n, rng }) {
      const r = rng || Math.random;
      const ids = Object.keys(SP.mis).filter(m => SP.mis[m].skill === skill && GEN[m]);
      if (!ids.length) return [];
      const out = [], stems = new Set();
      let tries = 0;
      while (out.length < n && tries++ < 40) {
        const mid = ids[out.length % ids.length], it = GEN[mid](r);
        if (stems.has(it.stem)) continue;
        stems.add(it.stem);
        out.push({ id: 'AI-' + Math.random().toString(36).slice(2, 7).toUpperCase(), skill, d, stem: it.stem, opts: it.opts, ans: it.ans,
          source: 'ai', status: 'pending_review', author: 'AI draft', created: SP.today, explanation: it.explanation });
      }
      return out;
    },

    /* Teacher Intelligence Assistant: grounded summaries computed from stored evidence only. */
    assistant(D, studentIds, kind) {
      const dist = SP.analytics.classDistribution(D, studentIds);
      const mis = SP.analytics.classMisconceptions(D, studentIds);
      const N = studentIds.length;
      const ranked = SP.skills.map(s => ({ s, need: dist[s.id]['Needs practice'], sec: dist[s.id].Secure, dev: dist[s.id].Developing }))
        .sort((a, b) => (b.need + 0.5 * b.dev) - (a.need + 0.5 * a.dev));
      const strong = SP.skills.map(s => ({ s, sec: dist[s.id].Secure })).sort((a, b) => b.sec - a.sec).slice(0, 2);
      const topMis = mis.slice(0, 3);
      const caution = 'Based on a small number of responses per skill. Treat as a starting point for your own judgement.';
      if (kind === 'summary') {
        return { title: 'Class performance summary', caution, bullets: [
          `${N} students in scope. Strongest evidence of secure understanding: ${strong.map(x => `${x.s.name} (${x.sec} of ${N} secure)`).join('; ')}.`,
          `Most students needing practice: ${ranked.slice(0, 3).map(x => `${x.s.name} (${x.need} of ${N})`).join('; ')}.`,
          topMis.length ? `Most common response patterns: ${topMis.map(m => `${SP.mis[m.id].name} (${m.students.length} students)`).join('; ')}.` : 'No repeated response patterns found yet.'] };
      }
      if (kind === 'reteach') {
        return { title: 'Concepts worth revisiting with the whole class', caution, bullets: topMis.map(m => `${SP.mis[m.id].name}: seen in ${m.students.length} of ${N} students (${m.repeated} repeatedly). Teaching idea: ${SP.mis[m.id].move}`), actions: topMis.map(m => ({ label: `Draft practice: ${SP.mis[m.id].name}`, mis: m.id })) };
      }
      if (kind === 'starter') {
        const m = topMis[0];
        return { title: 'A 10-minute starter activity', caution, bullets: m ? [
          `Focus: ${SP.mis[m.id].name}.`, `Hook: put two worked answers on the board, one using the pattern ("${SP.mis[m.id].desc.replace(/^Responses are consistent with /, '').replace(/\.$/, '')}") and one correct. Ask pairs: which is right and how do you know?`,
          `Representation: ${SP.mis[m.id].move}`, 'Exit ticket: 2 questions you write or choose from the approved bank.'] : ['Not enough response data yet.'] };
      }
      if (kind === 'groups') {
        const g = topMis.slice(0, 3).map(m => `${SP.mis[m.id].name}: ${m.students.map(x => (D.students.find(s => s.id === x.id) || {}).name).filter(Boolean).slice(0, 8).join(', ')}${m.students.length > 8 ? '…' : ''}`);
        return { title: 'Possible small groups (grouping is a suggestion, not a label)', caution: caution + ' Groups should be flexible and revisited after the next check.', bullets: g.length ? g : ['Not enough response data yet.'] };
      }
      return { title: 'Not sure how to help with that', caution, bullets: ['Try one of: summarise performance, which concepts to reteach, suggest a starter, or possible small groups.'] };
    }
  };
})();
