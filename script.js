// 상수 정의
const T_CRITIC = 90; // 허용온도 (℃)
const REGRESSION_A = 39.685;
const REGRESSION_B = 0.0298; 
const REGRESSION_C = 0.0139; 

// 모드 전환
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        
        // 버튼 활성화 상태 변경
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // 모드 컨텐츠 전환
        document.querySelectorAll('.mode-content').forEach(content => {
            content.classList.remove('active');
        });
        
        if (mode === 'performance') {
            document.getElementById('performance-mode').classList.add('active');
            loadHistory('performance');
        } else if (mode === 'degradation') {
            document.getElementById('degradation-mode').classList.add('active');
            loadHistory('degradation');
        }
    });
});

// 절연성능 평가 계산 함수
// current: I_max (5분 간격 2회 이상 측정값 중 최댓값)
// temperature: T_max (5분 간격 2회 이상 측정값 중 최댓값)
// timeSeriesData: 시계열 데이터 배열 (민감도 계산용)
function calculatePerformance(current, temperature, timeSeriesData = null) {
    if (!current || !temperature) {
        alert('전류(I_max)와 온도(T_max)를 모두 입력해주세요.');
        return;
    }

    // Icritic 계산 (회귀식: T = 39.452 + 0.025 * I + 0.014 * I²)
    // T_CRITIC = REGRESSION_A + REGRESSION_B * I + REGRESSION_C * I²
    // 0 = REGRESSION_C * I² + REGRESSION_B * I + (REGRESSION_A - T_CRITIC)
    const a = REGRESSION_C; // 0.014 (I²의 계수)
    const b = REGRESSION_B; // 0.025 (I의 계수)
    const c = REGRESSION_A - T_CRITIC; // 39.452 - 70 = -30.548 (상수항)

    const discriminant = b * b - 4 * a * c; // 판별식: b² - 4ac
    let iCritic;
    if (discriminant >= 0) {
        iCritic = (-b + Math.sqrt(discriminant)) / (2 * a);
    } else {
        // 음수인 경우, 실용적인 값으로 대체
        iCritic = 100; // 기본값
    }

    // 정량지표 계산
    // I_max: 5분 간격 2회 이상 측정값 중 최댓값
    // T_max: 5분 간격 2회 이상 측정값 중 최댓값
    const deltaI = current / iCritic; // 전기적 스트레스 S_I = I_max / I_critic
    const deltaT = temperature / T_CRITIC; // 열적 스트레스 S_T = T_max / T_critic

    // 온도반응 민감도 계산: R = (T_n2 - T_n1) / (I_n2 - I_n1)
    let sensitivity;

    if (timeSeriesData && timeSeriesData.length >= 2) {
        // 마지막 2개 데이터 사용
        const n1 = timeSeriesData[timeSeriesData.length - 2];
        const n2 = timeSeriesData[timeSeriesData.length - 1];
        const deltaTemp = n2.temperature - n1.temperature;
        const deltaCurrent = n2.current - n1.current;

        if (deltaCurrent !== 0) {
            sensitivity = deltaTemp / deltaCurrent;
        } else {
            // 전류 변화가 없으면 기존 방식 사용
            sensitivity = deltaT / deltaI;
        }
    } else {
        // 시계열 데이터가 없으면 첫 번째 데이터로 표시
        sensitivity = null; // null로 설정하여 "-"로 표시되도록 함
    }
    
    // 위험도 평가
    const riskI = evaluateRiskI(deltaI);
    const riskT = evaluateRiskT(deltaT);
    const riskR = evaluateRiskR(sensitivity);
    
    // 결과 표시
    // displayPerformanceResults(deltaI, deltaT, sensitivity, riskI, riskT, riskR, iCritic);
    
    // 체크리스트 표시
    displayChecklist(riskI, riskT, riskR);
    
    // 자동으로 기록 저장
    const record = {
        id: Date.now(),
        type: 'performance',
        date: new Date().toISOString(),
        inputs: {
            current: current,
            temperature: temperature,
            timeSeriesData: timeSeriesData // 시계열 데이터 저장
        },
        results: {
            deltaI: deltaI,
            deltaT: deltaT,
            sensitivity: sensitivity,
            iCritic: iCritic,
            riskI: riskI,
            riskT: riskT,
            riskR: riskR
        }
    };
    
    saveRecord(record);
    // 기록 목록 새로고침
    loadHistory('performance');
}

// 파일 데이터를 파싱하여 전류-온도 데이터 배열로 반환하는 함수 (절연성능 평가용)
function parsePerformanceFileData(jsonData) {
    // 첫 행이 헤더인지 확인
    const firstRow = jsonData[0] || [];
    const isHeader = firstRow.length > 0 && (
        isNaN(firstRow[0]) || 
        firstRow[0] === '전류' || 
        firstRow[0] === 'Current' ||
        firstRow[0] === 'I' ||
        firstRow[0].toString().toLowerCase().includes('current') ||
        firstRow[0].toString().toLowerCase().includes('전류')
    );
    
    const startRow = isHeader ? 1 : 0;
    const data = [];

    for (let i = startRow; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (row && row.length >= 2) {
            const current = row[0] ? row[0].toString().trim() : '';
            const temperature = row[1] ? row[1].toString().trim() : '';

            // 유효한 데이터인지 확인
            if (current && temperature && !isNaN(current) && !isNaN(temperature)) {
                data.push({
                    current: parseFloat(current),
                    temperature: parseFloat(temperature)
                });
            }
        }
    }

    return data;
}

// 절연성능 평가 파일 업로드 버튼 클릭 이벤트
document.getElementById('upload-performance-file').addEventListener('click', async () => {
    const fileInput = document.getElementById('performance-file-input');
    const file = fileInput.files[0];

    if (!file) {
        alert('파일을 선택해주세요.');
        return;
    }

    try {
        let jsonData;

        // 파일 확장자에 따라 다른 방식으로 읽기
        if (file.name.endsWith('.csv')) {
            jsonData = await readCSVFile(file);
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            jsonData = await readExcelFile(file);
        } else {
            alert('지원하지 않는 파일 형식입니다.\nExcel(.xlsx, .xls) 또는 CSV 파일을 선택해주세요.');
            return;
        }

        // 데이터 파싱
        const parsedData = parsePerformanceFileData(jsonData);

        if (parsedData.length === 0) {
            alert('파일에서 유효한 데이터를 찾을 수 없습니다.\n형식: 전류(A), 온도(℃)\n첫 번째 열: 전류, 두 번째 열: 온도');
            return;
        }

        // 각 데이터에 대해 계산 및 저장 (직전 행 참고)
        parsedData.forEach((item, index) => {
            // 약간의 지연을 두어 기록이 순차적으로 저장되도록
            setTimeout(() => {
                // 첫 번째 행이면 직전 데이터 없이 계산
                if (index === 0) {
                    calculatePerformance(item.current, item.temperature, null);
                } else {
                    // 두 번째 행부터는 직전 행과 현재 행을 시계열로 전달
                    const prevItem = parsedData[index - 1];
                    const timeSeriesData = [
                        { time: 0, current: prevItem.current, temperature: prevItem.temperature },
                        { time: 5, current: item.current, temperature: item.temperature }
                    ];
                    calculatePerformance(item.current, item.temperature, timeSeriesData);
                }
            }, index * 100);
        });

        alert(`${parsedData.length}개의 데이터를 분석했습니다.\n(각 행은 직전 행을 참고하여 민감도 계산)`);

    } catch (error) {
        alert(error.message);
        console.error('파일 읽기 오류:', error);
    }
});

// 시계열 데이터 입력 관리
let performanceTimeSeriesData = [];
let performanceCurrentTime = 0;

// 시계열 데이터 추가 버튼 클릭 이벤트 (절연성능 평가)
document.getElementById('add-single-performance').addEventListener('click', () => {
    const current = document.getElementById('single-current-input').value.trim();
    const temperature = document.getElementById('single-temperature-input').value.trim();
    const time = performanceCurrentTime;

    if (!current || !temperature) {
        alert('전류(I)와 온도(T)를 모두 입력해주세요.');
        return;
    }

    if (isNaN(current) || isNaN(temperature)) {
        alert('올바른 숫자를 입력해주세요.');
        return;
    }

    // 데이터 추가
    performanceTimeSeriesData.push({
        time: time,
        current: parseFloat(current),
        temperature: parseFloat(temperature)
    });

    // 다음 시간 설정 (5분 간격)
    performanceCurrentTime += 5;
    document.getElementById('single-time-input').value = performanceCurrentTime;

    // 입력 필드 초기화
    document.getElementById('single-current-input').value = '';
    document.getElementById('single-temperature-input').value = '';

    // 테이블 업데이트
    updatePerformanceInputTable();

    // 입력 리스트 표시
    document.getElementById('performance-input-list').style.display = 'block';
});

