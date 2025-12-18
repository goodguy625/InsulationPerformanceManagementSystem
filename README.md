# 절연성능 관리 시스템

절연성능 평가 및 절연저항 열화 패턴 분류를 위한 웹 기반 분석 시스템입니다.

## 시스템 개요

본 시스템은 전기 설비의 절연성능을 정량적으로 평가하고, 절연저항의 열화 패턴을 분류하여 예측 기반 유지보수를 지원하는 웹 애플리케이션입니다. 2가지 평가 모드를 제공하며, 데이터 시각화, 이력 관리, 그리고 위험도 기반 체크리스트 기능을 포함합니다.

---

## 주요 기능

### 1. 절연성능 경향평가 (Performance Evaluation)

전류-온도 데이터를 기반으로 절연성능을 정량적으로 평가합니다.

#### 입력
- **전류(I)**: 5분 간격 측정값 [A]
- **온도(T)**: 5분 간격 측정값 [℃]
- **입력 방식**:
  - 단일 데이터 입력 (시계열 방식, 최소 2회 이상)
  - Excel/CSV 파일 업로드 (다량 데이터)

#### 계산 지표
1. **전기적 스트레스 (S_I)**
   - 정의: S_I = I_max / I_critic
   - I_max: 측정 전류의 최댓값 (마지막 측정값)
   - I_critic: 허용온도(70℃) 도달 시 임계전류

2. **열적 스트레스 (S_T)**
   - 정의: S_T = T_max / T_critic
   - T_max: 측정 온도의 최댓값 (마지막 측정값)
   - T_critic: 허용온도 (70℃)

3. **온도반응 민감도 (R)**
   - 정의: R = (T_n2 - T_n1) / (I_n2 - I_n1)
   - 마지막 2개 측정값 간 온도변화율

#### 출력
- **위험도 평가**: 각 지표별 4단계 레벨 (L1~L4)
  - L1 (정상), L2 (주의), L3 (경계), L4 (위험)
- **위험도별 체크리스트**: L2 이상일 때 자동 표시
  - 전기적 스트레스 점검지표 (5개 항목)
  - 열적 스트레스 점검지표 (5개 항목)
  - 발열민감도 점검지표 (5개 항목)
- **가중치 기반 점검 결과**:
  - 점검지표별 점수 (0~10점)
  - 점검지표별 개별 상태 평가 및 관리방안 제시
  - 체크리스트와 결과를 나란히 배치하여 한눈에 확인 가능
- **전류-온도 관계 그래프**: 누적 데이터 시각화

### 2. 절연저항 패턴평가 (Degradation Pattern Classification)

시계열 절연저항 데이터의 열화 패턴을 5가지 유형으로 분류합니다.

#### 입력
- **연도+월**: YYYY-MM 형식
- **절연저항**: 측정값 [MΩ]
- **입력 방식**:
  - 단일 데이터 입력 (이전 기록과 자동 병합 가능)
  - Excel/CSV 파일 업로드

#### 분류 패턴
1. **임계형 (Critical)**: 급격한 저하, 1MΩ 이하 도달
   - 열화 단계: Failure (임계열화)
   - 관리 방향: 운전중지, 정밀점검, 배선 교체

2. **가속형 (Accelerated)**: 100MΩ 미만, 70% 이상 감소
   - 열화 단계: Propagation (진전열화)
   - 관리 방향: 점검주기 단축 (분기점검)

3. **완만형 (Gradual)**: 10~20% 완만한 저하
   - 열화 단계: Initiation (초기열화)
   - 관리 방향: 경년추이 감시 (반기점검)

4. **국부형 (Localized)**: 일시적 저하 반복
   - 열화 단계: Anomaly (이상열화)
   - 관리 방향: 경년추이 감시, 300MΩ 미만 시 단축점검

5. **안정형 (Stable)**: 1000MΩ 이상, 변동폭 ±1% 이내
   - 열화 단계: Healthy (건전상태)
   - 관리 방향: 정기 절연 확인 (연 1회)

#### 출력
- 패턴 특성 분석 (감소폭, 변동성, 임계치 도달 여부)
- 열화 단계 및 관리 방향
- 절연저항 시계열 그래프

