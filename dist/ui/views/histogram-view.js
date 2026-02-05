/**
 * 히스토그램 뷰 컴포넌트 (Story 11.5)
 *
 * 시간별/주별/월별 히스토그램으로 사용량 추이를 시각화합니다.
 */
import { Component } from '../component.js';
import { COLORS, colorize } from '../renderer.js';
import { createProgressBar } from '../../display/formatter.js';
import { getWeekDateRange, getMonthDateRange, formatDateKey } from '../calendar-utils.js';
import { aggregateHourly, getISOWeek, calculateStats, calculateTrend, } from '../../utils/aggregator.js';
import { calculateTotalCost } from '../../utils/cost-calculator.js';
import { readHistoryData } from '../../storage/reader.js';
import { t } from '../../utils/i18n.js';
// ============================================================================
// 상수 정의
// ============================================================================
/** 히스토그램 높이 (Y축 단계 수) */
const HISTOGRAM_HEIGHT = 6;
/** 막대 너비 (문자 수) */
const BAR_WIDTH = 4;
/** 최소 범위 */
const MIN_RANGE = 1;
/** 최대 범위 */
const MAX_RANGE = 12;
/** 기본 주 수 */
const DEFAULT_WEEK_COUNT = 4;
/** 기본 월 수 */
const DEFAULT_MONTH_COUNT = 6;
/** 헤더 영역 너비 (이모지 + 제목 + 힌트) */
const HEADER_WIDTH = 56;
/** 구분선 너비 (내용 영역, 헤더보다 좁음) */
const SEPARATOR_WIDTH = 52;
/** 프로그레스 바 너비 */
const PROGRESS_BAR_WIDTH = 20;
/**
 * 문자열의 시각적 너비 계산 (CJK 문자는 2 너비)
 */
function getVisualWidth(str) {
    let width = 0;
    for (const char of str) {
        const code = char.charCodeAt(0);
        // CJK (한중일) 문자는 2 너비, 그 외는 1 너비
        if ((code >= 0x1100 && code <= 0x11ff) || // 한글 자모
            (code >= 0x3000 && code <= 0x9fff) || // CJK 심볼, 한자
            (code >= 0xac00 && code <= 0xd7af) || // 한글 음절
            (code >= 0xf900 && code <= 0xfaff) || // CJK 호환 한자
            (code >= 0xff00 && code <= 0xffef) // 전각 문자
        ) {
            width += 2;
        }
        else {
            width += 1;
        }
    }
    return width;
}
/**
 * 시각적 너비 기준으로 padEnd
 */
function visualPadEnd(str, targetWidth) {
    const currentWidth = getVisualWidth(str);
    const padding = Math.max(0, targetWidth - currentWidth);
    return str + ' '.repeat(padding);
}
// ============================================================================
// HistogramViewComponent
// ============================================================================
/**
 * 히스토그램 뷰 컴포넌트
 */
