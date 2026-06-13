/* ============================================================
   손가락 길잡이 — config.js
   운지표 / 손가락 한글명 / 연습문장 / 키보드 레이아웃 데이터
   ------------------------------------------------------------
   window.FG.config 에 모든 정적 데이터를 모아 둔다.
   (기존 webapp/index.html 의 표준 운지표를 그대로 이식)
   ============================================================ */
(function (FG) {
  "use strict";

  // ---------- 1. 표준 운지표 (손가락 → 담당 글자) ----------
  // QWERTY 기준, 소문자/공백만 (프로토타입 범위 그대로 유지)
  var MAP = {
    "L5": "qaz1", "L4": "wsx2", "L3": "edc3", "L2": "rtfgvb45",
    "R2": "yuhjnm67", "R3": "ik,8", "R4": "ol.9", "R5": "p;/0",
    "TH": " " // 엄지 = 스페이스
  };

  // 글자 → 쳐야 할 손가락 (역인덱스)
  var FINGER_OF = {};
  for (var f in MAP) {
    if (!MAP.hasOwnProperty(f)) continue;
    for (var i = 0; i < MAP[f].length; i++) FINGER_OF[MAP[f][i]] = f;
  }

  // 손가락 ID → 한글명 (좌우 대칭 통일: 양쪽 모두 '~손~' 형식)
  var FINGER_KR = {
    L5: "왼손새끼", L4: "왼손약지", L3: "왼손중지", L2: "왼손검지",
    R2: "오른손검지", R3: "오른손중지", R4: "오른손약지", R5: "오른손새끼", TH: "엄지"
  };

  // 손가락 ID → 담당 키 예시 (손그림 라벨 병기 — '검지(R T F G)' 식 공간 단서)
  // 알파벳 담당 키만 추려 대문자로 (숫자·기호는 학습 부담 줄이려 생략)
  var FINGER_KEYS = {
    L5: "Q A Z", L4: "W S X", L3: "E D C", L2: "R T F G V B",
    R2: "Y U H J N M", R3: "I K", R4: "O L", R5: "P", TH: "Space"
  };

  // 손가락 ID → 약칭 (색+글자 이중 코딩 — 색약/저학년 대비, WCAG 접근성)
  // 키 하단·손그림 라벨에 색과 함께 글자로도 명시한다.
  var FINGER_ABBR = {
    L5: "왼새", L4: "왼약", L3: "왼중", L2: "왼검",
    R2: "오검", R3: "오중", R4: "오약", R5: "오새", TH: "엄"
  };

  // 손 그림/막대 표시 순서 (왼→오)
  var ALL_FINGERS = ["L5", "L4", "L3", "L2", "TH", "R2", "R3", "R4", "R5"];

  // 손가락별 고유 색 — 손그림·키보드·기록 그래프가 모두 공유한다.
  // 같은 손가락은 어디서나 같은 색 → 초등학생이 "이 키 = 이 손가락" 학습.
  // 채도를 낮춰 은은하게(배경칠), 강조 상태는 별도 상태색으로 덮어쓴다.
  var FINGER_COLOR = {
    L5: "#7e57c2", // 보라 (왼새끼)
    L4: "#5c6bc0", // 남보라 (왼약지)
    L3: "#42a5f5", // 하늘 (왼중지)
    L2: "#26a69a", // 청록 (왼검지)
    TH: "#8d99ae", // 회청 (엄지/스페이스)
    R2: "#66bb6a", // 연두 (오른손검지)
    R3: "#b08800", // 진한 머스터드 (오른손중지) — 흰 배경 대비 강화
    R4: "#ef8e3a", // 주황 (오른손약지)
    R5: "#ec6a8a"  // 분홍 (오른손새끼)
  };

  // ---------- 2. 연습 문장 (여러 개 순환) ----------
  var SENTENCES = [
    "the quick brown fox jumps over the lazy dog",
    "a sad lad asks dad for a glass",
    "joy and faith make a kind heart",
    "pack my box with five dozen jugs"
  ];

  // ---------- 3. 화면 키보드 레이아웃 ----------
  // 행별 키 배열. 표시 라벨(소문자), 폭 가중치(units), 특수 표시.
  // 실제 판정은 소문자/공백만 → 숫자행·기호도 운지색 학습용으로 노출.
  var KEYBOARD_ROWS = [
    [
      { k: "1" }, { k: "2" }, { k: "3" }, { k: "4" }, { k: "5" },
      { k: "6" }, { k: "7" }, { k: "8" }, { k: "9" }, { k: "0" }
    ],
    [
      { k: "q" }, { k: "w" }, { k: "e" }, { k: "r" }, { k: "t" },
      { k: "y" }, { k: "u" }, { k: "i" }, { k: "o" }, { k: "p" }
    ],
    [
      { k: "a" }, { k: "s" }, { k: "d" }, { k: "f" }, { k: "g" },
      { k: "h" }, { k: "j" }, { k: "k" }, { k: "l" }, { k: ";" }
    ],
    [
      { k: "z" }, { k: "x" }, { k: "c" }, { k: "v" }, { k: "b" },
      { k: "n" }, { k: "m" }, { k: ",", label: "," }, { k: ".", label: "." }, { k: "/" }
    ],
    [
      { k: " ", label: "space", units: 6, space: true }
    ]
  ];

  // ---------- 4. 운지 콤보(연속 올바른 운지) 보상 임계값 ----------
  // 핵심 지표(운지율)에 게임 보상을 직접 묶는다. 점수가 아니라 '연속 올바른 운지'에 토스트.
  var COMBO_STEPS = [3, 5, 10, 20]; // 이 콤보에 도달할 때 토스트

  // ---------- 5. 운지율 임계색 (히어로 게이지 외곽) ----------
  // 숫자뿐 아니라 색만으로 '지금 잘하는지'를 즉시 인지.
  function rateClass(rate) {
    if (rate == null) return "none";
    if (rate >= 80) return "good";   // 초록테
    if (rate >= 60) return "okay";   // 파랑테
    return "low";                    // 빨강/코랄테
  }

  FG.config = {
    MAP: MAP,
    FINGER_OF: FINGER_OF,
    FINGER_KR: FINGER_KR,
    FINGER_KEYS: FINGER_KEYS,
    FINGER_ABBR: FINGER_ABBR,
    ALL_FINGERS: ALL_FINGERS,
    FINGER_COLOR: FINGER_COLOR,
    SENTENCES: SENTENCES,
    KEYBOARD_ROWS: KEYBOARD_ROWS,
    COMBO_STEPS: COMBO_STEPS,
    rateClass: rateClass,
    // 손가락 매칭 허용 시간(ms) — 기존 동작 그대로 0.6초
    MATCH_WINDOW_MS: 600,
    // 데모 시 다른 손가락(독수리) 비율 — 기존 20%
    DEMO_WRONG_RATE: 0.2,
    // localStorage 키
    HISTORY_KEY: "fg_history",
    // 운지율 목표선(%)
    GOAL: 80
  };
})(window.FG = window.FG || {});