---

## 체크리스트 시스템

### 가중치 기반 평가

각 점검 항목은 중요도에 따라 가중치(1~3점)가 부여됩니다.

#### 전기적 스트레스 점검지표 (총 10점)
| 점검 항목 | 가중치 |
|----------|--------|
| 운전 중 정격전류를 초과하는 구간이 존재하는가? | 2점 |
| 부하변동이 크거나, 순간 과전류가 반복되는가? | 3점 |
| 교반기에 이물질이 끼인 상태로 운전되는가? | 2점 |
| 모터 기동방식은 비(非)인버터 인가? (DOL/Y-Δ) | 1점 |
| S.F(여유계수) 1.0 이하의 모터를 장시간 운전하는가? | 2점 |

#### 열적 스트레스 점검지표 (총 10점)
| 점검 항목 | 가중치 |
|----------|--------|
| 전기배선 단자부가 70℃에 근접한 적이 있는가? | 3점 |
| 전기배선 주변온도가 40℃를 초과하는가? | 2점 |
| 설치장소가 통풍 또는 발열 불충분 조건인가? | 1점 |
| 열원(전열, 증기열)이 전기배선에 인접해 있는가? | 2점 |
| 1회 가동시 수일 이상 연속가동 되는가? | 2점 |

#### 발열민감도 점검지표 (총 10점)
| 점검 항목 | 가중치 |
|----------|--------|
| 동일조건 중 과거보다 온도가 빠르게 상승하는가? | 1점 |
| 전류변화가 작음에도 온도 급상승 패턴이 있는가? | 3점 |
| 부하증가시 온도가 비선형적으로 급하게 상승하는가? | 3점 |
| 동종의 다른 설비보다 온도상승폭이 과도한가? | 2점 |
| 온도상승 후 냉각될 때 열이 잔류하는 경향이 있는가? | 1점 |

### 상태 평가 기준

각 점검지표(전기적 스트레스, 열적 스트레스, 발열민감도)는 개별적으로 평가되며, 점수에 따라 다음과 같은 상태와 관리방안이 제시됩니다:

| 점검지표 점수 | 상태 | 관리방안 |
|--------------|------|----------|
| 0점 | 미평가 | 체크리스트를 선택하면 적절한 관리방안이 표시됩니다. |
| 1~2점 | 주의 | 점검주기 단축필요<br>• 현재 점검 주기보다 더 짧은 간격으로 절연성능을 모니터링하세요.<br>• 추세를 지속적으로 관찰하여 악화 여부를 확인하세요. |
| 3~4점 | 경계 | 절연저항 패턴관리 필요<br>• 절연저항 값의 추이를 면밀히 분석하세요.<br>• 패턴 변화를 기록하고 이상 징후를 감지하세요.<br>• 필요시 전문가 검토를 권장합니다. |
| 5점 이상 | 위험 | 가동중지, 정밀점검 필요<br>• **즉시 설비 가동을 중지**하세요.<br>• 전문가에 의한 정밀 점검을 실시하세요.<br>• 절연 상태를 면밀히 검사하고 필요시 부품을 교체하세요.<br>• 안전이 확인될 때까지 재가동을 금지하세요. |

---

## 파일 구조 및 설명

```
insulation-analysis/
├── index.html      # 사용자 인터페이스 구조 정의
├── styles.css      # 스타일시트 (UI 디자인)
├── script.js       # 핵심 분석 로직 및 이벤트 처리
└── README.md       # 문서 (본 파일)
```

### 주요 외부 라이브러리
- **Chart.js (v4.4.0)**: 데이터 시각화 (그래프 생성)
- **SheetJS (v0.18.5)**: Excel/CSV 파일 파싱

---

## 핵심 코드 설명

### 1. 절연성능 평가 - 임계전류 계산 ([script.js:41-55](script.js#L41-L55))

