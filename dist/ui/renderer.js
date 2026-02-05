/**
 * 화면 렌더링 엔진 모듈 (Story 11.1)
 *
 * 터미널 화면 출력을 담당합니다.
 * - 화면 클리어 및 커서 제어
 * - 박스 드로잉 (유니코드 문자)
 * - ANSI 색상 출력
 * - 더블 버퍼링으로 깜빡임 방지
 */
// ============================================================================
// ANSI Escape Codes
// ============================================================================
/**
 * ANSI 이스케이프 코드 상수
 */
export const ANSI = {
    // 화면 제어
    CLEAR_SCREEN: '\x1b[2J',
    CLEAR_LINE: '\x1b[2K',
    CLEAR_TO_END: '\x1b[0K',
    // 커서 제어
    CURSOR_HOME: '\x1b[H',
    CURSOR_HIDE: '\x1b[?25l',
    CURSOR_SHOW: '\x1b[?25h',
    CURSOR_SAVE: '\x1b[s',
    CURSOR_RESTORE: '\x1b[u',
    // 대체 화면 버퍼
    ALT_SCREEN_ON: '\x1b[?1049h',
    ALT_SCREEN_OFF: '\x1b[?1049l',
};
/**
 * ANSI 색상 코드
 */
export const COLORS = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    underline: '\x1b[4m',
    // 전경색
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    // 배경색
    bgBlack: '\x1b[40m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m',
    bgWhite: '\x1b[47m',
};
// ============================================================================
// Box Drawing Characters
// ============================================================================
/**
 * 박스 드로잉 스타일: 더블 라인 (═║╔╗╚╝╠╣╦╩╬)
 */
export const BOX_DOUBLE = {
    topLeft: '╔',
    topRight: '╗',
    bottomLeft: '╚',
    bottomRight: '╝',
    horizontal: '═',
    vertical: '║',
    titleLeft: '╣',
    titleRight: '╠',
};
/**
 * 박스 드로잉 스타일: 싱글 라인 (─│┌┐└┘├┤┬┴┼)
 */
export const BOX_SINGLE = {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
    titleLeft: '┤',
    titleRight: '├',
};
/**
 * 박스 드로잉 스타일: 라운드 (╭╮╰╯)
 */
export const BOX_ROUND = {
    topLeft: '╭',
    topRight: '╮',
    bottomLeft: '╰',
    bottomRight: '╯',
    horizontal: '─',
    vertical: '│',
    titleLeft: '┤',
    titleRight: '├',
};
// ============================================================================
// Screen Management
// ============================================================================
/**
 * 더블 버퍼링 시스템
 *
 * 깜빡임 없는 화면 업데이트를 위해 두 개의 버퍼를 사용합니다:
 * - screenBuffer: 현재 프레임의 화면 내용을 담는 버퍼
 * - previousBuffer: 이전 프레임의 화면 내용 (차이 비교용)
 *
 * flushBuffer()는 두 버퍼를 비교하여 변경된 줄만 터미널에 출력합니다.
 * 이 버퍼들은 모듈 레벨에서 관리되며, initBuffer()로 초기화됩니다.
 *
 * 주의: 멀티 인스턴스 환경에서는 버퍼 충돌이 발생할 수 있습니다.
 * 현재는 단일 TerminalApp 인스턴스 사용을 가정합니다.
 */
let screenBuffer = [];
let previousBuffer = [];
/**
 * 터미널 크기 가져오기
 */
export function getTerminalSize() {
    return {
        columns: process.stdout.columns || 80,
        rows: process.stdout.rows || 24,
    };
}
/**
 * 화면 클리어
 */
export function clearScreen() {
    process.stdout.write(ANSI.CLEAR_SCREEN + ANSI.CURSOR_HOME);
}
/**
 * 커서 이동
 * @param x 열 (1-based)
 * @param y 행 (1-based)
 */
export function moveCursor(x, y) {
    process.stdout.write(`\x1b[${y};${x}H`);
}
/**
 * 커서 숨기기
 */