// 시계열 데이터 테이블 업데이트
function updatePerformanceInputTable() {
    const tbody = document.getElementById('performance-input-tbody');

    if (performanceTimeSeriesData.length === 0) {
        tbody.innerHTML = '';
        document.getElementById('performance-input-list').style.display = 'none';
        return;
    }

    // 마지막 값 (I_max, T_max로 사용될 값)
    const lastIndex = performanceTimeSeriesData.length - 1;
    const lastData = performanceTimeSeriesData[lastIndex];

    // 테이블 생성
    tbody.innerHTML = performanceTimeSeriesData.map((data, index) => {
        const isLast = index === lastIndex;

        return `
            <tr style="${isLast ? 'background: #e7f5e7;' : 'background: white;'}">
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #333;">${data.time}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center; ${isLast ? 'font-weight: bold; color: #28a745;' : 'color: #333;'}">${data.current.toFixed(2)}${isLast ? ' 🔵' : ''}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center; ${isLast ? 'font-weight: bold; color: #28a745;' : 'color: #333;'}">${data.temperature.toFixed(2)}${isLast ? ' 🔵' : ''}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                    <button onclick="deletePerformanceInputRow(${index})" style="padding: 4px 8px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">삭제</button>
                </td>
            </tr>
        `;
    }).join('');

    // 마지막 값 정보 표시
    const maxInfo = document.getElementById('performance-max-info');
    if (performanceTimeSeriesData.length >= 2) {
        maxInfo.innerHTML = `→ I<sub>max</sub> = ${lastData.current.toFixed(2)} A (마지막 측정값), T<sub>max</sub> = ${lastData.temperature.toFixed(2)} ℃ (마지막 측정값)`;
    } else {
        maxInfo.innerHTML = '';
    }
}

// 시계열 데이터 행 삭제
function deletePerformanceInputRow(index) {
    performanceTimeSeriesData.splice(index, 1);
    updatePerformanceInputTable();

    if (performanceTimeSeriesData.length === 0) {
        performanceCurrentTime = 0;
        document.getElementById('single-time-input').value = 0;
    }
}

// 초기화 버튼 클릭 이벤트
document.getElementById('reset-performance-input').addEventListener('click', () => {
    if (performanceTimeSeriesData.length > 0 && !confirm('입력된 모든 데이터를 초기화하시겠습니까?')) {
        return;
    }

    performanceTimeSeriesData = [];
    performanceCurrentTime = 0;
    document.getElementById('single-time-input').value = 0;
    document.getElementById('single-current-input').value = '';
    document.getElementById('single-temperature-input').value = '';
    updatePerformanceInputTable();
});

// 계산 및 저장 버튼 클릭 이벤트
document.getElementById('calculate-performance').addEventListener('click', () => {
    if (performanceTimeSeriesData.length < 2) {
        alert('최소 2개 이상의 데이터를 입력해주세요.');
        return;
    }

    // 배열 복사 (setTimeout 때문에 초기화되기 전에 복사 필요)
    const dataToSave = [...performanceTimeSeriesData];

    // 각 시계열 데이터를 개별 기록으로 저장
    dataToSave.forEach((data, index) => {
        setTimeout(() => {
            if (index === 0) {
                // 첫 번째 데이터: 이전 데이터 없음
                calculatePerformance(data.current, data.temperature, null);
            } else {
                // 두 번째 이후: 이전 데이터와 현재 데이터 사용
                const prevData = dataToSave[index - 1];
                const timeSeriesDataForCalc = [
                    { time: prevData.time, current: prevData.current, temperature: prevData.temperature },
                    { time: data.time, current: data.current, temperature: data.temperature }
                ];
                calculatePerformance(data.current, data.temperature, timeSeriesDataForCalc);
            }
        }, index * 100); // 각 저장 사이에 100ms 지연
    });

    // 입력 데이터 초기화
    performanceTimeSeriesData = [];
    performanceCurrentTime = 0;
    document.getElementById('single-time-input').value = 0;
    updatePerformanceInputTable();
});

// 전역 함수로 등록
window.deletePerformanceInputRow = deletePerformanceInputRow;

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
    // null인 경우 (첫 번째 데이터 포인트)
    if (sensitivity === null) {
        return { level: '-', name: '기준값', class: 'risk-baseline' };
    }
    if (sensitivity < 0.5) return { level: 'L1', name: '보통', class: 'risk-l1' };
    if (sensitivity < 1.0) return { level: 'L2', name: '높음', class: 'risk-l2' };
    if (sensitivity < 1.5) return { level: 'L3', name: '위험', class: 'risk-l3' };
    return { level: 'L4', name: '치명', class: 'risk-l4' };
}

// 절연성능 평가 결과 표시
// 사용하지 않는 함수 - 주석 처리
/*
function displayPerformanceResults(deltaI, deltaT, sensitivity, riskI, riskT, riskR, iCritic) {
    const tbody = document.getElementById('indicators-tbody');
    tbody.innerHTML = `
        <tr>
            <td><strong>전기적 스트레스 S<sub>I</sub></strong><br><small>S<sub>I</sub> = I<sub>max</sub> / I<sub>critic</sub></small><br><small>I<sub>critic</sub> = ${iCritic.toFixed(2)} A</small></td>
            <td>${deltaI.toFixed(3)}</td>
            <td>
                <div class="risk-badge-container">
                    <span class="risk-badge ${riskI.class}">${riskI.level}</span>
                    <span class="risk-badge-name ${riskI.class}">${riskI.name}</span>
                </div>
            </td>
            <td>${getRiskDescriptionI(riskI.level)}</td>
        </tr>
        <tr>
            <td><strong>열적 스트레스 S<sub>T</sub></strong><br><small>S<sub>T</sub> = T<sub>max</sub> / T<sub>critic</sub></small><br><small>T<sub>critic</sub> = ${T_CRITIC} ℃</small></td>
            <td>${deltaT.toFixed(3)}</td>
            <td>
                <div class="risk-badge-container">
                    <span class="risk-badge ${riskT.class}">${riskT.level}</span>
                    <span class="risk-badge-name ${riskT.class}">${riskT.name}</span>
                </div>
            </td>
            <td>${getRiskDescriptionT(riskT.level)}</td>
        </tr>
        <tr>
            <td><strong>온도반응 민감도 (R)</strong><br><small>R = (T<sub>n2</sub> - T<sub>n1</sub>) / (I<sub>n2</sub> - I<sub>n1</sub>)</small></td>
            <td>${sensitivity === null ? '-' : sensitivity.toFixed(3) + ' ℃/A'}</td>
            <td>
                <div class="risk-badge-container">
                    <span class="risk-badge ${riskR.class}">${riskR.level}</span>
                    <span class="risk-badge-name ${riskR.class}">${riskR.name}</span>
                </div>
            </td>
            <td>${getRiskDescriptionR(riskR.level)}</td>
        </tr>
    `;

    document.getElementById('performance-results').style.display = 'block';
}

// 위험도 설명
function getRiskDescriptionI(level) {
    const descriptions = {
        'L1': '1.0 미만',
        'L2': '1.0 이상 ~ 1.2 미만',
        'L3': '1.2 이상 ~ 1.5 미만',
        'L4': '1.5 이상 (7배수 가정)'
    };
    return descriptions[level] || '';
}

function getRiskDescriptionT(level) {
    const descriptions = {
        'L1': '0.5 미만',
        'L2': '0.5 이상 ~ 0.8 미만',
        'L3': '0.8 이상 ~ 1.0 미만',
        'L4': '1.0 이상 (도달시 위험)'
    };
    return descriptions[level] || '';
}

function getRiskDescriptionR(level) {
    const descriptions = {
        '-': '이전 측정값 없음',
        'L1': '0.4 미만',
        'L2': '0.4 이상 ~ 1.0 미만',
        'L3': '1.0 이상',
        'L4': '1.5 이상'
    };
    return descriptions[level] || '';
}
*/