```javascript
// 회귀식: T = 39.685 + 0.0298 * I + 0.0139 * I²
// T_critic(90℃) 도달 시 I_critic 계산 (2차 방정식 해법)
const a = REGRESSION_C; // 0.0139 (I²의 계수)
const b = REGRESSION_B; // 0.0298 (I의 계수)
const c = REGRESSION_A - T_CRITIC; // 39.685 - 90 = -30.685

const discriminant = b * b - 4 * a * c; // 판별식
let iCritic;
if (discriminant >= 0) {
    iCritic = (-b + Math.sqrt(discriminant)) / (2 * a);
} else {
    iCritic = 100; // 기본값
}
```

**설명**: 온도-전류 관계를 2차 회귀식으로 모델링하고, 허용온도(90℃)에 도달하는 임계전류를 2차 방정식의 근의 공식으로 계산합니다.

---

### 2. 절연성능 평가 - 위험도 분류 ([script.js:358-384](script.js#L358-L384))

```javascript
// 전기적 스트레스 위험도 평가
function evaluateRiskI(deltaI) {
    if (deltaI < 1.0) return { level: 'L1', name: '정상', class: 'risk-l1' };
    if (deltaI < 1.2) return { level: 'L2', name: '주의', class: 'risk-l2' };
    if (deltaI < 1.5) return { level: 'L3', name: '경계', class: 'risk-l3' };
    return { level: 'L4', name: '위험', class: 'risk-l4' };
}

// 열적 스트레스 위험도 평가
function evaluateRiskT(deltaT) {
    if (deltaT < 0.5) return { level: 'L1', name: '정상', class: 'risk-l1' };
    if (deltaT < 0.8) return { level: 'L2', name: '주의', class: 'risk-l2' };
    if (deltaT < 1.0) return { level: 'L3', name: '경계', class: 'risk-l3' };
    return { level: 'L4', name: '위험', class: 'risk-l4' };
}

// 온도반응 민감도 위험도 평가
function evaluateRiskR(sensitivity) {
    if (sensitivity === null) {
        return { level: '-', name: '기준값', class: 'risk-baseline' };
    }
    if (sensitivity < 0.5) return { level: 'L1', name: '보통', class: 'risk-l1' };
    if (sensitivity < 1.0) return { level: 'L2', name: '높음', class: 'risk-l2' };
    if (sensitivity < 1.5) return { level: 'L3', name: '위험', class: 'risk-l3' };
    return { level: 'L4', name: '치명', class: 'risk-l4' };
}
```

**설명**: 계산된 스트레스 지표를 임계값 기반으로 4단계 위험도(L1~L4)로 분류합니다. 각 지표마다 고유한 임계값 기준을 적용합니다.

---

### 3. 체크리스트 - 가중치 기반 평가 및 점검지표별 결과 표시

#### 체크리스트 레이아웃 ([script.js:464-624](script.js#L464-L624))

```javascript
// 체크리스트 HTML 생성 (L2 이상일 때만 표시)
function generateChecklistHTML(riskI, riskT, riskR) {
    // Grid 레이아웃으로 체크리스트와 결과를 나란히 배치
    // grid-template-columns: 1fr 400px (왼쪽: 체크리스트, 오른쪽: 결과)

    if (['L2', 'L3', 'L4'].includes(riskI.level)) {
        html += `
            <div style="display: grid; grid-template-columns: 1fr 400px; gap: 20px;">
                <!-- 왼쪽: 체크리스트 항목들 -->
                <div>
                    <input type="checkbox" data-category="electric" data-weight="2">
                    <label>운전 중 정격전류를 초과하는 구간이 존재하는가?</label>
                    // ... 5개 항목
                </div>

                <!-- 오른쪽: 점수, 상태, 관리방안 -->
                <div>
                    <div id="electric-score">점수 표시</div>
                    <div id="electric-status-result">상태 표시</div>
                    <div id="electric-management-detail">관리방안 표시</div>
                </div>
            </div>
        `;
    }

    // 열적 스트레스, 발열민감도도 동일한 구조
}
```

#### 점수 계산 및 결과 업데이트 ([script.js:711-768](script.js#L711-L768))

