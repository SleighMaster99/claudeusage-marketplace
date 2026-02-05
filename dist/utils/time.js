/**
 * Time calculation utilities for Claude Usage MCP Server
 */
const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
/**
 * ISO 8601 UTC 문자열을 Date 객체로 파싱
 */
export function parseResetTime(resetsAt) {
    return new Date(resetsAt);
}
/**
 * 현재 시간과 리셋 시간의 차이를 계산
 */
export function calculateTimeRemaining(resetsAt) {
    const resetDate = parseResetTime(resetsAt);
    const totalMs = resetDate.getTime() - Date.now();
    if (totalMs <= 0) {
        return {
            days: 0,
            hours: 0,
            minutes: 0,
            totalMs,
            expired: true,
        };
    }
    const days = Math.floor(totalMs / MS_PER_DAY);
    const hours = Math.floor((totalMs % MS_PER_DAY) / MS_PER_HOUR);
    const minutes = Math.floor((totalMs % MS_PER_HOUR) / MS_PER_MINUTE);
    return {
        days,
        hours,
        minutes,
        totalMs,
        expired: false,
    };
}
/**
 * 5시간 리셋 시간을 포맷팅
 * 출력: "Xh Ym 후 (오후 3:30)" 또는 "곧 초기화"
 */
export function formatSessionReset(resetsAt) {
    const remaining = calculateTimeRemaining(resetsAt);
    if (remaining.expired) {
        return '곧 초기화';
    }
    const resetDate = parseResetTime(resetsAt);
    const timeFormatter = new Intl.DateTimeFormat('ko-KR', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
    const localTime = timeFormatter.format(resetDate);
    // 1시간 미만인 경우 분만 표시
    if (remaining.hours === 0) {
        return `${remaining.minutes}m 후 (${localTime})`;
    }
    return `${remaining.hours}h ${remaining.minutes}m 후 (${localTime})`;
}
/**
 * 7일 리셋 시간을 포맷팅
 * 출력: "X일 후 (M/D 요일)" 또는 "곧 초기화"
 */
export function formatWeeklyReset(resetsAt) {
    const remaining = calculateTimeRemaining(resetsAt);
    if (remaining.expired) {
        return '곧 초기화';
    }
    const resetDate = parseResetTime(resetsAt);
    // 1일 미만인 경우 시간 포맷 사용
    if (remaining.days === 0) {
        const timeFormatter = new Intl.DateTimeFormat('ko-KR', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
        const localTime = timeFormatter.format(resetDate);
        if (remaining.hours === 0) {
            return `${remaining.minutes}m 후 (${localTime})`;
        }
        return `${remaining.hours}h ${remaining.minutes}m 후 (${localTime})`;
    }
    const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
        month: 'numeric',
        day: 'numeric',
        weekday: 'short',
    });
    const dateStr = dateFormatter.format(resetDate);
    return `${remaining.days}일 후 (${dateStr})`;
}
