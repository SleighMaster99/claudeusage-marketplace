/**
 * Display formatting utilities for Claude Usage MCP Server
 */
import { formatSessionReset, formatWeeklyReset, calculateTimeRemaining } from '../utils/time.js';
import { isTestMode, TEST_MODE_PREFIX } from '../api/mock.js';
export const FILLED_BLOCK = '█';
export const EMPTY_BLOCK = '░';
const DEFAULT_WIDTH = 8;
export const WARNING_THRESHOLD = 0.8;
/**
 * 사용률을 프로그레스 바로 변환
 * @param utilization 0.0 ~ 1.0 범위의 사용률
 * @param width 프로그레스 바 너비 (기본값: 8)
 * @returns 프로그레스 바 문자열
 */
export function createProgressBar(utilization, width = DEFAULT_WIDTH) {
    const clampedUtilization = Math.max(0, Math.min(1, utilization));
    const filledCount = Math.round(clampedUtilization * width);
    const emptyCount = width - filledCount;
    return FILLED_BLOCK.repeat(filledCount) + EMPTY_BLOCK.repeat(emptyCount);
}
/**
 * 사용률이 80% 이상이면 경고 아이콘 반환
 * @param utilization 0.0 ~ 1.0 범위의 사용률
 * @returns 경고 아이콘 또는 빈 문자열
 */
export function getWarningIcon(utilization) {
    return utilization >= WARNING_THRESHOLD ? '⚠️ ' : '';
}
/**
 * UsageResponse를 출력 문자열로 포맷팅
 * @param usage API 응답 데이터
 * @returns 포맷팅된 출력 문자열
 */
export function formatUsageOutput(usage) {
    const sessionBar = createProgressBar(usage.five_hour.utilization);
    const sessionPercent = Math.round(usage.five_hour.utilization * 100);
    const sessionReset = formatSessionReset(usage.five_hour.resets_at);
    const sessionWarning = getWarningIcon(usage.five_hour.utilization);
    const weeklyBar = createProgressBar(usage.seven_day.utilization);
    const weeklyPercent = Math.round(usage.seven_day.utilization * 100);
    const weeklyReset = formatWeeklyReset(usage.seven_day.resets_at);
    const weeklyWarning = getWarningIcon(usage.seven_day.utilization);
    // AC 3: 테스트 모드 시 [TEST MODE] 표시
    const testModeLabel = isTestMode() ? TEST_MODE_PREFIX : '';
    return `${testModeLabel}📊 Claude Usage

${sessionWarning}세션 (5h):  ${sessionBar} ${sessionPercent}%  초기화: ${sessionReset}
${weeklyWarning}주간 (7d):  ${weeklyBar} ${weeklyPercent}%  초기화: ${weeklyReset}`;
}
/**
 * 남은 시간을 Status Line용 짧은 포맷으로 변환
 * @param resetsAt ISO 8601 타임스탬프
 * @returns "Xh Ym" 또는 "Xm" 형식
 */
function formatShortTimeRemaining(resetsAt) {
    const remaining = calculateTimeRemaining(resetsAt);
    if (remaining.expired) {
        return '0m';
    }
    if (remaining.hours === 0) {
        return `${remaining.minutes}m`;
    }
    return `${remaining.hours}h ${remaining.minutes}m`;
}
/**
 * UsageResponse를 Status Line 한 줄 포맷으로 변환
 * 출력: 📊 세션: ████░░░░ 45% (2h 34m) | 주간: █░░░░░░░ 12%
 * @param usage API 응답 데이터
 * @returns 한 줄 포맷 문자열 (줄바꿈 없음)
 */
export function formatStatusLine(usage) {
    const sessionBar = createProgressBar(usage.five_hour.utilization);
    const sessionPercent = Math.round(usage.five_hour.utilization * 100);
    const sessionTime = formatShortTimeRemaining(usage.five_hour.resets_at);
    const sessionWarning = getWarningIcon(usage.five_hour.utilization);
    const weeklyBar = createProgressBar(usage.seven_day.utilization);
    const weeklyPercent = Math.round(usage.seven_day.utilization * 100);
    const weeklyWarning = getWarningIcon(usage.seven_day.utilization);
    // AC 3: 테스트 모드 시 [TEST MODE] 표시
    const testModeLabel = isTestMode() ? TEST_MODE_PREFIX : '';
    return `${testModeLabel}📊 세션: ${sessionWarning}${sessionBar} ${sessionPercent}% (${sessionTime}) | 주간: ${weeklyWarning}${weeklyBar} ${weeklyPercent}%`;
}
/**
 * 캐시가 없을 때 표시할 로딩 Status Line
 * @returns 로딩 중 메시지 (줄바꿈 없음)
 */
export function formatLoadingStatusLine() {
    return '📊 사용량 로딩 중...';
}