```javascript
// 카테고리별 점수 계산
function calculateCategoryScore(category) {
    const checkboxes = document.querySelectorAll(
        `.checklist-checkbox[data-category="${category}"]:checked`
    );
    let score = 0;
    checkboxes.forEach(checkbox => {
        score += parseInt(checkbox.dataset.weight);
    });
    return score;
}

// 체크리스트 결과 업데이트
function updateChecklistResults() {
    // 각 카테고리별 점수 계산
    const electricScore = calculateCategoryScore('electric');
    const thermalScore = calculateCategoryScore('thermal');
    const sensitivityScore = calculateCategoryScore('sensitivity');

    // 점수 표시 업데이트
    document.getElementById('electric-score').textContent = electricScore;
    document.getElementById('thermal-score').textContent = thermalScore;
    document.getElementById('sensitivity-score').textContent = sensitivityScore;

    // 각 카테고리별 평가 및 상태/관리방안 업데이트
    updateCategoryResult('electric', electricScore, evaluateChecklistResult(electricScore));
    updateCategoryResult('thermal', thermalScore, evaluateChecklistResult(thermalScore));
    updateCategoryResult('sensitivity', sensitivityScore, evaluateChecklistResult(sensitivityScore));
}

// 점검 결과 평가
function evaluateChecklistResult(score) {
    if (score === 0) {
        return { status: '미평가', management: '체크리스트를 선택하면...' };
    } else if (score >= 1 && score <= 2) {
        return { status: '주의', management: '점검주기 단축필요<br>• 현재 점검 주기보다...' };
    } else if (score >= 3 && score <= 4) {
        return { status: '경계', management: '절연저항 패턴관리 필요<br>• 절연저항 값의...' };
    } else {
        return { status: '위험', management: '가동중지, 정밀점검 필요<br>• 즉시 설비...' };
    }
}
```

**설명**: 위험도가 L2 이상인 지표에 대해 Grid 레이아웃으로 체크리스트와 결과를 나란히 배치합니다. 왼쪽에는 체크리스트 항목들이, 오른쪽에는 점수/상태/관리방안이 실시간으로 표시되어 한눈에 확인할 수 있습니다. 각 점검지표는 독립적으로 평가되며, 색상으로 구분된 그라데이션 박스로 시각적 구분이 명확합니다.

---

### 4. 절연저항 패턴 분석 - 열화 분류 ([script.js:835-938](script.js#L835-L938))

```javascript
function analyzeInsulationPattern(data) {
    // 통계 계산
    const firstValue = data[0].resistance;
    const lastValue = data[data.length - 1].resistance;
    const totalDecreaseRate = ((firstValue - lastValue) / firstValue) * 100;

    // 변동성 계산 (표준편차)
    const mean = data.reduce((sum, d) => sum + d.resistance, 0) / data.length;
    const variance = data.reduce((sum, d) => sum + Math.pow(d.resistance - mean, 2), 0) / data.length;
    const volatility = (Math.sqrt(variance) / mean) * 100;

    // 패턴 분류 로직
    if (belowThreshold || totalDecreaseRate >= 90) {
        pattern = '임계형 (Critical)';
        stage = 'Failure (임계열화)';
        management = '운전중지, 정밀점검, 배선 교체';
    }
    else if (below100 && totalDecreaseRate >= 70) {
        pattern = '가속형 (Accelerated)';
        stage = 'Propagation (진전열화)';
        management = '점검주기 단축 (분기점검)';
    }
    // ... 추가 분류 로직
}
```

**설명**: 시계열 데이터의 감소율, 변동성, 임계치 도달 여부를 종합적으로 분석하여 5가지 열화 패턴으로 분류합니다. 각 패턴에 따라 적절한 유지보수 방향을 제시합니다.

---

### 5. 데이터 시각화 - Chart.js 그래프 생성

#### 절연성능 평가 그래프 ([script.js:1433-1519](script.js#L1433-L1519))

```javascript
function updatePerformanceChartWithData(data) {
    const scatterData = data.map(item => ({
        x: item.current,
        y: item.temperature
    }));

    performanceChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: '전류-온도 응답수준',
                data: scatterData,
                borderColor: 'rgb(102, 126, 234)',
                showLine: true,
                tension: 0.4
            }]
        },
        options: {
            scales: {
                x: { title: { display: true, text: 'Current (A)' } },
                y: { title: { display: true, text: 'Temperature (℃)' } }
            }
        }
    });
}
```

