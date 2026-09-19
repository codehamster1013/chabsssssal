/*
 * ============================================================
 *  손가락 길잡이 — 왼손 전용 테스트 프로토타입
 *  한국코드페어 2026 · SW공모전 초등부 · Physical Computing
 * ------------------------------------------------------------
 *  목적: 매트릭스(ROW×COL) 없이, 왼손 손가락 4개를 각각 별도
 *        디지털 입력핀에 연결해 "전기 신호가 들어오면 어느
 *        손가락인지" 시리얼로 바로 출력하는 가장 단순한 테스트.
 *        (키 구역 판정은 없음 — 그건 finger_guide.ino의 역할.
 *         이 스케치는 손가락 감지 자체가 되는지만 먼저 확인한다.)
 *
 *  원리: 손가락 구리 패드 → 디지털 입력핀 하나씩, 10kΩ으로
 *        GND에 풀다운. 키보드 쪽 패드는 전부 5V 공용선 하나로
 *        묶어 둔다. 손가락이 어떤 키에든 닿는 순간 그 손가락과
 *        연결된 핀에만 5V가 흘러들어가 LOW→HIGH로 바뀐다.
 *        → 어떤 핀이 바뀌었는지만 보면 어느 손가락인지 안다.
 *
 *  연결(왼손 4손가락만 · 아두이노 Uno):
 *   - D2 = L5(새끼) / D3 = L4(약지) / D4 = L3(중지) / D5 = L2(검지)
 *   - 각 핀 → 10kΩ 저항 → GND (풀다운, 안 닿았을 때 LOW 유지)
 *   - 모든 키 구역 패드 → 5V 공용 버스 한 줄로 묶기
 *
 *  주의: 아두이노 Uno에는 INPUT_PULLDOWN 모드가 없으므로
 *        위처럼 외부 저항으로 풀다운을 직접 만들어야 한다.
 *
 *  실행: 업로드 후 시리얼 모니터(9600bps)를 열고 왼손 손가락으로
 *        아무 키나 눌러 보면 어느 손가락인지 한글로 출력된다.
 * ============================================================
 */

const int FINGER_COUNT = 4;
const int fingerPins[FINGER_COUNT]   = {2, 3, 4, 5};
const char* fingerId[FINGER_COUNT]   = {"L5", "L4", "L3", "L2"};
const char* fingerName[FINGER_COUNT] = {"왼손 새끼", "왼손 약지", "왼손 중지", "왼손 검지"};

// 같은 접촉을 계속 중복 출력하지 않도록 직전 상태 기억
bool lastState[FINGER_COUNT];

void setup() {
  Serial.begin(9600);
  for (int i = 0; i < FINGER_COUNT; i++) {
    pinMode(fingerPins[i], INPUT); // 외부 풀다운 저항 사용
    lastState[i] = false;
  }
  Serial.println("READY - 왼손 손가락 감지 테스트 시작");
}

void loop() {
  for (int i = 0; i < FINGER_COUNT; i++) {
    bool now = (digitalRead(fingerPins[i]) == HIGH);

    if (now && !lastState[i]) {          // 막 닿은 순간(LOW→HIGH)
      Serial.print(fingerId[i]);
      Serial.print(" (");
      Serial.print(fingerName[i]);
      Serial.println(") 손가락 감지!");
    } else if (!now && lastState[i]) {   // 막 뗀 순간(HIGH→LOW)
      Serial.print(fingerId[i]);
      Serial.println(" 뗌");
    }
    lastState[i] = now;
  }

  delay(15); // 간단한 폴링 주기 겸 디바운스
}