export class HistogramViewComponent extends Component {
    mode = 'hourly';
    selectedIndex = 0;
    currentDate;
    weekCount = DEFAULT_WEEK_COUNT;
    monthCount = DEFAULT_MONTH_COUNT;
    bars = [];
    isLoading = true;
    error = null;
    callbacks;
    // Story 11.6: 비교 모드 상태
    isCompareMode = false;
    compareMode = 'hourly';
    compareBars = [];
    compareSummary = null;
    constructor(initialDate, callbacks) {
        super();
        this.currentDate = initialDate ?? this.getTodayDateKey();
        this.callbacks = callbacks ?? {};
    }
    /**
     * 오늘 날짜를 YYYY-MM-DD 형식으로 반환
     */
    getTodayDateKey() {
        const now = new Date();
        return formatDateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
    }
    /**
     * 모드 설정 및 데이터 로드
     */
    setMode(mode) {
        this.mode = mode;
        this.selectedIndex = 0;
        this.loadHistogramData();
    }
    // ============================================================================
    // 비교 모드 메서드 (Story 11.6 Task 3)
    // ============================================================================
    /**
     * 비교 모드 토글 (c 키)
     */
    toggleCompareMode() {
        this.isCompareMode = !this.isCompareMode;
        this.selectedIndex = 0;
        if (this.isCompareMode) {
            // 비교 모드 진입: 현재 일반 모드에 따라 초기 비교 모드 설정
            this.compareMode = this.mode;
            this.loadCompareData();
        }
        else {
            // 비교 모드 해제: 일반 히스토그램으로 복귀
            this.loadHistogramData();
        }
    }
    /**
     * 비교 모드 설정 (1, 2, 3, 4 키 - 비교 모드 중일 때)
     */
    setCompareMode(mode) {
        this.compareMode = mode;
        this.selectedIndex = 0;
        this.loadCompareData();
    }
    /**
     * 비교 데이터 로딩
     */
    async loadCompareData() {
        this.isLoading = true;
        this.error = null;
        this.markDirty();
        try {
            switch (this.compareMode) {
                case 'hourly':
                    this.compareBars = await this.fetchCompareHourlyBars();
                    break;
                case 'daily':
                    this.compareBars = await this.fetchCompareDailyBars();
                    break;
                case 'weekly':
                    this.compareBars = await this.fetchCompareWeeklyBars(this.weekCount);
                    break;
                case 'monthly':
                    this.compareBars = await this.fetchCompareMonthlyBars(this.monthCount);
                    break;
            }
            // 선택 인덱스 경계 체크
            this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.compareBars.length - 1));
            // 선택된 막대 표시 업데이트
            this.updateCompareSelectedBar();
            // 비교 요약 계산
            this.compareSummary = this.calculateCompareSummary(this.compareBars);
        }
        catch (err) {
            this.error = err instanceof Error ? err.message : String(err);
        }
        finally {
            this.isLoading = false;
            this.markDirty();
        }
    }
    /**
     * 비교 모드 선택된 막대 표시 업데이트
     */
    updateCompareSelectedBar() {
        for (let i = 0; i < this.compareBars.length; i++) {
            this.compareBars[i].isSelected = i === this.selectedIndex;
        }
    }
    /**
     * 비동기 데이터 로딩
     */
    async loadHistogramData() {
        this.isLoading = true;
        this.error = null;
        this.markDirty();
        try {
            switch (this.mode) {
                case 'hourly':
                    this.bars = await this.fetchHourlyBars(this.currentDate);
                    break;
                case 'weekly':
                    this.bars = await this.fetchWeeklyBars(this.weekCount);
                    break;
                case 'monthly':
                    this.bars = await this.fetchMonthlyBars(this.monthCount);
                    break;
            }
            // 선택 인덱스 경계 체크
            this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.bars.length - 1));
            // 선택된 막대 표시 업데이트
            this.updateSelectedBar();
        }
        catch (err) {
            this.error = err instanceof Error ? err.message : String(err);
        }
        finally {
            this.isLoading = false;
            this.markDirty();
        }
    }
    /**
     * 선택된 막대 표시 업데이트
     */
    updateSelectedBar() {
        for (let i = 0; i < this.bars.length; i++) {
            this.bars[i].isSelected = i === this.selectedIndex;
        }
    }
    // ============================================================================
    // 데이터 집계 메서드 (Task 2)
    // ============================================================================
    /**
     * 특정 날짜의 시간별 집계 (기존 aggregateHourly 래핑)
     */
    async fetchHourlyBars(date) {
        const result = await readHistoryData(date, date);
        if (result.data.length === 0)
            return [];
        const hourlyData = aggregateHourly(result.data[0].records);
        return hourlyData.map((h, i) => ({
            label: `${String(h.hour).padStart(2, '0')}`,
            value: h.avgSession,
            isSelected: i === this.selectedIndex,
            data: h,
        }));
    }
    /**
     * 최근 N주 집계
     */
    async fetchWeeklyBars(weeksCount) {
        const bars = [];
        for (let i = weeksCount - 1; i >= 0; i--) {
            const range = getWeekDateRange(-i);
            const result = await readHistoryData(range.startDate, range.endDate);
            const records = result.data.flatMap((d) => d.records);
            const stats = calculateStats(records);
            const cost = calculateTotalCost(records);
            const { week } = getISOWeek(new Date(range.startDate));
            const weeklyData = {
                weekNum: week,
                weekLabel: `W${String(week).padStart(2, '0')}`,
                startDate: range.startDate,
                endDate: range.endDate,
                avgSession: stats.avgSessionUtilization,
                avgWeekly: stats.avgWeeklyUtilization,
                totalTokens: stats.totalTokens,
                totalCostUsd: cost.totalCostUsd,
                recordCount: stats.count,
            };
            bars.push({
                label: weeklyData.weekLabel,
                value: stats.avgSessionUtilization,
                isSelected: false,
                data: weeklyData,
            });
        }
        return bars;
    }
    /**
     * 최근 N개월 집계
     */
    async fetchMonthlyBars(monthsCount) {
        const bars = [];
        for (let i = monthsCount - 1; i >= 0; i--) {
            const range = getMonthDateRange(-i);
            const result = await readHistoryData(range.startDate, range.endDate);
            const records = result.data.flatMap((d) => d.records);
            const stats = calculateStats(records);
            const cost = calculateTotalCost(records);
            // 월 정보 추출
            const [yearStr, monthStr] = range.startDate.split('-');
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);
            // 월 이름 배열에서 월 레이블 가져오기 (영어: "Jan", 한국어: "1월")
            const monthNames = t('histogram.monthNames').split(',');
            const monthLabel = monthNames[month - 1] ?? `${month}${t('histogram.monthLabel')}`;
            const monthlyData = {
                year,
                month,
                monthLabel,
                avgSession: stats.avgSessionUtilization,
                avgWeekly: stats.avgWeeklyUtilization,
                totalTokens: stats.totalTokens,
                totalCostUsd: cost.totalCostUsd,
                recordCount: stats.count,
            };
            bars.push({
                label: monthlyData.monthLabel,
                value: stats.avgSessionUtilization,
                isSelected: false,
                data: monthlyData,
            });
        }
        return bars;
    }
    // ============================================================================
    // 비교 데이터 집계 메서드 (Story 11.6 Task 2)
    // ============================================================================
    /**
     * 오늘 vs 어제 시간별 비교 데이터 집계
     */
    async fetchCompareHourlyBars() {
        // 오늘과 어제 날짜 계산
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const todayKey = formatDateKey(today.getFullYear(), today.getMonth() + 1, today.getDate());
        const yesterdayKey = formatDateKey(yesterday.getFullYear(), yesterday.getMonth() + 1, yesterday.getDate());
        // 두 날짜 데이터 로드
        const [todayResult, yesterdayResult] = await Promise.all([
            readHistoryData(todayKey, todayKey),
            readHistoryData(yesterdayKey, yesterdayKey),
        ]);
        // 시간별 집계
        const todayHourly = todayResult.data.length > 0 ? aggregateHourly(todayResult.data[0].records) : [];
        const yesterdayHourly = yesterdayResult.data.length > 0 ? aggregateHourly(yesterdayResult.data[0].records) : [];
        // Map으로 변환 (시간 -> HourlyData)
        const todayMap = new Map();
        const yesterdayMap = new Map();
        for (const h of todayHourly) {
            todayMap.set(h.hour, h);
        }
        for (const h of yesterdayHourly) {
            yesterdayMap.set(h.hour, h);
        }
        // 모든 시간 합집합
        const allHours = new Set([...todayMap.keys(), ...yesterdayMap.keys()]);
        const sortedHours = Array.from(allHours).sort((a, b) => a - b);
        // 비교 막대 생성
        const bars = [];
        for (const hour of sortedHours) {
            const current = todayMap.get(hour);
            const previous = yesterdayMap.get(hour);
            bars.push({
                label: String(hour).padStart(2, '0'),
                currentValue: current?.avgSession ?? 0,
                previousValue: previous?.avgSession ?? 0,
                isSelected: false,
                currentData: current,
                previousData: previous,
            });
        }
        return bars;
    }
    /**
     * 이번 주 vs 지난 주 요일별 비교 데이터 집계
     */
    async fetchCompareDailyBars() {
        // 이번 주와 지난 주 범위
        const thisWeek = getWeekDateRange(0);
        const lastWeek = getWeekDateRange(-1);
        // 두 주 데이터 로드
        const [thisWeekResult, lastWeekResult] = await Promise.all([
            readHistoryData(thisWeek.startDate, thisWeek.endDate),
            readHistoryData(lastWeek.startDate, lastWeek.endDate),
        ]);
        // 요일 이름 (0=월, 1=화, ..., 6=일)
        const dayNames = t('histogram.dayNames').split(',');
        // 요일별로 데이터 집계
        const aggregateByDayOfWeek = (data) => {
            const result = new Map();
            for (const daily of data) {
                const date = new Date(daily.date);
                // getDay(): 0=일, 1=월, ..., 6=토
                // ISO 변환: 0=월, 1=화, ..., 6=일
                const jsDay = date.getDay();
                const isoDay = (jsDay + 6) % 7; // 0=월, 1=화, ..., 6=일
                if (!result.has(isoDay)) {
                    result.set(isoDay, {
                        dayOfWeek: isoDay,
                        dayLabel: dayNames[isoDay] ?? String(isoDay),
                        date: daily.date,
                        avgSession: 0,
                        avgWeekly: 0,
                        totalTokens: 0,
                        recordCount: 0,
                    });
                }
                const dayData = result.get(isoDay);
                const stats = calculateStats(daily.records);
                // 평균 계산을 위해 누적
                const prevCount = dayData.recordCount;
                const newCount = prevCount + stats.count;
                if (newCount > 0) {
                    dayData.avgSession =
                        (dayData.avgSession * prevCount + stats.avgSessionUtilization * stats.count) / newCount;
                    dayData.avgWeekly =
                        (dayData.avgWeekly * prevCount + stats.avgWeeklyUtilization * stats.count) / newCount;
                }
                dayData.totalTokens += stats.totalTokens;
                dayData.recordCount = newCount;
            }
            return result;
        };
        const thisWeekMap = aggregateByDayOfWeek(thisWeekResult.data);
        const lastWeekMap = aggregateByDayOfWeek(lastWeekResult.data);
        // 비교 막대 생성 (월~일 순서)
        const bars = [];
        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
            const current = thisWeekMap.get(dayIndex);
            const previous = lastWeekMap.get(dayIndex);
            bars.push({
                label: dayNames[dayIndex] ?? String(dayIndex),
                currentValue: current?.avgSession ?? 0,
                previousValue: previous?.avgSession ?? 0,
                isSelected: false,
                currentData: current,
                previousData: previous,
            });
        }
        return bars;
    }
    /**
     * 현재 N주 vs 이전 N주 비교 데이터 집계
     */
    async fetchCompareWeeklyBars(weeksCount) {
        const bars = [];
        // 현재 N주 범위: 0, -1, -2, ..., -(N-1)
        // 이전 N주 범위: -N, -(N+1), ..., -(2N-1)
        for (let i = weeksCount - 1; i >= 0; i--) {
            const currentOffset = -i;
            const previousOffset = -i - weeksCount;
            const currentRange = getWeekDateRange(currentOffset);
            const previousRange = getWeekDateRange(previousOffset);
            const [currentResult, previousResult] = await Promise.all([
                readHistoryData(currentRange.startDate, currentRange.endDate),
                readHistoryData(previousRange.startDate, previousRange.endDate),
            ]);
            const currentRecords = currentResult.data.flatMap((d) => d.records);
            const previousRecords = previousResult.data.flatMap((d) => d.records);
            const currentStats = calculateStats(currentRecords);
            const previousStats = calculateStats(previousRecords);
            const { week } = getISOWeek(new Date(currentRange.startDate));
            const currentWeeklyData = {
                weekNum: week,
                weekLabel: `W${String(week).padStart(2, '0')}`,
                startDate: currentRange.startDate,
                endDate: currentRange.endDate,
                avgSession: currentStats.avgSessionUtilization,
                avgWeekly: currentStats.avgWeeklyUtilization,
                totalTokens: currentStats.totalTokens,
                totalCostUsd: calculateTotalCost(currentRecords).totalCostUsd,
                recordCount: currentStats.count,
            };
            const { week: prevWeek } = getISOWeek(new Date(previousRange.startDate));
            const previousWeeklyData = {
                weekNum: prevWeek,
                weekLabel: `W${String(prevWeek).padStart(2, '0')}`,
                startDate: previousRange.startDate,
                endDate: previousRange.endDate,
                avgSession: previousStats.avgSessionUtilization,
                avgWeekly: previousStats.avgWeeklyUtilization,
                totalTokens: previousStats.totalTokens,
                totalCostUsd: calculateTotalCost(previousRecords).totalCostUsd,
                recordCount: previousStats.count,
            };
            bars.push({
                label: currentWeeklyData.weekLabel,
                currentValue: currentStats.avgSessionUtilization,
                previousValue: previousStats.avgSessionUtilization,
                isSelected: false,
                currentData: currentWeeklyData,
                previousData: previousWeeklyData,
            });
        }
        return bars;
    }
    /**
     * 현재 N개월 vs 이전 N개월 비교 데이터 집계
     */
    async fetchCompareMonthlyBars(monthsCount) {
        const bars = [];
        const monthNames = t('histogram.monthNames').split(',');
        // 현재 N개월 범위: 0, -1, -2, ..., -(N-1)
        // 이전 N개월 범위: -N, -(N+1), ..., -(2N-1)
        for (let i = monthsCount - 1; i >= 0; i--) {
            const currentOffset = -i;
            const previousOffset = -i - monthsCount;
            const currentRange = getMonthDateRange(currentOffset);
            const previousRange = getMonthDateRange(previousOffset);
            const [currentResult, previousResult] = await Promise.all([
                readHistoryData(currentRange.startDate, currentRange.endDate),
                readHistoryData(previousRange.startDate, previousRange.endDate),
            ]);
            const currentRecords = currentResult.data.flatMap((d) => d.records);
            const previousRecords = previousResult.data.flatMap((d) => d.records);
            const currentStats = calculateStats(currentRecords);
            const previousStats = calculateStats(previousRecords);
            // 현재 월 정보
            const [currentYearStr, currentMonthStr] = currentRange.startDate.split('-');
            const currentYear = parseInt(currentYearStr, 10);
            const currentMonth = parseInt(currentMonthStr, 10);
            const currentMonthLabel = monthNames[currentMonth - 1] ?? `${currentMonth}${t('histogram.monthLabel')}`;
            const currentMonthlyData = {
                year: currentYear,
                month: currentMonth,
                monthLabel: currentMonthLabel,
                avgSession: currentStats.avgSessionUtilization,
                avgWeekly: currentStats.avgWeeklyUtilization,
                totalTokens: currentStats.totalTokens,
                totalCostUsd: calculateTotalCost(currentRecords).totalCostUsd,
                recordCount: currentStats.count,
            };
            // 이전 월 정보
            const [previousYearStr, previousMonthStr] = previousRange.startDate.split('-');
            const previousYear = parseInt(previousYearStr, 10);
            const previousMonth = parseInt(previousMonthStr, 10);
            const previousMonthLabel = monthNames[previousMonth - 1] ?? `${previousMonth}${t('histogram.monthLabel')}`;
            const previousMonthlyData = {
                year: previousYear,
                month: previousMonth,
                monthLabel: previousMonthLabel,
                avgSession: previousStats.avgSessionUtilization,
                avgWeekly: previousStats.avgWeeklyUtilization,
                totalTokens: previousStats.totalTokens,
                totalCostUsd: calculateTotalCost(previousRecords).totalCostUsd,
                recordCount: previousStats.count,
            };
            bars.push({
                label: currentMonthlyData.monthLabel,
                currentValue: currentStats.avgSessionUtilization,
                previousValue: previousStats.avgSessionUtilization,
                isSelected: false,
                currentData: currentMonthlyData,
                previousData: previousMonthlyData,
            });
        }
        return bars;
    }
    /**
     * 비교 요약 계산
     */
    calculateCompareSummary(bars) {
        if (bars.length === 0) {
            return {
                currentAvg: 0,
                previousAvg: 0,
                changePercent: 0,
                maxIncrease: null,
                maxDecrease: null,
            };
        }
        // 평균 계산
        const currentSum = bars.reduce((sum, bar) => sum + bar.currentValue, 0);
        const previousSum = bars.reduce((sum, bar) => sum + bar.previousValue, 0);
        const currentAvg = currentSum / bars.length;
        const previousAvg = previousSum / bars.length;
        // 변화율 계산
        let changePercent = 0;
        if (previousAvg > 0) {
            changePercent = ((currentAvg - previousAvg) / previousAvg) * 100;
        }
        else if (currentAvg > 0) {
            changePercent = 100; // 이전 0 → 현재 > 0
        }
        // 최대 증가/감소 항목 찾기
        let maxIncrease = null;
        let maxDecrease = null;
        for (const bar of bars) {
            const change = bar.currentValue - bar.previousValue;
            const barChangePercent = bar.previousValue > 0 ? (change / bar.previousValue) * 100 : change > 0 ? 100 : 0;
            if (change > 0) {
                if (!maxIncrease || barChangePercent > maxIncrease.change) {
                    maxIncrease = { label: bar.label, change: barChangePercent };
                }
            }
            else if (change < 0) {
                if (!maxDecrease || barChangePercent < maxDecrease.change) {
                    maxDecrease = { label: bar.label, change: barChangePercent };
                }
            }
        }
        return {
            currentAvg,
            previousAvg,
            changePercent,
            maxIncrease,
            maxDecrease,
        };
    }
    // ============================================================================
    // 히스토그램 렌더링 함수 (Task 4)
    // ============================================================================
    /**
     * 막대 그래프 렌더링
     */
    renderHistogramBars() {
        if (this.bars.length === 0) {
            return [`  ${colorize(t('histogram.noData'), COLORS.dim)}`];
        }
        const lines = [];
        // Y축과 막대를 함께 렌더링
        const yLabels = ['100%', ' 80%', ' 60%', ' 40%', ' 20%', '  0%'];
        for (let row = 0; row < HISTOGRAM_HEIGHT; row++) {
            let line = `  ${yLabels[row]}│`;
            for (const bar of this.bars) {
                const barHeight = Math.round(bar.value * HISTOGRAM_HEIGHT);
                const rowFromBottom = HISTOGRAM_HEIGHT - row;
                if (rowFromBottom <= barHeight) {
                    // 막대가 이 높이까지 차 있음
                    const char = bar.isSelected ? '██' : '▓▓';
                    if (bar.value >= 0.8 && bar.isSelected) {
                        // 80% 이상 + 선택: bold yellow (경고 + 선택 동시 표현)
                        line += colorize(char, COLORS.yellow, COLORS.bold);
                    }
                    else if (bar.value >= 0.8) {
                        line += colorize(char, COLORS.yellow);
                    }
                    else if (bar.isSelected) {
                        line += colorize(char, COLORS.cyan);
                    }
                    else {
                        line += colorize(char, COLORS.green);
                    }
                }
                else {
                    line += '  ';
                }
                line += '  '; // 막대 간격
            }
            lines.push(line);
        }
        // X축 (하단 선)
        const xAxisWidth = this.bars.length * BAR_WIDTH;
        lines.push(`  ${'     '}└${'─'.repeat(xAxisWidth + 2)}`);
        // X축 레이블 (시각적 너비 기준 정렬)
        let labelLine = '       ';
        for (const bar of this.bars) {
            const label = visualPadEnd(bar.label, BAR_WIDTH);
            if (bar.isSelected) {
                labelLine += colorize(label, COLORS.cyan, COLORS.bold);
            }
            else {
                labelLine += label;
            }
        }
        lines.push(labelLine);
        return lines;
    }
    // ============================================================================
    // 비교 모드 렌더링 함수 (Story 11.6 Task 4)
    // ============================================================================
    /**
     * 비교 모드 막대 그래프 렌더링 (오버레이)
     */
    renderCompareHistogramBars() {
        if (this.compareBars.length === 0) {
            return [`  ${colorize(t('histogram.noCompareData'), COLORS.dim)}`];
        }
        const lines = [];
        // 범례 추가
        lines.push(...this.renderCompareLegend());
        lines.push('');
        // Y축과 막대를 함께 렌더링
        const yLabels = ['100%', ' 80%', ' 60%', ' 40%', ' 20%', '  0%'];
        for (let row = 0; row < HISTOGRAM_HEIGHT; row++) {
            let line = `  ${yLabels[row]}│`;
            for (const bar of this.compareBars) {
                const currentHeight = Math.round(bar.currentValue * HISTOGRAM_HEIGHT);
                const previousHeight = Math.round(bar.previousValue * HISTOGRAM_HEIGHT);
                const rowFromBottom = HISTOGRAM_HEIGHT - row;
                const currentInRange = rowFromBottom <= currentHeight;
                const previousInRange = rowFromBottom <= previousHeight;
                let char;
                if (currentInRange && previousInRange) {
                    // 둘 다 채워진 영역: 혼합 표시
                    char = '▓▓';
                }
                else if (currentInRange) {
                    // 현재만 채워진 영역
                    char = '██';
                }
                else if (previousInRange) {
                    // 이전만 채워진 영역
                    char = '░░';
                }
                else {
                    // 빈 영역
                    char = '  ';
                }
                // 색상 적용
                if (char !== '  ') {
                    if (bar.isSelected) {
                        char = colorize(char, COLORS.cyan, COLORS.bold);
                    }
                    else if (currentInRange && !previousInRange) {
                        char = colorize(char, COLORS.green);
                    }
                    else if (previousInRange && !currentInRange) {
                        char = colorize(char, COLORS.dim);
                    }
                    else {
                        // 혼합: 기본 색상
                        char = colorize(char, COLORS.yellow);
                    }
                }
                line += char;
                line += '  '; // 막대 간격
            }
            lines.push(line);
        }
        // X축 (하단 선)
        const xAxisWidth = this.compareBars.length * BAR_WIDTH;
        lines.push(`  ${'     '}└${'─'.repeat(xAxisWidth + 2)}`);
        // X축 레이블 (시각적 너비 기준 정렬)
        let labelLine = '       ';
        for (const bar of this.compareBars) {
            const label = visualPadEnd(bar.label, BAR_WIDTH);
            if (bar.isSelected) {
                labelLine += colorize(label, COLORS.cyan, COLORS.bold);
            }
            else {
                labelLine += label;
            }
        }
        lines.push(labelLine);
        return lines;
    }
    /**
     * 비교 모드별 기간 레이블 반환 (헬퍼 함수)
     */
    getComparePeriodLabels() {
        switch (this.compareMode) {
            case 'hourly':
                return { current: t('histogram.today'), previous: t('histogram.yesterday') };
            case 'daily':
            case 'weekly':
                return { current: t('histogram.thisWeek'), previous: t('histogram.lastWeek') };
            case 'monthly':
                return { current: t('compare.thisMonth'), previous: t('compare.lastMonth') };
        }
    }
    /**
     * 비교 모드 범례 렌더링
     */
    renderCompareLegend() {
        const lines = [];
        const { current: currentPeriod, previous: previousPeriod } = this.getComparePeriodLabels();
        const currentLabel = t('histogram.legendCurrent').replace('{period}', currentPeriod);
        const previousLabel = t('histogram.legendPrevious').replace('{period}', previousPeriod);
        lines.push(`  ${colorize('░░', COLORS.dim)} ${previousLabel}  ${colorize('██', COLORS.green)} ${currentLabel}`);
        return lines;
    }
    // ============================================================================
    // 비교 요약 렌더링 (Story 11.6 Task 5)
    // ============================================================================
    /**
     * 비교 요약 정보 렌더링
     */
    renderCompareSummary() {
        const lines = [];
        if (!this.compareSummary) {
            return lines;
        }
        lines.push('');
        lines.push(colorize('  ' + '─'.repeat(SEPARATOR_WIDTH), COLORS.dim));
        lines.push('');
        const summary = this.compareSummary;
        // 평균 변화 표시
        const prevPercent = Math.round(summary.previousAvg * 100);
        const currPercent = Math.round(summary.currentAvg * 100);
        const changeSign = summary.changePercent >= 0 ? '↑' : '↓';
        const changeAbs = Math.abs(summary.changePercent).toFixed(1);
        const changeColor = summary.changePercent >= 0 ? COLORS.green : COLORS.red;
        const avgChangeText = t('histogram.compareAvgChange')
            .replace('{previous}', String(prevPercent))
            .replace('{current}', String(currPercent))
            .replace('{change}', colorize(`${changeSign} ${changeAbs}%`, changeColor));
        lines.push(`  ${avgChangeText}`);
        // 최대 증가 항목
        if (summary.maxIncrease) {
            const increaseText = `${t('histogram.maxIncrease')}: ${summary.maxIncrease.label} (+${summary.maxIncrease.change.toFixed(1)}%)`;
            lines.push(`  ${colorize(increaseText, COLORS.green)}`);
        }
        // 최대 감소 항목
        if (summary.maxDecrease) {
            const decreaseText = `${t('histogram.maxDecrease')}: ${summary.maxDecrease.label} (${summary.maxDecrease.change.toFixed(1)}%)`;
            lines.push(`  ${colorize(decreaseText, COLORS.red)}`);
        }
        return lines;
    }
    /**
     * 선택된 막대 비교 상세 렌더링
     */
    renderCompareSelectedDetail() {
        const lines = [];
        const bar = this.compareBars[this.selectedIndex];
        if (!bar) {
            return lines;
        }
        lines.push('');
        lines.push(colorize('  ' + '─'.repeat(SEPARATOR_WIDTH), COLORS.dim));
        // 선택된 막대 레이블
        lines.push(colorize(`  ${bar.label}`, COLORS.yellow, COLORS.bold));
        lines.push('');
        // 현재 vs 이전 비교
        const currPercent = Math.round(bar.currentValue * 100);
        const prevPercent = Math.round(bar.previousValue * 100);
        // 현재 프로그레스 바
        const currBar = createProgressBar(bar.currentValue, PROGRESS_BAR_WIDTH);
        const prevBar = createProgressBar(bar.previousValue, PROGRESS_BAR_WIDTH);
        // 기간 레이블
        const { current: currentPeriod, previous: previousPeriod } = this.getComparePeriodLabels();
        lines.push(`  ${previousPeriod}: ${prevBar} ${prevPercent}%`);
        lines.push(`  ${currentPeriod}: ${currBar} ${currPercent}%`);
        // 변화율
        if (bar.previousValue > 0) {
            const change = ((bar.currentValue - bar.previousValue) / bar.previousValue) * 100;
            const changeSign = change >= 0 ? '↑' : '↓';
            const changeAbs = Math.abs(change).toFixed(1);
            const changeColor = change >= 0 ? COLORS.green : COLORS.red;
            lines.push(`  ${t('compare.change')}: ${colorize(`${changeSign} ${changeAbs}%`, changeColor)}`);
        }
        else if (bar.currentValue > 0) {
            lines.push(`  ${t('compare.change')}: ${colorize(t('histogram.newData'), COLORS.green)}`);
        }
        return lines;
    }
    /**
     * 선택된 막대 상세 정보 렌더링
     */
    renderSelectedDetail() {
        const lines = [];
        const bar = this.bars[this.selectedIndex];
        if (!bar || !bar.data) {
            return lines;
        }
        lines.push('');
        lines.push(colorize('  ' + '─'.repeat(SEPARATOR_WIDTH), COLORS.dim));
        const data = bar.data;
        if (this.isHourlyData(data)) {
            // 시간별 상세
            // NOTE: 시간별 모드는 트렌드 미표시 (주별/월별만 트렌드 표시)
            // 향후 "vs 지난시간" 트렌드 추가 가능
            lines.push(colorize(`  ${data.hour}:00 ${t('histogram.hourLabel')}`, COLORS.yellow, COLORS.bold));
            lines.push('');
            // 세션/주간 사용률 프로그레스 바
            const sessionBar = createProgressBar(data.avgSession, PROGRESS_BAR_WIDTH);
            const weeklyBar = createProgressBar(data.avgWeekly, PROGRESS_BAR_WIDTH);
            const sessionPercent = `${Math.round(data.avgSession * 100)}%`;
            const weeklyPercent = `${Math.round(data.avgWeekly * 100)}%`;
            lines.push(`  ${t('histogram.avgSession')}: ${sessionBar} ${sessionPercent}`);
            lines.push(`  ${t('histogram.avgWeekly')}: ${weeklyBar} ${weeklyPercent}`);
            lines.push(`  ${t('histogram.totalTokens')}: ${data.totalTokens.toLocaleString()}`);
        }
        else if (this.isWeeklyData(data)) {
            // 주별 상세
            lines.push(colorize(`  ${data.weekLabel} (${data.startDate} ~ ${data.endDate})`, COLORS.yellow, COLORS.bold));
            lines.push('');
            const sessionBar = createProgressBar(data.avgSession, PROGRESS_BAR_WIDTH);
            const weeklyBar = createProgressBar(data.avgWeekly, PROGRESS_BAR_WIDTH);
            const sessionPercent = `${Math.round(data.avgSession * 100)}%`;
            const weeklyPercent = `${Math.round(data.avgWeekly * 100)}%`;
            lines.push(`  ${t('histogram.avgSession')}: ${sessionBar} ${sessionPercent}`);
            lines.push(`  ${t('histogram.avgWeekly')}: ${weeklyBar} ${weeklyPercent}`);
            lines.push(`  ${t('histogram.totalTokens')}: ${data.totalTokens.toLocaleString()}`);
            lines.push(`  ${t('histogram.estimatedCost')}: $${data.totalCostUsd.toFixed(2)}`);
            // 변화율 (이전 주와 비교)
            if (this.selectedIndex > 0) {
                const prevBar = this.bars[this.selectedIndex - 1];
                if (prevBar?.data && this.isWeeklyData(prevBar.data)) {
                    const trend = calculateTrend(data.avgSession, prevBar.data.avgSession);
                    lines.push(`  ${this.formatTrendLine(trend, t('histogram.weekLabel'))}`);
                }
            }
        }
        else if (this.isMonthlyData(data)) {
            // 월별 상세 (yearFormat 사용: 한국어 "{year}년 {month}", 영어 "{month} {year}")
            const yearMonthLabel = t('histogram.yearFormat')
                .replace('{year}', String(data.year))
                .replace('{month}', data.monthLabel);
            lines.push(colorize(`  ${yearMonthLabel}`, COLORS.yellow, COLORS.bold));
            lines.push('');
            const sessionBar = createProgressBar(data.avgSession, PROGRESS_BAR_WIDTH);
            const weeklyBar = createProgressBar(data.avgWeekly, PROGRESS_BAR_WIDTH);
            const sessionPercent = `${Math.round(data.avgSession * 100)}%`;
            const weeklyPercent = `${Math.round(data.avgWeekly * 100)}%`;
            lines.push(`  ${t('histogram.avgSession')}: ${sessionBar} ${sessionPercent}`);
            lines.push(`  ${t('histogram.avgWeekly')}: ${weeklyBar} ${weeklyPercent}`);
            lines.push(`  ${t('histogram.totalTokens')}: ${data.totalTokens.toLocaleString()}`);
            lines.push(`  ${t('histogram.estimatedCost')}: $${data.totalCostUsd.toFixed(2)}`);
            // 변화율 (이전 달과 비교)
            if (this.selectedIndex > 0) {
                const prevBar = this.bars[this.selectedIndex - 1];
                if (prevBar?.data && this.isMonthlyData(prevBar.data)) {
                    const trend = calculateTrend(data.avgSession, prevBar.data.avgSession);
                    lines.push(`  ${this.formatTrendLine(trend, t('histogram.monthLabel'))}`);
                }
            }
        }
        return lines;
    }
    /**
     * 트렌드 라인 포맷팅
     */
    formatTrendLine(trend, periodLabel) {
        const vsLabel = t('histogram.vsLast').replace('{period}', periodLabel);
        if (trend.changePercent === null) {
            return `${vsLabel}: ${colorize('-', COLORS.dim)}`;
        }
        const percent = Math.abs(trend.changePercent).toFixed(1);
        if (trend.changePercent > 0) {
            return `${vsLabel}: ${colorize(`↑ ${percent}%`, COLORS.green)}`;
        }
        else if (trend.changePercent < 0) {
            return `${vsLabel}: ${colorize(`↓ ${percent}%`, COLORS.red)}`;
        }
        else {
            return `${vsLabel}: ${colorize('→ 0%', COLORS.dim)}`;
        }
    }
    /**
     * 타입 가드: HourlyData
     */
    isHourlyData(data) {
        return 'hour' in data;
    }
    /**
     * 타입 가드: WeeklyData
     */
    isWeeklyData(data) {
        return 'weekNum' in data;
    }
    /**
     * 타입 가드: MonthlyData
     */
    isMonthlyData(data) {
        return 'month' in data && !('weekNum' in data);
    }
    // ============================================================================
    // Component 메서드
    // ============================================================================
    /**
     * 렌더링
     */
    render() {
        // 비교 모드일 때는 비교 렌더링 사용
        if (this.isCompareMode) {
            return this.renderCompare();
        }
        const lines = [];
        // 헤더 (시각적 너비 기준 정렬)
        const title = t('histogram.title');
        const backHint = `[Tab ${t('histogram.keyBack')}]`;
        const titleWidth = getVisualWidth(title);
        const hintWidth = getVisualWidth(backHint);
        const paddingWidth = Math.max(0, HEADER_WIDTH - titleWidth - hintWidth - 6);
        const headerLine = `  📊 ${title}${' '.repeat(paddingWidth)}${backHint}`;
        lines.push(colorize(headerLine, COLORS.bold, COLORS.cyan));
        lines.push('');
        // 모드 선택
        const modeLabels = [
            this.mode === 'hourly'
                ? colorize(`[${t('histogram.modeHourly')}]`, COLORS.cyan, COLORS.bold)
                : t('histogram.modeHourly'),
            this.mode === 'weekly'
                ? colorize(`[${t('histogram.modeWeekly')}]`, COLORS.cyan, COLORS.bold)
                : t('histogram.modeWeekly'),
            this.mode === 'monthly'
                ? colorize(`[${t('histogram.modeMonthly')}]`, COLORS.cyan, COLORS.bold)
                : t('histogram.modeMonthly'),
        ];
        lines.push(`  ${t('histogram.keyMode')}: ${modeLabels.join('  ')}  ← 1, 2, 3`);
        // 날짜/범위 표시
        let rangeLabel;
        if (this.mode === 'hourly') {
            rangeLabel = `[◀ ${this.currentDate} ▶]`;
        }
        else if (this.mode === 'weekly') {
            rangeLabel = `[◀ ${t('histogram.recentWeeks').replace('{count}', String(this.weekCount))} ▶]`;
        }
        else {
            rangeLabel = `[◀ ${t('histogram.recentMonths').replace('{count}', String(this.monthCount))} ▶]`;
        }
        lines.push(`  ${rangeLabel}`);
        lines.push('');
        // 로딩 상태
        if (this.isLoading) {
            lines.push(colorize(`  ${t('histogram.loading')}`, COLORS.dim));
            return lines;
        }
        // 에러 상태
        if (this.error) {
            lines.push(colorize(`  ${t('histogram.loadError')}: ${this.error}`, COLORS.red));
            return lines;
        }
        // 히스토그램 그래프
        lines.push(...this.renderHistogramBars());
        // 선택된 막대 상세 정보
        lines.push(...this.renderSelectedDetail());
        return lines;
    }
    /**
     * 비교 모드 렌더링 (Story 11.6)
     */
    renderCompare() {
        const lines = [];
        // 헤더 (비교 모드)
        const title = t('histogram.compareMode');
        const backHint = `[c: ${t('histogram.exitCompare')}]`;
        const titleWidth = getVisualWidth(title);
        const hintWidth = getVisualWidth(backHint);
        const paddingWidth = Math.max(0, HEADER_WIDTH - titleWidth - hintWidth - 6);
        const headerLine = `  📊 ${title}${' '.repeat(paddingWidth)}${backHint}`;
        lines.push(colorize(headerLine, COLORS.bold, COLORS.cyan));
        lines.push('');
        // 비교 모드 선택 (1: 시간별, 2: 요일별, 3: 주별, 4: 월별)
        const modeLabels = [
            this.compareMode === 'hourly'
                ? colorize(`[${t('histogram.modeHourly')}]`, COLORS.cyan, COLORS.bold)
                : t('histogram.modeHourly'),
            this.compareMode === 'daily'
                ? colorize(`[${t('histogram.modeDaily')}]`, COLORS.cyan, COLORS.bold)
                : t('histogram.modeDaily'),
            this.compareMode === 'weekly'
                ? colorize(`[${t('histogram.modeWeekly')}]`, COLORS.cyan, COLORS.bold)
                : t('histogram.modeWeekly'),
            this.compareMode === 'monthly'
                ? colorize(`[${t('histogram.modeMonthly')}]`, COLORS.cyan, COLORS.bold)
                : t('histogram.modeMonthly'),
        ];
        lines.push(`  ${t('histogram.keyMode')}: ${modeLabels.join('  ')}  ← 1, 2, 3, 4`);
        lines.push('');
        // 로딩 상태
        if (this.isLoading) {
            lines.push(colorize(`  ${t('histogram.loading')}`, COLORS.dim));
            return lines;
        }
        // 에러 상태
        if (this.error) {
            lines.push(colorize(`  ${t('histogram.loadError')}: ${this.error}`, COLORS.red));
            return lines;
        }
        // 비교 히스토그램 그래프
        lines.push(...this.renderCompareHistogramBars());
        // 비교 요약 정보
        lines.push(...this.renderCompareSummary());
        // 선택된 막대 비교 상세
        lines.push(...this.renderCompareSelectedDetail());
        return lines;
    }
    /**
     * 키 처리
     */
    handleKey(event) {
        // 'c' 키: 비교 모드 토글
        if (event.name === 'c') {
            this.toggleCompareMode();
            return true;
        }
        // 비교 모드일 때 키 처리
        if (this.isCompareMode) {
            return this.handleCompareKey(event);
        }
        // 일반 모드 키 처리
        switch (event.name) {
            case '1':
                if (this.mode !== 'hourly') {
                    this.setMode('hourly');
                }
                return true;
            case '2':
                if (this.mode !== 'weekly') {
                    this.setMode('weekly');
                }
                return true;
            case '3':
                if (this.mode !== 'monthly') {
                    this.setMode('monthly');
                }
                return true;
            case 'left':
                if (this.selectedIndex > 0) {
                    this.selectedIndex--;
                    this.updateSelectedBar();
                    this.markDirty();
                }
                return true;
            case 'right':
                if (this.selectedIndex < this.bars.length - 1) {
                    this.selectedIndex++;
                    this.updateSelectedBar();
                    this.markDirty();
                }
                return true;
            case 'up':
                this.handleRangeChange(-1);
                return true;
            case 'down':
                this.handleRangeChange(1);
                return true;
            case 'tab':
                this.callbacks.onBack?.();
                return true;
            case 'escape':
            case 'q':
                this.callbacks.onExit?.();
                return true;
            default:
                return false;
        }
    }
    /**
     * 비교 모드 키 처리 (Story 11.6)
     */
    handleCompareKey(event) {
        switch (event.name) {
            case '1':
                if (this.compareMode !== 'hourly') {
                    this.setCompareMode('hourly');
                }
                return true;
            case '2':
                if (this.compareMode !== 'daily') {
                    this.setCompareMode('daily');
                }
                return true;
            case '3':
                if (this.compareMode !== 'weekly') {
                    this.setCompareMode('weekly');
                }
                return true;
            case '4':
                if (this.compareMode !== 'monthly') {
                    this.setCompareMode('monthly');
                }
                return true;
            case 'left':
                if (this.selectedIndex > 0) {
                    this.selectedIndex--;
                    this.updateCompareSelectedBar();
                    this.markDirty();
                }
                return true;
            case 'right':
                if (this.selectedIndex < this.compareBars.length - 1) {
                    this.selectedIndex++;
                    this.updateCompareSelectedBar();
                    this.markDirty();
                }
                return true;
            case 'up':
                this.handleCompareRangeChange(-1);
                return true;
            case 'down':
                this.handleCompareRangeChange(1);
                return true;
            case 'tab':
                this.callbacks.onBack?.();
                return true;
            case 'escape':
            case 'q':
                this.callbacks.onExit?.();
                return true;
            default:
                return false;
        }
    }
    /**
     * 비교 모드 범위 변경 처리 (Story 11.6)
     */
    handleCompareRangeChange(delta) {
        if (this.compareMode === 'weekly') {
            const newCount = this.weekCount - delta;
            if (newCount >= MIN_RANGE && newCount <= MAX_RANGE) {
                this.weekCount = newCount;
                this.loadCompareData();
            }
        }
        else if (this.compareMode === 'monthly') {
            const newCount = this.monthCount - delta;
            if (newCount >= MIN_RANGE && newCount <= MAX_RANGE) {
                this.monthCount = newCount;
                this.loadCompareData();
            }
        }
        // hourly와 daily는 범위 변경 없음 (오늘vs어제, 이번주vs지난주 고정)
    }
    /**
     * 범위 변경 처리
     */
    handleRangeChange(delta) {
        if (this.mode === 'hourly') {
            // 시간별: 날짜 변경
            const [year, month, day] = this.currentDate.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            date.setDate(date.getDate() + delta);
            this.currentDate = formatDateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
            this.loadHistogramData();
        }
        else if (this.mode === 'weekly') {
            // 주별: 범위 확장/축소
            const newCount = this.weekCount - delta; // up: 확장, down: 축소
            if (newCount >= MIN_RANGE && newCount <= MAX_RANGE) {
                this.weekCount = newCount;
                this.loadHistogramData();
            }
        }
        else if (this.mode === 'monthly') {
            // 월별: 범위 확장/축소
            const newCount = this.monthCount - delta;
            if (newCount >= MIN_RANGE && newCount <= MAX_RANGE) {
                this.monthCount = newCount;
                this.loadHistogramData();
            }
        }
    }
    /**
     * 현재 모드 반환 (테스트용)
     */
    getMode() {
        return this.mode;
    }
    /**
     * 현재 선택 인덱스 반환 (테스트용)
     */
    getSelectedIndex() {
        return this.selectedIndex;
    }
    /**
     * 현재 막대 데이터 반환 (테스트용)
     */
    getBars() {
        return this.bars;
    }
    /**
     * 로딩 상태 반환 (테스트용)
     */
    getIsLoading() {
        return this.isLoading;
    }
    /**
     * 에러 상태 반환 (테스트용)
     */
    getError() {
        return this.error;
    }
    /**
     * 현재 날짜 반환 (테스트용)
     */
    getCurrentDate() {
        return this.currentDate;
    }
    /**
     * 주 수 반환 (테스트용)
     */
    getWeekCount() {
        return this.weekCount;
    }
    /**
     * 월 수 반환 (테스트용)
     */
    getMonthCount() {
        return this.monthCount;
    }
    // ============================================================================
    // Story 11.6: 비교 모드 테스트용 getter
    // ============================================================================
    /**
     * 비교 모드 활성화 여부 반환 (테스트용)
     */
    getIsCompareMode() {
        return this.isCompareMode;
    }
    /**
     * 현재 비교 모드 반환 (테스트용)
     */
    getCompareMode() {
        return this.compareMode;
    }
    /**
     * 비교 막대 데이터 반환 (테스트용)
     */
    getCompareBars() {
        return this.compareBars;
    }
    /**
     * 비교 요약 반환 (테스트용)
     */
    getCompareSummary() {
        return this.compareSummary;
    }
}