#### 절연저항 패턴 그래프 ([script.js:1522-1608](script.js#L1522-L1608))

```javascript
function updateDegradationChartWithData(data) {
    const labels = data.map(d => d.date);
    const resistanceData = data.map(d => d.resistance);

    // y축 최댓값: 데이터 최댓값 + 300을 100 단위로 반올림
    const yAxisMax = Math.round((Math.max(...resistanceData) + 300) / 100) * 100;

    degradationChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '절연저항 (MΩ)',
                data: resistanceData,
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.4
            }]
        }
    });
}
```

**설명**: Chart.js 라이브러리를 사용하여 전류-온도 관계는 산점도로, 절연저항 추이는 선 그래프로 시각화합니다.

---

### 6. 로컬 저장소 관리 - 평가 이력 저장 ([script.js:1247-1258](script.js#L1247-L1258))

```javascript
function saveRecord(record) {
    const key = record.type === 'performance'
        ? STORAGE_KEY_PERFORMANCE
        : STORAGE_KEY_DEGRADATION;
    const history = getHistory(record.type);
    history.unshift(record); // 최신 기록을 맨 앞에 추가

    // 최대 100개까지만 저장
    if (history.length > 100) {
        history.pop();
    }

    localStorage.setItem(key, JSON.stringify(history));
}
```

**설명**: Web Storage API의 localStorage를 사용하여 평가 결과를 브라우저에 영구 저장합니다. 최대 100개 기록만 유지하여 저장 공간을 관리합니다.

---

## 수학적 모델 및 알고리즘

### 1. 절연성능 평가 회귀 모델

**온도-전류 관계식 (2차 다항 회귀)**

```
T = 39.452 + 0.025·I + 0.014·I²
```

- **T**: 온도 [℃]
- **I**: 전류 [A]
- **계수**: 실측 데이터 기반 최소자승법으로 추정

**임계전류 계산 (2차 방정식 해법)**

```
T_critic = 39.452 + 0.025·I_critic + 0.014·I_critic²
0.014·I_critic² + 0.025·I_critic + (39.452 - 70) = 0

I_critic = [-0.025 + √(0.025² - 4×0.014×(-30.548))] / (2×0.014)
```

### 2. 절연저항 열화 분석 통계 지표

**전체 감소율**

```
감소율(%) = (R_first - R_last) / R_first × 100
```

**변동성 (변동계수, Coefficient of Variation)**

```
CV(%) = (σ / μ) × 100

σ = √[Σ(R_i - μ)² / n]  (표준편차)
μ = Σ R_i / n            (평균)
```

### 3. 위험도 분류 기준

| 지표 | L1 (정상) | L2 (주의) | L3 (경계) | L4 (위험) |
|------|-----------|-----------|-----------|-----------|
| **전기적 스트레스 (S_I)** | < 1.0 | 1.0 ~ 1.2 | 1.2 ~ 1.5 | ≥ 1.5 |
| **열적 스트레스 (S_T)** | < 0.5 | 0.5 ~ 0.8 | 0.8 ~ 1.0 | ≥ 1.0 |
| **온도반응 민감도 (R)** | < 0.4 | 0.4 ~ 1.0 | 1.0 ~ 1.5 | ≥ 1.5 |

---

## 사용 방법

### 1. 시스템 실행
1. `index.html` 파일을 웹 브라우저에서 열기
2. 상단 모드 버튼으로 평가 유형 선택

### 2. 절연성능 경향평가

**방법 1: 단일 데이터 입력**
1. 5분 간격으로 전류/온도 측정값 입력
2. "추가" 버튼 클릭 (최소 2회 이상)
3. 입력된 데이터 확인 (마지막 값이 I_max, T_max로 사용됨)
4. "계산 및 저장" 클릭

**방법 2: 파일 업로드**
1. Excel/CSV 파일 준비
   - 형식: 1열(전류), 2열(온도)
   - 첫 행 헤더 선택 사항
2. 파일 선택 후 "다량 데이터 분석" 클릭
3. 각 행이 개별 평가되어 자동 저장