export function hideCursor() {
    process.stdout.write(ANSI.CURSOR_HIDE);
}
/**
 * 커서 보이기
 */
export function showCursor() {
    process.stdout.write(ANSI.CURSOR_SHOW);
}
/**
 * 대체 화면 버퍼 활성화 (원래 화면 보존)
 */
export function enterAltScreen() {
    process.stdout.write(ANSI.ALT_SCREEN_ON);
    hideCursor();
}
/**
 * 대체 화면 버퍼 비활성화 (원래 화면 복원)
 */
export function exitAltScreen() {
    showCursor();
    process.stdout.write(ANSI.ALT_SCREEN_OFF);
}
// ============================================================================
// Buffer Management (Double Buffering)
// ============================================================================
/**
 * 버퍼 초기화
 */
export function initBuffer() {
    const { rows } = getTerminalSize();
    screenBuffer = new Array(rows).fill('');
    previousBuffer = new Array(rows).fill('');
}
/**
 * 버퍼에 텍스트 쓰기
 * @param row 행 (0-based)
 * @param text 텍스트
 */
export function writeToBuffer(row, text) {
    if (row >= 0 && row < screenBuffer.length) {
        screenBuffer[row] = text;
    }
}
/**
 * 버퍼 클리어
 */
export function clearBuffer() {
    screenBuffer = screenBuffer.map(() => '');
}
/**
 * 버퍼 렌더링 (변경된 줄만 업데이트)
 */
export function flushBuffer() {
    for (let i = 0; i < screenBuffer.length; i++) {
        if (screenBuffer[i] !== previousBuffer[i]) {
            moveCursor(1, i + 1);
            process.stdout.write(ANSI.CLEAR_LINE + screenBuffer[i]);
        }
    }
    previousBuffer = [...screenBuffer];
}
/**
 * 전체 버퍼 강제 렌더링
 */
export function forceFlushBuffer() {
    clearScreen();
    for (let i = 0; i < screenBuffer.length; i++) {
        moveCursor(1, i + 1);
        process.stdout.write(screenBuffer[i]);
    }
    previousBuffer = [...screenBuffer];
}
// ============================================================================
// Drawing Utilities
// ============================================================================
/**
 * 텍스트에 색상 적용
 */
export function colorize(text, ...codes) {
    if (codes.length === 0)
        return text;
    return codes.join('') + text + COLORS.reset;
}
/**
 * 텍스트를 지정된 너비로 패딩
 * @param text 텍스트
 * @param width 목표 너비
 * @param align 정렬 ('left' | 'center' | 'right')
 */
export function pad(text, width, align = 'left') {
    // ANSI 코드 제거하여 실제 길이 계산
    const visibleLength = stripAnsi(text).length;
    if (visibleLength >= width) {
        return text;
    }
    const padding = width - visibleLength;
    switch (align) {
        case 'center': {
            const leftPad = Math.floor(padding / 2);
            const rightPad = padding - leftPad;
            return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
        }
        case 'right':
            return ' '.repeat(padding) + text;
        case 'left':
        default:
            return text + ' '.repeat(padding);
    }
}
/**
 * ANSI 이스케이프 코드 제거
 */
export function stripAnsi(text) {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}
/**
 * 텍스트 자르기 (너비 초과 시)
 * @param text 텍스트
 * @param maxWidth 최대 너비
 * @param ellipsis 생략 표시 (기본값: '…')
 */
