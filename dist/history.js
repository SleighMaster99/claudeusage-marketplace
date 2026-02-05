/**
 * History command module (Story 9.5)
 * CLI for viewing usage history with table, graph, and summary
 */
import { fileURLToPath } from 'url';
import { readHistoryData } from './storage/reader.js';
import { aggregateUsage, comparePeriods } from './utils/aggregator.js';
import { createBarGraph, createLineGraph, formatDateLabel } from './display/graph.js';
import { getWarningIcon } from './display/formatter.js';
import { calculateTotalCost } from './utils/cost-calculator.js';
import { getSetting } from './utils/config.js';
import { t } from './utils/i18n.js';
// 상수 정의
export const DEFAULT_PERIOD = 'week';
export const DEFAULT_SHOW_COST = false;
/**
 * 로컬 날짜 포맷 헬퍼 (UTC 문제 방지)
 * @param d - Date 객체
 * @returns YYYY-MM-DD 형식 문자열
 */
function formatLocalDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
/**
 * 명령행 인자에서 옵션 파싱
 * @param args - 명령행 인자 배열
 * @returns 파싱된 옵션
 */
export function parseHistoryOptions(args) {
    let period = DEFAULT_PERIOD;
    let showCost = DEFAULT_SHOW_COST;
    let compare;
    let interactive = false;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const normalized = arg.toLowerCase();
        if (normalized === '--today' || normalized === 'today') {
            period = 'today';
        }
        else if (normalized === '--week' || normalized === 'week') {
            period = 'week';
        }
        else if (normalized === '--month' || normalized === 'month') {
            period = 'month';
        }
        else if (normalized === '--cost') {
            showCost = true;
        }
        else if (normalized === '--interactive' || normalized === '-i') {
            interactive = true;
        }
        else if (normalized === '--compare') {
            // --compare 다음 인자 확인
            const nextArg = args[i + 1]?.toLowerCase();
            if (nextArg === 'week') {
                compare = 'week';
                i++; // 다음 인자 스킵
            }
            else if (nextArg === 'month') {
                compare = 'month';
                i++; // 다음 인자 스킵
            }
            else {
                // 기본값: week
                compare = 'week';
            }
        }
    }
    return { period, showCost, compare, interactive };
}
/**
 * 기간에 따른 날짜 범위 계산
 * @param period - 조회 기간
 * @returns { startDate, endDate } (YYYY-MM-DD 형식)
 */
export function calculateDateRange(period) {
    const today = new Date();
    const endDate = formatLocalDate(today);
    let startDate;
    switch (period) {
        case 'today':
            startDate = endDate;
            break;
        case 'week': {
            const weekAgo = new Date(today);
            weekAgo.setDate(today.getDate() - 6);
            startDate = formatLocalDate(weekAgo);
            break;
        }
        case 'month': {
            const monthAgo = new Date(today);
            monthAgo.setDate(today.getDate() - 29);
            startDate = formatLocalDate(monthAgo);
            break;
        }
    }
    return { startDate, endDate };
}
/**
 * 비교 기간 계산 (Story 9.7)
 * @param compare - 비교 타입 ('week' | 'month')
 * @returns 현재 기간과 이전 기간의 시작/종료 날짜
 */
