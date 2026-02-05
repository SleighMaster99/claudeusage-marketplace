/**
 * Internationalization (i18n) module (Story 3.1)
 * Provides translation function t() for all user-facing messages
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/**
 * JSON 메시지 파일 로드 (동기)
 */
function loadMessages(locale) {
    try {
        const filePath = join(__dirname, '..', 'i18n', `${locale}.json`);
        const content = readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    }
    catch {
        return {};
    }
}
// 메시지 캐싱
const messages = {
    ko: loadMessages('ko'),
    en: loadMessages('en'),
};
let currentLocale = null;
/**
 * 시스템 로케일 감지
 * @returns 'ko' | 'en'
 */
function detectSystemLocale() {
    // Node.js 환경에서 시스템 로케일 감지
    const envLocale = process.env.LC_ALL ||
        process.env.LC_MESSAGES ||
        process.env.LANG ||
        process.env.LANGUAGE ||
        '';
    if (envLocale.toLowerCase().startsWith('ko')) {
        return 'ko';
    }
    if (envLocale.toLowerCase().startsWith('en')) {
        return 'en';
    }
    // 기본값: 한국어
    return 'ko';
}
/**
 * 현재 로케일 결정 (AC 2: 우선순위)
 * CLUSAGE_LANG 환경 변수 → 설정 파일 → 시스템 로케일 → 한국어
 *
 * @param settingsLanguage 설정 파일의 language 값 (선택적)
 * @returns 'ko' | 'en'
 */
export function getLocale(settingsLanguage) {
    // 1. 환경 변수 (최우선)
    const envLang = process.env.CLUSAGE_LANG;
    if (envLang && (envLang === 'ko' || envLang === 'en')) {
        return envLang;
    }
    // 2. 설정 파일
    if (settingsLanguage && (settingsLanguage === 'ko' || settingsLanguage === 'en')) {
        return settingsLanguage;
    }
    // 3. 시스템 로케일
    return detectSystemLocale();
}
/**
 * 현재 로케일 설정
 * @param locale 'ko' | 'en'
 */
export function setLocale(locale) {
    if (locale === 'ko' || locale === 'en') {
        currentLocale = locale;
    }
}
/**
 * 현재 설정된 로케일 반환
 * @returns 현재 로케일
 */
export function getCurrentLocale() {
    return currentLocale ?? getLocale();
}
/**
 * 중첩된 객체에서 점 표기법으로 값 가져오기
 * @param obj 메시지 객체
 * @param path 점으로 구분된 경로 (예: "label.session")
 * @returns 값 또는 undefined
 */
function getNestedValue(obj, path) {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
            current = current[key];
        }
        else {
            return undefined;
        }
    }
    return typeof current === 'string' ? current : undefined;
}
/**
 * 문자열 보간 처리
 * @param template 템플릿 문자열 (예: "{hours}h {minutes}m")
 * @param params 보간할 파라미터
 * @returns 보간된 문자열
 */
function interpolate(template, params) {
    if (!params)
        return template;
    return template.replace(/\{(\w+)\}/g, (_, key) => {
        return params[key]?.toString() ?? `{${key}}`;
    });
}
/**
 * 번역 함수 (AC 6)
 * 메시지 키에 해당하는 번역된 문자열 반환
 *
 * @param key 점 표기법 메시지 키 (예: "label.session", "time.hours")
 * @param params 보간할 파라미터 (선택적)
 * @returns 번역된 문자열
 *
 * @example
 * t('label.session') // => "세션" (ko) 또는 "Session" (en)
 * t('time.hoursMinutes', { hours: 2, minutes: 30 }) // => "2h 30m"
 */
export function t(key, params) {
    const locale = getCurrentLocale();
    // 현재 로케일에서 메시지 찾기
    const currentMessages = messages[locale];
    let value = getNestedValue(currentMessages, key);
    // AC 5: 키 누락 시 한국어 fallback
    if (value === undefined && locale !== 'ko') {
        value = getNestedValue(messages.ko, key);
    }
    // 여전히 없으면 키 자체 반환
    if (value === undefined) {
        return key;
    }
    return interpolate(value, params);
}
/**
 * 특정 로케일로 번역 (현재 로케일 변경 없이)
 * @param locale 로케일
 * @param key 메시지 키
 * @param params 보간 파라미터
 * @returns 번역된 문자열
 */
export function tLocale(locale, key, params) {
    const localeMessages = messages[locale] ?? messages.ko;
    let value = getNestedValue(localeMessages, key);
    // fallback to Korean
    if (value === undefined && locale !== 'ko') {
        value = getNestedValue(messages.ko, key);
    }
    if (value === undefined) {
        return key;
    }
    return interpolate(value, params);
}
