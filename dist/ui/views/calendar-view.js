/**
 * 캘린더 뷰 컴포넌트 (Story 11.2)
 *
 * 월별 캘린더를 표시하고 날짜 선택 기능을 제공합니다.
 */
import { GridComponent } from '../component.js';
import { COLORS, colorize, pad } from '../renderer.js';
import { buildCalendarGrid, isToday, formatMonthYear, formatDateKey, getWeekdayHeaders, getMonthRange, } from '../calendar-utils.js';
import { readHistoryData } from '../../storage/reader.js';
import { calculateStats } from '../../utils/aggregator.js';
import { createProgressBar } from '../../display/formatter.js';
import { getCurrentLocale, t } from '../../utils/i18n.js';
import { createApp } from '../app.js';
import { formatKeyHelp } from '../keyboard.js';
import { DetailViewComponent } from './detail-view.js';
import { CompareViewComponent } from './compare-view.js';
import { HistogramViewComponent } from './histogram-view.js';
/**
 * 캘린더 뷰 컴포넌트
 */
export class CalendarComponent extends GridComponent {
    /** 캘린더 박스 너비 */
    static BOX_WIDTH = 32;
    year;
    month;
    dataDates = new Set();
    callbacks;
    selectedDayStats = null;
    dataCache = new Map();
    constructor(callbacks) {
        super();
        this.callbacks = callbacks ?? {};
        // 오늘 날짜로 초기화
        const today = new Date();
        this.year = today.getFullYear();
        this.month = today.getMonth() + 1;
        this.rebuildGrid();
        // 오늘 날짜가 있으면 오늘로 선택 이동
        this.moveToToday();
    }
    /**
     * 그리드 재생성
     */
    rebuildGrid() {
        const grid = buildCalendarGrid(this.year, this.month);
        const cells = grid.map((row) => row.map((day) => ({
            day,
            isToday: day !== null && isToday(this.year, this.month, day),
            hasData: day !== null &&
                this.dataDates.has(formatDateKey(this.year, this.month, day)),
        })));
        this.setItems(cells);
        // 첫 번째 유효한 날짜로 선택 이동
        this.moveToFirstValidDay();
    }
    /**
     * 첫 번째 유효한 날짜로 선택 이동
     */
    moveToFirstValidDay() {
        for (let row = 0; row < this.items.length; row++) {
            for (let col = 0; col < this.items[row].length; col++) {
                if (this.items[row][col].day !== null) {
                    this.selectedRow = row;
                    this.selectedCol = col;
                    return;
                }
            }
        }
    }
    /**
     * 오늘 날짜로 선택 이동 (현재 월에 오늘이 있는 경우)
     */
    moveToToday() {
        for (let row = 0; row < this.items.length; row++) {
            for (let col = 0; col < this.items[row].length; col++) {
                if (this.items[row][col].isToday) {
                    this.selectedRow = row;
                    this.selectedCol = col;
                    return;
                }
            }
        }
    }
    /**
     * 월 설정 및 그리드 재생성
     * @param year 연도
     * @param month 월 (1-12)
     * @throws RangeError month가 1-12 범위를 벗어난 경우
     */
    setMonth(year, month) {
        if (month < 1 || month > 12) {
            throw new RangeError(`month must be between 1 and 12, got ${month}`);
        }
        this.year = year;
        this.month = month;
        this.rebuildGrid();
        this.markDirty();
    }
    /**
     * 이전 월로 이동
     */
    prevMonth() {
        if (this.month === 1) {
            this.year--;
            this.month = 12;
        }
        else {
            this.month--;
        }
        this.rebuildGrid();
        this.callbacks.onMonthChange?.(this.year, this.month);
        this.markDirty();
    }
    /**
     * 다음 월로 이동
     */
    nextMonth() {
        if (this.month === 12) {
            this.year++;
            this.month = 1;
        }
        else {
            this.month++;
        }
        this.rebuildGrid();
        this.callbacks.onMonthChange?.(this.year, this.month);
        this.markDirty();
    }
    /**
     * 데이터 있는 날짜 설정
     */
    setDataDates(dates) {
        this.dataDates = dates;
        this.rebuildGrid();
        this.markDirty();
    }
    /**
     * 선택된 날짜의 통계 설정
     */
    setSelectedStats(stats) {
        this.selectedDayStats = stats;
        this.markDirty();
    }
    /**
     * 현재 선택된 날짜 키 반환
     */
    getSelectedDateKey() {
        const cell = this.getSelectedItem();
        if (!cell || cell.day === null) {
            return null;
        }
        return formatDateKey(this.year, this.month, cell.day);
    }
    /**
     * 현재 연/월 반환
     */
    getYearMonth() {
        return { year: this.year, month: this.month };
    }
    /**
     * 특정 날짜의 데이터 반환 (캐시에서)
     * @param dateKey - "YYYY-MM-DD" 형식
     * @returns DailyUsageFile 또는 null (데이터 없음)
     */
    getDayData(dateKey) {
        const cacheKey = this.getCacheKey(this.year, this.month);
        const cached = this.dataCache.get(cacheKey);
        if (!cached) {
            return null;
        }
        const dayData = cached.data.find((f) => f.date === dateKey);
        return dayData ?? null;
    }
    /**
     * 캐시 키 생성
     */
    getCacheKey(year, month) {
        return `${year}-${String(month).padStart(2, '0')}`;
    }
    /**
     * 월 데이터 로드 (캐싱)
     */
    async loadMonthData(year, month) {
        const cacheKey = this.getCacheKey(year, month);
        // 캐시 히트
        if (this.dataCache.has(cacheKey)) {
            const cached = this.dataCache.get(cacheKey);
            this.setDataDates(cached.dataDates);
            this.updateSelectedStats();
            return;
        }
        // 데이터 로드
        try {
            const { startDate, endDate } = getMonthRange(year, month);
            const result = await readHistoryData(startDate, endDate);
            // 데이터 있는 날짜 추출
            const dataDates = new Set();
            for (const file of result.data) {
                if (file.records.length > 0) {
                    dataDates.add(file.date);
                }
            }
            // 캐시 저장
            this.dataCache.set(cacheKey, { data: result.data, dataDates });
            this.setDataDates(dataDates);
            this.updateSelectedStats();
        }
        catch (error) {
            // 에러 발생 시 빈 데이터로 처리 (콘솔에 경고 로그)
            console.warn('[CalendarComponent] Failed to load month data:', error);
            this.setDataDates(new Set());
            this.updateSelectedStats();
        }
    }
    /**
     * 선택된 날짜의 통계 업데이트
     */
    updateSelectedStats() {
        const dateKey = this.getSelectedDateKey();
        if (!dateKey) {
            this.setSelectedStats(null);
            return;
        }
        const cacheKey = this.getCacheKey(this.year, this.month);
        const cached = this.dataCache.get(cacheKey);
        if (!cached) {
            this.setSelectedStats(null);
            return;
        }
        // 해당 날짜의 파일 찾기
        const dayFile = cached.data.find((f) => f.date === dateKey);
        if (!dayFile || dayFile.records.length === 0) {
            this.setSelectedStats(null);
            return;
        }
        this.setSelectedStats(calculateStats(dayFile.records));
    }
    /**
     * 렌더링
     */
    render() {
        const lines = [];
        const locale = getCurrentLocale();
        // 헤더 (월/년)
        const header = formatMonthYear(this.year, this.month, locale);
        const headerLine = `  ◀  ${header}  ▶  `;
        lines.push(colorize(pad(headerLine, CalendarComponent.BOX_WIDTH, 'center'), COLORS.bold, COLORS.cyan));
        lines.push('');
        // 요일 헤더
        const weekdays = getWeekdayHeaders(locale);
        const weekdayLine = weekdays.map((w) => pad(w, 3, 'center')).join(' ');
        lines.push(colorize(weekdayLine, COLORS.dim));
        // 날짜 그리드
        for (let row = 0; row < this.items.length; row++) {
            let line = '';
            for (let col = 0; col < this.items[row].length; col++) {
                const cell = this.items[row][col];
                if (cell.day === null) {
                    line += '    '; // 빈 셀 (4칸)
                }
                else {
                    let dayStr = pad(String(cell.day), 3, 'right');
                    const isSelected = this.selectedRow === row && this.selectedCol === col;
                    if (isSelected) {
                        // 선택된 날짜: 반전 (흰 배경 + 검은 글자)
                        dayStr = colorize(dayStr, COLORS.bgWhite, COLORS.black);
                    }
                    else if (cell.isToday) {
                        // 오늘: 밑줄 + 볼드
                        dayStr = colorize(dayStr, COLORS.underline, COLORS.bold);
                    }
                    else if (!cell.hasData) {
                        // 데이터 없는 날짜: dim
                        dayStr = colorize(dayStr, COLORS.dim);
                    }
                    line += dayStr + ' ';
                }
            }
            lines.push(line);
        }
        lines.push('');
        // 하단 정보 패널
        const selectedCell = this.getSelectedItem();
        if (selectedCell && selectedCell.day !== null) {
            const dayLabel = `[${t('calendar.selected', { day: selectedCell.day })}]`;
            lines.push(colorize(dayLabel, COLORS.yellow));
            if (this.selectedDayStats) {
                const sessionBar = createProgressBar(this.selectedDayStats.avgSessionUtilization, 8);
                const weeklyBar = createProgressBar(this.selectedDayStats.avgWeeklyUtilization, 8);
                const sessionPct = Math.round(this.selectedDayStats.avgSessionUtilization * 100);
                const weeklyPct = Math.round(this.selectedDayStats.avgWeeklyUtilization * 100);
                const sessionLabel = t('calendar.sessionLabel');
                const weeklyLabel = t('calendar.weeklyLabel');
                lines.push(`${sessionLabel}: ${sessionBar} ${sessionPct}% | ${weeklyLabel}: ${weeklyBar} ${weeklyPct}%`);
                const recordsLabel = t('calendar.records', { count: this.selectedDayStats.count });
                const tokensLabel = t('calendar.tokens', { count: this.selectedDayStats.totalTokens.toLocaleString() });
                lines.push(`${recordsLabel} | ${tokensLabel}`);
            }
            else {
                lines.push(colorize(t('calendar.noData'), COLORS.dim));
            }
        }
        return lines;
    }
    /**
     * 빈 셀 건너뛰기 (오른쪽)
     */
    moveRight() {
        const prevCol = this.selectedCol;
        const prevRow = this.selectedRow;
        // 기본 이동 시도
        if (!super.moveRight()) {
            return false;
        }
        // 빈 셀이면 유효한 셀까지 계속 이동
        const cell = this.getSelectedItem();
        if (cell?.day === null) {
            // 같은 행에서 유효한 셀 찾기
            while (this.selectedCol < this.items[this.selectedRow].length - 1) {
                this.selectedCol++;
                if (this.items[this.selectedRow][this.selectedCol].day !== null) {
                    this.markDirty();
                    this.updateSelectedStats();
                    return true;
                }
            }
            // 유효한 셀 없으면 원위치 복원
            this.selectedCol = prevCol;
            this.selectedRow = prevRow;
            return false;
        }
        this.updateSelectedStats();
        return true;
    }
    /**
     * 빈 셀 건너뛰기 (왼쪽)
     */
    moveLeft() {
        const prevCol = this.selectedCol;
        const prevRow = this.selectedRow;
        if (!super.moveLeft()) {
            return false;
        }
        const cell = this.getSelectedItem();
        if (cell?.day === null) {
            while (this.selectedCol > 0) {
                this.selectedCol--;
                if (this.items[this.selectedRow][this.selectedCol].day !== null) {
                    this.markDirty();
                    this.updateSelectedStats();
                    return true;
                }
            }
            this.selectedCol = prevCol;
            this.selectedRow = prevRow;
            return false;
        }
        this.updateSelectedStats();
        return true;
    }
    /**
     * 빈 셀 건너뛰기 (아래)
     */
    moveDown() {
        const prevCol = this.selectedCol;
        const prevRow = this.selectedRow;
        if (!super.moveDown()) {
            return false;
        }
        // 같은 열에서 유효한 셀 찾기
        const cell = this.getSelectedItem();
        if (cell?.day === null) {
            // 현재 행에서 가장 가까운 유효한 셀 찾기
            for (let col = this.selectedCol; col >= 0; col--) {
                if (this.items[this.selectedRow][col].day !== null) {
                    this.selectedCol = col;
                    this.markDirty();
                    this.updateSelectedStats();
                    return true;
                }
            }
            // 찾지 못하면 원위치 복원
            this.selectedCol = prevCol;
            this.selectedRow = prevRow;
            return false;
        }
        this.updateSelectedStats();
        return true;
    }
    /**
     * 빈 셀 건너뛰기 (위)
     */
    moveUp() {
        const prevCol = this.selectedCol;
        const prevRow = this.selectedRow;
        if (!super.moveUp()) {
            return false;
        }
        const cell = this.getSelectedItem();
        if (cell?.day === null) {
            for (let col = this.selectedCol; col < this.items[this.selectedRow].length; col++) {
                if (this.items[this.selectedRow][col].day !== null) {
                    this.selectedCol = col;
                    this.markDirty();
                    this.updateSelectedStats();
                    return true;
                }
            }
            this.selectedCol = prevCol;
            this.selectedRow = prevRow;
            return false;
        }
        this.updateSelectedStats();
        return true;
    }
    /**
     * 키 처리
     */
    handleKey(event) {
        switch (event.name) {
            case '[':
            case 'pageup':
                this.prevMonth();
                return true;
            case ']':
            case 'pagedown':
                this.nextMonth();
                return true;
            case 'return':
                const dateKey = this.getSelectedDateKey();
                if (dateKey) {
                    this.callbacks.onSelect?.(dateKey);
                }
                return true;
            case 'c':
                this.callbacks.onCompare?.();
                return true;
            case 'tab':
                this.callbacks.onHistogram?.();
                return true;
            case 'escape':
            case 'q':
                this.callbacks.onExit?.();
                return true;
            default:
                // 기본 방향키 처리 (GridComponent)
                return super.handleKey(event);
        }
    }
}
/**
 * 히스토리 뷰어 앱 생성
 */