export function calculateComparisonDateRanges(compare) {
    const today = new Date();
    if (compare === 'week') {
        // 이번 주 월요일 찾기
        const dayOfWeek = today.getDay(); // 0=일, 1=월, ..., 6=토
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        // 이번 주 월요일
        const currentMonday = new Date(today);
        currentMonday.setDate(today.getDate() - daysFromMonday);
        // 이번 주 일요일
        const currentSunday = new Date(currentMonday);
        currentSunday.setDate(currentMonday.getDate() + 6);
        // 지난 주 월요일
        const previousMonday = new Date(currentMonday);
        previousMonday.setDate(currentMonday.getDate() - 7);
        // 지난 주 일요일
        const previousSunday = new Date(previousMonday);
        previousSunday.setDate(previousMonday.getDate() + 6);
        return {
            current: {
                startDate: formatLocalDate(currentMonday),
                endDate: formatLocalDate(currentSunday),
            },
            previous: {
                startDate: formatLocalDate(previousMonday),
                endDate: formatLocalDate(previousSunday),
            },
        };
    }
    else {
        // month: 이번 달 1일~오늘 vs 지난 달 동일 기간
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();
        const currentDay = today.getDate();
        // 이번 달 1일
        const currentStart = new Date(currentYear, currentMonth, 1);
        // 이번 달 오늘
        const currentEnd = today;
        // 지난 달 1일
        const previousStart = new Date(currentYear, currentMonth - 1, 1);
        // 지난 달 동일 일자 (혹은 말일)
        const previousMonth = currentMonth - 1 < 0 ? 11 : currentMonth - 1;
        const previousYear = currentMonth - 1 < 0 ? currentYear - 1 : currentYear;
        const lastDayOfPreviousMonth = new Date(previousYear, previousMonth + 1, 0).getDate();
        const previousEndDay = Math.min(currentDay, lastDayOfPreviousMonth);
        const previousEnd = new Date(previousYear, previousMonth, previousEndDay);
        return {
            current: {
                startDate: formatLocalDate(currentStart),
                endDate: formatLocalDate(currentEnd),
            },
            previous: {
                startDate: formatLocalDate(previousStart),
                endDate: formatLocalDate(previousEnd),
            },
        };
    }
}
/**
 * 트렌드 화살표 반환 (Story 9.7)
 * @param changePercent - 변화율 (null이면 변화 없음)
 * @returns 화살표 문자
 */
function getTrendArrow(changePercent) {
    if (changePercent === null || changePercent === 0) {
        return '→';
    }
    return changePercent > 0 ? '↑' : '↓';
}
/**
 * 변화율 포맷 (Story 9.7)
 * @param changePercent - 변화율
 * @returns 포맷된 문자열
 */
function formatChangePercent(changePercent) {
    if (changePercent === null) {
        return '-';
    }
    const sign = changePercent >= 0 ? '+' : '';
    return `${sign}${changePercent.toFixed(1)}%`;
}
/**
 * 비교 결과 포맷팅 (Story 9.7)
 * @param currentData - 현재 기간 집계 데이터
 * @param previousData - 이전 기간 집계 데이터
 * @param compare - 비교 타입 ('week' | 'month')
 * @returns 테이블 포맷 문자열
 */
export function formatComparisonResult(currentData, previousData, compare) {
    const periodLabel = compare === 'week' ? '주' : '달';
    const comparison = comparePeriods(currentData, previousData);
    const lines = [];
    // 제목
    lines.push(`사용량 비교 (이번 ${periodLabel} vs 지난 ${periodLabel})`);
    lines.push('');
    // 테이블 헤더
    lines.push(`| 지표 | 지난 ${periodLabel} | 이번 ${periodLabel} | 변화 |`);
    lines.push('|------|---------|---------|------|');
    // 평균 세션 사용률
    const sessionArrow = getTrendArrow(comparison.sessionUtilization.changePercent);
    const sessionChange = formatChangePercent(comparison.sessionUtilization.changePercent);
    lines.push(`| 평균 세션 사용률 | ${formatPercent(previousData.avgSessionUtilization)} | ${formatPercent(currentData.avgSessionUtilization)} | ${sessionArrow} ${sessionChange} |`);
    // 최대 세션 사용률
    const maxSessionTrend = calculateTrendForValue(currentData.maxSessionUtilization, previousData.maxSessionUtilization);
    const maxSessionArrow = getTrendArrow(maxSessionTrend);
    const maxSessionChange = formatChangePercent(maxSessionTrend);
    lines.push(`| 최대 세션 사용률 | ${formatPercent(previousData.maxSessionUtilization)} | ${formatPercent(currentData.maxSessionUtilization)} | ${maxSessionArrow} ${maxSessionChange} |`);
    // 평균 주간 사용률
    const weeklyArrow = getTrendArrow(comparison.weeklyUtilization.changePercent);
    const weeklyChange = formatChangePercent(comparison.weeklyUtilization.changePercent);
    lines.push(`| 평균 주간 사용률 | ${formatPercent(previousData.avgWeeklyUtilization)} | ${formatPercent(currentData.avgWeeklyUtilization)} | ${weeklyArrow} ${weeklyChange} |`);
    // 총 토큰
    const tokensArrow = getTrendArrow(comparison.tokens.changePercent);
    const tokensChange = formatChangePercent(comparison.tokens.changePercent);
    lines.push(`| 총 토큰 | ${formatTokenCount(previousData.totalTokens)} | ${formatTokenCount(currentData.totalTokens)} | ${tokensArrow} ${tokensChange} |`);
    return lines.join('\n');
}
/**
 * 두 값의 변화율 계산 (단순 버전)
 */
