/**
 * Data aggregation engine (Story 9.2)
 * Aggregates usage data by various time units
 */
import { calculateTotalCost } from './cost-calculator.js';
/**
 * ISO 8601 주차 계산
 * @param date - 날짜
 * @returns { year: number, week: number } - ISO 연도와 주차
 */
export function getISOWeek(date) {
    // UTC로 복사 (타임존 영향 제거)
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    // 해당 주의 목요일로 이동 (ISO 주는 목요일이 속한 연도로 결정)
    // getUTCDay(): 0=일, 1=월, ..., 4=목, ..., 6=토
    const dayOfWeek = d.getUTCDay();
    // 월요일=0, ..., 일요일=6으로 변환
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    // 해당 주의 목요일 = 현재 날짜 - (월요일부터 일수) + 3
    d.setUTCDate(d.getUTCDate() - daysSinceMonday + 3);
    // ISO 연도 (목요일이 속한 연도)
    const isoYear = d.getUTCFullYear();
    // 해당 연도 1월 4일 (항상 1주차에 포함)
    const jan4 = new Date(Date.UTC(isoYear, 0, 4));
    // 1월 4일이 속한 주의 목요일 찾기
    const jan4DayOfWeek = jan4.getUTCDay();
    const jan4Thursday = new Date(jan4);
    jan4Thursday.setUTCDate(jan4.getUTCDate() - ((jan4DayOfWeek + 6) % 7) + 3);
    // 주차 계산: 목요일 간의 차이를 7로 나눔
    const diffMs = d.getTime() - jan4Thursday.getTime();
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
    const week = Math.floor(diffDays / 7) + 1;
    return { year: isoYear, week };
}
/**
 * ISO 주차를 문자열로 포맷
 * @param date - 날짜
 * @returns "YYYY-Www" 형식 (예: "2026-W05")
 */
export function formatISOWeek(date) {
    const { year, week } = getISOWeek(date);
    return `${year}-W${week.toString().padStart(2, '0')}`;
}
/**
 * 타임스탬프에서 그룹화 키 생성
 * @param timestamp - ISO 8601 타임스탬프
 * @param unit - 집계 단위
 * @returns 그룹화 키
 */
