// utils/facultyScoring.js
import { parseF2FDays, parseTimeBlockToMinutes } from "../utils/conflicts";

export const normalizeSem = (s) => {
  const v = String(s || "")
    .trim()
    .toLowerCase();
  if (!v) return "";
  if (v.startsWith("1")) return "1st";
  if (v.startsWith("2")) return "2nd";
  if (v.startsWith("s")) return "Sem";
  return s;
};

export const buildIndexes = (courses) => {
  const byFac = new Map();
  const bySecTerm = new Map();
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  (courses || []).forEach((r) => {
    const idKey = r.facultyId != null ? `id:${r.facultyId}` : "";
    const nmKey = norm(r.facultyName || r.faculty || r.instructor);
    if (idKey) {
      const a = byFac.get(idKey) || [];
      a.push(r);
      byFac.set(idKey, a);
    }
    if (nmKey) {
      const a = byFac.get(`nm:${nmKey}`) || [];
      a.push(r);
      byFac.set(`nm:${nmKey}`, a);
    }
    const sec = norm(r.section || "");
    const term = String(r.term || "")
      .trim()
      .toLowerCase();
    const k = `${sec}|${term}`;
    const arr = bySecTerm.get(k) || [];
    arr.push(r);
    bySecTerm.set(k, arr);
  });
  return { byFac, bySecTerm };
};

export const buildFacultyStats = (faculties, courses) => {
  const indexes = buildIndexes(courses);
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  const termOf = (r) =>
    String(r.term || "")
      .trim()
      .toLowerCase();
  const timeKeyOf = (r) => {
    const s = String(r.scheduleKey || r.schedule || r.time || "").trim();
    const start = Number.isFinite(r.timeStartMinutes)
      ? r.timeStartMinutes
      : undefined;
    const end = Number.isFinite(r.timeEndMinutes)
      ? r.timeEndMinutes
      : undefined;
    if (Number.isFinite(start) && Number.isFinite(end))
      return `${start}-${end}`;
    const tr = parseTimeBlockToMinutes(s);
    return Number.isFinite(tr.start) && Number.isFinite(tr.end)
      ? `${tr.start}-${tr.end}`
      : s.toLowerCase();
  };
  const map = new Map();
  (faculties || []).forEach((f) => {
    const fid = f.id != null ? String(f.id) : "";
    const nm = norm(f.name || f.faculty || f.full_name || "");
    const rows = (indexes.byFac.get(`id:${fid}`) || []).concat(
      indexes.byFac.get(`nm:${nm}`) || []
    );
    const seen = new Set();
    let units = 0,
      coursesCnt = 0;
    for (const r of rows) {
      const code = String(r.code || r.courseName || "")
        .trim()
        .toLowerCase();
      const sec = norm(r.section || "");
      const term = termOf(r);
      const tk = timeKeyOf(r);
      if (!code || !sec) continue;
      const k = [code, sec, term || "n/a", tk || ""].join("|");
      if (seen.has(k)) continue;
      seen.add(k);
      units += Number(r.unit ?? r.hours ?? 0) || 0;
      coursesCnt += 1;
    }
    const release =
      Number(f.loadReleaseUnits ?? f.load_release_units ?? 0) || 0;
    const baseline = 24;
    const overload = Math.max(0, units - baseline);
    map.set(String(f.id), {
      load: units,
      release,
      overload,
      courses: coursesCnt,
    });
  });
  return map;
};

// utils/facultyScoring.js (continuation)

const termOrder = (t) => {
  const s = String(t || "").toLowerCase();
  const years = Array.from(s.matchAll(/(20\d{2})/g)).map((m) =>
    parseInt(m[1], 10)
  );
  let year = years.length ? Math.min(...years) : NaN;
  let sem = 0;
  if (/summer|mid\s*year|midyear/.test(s)) sem = 3;
  else if (/(^|[^a-z])2(nd)?([^a-z]|$)|\bsem\s*2\b|\bterm\s*2\b/.test(s))
    sem = 2;
  else if (/(^|[^a-z])1(st)?([^a-z]|$)|\bsem\s*1\b|\bterm\s*1\b/.test(s))
    sem = 1;
  else if (/\b3(rd)?\b/.test(s)) sem = 3;
  if (!sem) sem = /2(nd)?|second/.test(s) ? 2 : 1;
  if (!Number.isFinite(year)) {
    const yy = s.match(/\b(\d{2})\s*[-/]\s*(\d{2})\b/);
    if (yy) {
      const y = parseInt(yy[1], 10);
      year = 2000 + y;
    }
  }
  if (!Number.isFinite(year)) return NaN;
  return year * 10 + sem;
};