// 체크리스트 HTML 생성 함수
function generateChecklistHTML(riskI, riskT, riskR) {
    let html = '';

    // 전류 관련 체크리스트 (전기적 스트레스가 L2 이상일 때)
    if (['L2', 'L3', 'L4'].includes(riskI.level)) {
        html += `
            <div style="margin-bottom: 30px; background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <h4 style="color: #667eea; margin-bottom: 15px; font-size: 1.2em;">⚡ 전기적 스트레스 점검지표</h4>
                <div style="display: grid; grid-template-columns: 1fr 400px; gap: 20px;">
                    <!-- 체크리스트 영역 -->
                    <div>
                        <div class="checklist-item" style="margin-bottom: 8px;">
                            <input type="checkbox" class="checklist-checkbox" data-category="electric" data-weight="2" style="margin-right: 8px;">
                            <label>운전 중 정격전류를 초과하는 구간이 존재하는가?</label>
                        </div>
                        <div class="checklist-item" style="margin-bottom: 8px;">
                            <input type="checkbox" class="checklist-checkbox" data-category="electric" data-weight="3" style="margin-right: 8px;">
                            <label>부하변동이 크거나, 순간 과전류가 반복되는가?</label>
                        </div>
                        <div class="checklist-item" style="margin-bottom: 8px;">
                            <input type="checkbox" class="checklist-checkbox" data-category="electric" data-weight="2" style="margin-right: 8px;">
                            <label>교반기에 이물질이 끼인 상태로 운전되는가?</label>
                        </div>
                        <div class="checklist-item" style="margin-bottom: 8px;">
                            <input type="checkbox" class="checklist-checkbox" data-category="electric" data-weight="1" style="margin-right: 8px;">
                            <label>모터 기동방식은 비(非)인버터 인가? (DOL/Y-Δ)</label>
                        </div>
                        <div class="checklist-item" style="margin-bottom: 8px;">
                            <input type="checkbox" class="checklist-checkbox" data-category="electric" data-weight="2" style="margin-right: 8px;">
                            <label>S.F(여유계수) 1.0 이하의 모터를 장시간 운전하는가?</label>
                        </div>
                    </div>
                    <!-- 결과 표시 영역 -->
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <!-- 점수 -->
                        <div style="padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; text-align: center; color: white;">
                            <div style="font-size: 0.85em; margin-bottom: 5px; opacity: 0.9;">점검 점수</div>
                            <div id="electric-score" style="font-size: 2.5em; font-weight: bold;">0</div>
                            <div style="font-size: 0.8em; margin-top: 5px; opacity: 0.9;">/ 10점</div>
                        </div>
                        <!-- 상태 -->
                        <div id="electric-status-result" style="text-align: center; font-size: 1.1em; font-weight: bold; padding: 12px; background: #f8f9fa; border-radius: 8px; border: 2px solid #dee2e6;">
                            체크리스트를 선택해주세요.
                        </div>
                        <!-- 관리방안 -->
                        <div id="electric-management-result" style="padding: 12px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #667eea;">
                            <div style="font-size: 0.85em; font-weight: bold; color: #667eea; margin-bottom: 5px;">📌 관리방안</div>
                            <div id="electric-management-detail" style="font-size: 0.85em; color: #495057; line-height: 1.6;">
                                체크리스트를 선택하면 적절한 관리방안이 표시됩니다.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // 온도 관련 체크리스트 (열적 스트레스가 L2 이상일 때)
    if (['L2', 'L3', 'L4'].includes(riskT.level)) {
        html += `
            <div style="margin-bottom: 30px; background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <h4 style="color: #667eea; margin-bottom: 15px; font-size: 1.2em;">🔥 열적 스트레스 점검지표</h4>
                <div style="display: grid; grid-template-columns: 1fr 400px; gap: 20px;">
                    <!-- 체크리스트 영역 -->
                    <div>
                        <div class="checklist-item" style="margin-bottom: 8px;">
                            <input type="checkbox" class="checklist-checkbox" data-category="thermal" data-weight="3" style="margin-right: 8px;">
                            <label>전기배선 단자부가 70℃에 근접한 적이 있는가?</label>
                        </div>
                        <div class="checklist-item" style="margin-bottom: 8px;">
                            <input type="checkbox" class="checklist-checkbox" data-category="thermal" data-weight="2" style="margin-right: 8px;">
                            <label>전기배선 주변온도가 40℃를 초과하는가?</label>
                        </div>
                        <div class="checklist-item" style="margin-bottom: 8px;">
                            <input type="checkbox" class="checklist-checkbox" data-category="thermal" data-weight="1" style="margin-right: 8px;">
                            <label>설치장소가 통풍 또는 발열 불충분 조건인가?</label>
                        </div>
                        <div class="checklist-item" style="margin-bottom: 8px;">
                            <input type="checkbox" class="checklist-checkbox" data-category="thermal" data-weight="2" style="margin-right: 8px;">
                            <label>열원(전열, 증기열)이 전기배선에 인접해 있는가?</label>
                        </div>
                        <div class="checklist-item" style="margin-bottom: 8px;">
                            <input type="checkbox" class="checklist-checkbox" data-category="thermal" data-weight="2" style="margin-right: 8px;">
                            <label>1회 가동시 수일 이상 연속가동 되는가?</label>
                        </div>
                    </div>
                    <!-- 결과 표시 영역 -->
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <!-- 점수 -->
                        <div style="padding: 15px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 8px; text-align: center; color: white;">
                            <div style="font-size: 0.85em; margin-bottom: 5px; opacity: 0.9;">점검 점수</div>
                            <div id="thermal-score" style="font-size: 2.5em; font-weight: bold;">0</div>
                            <div style="font-size: 0.8em; margin-top: 5px; opacity: 0.9;">/ 10점</div>
                        </div>
                        <!-- 상태 -->
                        <div id="thermal-status-result" style="text-align: center; font-size: 1.1em; font-weight: bold; padding: 12px; background: #f8f9fa; border-radius: 8px; border: 2px solid #dee2e6;">
                            체크리스트를 선택해주세요.
                        </div>
                        <!-- 관리방안 -->
                        <div id="thermal-management-result" style="padding: 12px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #667eea;">
                            <div style="font-size: 0.85em; font-weight: bold; color: #667eea; margin-bottom: 5px;">📌 관리방안</div>
                            <div id="thermal-management-detail" style="font-size: 0.85em; color: #495057; line-height: 1.6;">
                                체크리스트를 선택하면 적절한 관리방안이 표시됩니다.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // 온도반응/열화 관련 체크리스트 (민감도가 L2 이상일 때)
    if (['L2', 'L3', 'L4'].includes(riskR.level)) {
        html += `
            <div style="margin-bottom: 30px; background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <h4 style="color: #667eea; margin-bottom: 15px; font-size: 1.2em;">🌡️ 발열민감도 점검지표</h4>
                <div style="display: grid; grid-template-columns: 1fr 400px; gap: 20px;">
                    <!-- 체크리스트 영역 -->
                    <div>
                        <div class="checklist-item" style="margin-bottom: 8px;">
                            <input type="checkbox" class="checklist-checkbox" data-category="sensitivity" data-weight="1" style="margin-right: 8px;">
                            <label>동일조건 중 과거보다 온도가 빠르게 상승하는가?</label>
                        </div>
                        <div class="checklist-item" style="margin-bottom: 8px;">
                            <input type="checkbox" class="checklist-checkbox" data-category="sensitivity" data-weight="3" style="margin-right: 8px;">
                            <label>전류변화가 작음에도 온도 급상승 패턴이 있는가?</label>
                        </div>
                        <div class="checklist-item" style="margin-bottom: 8px;">
                            <input type="checkbox" class="checklist-checkbox" data-category="sensitivity" data-weight="3" style="margin-right: 8px;">
                            <label>부하증가시 온도가 비선형적으로 급하게 상승하는가?</label>
                        </div>
                        <div class="checklist-item" style="margin-bottom: 8px;">
                            <input type="checkbox" class="checklist-checkbox" data-category="sensitivity" data-weight="2" style="margin-right: 8px;">
                            <label>동종의 다른 설비보다 온도상승폭이 과도한가?</label>
                        </div>
                        <div class="checklist-item" style="margin-bottom: 8px;">
                            <input type="checkbox" class="checklist-checkbox" data-category="sensitivity" data-weight="1" style="margin-right: 8px;">
                            <label>온도상승 후 냉각될 때 열이 잔류하는 경향이 있는가?</label>
                        </div>
                    </div>
                    <!-- 결과 표시 영역 -->
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <!-- 점수 -->
                        <div style="padding: 15px; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); border-radius: 8px; text-align: center; color: white;">
                            <div style="font-size: 0.85em; margin-bottom: 5px; opacity: 0.9;">점검 점수</div>
                            <div id="sensitivity-score" style="font-size: 2.5em; font-weight: bold;">0</div>
                            <div style="font-size: 0.8em; margin-top: 5px; opacity: 0.9;">/ 10점</div>
                        </div>
                        <!-- 상태 -->
                        <div id="sensitivity-status-result" style="text-align: center; font-size: 1.1em; font-weight: bold; padding: 12px; background: #f8f9fa; border-radius: 8px; border: 2px solid #dee2e6;">
                            체크리스트를 선택해주세요.
                        </div>
                        <!-- 관리방안 -->
                        <div id="sensitivity-management-result" style="padding: 12px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #667eea;">
                            <div style="font-size: 0.85em; font-weight: bold; color: #667eea; margin-bottom: 5px;">📌 관리방안</div>
                            <div id="sensitivity-management-detail" style="font-size: 0.85em; color: #495057; line-height: 1.6;">
                                체크리스트를 선택하면 적절한 관리방안이 표시됩니다.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    if (html === '') {
        html = '<p style="text-align: center; color: #28a745; font-weight: 600; padding: 20px;">모든 지표가 정상 범위입니다. 특별한 체크리스트가 필요하지 않습니다.</p>';
    } else {
        // 기준 안내 추가
        html += `
            <div style="margin-top: 20px; padding: 20px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 10px; border: 2px solid #667eea;">
                <h5 style="color: #667eea; margin-bottom: 12px; font-size: 1em; text-align: center;">💡 평가 기준</h5>
                <ul style="margin: 0; padding-left: 20px; line-height: 1.8; font-size: 0.9em;">
                    <li><strong style="color: #ffc107;">주의 (1~2점):</strong> 점검주기 단축필요</li>
                    <li><strong style="color: #fd7e14;">경계 (3~4점):</strong> 절연저항 패턴관리 필요</li>
                    <li><strong style="color: #dc3545;">위험 (5점 이상):</strong> 가동중지, 정밀점검 필요</li>
                </ul>
            </div>
        `;
    }

    return html;
}

// 카테고리별 점수 계산 함수
function calculateCategoryScore(category) {
    const checkboxes = document.querySelectorAll(`.checklist-checkbox[data-category="${category}"]:checked`);
    let score = 0;

    checkboxes.forEach(checkbox => {
        score += parseInt(checkbox.dataset.weight);
    });

    return score;
}

// 체크리스트 전체 점수 계산 함수
function calculateChecklistTotalScore() {
    const checkboxes = document.querySelectorAll('.checklist-checkbox:checked');
    let totalScore = 0;

    checkboxes.forEach(checkbox => {
        totalScore += parseInt(checkbox.dataset.weight);
    });

    return totalScore;
}

// 체크리스트 결과 평가 함수
function evaluateChecklistResult(score) {
    if (score === 0) {
        return {
            status: '미평가',
            statusColor: '#6c757d',
            statusBgColor: '#f8f9fa',
            statusBorderColor: '#dee2e6',
            management: '체크리스트를 선택하면 적절한 관리방안이 표시됩니다.',
            managementBorderColor: '#667eea'
        };
    } else if (score >= 1 && score <= 2) {
        return {
            status: '주의',
            statusColor: '#856404',
            statusBgColor: '#fff3cd',
            statusBorderColor: '#ffc107',
            management: '점검주기 단축필요<br><br>• 현재 점검 주기보다 더 짧은 간격으로 절연성능을 모니터링하세요.<br>• 추세를 지속적으로 관찰하여 악화 여부를 확인하세요.',
            managementBorderColor: '#ffc107'
        };
    } else if (score >= 3 && score <= 4) {
        return {
            status: '경계',
            statusColor: '#8b4513',
            statusBgColor: '#ffe5cc',
            statusBorderColor: '#fd7e14',
            management: '절연저항 패턴관리 필요<br><br>• 절연저항 값의 추이를 면밀히 분석하세요.<br>• 패턴 변화를 기록하고 이상 징후를 감지하세요.<br>• 필요시 전문가 검토를 권장합니다.',
            managementBorderColor: '#fd7e14'
        };
    } else { // score >= 5
        return {
            status: '위험',
            statusColor: '#721c24',
            statusBgColor: '#f8d7da',
            statusBorderColor: '#dc3545',
            management: '가동중지, 정밀점검 필요<br><br>• <strong>즉시 설비 가동을 중지</strong>하세요.<br>• 전문가에 의한 정밀 점검을 실시하세요.<br>• 절연 상태를 면밀히 검사하고 필요시 부품을 교체하세요.<br>• 안전이 확인될 때까지 재가동을 금지하세요.',
            managementBorderColor: '#dc3545'
        };
    }
}

// 체크리스트 결과 업데이트 함수 (전체 문서 대상)
function updateChecklistResults() {
    updateChecklistResultsInContext(document);
}

// 특정 컨텍스트 내에서 체크리스트 결과 업데이트
function updateChecklistResultsInContext(context) {
    console.log('updateChecklistResultsInContext 함수 호출, context:', context);

    // 카테고리별 점수 계산 (컨텍스트 내에서)
    const electricScore = calculateCategoryScoreInContext('electric', context);
    const thermalScore = calculateCategoryScoreInContext('thermal', context);
    const sensitivityScore = calculateCategoryScoreInContext('sensitivity', context);

    console.log('점수 계산:', {
        electric: electricScore,
        thermal: thermalScore,
        sensitivity: sensitivityScore
    });

    // 전기적 스트레스 점수 및 결과 업데이트
    const electricElement = context.querySelector('#electric-score');
    if (electricElement) {
        electricElement.textContent = electricScore;
        console.log('electric-score 업데이트:', electricScore);
    }
    const electricResult = evaluateChecklistResult(electricScore);
    updateCategoryResultInContext('electric', electricScore, electricResult, context);

    // 열적 스트레스 점수 및 결과 업데이트
    const thermalElement = context.querySelector('#thermal-score');
    if (thermalElement) {
        thermalElement.textContent = thermalScore;
        console.log('thermal-score 업데이트:', thermalScore);
    }
    const thermalResult = evaluateChecklistResult(thermalScore);
    updateCategoryResultInContext('thermal', thermalScore, thermalResult, context);

    // 발열민감도 점수 및 결과 업데이트
    const sensitivityElement = context.querySelector('#sensitivity-score');
    if (sensitivityElement) {
        sensitivityElement.textContent = sensitivityScore;
        console.log('sensitivity-score 업데이트:', sensitivityScore);
    }
    const sensitivityResult = evaluateChecklistResult(sensitivityScore);
    updateCategoryResultInContext('sensitivity', sensitivityScore, sensitivityResult, context);
}

// 특정 컨텍스트 내에서 카테고리별 점수 계산
function calculateCategoryScoreInContext(category, context) {
    const checkboxes = context.querySelectorAll(`.checklist-checkbox[data-category="${category}"]:checked`);
    let score = 0;
    checkboxes.forEach(checkbox => {
        score += parseInt(checkbox.dataset.weight);
    });
    return score;
}

// 카테고리별 결과 업데이트 함수 (전체 문서 대상)
function updateCategoryResult(category, score, result) {
    updateCategoryResultInContext(category, score, result, document);
}

// 특정 컨텍스트 내에서 카테고리별 결과 업데이트
function updateCategoryResultInContext(category, score, result, context) {
    const statusElement = context.querySelector(`#${category}-status-result`);
    const managementElement = context.querySelector(`#${category}-management-detail`);
    const managementContainer = context.querySelector(`#${category}-management-result`);

    console.log(`${category} 카테고리 업데이트:`, {
        score,
        status: result.status,
        statusElement: !!statusElement,
        managementElement: !!managementElement,
        managementContainer: !!managementContainer
    });

    if (statusElement) {
        statusElement.textContent = result.status;
        statusElement.style.color = result.statusColor;
        statusElement.style.backgroundColor = result.statusBgColor;
        statusElement.style.borderColor = result.statusBorderColor;
    } else {
        console.warn(`${category}-status-result 요소를 찾을 수 없습니다.`);
    }

    if (managementElement) {
        managementElement.innerHTML = result.management;
    } else {
        console.warn(`${category}-management-detail 요소를 찾을 수 없습니다.`);
    }

    if (managementContainer) {
        managementContainer.style.borderLeftColor = result.managementBorderColor;
    } else {
        console.warn(`${category}-management-result 요소를 찾을 수 없습니다.`);
    }
}

// 점수에 따른 색상 결정 함수
function getScoreColor(score) {
    if (score === 0) return '#667eea';
    if (score >= 1 && score <= 2) return '#ffc107';
    if (score >= 3 && score <= 4) return '#fd7e14';
    return '#dc3545'; // 5점 이상
}

// 체크리스트 표시
function displayChecklist(riskI, riskT, riskR) {
    const checklistSection = document.getElementById('checklist-section');
    const html = generateChecklistHTML(riskI, riskT, riskR);
    checklistSection.innerHTML = html;

    // 체크박스 이벤트 리스너 추가
    const checkboxes = document.querySelectorAll('.checklist-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateChecklistResults);
    });
}

// ==================== 데이터 입력 관리 ====================
// (테이블 방식은 제거되고 단일 입력과 파일 업로드로 대체됨)

// ==================== 파일 업로드 ====================

// Excel/CSV 파일 읽기 함수
function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                // 첫 번째 시트 읽기
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // JSON으로 변환 (헤더 없이 배열 형태로)
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

                resolve(jsonData);
            } catch (error) {
                reject(new Error('Excel 파일을 읽는 중 오류가 발생했습니다: ' + error.message));
            }
        };

        reader.onerror = function() {
            reject(new Error('파일을 읽는 중 오류가 발생했습니다.'));
        };

        reader.readAsArrayBuffer(file);
    });
}

