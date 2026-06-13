/* ============================================================
   손가락 길잡이 — keyboard.js
   화면 키보드(타자기) 렌더 및 하이라이트
   ------------------------------------------------------------
   window.FG.keyboard.render(mountEl) : QWERTY 자판을 그린다
   window.FG.keyboard.target(ch)      : 지금 칠 키 강조(타깃)
   window.FG.keyboard.flash(ch, ok)   : 실제 누른 키를 정/오로 잠깐 표시
   각 키는 "그 키 담당 손가락 색"으로 은은히 칠해진다.
   색 규칙: 손가락색(은은) / 타깃=파랑 / 정답=초록 / 오타=빨강 (손그림과 동일)
   ============================================================ */
(function (FG) {
  "use strict";

  var ROWS = FG.config.KEYBOARD_ROWS;
  var FINGER_OF = FG.config.FINGER_OF;
  var FINGER_COLOR = FG.config.FINGER_COLOR;
  var FINGER_KR = FG.config.FINGER_KR;
  var FINGER_ABBR = FG.config.FINGER_ABBR;

  var mount = null;
  var keyEls = {};       // 글자 → key DOM
  var flashTimers = {};  // 글자 → timeout id

  function keyId(ch) { return ch === " " ? "__space__" : ch; }

  function render(mountEl) {
    mount = mountEl;
    mount.innerHTML = "";
    keyEls = {};

    ROWS.forEach(function (row) {
      var rowEl = document.createElement("div");
      rowEl.className = "kbd-row";
      row.forEach(function (key) {
        var kEl = document.createElement("div");
        kEl.className = "kbd-key" + (key.space ? " kbd-space" : "");
        if (key.units) kEl.style.flexGrow = String(key.units);

        // 담당 손가락색을 은은한 배경으로
        var finger = FINGER_OF[key.k];
        if (finger) {
          kEl.style.setProperty("--key-finger-c", FINGER_COLOR[finger]);
          kEl.setAttribute("data-finger", finger);
          kEl.title = (key.k === " " ? "스페이스" : key.k) + " · " + (FINGER_KR[finger] || finger);
          // 접근성: 색만이 아니라 이름으로도 손가락 명시 (색약/스크린리더)
          kEl.setAttribute("aria-label",
            (key.k === " " ? "스페이스" : key.k) + " 키, " + (FINGER_KR[finger] || finger));
        }

        var lab = document.createElement("span");
        lab.className = "kbd-lab";
        lab.textContent = key.label || (key.k === " " ? "space" : key.k);
        kEl.appendChild(lab);

        // 색+글자 이중 코딩: 키 하단에 담당 손가락 약칭('왼검' 등)
        if (finger) {
          var sub = document.createElement("span");
          sub.className = "kbd-sub";
          sub.textContent = FINGER_ABBR[finger] || finger;
          kEl.appendChild(sub);
        }

        rowEl.appendChild(kEl);
        keyEls[keyId(key.k)] = kEl;
      });
      mount.appendChild(rowEl);
    });
  }

  // 지금 칠 키만 타깃(파랑) — 나머지 타깃 해제
  function target(ch) {
    for (var id in keyEls) if (keyEls.hasOwnProperty(id)) keyEls[id].classList.remove("target");
    if (ch == null) return;
    var k = keyEls[keyId(ch.toLowerCase())];
    if (k) k.classList.add("target");
  }

  // 실제 누른 키를 정답=초록 / 오타=빨강 으로 잠깐 표시
  function flash(ch, ok) {
    if (ch == null) return;
    var id = keyId(ch.toLowerCase());
    var k = keyEls[id];
    if (!k) return;
    k.classList.remove("hit-ok", "hit-bad");
    void k.offsetWidth; // 리플로우 → 같은 키 연속 입력도 애니메이션 재생
    k.classList.add(ok ? "hit-ok" : "hit-bad");
    if (flashTimers[id]) clearTimeout(flashTimers[id]);
    flashTimers[id] = setTimeout(function () {
      k.classList.remove("hit-ok", "hit-bad");
      flashTimers[id] = null;
    }, 280);
  }

  function clear() {
    // 대기 중인 flash 타이머도 취소 (다시 시작 시 직전 시도의 잔여 색이 새 시도에 번지지 않게)
    for (var t in flashTimers) if (flashTimers.hasOwnProperty(t) && flashTimers[t]) {
      clearTimeout(flashTimers[t]); flashTimers[t] = null;
    }
    for (var id in keyEls) if (keyEls.hasOwnProperty(id)) {
      keyEls[id].classList.remove("target", "hit-ok", "hit-bad");
    }
  }

  FG.keyboard = {
    render: render,
    target: target,
    flash: flash,
    clear: clear
  };
})(window.FG = window.FG || {});