export function getGroupKey(timestamp, unit) {
    const date = new Date(timestamp);
    switch (unit) {
        case 'hour': {
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            const hh = String(date.getHours()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd} ${hh}:00`;
        }
        case 'day': {
            return timestamp.split('T')[0];
        }
        case 'week': {
            return formatISOWeek(date);
        }
        case 'month': {
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            return `${yyyy}-${mm}`;
        }
    }
}
/**
 * 레코드를 단위별로 그룹화
 * @param records - 사용량 레코드 배열
 * @param unit - 집계 단위
 * @returns 그룹화된 레코드 맵
 */
export function groupByUnit(records, unit) {
    const groups = new Map();
    for (const record of records) {
        const key = getGroupKey(record.timestamp, unit);
        const existing = groups.get(key) || [];
        existing.push(record);
        groups.set(key, existing);
    }
    return groups;
}
/**
 * 레코드 그룹의 통계 계산
 * @param records - 사용량 레코드 배열
 * @returns 집계된 데이터
 */
export function calculateStats(records) {
    if (records.length === 0) {
        return {
            avgSessionUtilization: 0,
            maxSessionUtilization: 0,
            avgWeeklyUtilization: 0,
            maxWeeklyUtilization: 0,
            totalTokens: 0,
            count: 0,
        };
    }
    let sumSession = 0;
    let maxSession = 0;
    let sumWeekly = 0;
    let maxWeekly = 0;
    let totalTokens = 0;
    for (const record of records) {
        sumSession += record.session.utilization;
        maxSession = Math.max(maxSession, record.session.utilization);
        sumWeekly += record.weekly.utilization;
        maxWeekly = Math.max(maxWeekly, record.weekly.utilization);
        if (record.tokens) {
            totalTokens += record.tokens.input + record.tokens.output;
        }
    }
    return {
        avgSessionUtilization: sumSession / records.length,
        maxSessionUtilization: maxSession,
        avgWeeklyUtilization: sumWeekly / records.length,
        maxWeeklyUtilization: maxWeekly,
        totalTokens,
        count: records.length,
    };
}
/**
 * 트렌드 계산 (증감률)
 * @param current - 현재 값
 * @param previous - 이전 값
 * @returns 트렌드 결과
 */
export function calculateTrend(current, previous) {
    if (previous === 0) {
        return {
            changePercent: null,
            previousValue: previous,
            currentValue: current,
        };
    }
    const changePercent = ((current - previous) / previous) * 100;
    return {
        changePercent,
        previousValue: previous,
        currentValue: current,
    };
}
/**
 * 두 기간의 데이터 비교
 * @param currentData - 현재 기간 데이터
 * @param previousData - 이전 기간 데이터
 * @returns 각 지표별 트렌드 결과
 */
export function comparePeriods(currentData, previousData) {
    return {
        sessionUtilization: calculateTrend(currentData.avgSessionUtilization, previousData.avgSessionUtilization),
        weeklyUtilization: calculateTrend(currentData.avgWeeklyUtilization, previousData.avgWeeklyUtilization),
        tokens: calculateTrend(currentData.totalTokens, previousData.totalTokens),
    };
}
/**
 * 메인 집계 함수
 * @param data - DailyUsageFile 배열 (readHistoryData 결과)
 * @param unit - 집계 단위
 * @returns 기간별 집계 데이터 맵
 */
export function aggregateUsage(data, unit) {
    // 모든 레코드를 하나의 배열로 평탄화
    const allRecords = [];
    for (const daily of data) {
        allRecords.push(...daily.records);
    }
    // 단위별로 그룹화
    const groups = groupByUnit(allRecords, unit);
    // 각 그룹의 통계 계산
    const result = new Map();
    for (const [key, records] of groups) {
        result.set(key, calculateStats(records));
    }
    return result;
}
/**
 * 시간별 집계 (Story 11.3)
 * @param records - 하루치 사용량 레코드 배열
 * @returns 시간별 집계 데이터 배열 (hour 오름차순 정렬)
 */
export function aggregateHourly(records) {
    if (records.length === 0) {
        return [];
    }
    // 시간별 그룹화
    const groups = groupByUnit(records, 'hour');
    // HourlyData 배열로 변환
    const hourlyData = [];
    for (const [key, groupRecords] of groups) {
        // key 형식: "YYYY-MM-DD HH:00" → hour 추출
        const hourMatch = key.match(/(\d{2}):00$/);
        if (!hourMatch)
            continue;
        const hour = parseInt(hourMatch[1], 10);
        const stats = calculateStats(groupRecords);
        // 토큰 합계 계산
        let inputTokens = 0;
        let outputTokens = 0;
        for (const record of groupRecords) {
            if (record.tokens) {
                inputTokens += record.tokens.input;
                outputTokens += record.tokens.output;
            }
        }
        hourlyData.push({
            hour,
            avgSession: stats.avgSessionUtilization,
            avgWeekly: stats.avgWeeklyUtilization,
            totalTokens: stats.totalTokens,
            inputTokens,
            outputTokens,
            count: stats.count,
        });
    }
    // hour 오름차순 정렬
    hourlyData.sort((a, b) => a.hour - b.hour);
    return hourlyData;
}
/**
 * 일별 요약 계산 (Story 11.3)
 * @param records - 하루치 사용량 레코드 배열
 * @returns 일별 요약 데이터
 */
export function calculateDailySummary(records) {
    if (records.length === 0) {
        return {
            avgSession: 0,
            maxSession: 0,
            maxSessionHour: -1,
            totalTokens: 0,
            inputTokens: 0,
            outputTokens: 0,
            estimatedCostUsd: 0,
            count: 0,
        };
    }
    const stats = calculateStats(records);
    // 토큰 합계 계산
    let inputTokens = 0;
    let outputTokens = 0;
    for (const record of records) {
        if (record.tokens) {
            inputTokens += record.tokens.input;
            outputTokens += record.tokens.output;
        }
    }
    // 최대 사용률 시간 찾기
    let maxSession = 0;
    let maxSessionHour = -1;
    const hourlyGroups = groupByUnit(records, 'hour');
    for (const [key, groupRecords] of hourlyGroups) {
        const hourMatch = key.match(/(\d{2}):00$/);
        if (!hourMatch)
            continue;
        const hour = parseInt(hourMatch[1], 10);
        const groupStats = calculateStats(groupRecords);
        if (groupStats.maxSessionUtilization > maxSession) {
            maxSession = groupStats.maxSessionUtilization;
            maxSessionHour = hour;
        }
    }
    // 비용 계산
    const costResult = calculateTotalCost(records);
    return {
        avgSession: stats.avgSessionUtilization,
        maxSession,
        maxSessionHour,
        totalTokens: stats.totalTokens,
        inputTokens,
        outputTokens,
        estimatedCostUsd: costResult.totalCostUsd,
        count: stats.count,
    };
}