// CSV 파일 읽기 함수
function readCSVFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function(e) {
            try {
                const text = e.target.result;
                const lines = text.split('\n').filter(line => line.trim() !== '');
                const jsonData = lines.map(line => {
                    // 쉼표로 분리하고 공백 제거
                    return line.split(',').map(part => part.trim());
                });

                resolve(jsonData);
            } catch (error) {
                reject(new Error('CSV 파일을 읽는 중 오류가 발생했습니다: ' + error.message));
            }
        };

        reader.onerror = function() {
            reject(new Error('파일을 읽는 중 오류가 발생했습니다.'));
        };

        reader.readAsText(file, 'UTF-8');
    });
}

// 파일 데이터를 파싱하여 데이터 배열로 반환하는 함수
function parseFileData(jsonData) {
    // 첫 행이 헤더인지 확인 (숫자가 아니거나 '연도', 'Year' 등의 키워드가 포함된 경우)
    const firstRow = jsonData[0] || [];
    const isHeader = firstRow.length > 0 && (
        isNaN(firstRow[0]) || 
        firstRow[0] === '연도' || 
        firstRow[0] === 'Year' ||
        firstRow[0].toString().toLowerCase().includes('year') ||
        firstRow[0].toString().toLowerCase().includes('연도')
    );
    
    const startRow = isHeader ? 1 : 0;
    const data = [];

    for (let i = startRow; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (row && row.length >= 3) {
            const year = row[0] ? row[0].toString().trim() : '';
            const month = row[1] ? row[1].toString().trim() : '';
            const resistance = row[2] ? row[2].toString().trim() : '';

            // 유효한 데이터인지 확인
            if (year && month && resistance && !isNaN(year) && !isNaN(month) && !isNaN(resistance)) {
                const paddedMonth = month.padStart(2, '0');
                data.push({
                    date: `${year}-${paddedMonth}`,
                    resistance: parseFloat(resistance)
                });
            }
        }
    }

    // 날짜순 정렬
    data.sort((a, b) => {
        const dateA = new Date(a.date + '-01');
        const dateB = new Date(b.date + '-01');
        return dateA - dateB;
    });

    return data;
}

