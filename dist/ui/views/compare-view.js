/**
 * 기간 비교 뷰 컴포넌트 (Story 11.4)
 *
 * 두 기간의 사용량을 비교하여 표시합니다.
 */
import { Component } from '../component.js';
import { COLORS, colorize } from '../renderer.js';
import { createProgressBar } from '../../display/formatter.js';
import { getWeekDateRange, getMonthDateRange, calculatePeriodComparison, } from '../calendar-utils.js';
import { readHistoryData } from '../../storage/reader.js';
import { t } from '../../utils/i18n.js';
/** 헤더 영역 너비 */
const HEADER_WIDTH = 56;
/** 구분선 너비 */
const SEPARATOR_WIDTH = 52;
/** 프로그레스 바 너비 */
const PROGRESS_BAR_WIDTH = 25;
/**
 * 기간 비교 뷰 컴포넌트
 */
export class CompareViewComponent extends Component {
    mode = 'week';
    callbacks;
    compareResult = null;
    isLoading = true;
    error = null;
    constructor(callbacks) {
        super();
        this.callbacks = callbacks ?? {};
    }
    /**
     * 비교 모드 설정 및 데이터 로드
     */
    setMode(mode) {
        this.mode = mode;
        this.markDirty();
    }
    /**
     * 모드 전환 (week ↔ month)
     */
    toggleMode() {
        this.mode = this.mode === 'week' ? 'month' : 'week';
        this.loadCompareData();
    }
    /**
     * 비동기 데이터 로딩
     */
    async loadCompareData() {
        this.isLoading = true;
        this.error = null;
        this.markDirty();
        try {
            let currentPeriod;
            let previousPeriod;
            if (this.mode === 'week') {
                const currentRange = getWeekDateRange(0);
                const previousRange = getWeekDateRange(-1);
                currentPeriod = { ...currentRange, label: t('compare.thisWeek') };
                previousPeriod = { ...previousRange, label: t('compare.lastWeek') };
            }
            else {
                const currentRange = getMonthDateRange(0);
                const previousRange = getMonthDateRange(-1);
                currentPeriod = { ...currentRange, label: t('compare.thisMonth') };
                previousPeriod = { ...previousRange, label: t('compare.lastMonth') };
            }
            // 데이터 읽기
            const currentResult = await readHistoryData(currentPeriod.startDate, currentPeriod.endDate);
            const previousResult = await readHistoryData(previousPeriod.startDate, previousPeriod.endDate);
            // 비교 계산
            this.compareResult = calculatePeriodComparison(currentResult.data, previousResult.data, currentPeriod, previousPeriod);
            this.isLoading = false;
            this.markDirty();
        }
        catch (err) {
            this.error = err instanceof Error ? err.message : String(err);
            this.isLoading = false;
            this.markDirty();
        }
    }
    /**
     * 트렌드 포맷팅
     */
    formatTrend(trend) {
        if (trend.changePercent === null) {
            return colorize(t('compare.notAvailable'), COLORS.dim);
        }
        const percent = Math.abs(trend.changePercent).toFixed(1);
        if (trend.changePercent > 0) {
            return colorize(`${t('compare.increase')} ${percent}%`, COLORS.green);
        }
        else if (trend.changePercent < 0) {
            return colorize(`${t('compare.decrease')} ${percent}%`, COLORS.red);
        }
        else {
            return colorize(t('compare.noChange'), COLORS.dim);
        }
    }
    /**
     * 퍼센트 포맷팅
     */
    formatPercent(value) {
        return `${Math.round(value * 100)}%`;
    }
    /**
     * 토큰 수 포맷팅
     */
    formatTokens(value) {
        return value.toLocaleString();
    }
    /**
     * 비용 포맷팅
     */
    formatCost(value) {
        return `$${value.toFixed(2)}`;
    }
    /**
     * 테이블 행 렌더링
     */
    renderTableRow(label, prevValue, currValue, trend) {
        const labelPad = 12;
        const valuePad = 12;
        const paddedLabel = label.padEnd(labelPad);
        const paddedPrev = prevValue.padStart(valuePad);
        const paddedCurr = currValue.padStart(valuePad);
        return `  ${paddedLabel}${paddedPrev}${paddedCurr}   ${trend}`;
    }
    /**
     * 렌더링
     */
    render() {
        const lines = [];
        // 헤더
        const title = t('compare.title');
        const backHint = `[ESC ${t('compare.keyBack')}]`;
        const headerLine = `  📊 ${title}${' '.repeat(Math.max(0, HEADER_WIDTH - title.length - backHint.length - 6))}${backHint}`;
        lines.push(colorize(headerLine, COLORS.bold, COLORS.cyan));
        lines.push('');
        // 로딩 상태
        if (this.isLoading) {
            lines.push(colorize(`  ${t('compare.loading')}`, COLORS.dim));
            return lines;
        }
        // 에러 상태
        if (this.error) {
            lines.push(colorize(`  Error: ${this.error}`, COLORS.red));
            lines.push('');
            lines.push(`  ${t('compare.keyBack')}: ESC`);
            return lines;
        }
        // 데이터가 없는 경우
        if (!this.compareResult) {
            lines.push(colorize(`  ${t('compare.noData')}`, COLORS.dim));
            return lines;
        }
        const { current, previous, trends } = this.compareResult;
        // 비교 대상 헤더
        const modeLabel = `[${current.period.label}] vs [${previous.period.label}]`;
        lines.push(`  ${modeLabel}        ← Tab ${t('compare.keyToggle')}`);
        lines.push('');
        // 테이블 헤더
        const tableHeader = this.renderTableRow(t('compare.metric'), previous.period.label, current.period.label, t('compare.change'));
        lines.push(colorize(tableHeader, COLORS.yellow));
        lines.push(colorize('  ' + '─'.repeat(SEPARATOR_WIDTH), COLORS.dim));
        // 평균 세션
        lines.push(this.renderTableRow(t('compare.avgSession'), this.formatPercent(previous.avgSession), this.formatPercent(current.avgSession), this.formatTrend(trends.sessionTrend)));
        // 평균 주간
        lines.push(this.renderTableRow(t('compare.avgWeekly'), this.formatPercent(previous.avgWeekly), this.formatPercent(current.avgWeekly), this.formatTrend(trends.weeklyTrend)));
        // 총 토큰
        lines.push(this.renderTableRow(t('compare.totalTokens'), this.formatTokens(previous.totalTokens), this.formatTokens(current.totalTokens), this.formatTrend(trends.tokensTrend)));
        // 예상 비용
        lines.push(this.renderTableRow(t('compare.estimatedCost'), this.formatCost(previous.totalCostUsd), this.formatCost(current.totalCostUsd), this.formatTrend(trends.costTrend)));
        lines.push('');
        // 추이 그래프
        lines.push(colorize(`  ${t('compare.trendGraph')}`, COLORS.yellow));
        lines.push(colorize('  ' + '─'.repeat(SEPARATOR_WIDTH), COLORS.dim));
        // 이전 기간 프로그레스 바
        const prevBar = createProgressBar(previous.avgSession, PROGRESS_BAR_WIDTH);
        const prevPercent = this.formatPercent(previous.avgSession);
        lines.push(`  ${previous.period.label}: ${prevBar} ${prevPercent}`);
        // 현재 기간 프로그레스 바
        const currBar = createProgressBar(current.avgSession, PROGRESS_BAR_WIDTH);
        const currPercent = this.formatPercent(current.avgSession);
        lines.push(`  ${current.period.label}: ${currBar} ${currPercent}`);
        lines.push('');
        // 키 네비게이션 힌트
        lines.push(colorize(`  ${t('compare.keyNav')}`, COLORS.dim));
        return lines;
    }
    /**
     * 키 처리
     */
    handleKey(event) {
        switch (event.name) {
            case 'escape':
            case 'q':
                this.callbacks.onBack?.();
                return true;
            case 'tab':
                this.toggleMode();
                return true;
            default:
                return false;
        }
    }
}
