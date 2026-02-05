/**
 * 캘린더 유틸리티 함수 (Story 11.2, 11.4)
 *
 * 월별 캘린더 생성 및 날짜 관련 유틸리티 함수를 제공합니다.
 */
import { getCurrentLocale } from '../utils/i18n.js';
import { calculateStats, calculateTrend } from '../utils/aggregator.js';
import { calculateTotalCost } from '../utils/cost-calculator.js';
/**
 * 특정 월의 일 수 반환
 * @param year 연도
 * @param month 월 (1-12)
 * @returns 해당 월의 일 수 (28-31)
 */
export function getMonthDays(year, month) {
    // month가 1-12이므로, Date에는 다음 달(0-indexed)의 0일을 전달하면 이전 달의 마지막 날이 됨
    return new Date(year, month, 0).getDate();
}
/**
 * 월 첫날의 요일 반환
 * @param year 연도
 * @param month 월 (1-12)
 * @returns 요일 (0=일, 1=월, ..., 6=토)
 */
export function getFirstDayOfMonth(year, month) {
    return new Date(year, month - 1, 1).getDay();
}
/**
 * 캘린더 그리드 생성 (6주 x 7일)
 * @param year 연도
 * @param month 월 (1-12)
 * @returns 6x7 2D 배열, 빈 셀은 null
 */
export function buildCalendarGrid(year, month) {
    const grid = [];
    const firstDay = getFirstDayOfMonth(year, month);
    const totalDays = getMonthDays(year, month);
    let day = 1;
    for (let week = 0; week < 6; week++) {
        const row = [];
        for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
            if (week === 0 && dayOfWeek < firstDay) {
                // 첫 주, 월 시작 전
                row.push(null);
            }
            else if (day > totalDays) {
                // 월 종료 후
                row.push(null);
            }
            else {
                row.push(day);
                day++;
            }
        }
        grid.push(row);
    }
    return grid;
}
/**
 * 오늘 날짜인지 확인
 * @param year 연도
 * @param month 월 (1-12)
 * @param day 일
 * @returns true if 오늘
 */
export function isToday(year, month, day) {
    const today = new Date();
    return (today.getFullYear() === year &&
        today.getMonth() + 1 === month &&
        today.getDate() === day);
}
/**
 * 월/년 포맷 문자열 생성
 * @param year 연도
 * @param month 월 (1-12)
 * @param lang 언어 ('ko' | 'en'), 기본값: 현재 로케일
 * @returns "2026년 2월" (ko) 또는 "February 2026" (en)
 */
export function formatMonthYear(year, month, lang) {
    const locale = lang ?? getCurrentLocale();
    if (locale === 'ko') {
        return `${year}년 ${month}월`;
    }
    // 영어 월 이름
    const monthNames = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
    ];
    return `${monthNames[month - 1]} ${year}`;
}
/**
 * 날짜를 YYYY-MM-DD 형식으로 변환
 * @param year 연도
 * @param month 월 (1-12)
 * @param day 일
 * @returns "YYYY-MM-DD"
 */
export function formatDateKey(year, month, day) {
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
}
/**
 * 월의 시작일/종료일 반환
 * @param year 연도
 * @param month 월 (1-12)
 * @returns { startDate: "YYYY-MM-01", endDate: "YYYY-MM-DD" }
 */
export function getMonthRange(year, month) {
    const lastDay = getMonthDays(year, month);
    return {
        startDate: formatDateKey(year, month, 1),
        endDate: formatDateKey(year, month, lastDay),
    };
}
/**
 * 요일 헤더 문자열 반환
 * @param lang 언어 ('ko' | 'en'), 기본값: 현재 로케일
 * @returns "일 월 화 수 목 금 토" (ko) 또는 "Su Mo Tu We Th Fr Sa" (en)
 */
