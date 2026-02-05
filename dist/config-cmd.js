/**
 * Config command module (Story 9.6)
 * CLI for viewing and modifying settings
 */
import { fileURLToPath } from 'url';
import { getAllSettings, getSettingsPath, saveSettings, updateSetting, loadSettings, DEFAULT_SETTINGS, } from './utils/config.js';
/**
 * 명령행 인자에서 액션 및 옵션 파싱
 * @param args - 명령행 인자 배열
 * @returns 파싱된 명령 정보
 */
export function parseConfigArgs(args) {
    if (args.length === 0) {
        return { action: 'show' };
    }
    const firstArg = args[0].toLowerCase();
    // --reset: 초기화
    if (firstArg === '--reset' || firstArg === 'reset') {
        return { action: 'reset' };
    }
    // --set key=value: 설정 변경
    if (firstArg === '--set' || firstArg === 'set') {
        if (args.length < 2) {
            return { action: 'show' }; // 인자 부족 시 현재 설정 표시
        }
        const keyValue = args[1];
        const eqIndex = keyValue.indexOf('=');
        if (eqIndex === -1) {
            // key=value 형식이 아니면 show
            return { action: 'show' };
        }
        const key = keyValue.substring(0, eqIndex);
        const value = keyValue.substring(eqIndex + 1);
        return { action: 'set', key, value };
    }
    // get key: 특정 키 값 조회
    if (firstArg === 'get' && args.length >= 2) {
        return { action: 'get', key: args[1] };
    }
    // 기본: 현재 설정 표시
    return { action: 'show' };
}
/**
 * 유효한 Settings 키인지 확인
 * @param key - 검증할 키
 * @returns 유효 여부
 */
export function isValidSettingsKey(key) {
    return key in DEFAULT_SETTINGS;
}
/**
 * 문자열 값을 적절한 타입으로 변환
 * @param key - 설정 키
 * @param value - 문자열 값
 * @returns 변환된 값 또는 null (변환 실패)
 */
export function parseSettingValue(key, value) {
    switch (key) {
        case 'cacheTtlSeconds': {
            const num = parseInt(value, 10);
            if (isNaN(num) || num < 1)
                return null;
            return num;
        }
        case 'exchangeRate': {
            const num = parseFloat(value);
            if (isNaN(num) || num < 1)
                return null;
            return num;
        }
        case 'language': {
            if (value !== 'ko' && value !== 'en')
                return null;
            return value;
        }
        case 'currency': {
            const upper = value.toUpperCase();
            if (upper !== 'USD' && upper !== 'KRW')
                return null;
            return upper;
        }
        case 'graphStyle': {
            const lower = value.toLowerCase();
            if (lower !== 'bar' && lower !== 'line')
                return null;
            return lower;
        }
        default:
            return null;
    }
}
/**
 * 현재 설정을 테이블 형식으로 포맷
 * @returns 포맷된 설정 테이블 문자열
 */
export function formatCurrentSettings() {
    const currentSettings = getAllSettings();
    const rawSettings = loadSettings();
    const settingsPath = getSettingsPath();
    const lines = [];
    lines.push(`현재 설정 (${settingsPath})`);
    lines.push('');
    lines.push('| 설정 | 값 | 기본값 |');
    lines.push('|------|-----|--------|');
    // 설정 키 목록 (순서 고정)
    const keys = [
        'language',
        'cacheTtlSeconds',
        'currency',
        'exchangeRate',
        'graphStyle',
    ];
    for (const key of keys) {
        const currentValue = currentSettings[key];
        const defaultValue = DEFAULT_SETTINGS[key];
        const isCustom = rawSettings[key] !== undefined;
        const valueDisplay = isCustom ? `${currentValue}*` : String(currentValue);
        lines.push(`| ${key.padEnd(16)} | ${String(valueDisplay).padEnd(9)} | ${String(defaultValue).padEnd(6)} |`);
    }
    lines.push('');
    lines.push('* 표시는 설정 파일에서 변경된 값');
    lines.push('');
    lines.push('설정 변경: /claudeusage:config --set key=value');
    lines.push('초기화: /claudeusage:config --reset');
    return lines.join('\n');
}
/**
 * 설정 값 변경
 * @param key - 설정 키
 * @param value - 설정 값 (문자열)
 * @returns 결과 메시지
 */
export function setConfigValue(key, value) {
    // 키 유효성 검증
    if (!isValidSettingsKey(key)) {
        const validKeys = Object.keys(DEFAULT_SETTINGS).join(', ');
        return `오류: 잘못된 설정 키 '${key}'\n유효한 키: ${validKeys}`;
    }
    // 값 변환
    const parsedValue = parseSettingValue(key, value);
    if (parsedValue === null) {
        const defaultValue = DEFAULT_SETTINGS[key];
        return `오류: '${key}'에 대한 잘못된 값 '${value}'\n기본값: ${defaultValue}`;
    }
    // 업데이트
    updateSetting(key, parsedValue);
    return `${key} 설정이 '${parsedValue}'(으)로 변경되었습니다.`;
}
/**
 * 설정 초기화
 * @returns 결과 메시지
 */
export function resetConfig() {
    saveSettings({});
    return '설정이 기본값으로 초기화되었습니다.';
}
/**
 * 특정 설정 값 조회
 * @param key - 설정 키
 * @returns 설정 값 또는 오류 메시지
 */
export function getConfigValue(key) {
    if (!isValidSettingsKey(key)) {
        const validKeys = Object.keys(DEFAULT_SETTINGS).join(', ');
        return `오류: 잘못된 설정 키 '${key}'\n유효한 키: ${validKeys}`;
    }
    const settings = getAllSettings();
    return `${key}: ${settings[key]}`;
}
/**
 * 설정 명령어 메인 함수
 * @param args - 명령행 인자
 * @returns 출력 문자열
 */
export async function runConfigCommand(args) {
    const parsed = parseConfigArgs(args);
    switch (parsed.action) {
        case 'show':
            return formatCurrentSettings();
        case 'set':
            if (!parsed.key || parsed.value === undefined) {
                return formatCurrentSettings();
            }
            return setConfigValue(parsed.key, parsed.value);
        case 'reset':
            return resetConfig();
        case 'get':
            if (!parsed.key) {
                return formatCurrentSettings();
            }
            return getConfigValue(parsed.key);
    }
}
/**
 * CLI 메인 함수
 */
async function main() {
    try {
        const args = process.argv.slice(2);
        const output = await runConfigCommand(args);
        process.stdout.write(output + '\n');
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        process.stderr.write(`Error: ${message}\n`);
        process.exit(1);
    }
}
// ESM 직접 실행 감지
const __filename = fileURLToPath(import.meta.url);
const isDirectExecution = process.argv[1] === __filename;
if (isDirectExecution) {
    main();
}