function calculateTrendForValue(current, previous) {
    if (previous === 0) {
        return null;
    }
    return ((current - previous) / previous) * 100;
}
/**
 * 기간에 따른 집계 단위 결정
 * @param period - 조회 기간
 * @returns 집계 단위
 */
export function getAggregationUnit(period) {
    switch (period) {
        case 'today':
            return 'hour';
        case 'week':
        case 'month':
            return 'day';
    }
}
/**
 * 기간에 따른 제목 반환
 * @param period - 조회 기간
 * @returns 제목 문자열
 */
export function getTitle(period) {
    switch (period) {
        case 'today':
            return '오늘';
        case 'week':
            return '최근 7일';
        case 'month':
            return '최근 30일';
    }
}
/**
 * 토큰 수를 가독성 있는 문자열로 포맷
 * @param tokens - 토큰 수
 * @returns 포맷된 문자열 (예: "1.5M", "125K", "500")
 */
export function formatTokenCount(tokens) {
    if (tokens >= 1_000_000) {
        return `${(tokens / 1_000_000).toFixed(1)}M`;
    }
    if (tokens >= 1_000) {
        return `${Math.round(tokens / 1_000)}K`;
    }
    return String(tokens);
}
/**
 * 사용률을 퍼센트 문자열로 변환
 * @param value - 0.0~1.0 사용률
 * @returns 퍼센트 문자열 (예: "45%")
 */
export function formatPercent(value) {
    return `${Math.round(value * 100)}%`;
}
/**
 * 집계 데이터를 테이블 형태로 포맷
 * @param data - 집계 데이터 맵
 * @param unit - 집계 단위
 * @returns 테이블 문자열
 */
export function formatHistoryTable(data, unit) {
    if (data.size === 0) {
        return '(데이터 없음)';
    }
    const lines = [];
    // 헤더
    lines.push('| 날짜   | 세션(평균) | 세션(최대) | 주간(평균) | 토큰   |');
    lines.push('|--------|------------|------------|------------|--------|');
    // 키 정렬 (시간순)
    const sortedKeys = Array.from(data.keys()).sort();
    for (const key of sortedKeys) {
        const aggData = data.get(key);
        const label = formatDateLabel(key, unit);
        const avgSession = formatPercent(aggData.avgSessionUtilization);
        const maxSession = formatPercent(aggData.maxSessionUtilization);
        const avgWeekly = formatPercent(aggData.avgWeeklyUtilization);
        const tokens = formatTokenCount(aggData.totalTokens);
        // 80% 이상 경고
        const avgWarning = getWarningIcon(aggData.avgSessionUtilization);
        const maxWarning = getWarningIcon(aggData.maxSessionUtilization);
        lines.push(`| ${label.padEnd(6)} | ${(avgSession + avgWarning).padStart(10)} | ${(maxSession + maxWarning).padStart(10)} | ${avgWeekly.padStart(10)} | ${tokens.padStart(6)} |`);
    }
    return lines.join('\n');
}
/**
 * 집계 데이터에서 요약 정보 계산
 * @param data - 집계 데이터 맵
 * @returns 요약 정보
 */
export function calculateHistorySummary(data) {
    if (data.size === 0) {
        return {
            totalRecords: 0,
            avgSessionUtilization: 0,
            maxSessionUtilization: 0,
            avgWeeklyUtilization: 0,
            totalTokens: 0,
        };
    }
    let totalRecords = 0;
    let weightedSessionSum = 0;
    let maxSession = 0;
    let weightedWeeklySum = 0;
    let totalTokens = 0;
    for (const aggData of data.values()) {
        totalRecords += aggData.count;
        weightedSessionSum += aggData.avgSessionUtilization * aggData.count;
        maxSession = Math.max(maxSession, aggData.maxSessionUtilization);
        weightedWeeklySum += aggData.avgWeeklyUtilization * aggData.count;
        totalTokens += aggData.totalTokens;
    }
    return {
        totalRecords,
        avgSessionUtilization: totalRecords > 0 ? weightedSessionSum / totalRecords : 0,
        maxSessionUtilization: maxSession,
        avgWeeklyUtilization: totalRecords > 0 ? weightedWeeklySum / totalRecords : 0,
        totalTokens,
    };
}
/**
 * 요약 정보를 문자열로 포맷
 * @param summary - 요약 정보
 * @returns 포맷된 문자열
 */
