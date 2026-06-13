/* ============================================================
   손가락 길잡이 — serial.js
   Web Serial 연결 / 수신 / 송신 (아두이노 손가락 감지 연동)
   ------------------------------------------------------------
   프로토콜(절대 변경 금지):
     수신: "L2,Z4\n" 같은 줄 (콤마 앞 = 손가락ID), "READY" 라인
     송신: 'G'(맞음) / 'R'(틀림) / 'O'(끄기) 한 글자
     baudRate 9600
   ------------------------------------------------------------
   window.FG.serial.connect()        : 포트 요청 + 열기 + 읽기 시작
   window.FG.serial.send(cmd)        : 'G'/'R'/'O' 송신
   window.FG.serial.onFinger(fn)     : 손가락ID 수신 콜백 등록 fn(id)
   window.FG.serial.onStatus(fn)     : 상태 텍스트 콜백 등록 fn(text)
   window.FG.serial.isSupported()    : Web Serial 지원 여부
   ============================================================ */
(function (FG) {
  "use strict";

  var FINGER_KR = FG.config.FINGER_KR;

  var port = null;
  var reader = null;
  var fingerCb = function () {};
  var statusCb = function () {};

  function isSupported() { return ("serial" in navigator); }
  function onFinger(fn) { fingerCb = fn || function () {}; }
  function onStatus(fn) { statusCb = fn || function () {}; }
  function status(t) { statusCb(t); }

  async function connect() {
    if (!isSupported()) {
      status("이 브라우저는 Web Serial 미지원 → 크롬/엣지로 열어주세요");
      return false;
    }
    try {
      port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });
      status("아두이노 연결됨");
      readLoop();
      return true;
    } catch (err) {
      status("연결 취소/실패");
      return false;
    }
  }

  async function readLoop() {
    var decoder = new TextDecoderStream();
    port.readable.pipeTo(decoder.writable);
    reader = decoder.readable.getReader();
    var buffer = "";
    while (true) {
      var res = await reader.read();
      if (res.done) break;
      buffer += res.value;
      var nl;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        var line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        handleLine(line);
      }
    }
  }

  // "L2,Z4" → 손가락 ID 콜백 / "READY" → 상태
  function handleLine(line) {
    if (line === "READY") { status("아두이노 준비됨 (READY)"); return; }
    var finger = line.split(",")[0];
    if (FINGER_KR[finger]) fingerCb(finger);
  }

  async function send(cmd) {
    if (!port || !port.writable) return;
    var writer = port.writable.getWriter();
    try {
      await writer.write(new TextEncoder().encode(cmd));
    } finally {
      writer.releaseLock();
    }
  }

  FG.serial = {
    isSupported: isSupported,
    connect: connect,
    send: send,
    onFinger: onFinger,
    onStatus: onStatus
  };
})(window.FG = window.FG || {});
