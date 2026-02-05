/**
 * 키보드 입력 핸들러 모듈 (Story 11.1)
 *
 * Node.js readline 모듈을 사용하여 raw mode 키 입력을 처리합니다.
 * 화살표 키, Enter, ESC, Tab 등 특수키를 파싱합니다.
 */
import * as readline from 'readline';
// 현재 등록된 콜백
let keyPressCallback = null;
// readline 인터페이스 (raw mode용)
let rl = null;
// 원래 stdin 상태 저장
let originalRawMode;
/**
 * 특수키 시퀀스 매핑
 */
const KEY_SEQUENCES = {
    // 화살표 키
    '\x1b[A': 'up',
    '\x1b[B': 'down',
    '\x1b[C': 'right',
    '\x1b[D': 'left',
    // 화살표 키 (대체 시퀀스)
    '\x1bOA': 'up',
    '\x1bOB': 'down',
    '\x1bOC': 'right',
    '\x1bOD': 'left',
    // 특수키
    '\r': 'return',
    '\n': 'return',
    '\x1b': 'escape',
    '\t': 'tab',
    '\x7f': 'backspace',
    '\x08': 'backspace',
    // 홈/엔드
    '\x1b[H': 'home',
    '\x1b[F': 'end',
    '\x1bOH': 'home',
    '\x1bOF': 'end',
    // Page Up/Down
    '\x1b[5~': 'pageup',
    '\x1b[6~': 'pagedown',
    // Delete
    '\x1b[3~': 'delete',
    // Function keys (F1-F4)
    '\x1bOP': 'f1',
    '\x1bOQ': 'f2',
    '\x1bOR': 'f3',
    '\x1bOS': 'f4',
    // Function keys (F5-F12)
    '\x1b[15~': 'f5',
    '\x1b[17~': 'f6',
    '\x1b[18~': 'f7',
    '\x1b[19~': 'f8',
    '\x1b[20~': 'f9',
    '\x1b[21~': 'f10',
    '\x1b[23~': 'f11',
    '\x1b[24~': 'f12',
};
/**
 * Ctrl 키 조합 매핑 (0x01-0x1a)
 */
const CTRL_KEYS = {
    0x01: 'a', // Ctrl+A
    0x02: 'b', // Ctrl+B
    0x03: 'c', // Ctrl+C (인터럽트)
    0x04: 'd', // Ctrl+D (EOF)
    0x05: 'e', // Ctrl+E
    0x06: 'f', // Ctrl+F
    0x0c: 'l', // Ctrl+L (clear)
    0x11: 'q', // Ctrl+Q
    0x12: 'r', // Ctrl+R
    0x13: 's', // Ctrl+S
    0x17: 'w', // Ctrl+W
    0x1a: 'z', // Ctrl+Z
};
/**
 * 키 시퀀스를 KeyPressEvent로 파싱
 */
export function parseKeySequence(sequence, key) {
    // readline에서 제공하는 키 정보 활용
    if (key) {
        return {
            name: key.name || sequence,
            sequence,
            ctrl: key.ctrl || false,
            meta: key.meta || false,
            shift: key.shift || false,
        };
    }
    // 알려진 시퀀스인지 확인
    const knownKey = KEY_SEQUENCES[sequence];
    if (knownKey) {
        return {
            name: knownKey,
            sequence,
            ctrl: false,
            meta: false,
            shift: false,
        };
    }
    // Ctrl 키 조합 확인
    if (sequence.length === 1) {
        const charCode = sequence.charCodeAt(0);
        // Ctrl 키 조합 (0x01-0x1a)
        if (charCode >= 0x01 && charCode <= 0x1a) {
            const ctrlKey = CTRL_KEYS[charCode];
            if (ctrlKey) {
                return {
                    name: ctrlKey,
                    sequence,
                    ctrl: true,
                    meta: false,
                    shift: false,
                };
            }
        }
        // 일반 문자
        return {
            name: sequence,
            sequence,
            ctrl: false,
            meta: false,
            shift: charCode >= 65 && charCode <= 90, // A-Z (대문자)
        };
    }
    // Alt/Meta 키 조합 (\x1b + 문자)
    if (sequence.length === 2 && sequence[0] === '\x1b') {
        const char = sequence[1];
        return {
            name: char.toLowerCase(),
            sequence,
            ctrl: false,
            meta: true,
            shift: char >= 'A' && char <= 'Z',
        };
    }
    // 알 수 없는 시퀀스
    return {
        name: 'unknown',
        sequence,
        ctrl: false,
        meta: false,
        shift: false,
    };
}
/**
 * Raw mode 활성화
 * 키 입력을 버퍼링 없이 즉시 받을 수 있도록 설정
 *
 * @remarks 이미 raw mode가 활성화된 경우 중복 호출을 방지하기 위해 early return 합니다.
 */