export function formatHistorySummary(summary) {
    const lines = [];
    lines.push(`총 기록: ${summary.totalRecords}건`);
    lines.push(`평균 세션 사용률: ${formatPercent(summary.avgSessionUtilization)}`);
    lines.push(`최대 세션 사용률: ${formatPercent(summary.maxSessionUtilization)}`);
    lines.push(`총 토큰: ${formatTokenCount(summary.totalTokens)}`);
    return lines.join('\n');
}
/**
 * 집계 데이터를 그래프 데이터 포인트로 변환
 * @param data - 집계 데이터 맵
 * @param unit - 집계 단위
 * @returns 그래프 데이터 포인트 배열
 */
export function aggregatedDataToGraphPoints(data, unit) {
    if (data.size === 0) {
        return [];
    }
    const sortedKeys = Array.from(data.keys()).sort();
    return sortedKeys.map((key) => ({
        label: formatDateLabel(key, unit),
        value: data.get(key).avgSessionUtilization,
    }));
}
/**
 * 비용 정보를 문자열로 포맷
 * @param records - 사용량 레코드 배열
 * @returns 포맷된 비용 정보 문자열
 */
export function formatCostInfo(records) {
    const cost = calculateTotalCost(records, { includeKrw: true });
    const lines = [];
    lines.push(`입력 비용: $${cost.inputCostUsd.toFixed(2)}`);
    lines.push(`출력 비용: $${cost.outputCostUsd.toFixed(2)}`);
    lines.push(`캐시 절약: $${cost.cacheDiscountUsd.toFixed(2)}`);
    if (cost.totalCostKrw !== undefined) {
        lines.push(`총 비용: $${cost.totalCostUsd.toFixed(2)} (₩${cost.totalCostKrw.toLocaleString()})`);
    }
    else {
        lines.push(`총 비용: $${cost.totalCostUsd.toFixed(2)}`);
    }
    return lines.join('\n');
}
/**
 * 모든 레코드 추출 (비용 계산용)
 * @param data - DailyUsageFile 배열
 * @returns UsageRecord 배열
 */
function extractAllRecords(data) {
    const records = [];
    for (const daily of data) {
        records.push(...daily.records);
    }
    return records;
}
/**
 * 집계 데이터에서 단일 AggregatedData 계산 (전체 기간 합산)
 * @param aggregated - 기간별 집계 데이터 맵
 * @returns 합산된 AggregatedData
 */
function mergeAggregatedData(aggregated) {
    if (aggregated.size === 0) {
        return {
            avgSessionUtilization: 0,
            maxSessionUtilization: 0,
            avgWeeklyUtilization: 0,
            maxWeeklyUtilization: 0,
            totalTokens: 0,
            count: 0,
        };
    }
    let totalCount = 0;
    let weightedSessionSum = 0;
    let maxSession = 0;
    let weightedWeeklySum = 0;
    let maxWeekly = 0;
    let totalTokens = 0;
    for (const data of aggregated.values()) {
        totalCount += data.count;
        weightedSessionSum += data.avgSessionUtilization * data.count;
        maxSession = Math.max(maxSession, data.maxSessionUtilization);
        weightedWeeklySum += data.avgWeeklyUtilization * data.count;
        maxWeekly = Math.max(maxWeekly, data.maxWeeklyUtilization);
        totalTokens += data.totalTokens;
    }
    return {
        avgSessionUtilization: totalCount > 0 ? weightedSessionSum / totalCount : 0,
        maxSessionUtilization: maxSession,
        avgWeeklyUtilization: totalCount > 0 ? weightedWeeklySum / totalCount : 0,
        maxWeeklyUtilization: maxWeekly,
        totalTokens,
        count: totalCount,
    };
}
/**
 * 히스토리 명령어 메인 함수
 * @param args - 명령행 인자
 * @returns 출력 문자열
 */