// 파일 업로드 버튼 클릭 이벤트 (다량 데이터 - 바로 계산)
document.getElementById('upload-file').addEventListener('click', async () => {
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];

    if (!file) {
        alert('파일을 선택해주세요.');
        return;
    }

    try {
        let jsonData;

        // 파일 확장자에 따라 다른 방식으로 읽기
        if (file.name.endsWith('.csv')) {
            jsonData = await readCSVFile(file);
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            jsonData = await readExcelFile(file);
        } else {
            alert('지원하지 않는 파일 형식입니다.\nExcel(.xlsx, .xls) 또는 CSV 파일을 선택해주세요.');
            return;
        }

        // 데이터 파싱
        const parsedData = parseFileData(jsonData);

        if (parsedData.length === 0) {
            alert('파일에서 유효한 데이터를 찾을 수 없습니다.\n형식: 연도, 월, 절연저항(MΩ)\n첫 번째 열: 연도, 두 번째 열: 월, 세 번째 열: 절연저항');
            return;
        }

        // 바로 분석 및 저장
        processDegradationData(parsedData);

    } catch (error) {
        alert(error.message);
        console.error('파일 읽기 오류:', error);
    }
});

// 단일 데이터 추가 버튼 클릭 이벤트
document.getElementById('add-single-data').addEventListener('click', () => {
    const year = document.getElementById('single-year-input').value.trim();
    const month = document.getElementById('single-month-input').value.trim();
    const resistance = document.getElementById('single-resistance-input').value.trim();

    if (!year || !month || !resistance) {
        alert('연도, 월, 절연저항을 모두 입력해주세요.');
        return;
    }

    if (isNaN(year) || isNaN(month) || isNaN(resistance)) {
        alert('올바른 숫자를 입력해주세요.');
        return;
    }

    const paddedMonth = month.padStart(2, '0');
    const newData = {
        date: `${year}-${paddedMonth}`,
        resistance: parseFloat(resistance)
    };

    // 선택된 기록들의 데이터 가져오기
    const selectedData = getSelectedRecordsData();
    
    // 선택된 기록이 있으면 합쳐서 처리, 없으면 단일 데이터만 처리
    let dataToProcess;
    if (selectedData.length > 0) {
        // 선택된 데이터와 새 데이터 합치기
        const combinedData = [...selectedData, newData];
        
        // 날짜순 정렬 및 중복 제거 (같은 날짜가 있으면 새 데이터 사용)
        const dataMap = new Map();
        combinedData.forEach(item => {
            dataMap.set(item.date, item);
        });
        
        dataToProcess = Array.from(dataMap.values()).sort((a, b) => {
            const dateA = new Date(a.date + '-01');
            const dateB = new Date(b.date + '-01');
            return dateA - dateB;
        });
    } else {
        // 선택된 기록이 없으면 단일 데이터만
        dataToProcess = [newData];
    }

    // 분석 및 저장
    processDegradationData(dataToProcess);

    // 입력 필드 초기화
    document.getElementById('single-year-input').value = '';
    document.getElementById('single-month-input').value = '';
    document.getElementById('single-resistance-input').value = '';
});

// 절연저항 데이터 처리 함수 (분석 및 저장)
function processDegradationData(parsedData) {
    if (parsedData.length === 0) {
        alert('데이터를 입력해주세요.\n최소 1개 이상의 데이터가 필요합니다.');
        return;
    }

    // 패턴 분석
    const analysis = analyzeInsulationPattern(parsedData);

    // 결과 표시
    displayDegradationResults(analysis, parsedData);

    // 자동으로 기록 저장
    const record = {
        id: Date.now(),
        type: 'degradation',
        date: new Date().toISOString(),
        inputs: {
            data: parsedData
        },
        results: {
            pattern: analysis.pattern,
            stage: analysis.stage,
            management: analysis.management,
            characteristics: analysis.characteristics,
            decreaseRate: analysis.decreaseRate,
            volatility: analysis.volatility,
            belowThreshold: analysis.belowThreshold
        }
    };

    saveRecord(record);
    // 기록 목록 새로고침
    loadHistory('degradation');
}

// ==================== 절연저항 열화 패턴 분류 ====================
// (calculate-degradation 버튼은 제거되었고, 파일 업로드와 단일 입력에서 바로 처리)

// 데이터 파싱 함수
function parseInsulationData(dataString) {
    const lines = dataString.split('\n').filter(line => line.trim() !== '');
    const data = [];

    for (const line of lines) {
        const parts = line.split(',').map(part => part.trim());
        if (parts.length === 2) {
            const date = parts[0];
            const resistance = parseFloat(parts[1]);

            if (date && !isNaN(resistance)) {
                data.push({ date, resistance });
            }
        }
    }

    // 날짜순 정렬
    data.sort((a, b) => {
        const dateA = new Date(a.date + '-01');
        const dateB = new Date(b.date + '-01');
        return dateA - dateB;
    });

    return data;
}