export const buildFacultyScoreMap = ({
  faculties,
  stats,
  indexesAll,
  schedule,
  attendanceStats = undefined,
  penaltyConfig = undefined,
}) => {
  const norm = (s) => String(s || "").toLowerCase();
  const deptOf = (f) => String(f.department || f.dept || "");
  const prog = String(
    schedule?.program || schedule?.programcode || ""
  ).toLowerCase();
  const progKey = String(schedule?.program || schedule?.programcode || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
  const schedDept = String(schedule?.dept || "").toLowerCase();
  const timeStr = String(
    schedule?.scheduleKey || schedule?.schedule || schedule?.time || ""
  ).trim();
  const tr = parseTimeBlockToMinutes(timeStr);
  const candMid =
    Number.isFinite(tr.start) && Number.isFinite(tr.end)
      ? (tr.start + tr.end) / 2
      : NaN;
  const term = String(schedule?.term || "")
    .trim()
    .toLowerCase();
  const candTermNorm = normalizeSem(schedule?.term);
  const candDays = (() => {
    const arr = parseF2FDays(
      schedule?.f2fDays ||
        schedule?.f2fSched ||
        schedule?.f2fsched ||
        schedule?.day
    );
    return Array.isArray(arr) && arr.length ? arr : ["ANY"];
  })();
  const bandOf = (mid) => (Number.isFinite(mid) && mid < 12 * 60 ? "AM" : "PM");
  const sessionOf = (mid) => {
    const m = Number.isFinite(mid) ? mid : NaN;
    if (!Number.isFinite(m)) return "AM";
    if (m >= 17 * 60) return "EVE";
    if (m >= 13 * 60) return "PM";
    return "AM";
  };
  const candBand = bandOf(candMid);
  const candSession = (() => {
    const raw = String(schedule?.session || "")
      .trim()
      .toUpperCase();
    if (raw === "AM" || raw === "PM" || raw === "EVE" || raw === "EVENING")
      return raw === "EVENING" ? "EVE" : raw;
    return sessionOf(candMid);
  })();
  const candTermOrder = termOrder(term);
  const tok = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  const normalizeTight = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  const hasDigits = (s) => /\d/.test(String(s || ""));

  const levenshtein = (a, b) => {
    if (a === b) return 0;
    const m = a.length,
      n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    let prev = new Array(n + 1);
    let curr = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      const ca = a.charCodeAt(i - 1);
      for (let j = 1; j <= n; j++) {
        const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
        const del = prev[j] + 1;
        const ins = curr[j - 1] + 1;
        const sub = prev[j - 1] + cost;
        curr[j] = del < ins ? (del < sub ? del : sub) : ins < sub ? ins : sub;
      }
      const tmp = prev;
      prev = curr;
      curr = tmp;
    }
    return prev[n];
  };
  const simRatio = (a, b) => {
    if (!a && !b) return 1;
    if (!a || !b) return 0;
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    const d = levenshtein(a, b);
    return Math.max(0, 1 - d / maxLen);
  };
  const dice2Gram = (a, b) => {
    a = normalizeTight(a);
    b = normalizeTight(b);
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return simRatio(a, b);
    const grams = (s) => {
      const map = new Map();
      for (let i = 0; i < s.length - 1; i++) {
        const g = s.slice(i, i + 2);
        map.set(g, (map.get(g) || 0) + 1);
      }
      return map;
    };
    const ga = grams(a),
      gb = grams(b);
    let inter = 0;
    for (const [g, ca] of ga.entries()) {
      const cb = gb.get(g);
      if (cb) inter += Math.min(ca, cb);
    }
    const total =
      Array.from(ga.values()).reduce((s, v) => s + v, 0) +
      Array.from(gb.values()).reduce((s, v) => s + v, 0);
    return total ? (2 * inter) / total : 0;
  };
  const tokenFuzzyBestRatio = (queryTokens, poolTokens) => {
    if (!queryTokens.length || !poolTokens.length) return 0;
    let sum = 0;
    for (const q of queryTokens) {
      let best = 0;
      for (const p of poolTokens) {
        const r = simRatio(q, p);
        if (r > best) best = r;
        if (best >= 1) break;
      }
      sum += best;
    }
    return sum / queryTokens.length;
  };
  // Topic-vector helpers for content-level similarity
  const toTokens = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t && t.length >= 3);
  const extractTags = (r) => {
    const t = r?.courseTopics || r?.topics || r?.tags || r?.subjectTags || null;
    if (Array.isArray(t) && t.length)
      return t.map((x) => String(x).toLowerCase());
    const code = String(r?.code || r?.courseName || "");
    const title = String(r?.title || r?.courseTitle || "");
    return Array.from(new Set(toTokens(code).concat(toTokens(title))));
  };
  const toVec = (arr) => {
    const m = new Map();
    (arr || []).forEach((k) => m.set(k, (m.get(k) || 0) + 1));
    return m;
  };
  const cosine = (a, b) => {
    if (!a || !b || a.size === 0 || b.size === 0) return 0;
    let dot = 0,
      na = 0,
      nb = 0;
    a.forEach((va, k) => {
      const vb = b.get(k) || 0;
      dot += va * vb;
      na += va * va;
    });
    b.forEach((vb) => (nb += vb * vb));
    if (na === 0 || nb === 0) return 0;
    return dot / Math.sqrt(na * nb);
  };
  const candCodeTokens = tok(schedule?.code || schedule?.courseName || "");
  const candTitleTokens = tok(schedule?.title || schedule?.courseTitle || "");
  const candTokens = Array.from(
    new Set(candCodeTokens.concat(candTitleTokens))
  );
  const candCodeJoined = normalizeTight(
    String(schedule?.code || schedule?.courseName || "")
  );
  const candTitleJoined = normalizeTight(
    String(schedule?.title || schedule?.courseTitle || "")
  );
  const codeHasDigits = hasDigits(candCodeJoined);

  const map = new Map();

  (faculties || []).forEach((f) => {
    const stat = stats.get(String(f.id)) || {
      load: 0,
      release: 0,
      overload: 0,
      courses: 0,
    };
    const rowsAll = (indexesAll.byFac.get(`id:${f.id}`) || []).concat(
      indexesAll.byFac.get(`nm:${norm(f.name || f.faculty || f.full_name)}`) ||
        []
    );

    const d = deptOf(f).toLowerCase();
    let wProg = 0,
      wTot = 0;
    if (rowsAll.length) {
      for (const r of rowsAll) {
        const rProgKey = String(
          r.programcode || r.program || r.program_code || r.programCode || ""
        )
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "")
          .trim();
        const rTerm = String(r.term || "")
          .trim()
          .toLowerCase();
        const rOrd = termOrder(rTerm);
        if (
          Number.isFinite(candTermOrder) &&
          Number.isFinite(rOrd) &&
          rOrd > candTermOrder
        )
          continue;
        let rec = 1;
        if (Number.isFinite(candTermOrder) && Number.isFinite(rOrd)) {
          const dOrd = Math.max(0, candTermOrder - rOrd);
          rec = Math.pow(0.75, dOrd);
          if (rec < 0.25) rec = 0.25;
        }
        const wUnits = Math.max(0.5, Number(r.unit || 0) || 1);
        const w = rec * wUnits;
        wTot += w;
        if (progKey && rProgKey && rProgKey === progKey) wProg += w;
      }
    }
    const progFreq = wTot > 0 ? (wProg + 0.5) / (wTot + 1) : 0.5;
    let deptAlign = 0.6;
    if (prog && d.includes(prog)) deptAlign = 1.0;
    else if (schedDept && d === schedDept) deptAlign = 0.85;
    let deptScore = 0.75 * progFreq + 0.25 * deptAlign;

    const emp = norm(f.employment);
    let empScore = 0.6;
    if (emp.includes("full")) empScore = 1.0;
    else if (emp.includes("knp")) empScore = 0.85;
    else if (emp.includes("part")) empScore = 0.7;

    const textParts = [
      String(f.name || ""),
      String(f.faculty || ""),
      String(f.full_name || ""),
      String(f.designation || ""),
      String(f.rank || ""),
      String(f.title || ""),
      String(f.credentials || ""),
      String(f.degree || ""),
      String(f.degrees || ""),
      String(f.qualification || ""),
      String(f.qualifications || ""),
    ];
    const nameLikeParts = [
      String(f.name || ""),
      String(f.faculty || ""),
      String(f.full_name || ""),
    ];
    try {
      const ra = (indexesAll.byFac.get(`id:${f.id}`) || []).concat(
        indexesAll.byFac.get(
          `nm:${String(f.name || f.faculty || "")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "")}`
        ) || []
      );
      ra.forEach((r) => {
        textParts.push(
          String(r.instructor || r.faculty || r.facultyName || "")
        );
        if (r.facultyProfile) {
          const p = r.facultyProfile;
          textParts.push(
            String(p.designation || ""),
            String(p.rank || ""),
            String(p.credentials || "")
          );
        }
        nameLikeParts.push(String(r.instructor || ""));
      });
    } catch {}

    try {
      const extTokens = [];
      nameLikeParts.forEach((raw) => {
        const s = String(raw || "").trim();
        if (!s || s.indexOf(",") === -1) return;
        const segs = s
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        if (segs.length >= 2) {
          const lastSeg = segs[segs.length - 1];
          if (lastSeg && /[a-z]/i.test(lastSeg) && lastSeg.length <= 16)
            extTokens.push(lastSeg);
          const secondSeg = segs[1];
          if (secondSeg) {
            const lead = secondSeg.split(/\s+/)[0];
            if (lead && /[a-z]/i.test(lead) && lead.length <= 16)
              extTokens.push(lead);
          }
        }
      });
      if (extTokens.length) textParts.push(extTokens.join(" "));
    } catch {}

    const sourceName = String(f.faculty || "").trim();
    const toks = [];
    if (sourceName) {
      const sUp = sourceName.toUpperCase();
      const parts = sUp
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= 2) {
        const last = parts[parts.length - 1];
        last
          .split(/\s+/)
          .forEach((w) => toks.push(w.replace(/\.+/g, "").toUpperCase()));
        const afterFirst = parts[1]?.split(/\s+/)[0] || "";
        if (afterFirst) toks.push(afterFirst.replace(/\.+/g, "").toUpperCase());
      } else {
        const w = sUp.split(/\s+/).pop();
        if (w) toks.push(w.replace(/\.+/g, "").toUpperCase());
      }
      const firstSeg = parts[0] || "";
      const lead = firstSeg.split(/\s+/)[0] || "";
      if (lead) toks.push(lead.replace(/\.+/g, "").toUpperCase());
    }

    const tokens = Array.from(new Set(toks))
      .filter((t) => t && t.length >= 2 && t.length <= 12)
      .filter(
        (t) =>
          ![
            "JR",
            "SR",
            "II",
            "III",
            "IV",
            "V",
            "VI",
            "VII",
            "VIII",
            "IX",
            "X",
            "R",
            "MR",
            "MRS",
            "MS",
            "MA",
          ].includes(t)
      );

    const docSet = new Set([
      "PHD",
      "EDD",
      "SCD",
      "DRPH",
      "DBA",
      "DPA",
      "DENG",
      "DIT",
      "DIS",
      "DSM",
      "DR",
      "DOCTOR",
      "DOCTORATE",
    ]);
    const masSet = new Set([
      "MAED",
      "MED",
      "MAT",
      "MSC",
      "MSIT",
      "MSCS",
      "MIT",
      "MENG",
      "MBA",
      "MPA",
      "MPM",
      "MMATH",
      "MTECH",
      "MA",
      "MS",
      "MSCJ",
      "MASTER",
      "MASTERS",
      "MASTERAL",
    ]);
    const licSet = new Set([
      "LPT",
      "RN",
      "RMT",
      "RPH",
      "RSW",
      "RCH",
      "RCRIM",
      "RGC",
      "REE",
      "RME",
      "RCE",
      "RCHE",
      "RA",
      "RLA",
      "RL",
      "PRC",
      "LICENSED",
      "REGISTERED",
    ]);

    let nDoc = 0,
      nMas = 0,
      nLic = 0,
      nAtty = 0,
      nCpa = 0,
      nEng = 0,
      nArx = 0;

    const credParts = [
      String(f.credentials || ""),
      String(f.degree || ""),
      String(f.degrees || ""),
      String(f.qualification || ""),
      String(f.qualifications || ""),
    ];
    try {
      const ra = (indexesAll.byFac.get(`id:${f.id}`) || []).concat(
        indexesAll.byFac.get(
          `nm:${String(f.name || f.faculty || "")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "")}`
        ) || []
      );
      ra.forEach((r) => {
        if (r?.facultyProfile?.credentials)
          credParts.push(String(r.facultyProfile.credentials));
      });
    } catch {}
    const splitTokens = (s) =>
      String(s || "")
        .toUpperCase()
        .replace(/[^A-Z0-9\s\.]/g, " ")
        .split(/[\s,]+/)
        .filter(Boolean)
        .map((t) => t.replace(/\.+/g, ""));
    const tokensAllUpper = new Set(
      tokens
        .concat(credParts.flatMap(splitTokens))
        .map((t) => t.replace(/\.+/g, "").toUpperCase())
    );
    tokensAllUpper.forEach((tt) => {
      if (docSet.has(tt)) nDoc++;
      if (masSet.has(tt)) nMas++;
      if (licSet.has(tt)) nLic++;
      if (tt === "ATTY" || tt === "JD") nAtty++;
      if (tt === "CPA") nCpa++;
      if (tt === "ENGR") nEng++;
      if (tt === "ARCH") nArx++;
    });
    const nLicTotal = nLic;

    // Degree: diminishing returns via exponential
    const alphaMas = 0.35;
    const alphaDoc = 1.1;
    const alphaLic = 0.12;
    const extraJD = nAtty > 0 ? 0.6 : 0;
    const extraCPA = nCpa > 0 ? 0.5 : 0;
    const extraEngArx = (nEng > 0 ? 0.2 : 0) + (nArx > 0 ? 0.2 : 0);
    const expoSum =
      alphaMas * nMas +
      alphaDoc * nDoc +
      alphaLic * nLicTotal +
      extraJD +
      extraCPA +
      extraEngArx;
    let degreeScore = 1 - Math.exp(-Math.max(0, expoSum));
    if (degreeScore === 0) {
      const bachelorSet = new Set([
        "BS",
        "BA",
        "AB",
        "BSC",
        "BSED",
        "BEED",
        "BSEE",
        "BSECE",
        "BSA",
      ]);
      let hasBachelor = false;
      tokensAllUpper.forEach((tt) => {
        if (bachelorSet.has(tt)) hasBachelor = true;
      });
      if (hasBachelor) degreeScore = 0.2;
    }
    degreeScore = Math.max(0, Math.min(1, degreeScore));

    const rows = rowsAll.filter((r) => {
      const rNorm = normalizeSem(r.term);
      return candTermNorm ? rNorm === candTermNorm : true;
    });

    const timePoints = [];
    if (rowsAll.length) {
      rowsAll.forEach((r) => {
        const rTerm = String(r.term || "")
          .trim()
          .toLowerCase();
        const rOrd = termOrder(rTerm);
        if (
          Number.isFinite(candTermOrder) &&
          Number.isFinite(rOrd) &&
          rOrd > candTermOrder
        )
          return;
        let s = r.timeStartMinutes,
          e = r.timeEndMinutes;
        const tS = String(r.scheduleKey || r.schedule || r.time || "").trim();
        if (!Number.isFinite(s) || !Number.isFinite(e)) {
          const tt = parseTimeBlockToMinutes(tS);
          s = tt.start;
          e = tt.end;
        }
        if (!Number.isFinite(s) || !Number.isFinite(e)) return;
        const mid = (s + e) / 2;
        const wUnits = Math.max(0.5, Number(r.unit || 0) || 1);
        const w = wUnits;
        const days = parseF2FDays(
          r.f2fDays || r.f2fSched || r.f2fsched || r.day
        );
        const band = bandOf(mid);
        const sess = sessionOf(mid);
        if (days && days.length) {
          days.forEach((d) => timePoints.push({ day: d, band, sess, mid, w }));
        } else {
          timePoints.push({ day: "ANY", band, sess, mid, w });
        }
      });
    }
    const byDayBand = new Map();
    const byDay = new Map();
    let gSum = 0,
      gW = 0;
    timePoints.forEach((p) => {
      const k = `${p.day}|${p.band}`;
      const a = byDayBand.get(k) || [];
      a.push(p);
      byDayBand.set(k, a);
      const ad = byDay.get(p.day) || [];
      ad.push(p);
      byDay.set(p.day, ad);
      gSum += p.mid * p.w;
      gW += p.w;
    });
    const gMean = gW > 0 ? gSum / gW : NaN;
    let gVarNum = 0;
    if (gW > 0) {
      timePoints.forEach((p) => {
        gVarNum += p.w * (p.mid - gMean) * (p.mid - gMean);
      });
    }
    const gSigma = gW > 0 ? Math.sqrt(gVarNum / gW) : NaN;
    const minSigma = 45;
    const dayBandStats = new Map();
    byDayBand.forEach((arr, k) => {
      let s = 0,
        w = 0;
      arr.forEach((p) => {
        s += p.mid * p.w;
        w += p.w;
      });
      const mean = w > 0 ? s / w : NaN;
      let varNum = 0;
      if (w > 0)
        arr.forEach((p) => {
          varNum += p.w * (p.mid - mean) * (p.mid - mean);
        });
      let sigma = w > 0 ? Math.sqrt(varNum / w) : NaN;
      if (!Number.isFinite(sigma) || sigma < minSigma)
        sigma = Math.max(minSigma, Number.isFinite(gSigma) ? gSigma : minSigma);
      dayBandStats.set(k, { mean, sigma, w });
    });
    const dayStats = new Map();
    byDay.forEach((arr, d) => {
      let s = 0,
        w = 0;
      arr.forEach((p) => {
        s += p.mid * p.w;
        w += p.w;
      });
      const mean = w > 0 ? s / w : NaN;
      let varNum = 0;
      if (w > 0)
        arr.forEach((p) => {
          varNum += p.w * (p.mid - mean) * (p.mid - mean);
        });
      let sigma = w > 0 ? Math.sqrt(varNum / w) : NaN;
      if (!Number.isFinite(sigma) || sigma < minSigma)
        sigma = Math.max(minSigma, Number.isFinite(gSigma) ? gSigma : minSigma);
      dayStats.set(d, { mean, sigma, w });
    });
    const getStat = (d, b) =>
      dayBandStats.get(`${d}|${b}`) ||
      dayStats.get(d) ||
      (Number.isFinite(gMean)
        ? {
            mean: gMean,
            sigma: Math.max(
              minSigma,
              Number.isFinite(gSigma) ? gSigma : minSigma
            ),
            w: gW,
          }
        : null);

    let probBest = 0;
    if (Number.isFinite(candMid) && timePoints.length > 0) {
      for (const d of candDays) {
        const st = getStat(d, candBand);
        if (!st) continue;
        const z = Math.abs(candMid - st.mean) / (st.sigma || minSigma);
        const prob = Math.exp(-0.5 * z * z);
        if (prob > probBest) probBest = prob;
      }
    }
    const kdeH = 60;
    const kde = (arr) => {
      let num = 0,
        den = 0;
      for (const p of arr) {
        const diff = (candMid - p.mid) / kdeH;
        const k = Math.exp(-0.5 * diff * diff);
        num += p.w * k;
        den += p.w;
      }
      return den > 0 ? num / den : 0;
    };
    let kdeBest = 0;
    if (Number.isFinite(candMid) && timePoints.length > 0) {
      for (const d of candDays) {
        const arrDB = byDayBand.get(`${d}|${candBand}`);
        if (arrDB && arrDB.length) kdeBest = Math.max(kdeBest, kde(arrDB));
        const arrD = byDay.get(d);
        if (arrD && arrD.length) kdeBest = Math.max(kdeBest, kde(arrD));
      }
      if (kdeBest === 0) kdeBest = kde(timePoints);
    }
    let sessionMatch = 0.5;
    if (timePoints.length) {
      const sessW = new Map();
      timePoints.forEach((p) =>
        sessW.set(p.sess, (sessW.get(p.sess) || 0) + p.w)
      );
      const tot = Array.from(sessW.values()).reduce((s, v) => s + v, 0);
      const sw = sessW.get(candSession) || 0;
      sessionMatch = tot > 0 ? sw / tot : 0.5;
    }
    let nearest = 0;
    if (Number.isFinite(candMid) && rows.length) {
      let minDiff = Infinity;
      rows.forEach((r) => {
        let s = r.timeStartMinutes,
          e = r.timeEndMinutes;
        const tS = String(r.scheduleKey || r.schedule || r.time || "").trim();
        if (!Number.isFinite(s) || !Number.isFinite(e)) {
          const tt = parseTimeBlockToMinutes(tS);
          s = tt.start;
          e = tt.end;
        }
        if (Number.isFinite(s) && Number.isFinite(e)) {
          const mid = (s + e) / 2;
          const d = Math.abs(candMid - mid);
          if (d < minDiff) minDiff = d;
        }
      });
      nearest = Math.max(0, 1 - minDiff / 240);
    }
    let timeScore = 0.7;
    if (Number.isFinite(candMid) && timePoints.length > 0) {
      timeScore =
        0.4 * kdeBest + 0.25 * probBest + 0.2 * nearest + 0.15 * sessionMatch;
      const dayFreq = new Map();
      timePoints.forEach((p) =>
        dayFreq.set(p.day, (dayFreq.get(p.day) || 0) + p.w)
      );
      let topDay = null,
        topW = -1;
      dayFreq.forEach((w, d) => {
        if (w > topW) {
          topW = w;
          topDay = d;
        }
      });
      if (topDay && candDays.includes(topDay))
        timeScore = Math.min(1, timeScore + 0.05);
      // Fatigue/Fairness: penalize extra very early/late loads
      const isEarly = Number.isFinite(candMid) && candMid < 9 * 60;
      const isLate = Number.isFinite(candMid) && candMid > 18 * 60;
      if (isEarly || isLate) {
        let countEL = 0;
        rows.forEach((r) => {
          let s = r.timeStartMinutes,
            e = r.timeEndMinutes;
          const tS = String(r.scheduleKey || r.schedule || r.time || "").trim();
          if (!Number.isFinite(s) || !Number.isFinite(e)) {
            const tt = parseTimeBlockToMinutes(tS);
            s = tt.start;
            e = tt.end;
          }
          if (Number.isFinite(s) && Number.isFinite(e)) {
            const mid = (s + e) / 2;
            if (mid < 9 * 60 || mid > 18 * 60) countEL++;
          }
        });
        if (countEL >= 2) {
          const penalty = Math.min(0.15, 0.05 * (countEL - 1));
          timeScore = Math.max(0, timeScore * (1 - penalty));
        }
      }
    }

    let matchScore = 0.5;
    if (candTokens.length) {
      let best = 0;
      for (const r of rowsAll) {
        const rCodeTokens = tok(r.code || r.courseName || "");
        const rTitleTokens = tok(r.title || r.courseTitle || "");
        const rTokensAll = Array.from(
          new Set(rCodeTokens.concat(rTitleTokens))
        );
        if (!rTokensAll.length) continue;
        const rCodeJoined = normalizeTight(
          String(r.code || r.courseName || "")
        );
        const rTitleJoined = normalizeTight(
          String(r.title || r.courseTitle || "")
        );
        if (candCodeJoined && rCodeJoined && candCodeJoined === rCodeJoined) {
          best = 1;
          break;
        }
        const codeTokenMatch = tokenFuzzyBestRatio(
          candCodeTokens,
          rCodeTokens.length ? rCodeTokens : rTokensAll
        );
        const titleTokenMatch = tokenFuzzyBestRatio(
          candTitleTokens,
          rTitleTokens.length ? rTitleTokens : rTokensAll
        );
        const tokenCodeW = codeHasDigits ? 0.88 : 0.82;
        const tokenTitleW = 1 - tokenCodeW;
        const tokenMatch =
          tokenCodeW * codeTokenMatch + tokenTitleW * titleTokenMatch;
        const codeDice = dice2Gram(candCodeJoined, rCodeJoined);
        const titleDice = dice2Gram(candTitleJoined, rTitleJoined);
        const charMatch = 0.8 * codeDice + 0.2 * titleDice;
        let combo = 0.75 * tokenMatch + 0.25 * charMatch;
        const codeNear = Math.max(
          simRatio(candCodeJoined, rCodeJoined),
          codeDice
        );
        if (codeNear >= 0.94) combo = Math.max(combo, 1.0);
        if (combo > best) best = combo;
        if (best >= 1) break;
      }
      const weakThresh = 0.5;
      if (best <= weakThresh) {
        matchScore = 0.5;
      } else {
        const scaled = (best - weakThresh) / (1 - weakThresh);
        matchScore = 0.5 + 0.5 * Math.max(0, Math.min(1, scaled));
      }
    }
    // Content-level similarity blend (cosine on topic vectors)
    try {
      const candTags = extractTags(schedule);
      const facTags = [];
      rowsAll.forEach((r) => facTags.push(...extractTags(r)));
      const sim = cosine(toVec(candTags), toVec(facTags));
      matchScore = Math.min(1, 0.6 * matchScore + 0.4 * sim);
    } catch {}
    // Over-specialization: mild penalty on repeated exact code
    try {
      const candCode = String(schedule?.code || schedule?.courseName || "")
        .trim()
        .toLowerCase();
      if (candCode) {
        let cntSame = 0;
        rowsAll.forEach((r) => {
          const rc = String(r.code || r.courseName || "")
            .trim()
            .toLowerCase();
          if (rc && rc === candCode) cntSame++;
        });
        if (cntSame >= 3) {
          const factor = Math.max(0.85, 1 - 0.03 * (cntSame - 2));
          matchScore = Math.max(0, matchScore * factor);
        }
      }
    } catch {}

    const baseline = 24;
    const loadRatio = baseline > 0 ? (stat.load || 0) / baseline : 1;
    // Smooth logistic around r=0.80
    const rCenter = 0.8,
      kSlope = 8;
    const loadScore = 1 / (1 + Math.exp(kSlope * (loadRatio - rCenter)));
    const overloadScore = Math.max(0, 1 - (stat.overload || 0) / 6);
    // Recency-weighted term experience: frequency in same term
    // The intent is how often a faculty teaches in the same term (1st/2nd/Sem),
    // not just the exact same course code. We weight recent years higher.
    const nowOrd = Number.isFinite(candTermOrder) ? candTermOrder : undefined;
    let sumRecency = 0;
    const uniqueCodes = new Set();
    rows.forEach((r) => {
      const rOrd = termOrder(String(r.term || "").trim().toLowerCase());
      const yearsBack =
        Number.isFinite(nowOrd) && Number.isFinite(rOrd)
          ? Math.max(0, Math.floor((nowOrd - rOrd) / 10))
          : 0;
      const rec = Math.pow(0.8, yearsBack);
      sumRecency += rec;
      const rCode = String(r.code || r.courseName || r.title || r.courseTitle || "")
        .trim()
        .toLowerCase();
      if (rCode) uniqueCodes.add(rCode);
    });
    // Normalize: ~6 recent loads in same term saturates depth, variety of ~6 codes saturates breadth
    const expDepth = Math.min(1, sumRecency / 6);
    const expBreadth = Math.min(1, uniqueCodes.size / 6);
    const expScore = Math.min(1, 0.85 * expDepth + 0.15 * expBreadth);
    // Employment fairness: reduce slightly when overloaded
    if (loadRatio > 1) {
      empScore = Math.max(
        0,
        empScore * (1 - Math.min(0.3, 0.2 * (loadRatio - 1)))
      );
    }
    // Cross-listing tolerance: boost deptScore if strong degree+match
    const strength = (degreeScore + matchScore) / 2;
    if (strength >= 0.8 && progFreq < 0.6) {
      const tol = Math.min(1, (strength - 0.7) / 0.3);
      deptScore = Math.min(1, deptScore + 0.12 * tol * (1 - progFreq));
    }

    // ----- Grades submission factor (same-term rows) -----
    // Uses rows (scoped by same term) when available; otherwise neutral (1.0)
    let gradesFactor = 1.0;
    let gradesPart = 1.0;
    try {
      const cfgG = (penaltyConfig && penaltyConfig.grades) || {
        late: 0.5,
        ontime: -0.02, // small bonus
        early: -0.05, // small bonus
        none: 0,
      };
      let cLate = 0,
        cOntime = 0,
        cEarly = 0,
        denom = 0;
      rows.forEach((r) => {
        const gs = String(r.gradesStatus || r.grades_status || "")
          .trim()
          .toLowerCase();
        if (!gs) return; // unknown or not recorded; stay neutral
        if (gs === "late") cLate++;
        else if (gs === "ontime") cOntime++;
        else if (gs === "early") cEarly++;
        denom++;
      });
      if (denom > 0) {
        const penalty = cfgG.late * (cLate / denom);
        const bonus = Math.max(0, -cfgG.ontime) * (cOntime / denom) +
          Math.max(0, -cfgG.early) * (cEarly / denom);
        const raw = 1 - penalty + bonus;
        gradesFactor = Math.max(0.7, Math.min(1.05, raw));
        gradesPart = Math.max(0, Math.min(1, raw));
      }
    } catch {}

    // ----- Attendance factor (optional external stats) -----
    // Accepts either a Map or plain object keyed by facultyId -> { total, byStatus }
    let attendanceFactor = 1.0;
    let attendancePart = 1.0;
    try {
      const cfgA = (penaltyConfig && penaltyConfig.attendance) || {
        absent: 0.6,
        late: 0.3,
        excused: 0.0,
      };
      const getFrom = (src, key) => {
        if (!src) return undefined;
        if (src instanceof Map) return src.get(String(key));
        if (typeof src === "object") return src[String(key)] || src[key];
        return undefined;
      };
      const att = getFrom(attendanceStats, f.id);
      if (att && typeof att === "object") {
        const by = att.byStatus || att.by_status || {};
        const total = Number(att.total ?? Object.values(by).reduce((s, v) => s + (Number(v) || 0), 0)) || 0;
        if (total > 0) {
          const nAbsent = Number(by.absent || by.ABSENT || 0) || 0;
          const nLate = Number(by.late || by.LATE || 0) || 0;
          const nExcused = Number(by.excused || by.EXCUSED || 0) || 0;
          const pAbsent = nAbsent / total;
          const pLate = nLate / total;
          const pExcused = nExcused / total;
          const penalty = cfgA.absent * pAbsent + cfgA.late * pLate + cfgA.excused * pExcused;
          const raw = 1 - penalty;
          attendanceFactor = Math.max(0.7, Math.min(1.0, raw));
          attendancePart = Math.max(0, Math.min(1, raw));
        }
      }
    } catch {}

    const score01 =
      0.15 * deptScore +
      0.05 * empScore +
      0.22 * degreeScore +
      0.18 * timeScore +
      0.1 * loadScore +
      0.04 * overloadScore +
      0.08 * expScore +
      0.18 * matchScore;
    // Apply attendance and grades submission factors multiplicatively
    const score = Math.max(1, Math.min(10, score01 * 10 * attendanceFactor * gradesFactor));
    map.set(String(f.id), {
      score,
      parts: {
        dept: deptScore,
        employment: empScore,
        degree: degreeScore,
        time: timeScore,
        load: loadScore,
        overload: overloadScore,
        termExp: expScore,
        match: matchScore,
        attendance: attendancePart,
        grades: gradesPart,
      },
    });
  });

  return map;
};
