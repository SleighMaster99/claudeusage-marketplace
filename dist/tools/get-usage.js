/**
 * get_usage MCP Tool for Claude Usage MCP Server
 */
import { fetchUsage } from '../api/usage.js';
import { formatUsageOutput } from '../display/formatter.js';
import { createErrorResponse } from '../utils/errors.js';
/**
 * get_usage 도구 정의
 */
export const getUsageToolDefinition = {
    name: 'get_usage',
    description: 'Claude 구독 사용량을 조회합니다 (세션 5시간 / 주간 7일)',
    inputSchema: {
        type: 'object',
        properties: {},
        required: [],
    },
};
/**
 * get_usage 도구 핸들러
 */
export async function handleGetUsage() {
    try {
        const usage = await fetchUsage();
        const text = formatUsageOutput(usage);
        return {
            content: [{ type: 'text', text }],
        };
    }
    catch (error) {
        return createErrorResponse(error);
    }
}
