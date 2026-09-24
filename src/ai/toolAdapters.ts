import { Tool } from '../tools/types';

export const toGeminiTools = (tools: readonly Tool[]) => [
  {
    functionDeclarations: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parametersJsonSchema: tool.inputSchema,
    })),
  },
];

export const toOpenAICompatibleTools = (
  tools: readonly Tool[],
) => tools.map((tool) => ({
  type: 'function',
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
  },
}));
