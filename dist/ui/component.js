/**
 * UI 컴포넌트 베이스 클래스 (Story 11.1)
 *
 * 모든 UI 컴포넌트의 기본 클래스입니다.
 * - 추상 render/handleKey 메서드
 * - 포커스 상태 관리
 * - 부모-자식 관계
 */
import { getTerminalSize } from './renderer.js';
/**
 * UI 상수
 */
export const UI_CONSTANTS = {
    /** 리스트 컴포넌트의 기본 visible 아이템 수 */
    DEFAULT_VISIBLE_COUNT: 10,
};
/**
 * 추상 UI 컴포넌트 클래스
 */
export class Component {
    state = {
        focused: false,
        visible: true,
        dirty: true,
    };
    parent = null;
    children = [];
    /**
     * 포커스 상태 설정
     */
    setFocus(focused) {
        this.state.focused = focused;
        this.markDirty();
    }
    /**
     * 포커스 상태 확인
     */
    isFocused() {
        return this.state.focused;
    }
    /**
     * 가시성 설정
     */
    setVisible(visible) {
        this.state.visible = visible;
        this.markDirty();
    }
    /**
     * 가시성 확인
     */
    isVisible() {
        return this.state.visible;
    }
    /**
     * 재렌더링 필요 표시
     */
    markDirty() {
        this.state.dirty = true;
        this.parent?.markDirty();
    }
    /**
     * 재렌더링 필요 여부 확인
     */
    isDirty() {
        return this.state.dirty;
    }
    /**
     * 렌더링 완료 표시
     */
    markClean() {
        this.state.dirty = false;
    }
    /**
     * 부모 컴포넌트 설정
     */
    setParent(parent) {
        this.parent = parent;
    }
    /**
     * 자식 컴포넌트 추가
     */
    addChild(child) {
        child.setParent(this);
        this.children.push(child);
        this.markDirty();
    }
    /**
     * 자식 컴포넌트 제거
     */
    removeChild(child) {
        const index = this.children.indexOf(child);
        if (index !== -1) {
            child.setParent(null);
            this.children.splice(index, 1);
            this.markDirty();
        }
    }
    /**
     * 터미널 크기 가져오기
     */
    getSize() {
        return getTerminalSize();
    }
    /**
     * 컴포넌트 초기화 (선택적 오버라이드)
     */
    init() {
        // 기본 구현 없음
    }
    /**
     * 컴포넌트 정리 (선택적 오버라이드)
     */
    destroy() {
        // 자식 컴포넌트 정리
        for (const child of this.children) {
            child.destroy();
        }
        this.children = [];
    }
}
/**
 * 컨테이너 컴포넌트 (자식 관리용)
 */
export class ContainerComponent extends Component {
    focusedChildIndex = 0;
    /**
     * 다음 자식에게 포커스 이동
     */
    focusNext() {
        if (this.children.length === 0)
            return false;
        const current = this.children[this.focusedChildIndex];
        current?.setFocus(false);
        this.focusedChildIndex = (this.focusedChildIndex + 1) % this.children.length;
        const next = this.children[this.focusedChildIndex];
        next?.setFocus(true);
        return true;
    }
    /**
     * 이전 자식에게 포커스 이동
     */
    focusPrev() {
        if (this.children.length === 0)
            return false;
        const current = this.children[this.focusedChildIndex];
        current?.setFocus(false);
        this.focusedChildIndex =
            (this.focusedChildIndex - 1 + this.children.length) % this.children.length;
        const prev = this.children[this.focusedChildIndex];
        prev?.setFocus(true);
        return true;
    }
    /**
     * 포커스된 자식 가져오기
     */
    getFocusedChild() {
        return this.children[this.focusedChildIndex] ?? null;
    }
    /**
     * 키 이벤트를 포커스된 자식에게 전달
     */
    handleKey(event) {
        const focused = this.getFocusedChild();
        if (focused) {
            return focused.handleKey(event);
        }
        return false;
    }
}
/**
 * 선택 가능한 리스트 컴포넌트
 */
