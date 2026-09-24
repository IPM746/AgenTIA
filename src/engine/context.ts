import { Message } from '../ai/client';
import { Tool } from '../tools/types';

export interface ContextBudget {
  maxTokens: number;
}

export interface ContextOptions {
  maxRecentIterations: number;
  truncateThreshold: number;
  budget?: ContextBudget;
}

export interface ContextMeasurement {
  totalTokens: number;
  systemTokens: number;
  userTokens: number;
  historyTokens: number;
  toolResultTokens: number;
  toolSchemaTokens: number;
  estimated: true;
}

export interface ContextComparison {
  rawContextTokens: number;
  optimizedContextTokens: number;
  savedTokens: number;
  savedPercentage: number;
  systemTokens: number;
  userTokens: number;
  historyTokens: number;
  toolResultTokens: number;
  toolSchemaTokens: number;
  estimated: true;
}

const CHARS_PER_TOKEN = 4;
const BUDGET_TRUNCATION_NOTICE =
  '\n\n[... Resultado de Tool reducido por presupuesto de contexto ...]';

export const estimateTokens = (content: string): number =>
  Math.ceil(content.length / CHARS_PER_TOKEN);

const getMessageContent = (message: Message): string => {
  const toolCalls = message.toolCalls
    ? JSON.stringify(message.toolCalls)
    : '';

  return `${message.content || ''}${toolCalls}`;
};

const getToolSchemaContent = (tools: readonly Tool[]): string =>
  JSON.stringify(tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  })));

export const measureContext = (
  messages: Message[],
  tools: readonly Tool[] = [],
): ContextMeasurement => {
  let systemTokens = 0;
  let userTokens = 0;
  let historyTokens = 0;
  let toolResultTokens = 0;

  for (const message of messages) {
    const tokens = estimateTokens(getMessageContent(message));

    if (message.role === 'system') {
      systemTokens += tokens;
    } else if (message.role === 'user') {
      userTokens += tokens;
    } else if (message.role === 'tool') {
      toolResultTokens += tokens;
    } else {
      historyTokens += tokens;
    }
  }

  const toolSchemaTokens = estimateTokens(getToolSchemaContent(tools));

  return {
    totalTokens:
      systemTokens +
      userTokens +
      historyTokens +
      toolResultTokens +
      toolSchemaTokens,
    systemTokens,
    userTokens,
    historyTokens,
    toolResultTokens,
    toolSchemaTokens,
    estimated: true,
  };
};

export const compareContexts = (
  rawMessages: Message[],
  optimizedMessages: Message[],
  tools: readonly Tool[] = [],
): ContextComparison => {
  const raw = measureContext(rawMessages, tools);
  const optimized = measureContext(optimizedMessages, tools);
  const savedTokens = Math.max(0, raw.totalTokens - optimized.totalTokens);

  return {
    rawContextTokens: raw.totalTokens,
    optimizedContextTokens: optimized.totalTokens,
    savedTokens,
    savedPercentage:
      raw.totalTokens === 0
        ? 0
        : (savedTokens / raw.totalTokens) * 100,
    systemTokens: optimized.systemTokens,
    userTokens: optimized.userTokens,
    historyTokens: optimized.historyTokens,
    toolResultTokens: optimized.toolResultTokens,
    toolSchemaTokens: optimized.toolSchemaTokens,
    estimated: true,
  };
};

const truncateForBudget = (
  messages: Message[],
  budget: ContextBudget,
  tools: readonly Tool[],
): void => {
  for (const message of messages) {
    const totalTokens = measureContext(messages, tools).totalTokens;

    if (totalTokens <= budget.maxTokens) {
      return;
    }

    if (message.role !== 'tool' || !message.content) {
      continue;
    }

    const excessChars =
      (totalTokens - budget.maxTokens) * CHARS_PER_TOKEN;
    const retainedChars = Math.max(
      0,
      message.content.length - excessChars,
    );

    message.content =
      message.content.substring(0, retainedChars) +
      BUDGET_TRUNCATION_NOTICE;
  }
};

export const optimizeContext = (
  messages: Message[],
  options: ContextOptions = {
    maxRecentIterations: 2,
    truncateThreshold: 1000,
  },
  tools: readonly Tool[] = [],
): Message[] => {
  let totalBlocks = 0;
  for (const message of messages) {
    if (message.role === 'assistant' && message.toolCalls?.length) {
      totalBlocks++;
    }
  }

  const optimized = messages.map((message) => ({ ...message }));
  let currentBlock = 0;

  for (const message of optimized) {
    if (message.role === 'assistant' && message.toolCalls?.length) {
      currentBlock++;
    }

    const isRecent =
      currentBlock > totalBlocks - options.maxRecentIterations;

    if (
      message.role === 'tool' &&
      !isRecent &&
      message.content.length > options.truncateThreshold
    ) {
      message.content =
        message.content.substring(0, options.truncateThreshold) +
        '\n\n[... Contenido truncado por Context Engine: superaba el umbral de ' +
        `${options.truncateThreshold} caracteres y pertenece a un paso previo ...]`;
    }
  }

  if (options.budget) {
    truncateForBudget(optimized, options.budget, tools);
  }

  return optimized;
};