// 절연저항 패턴 분석 함수
function analyzeInsulationPattern(data) {
    if (data.length === 0) {
        return null;
    }

    const firstValue = data[0].resistance;
    const lastValue = data[data.length - 1].resistance;
    const minValue = Math.min(...data.map(d => d.resistance));
    const maxValue = Math.max(...data.map(d => d.resistance));

    // 전체 감소율 계산
    const totalDecreaseRate = ((firstValue - lastValue) / firstValue) * 100;

    // 변동성 계산 (표준편차)
    const mean = data.reduce((sum, d) => sum + d.resistance, 0) / data.length;
    const variance = data.reduce((sum, d) => sum + Math.pow(d.resistance - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);
    const volatility = (stdDev / mean) * 100; // 변동계수 (%)

    // 임계치 도달 여부
    const belowThreshold = lastValue < 1.0;
    const below100 = lastValue < 100;
    const above1000 = lastValue >= 1000;
    const above300 = lastValue >= 300;

    // 일시적 저하 감지 (국부형)
    let temporaryDrops = 0;
    for (let i = 1; i < data.length - 1; i++) {
        const prevResistance = data[i - 1].resistance;
        const currResistance = data[i].resistance;
        const nextResistance = data[i + 1].resistance;

        // 일시적 저하: 이전보다 떨어졌다가 다시 회복
        const drop = ((prevResistance - currResistance) / prevResistance) * 100;
        const recovery = ((nextResistance - currResistance) / currResistance) * 100;

        if (drop > 0 && drop < 10 && recovery > 0) {
            temporaryDrops++;
        }
    }

    // 패턴 분류 로직
    let pattern, stage, management, characteristics;

    // ① 임계형 (Critical)
    // 조건: 급격한 저하 (전체 기울기 90% 이상), 임계치 초과 (1.0 MΩ 이하)
    if (belowThreshold || totalDecreaseRate >= 90) {
        pattern = '임계형 (Critical)';
        stage = 'Failure (임계열화)';
        management = '운전중지, 정밀점검, 배선 교체';
        characteristics = '급격한 저하 (전체 기간 중 90% 이상 감소), 절연저항이 임계치(1 MΩ) 이하';
    }
    // ② 가속형 (Accelerated)
    else if (below100 && totalDecreaseRate >= 70) {
        pattern = '가속형 (Accelerated)';
        stage = 'Propagation (진전열화)';
        management = '점검주기 단축 (분기점검)';
        characteristics = '100 MΩ 미만 도달, 급격한 저하 (전체 기간의 70% 이상 감소)';
    }
    // ③ 완만형 (Gradual)
    else if (totalDecreaseRate >= 10 && totalDecreaseRate <= 20 && temporaryDrops === 0) {
        pattern = '완만형 (Gradual)';
        stage = 'Initiation (초기열화)';
        management = '경년추이 감시 (반기점검)';
        characteristics = '10~20% 수준의 완만한 저하, 특이점 없음';
    }
    // ④ 국부형 (Localised)
    else if (above300 && temporaryDrops >= 2) {
        pattern = '국부형 (Localised)';
        stage = 'Anomaly (이상열화)';
        management = '경년추이 감시, 300MΩ 미만 시 단축점검 (분기)';
        characteristics = `전체 수치는 양호하나 일시적 저하 반복 (${temporaryDrops}회, 각 저하 폭 10% 미만)`;
    }
    // ⑤ 안정형 (Stable)
    else if (above1000 && volatility <= 1.0) {
        pattern = '안정형 (Stable)';
        stage = 'Healthy (건전상태)';
        management = '정기 절연 확인 (연 1회)';
        characteristics = '1000 MΩ 이상, 변동폭 ±1% 이내';
    }
    // 기타 (완만형으로 분류)
    else {
        pattern = '완만형 (Gradual)';
        stage = 'Initiation (초기열화)';
        management = '경년추이 감시 (반기점검)';
        characteristics = '완만한 저하 또는 안정 상태';
    }

    return {
        pattern,
        stage,
        management,
        characteristics,
        decreaseRate: totalDecreaseRate,
        volatility,
        belowThreshold,
        firstValue,
        lastValue,
        minValue,
        maxValue,
        temporaryDrops
    };
}

// 절연저항 열화 패턴 분류 결과 표시
function displayDegradationResults(analysis, data) {
    const resultContent = document.getElementById('degradation-result-content');

    // 패턴별 클래스 설정
    let patternClass = 'pattern-gradual';
    if (analysis.pattern.includes('임계형')) patternClass = 'pattern-critical';
    else if (analysis.pattern.includes('가속형')) patternClass = 'pattern-accelerated';
    else if (analysis.pattern.includes('국부형')) patternClass = 'pattern-localized';
    else if (analysis.pattern.includes('안정형')) patternClass = 'pattern-stable';

    resultContent.innerHTML = `
        <div class="result-item">
            <h4>📊 패턴특성</h4>
            <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 8px;"><strong>전체 감소폭</strong></td>
                    <td style="padding: 8px;">${analysis.decreaseRate.toFixed(2)}%</td>
                </tr>
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 8px;"><strong>변동성 (변동계수)</strong></td>
                    <td style="padding: 8px;">${analysis.volatility.toFixed(2)}%</td>
                </tr>
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 8px;"><strong>임계치 도달 여부</strong></td>
                    <td style="padding: 8px;">${analysis.belowThreshold ? '예 (1 MΩ 이하)' : '아니오'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 8px;"><strong>초기값</strong></td>
                    <td style="padding: 8px;">${analysis.firstValue.toFixed(2)} MΩ</td>
                </tr>
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 8px;"><strong>최종값</strong></td>
                    <td style="padding: 8px;">${analysis.lastValue.toFixed(2)} MΩ</td>
                </tr>
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 8px;"><strong>최소값</strong></td>
                    <td style="padding: 8px;">${analysis.minValue.toFixed(2)} MΩ</td>
                </tr>
                <tr>
                    <td style="padding: 8px;"><strong>최대값</strong></td>
                    <td style="padding: 8px;">${analysis.maxValue.toFixed(2)} MΩ</td>
                </tr>
            </table>
        </div>

        <div class="result-item">
            <h4>🏷️ 열화유형</h4>
            <p><span class="pattern-type ${patternClass}" style="font-size: 1.2em; padding: 8px 16px;">${analysis.pattern}</span></p>
            <p style="margin-top: 10px;"><strong>특성:</strong> ${analysis.characteristics}</p>
        </div>

        <div class="result-item">
            <h4>📈 열화단계 (Heat Stage)</h4>
            <p style="font-size: 1.1em; color: #2c3e50;"><strong>${analysis.stage}</strong></p>
        </div>

        <div class="result-item">
            <h4>🔧 관리방향 (Management Action)</h4>
            <p style="font-size: 1.1em; color: #e74c3c;"><strong>${analysis.management}</strong></p>
        </div>
    `;

    document.getElementById('degradation-results').style.display = 'block';

    // 그래프 업데이트
    updateDegradationChartWithData(data);
}

// ==================== 기록 저장/조회 기능 ====================

// LocalStorage 키
const STORAGE_KEY_PERFORMANCE = 'insulation_performance_history';
const STORAGE_KEY_DEGRADATION = 'insulation_degradation_history';

// 저장 버튼은 제거되었고, 계산 시 자동으로 저장됩니다.

// 기록 저장 함수
function saveRecord(record) {
    const key = record.type === 'performance' ? STORAGE_KEY_PERFORMANCE : STORAGE_KEY_DEGRADATION;
    const history = getHistory(record.type);
    history.unshift(record); // 최신 기록을 맨 앞에 추가
    
    // 최대 100개까지만 저장
    if (history.length > 100) {
        history.pop();
    }
    
    localStorage.setItem(key, JSON.stringify(history));
}

// 기록 조회 함수
function getHistory(type) {
    const key = type === 'performance' ? STORAGE_KEY_PERFORMANCE : STORAGE_KEY_DEGRADATION;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
}

// 전체 기록 조회
function getAllHistory() {
    const performance = getHistory('performance');
    const degradation = getHistory('degradation');
    return [...performance, ...degradation].sort((a, b) => new Date(b.date) - new Date(a.date));
}

// 기록 목록 표시
function loadHistory(filter = 'all') {
    let historyList, history = [];
    
    if (filter === 'performance') {
        historyList = document.getElementById('performance-history-list');
        history = getHistory('performance');
    } else if (filter === 'degradation') {
        historyList = document.getElementById('degradation-history-list');
        history = getHistory('degradation');
    } else {
        // 'all'인 경우는 더 이상 사용하지 않지만 호환성을 위해 유지
        historyList = document.getElementById('history-list');
        if (!historyList) return; // history-list가 없으면 종료
        history = getAllHistory();
    }
    
    if (!historyList) return;
    
    if (history.length === 0) {
        historyList.innerHTML = `
            <div class="history-empty">
                <div class="history-empty-icon">📋</div>
                <p>저장된 기록이 없습니다.</p>
            </div>
        `;
        // 그래프도 초기화
        if (filter === 'performance') {
            updatePerformanceChart([]);
        } else if (filter === 'degradation') {
            updateDegradationChart([]);
        }
        return;
    }
    
    historyList.innerHTML = history.map(record => {
        const date = new Date(record.date);
        const dateStr = date.toLocaleString('ko-KR');
        
        if (record.type === 'performance') {
            const { current, temperature } = record.inputs;
            const { riskI, riskT, riskR } = record.results;
            return `
                <div class="history-item" data-id="${record.id}" data-type="${record.type}">
                    <div class="history-item-header">
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <input type="checkbox" class="history-checkbox-performance" data-id="${record.id}" style="width: 20px; height: 20px; cursor: pointer;">
                            <span class="history-item-type">절연성능 경향평가</span>
                        </label>
                        <span class="history-item-date">${dateStr}</span>
                    </div>
                    <div class="history-item-summary">
                        <p><strong>입력:</strong> I<sub>max</sub> ${current.toFixed(2)} A, T<sub>max</sub> ${temperature.toFixed(2)} ℃</p>
                        <p><strong>위험도:</strong> 전기적 스트레스 ${riskI.level}(${riskI.name}), 열적 스트레스 ${riskT.level}(${riskT.name}), 민감도 ${riskR.level}(${riskR.name})</p>
                    </div>
                    <div class="history-item-actions">
                        <button class="btn-view" onclick="viewHistoryDetail(${record.id}, '${record.type}')">상세보기</button>
                        <button class="btn-delete" onclick="deleteHistory(${record.id}, '${record.type}')">삭제</button>
                    </div>
                </div>
            `;
        } else {
            const { data } = record.inputs;
            const { pattern, stage, decreaseRate } = record.results;

            // 데이터 요약
            const dataCount = data ? data.length : 0;
            const firstValue = data && data.length > 0 ? data[0].resistance : 0;
            const lastValue = data && data.length > 0 ? data[data.length - 1].resistance : 0;

            return `
                <div class="history-item" data-id="${record.id}" data-type="${record.type}">
                    <div class="history-item-header">
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <input type="checkbox" class="history-checkbox" data-id="${record.id}" style="width: 20px; height: 20px; cursor: pointer;">
                            <span class="history-item-type degradation">절연저항 평가</span>
                        </label>
                        <span class="history-item-date">${dateStr}</span>
                    </div>
                    <div class="history-item-summary">
                        <p><strong>데이터 수:</strong> ${dataCount}개 측정</p>
                        <p><strong>절연저항 범위:</strong> ${firstValue.toFixed(2)} MΩ → ${lastValue.toFixed(2)} MΩ</p>
                        <p><strong>패턴:</strong> ${pattern} - ${stage}</p>
                        <p><strong>감소율:</strong> ${decreaseRate !== null && decreaseRate !== undefined ? decreaseRate.toFixed(2) + '%' : 'N/A'}</p>
                    </div>
                    <div class="history-item-actions">
                        <button class="btn-view" onclick="viewHistoryDetail(${record.id}, '${record.type}')">상세보기</button>
                        <button class="btn-delete" onclick="deleteHistory(${record.id}, '${record.type}')">삭제</button>
                    </div>
                </div>
            `;
        }
    }).join('');
    
    // degradation 모드인 경우 체크박스 이벤트 리스너 추가
    if (filter === 'degradation') {
        // 체크박스에 이벤트 리스너 추가
        const checkboxes = historyList.querySelectorAll('.history-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', updateSelectedChart);
        });
    }
    
    // performance 모드인 경우 체크박스 이벤트 리스너 추가
    if (filter === 'performance') {
        // 체크박스에 이벤트 리스너 추가
        const checkboxes = historyList.querySelectorAll('.history-checkbox-performance');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', updateSelectedPerformanceChart);
        });
    }
    
    // 그래프 업데이트
    if (filter === 'performance') {
        // performance 모드는 체크박스 선택에 따라 그래프가 업데이트되므로 여기서는 업데이트하지 않음
        // updatePerformanceChart(history);
    } else if (filter === 'degradation') {
        // degradation 모드는 체크박스 선택에 따라 그래프가 업데이트되므로 여기서는 업데이트하지 않음
        // updateDegradationChart(history);
    }
}