export function truncate(text, maxWidth, ellipsis = '…') {
    const visibleLength = stripAnsi(text).length;
    if (visibleLength <= maxWidth) {
        return text;
    }
    // ANSI 코드가 없는 경우 단순 자르기
    if (text === stripAnsi(text)) {
        return text.slice(0, maxWidth - ellipsis.length) + ellipsis;
    }
    // ANSI 코드가 있는 경우 복잡한 처리 필요
    // 간단하게 ANSI 코드 제거 후 자르기
    const plain = stripAnsi(text);
    return plain.slice(0, maxWidth - ellipsis.length) + ellipsis;
}
// ============================================================================
// Box Drawing
// ============================================================================
/**
 * 박스 그리기
 * @param width 박스 너비 (테두리 포함)
 * @param height 박스 높이 (테두리 포함)
 * @param title 제목 (선택)
 * @param style 박스 스타일 (기본값: BOX_DOUBLE)
 * @returns 줄 배열
 */
export function drawBox(width, height, title, style = BOX_DOUBLE) {
    const lines = [];
    // 상단 테두리
    let topLine = style.topLeft + style.horizontal.repeat(width - 2) + style.topRight;
    // 제목이 있으면 삽입
    if (title) {
        const titleText = ` ${title} `;
        const titleStart = 2; // 테두리 다음부터
        const before = style.horizontal.repeat(titleStart);
        const after = style.horizontal.repeat(width - 2 - titleStart - titleText.length);
        if (titleText.length <= width - 4) {
            topLine =
                style.topLeft + before + style.titleRight + titleText + style.titleLeft + after + style.topRight;
        }
    }
    lines.push(topLine);
    // 중간 줄들
    const emptyLine = style.vertical + ' '.repeat(width - 2) + style.vertical;
    for (let i = 0; i < height - 2; i++) {
        lines.push(emptyLine);
    }
    // 하단 테두리
    lines.push(style.bottomLeft + style.horizontal.repeat(width - 2) + style.bottomRight);
    return lines;
}
/**
 * 박스 내부에 콘텐츠 채우기
 * @param box 박스 줄 배열
 * @param content 콘텐츠 줄 배열
 * @param startRow 시작 행 (0-based, 박스 내부)
 * @param style 박스 스타일 (기본값: BOX_DOUBLE)
 */
export function fillBox(box, content, startRow = 0, style = BOX_DOUBLE) {
    const result = [...box];
    const innerWidth = stripAnsi(box[0]).length - 2;
    for (let i = 0; i < content.length; i++) {
        const boxRow = startRow + 1 + i; // +1 for top border
        if (boxRow > 0 && boxRow < result.length - 1) {
            const paddedContent = pad(truncate(content[i], innerWidth), innerWidth);
            result[boxRow] = style.vertical + paddedContent + style.vertical;
        }
    }
    return result;
}
// ============================================================================
// High-Level Rendering
// ============================================================================
/**
 * 전체 화면 렌더링
 * @param lines 출력할 줄 배열
 */
export function render(lines) {
    initBuffer();
    clearBuffer();
    for (let i = 0; i < lines.length && i < screenBuffer.length; i++) {
        writeToBuffer(i, lines[i]);
    }
    forceFlushBuffer();
}
/**
 * 화면 중앙에 렌더링
 * @param lines 출력할 줄 배열
 */
export function renderCentered(lines) {
    // 빈 배열이면 빈 화면 렌더링
    if (lines.length === 0) {
        initBuffer();
        clearBuffer();
        forceFlushBuffer();
        return;
    }
    const { columns, rows } = getTerminalSize();
    const startRow = Math.max(0, Math.floor((rows - lines.length) / 2));
    const maxWidth = Math.max(0, ...lines.map(l => stripAnsi(l).length));
    const startCol = Math.max(0, Math.floor((columns - maxWidth) / 2));
    initBuffer();
    clearBuffer();
    for (let i = 0; i < lines.length; i++) {
        const row = startRow + i;
        if (row < screenBuffer.length) {
            writeToBuffer(row, ' '.repeat(startCol) + lines[i]);
        }
    }
    forceFlushBuffer();
}
/**
 * 푸터 영역 렌더링 (화면 하단)
 * @param text 푸터 텍스트
 */
export function renderFooter(text) {
    const { rows } = getTerminalSize();
    moveCursor(1, rows);
    process.stdout.write(ANSI.CLEAR_LINE + text);
}
