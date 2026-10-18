/* Curriculum, skill map, misconceptions and the starter question bank.
   All content is fictional/demo content. Curriculum is a fictional framework. */
(function () {
  const SP = (window.SP = window.SP || {});
  SP.today = '2026-10-09';
  SP.curriculum = 'StudyPatch Demo Framework: Year 7 Mathematics (fictional)';

  SP.skills = [
    { id: 'DEC', name: 'Decimals & place value', pre: [], ref: 'M7.1',
      obj: ['Compare and order decimals using place value', 'Add, subtract and multiply decimals accurately'] },
    { id: 'FRC', name: 'Fraction concepts', pre: [], ref: 'M7.2',
      obj: ['Compare and order fractions', 'Recognise and generate equivalent fractions'] },
    { id: 'FOP', name: 'Fraction operations', pre: ['FRC'], ref: 'M7.3',
      obj: ['Add and subtract fractions with unlike denominators', 'Multiply and divide fractions'] },
    { id: 'INT', name: 'Integers & negatives', pre: [], ref: 'M7.4',
      obj: ['Add and subtract positive and negative integers', 'Multiply integers, including negatives'] },
    { id: 'OOP', name: 'Order of operations', pre: [], ref: 'M7.5',
      obj: ['Apply BIDMAS/PEMDAS consistently', 'Evaluate expressions with brackets and powers'] },
    { id: 'RAT', name: 'Ratio & proportion', pre: ['FRC'], ref: 'M7.6',
      obj: ['Scale quantities in proportion', 'Share a quantity in a given ratio'] },
    { id: 'PCT', name: 'Percentages', pre: ['FRC', 'DEC'], ref: 'M7.7',
      obj: ['Find a percentage of an amount', 'Solve simple percentage change problems'] },
    { id: 'EXP', name: 'Algebraic expressions', pre: ['OOP', 'INT'], ref: 'M7.8',
      obj: ['Simplify expressions by collecting like terms', 'Expand single brackets'] },
    { id: 'EQN', name: 'Linear equations', pre: ['EXP', 'INT'], ref: 'M7.9',
      obj: ['Solve one- and two-step equations', 'Solve equations that include brackets'] },
    { id: 'GEO', name: 'Area & perimeter', pre: ['DEC'], ref: 'M7.10',
      obj: ['Calculate area and perimeter of rectangles', 'Calculate the area of triangles'] }
  ];
  SP.skillById = Object.fromEntries(SP.skills.map(s => [s.id, s]));

  // Misconception catalogue. "pattern" language is deliberately non-diagnostic.
  SP.mis = {
    DEC_LONGER: { skill: 'DEC', name: 'Longer decimal treated as larger', desc: 'Responses are consistent with comparing decimals as if they were whole numbers (e.g. 0.45 > 0.5 because 45 > 5).', move: 'Use a place-value chart or number line to compare 0.5 and 0.45 side by side.' },
    DEC_ALIGN: { skill: 'DEC', name: 'Decimal point not aligned / misplaced', desc: 'Responses are consistent with adding or multiplying digits as whole numbers and then misplacing the decimal point.', move: 'Estimate first, then check the answer is sensible; use column layouts with aligned points.' },
    BIGGER_DENOM: { skill: 'FRC', name: 'Larger denominator treated as larger fraction', desc: 'Responses are consistent with comparing denominators only (1/5 judged bigger than 1/3).', move: 'Fold paper or draw equal bars: more pieces means smaller pieces.' },
    FRAC_EQUIV: { skill: 'FRC', name: 'Equivalent fractions by adding, not multiplying', desc: 'Responses are consistent with adding the same number to numerator and denominator rather than scaling both.', move: 'Show equivalence with multiplication tables / area models: scale both parts by the same factor.' },
    FRAC_ACROSS: { skill: 'FOP', name: 'Operating across numerators and denominators', desc: 'Responses are consistent with adding numerators and denominators separately (1/2 + 1/3 = 2/5), or not rescaling numerators.', move: 'Use fraction strips to show why a common denominator is needed before adding.' },
    FRAC_DIV: { skill: 'FOP', name: 'Fraction division rule applied incorrectly', desc: 'Responses are consistent with multiplying instead of dividing, or inverting the wrong fraction.', move: 'Ask "how many halves fit in three quarters?" with diagrams before the rule.' },
    NEG_SIGN: { skill: 'INT', name: 'Sign errors with negatives', desc: 'Responses are consistent with ignoring or mishandling signs when subtracting or crossing zero.', move: 'Use a number line and temperature contexts; move left to subtract, right to add.' },
    NEG_MULT: { skill: 'INT', name: 'Negative × negative treated as negative', desc: 'Responses are consistent with the product of two negatives being negative.', move: 'Pattern-building: 3×−2, 2×−2, 1×−2, 0×−2, −1×−2 ... and watch the pattern continue.' },
    OOP_LTR: { skill: 'OOP', name: 'Operations performed left to right', desc: 'Responses are consistent with evaluating strictly left to right without precedence.', move: 'Build expressions with real contexts (2 + 3 bags of 4) to show why multiplication groups first.' },
    RATIO_ADD: { skill: 'RAT', name: 'Additive instead of multiplicative scaling', desc: 'Responses are consistent with adding the same amount to each part rather than multiplying.', move: 'Use ratio tables and double number lines to scale by a common factor.' },
    RATIO_PARTWHOLE: { skill: 'RAT', name: 'Part and whole confused in ratio sharing', desc: 'Responses are consistent with treating ratio numbers as counts or using the wrong part of the total.', move: 'Bar models: total parts first (3 + 5 = 8), then value of one part.' },
    PCT_WHOLE: { skill: 'PCT', name: 'Percent treated as a plain number', desc: 'Responses are consistent with reporting the percent figure itself or dividing by it.', move: 'Link to fractions and benchmarks: 50% = 1/2, 10% = 1/10; build up from 10%.' },
    PCT_DISCOUNT: { skill: 'PCT', name: 'Discount amount reported as final price', desc: 'Responses are consistent with stopping after finding the percentage, not subtracting it.', move: 'Underline what the question asks for; use a two-step flow: find change, then apply it.' },
    EXP_LIKE: { skill: 'EXP', name: 'Combining terms incorrectly', desc: 'Responses are consistent with squaring/multiplying like terms, or combining unlike terms.', move: 'Algebra tiles: x and 1 are different objects, so 4a + 3 cannot merge.' },
    EXP_DISTRIB: { skill: 'EXP', name: 'Distributing to the first term only', desc: 'Responses are consistent with multiplying only the first term inside brackets.', move: 'Area model of 3(x + 4): two rectangles, both multiplied by 3.' },
    EQN_OPS: { skill: 'EQN', name: 'Inverse operations applied incompletely or with wrong sign', desc: 'Responses are consistent with undoing steps in the wrong direction or stopping before the final step.', move: 'Balance-scale model; record each step done to both sides.' },
    AREA_PERIM: { skill: 'GEO', name: 'Area and perimeter confused', desc: 'Responses are consistent with swapping the area and perimeter calculations.', move: 'Tile a rectangle (area) and walk its edge with string (perimeter).' },
    PERIM_STEPS: { skill: 'GEO', name: 'Multi-step perimeter reasoning incomplete', desc: 'Responses are consistent with stopping partway through a perimeter-to-side-length problem.', move: 'Sketch and label all four sides; write the perimeter equation.' },
    TRI_HALF: { skill: 'GEO', name: 'Triangle area without halving', desc: 'Responses are consistent with computing base × height without the one-half factor.', move: 'Show two copies of the triangle forming a rectangle.' }
  };

  // Q(id, skill, difficulty 1-5, stem, [[text, misconceptionId?]...], correctIndex)
  function Q(id, skill, d, stem, opts, ans) {
    return { id, skill, d, stem, opts: opts.map(o => ({ t: o[0], m: o[1] || null })), ans,
      source: 'library', status: 'approved', author: 'StudyPatch library (reviewed)', created: '2026-08-20' };
  }
  SP.baseQuestions = [
    Q('Q01', 'DEC', 1, 'Which of these decimals is the largest?', [['0.45', 'DEC_LONGER'], ['0.5'], ['0.405', 'DEC_LONGER'], ['0.095']], 1),
    Q('Q02', 'DEC', 2, 'What is 3.2 + 0.45?', [['3.65'], ['0.77', 'DEC_ALIGN'], ['3.25', 'DEC_ALIGN'], ['4.65']], 0),
    Q('Q03', 'DEC', 3, 'What is 0.6 × 0.3?', [['1.8', 'DEC_ALIGN'], ['0.18'], ['0.9'], ['0.018', 'DEC_ALIGN']], 1),
    Q('Q04', 'FRC', 1, 'Which fraction is larger: 1/3 or 1/5?', [['1/3'], ['1/5', 'BIGGER_DENOM'], ['They are equal'], ['Cannot tell without a picture']], 0),
    Q('Q05', 'FRC', 2, 'Which fraction is equivalent to 2/3?', [['3/4', 'FRAC_EQUIV'], ['4/6'], ['2/6', 'FRAC_EQUIV'], ['4/5', 'FRAC_EQUIV']], 1),
    Q('Q06', 'FRC', 3, 'Which list is in order from smallest to largest?', [['1/2, 2/5, 3/8', 'BIGGER_DENOM'], ['3/8, 2/5, 1/2'], ['2/5, 3/8, 1/2'], ['3/8, 1/2, 2/5']], 1),
    Q('Q07', 'FOP', 2, 'What is 1/2 + 1/3?', [['2/5', 'FRAC_ACROSS'], ['5/6'], ['2/6', 'FRAC_ACROSS'], ['1/6']], 1),
    Q('Q08', 'FOP', 3, 'What is 2/3 + 3/4?', [['5/7', 'FRAC_ACROSS'], ['5/12', 'FRAC_ACROSS'], ['17/12'], ['11/12']], 2),
    Q('Q09', 'FOP', 4, 'What is 3/4 ÷ 1/2?', [['3/8', 'FRAC_DIV'], ['3/2'], ['2/3', 'FRAC_DIV'], ['1/4']], 1),
    Q('Q10', 'INT', 1, 'What is −3 − 5?', [['−2', 'NEG_SIGN'], ['−8'], ['2', 'NEG_SIGN'], ['8']], 1),
    Q('Q11', 'INT', 2, 'The temperature is −4°C and rises by 7°C. What is the new temperature?', [['−11°C', 'NEG_SIGN'], ['3°C'], ['−3°C', 'NEG_SIGN'], ['11°C', 'NEG_SIGN']], 1),
    Q('Q12', 'INT', 3, 'What is (−4) × (−3)?', [['−12', 'NEG_MULT'], ['12'], ['−7', 'NEG_SIGN'], ['1']], 1),
    Q('Q13', 'INT', 4, 'What is −6 − (−2)?', [['−8', 'NEG_SIGN'], ['−4'], ['4', 'NEG_SIGN'], ['8', 'NEG_SIGN']], 1),
    Q('Q14', 'OOP', 2, 'What is 2 + 3 × 4?', [['20', 'OOP_LTR'], ['14'], ['24'], ['9']], 1),
    Q('Q15', 'OOP', 3, 'What is 18 − 6 ÷ 3?', [['4', 'OOP_LTR'], ['16'], ['12'], ['3']], 1),
    Q('Q16', 'OOP', 4, 'What is (2 + 3)² − 4 × 2?', [['42', 'OOP_LTR'], ['17'], ['2', 'OOP_LTR'], ['13']], 1),
    Q('Q17', 'RAT', 2, 'A recipe uses 2 cups of flour for 3 people. How many cups are needed for 9 people?', [['8', 'RATIO_ADD'], ['6'], ['18'], ['4.5']], 1),
    Q('Q18', 'RAT', 3, 'Boys to girls is 3 : 5 in a class of 24. How many girls are there?', [['9', 'RATIO_PARTWHOLE'], ['5', 'RATIO_PARTWHOLE'], ['15'], ['19', 'RATIO_ADD']], 2),
    Q('Q19', 'RAT', 4, '5 pens cost $3.50. How much do 8 pens cost?', [['$6.50', 'RATIO_ADD'], ['$5.60'], ['$4.90'], ['$56.00', 'DEC_ALIGN']], 1),
    Q('Q20', 'PCT', 1, 'What is 50% of 80?', [['50', 'PCT_WHOLE'], ['40'], ['160'], ['30']], 1),
    Q('Q21', 'PCT', 3, 'What is 20% of 60?', [['20', 'PCT_WHOLE'], ['3', 'PCT_WHOLE'], ['12'], ['80']], 2),
    Q('Q22', 'PCT', 4, 'A $40 jacket is reduced by 25%. What is the sale price?', [['$10', 'PCT_DISCOUNT'], ['$30'], ['$50'], ['$15']], 1),
    Q('Q23', 'EXP', 2, 'Simplify 3x + 2x', [['5x²', 'EXP_LIKE'], ['5x'], ['6x', 'EXP_LIKE'], ['5']], 1),
    Q('Q24', 'EXP', 3, 'Simplify 4a + 3 + 2a', [['9a', 'EXP_LIKE'], ['6a + 3'], ['9', 'EXP_LIKE'], ['24a']], 1),
    Q('Q25', 'EXP', 4, 'Expand 3(x + 4)', [['3x + 4', 'EXP_DISTRIB'], ['3x + 12'], ['x + 12'], ['3x + 7']], 1),
    Q('Q26', 'EQN', 2, 'Solve x + 7 = 12', [['19', 'EQN_OPS'], ['5'], ['7'], ['−5', 'EQN_OPS']], 1),
    Q('Q27', 'EQN', 3, 'Solve 3x − 5 = 16', [['x = 11/3', 'EQN_OPS'], ['x = 21', 'EQN_OPS'], ['x = 7'], ['x = 9']], 2),
    Q('Q28', 'EQN', 5, 'Solve 2(x + 3) = 18', [['x = 7.5', 'EXP_DISTRIB'], ['x = 6'], ['x = 15', 'EQN_OPS'], ['x = 12']], 1),
    Q('Q29', 'GEO', 1, 'A rectangle is 5 cm by 3 cm. What is its area?', [['16 cm²', 'AREA_PERIM'], ['15 cm²'], ['8 cm²', 'AREA_PERIM'], ['30 cm²']], 1),
    Q('Q30', 'GEO', 3, 'A rectangle has perimeter 24 cm and length 7 cm. What is its width?', [['17 cm', 'PERIM_STEPS'], ['5 cm'], ['10 cm', 'PERIM_STEPS'], ['168 cm', 'AREA_PERIM']], 1),
    Q('Q31', 'GEO', 4, 'A triangle has base 8 cm and height 5 cm. What is its area?', [['40 cm²', 'TRI_HALF'], ['20 cm²'], ['13 cm²', 'AREA_PERIM'], ['26 cm²', 'AREA_PERIM']], 1)
  ];
})();
