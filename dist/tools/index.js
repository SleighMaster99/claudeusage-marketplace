/**
 * MCP Tool Registration Module
 */
import { handleGetUsage } from './get-usage.js';
import { createErrorResponse } from '../utils/errors.js';
/**
 * MCP 서버에 도구를 등록합니다.
 */
export function registerTools(server) {
    server.tool('get_usage', 'Claude 구독 사용량을 조회합니다 (세션 5시간 / 주간 7일)', async () => {
        try {
            return await handleGetUsage();
        }
        catch (error) {
            return createErrorResponse(error);
        }
    });
}
