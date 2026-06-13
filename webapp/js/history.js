/* ============================================================
   손가락 길잡이 — history.js
   localStorage 저장 / 로드 / 초기화  +  추이 그래프(SVG, 라이브러리 없음)
   ------------------------------------------------------------
   세션 기록 항목:
     ts(ISO), date(표시용), acc(정확도%), finger(올바른운지율% | null),
     wpm(타수 분당), chars(친 글자수), fingerStat({id:{checked,correct}})
   ------------------------------------------------------------
   window.FG.history.load()           : 배열 반환 (손상 JSON 방어)
   window.FG.history.save(session)    : 한 세션 저장 → {ok, list} (ok=저장 성공 여부)
   window.FG.history.clear()          : 기록 전체 삭제
   window.FG.history.renderInto(el)   : 요약 + 추이 그래프 전체 렌더
   ============================================================ */
(function (FG) {
  "use strict";

  var KEY = FG.config.HISTORY_KEY;
  var FINGER_KR = FG.config.FINGER_KR;
  var FINGER_COLOR = FG.config.FINGER_COLOR;
  var ALL_FINGERS = FG.config.ALL_FINGERS;
  var SVG_NS = "http://www.w3.org/2000/svg";

  // ---------- localStorage ----------
  function load() {
    var raw;
    try { raw = localStorage.getItem(KEY); } catch (e) { return []; }
    if (!raw) return [];
    try {
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      // 각 항목 최소 형태 방어
      return arr.filter(function (s) { return s && typeof s === "object"; });
    } catch (e) {
      // 손상 JSON → 빈 배열 (덮어쓰지는 않음; 사용자가 초기화 누를 때만 삭제)
      return [];
    }
  }

  // 저장 성공 여부(ok)와 '저장 후 다시 읽은' 배열(list)을 함께 반환.
  // 결과 패널과 기록 화면이 항상 같은 출처(storage 의 실제 내용)를 쓰게 해 두 뷰의 불일치·조용한 유실을 막는다.
  function save(session) {
    var arr = load();
    arr.push(session);
    // 너무 길어지지 않게 최근 200개만
    if (arr.length > 200) arr = arr.slice(arr.length - 200);
    var ok = true;
    try {
      localStorage.setItem(KEY, JSON.stringify(arr));
    } catch (e) {
      ok = false; // setItem 실패(용량 초과·opaque file:// origin 등) → 조용히 삼키지 않고 알린다
    }
    // 저장 성공 시 storage 를 단일 출처로 재load, 실패 시 인메모리 배열로라도 화면은 보여줌
    var list = ok ? load() : arr;
    return { ok: ok, list: list };
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  // 방금 저장한 세션이 '새 최고 운지율'인지 판정 (이전 기록들과 비교).
  // arr = 저장 직후 전체 배열. 마지막이 최고이고, 이전에 더 높은 게 없으면 true.
  function isNewBestFinger(arr) {
    if (!arr || !arr.length) return false;
    var last = arr[arr.length - 1];
    if (typeof last.finger !== "number") return false;
    for (var i = 0; i < arr.length - 1; i++) {
      if (typeof arr[i].finger === "number" && arr[i].finger >= last.finger) return false;
    }
    return arr.length > 1; // 첫 세션은 비교 대상 없음 → 배지 생략
  }

  // 방금 저장한 게 '첫 기록'인지 (세션 1개) — 동기부여용 첫 달성 배지에 사용.
  function isFirstSession(arr) {
    return !!(arr && arr.length === 1);
  }

  // ---------- SVG helpers ----------
  function svgEl(name, attrs) {
    var n = document.createElementNS(SVG_NS, name);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]);
    return n;
  }

  // 꺾은선 그래프 (운지율 등 0~100 %)
  // opts: {title, values:[num|null], color, unit, max(기본100), goalLine, xLabels:[str]}
  function lineChart(opts) {
    var W = 520, H = 188, PADL = 34, PADR = 12, PADT = 18, PADB = 36;
    var max = opts.max || 100;
    var vals = opts.values;
    var n = vals.length;
    var unit = opts.unit || "";
    // 마지막 'non-null' 인덱스 (최근 세션이 null 이어도 마지막 측정값에 라벨·큰 점)
    var lastIdx = -1;
    for (var li = n - 1; li >= 0; li--) { if (vals[li] != null) { lastIdx = li; break; } }
    // 측정된 점 개수 (3개 이하면 모든 점에 값 라벨)
    var nNonNull = 0;
    for (var ci = 0; ci < n; ci++) if (vals[ci] != null) nNonNull++;
    var labelAll = (nNonNull <= 3);

    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, "class": "chart" });
    // 제목
    var t = svgEl("text", { x: PADL, y: 12, "class": "chart-title" });
    t.textContent = opts.title;
    svg.appendChild(t);

    var plotW = W - PADL - PADR;
    var plotH = H - PADT - PADB;
    function X(i) { return PADL + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1)); }
    function Y(v) { return PADT + plotH - (Math.max(0, Math.min(max, v)) / max) * plotH; }

    // 격자 + y라벨 (0,50,100 식)
    var ticks = [0, max / 2, max];
    ticks.forEach(function (tv) {
      var y = Y(tv);
      svg.appendChild(svgEl("line", { x1: PADL, y1: y, x2: W - PADR, y2: y, "class": "grid" }));
      var lab = svgEl("text", { x: PADL - 6, y: y + 4, "class": "axis-lab", "text-anchor": "end" });
      lab.textContent = Math.round(tv) + unit;
      svg.appendChild(lab);
    });

    // 목표선(예: 운지율 80%)
    if (opts.goalLine != null) {
      var gy = Y(opts.goalLine);
      svg.appendChild(svgEl("line", { x1: PADL, y1: gy, x2: W - PADR, y2: gy, "class": "goal" }));
      var gl = svgEl("text", { x: W - PADR, y: gy - 4, "class": "goal-lab", "text-anchor": "end" });
      gl.textContent = "목표 " + opts.goalLine + unit;
      svg.appendChild(gl);
    }

    // 선 (null 값은 건너뜀 → 측정 안 된 세션)
    var d = "", started = false;
    for (var i = 0; i < n; i++) {
      if (vals[i] == null) { started = false; continue; }
      d += (started ? " L" : " M") + X(i) + " " + Y(vals[i]);
      started = true;
    }
    if (d) svg.appendChild(svgEl("path", { d: d.trim(), "class": "line", stroke: opts.color }));

    // 점 + 값 라벨 (마지막 'non-null' 점을 크게 + 항상 라벨, 점 적으면 모든 점 라벨)
    for (var j = 0; j < n; j++) {
      if (vals[j] == null) continue;
      var isLast = (j === lastIdx);
      svg.appendChild(svgEl("circle", {
        cx: X(j), cy: Y(vals[j]), r: isLast ? 4.5 : 3,
        "class": "dot" + (isLast ? " dot-last" : ""), fill: opts.color
      }));
      if (isLast || labelAll) {
        var vl = svgEl("text", { x: X(j) - 6, y: Y(vals[j]) - 8, "class": "val-lab", "text-anchor": "end" });
        vl.textContent = Math.round(vals[j]) + unit;
        svg.appendChild(vl);
      }
    }

    // x축 라벨 (회차/날짜) — 첫·중간·마지막만 (점이 적으면 전부)
    drawXLabels(svg, opts.xLabels, n, X, PADT + plotH + 14);
    return svg;
  }

  // x축 회차/날짜 라벨을 첫·중간·마지막(또는 점이 적으면 전부) 표기
  function drawXLabels(svg, xLabels, n, X, y) {
    if (!xLabels || !xLabels.length) return;
    var idxs;
    if (n <= 5) {
      idxs = [];
      for (var i = 0; i < n; i++) idxs.push(i);
    } else {
      idxs = [0, Math.floor((n - 1) / 2), n - 1];
    }
    idxs.forEach(function (i) {
      var lab = svgEl("text", { x: X(i), y: y, "class": "axis-lab", "text-anchor": "middle" });
      lab.textContent = xLabels[i];
      svg.appendChild(lab);
    });
  }

  // 막대 그래프 (타수 추이) — 자동 스케일
  function barChart(opts) {
    var W = 520, H = 188, PADL = 34, PADR = 12, PADT = 18, PADB = 36;
    var vals = opts.values;
    var n = vals.length;
    var labelAll = (n <= 3);
    var max = Math.max.apply(null, vals.concat([10]));
    max = Math.ceil(max / 10) * 10 || 10;

    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, "class": "chart" });
    var t = svgEl("text", { x: PADL, y: 12, "class": "chart-title" });
    t.textContent = opts.title;
    svg.appendChild(t);

    var plotW = W - PADL - PADR;
    var plotH = H - PADT - PADB;
    function Y(v) { return PADT + plotH - (v / max) * plotH; }

    [0, max / 2, max].forEach(function (tv) {
      var y = Y(tv);
      svg.appendChild(svgEl("line", { x1: PADL, y1: y, x2: W - PADR, y2: y, "class": "grid" }));
      var lab = svgEl("text", { x: PADL - 6, y: y + 4, "class": "axis-lab", "text-anchor": "end" });
      lab.textContent = Math.round(tv);
      svg.appendChild(lab);
    });

    var slot = plotW / n;
    var bw = Math.min(26, slot * 0.6);
    function BX(i) { return PADL + slot * i + slot / 2; }
    for (var i = 0; i < n; i++) {
      var cx = BX(i);
      var h = (vals[i] / max) * plotH;
      var isLast = (i === n - 1);
      svg.appendChild(svgEl("rect", {
        x: cx - bw / 2, y: PADT + plotH - h, width: bw, height: Math.max(1, h),
        rx: 4, "class": "bar" + (isLast ? " bar-last" : ""), fill: opts.color
      }));
      if (isLast || labelAll) {
        var vl = svgEl("text", { x: cx, y: PADT + plotH - h - 5, "class": "val-lab", "text-anchor": "middle" });
        vl.textContent = Math.round(vals[i]);
        svg.appendChild(vl);
      }
    }

    // x축 라벨 (회차/날짜)
    drawXLabels(svg, opts.xLabels, n, BX, PADT + plotH + 14);
    return svg;
  }

  // 카드 한 칸(요약 수치)
  function statCard(label, value, sub) {
    var c = document.createElement("div");
    c.className = "hist-stat";
    var v = document.createElement("div"); v.className = "hist-stat-num"; v.textContent = value;
    var l = document.createElement("div"); l.className = "hist-stat-lab"; l.textContent = label;
    c.appendChild(v); c.appendChild(l);
    if (sub) { var s = document.createElement("div"); s.className = "hist-stat-sub"; s.textContent = sub; c.appendChild(s); }
    return c;
  }

  // ---------- 전체 렌더 ----------
  function renderInto(el) {
    var arr = load();
    el.innerHTML = "";

    if (!arr.length) {
      var empty = document.createElement("p");
      empty.className = "hist-empty";
      empty.textContent = "아직 기록이 없어요. 문장을 끝까지 연습하면 여기에 추이가 쌓입니다.";
      el.appendChild(empty);
      return;
    }

    // 추이용 값
    var fingerVals = arr.map(function (s) { return (typeof s.finger === "number") ? s.finger : null; });
    var wpmVals = arr.map(function (s) { return Number(s.wpm) || 0; });
    var accVals = arr.map(function (s) { return (typeof s.acc === "number") ? s.acc : null; });
    // x축 회차 라벨 ("1회","2회"…) — 날짜는 칸이 좁아 회차로 통일(직관성)
    var xLabels = arr.map(function (s, i) { return (i + 1) + "회"; });

    var lastF = lastNonNull(fingerVals);
    var bestF = maxNonNull(fingerVals);
    var lastW = wpmVals[wpmVals.length - 1];
    var bestW = Math.max.apply(null, wpmVals);

    // 새 최고 운지율 갱신 배지 (성장 서사에 즉각 성취 보상)
    if (isNewBestFinger(arr)) {
      var badge = document.createElement("div");
      badge.className = "best-badge";
      badge.textContent = "🏆 새 최고 운지율 기록! " + bestF + "%";
      el.appendChild(badge);
    } else if (isFirstSession(arr)) {
      // 첫 세션엔 비교 대상이 없어 최고 배지가 안 뜨므로 '첫 기록 달성' 배지로 동기부여
      var firstBadge = document.createElement("div");
      firstBadge.className = "best-badge";
      firstBadge.textContent = "🎉 첫 기록 달성! 앞으로 추이가 쌓여요";
      el.appendChild(firstBadge);
    }

    // 요약 카드 줄
    var summary = document.createElement("div");
    summary.className = "hist-stats";
    summary.appendChild(statCard("누적 세션", String(arr.length), "회 연습"));
    summary.appendChild(statCard("최근 운지율", lastF == null ? "-" : lastF + "%", "지난 연습"));
    summary.appendChild(statCard("최고 운지율", bestF == null ? "-" : bestF + "%", "내 최고 기록"));
    summary.appendChild(statCard("최근 타수", lastW + "", "타/분 (최고 " + bestW + ")"));
    el.appendChild(summary);

    // 운지율 추이 (주인공 — 첫 번째, 목표선 80%, 진한 초록선으로 대비 확보)
    var c1 = document.createElement("div"); c1.className = "chart-card chart-hero";
    c1.appendChild(lineChart({
      title: "올바른 운지율 추이 (%)",
      values: fingerVals, color: "#2e7d32", unit: "%", max: 100, goalLine: 80, xLabels: xLabels
    }));
    // 세션 1개면 추이가 점 하나뿐 → 안내 문구로 빈약해 보이지 않게
    if (arr.length === 1) {
      var note = document.createElement("p");
      note.className = "chart-note";
      note.textContent = "두 번 이상 연습하면 향상 추이가 선으로 보여요.";
      c1.appendChild(note);
    }
    el.appendChild(c1);

    // 타수 추이 (막대)
    var c2 = document.createElement("div"); c2.className = "chart-card";
    c2.appendChild(barChart({ title: "타수 추이 (타/분)", values: wpmVals, color: "#1565c0", xLabels: xLabels }));
    el.appendChild(c2);

    // 정확도 추이 (선)
    var c3 = document.createElement("div"); c3.className = "chart-card";
    c3.appendChild(lineChart({ title: "정확도 추이 (%)", values: accVals, color: "#2e7d32", unit: "%", max: 100, xLabels: xLabels }));
    el.appendChild(c3);

    // 최근 세션 손가락별 약점 (가장 최근 세션 기준)
    var last = arr[arr.length - 1];
    if (last && last.fingerStat) {
      var weakWrap = document.createElement("div");
      weakWrap.className = "chart-card weak-card";
      var wt = document.createElement("div"); wt.className = "weak-title";
      wt.textContent = "최근 연습 — 손가락별 운지 정답률 (낮을수록 약점)";
      weakWrap.appendChild(wt);
      ALL_FINGERS.forEach(function (f) {
        var st = last.fingerStat[f];
        if (!st || !st.checked) return;
        var rate = Math.round((st.correct / st.checked) * 100);
        var row = document.createElement("div"); row.className = "weak-row";
        var nm = document.createElement("span"); nm.className = "weak-name"; nm.textContent = FINGER_KR[f];
        var bar = document.createElement("div"); bar.className = "weak-bar";
        var fill = document.createElement("span");
        fill.style.width = rate + "%";
        fill.style.background = rate < 60 ? "#c62828" : FINGER_COLOR[f];
        bar.appendChild(fill);
        var pct = document.createElement("b"); pct.className = "weak-pct"; pct.textContent = rate + "%";
        row.appendChild(nm); row.appendChild(bar); row.appendChild(pct);
        weakWrap.appendChild(row);
      });
      el.appendChild(weakWrap);
    }
  }

  function lastNonNull(a) { for (var i = a.length - 1; i >= 0; i--) if (a[i] != null) return a[i]; return null; }
  function maxNonNull(a) { var m = null; for (var i = 0; i < a.length; i++) if (a[i] != null && (m == null || a[i] > m)) m = a[i]; return m; }

  FG.history = {
    load: load,
    save: save,
    clear: clear,
    renderInto: renderInto,
    isNewBestFinger: isNewBestFinger,
    isFirstSession: isFirstSession
  };
})(window.FG = window.FG || {});