// 기록 상세보기
function viewHistoryDetail(id, type) {
    const history = type === 'performance' ? getHistory('performance') : getHistory('degradation');
    const record = history.find(r => r.id === id);
    
    if (!record) {
        alert('기록을 찾을 수 없습니다.');
        return;
    }
    
    const date = new Date(record.date);
    const dateStr = date.toLocaleString('ko-KR');
    
    let detailHTML = `
        <div class="history-detail">
            <h4>기록 상세 정보</h4>
            <div class="history-detail-item">
                <div class="history-detail-label">평가 유형</div>
                <div class="history-detail-value">${type === 'performance' ? '절연성능 평가' : '절연저항 열화 패턴 분류'}</div>
            </div>
            <div class="history-detail-item">
                <div class="history-detail-label">평가 일시</div>
                <div class="history-detail-value">${dateStr}</div>
            </div>
    `;
    
    if (type === 'performance') {
        const { current, temperature, timeSeriesData } = record.inputs;
        const { deltaI, deltaT, sensitivity, iCritic, riskI, riskT, riskR } = record.results;

        // 체크리스트 HTML 생성
        const checklistHTML = generateChecklistHTML(riskI, riskT, riskR);

        // 시계열 데이터 테이블 생성
        let timeSeriesTable = '';
        if (timeSeriesData && timeSeriesData.length > 0) {
            const lastIndex = timeSeriesData.length - 1;
            timeSeriesTable = '<table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.9em;">';
            timeSeriesTable += '<thead><tr style="background: #f8f9fa;"><th style="border: 1px solid #ddd; padding: 8px;">시간(분)</th><th style="border: 1px solid #ddd; padding: 8px;">전류(A)</th><th style="border: 1px solid #ddd; padding: 8px;">온도(℃)</th><th style="border: 1px solid #ddd; padding: 8px;">비고</th></tr></thead>';
            timeSeriesTable += '<tbody>';
            timeSeriesData.forEach((data, index) => {
                const isLast = index === lastIndex;
                timeSeriesTable += `<tr style="${isLast ? 'background: #e7f5e7; font-weight: bold;' : ''}">
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${data.time}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center; ${isLast ? 'color: #28a745;' : ''}">${data.current.toFixed(2)}${isLast ? ' 🔵' : ''}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center; ${isLast ? 'color: #28a745;' : ''}">${data.temperature.toFixed(2)}${isLast ? ' 🔵' : ''}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-size: 0.85em; color: #666;">${isLast ? 'I_max, T_max로 사용' : ''}</td>
                </tr>`;
            });
            timeSeriesTable += '</tbody></table>';
        }

        detailHTML += `
            <div class="history-detail-item">
                <div class="history-detail-label">입력값 (마지막 측정값)</div>
                <div class="history-detail-value">I<sub>max</sub>: ${current.toFixed(2)} A, T<sub>max</sub>: ${temperature.toFixed(2)} ℃</div>
            </div>`;

        // 시계열 데이터가 있으면 표시
        if (timeSeriesTable) {
            detailHTML += `
            <div class="history-detail-item">
                <div class="history-detail-label">시계열 측정 데이터</div>
                <div class="history-detail-value">
                    ${timeSeriesTable}
                    <p style="margin-top: 10px; font-size: 0.9em; color: #666;">
                        <strong>민감도 계산:</strong> ${timeSeriesData && timeSeriesData.length >= 2 ? '마지막 2개 측정값 사용 (R = (T_n2 - T_n1) / (I_n2 - I_n1))' : '이전 측정값 없음'}
                    </p>
                </div>
            </div>`;
        }

        detailHTML += `
            <div class="history-detail-item">
                <div class="history-detail-label">계산 결과</div>
                <div class="history-detail-value">
                    <p>I<sub>critic</sub>: ${iCritic.toFixed(2)} A</p>
                    <p>전기적 스트레스 (S<sub>I</sub> = I<sub>max</sub> / I<sub>critic</sub>): ${deltaI.toFixed(3)} - ${riskI.level} (${riskI.name})</p>
                    <p>열적 스트레스 (S<sub>T</sub> = T<sub>max</sub> / T<sub>critic</sub>): ${deltaT.toFixed(3)} - ${riskT.level} (${riskT.name})</p>
                    <p>온도반응 민감도 (R = (T<sub>n2</sub> - T<sub>n1</sub>) / (I<sub>n2</sub> - I<sub>n1</sub>)): ${sensitivity === null ? '-' : sensitivity.toFixed(3) + ' ℃/A'} - ${riskR.level} (${riskR.name})</p>
                </div>
            </div>
            <div class="history-detail-item">
                <div class="history-detail-label">체크리스트</div>
                <div class="history-detail-value">
                    ${checklistHTML}
                </div>
            </div>
        `;
    } else {
        const { data } = record.inputs;
        const { pattern, stage, management, characteristics, decreaseRate, volatility, belowThreshold } = record.results;

        // 데이터 테이블 생성
        let dataTable = '<table style="width: 100%; border-collapse: collapse; margin-top: 10px;">';
        dataTable += '<thead><tr><th style="border: 1px solid #ddd; padding: 8px;">연도+월</th><th style="border: 1px solid #ddd; padding: 8px;">절연저항 (MΩ)</th></tr></thead>';
        dataTable += '<tbody>';
        if (data && data.length > 0) {
            data.forEach(d => {
                dataTable += `<tr><td style="border: 1px solid #ddd; padding: 8px;">${d.date}</td><td style="border: 1px solid #ddd; padding: 8px;">${d.resistance.toFixed(2)}</td></tr>`;
            });
        }
        dataTable += '</tbody></table>';

        detailHTML += `
            <div class="history-detail-item">
                <div class="history-detail-label">입력 데이터</div>
                <div class="history-detail-value">
                    ${dataTable}
                </div>
            </div>
            <div class="history-detail-item">
                <div class="history-detail-label">분석 결과</div>
                <div class="history-detail-value">
                    <p><strong>전체 감소폭:</strong> ${decreaseRate !== null && decreaseRate !== undefined ? decreaseRate.toFixed(2) + '%' : 'N/A'}</p>
                    <p><strong>변동성:</strong> ${volatility !== null && volatility !== undefined ? volatility.toFixed(2) + '%' : 'N/A'}</p>
                    <p><strong>임계치 도달:</strong> ${belowThreshold ? '예 (1 MΩ 이하)' : '아니오'}</p>
                </div>
            </div>
            <div class="history-detail-item">
                <div class="history-detail-label">분류 결과</div>
                <div class="history-detail-value">
                    <p><strong>패턴:</strong> ${pattern}</p>
                    <p><strong>특성:</strong> ${characteristics}</p>
                    <p><strong>열화 단계:</strong> ${stage}</p>
                    <p><strong>관리 방향:</strong> ${management}</p>
                </div>
            </div>
        `;
    }
    
    detailHTML += `
            <div style="margin-top: 20px;">
                <button class="btn-view" onclick="closeHistoryDetail()">닫기</button>
            </div>
        </div>
    `;
    
    // 기존 상세보기 제거
    const existingDetail = document.querySelector('.history-detail');
    if (existingDetail) {
        existingDetail.remove();
    }
    
    // 새 상세보기 추가 (각 모드에 맞는 기록 목록에 추가)
    let historyList;
    if (type === 'performance') {
        historyList = document.getElementById('performance-history-list');
    } else {
        historyList = document.getElementById('degradation-history-list');
    }
    
    if (historyList) {
        historyList.insertAdjacentHTML('afterbegin', detailHTML);

        // 상세보기에서 체크박스 이벤트 리스너 추가 (performance 타입인 경우)
        if (type === 'performance') {
            setTimeout(() => {
                const detailElement = document.querySelector('.history-detail');
                if (detailElement) {
                    const checkboxes = detailElement.querySelectorAll('.checklist-checkbox');
                    console.log('상세보기 체크박스 개수:', checkboxes.length);
                    checkboxes.forEach(checkbox => {
                        checkbox.addEventListener('change', () => {
                            // 상세보기 내부에서만 점수 업데이트
                            updateChecklistResultsInContext(detailElement);
                        });
                    });
                    // 초기 상태 업데이트
                    updateChecklistResultsInContext(detailElement);
                }
            }, 100);
        }

        // 스크롤을 맨 위로
        historyList.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// 상세보기 닫기
function closeHistoryDetail() {
    const detail = document.querySelector('.history-detail');
    if (detail) {
        detail.remove();
    }
}

// 기록 삭제
function deleteHistory(id, type) {
    if (!confirm('이 기록을 삭제하시겠습니까?')) {
        return;
    }
    
    const key = type === 'performance' ? STORAGE_KEY_PERFORMANCE : STORAGE_KEY_DEGRADATION;
    const history = getHistory(type);
    const filtered = history.filter(r => r.id !== id);
    localStorage.setItem(key, JSON.stringify(filtered));
    
    // 해당 모드의 목록 새로고침
    loadHistory(type);
    
    // 상세보기 제거
    closeHistoryDetail();
}

// 절연성능 평가 기록 전체 삭제
document.getElementById('clear-performance-history').addEventListener('click', () => {
    if (!confirm('절연성능 평가 기록을 모두 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        return;
    }
    
    localStorage.removeItem(STORAGE_KEY_PERFORMANCE);
    loadHistory('performance');
    alert('절연성능 평가 기록이 모두 삭제되었습니다.');
});

// 절연저항 열화 패턴 분류 기록 전체 삭제
document.getElementById('clear-degradation-history').addEventListener('click', () => {
    if (!confirm('절연저항 열화 패턴 분류 기록을 모두 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        return;
    }
    
    localStorage.removeItem(STORAGE_KEY_DEGRADATION);
    loadHistory('degradation');
    alert('절연저항 열화 패턴 분류 기록이 모두 삭제되었습니다.');
});

// 전역 함수로 등록 (onclick에서 사용하기 위해)
window.viewHistoryDetail = viewHistoryDetail;
window.deleteHistory = deleteHistory;
window.closeHistoryDetail = closeHistoryDetail;

// 그래프 변수
let performanceChart = null;
let degradationChart = null;

// 선택된 기록들의 데이터 가져오기 (절연성능 평가용)
function getSelectedPerformanceRecordsData() {
    const checkboxes = document.querySelectorAll('.history-checkbox-performance:checked');
    
    if (checkboxes.length === 0) {
        return [];
    }

    // 선택된 기록들의 ID 수집
    const selectedIds = Array.from(checkboxes).map(cb => parseInt(cb.dataset.id));
    
    // 기록 가져오기
    const history = getHistory('performance');
    
    // 선택된 기록들의 데이터 수집
    const selectedData = [];
    selectedIds.forEach(id => {
        const record = history.find(r => r.id === id);
        if (record && record.inputs) {
            selectedData.push({
                current: record.inputs.current,
                temperature: record.inputs.temperature
            });
        }
    });

    return selectedData;
}

// 선택된 기록들의 그래프 합치기 (절연성능 평가용)
function updateSelectedPerformanceChart() {
    const selectedData = getSelectedPerformanceRecordsData();
    
    if (selectedData.length === 0) {
        // 선택된 것이 없으면 그래프 초기화
        const ctx = document.getElementById('performance-chart');
        if (ctx && performanceChart) {
            performanceChart.destroy();
            performanceChart = null;
            const canvas = ctx.getContext('2d');
            canvas.clearRect(0, 0, ctx.width, ctx.height);
        }
        return;
    }

    // 합쳐진 데이터로 그래프 업데이트
    updatePerformanceChartWithData(selectedData);
}

// 절연성능 평가 그래프 업데이트 (데이터 배열용)
function updatePerformanceChartWithData(data) {
    const ctx = document.getElementById('performance-chart');
    if (!ctx) return;
    
    // 기존 차트가 있으면 제거
    if (performanceChart) {
        performanceChart.destroy();
    }
    
    if (data.length === 0) {
        const canvas = ctx.getContext('2d');
        canvas.clearRect(0, 0, ctx.width, ctx.height);
        return;
    }
    
    // 전류-온도 관계 데이터 준비 (산점도)
    const scatterData = data.map(item => ({
        x: item.current,
        y: item.temperature
    }));
    
    // 전류 순으로 정렬 (선 그래프를 위해)
    scatterData.sort((a, b) => a.x - b.x);
    
    performanceChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: '전류-온도 응답수준',
                data: scatterData,
                borderColor: 'rgb(102, 126, 234)',
                backgroundColor: 'rgba(102, 126, 234, 0.5)',
                pointRadius: 6,
                pointHoverRadius: 8,
                pointStyle: 'circle',
                showLine: true,
                tension: 0.4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'point',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                title: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `전류: ${context.parsed.x.toFixed(2)} A, 온도: ${context.parsed.y.toFixed(2)} ℃`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    display: true,
                    title: {
                        display: true,
                        text: 'Current (A)'
                    },
                    position: 'bottom'
                },
                y: {
                    type: 'linear',
                    display: true,
                    title: {
                        display: true,
                        text: 'Temperature (℃)'
                    }
                }
            }
        }
    });
}

