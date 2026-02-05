/**
 * 일별 상세 뷰 컴포넌트 (Story 11.3)
 *
 * 선택한 날짜의 시간별 사용량을 상세히 보여줍니다.
 */
import { SelectableListComponent } from '../component.js';
import { COLORS, colorize, pad } from '../renderer.js';
import { aggregateHourly, calculateDailySummary } from '../../utils/aggregator.js';
import { createProgressBar } from '../../display/formatter.js';
import { t } from '../../utils/i18n.js';
/**
 * 일별 상세 뷰 컴포넌트
 */
export class DetailViewComponent extends SelectableListComponent {
    /** 헤더 영역 너비 (타이틀 + 키 힌트) */
    static HEADER_WIDTH = 50;
    /** 구분선 너비 */
    static SEPARATOR_WIDTH = 45;
    dateKey;
    dailySummary;
    callbacks;
    isToday;
    currentHour;
    constructor(dateKey, data, callbacks) {
        super();
        this.dateKey = dateKey;
        this.callbacks = callbacks ?? {};
        // 오늘 날짜인지 확인
        const today = new Date();
        const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        this.isToday = dateKey === todayKey;
        this.currentHour = today.getHours();
        // 시간별 집계
        const hourlyData = aggregateHourly(data.records);
        this.setItems(hourlyData);
        // 일별 요약 계산
        this.dailySummary = calculateDailySummary(data.records);
    }
    /**
     * 시간 포맷 (HH:00)
     */
    formatHour(hour) {
        return `${String(hour).padStart(2, '0')}:00`;
    }
    /**
     * 렌더링
     */
    render() {
        const lines = [];
        // 헤더
        const title = t('detail.title', { date: this.dateKey });
        const backHint = `[ESC ${t('detail.keyBack')}]`;
        const headerLine = `  📊 ${title}${' '.repeat(Math.max(0, DetailViewComponent.HEADER_WIDTH - title.length - backHint.length - 6))}${backHint}`;
        lines.push(colorize(headerLine, COLORS.bold, COLORS.cyan));
        lines.push('');
        // 데이터가 없는 경우
        if (this.items.length === 0) {
            lines.push(colorize(t('detail.noData'), COLORS.dim));
            return lines;
        }
        // 시간별 사용량 섹션
        lines.push(colorize(t('detail.hourlyUsage'), COLORS.yellow));
        lines.push(colorize('─'.repeat(DetailViewComponent.SEPARATOR_WIDTH), COLORS.dim));
        // 보이는 아이템만 렌더링 (스크롤)
        const visibleItems = this.getVisibleItems();
        const startIndex = this.scrollOffset;
        for (let i = 0; i < visibleItems.length; i++) {
            const item = visibleItems[i];
            const absoluteIndex = startIndex + i;
            const isSelected = absoluteIndex === this.selectedIndex;
            // 시간 레이블
            const hourLabel = this.formatHour(item.hour);
            // 프로그레스 바 (세션 사용률)
            const progressBar = createProgressBar(item.avgSession, 8);
            const percent = Math.round(item.avgSession * 100);
            const percentStr = pad(`${percent}%`, 4, 'right');
            // 현재 시간 표시
            let suffix = '';
            if (this.isToday && item.hour === this.currentHour) {
                suffix = colorize(` ← ${t('detail.currentHour')}`, COLORS.green);
            }
            // 줄 조합
            let line = `${hourLabel} ${progressBar} ${percentStr}${suffix}`;
            // 선택된 아이템 하이라이트
            if (isSelected) {
                line = colorize(line, COLORS.bgWhite, COLORS.black);
            }
            lines.push(line);
        }
        // 스크롤 인디케이터
        if (this.items.length > this.visibleCount) {
            const scrollInfo = `[${this.selectedIndex + 1}/${this.items.length}]`;
            lines.push(colorize(scrollInfo, COLORS.dim));
        }
        lines.push('');
        // 요약 섹션
        lines.push(colorize('─'.repeat(DetailViewComponent.SEPARATOR_WIDTH), COLORS.dim));
        lines.push(colorize(t('detail.summary'), COLORS.yellow));
        lines.push(colorize('─'.repeat(DetailViewComponent.SEPARATOR_WIDTH), COLORS.dim));
        // 평균 사용률
        const avgPercent = Math.round(this.dailySummary.avgSession * 100);
        lines.push(`${t('detail.avgUsage')}: ${avgPercent}%`);
        // 최고 사용률
        const maxPercent = Math.round(this.dailySummary.maxSession * 100);
        const maxHourStr = this.dailySummary.maxSessionHour >= 0
            ? t('detail.atHour', { hour: this.dailySummary.maxSessionHour })
            : '';
        lines.push(`${t('detail.maxUsage')}: ${maxPercent}% ${maxHourStr}`);
        // 토큰 정보
        const totalTokensStr = this.dailySummary.totalTokens.toLocaleString();
        const inputTokensStr = this.dailySummary.inputTokens.toLocaleString();
        const outputTokensStr = this.dailySummary.outputTokens.toLocaleString();
        lines.push(`${t('detail.totalTokens')}: ${totalTokensStr} (${t('detail.inputTokens')}: ${inputTokensStr} / ${t('detail.outputTokens')}: ${outputTokensStr})`);
        // 예상 비용
        const costStr = `$${this.dailySummary.estimatedCostUsd.toFixed(2)}`;
        lines.push(`${t('detail.estimatedCost')}: ${costStr}`);
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
            default:
                // 기본 방향키 처리 (SelectableListComponent)
                return super.handleKey(event);
        }
    }
}