export class SelectableListComponent extends Component {
    items = [];
    selectedIndex = 0;
    scrollOffset = 0;
    visibleCount = UI_CONSTANTS.DEFAULT_VISIBLE_COUNT;
    /**
     * 아이템 목록 설정
     */
    setItems(items) {
        this.items = items;
        this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, items.length - 1));
        this.markDirty();
    }
    /**
     * 선택된 아이템 가져오기
     */
    getSelectedItem() {
        return this.items[this.selectedIndex];
    }
    /**
     * 선택 인덱스 가져오기
     */
    getSelectedIndex() {
        return this.selectedIndex;
    }
    /**
     * 다음 아이템 선택
     */
    selectNext() {
        if (this.selectedIndex < this.items.length - 1) {
            this.selectedIndex++;
            this.adjustScroll();
            this.markDirty();
            return true;
        }
        return false;
    }
    /**
     * 이전 아이템 선택
     */
    selectPrev() {
        if (this.selectedIndex > 0) {
            this.selectedIndex--;
            this.adjustScroll();
            this.markDirty();
            return true;
        }
        return false;
    }
    /**
     * 첫 번째 아이템 선택
     */
    selectFirst() {
        this.selectedIndex = 0;
        this.scrollOffset = 0;
        this.markDirty();
    }
    /**
     * 마지막 아이템 선택
     */
    selectLast() {
        this.selectedIndex = Math.max(0, this.items.length - 1);
        this.adjustScroll();
        this.markDirty();
    }
    /**
     * 스크롤 조정 (선택된 아이템이 보이도록)
     */
    adjustScroll() {
        if (this.selectedIndex < this.scrollOffset) {
            this.scrollOffset = this.selectedIndex;
        }
        else if (this.selectedIndex >= this.scrollOffset + this.visibleCount) {
            this.scrollOffset = this.selectedIndex - this.visibleCount + 1;
        }
    }
    /**
     * 보이는 아이템 목록
     */
    getVisibleItems() {
        return this.items.slice(this.scrollOffset, this.scrollOffset + this.visibleCount);
    }
    /**
     * 기본 키 처리
     */
    handleKey(event) {
        switch (event.name) {
            case 'up':
                return this.selectPrev();
            case 'down':
                return this.selectNext();
            case 'home':
                this.selectFirst();
                return true;
            case 'end':
                this.selectLast();
                return true;
            default:
                return false;
        }
    }
}
/**
 * 그리드 선택 컴포넌트 (캘린더 등)
 */
export class GridComponent extends Component {
    items = []; // 2D 배열
    selectedRow = 0;
    selectedCol = 0;
    /**
     * 아이템 그리드 설정
     */
    setItems(items) {
        this.items = items;
        this.clampSelection();
        this.markDirty();
    }
    /**
     * 선택된 아이템 가져오기
     */
    getSelectedItem() {
        return this.items[this.selectedRow]?.[this.selectedCol];
    }
    /**
     * 선택 위치 가져오기
     */
    getSelectedPosition() {
        return { row: this.selectedRow, col: this.selectedCol };
    }
    /**
     * 선택 범위 제한
     */
    clampSelection() {
        const maxRow = Math.max(0, this.items.length - 1);
        this.selectedRow = Math.max(0, Math.min(this.selectedRow, maxRow));
        const maxCol = Math.max(0, (this.items[this.selectedRow]?.length ?? 1) - 1);
        this.selectedCol = Math.max(0, Math.min(this.selectedCol, maxCol));
    }
    /**
     * 위로 이동
     */
    moveUp() {
        if (this.selectedRow > 0) {
            this.selectedRow--;
            this.clampSelection();
            this.markDirty();
            return true;
        }
        return false;
    }
    /**
     * 아래로 이동
     */
    moveDown() {
        if (this.selectedRow < this.items.length - 1) {
            this.selectedRow++;
            this.clampSelection();
            this.markDirty();
            return true;
        }
        return false;
    }
    /**
     * 왼쪽으로 이동
     */
    moveLeft() {
        if (this.selectedCol > 0) {
            this.selectedCol--;
            this.markDirty();
            return true;
        }
        return false;
    }
    /**
     * 오른쪽으로 이동
     */
    moveRight() {
        const rowLength = this.items[this.selectedRow]?.length ?? 0;
        if (this.selectedCol < rowLength - 1) {
            this.selectedCol++;
            this.markDirty();
            return true;
        }
        return false;
    }
    /**
     * 기본 키 처리
     */
    handleKey(event) {
        switch (event.name) {
            case 'up':
                return this.moveUp();
            case 'down':
                return this.moveDown();
            case 'left':
                return this.moveLeft();
            case 'right':
                return this.moveRight();
            default:
                return false;
        }
    }
}
