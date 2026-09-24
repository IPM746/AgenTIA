import { Message } from '../ai/client';

export interface IterationMetric {
    iteration: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimated: boolean;
    historyMessages: number;
    historyChars: number;
    latencyMs: number;
    rawContextTokens: number;
    optimizedContextTokens: number;
    savedTokens: number;
    savedPercentage: number;
    systemTokens: number;
    userTokens: number;
    historyTokens: number;
    toolResultTokens: number;
    toolSchemaTokens: number;
    contextTokensEstimated: boolean;
}

export interface AgentMetrics {
    iterations: number;
    toolCalls: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    isEstimated: boolean;
    iterationDetails: IterationMetric[];

    latencyMs: number;
    result: 'success' | 'failure' | 'max_iterations';
    errors: string[];
}

export const calculateHistoryChars = (messages: Message[]): number => {
    return messages.reduce((acc, msg) => {
        let len = msg.content ? msg.content.length : 0;
        if (msg.toolCalls) {
            len += JSON.stringify(msg.toolCalls).length;
        }
        return acc + len;
    }, 0);
};