// 절연저항 열화 패턴 분류 그래프 업데이트 (현재 입력 데이터용)
function updateDegradationChartWithData(data) {
    const ctx = document.getElementById('degradation-chart');
    if (!ctx) return;

    // 기존 차트가 있으면 제거
    if (degradationChart) {
        degradationChart.destroy();
    }

    if (data.length === 0) {
        const canvas = ctx.getContext('2d');
        canvas.clearRect(0, 0, ctx.width, ctx.height);
        return;
    }

    const labels = data.map(d => d.date);
    const resistanceData = data.map(d => d.resistance);

    // 데이터의 최댓값 계산
    const maxResistance = Math.max(...resistanceData);
    // y축 최댓값: 데이터 최댓값 + 300을 100 단위로 반올림
    const yAxisMax = Math.round((maxResistance + 300) / 100) * 100;

    degradationChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '절연저항 (MΩ)',
                data: resistanceData,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.1)',
                pointRadius: 6,
                pointHoverRadius: 8,
                pointStyle: 'circle',
                showLine: true,
                tension: 0.4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                title: {
                    display: false,
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `절연저항: ${context.parsed.y.toFixed(2)} MΩ`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: '연도+월 (YYYY-MM)'
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: '절연저항 (MΩ)'
                    },
                    min: 0,
                    max: yAxisMax,
                    beginAtZero: true
                }
            }
        }
    });
}

// 절연저항 열화 패턴 분류 그래프 업데이트 (기록용)
function updateDegradationChart(history) {
    const ctx = document.getElementById('degradation-chart');
    if (!ctx) return;

    // 기존 차트가 있으면 제거
    if (degradationChart) {
        degradationChart.destroy();
    }

    if (history.length === 0) {
        const canvas = ctx.getContext('2d');
        canvas.clearRect(0, 0, ctx.width, ctx.height);
        return;
    }

    // 가장 최근 기록 사용
    const latestRecord = history[0];
    if (latestRecord.inputs.data) {
        updateDegradationChartWithData(latestRecord.inputs.data);
    }
}

// 선택된 기록들의 데이터 가져오기
function getSelectedRecordsData() {
    const checkboxes = document.querySelectorAll('.history-checkbox:checked');
    
    if (checkboxes.length === 0) {
        return [];
    }

    // 선택된 기록들의 ID 수집
    const selectedIds = Array.from(checkboxes).map(cb => parseInt(cb.dataset.id));
    
    // 기록 가져오기
    const history = getHistory('degradation');
    
    // 선택된 기록들의 데이터 합치기
    const mergedData = [];
    selectedIds.forEach(id => {
        const record = history.find(r => r.id === id);
        if (record && record.inputs && record.inputs.data) {
            record.inputs.data.forEach(item => {
                mergedData.push({
                    ...item,
                    recordId: id
                });
            });
        }
    });

    // 날짜순 정렬 및 중복 제거 (같은 날짜가 있으면 나중에 추가된 값 사용)
    const dataMap = new Map();
    mergedData.forEach(item => {
        dataMap.set(item.date, item);
    });

    const sortedData = Array.from(dataMap.values()).sort((a, b) => {
        const dateA = new Date(a.date + '-01');
        const dateB = new Date(b.date + '-01');
        return dateA - dateB;
    });

    return sortedData;
}

// 선택된 기록들의 그래프 합치기
function updateSelectedChart() {
    const selectedData = getSelectedRecordsData();
    
    if (selectedData.length === 0) {
        // 선택된 것이 없으면 그래프 초기화
        const ctx = document.getElementById('degradation-chart');
        if (ctx && degradationChart) {
            degradationChart.destroy();
            degradationChart = null;
            const canvas = ctx.getContext('2d');
            canvas.clearRect(0, 0, ctx.width, ctx.height);
        }
        return;
    }

    // 합쳐진 데이터로 그래프 업데이트
    updateDegradationChartWithData(selectedData);
}

// 선택한 기록 그래프 보기 버튼 클릭 이벤트 (절연저항 열화 패턴)
document.getElementById('update-chart-selected').addEventListener('click', () => {
    updateSelectedChart();
});

// 선택한 기록 그래프 보기 버튼 클릭 이벤트 (절연성능 평가)
document.getElementById('update-performance-chart-selected').addEventListener('click', () => {
    updateSelectedPerformanceChart();
});

// 전체 선택 버튼 클릭 이벤트(절연성능 평가)
document.getElementById('check-all-select-performance').addEventListener('click', () => {
    const shouldCheckAll = [...document.querySelectorAll('.history-checkbox-performance')].some(checkbox => !checkbox.checked);
    [...document.querySelectorAll('.history-checkbox-performance')].forEach(checkbox => {
        checkbox.checked = shouldCheckAll;
    });

    if (shouldCheckAll) {
        document.getElementById('check-all-select-performance').textContent = '전체 선택 해제';
    } else {
        document.getElementById('check-all-select-performance').textContent = '전체 선택';
    }
});

// 전체 선택 버튼 클릭 이벤트(절연저항 열화 패턴)
document.getElementById('check-all-select-degradation').addEventListener('click', () => {
    const shouldCheckAll = [...document.querySelectorAll('.history-checkbox')].some(checkbox => !checkbox.checked); 
    [...document.querySelectorAll('.history-checkbox')].forEach(checkbox => {
        checkbox.checked = shouldCheckAll;
    });

    if (shouldCheckAll) {
        document.getElementById('check-all-select-degradation').textContent = '전체 선택 해제';
    } else {
        document.getElementById('check-all-select-degradation').textContent = '전체 선택';
    }
});

// 전역 함수로 등록
window.updateSelectedChart = updateSelectedChart;
window.updateSelectedPerformanceChart = updateSelectedPerformanceChart;

// 페이지 로드 시 현재 활성화된 모드의 기록 로드
document.addEventListener('DOMContentLoaded', () => {
    // 초기 로드 시 절연성능 평가 모드가 활성화되어 있으므로 해당 기록 로드
    loadHistory('performance');
});
console.log('Script loaded');

