/**
 * ASCII Graph Generator for Claude Usage
 * Story 9.3: 사용량 추이를 시각적으로 표시하는 ASCII 그래프 생성
 */
import { FILLED_BLOCK, EMPTY_BLOCK, WARNING_THRESHOLD, getWarningIcon } from './formatter.js';
// 기본 설정값
export const DEFAULT_GRAPH_WIDTH = 50;
export const DEFAULT_GRAPH_HEIGHT = 10;
/**
 * 날짜 레이블 포맷
 * @param date ISO 8601 날짜 또는 YYYY-MM-DD 형식
 * @param unit 집계 단위
 * @returns 포맷된 레이블
 */
export function formatDateLabel(date, unit) {
    const d = new Date(date);
    switch (unit) {
        case 'hour':
            return `${String(d.getHours()).padStart(2, '0')}:00`;
        case 'day':
            return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        case 'week': {
            // ISO 주차 계산
            const startOfYear = new Date(d.getFullYear(), 0, 1);
            const days = Math.floor((d.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
            const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
            return `W${String(weekNumber).padStart(2, '0')}`;
        }
        case 'month':
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
}
/**
 * 퍼센트 레이블 포맷
 * @param value 0.0 ~ 1.0 사용률
 * @returns 포맷된 퍼센트 문자열 (예: "45%")
 */
export function formatPercentLabel(value) {
    return `${Math.round(value * 100)}%`;
}
/**
 * 레이블 패딩 (오른쪽 정렬)
 * @param label 원본 레이블
 * @param width 목표 너비
 * @returns 패딩된 레이블
 */
export function padLabel(label, width) {
    return label.padStart(width);
}
/**
 * 레이블 패딩 (왼쪽 정렬)
 * @param label 원본 레이블
 * @param width 목표 너비
 * @returns 패딩된 레이블
 */
export function padLabelLeft(label, width) {
    return label.padEnd(width);
}
/**
 * 가로 막대 그래프 생성
 * @param data 그래프 데이터 포인트 배열
 * @param options 막대 그래프 옵션
 * @returns ASCII 막대 그래프 문자열
 */
export function createBarGraph(data, options) {
    if (data.length === 0) {
        return '(데이터 없음)';
    }
    const width = options?.width ?? DEFAULT_GRAPH_WIDTH;
    const showWarning = options?.showWarning ?? true;
    const showPercent = options?.showPercent ?? true;
    // 레이블 최대 길이 계산
    const maxLabelLength = Math.max(...data.map((d) => d.label.length));
    const lines = [];
    // 각 데이터 포인트를 막대로 변환
    for (const point of data) {
        const clampedValue = Math.max(0, Math.min(1, point.value));
        const filledCount = Math.round(clampedValue * width);
        const emptyCount = width - filledCount;
        const bar = FILLED_BLOCK.repeat(filledCount) + EMPTY_BLOCK.repeat(emptyCount);
        const label = padLabelLeft(point.label, maxLabelLength);
        const percent = showPercent ? ` ${formatPercentLabel(point.value)}` : '';
        const warning = showWarning ? getWarningIcon(point.value) : '';
        lines.push(`${label} ${bar}${percent}${warning}`);
    }
    // X축 눈금 추가
    const axisLine = createBarAxisLine(maxLabelLength, width);
    lines.push(axisLine);
    return lines.join('\n');
}
/**
 * 막대 그래프 X축 눈금 생성
 */
function createBarAxisLine(labelWidth, barWidth) {
    const padding = ' '.repeat(labelWidth + 1);
    const positions = [0, 0.25, 0.5, 0.75, 1.0];
    const labels = ['0%', '25%', '50%', '75%', '100%'];
    let axis = padding;
    let currentPos = 0;
    for (let i = 0; i < positions.length; i++) {
        const targetPos = Math.round(positions[i] * barWidth);
        const spaces = targetPos - currentPos;
        axis += ' '.repeat(Math.max(0, spaces - (i > 0 ? labels[i - 1].length : 0)));
        axis += labels[i];
        currentPos = targetPos + labels[i].length;
    }
    return axis;
}
/**
 * 시계열 라인 그래프 생성
 * @param data 그래프 데이터 포인트 배열
 * @param options 라인 그래프 옵션
 * @returns ASCII 라인 그래프 문자열
 */
export function createLineGraph(data, options) {
    if (data.length === 0) {
        return '(데이터 없음)';
    }
    if (data.length === 1) {
        const point = data[0];
        const percent = formatPercentLabel(point.value);
        const warning = (options?.showWarning ?? true) ? getWarningIcon(point.value) : '';
        return `${point.label}: ${percent}${warning}`;
    }
    const height = options?.height ?? DEFAULT_GRAPH_HEIGHT;
    const showWarning = options?.showWarning ?? true;
    const showMarkers = options?.showMarkers ?? true;
    // 그래프 그리드 생성 (height x data.length)
    const grid = Array.from({ length: height }, () => Array.from({ length: data.length }, () => ' '));
    // 경고 영역 (80% 이상) 계산
    const warningRow = Math.floor((1 - WARNING_THRESHOLD) * (height - 1));
    // 데이터 포인트 위치 계산 및 그리기
    const positions = [];
    for (let i = 0; i < data.length; i++) {
        const value = Math.max(0, Math.min(1, data[i].value));
        // 0% = height-1, 100% = 0
        const row = Math.round((1 - value) * (height - 1));
        positions.push(row);
        // 마커 표시
        if (showMarkers) {
            if (showWarning && value >= WARNING_THRESHOLD) {
                grid[row][i] = '!';
            }
            else {
                grid[row][i] = '*';
            }
        }
    }
    // 포인트 간 연결선 그리기
    for (let i = 0; i < positions.length - 1; i++) {
        const currentRow = positions[i];
        const nextRow = positions[i + 1];
        if (currentRow === nextRow) {
            // 같은 높이 - 수평선
            // 마커가 있으므로 연결선은 생략
        }
        else if (currentRow > nextRow) {
            // 상승 (row가 작아짐 = 값이 커짐)
            for (let r = currentRow - 1; r > nextRow; r--) {
                if (grid[r][i] === ' ') {
                    grid[r][i] = '/';
                }
            }
        }
        else {
            // 하락 (row가 커짐 = 값이 작아짐)
            for (let r = currentRow + 1; r < nextRow; r++) {
                if (grid[r][i + 1] === ' ') {
                    grid[r][i + 1] = '\\';
                }
            }
        }
    }
    // 출력 문자열 생성
    const lines = [];
    const yLabels = ['100%', ' 75%', ' 50%', ' 25%', '  0%'];
    const yLabelWidth = 5;
    for (let row = 0; row < height; row++) {
        // Y축 레이블 (5줄마다 또는 경계)
        let yLabel = ' '.repeat(yLabelWidth);
        if (row === 0) {
            yLabel = yLabels[0];
        }
        else if (row === Math.round((height - 1) * 0.25)) {
            yLabel = yLabels[1];
        }
        else if (row === Math.round((height - 1) * 0.5)) {
            yLabel = yLabels[2];
        }
        else if (row === Math.round((height - 1) * 0.75)) {
            yLabel = yLabels[3];
        }
        else if (row === height - 1) {
            yLabel = yLabels[4];
        }
        // 경고 영역 표시 (80% 이상)
        let prefix = '|';
        if (showWarning && row <= warningRow) {
            prefix = '!';
        }
        lines.push(`${yLabel}${prefix}${grid[row].join('')}`);
    }
    // X축 선
    const xAxisLine = ' '.repeat(yLabelWidth) + '+' + '-'.repeat(data.length);
    lines.push(xAxisLine);
    // X축 레이블
    const xLabels = data.map((d) => d.label);
    const xLabelLine = ' '.repeat(yLabelWidth + 1) + xLabels.join(' ').substring(0, data.length);
    lines.push(xLabelLine);
    return lines.join('\n');
}
