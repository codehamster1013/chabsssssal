/* ============================================================
   손가락 길잡이 — hands.js  (v2: 깔끔한 캡슐형 양손 다이어그램)
   ------------------------------------------------------------
   기존 '키보드 위 오버레이' 방식은 viewBox(가로 2.24:1)가 키보드 폭에
   맞춰 늘어나며 손가락이 거대하게·엄지가 화면 밖으로 어긋났다.
   → 독립된 양손 그림으로 교체. 좌표가 키보드와 무관해 절대 왜곡되지 않고,
     손가락=둥근 캡슐 + 손바닥 = 부드러운 형태라 저학년 친화적이고 또렷하다.
   ------------------------------------------------------------
   API (app.js 가 그대로 사용 — 변경 없음):
     render(mountEl) / target(id) / flash(id, ok) / star(id, ok)
     shadeWeak(ids) / clear() / clearAll() / paint(id, cls) / nameOf(id)
   ------------------------------------------------------------
   상태색: 평소 = 그 손가락 고유색(파스텔) / target=파랑 / correct=초록
           / wrong=빨강 / weak=빨강음영.  (키보드·그래프와 색 규칙 공유)
   각 손가락 = <rect class="finger" id="f-XX">, 엄지 = .thumb-L/.thumb-R
   ============================================================ */
(function (FG) {
  "use strict";

  var FINGER_KR    = FG.config.FINGER_KR;
  var FINGER_COLOR = FG.config.FINGER_COLOR;

  var mount = null;
  var markerEl = null;
  var flashTimers = {};

  var SVG_NS = "http://www.w3.org/2000/svg";
  function el(name, attrs) {
    var n = document.createElementNS(SVG_NS, name);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]);
    return n;
  }

  // ---------- 기하 ----------
  // 손가락 = 위로 뻗은 둥근 캡슐(rect rx). 밑동은 BASE_Y 까지 내려 손바닥과 자연스레 합쳐진다.
  var BASE_Y = 182;     // 손가락 아랫끝(손바닥 속으로 묻힘)
  var FW = 38;          // 손가락 폭
  // 손가락 정의: cx(중심 x), tipY(손끝 y) — 중지 최장, 새끼·검지 짧게(자연 비율)
  var FINGERS = [
    { id: "L5", cx: 100, tipY: 96, home: "a" }, // 왼 새끼
    { id: "L4", cx: 148, tipY: 58, home: "s" }, // 왼 약지
    { id: "L3", cx: 196, tipY: 44, home: "d" }, // 왼 중지
    { id: "L2", cx: 244, tipY: 74, home: "f" }, // 왼 검지
    { id: "R2", cx: 396, tipY: 74, home: "j" }, // 오 검지
    { id: "R3", cx: 444, tipY: 44, home: "k" }, // 오 중지
    { id: "R4", cx: 492, tipY: 58, home: "l" }, // 오 약지
    { id: "R5", cx: 540, tipY: 96, home: ";" }  // 오 새끼
  ];

  // 손바닥(둥근 사각형) — 손가락 밑동을 감싼다
  var L_PALM = { x: 74,  y: 152, w: 196, h: 116, rx: 46 };
  var R_PALM = { x: 370, y: 152, w: 196, h: 116, rx: 46 };

  // 엄지: 손 안쪽(중앙)으로 기울어진 캡슐. base 를 축으로 rot 회전.
  var L_THUMB = { id: "TH", cls: "thumb-L", bx: 250, by: 206, w: 36, len: 70, rot: 66 };
  var R_THUMB = { id: "TH", cls: "thumb-R", bx: 390, by: 206, w: 36, len: 70, rot: -66 };

  function rad(d) { return d * Math.PI / 180; }

  // 회전 엄지의 손끝 좌표(마커·별 위치용)
  function thumbTip(t) {
    var dy = -t.len;
    return {
      tx: t.bx - dy * Math.sin(rad(t.rot)),
      ty: t.by + dy * Math.cos(rad(t.rot))
    };
  }

  // 마커(▼지금) 위치표
  var MARK = {};
  FINGERS.forEach(function (f) { MARK[f.id] = { tx: f.cx, ty: f.tipY - 12, dir: "down" }; });
  var lt = thumbTip(L_THUMB), rt = thumbTip(R_THUMB);
  MARK.TH = { tx: (lt.tx + rt.tx) / 2, ty: Math.min(lt.ty, rt.ty) - 14, dir: "down" };

  function addPalm(svg, p) {
    svg.appendChild(el("rect", { "class": "palm", x: p.x, y: p.y, width: p.w, height: p.h, rx: p.rx, ry: p.rx }));
  }

  function addFinger(svg, f) {
    var x = f.cx - FW / 2;
    var r = el("rect", {
      "class": "finger",
      id: "f-" + f.id,
      x: x, y: f.tipY, width: FW, height: BASE_Y - f.tipY, rx: FW / 2, ry: FW / 2
    });
    r.style.setProperty("--fc", FINGER_COLOR[f.id] || "#9aa6b6");
    svg.appendChild(r);
    // 손끝 홈키 글자 (어느 손가락이 어느 키인지 학습)
    var lab = el("text", { "class": "flabel", x: f.cx, y: f.tipY + 30, "text-anchor": "middle" });
    lab.textContent = f.home;
    svg.appendChild(lab);
  }

  function addThumb(svg, t) {
    var r = el("rect", {
      "class": "finger " + t.cls,
      x: t.bx - t.w / 2, y: t.by - t.len, width: t.w, height: t.len + 24, rx: t.w / 2, ry: t.w / 2,
      transform: "rotate(" + t.rot + " " + t.bx + " " + t.by + ")"
    });
    r.style.setProperty("--fc", FINGER_COLOR.TH || "#9aa6b6");
    svg.appendChild(r);
  }

  function render(mountEl) {
    mount = mountEl;
    mount.innerHTML = "";

    var svg = el("svg", {
      viewBox: "0 0 640 290",
      preserveAspectRatio: "xMidYMid meet",
      role: "img",
      "aria-label": "양손 그림 — 빛나는 손가락이 지금 쳐야 할 손가락"
    });

    // 손바닥 → 엄지 → 손가락 순(겹침 자연스럽게)
    addPalm(svg, L_PALM);
    addPalm(svg, R_PALM);
    addThumb(svg, L_THUMB);
    addThumb(svg, R_THUMB);
    FINGERS.forEach(function (f) { addFinger(svg, f); });

    // 손목 힌트 라벨
    svg.appendChild(textAt("왼손", L_PALM.x + L_PALM.w / 2, L_PALM.y + L_PALM.h - 14, "hand-tag"));
    svg.appendChild(textAt("오른손", R_PALM.x + R_PALM.w / 2, R_PALM.y + R_PALM.h - 14, "hand-tag"));

    // ▼지금 마커
    markerEl = el("text", { "class": "now-mark", x: 0, y: 0, "text-anchor": "middle" });
    markerEl.textContent = "▼ 지금";
    markerEl.style.display = "none";
    svg.appendChild(markerEl);

    mount.appendChild(svg);
  }

  function textAt(txt, x, y, cls) {
    var t = el("text", { "class": cls, x: x, y: y, "text-anchor": "middle" });
    t.textContent = txt;
    return t;
  }

  // ---------- 상태 조작 ----------
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
        markerEl.setAttribute("x", p.tx);
        markerEl.setAttribute("y", p.ty);
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
    var s = el("text", { "class": "finger-pop", x: bb.x + bb.width / 2, y: bb.y + 6, "text-anchor": "middle" });
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
