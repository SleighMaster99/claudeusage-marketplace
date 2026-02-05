import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { UsageError, ErrorCode, ErrorMessages } from '../utils/errors.js';
/**
 * 토큰 만료 여부 확인
 * @param expiresAt ISO 8601 타임스탬프
 * @returns true if token is expired
 */
export function isTokenExpired(expiresAt) {
    const expirationTime = new Date(expiresAt).getTime();
    const currentTime = Date.now();
    return currentTime >= expirationTime;
}
/**
 * 토큰 마스킹 (Story 3.5 AC 2)
 * 보안을 위해 토큰 값을 마스킹하여 로그/에러 메시지에서 노출 방지
 * @param token 원본 토큰
 * @returns 마스킹된 토큰 (예: sk-ant-...xxxx)
 */
export function maskToken(token) {
    if (!token || token.length < 12) {
        return '***masked***';
    }
    // 접두사 (sk-ant-) 보존 + 마지막 4자리만 표시
    const prefix = token.slice(0, 7); // 'sk-ant-'
    const suffix = token.slice(-4);
    return `${prefix}...${suffix}`;
}
const getCredentialsPath = () => {
    return join(homedir(), '.claude', '.credentials.json');
};
export async function readCredentials() {
    const credentialsPath = getCredentialsPath();
    try {
        const content = await readFile(credentialsPath, 'utf-8');
        const data = JSON.parse(content);
        // claudeAiOauth 구조 지원 (Claude Code 최신 버전)
        const credentials = data.claudeAiOauth || data;
        if (!credentials.accessToken || !credentials.refreshToken || !credentials.expiresAt) {
            throw new UsageError('인증 파일이 손상되었습니다. Claude Code를 재시작하세요', ErrorCode.AUTH_REQUIRED);
        }
        return credentials;
    }
    catch (error) {
        if (error instanceof UsageError)
            throw error;
        if (error.code === 'ENOENT') {
            throw new UsageError('Claude Code 로그인이 필요합니다', ErrorCode.AUTH_REQUIRED);
        }
        if (error.code === 'EACCES') {
            throw new UsageError('자격 증명 파일에 접근할 수 없습니다', ErrorCode.AUTH_REQUIRED);
        }
        if (error instanceof SyntaxError) {
            throw new UsageError('인증 파일이 손상되었습니다. Claude Code를 재시작하세요', ErrorCode.AUTH_REQUIRED);
        }
        throw error;
    }
}
export async function getValidAccessToken() {
    const credentials = await readCredentials();
    if (isTokenExpired(credentials.expiresAt)) {
        throw new UsageError(ErrorMessages[ErrorCode.TOKEN_EXPIRED], ErrorCode.TOKEN_EXPIRED);
    }
    return credentials.accessToken;
}
