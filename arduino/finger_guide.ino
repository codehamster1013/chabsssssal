/*
 * ============================================================
 *  손가락 길잡이 (Finger Guide) — 타법 교정 시스템 / 아두이노 펌웨어
 *  한국코드페어 2026 · SW공모전 초등부 · Physical Computing
 * ------------------------------------------------------------
 *  하는 일:
 *   1) 손가락(ROW) × 키 구역(COL) 매트릭스를 빠르게 스캔한다.
 *   2) 손가락 구리패드가 키 구리패드에 닿으면, 그 교차점을 찾아
 *      "어느 손가락이 어느 구역을 쳤는지"를 시리얼로 보낸다.
 *      예) "L2,Z4"  (왼손 검지가 4번 구역 터치)
 *   3) 웹앱(브라우저)에서 'G'(맞음)/'R'(틀림)/'O'(끄기) 명령을 받으면
 *      초록/빨강 LED와 부저로 피드백한다.
 *
 *  연결(예시 · 아두이노 Uno):
 *   - ROW(손가락 8개 + 엄지 공용 1개 = 9개): D2 ~ D9, D13  → OUTPUT, 하나씩 HIGH 로 구동
 *   - COL(키 구역):     A0 ~ A5  → INPUT_PULLDOWN 흉내(외부 풀다운 저항 권장)
 *   - 초록 LED: D12 / 빨강 LED: D11 / 부저: D10
 *
 *  주의: 아두이노 Uno에는 INPUT_PULLDOWN 모드가 없으므로
 *        각 COL 핀에 10kΩ 풀다운 저항을 GND로 연결한다.
 *        (안 닿았을 때 LOW, 닿으면 HIGH 가 되도록)
 *  주의: 엄지(TH)는 왼쪽/오른쪽을 구분하지 않고 D13 한 줄에 양쪽 엄지 패드를
 *        같이 묶는다(웹앱도 TH 하나로만 판정하므로 구분이 필요 없음).
 *        D13은 Uno 보드 내장 LED와 공유되므로, 이 줄이 HIGH일 때 보드의
 *        내장 LED도 같이 깜빡인다(정상 동작, 오작동 아님).
 * ============================================================
 */

// ---- 손가락(ROW) 설정 ----
const int ROW_COUNT = 9;
const int rowPins[ROW_COUNT] = {2, 3, 4, 5, 6, 7, 8, 9, 13};
const char* fingerName[ROW_COUNT] = {
  "L5", "L4", "L3", "L2",   // 왼손: 새끼,약지,중지,검지
  "R2", "R3", "R4", "R5",   // 오른손: 검지,중지,약지,새끼
  "TH"                      // 엄지(양손 공용, 스페이스)
};

// ---- 키 구역(COL) 설정 ----
const int COL_COUNT = 6;
const int colPins[COL_COUNT] = {A0, A1, A2, A3, A4, A5};
const char* zoneName[COL_COUNT] = {
  "Z1", "Z2", "Z3", "Z4", "Z5", "Z6"
};

// ---- 피드백 핀 ----
const int LED_GREEN = 12;
const int LED_RED   = 11;
const int BUZZER    = 10;

// 같은 접촉을 계속 중복 전송하지 않도록 직전 상태 기억
bool lastContact[ROW_COUNT][COL_COUNT];

void setup() {
  Serial.begin(9600);

  for (int r = 0; r < ROW_COUNT; r++) {
    pinMode(rowPins[r], OUTPUT);
    digitalWrite(rowPins[r], LOW);
    for (int c = 0; c < COL_COUNT; c++) lastContact[r][c] = false;
  }
  for (int c = 0; c < COL_COUNT; c++) pinMode(colPins[c], INPUT); // 외부 풀다운 사용

  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(BUZZER, OUTPUT);

  Serial.println("READY");  // 웹앱이 연결을 확인하는 신호
}

void loop() {
  scanMatrix();       // 손가락×구역 스캔 → 접촉 시 시리얼 전송
  handleCommand();    // 웹앱에서 온 피드백 명령 처리
}

// 매트릭스 스캔: ROW를 하나씩 켜고 어떤 COL이 응답하는지 읽는다
void scanMatrix() {
  for (int r = 0; r < ROW_COUNT; r++) {
    digitalWrite(rowPins[r], HIGH);   // 이 손가락 줄을 켠다
    delayMicroseconds(50);            // 신호 안정화

    for (int c = 0; c < COL_COUNT; c++) {
      bool now = (digitalRead(colPins[c]) == HIGH); // 닿으면 HIGH

      // 막 닿은 순간(LOW→HIGH)에만 1번 전송
      if (now && !lastContact[r][c]) {
        Serial.print(fingerName[r]);
        Serial.print(",");
        Serial.println(zoneName[c]);  // 예) "L2,Z4"
      }
      lastContact[r][c] = now;
    }

    digitalWrite(rowPins[r], LOW);    // 줄을 끄고 다음 손가락으로
  }
}

// 웹앱 → 아두이노 명령:  'G' 초록(맞음) / 'R' 빨강+부저(틀림) / 'O' 끄기
void handleCommand() {
  if (Serial.available() > 0) {
    char cmd = Serial.read();
    if (cmd == 'G') {            // 올바른 손가락
      digitalWrite(LED_GREEN, HIGH);
      digitalWrite(LED_RED, LOW);
    } else if (cmd == 'R') {     // 틀린 손가락(독수리)
      digitalWrite(LED_RED, HIGH);
      digitalWrite(LED_GREEN, LOW);
      tone(BUZZER, 880, 120);    // 짧은 경고음
    } else if (cmd == 'O') {     // 끄기
      digitalWrite(LED_GREEN, LOW);
      digitalWrite(LED_RED, LOW);
    }
  }
}