**결과 확인**
- 위험도 평가 결과 (L1~L4)
- 체크리스트 (L2 이상일 때만 표시)
- 체크리스트 항목 선택 시:
  - 각 점검지표별 실시간 점수 업데이트 (0~10점)
  - 점검지표별 개별 상태 및 관리방안 표시
  - 체크리스트와 결과가 나란히 배치되어 한눈에 확인
- 상세보기에서도 체크리스트 작성 가능

### 3. 절연저항 패턴평가

**방법 1: 단일 데이터 입력**
1. 연도, 월, 절연저항 입력
2. "추가" 클릭
3. 이전에 선택한 기록이 있으면 자동으로 병합되어 분석

**방법 2: 파일 업로드**
1. Excel/CSV 파일 준비
   - 형식: 1열(연도), 2열(월), 3열(절연저항)
2. "다량 데이터 분석" 클릭

**결과 확인**
- 패턴 분류 (임계형/가속형/완만형/국부형/안정형)
- 열화 단계 및 관리 방향
- 시계열 그래프

### 4. 이력 관리

**그래프 보기**
1. 평가 기록에서 체크박스 선택
2. "선택한 기록 그래프 보기" 클릭
3. 선택된 데이터가 누적되어 그래프에 표시

**상세보기**
1. 기록 항목의 "상세보기" 클릭
2. 입력값, 계산 결과, 체크리스트 확인
3. 상세보기에서도 체크리스트 작성 및 점수 확인 가능

**기록 삭제**
- 개별 삭제: "삭제" 버튼 클릭
- 전체 삭제: "전체 삭제" 버튼 클릭

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| **Frontend** | HTML5, CSS3, JavaScript (ES6+) |
| **데이터 처리** | SheetJS (xlsx) v0.18.5 |
| **시각화** | Chart.js v4.4.0 |
| **저장소** | Web Storage API (localStorage) |
| **실행 환경** | 모던 웹 브라우저 (Chrome, Firefox, Edge, Safari) |

---

## 주요 업데이트

### v2.2 - 레이아웃 개선 및 총점 제거
- **Grid 레이아웃 적용**: 체크리스트와 결과를 나란히 배치하여 공간 효율성 향상
- **총점 제거**: 각 점검지표별 독립 평가에 집중
- **시각적 개선**: 점검지표별 색상 구분 (전기적-보라, 열적-핑크, 발열민감도-파랑)
- **한눈에 확인**: 체크리스트 왼쪽, 점수/상태/관리방안 오른쪽 배치

### v2.1 - 점검지표별 개별 결과 표시
- **점검지표별 독립 평가**: 전기적 스트레스, 열적 스트레스, 발열민감도 각각 개별 상태 및 관리방안 표시
- **상세한 관리방안 제공**: 각 점검지표의 점수에 따라 구체적인 조치사항 제시
- **UI 개선**: 점검지표별로 구분된 결과 표시 영역으로 가독성 향상

### v2.0 - 체크리스트 시스템 추가
- 위험도 기반 점검지표 체크리스트 (L2 이상 자동 표시)
- 가중치 시스템 도입 (1~3점)
- 점검지표별 개별 점수 측정 (전기적/열적/발열민감도)
- 관리방안 자동 제시
- 상세보기에서도 체크리스트 작성 가능
- 실시간 점수 업데이트

### v1.0 - 초기 버전
- 절연성능 경향평가 기능
- 절연저항 패턴평가 기능
- 데이터 시각화 및 이력 관리

---

## 참고사항

- 본 시스템은 웹 기반으로 설계되어 별도 설치 없이 브라우저에서 즉시 사용 가능
- 모든 데이터는 클라이언트 측(브라우저)에서 처리되며 서버 전송 없음
- localStorage 용량 제한(일반적으로 5~10MB)으로 최대 100개 기록만 저장
- 정확한 분석을 위해 측정 데이터의 품질과 일관성 확보 필요
- 각 점검지표(전기적/열적/발열민감도)는 독립적으로 평가되어 개별 상태와 관리방안이 제공됨
- 체크리스트 점수는 평가 결과와 별도로 관리되며, 사용자의 현장 점검 결과를 반영

---

## 라이선스

본 시스템은 연구 및 교육 목적으로 개발되었습니다.

