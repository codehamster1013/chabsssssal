/* ============================================================
   손가락 길잡이 — app.js
   연습 로직(상태 / keydown / 정확도·운지율·타수) + 부트스트랩/이벤트 연결
   ------------------------------------------------------------
   기존 webapp/index.html 의 판정 로직을 그대로 이식:
     - keydown: 일반 글자 1글자만, 정확도=(전체-오타)/전체, 맞으면 다음 글자
     - 운지: need 와 lastFinger 가 0.6초 이내면 매칭 → 'G'/'R' 송신
     - 데모: 80% 정답 / 20% 다른 손가락
     - 다시 시작: 카운터 초기화 + 문장 순환
   추가: 화면 키보드 강조/플래시, 종료 시 세션 기록 저장
   ============================================================ */
(function (FG) {
  "use strict";

  var cfg = FG.config;
  var FINGER_OF = cfg.FINGER_OF;
  var FINGER_KR = cfg.FINGER_KR;
  var ALL_FINGERS = cfg.ALL_FINGERS;
  var SENTENCES = cfg.SENTENCES;

  // ---------- 상태 ----------
  var sentIdx = 0;
  var SENTENCE = SENTENCES[sentIdx];
  var pos = 0, totalKeys = 0, wrongKeys = 0;
  var fingerChecked = 0, fingerCorrect = 0;
  var startTime = null;
  var fingerStat = {};
  ALL_FINGERS.forEach(function (f) { fingerStat[f] = { checked: 0, correct: 0 }; });

  var lastFinger = null, lastFingerTime = 0;
  var demoMode = false;
  var saved = false; // 세션 중복 저장 방지
  var combo = 0;     // 연속 올바른 운지 콤보 (핵심지표에 보상 직접 연동)

  // 모션 최소화 선호(reduced-motion) — 칭찬 애니메이션을 끈다(접근성)
  var REDUCE = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- DOM ----------
  var $ = function (id) { return document.getElementById(id); };
  var input, sentenceEl, curCharEl, needFingerEl, gotFingerEl, judgeEl;
  var speedEl, accEl, fingerEl, statusEl, bubbleEl, heroEl, toastWrap;

  // ---------- 토스트 (운지 콤보 보상) ----------
  // 작게 띄워 핵심 지표(운지율)를 가리지 않게 한다. reduced-motion 이면 모션 없이 표시.
  function toast(text) {
    if (!toastWrap) return;
    var t = document.createElement("div");
    t.className = "toast" + (REDUCE ? " no-anim" : "");
    t.textContent = text;
    toastWrap.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 1400);
  }

  // ---------- 화면 그리기 ----------
  function render() {
    sentenceEl.innerHTML = "";
    for (var i = 0; i < SENTENCE.length; i++) {
      var span = document.createElement("span");
      span.textContent = SENTENCE[i] === " " ? "␣" : SENTENCE[i];
      if (i < pos) span.className = "done";
      else if (i === pos) span.className = "cur";
      sentenceEl.appendChild(span);
    }
    var ch = SENTENCE[pos] || "-";
    curCharEl.textContent = ch === " " ? "(공백)" : ch;
    var need = FINGER_OF[ch];
    needFingerEl.textContent = need ? FINGER_KR[need] : "-";

    // 다정한 말풍선 안내 ("이번엔 ○○로 쳐요!") — 따뜻형 톤 접목
    if (bubbleEl) {
      if (need) {
        var keyTxt = ch === " " ? "스페이스" : "'" + ch + "'";
        bubbleEl.textContent = "이번엔 " + keyTxt + " 를 " + FINGER_KR[need] + " 로 쳐요!";
      } else {
        bubbleEl.textContent = "준비됐어요! 위 문장을 따라 쳐 볼까요?";
      }
    }

    // 손그림 + 화면 키보드 동시 타깃 (둘 다 파랑계열)
    FG.hands.target(need || null);
    FG.keyboard.target(SENTENCE[pos] != null ? SENTENCE[pos] : null);
  }

  // ---------- 데모: 80% 정답, 20% 다른 손가락 ----------
  function simulateFinger(need) {
    var f = need;
    if (Math.random() < cfg.DEMO_WRONG_RATE) {
      var others = ALL_FINGERS.filter(function (x) { return x !== need; });
      f = others[Math.floor(Math.random() * others.length)];
    }
    lastFinger = f;
    lastFingerTime = Date.now();
  }

  // ---------- 통계 갱신 ----------
  function currentAcc() { return totalKeys ? Math.round((totalKeys - wrongKeys) / totalKeys * 100) : 100; }
  function currentFinger() { return fingerChecked ? Math.round(fingerCorrect / fingerChecked * 100) : null; }
  function currentWpm() {
    if (!startTime) return 0;
    var min = (Date.now() - startTime) / 60000;
    return min > 0 ? Math.round(totalKeys / min) : 0;
  }

  function updateStats() {
    accEl.textContent = currentAcc() + "%";
    var fr = currentFinger();
    fingerEl.textContent = fr === null ? "-" : fr + "%";
    speedEl.textContent = String(currentWpm());

    // 운지율 히어로 카드 외곽 임계색 (≥80 초록 / 60~79 파랑 / <60 빨강·코랄)
    if (heroEl) {
      heroEl.classList.remove("gauge-good", "gauge-okay", "gauge-low", "gauge-none");
      heroEl.classList.add("gauge-" + cfg.rateClass(fr));
    }
  }

  // ---------- keydown 판정 (기존 로직 보존) ----------
  function onKeydown(e) {
    if (e.key.length !== 1) return;       // 일반 글자만
    e.preventDefault();
    if (pos >= SENTENCE.length) return;
    if (startTime === null) startTime = Date.now();

    var expected = SENTENCE[pos];
    var typed = e.key.toLowerCase();
    totalKeys++;

    // (1) 글자 정확도
    var charOK = (typed === expected);
    if (!charOK) wrongKeys++;

    // 화면 키보드: 실제 누른 키를 정/오로 잠깐 표시
    FG.keyboard.flash(typed, charOK);

    // (2) 손가락 운지 판정
    var need = FINGER_OF[expected];
    if (demoMode && need) simulateFinger(need);

    if (need && lastFinger && (Date.now() - lastFingerTime < cfg.MATCH_WINDOW_MS)) {
      fingerChecked++;
      fingerStat[need].checked++;
      var fingerOK = (lastFinger === need);
      if (fingerOK) { fingerCorrect++; fingerStat[need].correct++; }
      FG.serial.send(fingerOK ? "G" : "R"); // LED·부저 피드백

      gotFingerEl.textContent = FINGER_KR[lastFinger] || lastFinger;
      // 격려형 + 정답 손가락 안내 (틀려도 혼내지 않고 어느 손가락으로 칠지 알려줌)
      if (fingerOK) {
        judgeEl.textContent = "올바른 손가락이에요!";
      } else {
        judgeEl.textContent = "앗! " + (FINGER_KR[need] || need) + "로 다시 쳐볼까요?";
      }
      judgeEl.className = "judge " + (fingerOK ? "ok" : "bad");

      // 손그림: 실제 친 손가락을 초록/빨강으로 잠깐 표시(타이머) — render() 후에도 색이 살아남는다.
      // reduced-motion 에서도 '색'(정/오)은 보여야 하므로 모션과 무관하게 호출.
      FG.hands.flash(lastFinger, fingerOK);

      // 칭찬 ⭐ / 경고 마이크로 팝 = '모션'이므로 reduced-motion 시에만 끔
      if (!REDUCE) FG.hands.star(lastFinger, fingerOK);

      // 운지 콤보: 연속 올바른 운지에만 가벼운 보상 토스트 (핵심지표에 직접 연동)
      if (fingerOK) {
        combo++;
        if (cfg.COMBO_STEPS.indexOf(combo) >= 0) toast("운지 콤보 ×" + combo + "! 좋아요");
      } else {
        combo = 0;
      }

      lastFinger = null;
    }

    if (charOK) pos++;
    updateStats();
    if (pos >= SENTENCE.length) { finish(); return; }
    render();
  }

  // ---------- 종료: 결과 + 세션 기록 저장 ----------
  function finish() {
    var acc = currentAcc();
    var fr = currentFinger();
    var spd = currentWpm();

    // 결과 패널
    $("rAcc").style.width = acc + "%";
    $("rAccTxt").textContent = acc + "%";
    $("rFin").style.width = (fr == null ? 0 : fr) + "%";
    $("rFin").parentElement.classList.toggle("bad", fr != null && fr < 60);
    $("rFinTxt").textContent = fr == null ? "측정 안됨" : fr + "%";
    $("rSpd").style.width = Math.min(100, spd) + "%";
    $("rSpdTxt").textContent = spd + " 타/분";

    var box = $("rFingers");
    box.innerHTML = "";
    var weakFingers = []; // 약점(<60%) 손가락 → 손그림 빨강 음영으로도 표시
    ALL_FINGERS.forEach(function (f) {
      var s = fingerStat[f];
      if (s.checked === 0) return;
      var rate = Math.round(s.correct / s.checked * 100);
      if (rate < 60) weakFingers.push(f);
      var row = document.createElement("div");
      row.className = "rrow";
      row.innerHTML =
        '<span class="rl">' + FINGER_KR[f] + '</span>' +
        '<div class="rbar' + (rate < 60 ? ' bad' : '') + '"><span style="width:' + rate + '%"></span></div>' +
        '<b>' + rate + '%</b>';
      box.appendChild(row);
    });
    if (!box.children.length)
      box.innerHTML = '<p class="muted">아두이노/데모 모드로 연습하면 손가락별 통계가 나옵니다.</p>';

    // 손그림에도 약점 손가락 빨강 음영 (텍스트 막대 + 그림 이중 표시 → 직관성)
    if (FG.hands.shadeWeak) FG.hands.shadeWeak(weakFingers);

    $("result").style.display = "block";
    $("result").scrollIntoView({ behavior: REDUCE ? "auto" : "smooth", block: "nearest" });

    // 세션 기록 저장 (한 번만)
    if (!saved) {
      saved = true;
      var now = new Date();
      var fstat = {};
      ALL_FINGERS.forEach(function (f) { fstat[f] = { checked: fingerStat[f].checked, correct: fingerStat[f].correct }; });
      var res = FG.history.save({
        ts: now.toISOString(),
        date: fmtDate(now),
        acc: acc,
        finger: fr,            // null 가능
        wpm: spd,
        chars: totalKeys,
        fingerStat: fstat
      });
      // 결과 패널·기록 화면 모두 'save 가 돌려준 같은 list'(= storage 의 실제 내용)를 출처로 사용
      var list = res.list;
      var rBadge = $("rBest");
      if (rBadge) {
        if (FG.history.isNewBestFinger(list)) {
          rBadge.textContent = "🏆 새 최고 운지율 기록!";
          rBadge.style.display = "";
        } else if (FG.history.isFirstSession(list)) {
          rBadge.textContent = "🎉 첫 기록 달성!";
          rBadge.style.display = "";
        } else {
          rBadge.style.display = "none";
        }
      }
      // 저장 실패 시 조용한 유실 금지 — 상태표시줄에 작게 알림
      if (!res.ok) {
        setStatus("기록 저장 실패 — 이 브라우저에서는 기록이 저장되지 않을 수 있어요");
      }
      refreshHistory();
    }
  }

  function fmtDate(d) {
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return (d.getMonth() + 1) + "/" + d.getDate() + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  // ---------- 다시 시작 ----------
  function restart(next) {
    if (next) { sentIdx = (sentIdx + 1) % SENTENCES.length; SENTENCE = SENTENCES[sentIdx]; }
    pos = totalKeys = wrongKeys = fingerChecked = fingerCorrect = 0;
    startTime = null; lastFinger = null; lastFingerTime = 0; saved = false; combo = 0;
    ALL_FINGERS.forEach(function (f) { fingerStat[f] = { checked: 0, correct: 0 }; });
    gotFingerEl.textContent = "-";
    judgeEl.textContent = ""; judgeEl.className = "judge";
    $("result").style.display = "none";
    // 직전 시도의 잔여 상태 정리: 결과 배지 숨김, 토스트 비움, 키보드·손그림 색·타이머 정리
    var rBadge = $("rBest"); if (rBadge) rBadge.style.display = "none";
    if (toastWrap) toastWrap.innerHTML = "";
    FG.keyboard.clear();           // hit-ok/hit-bad 색 + 대기 flash 타이머까지 취소
    if (FG.hands.clearAll) FG.hands.clearAll(); // 정/오 색·flash 타이머·마커 초기화
    updateStats(); render();
    input.value = ""; input.focus();
  }

  // ---------- 기록 화면 ----------
  function refreshHistory() { FG.history.renderInto($("history")); }

  // ---------- 상태표시 ----------
  function setStatus(t) { statusEl.textContent = "상태: " + t; }

  // ---------- 부트스트랩 ----------
  function boot() {
    input = $("typing");
    sentenceEl = $("sentence");
    curCharEl = $("curChar");
    needFingerEl = $("needFinger");
    gotFingerEl = $("gotFinger");
    judgeEl = $("judge");
    speedEl = $("speed");
    accEl = $("acc");
    fingerEl = $("finger");
    statusEl = $("status");
    bubbleEl = $("bubble");
    heroEl = $("heroCard");
    toastWrap = $("toast-wrap");

    // 시각 요소 렌더
    FG.hands.render($("hands"));
    FG.keyboard.render($("keyboard"));
    refreshHistory();

    // Serial 콜백 연결
    FG.serial.onStatus(setStatus);
    FG.serial.onFinger(function (id) { lastFinger = id; lastFingerTime = Date.now(); });

    // 이벤트
    input.addEventListener("keydown", onKeydown);
    $("connectBtn").addEventListener("click", function () {
      FG.serial.connect().then(function (ok) {
        if (ok) { $("demoChk").checked = false; demoMode = false; }
      });
    });
    $("restartBtn").addEventListener("click", function () { restart(true); });
    $("demoChk").addEventListener("change", function (e) {
      demoMode = e.target.checked;
      setStatus(demoMode ? "데모 모드(시뮬레이션) — 손가락 신호를 흉내 냅니다"
                         : "미연결 — 정확도·타수는 그냥 측정됩니다");
    });
    $("clearHistBtn").addEventListener("click", function () {
      if (confirm("그동안 쌓인 연습 기록을 모두 지울까요? 되돌릴 수 없어요.")) {
        FG.history.clear();
        refreshHistory();
      }
    });

    // 탭 전환 (연습 / 기록)
    var tabs = document.querySelectorAll(".tab");
    Array.prototype.forEach.call(tabs, function (tab) {
      tab.addEventListener("click", function () {
        Array.prototype.forEach.call(tabs, function (t) { t.classList.remove("active"); });
        tab.classList.add("active");
        var name = tab.getAttribute("data-tab");
        $("view-practice").style.display = (name === "practice") ? "" : "none";
        $("view-history").style.display = (name === "history") ? "" : "none";
        if (name === "history") refreshHistory();
        else input.focus();
      });
    });

    setStatus(FG.serial.isSupported()
      ? "미연결 — 정확도·타수는 그냥 측정됩니다"
      : "이 브라우저는 Web Serial 미지원(크롬/엣지 권장) — 데모 모드로 시연하세요");

    updateStats(); render(); input.focus();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  FG.app = { restart: restart };
})(window.FG = window.FG || {});