export async function createHistoryViewerApp(options) {
    const app = createApp({ useAltScreen: options?.useAltScreen ?? true });
    // 푸터 설정 함수
    const setCalendarFooter = () => {
        const footerItems = [
            { key: '←→↑↓', desc: t('calendar.keyNav') },
            { key: '[/]', desc: t('calendar.keyMonth') },
            { key: 'Enter', desc: t('calendar.keyDetail') },
            { key: 'c', desc: t('calendar.keyCompare') },
            { key: 'Tab', desc: t('calendar.keyHistogram') },
            { key: 'q', desc: t('calendar.keyExit') },
        ];
        app.setFooter(formatKeyHelp(footerItems));
    };
    const setCompareFooter = () => {
        const footerItems = [
            { key: 'Tab', desc: t('compare.keyToggle') },
            { key: 'ESC/q', desc: t('compare.keyBack') },
        ];
        app.setFooter(formatKeyHelp(footerItems));
    };
    const setDetailFooter = () => {
        const footerItems = [
            { key: '↑↓', desc: t('detail.keyScroll') },
            { key: 'ESC/q', desc: t('detail.keyBack') },
        ];
        app.setFooter(formatKeyHelp(footerItems));
    };
    const setHistogramFooter = () => {
        const footerItems = [
            { key: '1-3', desc: t('histogram.keyMode') },
            { key: '←→', desc: t('histogram.keyMove') },
            { key: '↑↓', desc: t('histogram.keyRange') },
            { key: 'Tab', desc: t('histogram.keyBack') },
            { key: 'q', desc: t('calendar.keyExit') },
        ];
        app.setFooter(formatKeyHelp(footerItems));
    };
    // 캘린더 컴포넌트 생성
    const calendar = new CalendarComponent({
        onSelect: (dateKey) => {
            // 해당 날짜 데이터 로드 (데이터 없으면 빈 데이터로 상세 뷰 표시)
            const dayData = calendar.getDayData(dateKey) ?? { date: dateKey, records: [] };
            const detailView = new DetailViewComponent(dateKey, dayData, {
                onBack: () => {
                    app.pop();
                    setCalendarFooter();
                },
            });
            app.push(detailView);
            setDetailFooter();
        },
        onCompare: () => {
            const compareView = new CompareViewComponent({
                onBack: () => {
                    app.pop();
                    setCalendarFooter();
                },
            });
            // 비동기 데이터 로드 시작
            compareView.loadCompareData();
            app.push(compareView);
            setCompareFooter();
        },
        onHistogram: () => {
            const dateKey = calendar.getSelectedDateKey();
            const histogramView = new HistogramViewComponent(dateKey ?? undefined, {
                onBack: () => {
                    app.pop();
                    setCalendarFooter();
                },
                onExit: () => {
                    app.exit();
                },
            });
            histogramView.loadHistogramData();
            app.push(histogramView);
            setHistogramFooter();
        },
        onExit: () => {
            app.exit();
        },
        onMonthChange: async (year, month) => {
            await calendar.loadMonthData(year, month);
        },
    });
    // 초기 데이터 로드
    const { year, month } = calendar.getYearMonth();
    await calendar.loadMonthData(year, month);
    // 캘린더 푸터 설정
    setCalendarFooter();
    // 앱 시작
    app.push(calendar);
    await app.run();
}