export function enableRawMode() {
    if (!process.stdin.isTTY) {
        throw new Error('stdin is not a TTY - raw mode not available');
    }
    // 이미 raw mode가 활성화되어 있고 rl이 존재하면 중복 호출 방지
    if (process.stdin.isRaw && rl !== null) {
        return;
    }
    // 원래 상태 저장
    originalRawMode = process.stdin.isRaw;
    // raw mode 활성화
    process.stdin.setRawMode(true);
    process.stdin.resume();
    // readline 인터페이스 생성 (keypress 이벤트용)
    if (!rl) {
        rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: true,
        });
        // keypress 이벤트 활성화
        readline.emitKeypressEvents(process.stdin, rl);
    }
    // keypress 이벤트 리스너 등록
    process.stdin.on('keypress', handleKeyPress);
}
/**
 * Raw mode 비활성화
 * 터미널을 원래 상태로 복원
 */
export function disableRawMode() {
    // 리스너 제거
    process.stdin.removeListener('keypress', handleKeyPress);
    // readline 인터페이스 정리
    if (rl) {
        rl.close();
        rl = null;
    }
    // 원래 상태로 복원
    if (process.stdin.isTTY && originalRawMode !== undefined) {
        process.stdin.setRawMode(originalRawMode);
    }
    process.stdin.pause();
}
/**
 * 내부 키 입력 핸들러
 */
function handleKeyPress(str, key) {
    if (!keyPressCallback)
        return;
    const sequence = str || '';
    const event = parseKeySequence(sequence, key);
    keyPressCallback(event);
}
/**
 * 키 입력 콜백 등록
 *
 * @param callback 키 입력 시 호출될 함수
 *
 * @remarks
 * 새 콜백을 등록하면 기존 콜백이 덮어쓰여집니다.
 * 하나의 콜백만 활성 상태로 유지됩니다.
 * 콜백을 해제하려면 `offKeyPress()`를 사용하세요.
 *
 * @example
 * ```typescript
 * onKeyPress((event) => {
 *   console.log('Key pressed:', event.name);
 * });
 * ```
 */
export function onKeyPress(callback) {
    keyPressCallback = callback;
}
/**
 * 키 입력 콜백 해제
 */
export function offKeyPress() {
    keyPressCallback = null;
}
/**
 * 특정 키가 종료 키인지 확인
 */
export function isExitKey(event) {
    // q, ESC, Ctrl+C, Ctrl+D
    if (event.name === 'q' && !event.ctrl && !event.meta)
        return true;
    if (event.name === 'escape')
        return true;
    if (event.ctrl && (event.name === 'c' || event.name === 'd'))
        return true;
    return false;
}
/**
 * 특정 키가 탐색 키인지 확인
 */
export function isNavigationKey(event) {
    return ['up', 'down', 'left', 'right'].includes(event.name);
}
/**
 * 특정 키가 선택 키인지 확인
 */
export function isSelectKey(event) {
    return event.name === 'return' || event.name === 'space';
}
/**
 * 키 바인딩 도움말 포맷팅
 */
export function formatKeyHelp(bindings) {
    return bindings.map(b => `${b.key} ${b.desc}`).join(' | ');
}