export function getWeekdayHeaders(lang) {
    const locale = lang ?? getCurrentLocale();
    if (locale === 'ko') {
        return ['일', '월', '화', '수', '목', '금', '토'];
    }
    return ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
}
// ============================================================================
// Story 11.4: 기간 비교 뷰용 날짜 범위 함수
// ============================================================================
/**
 * 주 단위 날짜 범위 반환 (ISO 8601: 월요일 시작)
 * @param offset 0=이번 주, -1=지난 주, 1=다음 주, ...
 * @returns { startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD" }
 */
export function getWeekDateRange(offset) {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=일, 1=월, ..., 6=토
    // ISO 8601: 월요일=0, ..., 일요일=6으로 변환
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    // 이번 주 월요일 계산
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysSinceMonday + offset * 7);
    // 일요일 계산 (월요일 + 6일)
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
        startDate: formatDateKey(monday.getFullYear(), monday.getMonth() + 1, monday.getDate()),
        endDate: formatDateKey(sunday.getFullYear(), sunday.getMonth() + 1, sunday.getDate()),
    };
}
/**
 * 월 단위 날짜 범위 반환
 * @param offset 0=이번 달, -1=지난 달, 1=다음 달, ...
 * @returns { startDate: "YYYY-MM-DD", endDate: "YYYY-MM-DD" }
 */
export function getMonthDateRange(offset) {
    const now = new Date();
    const targetYear = now.getFullYear();
    const targetMonth = now.getMonth() + 1 + offset; // 1-12 기반
    // 연도 경계 처리
    let year = targetYear;
    let month = targetMonth;
    if (month < 1) {
        year -= Math.ceil(Math.abs(month) / 12) || 1;
        month = 12 + (month % 12) || 12;
    }
    else if (month > 12) {
        year += Math.floor((month - 1) / 12);
        month = ((month - 1) % 12) + 1;
    }
    return getMonthRange(year, month);
}
/**
 * 두 기간의 데이터를 비교 (Story 11.4)
 * @param currentData 현재 기간 데이터
 * @param previousData 이전 기간 데이터
 * @param currentPeriod 현재 기간 정보
 * @param previousPeriod 이전 기간 정보
 * @returns 기간 비교 결과
 */
export function calculatePeriodComparison(currentData, previousData, currentPeriod, previousPeriod) {
    // 레코드 평탄화
    const flattenRecords = (data) => {
        const records = [];
        for (const daily of data) {
            records.push(...daily.records);
        }
        return records;
    };
    const currentRecords = flattenRecords(currentData);
    const previousRecords = flattenRecords(previousData);
    // 통계 계산 (aggregator의 calculateStats 재사용)
    const currentStats = calculateStats(currentRecords);
    const previousStats = calculateStats(previousRecords);
    // 비용 계산 (cost-calculator의 calculateTotalCost 재사용)
    const currentCost = calculateTotalCost(currentRecords);
    const previousCost = calculateTotalCost(previousRecords);
    // 트렌드 계산 (aggregator의 calculateTrend 재사용)
    const sessionTrend = calculateTrend(currentStats.avgSessionUtilization, previousStats.avgSessionUtilization);
    const weeklyTrend = calculateTrend(currentStats.avgWeeklyUtilization, previousStats.avgWeeklyUtilization);
    const tokensTrend = calculateTrend(currentStats.totalTokens, previousStats.totalTokens);
    const costTrend = calculateTrend(currentCost.totalCostUsd, previousCost.totalCostUsd);
    return {
        current: {
            avgSession: currentStats.avgSessionUtilization,
            avgWeekly: currentStats.avgWeeklyUtilization,
            totalTokens: currentStats.totalTokens,
            totalCostUsd: currentCost.totalCostUsd,
            recordCount: currentStats.count,
            period: currentPeriod,
        },
        previous: {
            avgSession: previousStats.avgSessionUtilization,
            avgWeekly: previousStats.avgWeeklyUtilization,
            totalTokens: previousStats.totalTokens,
            totalCostUsd: previousCost.totalCostUsd,
            recordCount: previousStats.count,
            period: previousPeriod,
        },
        trends: {
            sessionTrend,
            weeklyTrend,
            tokensTrend,
            costTrend,
        },
    };
}
