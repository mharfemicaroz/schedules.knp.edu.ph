// Keep the backend copy in services/schedule/teachingOverload.js in parity (tested).
const amount = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const clean = (value) => Math.round(value * 1e9) / 1e9;
const wholeHours = (units) => Math.abs(units / 3 - Math.round(units / 3)) < 1e-8;

function balancePartTime(firstUnits, secondUnits) {
  let first = firstUnits, second = secondUnits;
  const total = first + second;
  if (first > 12 && second < 12) { const moved = Math.min(first - 12, 12 - second); first -= moved; second += moved; }
  else if (second > 12 && first < 12) { const moved = Math.min(second - 12, 12 - first); second -= moved; first += moved; }
  if (first > 12 || second > 12) {
    const candidates = [];
    for (let candidateFirst = 0; candidateFirst <= total; candidateFirst += 3) {
      candidates.push({ first: candidateFirst, second: total - candidateFirst });
    }
    candidates.sort((a, b) => Number(wholeHours(b.second)) - Number(wholeHours(a.second))
      || Math.abs(a.first - a.second) - Math.abs(b.first - b.second) || b.first - a.first);
    if (candidates.length) ({ first, second } = candidates[0]);
  }
  return { first, second };
}

function allocateTeaching(first, second, releaseFirst, releaseSecond) {
  const total = clean(first + second);
  const candidates = new Set([0, total]);
  // Test only the useful breakpoints: the current split, equal split, 4-hour
  // boundaries and their neighboring multiples of 3. Work stays constant-sized.
  const mod = (value) => ((value % 3) + 3) % 3;
  for (const residue of [0, mod(total), mod(-releaseFirst), mod(total + releaseSecond)]) {
    for (const target of [first, total / 2, 12 - releaseFirst, total + releaseSecond - 12, 0, total]) {
      const near = (target - residue) / 3;
      for (const step of [Math.floor(near), Math.ceil(near)]) {
        const value = clean(residue + step * 3);
        if (value >= 0 && value <= total) candidates.add(value);
      }
    }
  }
  const splits = Array.from(candidates).map((value) => {
    const remainder = clean(total - value);
    return { first: value, second: remainder,
      fractionalCredits: Number(!wholeHours(value + releaseFirst)) + Number(!wholeHours(remainder + releaseSecond)),
      fractionalTeaching: Number(!wholeHours(value)) + Number(!wholeHours(remainder)),
      distributionPenalty: total + releaseFirst + releaseSecond <= 24
        ? Math.max(0, value + releaseFirst - 12) + Math.max(0, remainder + releaseSecond - 12)
        : Math.abs(value + releaseFirst - remainder - releaseSecond),
      distance: Math.abs(value - first) };
  });
  splits.sort((a, b) => a.fractionalCredits - b.fractionalCredits
    || a.distributionPenalty - b.distributionPenalty
    || a.fractionalTeaching - b.fractionalTeaching || a.distance - b.distance || b.first - a.first);
  return splits[0];
}

function computeTeachingOverload(termUnits = {}, nstpTermUnits = {}, releaseUnits = 0, employment = "") {
  const firstOnly = Math.max(0, amount(termUnits["1st"]) - amount(nstpTermUnits["1st"]));
  const secondOnly = Math.max(0, amount(termUnits["2nd"]) - amount(nstpTermUnits["2nd"]));
  const sem = Math.max(0, amount(termUnits.Sem) - amount(nstpTermUnits.Sem));
  const partTime = /part\s*-?\s*time/i.test(String(employment));
  // Part-time Sem treatment and accounting remain unchanged.
  const semPerTerm = partTime ? sem : sem / 2;
  const effectiveFirstUnits = clean(firstOnly + semPerTerm);
  const effectiveSecondUnits = clean(secondOnly + semPerTerm);
  const initialFirstUnits = partTime ? effectiveFirstUnits : Math.max(0, effectiveFirstUnits - 12);
  const initialSecondUnits = partTime ? effectiveSecondUnits : Math.max(0, effectiveSecondUnits - 12);
  const assignedReleaseUnits = partTime ? 0 : amount(releaseUnits);
  const teachingShortfallUnits = partTime ? 0 : Math.max(0, clean(24 - firstOnly - secondOnly - sem));
  const releaseDeductedUnits = Math.min(assignedReleaseUnits, teachingShortfallUnits);
  const releaseCreditUnits = clean(assignedReleaseUnits - releaseDeductedUnits);
  const releaseFirstUnits = releaseCreditUnits / 2;
  const releaseSecondUnits = releaseCreditUnits - releaseFirstUnits;
  // Offset an underloaded term against the other term before allocating credits.
  // The semester total is authoritative, independent of the original term split.
  const semesterOverload = partTime ? initialFirstUnits + initialSecondUnits
    : Math.max(0, firstOnly + secondOnly + sem - 24);
  const offset = clean(initialFirstUnits + initialSecondUnits - semesterOverload);
  const firstTeaching = Math.max(0, clean(initialFirstUnits - (initialFirstUnits >= initialSecondUnits ? offset : 0)));
  const secondTeaching = Math.max(0, clean(initialSecondUnits - (initialSecondUnits > initialFirstUnits ? offset : 0)));
  const adjusted = partTime ? balancePartTime(firstTeaching, secondTeaching)
    : allocateTeaching(firstTeaching, secondTeaching, releaseFirstUnits, releaseSecondUnits);
  const first = clean(adjusted.first + releaseFirstUnits);
  const second = clean(adjusted.second + releaseSecondUnits);
  const teachingOverloadUnits = clean(firstTeaching + secondTeaching);
  return {
    first, second, total: clean(first + second), firstHours: first / 3, secondHours: second / 3,
    totalCreditedHours: clean(first + second) / 3,
    teachingUnits: clean(firstOnly + secondOnly + sem),
    teachingOverloadUnits, teachingOverloadHours: teachingOverloadUnits / 3,
    teachingFirstUnits: adjusted.first, teachingSecondUnits: adjusted.second,
    assignedReleaseUnits, teachingShortfallUnits, releaseDeductedUnits,
    releaseCreditUnits, releaseCreditHours: releaseCreditUnits / 3,
    releaseFirstUnits, releaseSecondUnits,
    underloadOffsetUnits: clean(initialFirstUnits + initialSecondUnits - teachingOverloadUnits),
    effectiveFirstUnits, effectiveSecondUnits, initialFirstUnits, initialSecondUnits,
  };
}

function computeFacultyOverload(faculty, items = []) {
  const termUnits = { "1st": 0, "2nd": 0, Sem: 0 };
  const nstpTermUnits = { "1st": 0, "2nd": 0, Sem: 0 };
  for (const item of items) {
    const raw = String(item.term || item.semester || item.sem || "").trim().toLowerCase();
    const term = raw.startsWith("1") ? "1st" : raw.startsWith("2") ? "2nd" : raw.startsWith("s") ? "Sem" : "";
    if (!term) continue;
    const units = amount(item.unit ?? item.units ?? item.hours);
    termUnits[term] += units;
    const text = [item.courseName, item.course_name, item.code, item.courseTitle, item.course_title, item.title].filter(Boolean).join(" ");
    if (/NSTP/i.test(text)) nstpTermUnits[term] += units;
  }
  return computeTeachingOverload(termUnits, nstpTermUnits,
    faculty?.loadReleaseUnits ?? faculty?.load_release_units ?? faculty?.releaseUnits ?? 0, faculty?.employment || "");
}

export { computeTeachingOverload, computeFacultyOverload };
