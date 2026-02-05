/**
 * 터미널 앱 라이프사이클 관리자 (Story 11.1)
 *
 * 인터랙티브 터미널 애플리케이션의 메인 엔트리포인트입니다.
 * - 이벤트 루프 관리
 * - 컴포넌트 스택 (화면 전환)
 * - 리사이즈 이벤트 처리
 */
import { Component } from './component.js';
import { enableRawMode, disableRawMode, onKeyPress, offKeyPress, isExitKey, } from './keyboard.js';
import { enterAltScreen, exitAltScreen, getTerminalSize, render, renderFooter, clearScreen, COLORS, colorize, } from './renderer.js';
/**
 * 터미널 앱 클래스
 */
export class TerminalApp {
    componentStack = [];
    running = false;
    exitPromise = null;
    exitResolve = null;
    eventListeners = new Map();
    useAltScreen;
    footer = '';
    // 바인딩된 핸들러 참조 저장 (메모리 누수 방지)
    boundHandleKeyPress;
    boundHandleResize;
    constructor(options) {
        this.useAltScreen = options?.useAltScreen ?? true;
        // constructor에서 한 번만 bind하여 참조 저장
        this.boundHandleKeyPress = this.handleKeyPress.bind(this);
        this.boundHandleResize = this.handleResize.bind(this);
    }
    /**
     * 컴포넌트 푸시 (새 화면으로 전환)
     */
    push(component) {
        // 이전 컴포넌트 포커스 해제
        const current = this.getCurrentComponent();
        if (current) {
            current.setFocus(false);
        }
        // 새 컴포넌트 초기화
        component.init();
        component.setFocus(true);
        this.componentStack.push(component);
        // 렌더링
        this.render();
    }
    /**
     * 컴포넌트 팝 (이전 화면으로 돌아가기)
     */
    pop() {
        if (this.componentStack.length <= 1) {
            // 마지막 컴포넌트면 앱 종료
            this.exit();
            return undefined;
        }
        const popped = this.componentStack.pop();
        if (popped) {
            popped.setFocus(false);
            popped.destroy();
        }
        // 이전 컴포넌트에 포커스
        const current = this.getCurrentComponent();
        if (current) {
            current.setFocus(true);
        }
        // 렌더링
        this.render();
        return popped;
    }
    /**
     * 현재 활성 컴포넌트 가져오기
     */
    getCurrentComponent() {
        return this.componentStack[this.componentStack.length - 1];
    }
    /**
     * 앱 실행
     */
    async run() {
        if (this.running) {
            throw new Error('App is already running');
        }
        this.running = true;
        // 종료 Promise 생성
        this.exitPromise = new Promise(resolve => {
            this.exitResolve = resolve;
        });
        try {
            // 터미널 설정
            if (this.useAltScreen) {
                enterAltScreen();
            }
            else {
                clearScreen();
            }
            // raw mode 활성화 및 키 입력 리스너 등록
            enableRawMode();
            onKeyPress(this.boundHandleKeyPress);
            // 리사이즈 이벤트 리스너
            process.stdout.on('resize', this.boundHandleResize);
            // 초기 렌더링
            this.render();
            // 종료 대기
            await this.exitPromise;
        }
        finally {
            this.cleanup();
        }
    }
    /**
     * 앱 종료
     */
    exit() {
        this.running = false;
        this.exitResolve?.();
    }
    /**
     * 정리 작업
     */
    cleanup() {
        // 키 입력 리스너 해제
        offKeyPress();
        disableRawMode();
        // 리사이즈 리스너 해제
        process.stdout.removeListener('resize', this.boundHandleResize);
        // 컴포넌트 정리
        for (const component of this.componentStack) {
            component.destroy();
        }
        this.componentStack = [];
        // 이벤트 리스너 정리
        this.eventListeners.clear();
        // 터미널 복원
        if (this.useAltScreen) {
            exitAltScreen();
        }
    }
    /**
     * 키 입력 핸들러
     */
    handleKeyPress(event) {
        // 이벤트 발생
        this.emit({ type: 'keypress', data: event });
        // 종료 키 처리 (q, ESC, Ctrl+C)
        if (isExitKey(event)) {
            const current = this.getCurrentComponent();
            // 컴포넌트가 종료 키를 처리하지 않으면 기본 동작
            if (!current || !current.handleKey(event)) {
                this.pop();
            }
            return;
        }
        // 현재 컴포넌트에 키 이벤트 전달
        const current = this.getCurrentComponent();
        if (current) {
            const handled = current.handleKey(event);
            if (handled && current.isDirty()) {
                this.render();
            }
        }
    }
    /**
     * 리사이즈 핸들러
     */
    handleResize() {
        const size = getTerminalSize();
        this.emit({ type: 'resize', data: size });
        // 모든 컴포넌트 dirty 처리
        for (const component of this.componentStack) {
            component.markDirty();
        }
        // 재렌더링
        this.render();
    }
    /**
     * 화면 렌더링
     */
    render() {
        const current = this.getCurrentComponent();
        if (!current)
            return;
        const lines = current.render();
        render(lines);
        current.markClean();
        // 푸터 렌더링
        if (this.footer) {
            renderFooter(this.footer);
        }
        this.emit({ type: 'render' });
    }
    /**
     * 푸터 설정
     */
    setFooter(text) {
        this.footer = text;
        if (this.running) {
            renderFooter(text);
        }
    }
    /**
     * 기본 푸터 (키 도움말)
     */
    setDefaultFooter() {
        const help = [
            colorize('←→↑↓', COLORS.cyan) + ' 이동',
            colorize('Enter', COLORS.cyan) + ' 선택',
            colorize('Tab', COLORS.cyan) + ' 전환',
            colorize('q/ESC', COLORS.cyan) + ' 종료',
        ].join(' | ');
        this.setFooter(help);
    }
    /**
     * 이벤트 리스너 등록
     */
    on(eventType, listener) {
        if (!this.eventListeners.has(eventType)) {
            this.eventListeners.set(eventType, []);
        }
        this.eventListeners.get(eventType).push(listener);
    }
    /**
     * 이벤트 리스너 해제
     */
    off(eventType, listener) {
        const listeners = this.eventListeners.get(eventType);
        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        }
    }
    /**
     * 이벤트 발생
     */
    emit(event) {
        const listeners = this.eventListeners.get(event.type);
        if (listeners) {
            for (const listener of listeners) {
                listener(event);
            }
        }
    }
}
/**
 * 간단한 메시지 컴포넌트 (디버깅/테스트용)
 */
export class MessageComponent extends Component {
    lines;
    constructor(message) {
        super();
        this.lines = Array.isArray(message) ? message : message.split('\n');
    }
    render() {
        const { columns } = this.getSize();
        const result = [];
        // 제목
        result.push(colorize('  ClaudeUsage History Viewer', COLORS.bold, COLORS.cyan));
        result.push('');
        // 메시지 출력
        for (const line of this.lines) {
            result.push('  ' + line.slice(0, columns - 4));
        }
        result.push('');
        result.push(colorize('  Press any key to continue...', COLORS.dim));
        return result;
    }
    handleKey(_event) {
        // 아무 키나 누르면 종료
        return false; // 부모에게 전파하여 pop() 호출
    }
}
/**
 * 앱 인스턴스 생성 헬퍼
 */
export function createApp(options) {
    return new TerminalApp(options);
}
