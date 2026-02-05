/**
 * Error handling utilities for Claude Usage MCP Server
 */
export var ErrorCode;
(function (ErrorCode) {
    ErrorCode["AUTH_REQUIRED"] = "AUTH_REQUIRED";
    ErrorCode["TOKEN_EXPIRED"] = "TOKEN_EXPIRED";
    ErrorCode["RATE_LIMITED"] = "RATE_LIMITED";
    ErrorCode["SERVER_ERROR"] = "SERVER_ERROR";
    ErrorCode["NETWORK_ERROR"] = "NETWORK_ERROR";
})(ErrorCode || (ErrorCode = {}));
/**
 * ErrorCode를 키로 사용하여 일관성 유지
 */
export const ErrorMessages = {
    [ErrorCode.NETWORK_ERROR]: 'API 연결 실패. 인터넷 연결을 확인하세요',
    [ErrorCode.TOKEN_EXPIRED]: '인증 실패. Claude Code 재로그인이 필요합니다',
    [ErrorCode.RATE_LIMITED]: '요청 한도 초과. 잠시 후 다시 시도하세요',
    [ErrorCode.SERVER_ERROR]: '서버 오류. Anthropic 서비스 상태를 확인하세요',
    [ErrorCode.AUTH_REQUIRED]: 'Claude Code 로그인이 필요합니다',
    UNKNOWN: '알 수 없는 오류가 발생했습니다',
};
export class UsageError extends Error {
    code;
    recoverable;
    constructor(message, code, recoverable = false) {
        super(message);
        this.code = code;
        this.recoverable = recoverable;
        this.name = 'UsageError';
    }
}
/**
 * 에러를 MCP CallToolResult 형식으로 변환
 */
export function createErrorResponse(error) {
    let message;
    if (error instanceof UsageError) {
        message = error.message;
    }
    else if (error instanceof Error) {
        message = error.message;
    }
    else {
        message = ErrorMessages.UNKNOWN;
    }
    return {
        content: [{ type: 'text', text: `❌ ${message}` }],
        isError: true,
    };
}