export async function runHistoryCommand(args) {
    // 1. 옵션 파싱
    const options = parseHistoryOptions(args);
    // 2. 비교 모드 분기 (Story 9.7)
    if (options.compare) {
        return runCompareMode(options.compare);
    }
    // 3. 기존 히스토리 모드
    const { startDate, endDate } = calculateDateRange(options.period);
    // 4. 데이터 로드
    const result = await readHistoryData(startDate, endDate);
    // 5. 빈 데이터 체크
    if (result.data.length === 0 || result.data.every((d) => d.records.length === 0)) {
        return '데이터가 없습니다.\n히스토리는 사용량 조회 시 자동으로 기록됩니다.';
    }
    // 6. 집계
    const unit = getAggregationUnit(options.period);
    const aggregated = aggregateUsage(result.data, unit);
    // 7. 출력 조합
    const output = [];
    // 제목
    output.push(`사용량 히스토리 (${getTitle(options.period)})`);
    output.push('');
    // 테이블
    const tableLabel = unit === 'hour' ? '시간별 요약' : '일별 요약';
    output.push(tableLabel);
    output.push(formatHistoryTable(aggregated, unit));
    output.push('');
    // 그래프 (graphStyle 설정 적용)
    output.push('사용량 추이');
    const graphPoints = aggregatedDataToGraphPoints(aggregated, unit);
    const graphStyle = getSetting('graphStyle');
    const graph = graphStyle === 'line'
        ? createLineGraph(graphPoints)
        : createBarGraph(graphPoints);
    output.push(graph);
    output.push('');
    // 요약
    output.push('요약');
    const summary = calculateHistorySummary(aggregated);
    output.push(formatHistorySummary(summary));
    // 비용 (옵션)
    if (options.showCost) {
        output.push('');
        output.push('예상 API 비용');
        const allRecords = extractAllRecords(result.data);
        output.push(formatCostInfo(allRecords));
    }
    return output.join('\n');
}
/**
 * 비교 모드 실행 (Story 9.7)
 * @param compare - 비교 타입 ('week' | 'month')
 * @returns 비교 결과 문자열
 */
async function runCompareMode(compare) {
    // 1. 비교 기간 계산
    const ranges = calculateComparisonDateRanges(compare);
    // 2. 두 기간 데이터 로드
    const [currentResult, previousResult] = await Promise.all([
        readHistoryData(ranges.current.startDate, ranges.current.endDate),
        readHistoryData(ranges.previous.startDate, ranges.previous.endDate),
    ]);
    // 3. 빈 데이터 체크
    const currentEmpty = currentResult.data.length === 0 ||
        currentResult.data.every((d) => d.records.length === 0);
    const previousEmpty = previousResult.data.length === 0 ||
        previousResult.data.every((d) => d.records.length === 0);
    if (currentEmpty && previousEmpty) {
        return '데이터가 없습니다.\n히스토리는 사용량 조회 시 자동으로 기록됩니다.';
    }
    // 한쪽만 데이터가 있는 경우 안내 메시지 준비
    const periodLabel = compare === 'week' ? '주' : '달';
    let dataNote = '';
    if (currentEmpty) {
        dataNote = `\n\n※ 이번 ${periodLabel} 데이터가 없어 0으로 표시됩니다.`;
    }
    else if (previousEmpty) {
        dataNote = `\n\n※ 지난 ${periodLabel} 데이터가 없어 0으로 표시됩니다.`;
    }
    // 4. 집계 (일별 단위로 집계 후 합산)
    const currentAggregated = aggregateUsage(currentResult.data, 'day');
    const previousAggregated = aggregateUsage(previousResult.data, 'day');
    const currentData = mergeAggregatedData(currentAggregated);
    const previousData = mergeAggregatedData(previousAggregated);
    // 5. 포맷팅 및 반환
    return formatComparisonResult(currentData, previousData, compare) + dataNote;
}
/**
 * CLI 메인 함수
 */
async function main() {
    try {
        const args = process.argv.slice(2);
        const options = parseHistoryOptions(args);
        // 인터랙티브 모드 (Story 11.7)
        if (options.interactive) {
            const { createHistoryViewerApp } = await import('./ui/views/index.js');
            await createHistoryViewerApp();
            return;
        }
        // 배치 모드 (기존)
        const output = await runHistoryCommand(args);
        process.stdout.write(output + '\n');
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`${t('error.prefix')}: ${message}\n`);
        process.exit(1);
    }
}
// ESM 직접 실행 감지
const __filename = fileURLToPath(import.meta.url);
const isDirectExecution = process.argv[1] === __filename;
if (isDirectExecution) {
    main();
}
