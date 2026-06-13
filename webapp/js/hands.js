/* ============================================================
   손가락 길잡이 — hands.js  (v3: 실사 손 이미지 + 손가락 색 오버레이)
   ------------------------------------------------------------
   사실적인 양손 일러스트(img/hands_base.png)를 베이스로 깔고, 그 위에
   손가락마다 '끝→밑동' 둥근 띠(SVG stroke)를 겹쳐 해당 손가락만 색으로 켠다.
   → 손 모양은 진짜 손이라 자연스럽고, 켜지는 건 색뿐이라 또렷하다.
   좌표는 베이스 이미지(1408×768) 픽셀 기준(픽셀 마스크로 손가락축 측정).
   ------------------------------------------------------------
   API (app.js 변경 없음):
     render / target / flash / star / shadeWeak / clear / clearAll / paint / nameOf
   상태: 평소 = 고유색 옅게 / target=파랑 / correct=초록 / wrong=빨강 / weak=빨강음영
   ============================================================ */
(function (FG) {
  "use strict";

  var FINGER_KR    = FG.config.FINGER_KR;
  var FINGER_COLOR = FG.config.FINGER_COLOR;

  var IMG = "img/hands_base.png";
  var VW = 1408, VH = 768;

  var mount = null, markerEl = null;
  var flashTimers = {};

  var SVG_NS = "http://www.w3.org/2000/svg";
  function el(name, attrs) {
    var n = document.createElementNS(SVG_NS, name);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]);
    return n;
  }

  // 손가락 축(끝 tip → 밑동 base) + 띠 두께 w + 담당 홈키 home.
  // 베이스 이미지에서 픽셀로 측정한 좌표(좌우 대칭).
  var FINGERS = [
    { id: "L5", tip: [125, 222], base: [188, 355], w: 46, home: "a" },
    { id: "L4", tip: [222,  95], base: [276, 355], w: 54, home: "s" },
    { id: "L3", tip: [332,  52], base: [352, 362], w: 56, home: "d" },
    { id: "L2", tip: [478,  92], base: [446, 355], w: 56, home: "f" },
    { id: "R2", tip: [930,  92], base: [962, 355], w: 56, home: "j" },
    { id: "R3", tip: [1076, 52], base: [1056, 362], w: 56, home: "k" },
    { id: "R4", tip: [1186, 95], base: [1132, 355], w: 54, home: "l" },
    { id: "R5", tip: [1283, 222], base: [1220, 355], w: 46, home: ";" }
  ];
  // 엄지(양손) — base 를 축으로 끝까지. id 는 둘 다 TH (공백 담당)
  var THUMBS = [
    { id: "TH", cls: "thumb-L", tip: [672, 346], base: [560, 468], w: 64 },
    { id: "TH", cls: "thumb-R", tip: [736, 346], base: [848, 468], w: 64 }
  ];

  // 마커(지금) 위치: 손끝 약간 위. 엄지는 두 끝 사이 중앙 위.
  var MARK = {};
  FINGERS.forEach(function (f) { MARK[f.id] = { x: f.tip[0], y: f.tip[1] - 34 }; });
  MARK.TH = { x: (THUMBS[0].tip[0] + THUMBS[1].tip[0]) / 2, y: 300 };

  function bandPath(tip, base) { return "M " + tip[0] + " " + tip[1] + " L " + base[0] + " " + base[1]; }

  function addBand(svg, f, extraCls) {
    var p = el("path", {
      "class": "finger" + (extraCls ? " " + extraCls : ""),
      id: f.cls ? null : "f-" + f.id,   // 엄지는 cls 로 선택, 나머진 id
      d: bandPath(f.tip, f.base),
      "stroke-width": f.w
    });
    if (f.cls) p.setAttribute("class", "finger " + f.cls);
    else p.setAttribute("id", "f-" + f.id);
    p.style.setProperty("--fc", FINGER_COLOR[f.id] || "#9aa6b6");
    svg.appendChild(p);
    // 손끝 홈키 글자 (손가락-키 학습) — 손가락 위쪽 패드에
    if (f.home) {
      var lx = f.tip[0] + 0.24 * (f.base[0] - f.tip[0]);
      var ly = f.tip[1] + 0.24 * (f.base[1] - f.tip[1]);
      var t = el("text", { "class": "flabel", x: lx, y: ly + 14, "text-anchor": "middle" });
      t.textContent = f.home;
      svg.appendChild(t);
    }
  }

  function render(mountEl) {
    mount = mountEl;
    mount.innerHTML = "";

    var svg = el("svg", {
      viewBox: "0 0 " + VW + " " + VH,
      preserveAspectRatio: "xMidYMid meet",
      role: "img",
      "aria-label": "양손 그림 — 빛나는 손가락이 지금 쳐야 할 손가락"
    });

    // 베이스 실사 손 이미지
    svg.appendChild(el("image", { href: IMG, x: 0, y: 0, width: VW, height: VH }));
    // 일부 브라우저(구버전) 호환용 xlink:href
    var imgs = svg.lastChild;
    imgs.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", IMG);

    // 손가락 색 띠 + 엄지
    FINGERS.forEach(function (f) { addBand(svg, f); });
    THUMBS.forEach(function (t) { addBand(svg, t); });

    // 지금 마커
    markerEl = el("text", { "class": "now-mark", x: 0, y: 0, "text-anchor": "middle" });
    markerEl.textContent = "▼ 지금";
    markerEl.style.display = "none";
    svg.appendChild(markerEl);

    mount.appendChild(svg);
  }

  // ---------- 상태 ----------
  function fingerEls(id) {
    if (!mount) return [];
    if (id === "TH") return Array.prototype.slice.call(mount.querySelectorAll(".thumb-L,.thumb-R"));
    var e = mount.querySelector("#f-" + id);
    return e ? [e] : [];
  }

  function clear() {
    if (!mount) return;
    Array.prototype.forEach.call(mount.querySelectorAll(".finger"), function (e) {
      e.classList.remove("target");
    });
  }

  function clearAll() {
    if (!mount) return;
    Array.prototype.forEach.call(mount.querySelectorAll(".finger"), function (e) {
      e.classList.remove("target", "correct", "wrong", "weak");
    });
    for (var id in flashTimers) if (flashTimers.hasOwnProperty(id) && flashTimers[id]) {
      clearTimeout(flashTimers[id]); flashTimers[id] = null;
    }
    if (markerEl) markerEl.style.display = "none";
  }

  function paint(id, cls) {
    fingerEls(id).forEach(function (e) {
      e.classList.remove("target", "correct", "wrong");
      if (cls) e.classList.add(cls);
    });
  }

  function flash(id, ok) {
    if (!id) return;
    var cls = ok ? "correct" : "wrong";
    fingerEls(id).forEach(function (e) {
      e.classList.remove("correct", "wrong");
      e.classList.add(cls);
    });
    if (flashTimers[id]) clearTimeout(flashTimers[id]);
    flashTimers[id] = setTimeout(function () {
      fingerEls(id).forEach(function (e) { e.classList.remove("correct", "wrong"); });
      flashTimers[id] = null;
    }, 600);
  }

  function target(id) {
    clear();
    if (id) {
      fingerEls(id).forEach(function (e) { e.classList.add("target"); });
      var p = MARK[id];
      if (markerEl && p) {
        markerEl.setAttribute("x", p.x);
        markerEl.setAttribute("y", p.y);
        markerEl.style.display = "";
      }
    } else if (markerEl) {
      markerEl.style.display = "none";
    }
  }

  function shadeWeak(ids) {
    if (!mount) return;
    Array.prototype.forEach.call(mount.querySelectorAll(".finger.weak"), function (e) {
      e.classList.remove("weak");
    });
    (ids || []).forEach(function (id) {
      fingerEls(id).forEach(function (e) { e.classList.add("weak"); });
    });
  }

  function star(id, ok) {
    if (!mount) return;
    var els = fingerEls(id);
    if (!els.length) return;
    var r = els[0], bb;
    try { bb = r.getBBox(); } catch (e) { return; }
    var s = el("text", { "class": "finger-pop", x: bb.x + bb.width / 2, y: bb.y + 4, "text-anchor": "middle" });
    s.textContent = ok ? "⭐" : "⚠";
    r.parentNode.appendChild(s);
    setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 650);
  }

  FG.hands = {
    render: render,
    clear: clear,
    clearAll: clearAll,
    paint: paint,
    flash: flash,
    shadeWeak: shadeWeak,
    target: target,
    star: star,
    nameOf: function (id) { return FINGER_KR[id] || id; }
  };
})(window.FG = window.FG || {});
