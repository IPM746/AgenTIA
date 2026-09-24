# AgenTIA — Phase 0 Baseline Architecture

## Commit

The baseline is tied to the Git commit stored in `commit.txt`.

## Agent Core

The main ReAct loop is implemented in:

`src/engine/agent.ts`

Responsibilities currently include:

- loading configuration;
- creating the LLM client;
- loading project memory;
- building the system prompt;
- maintaining conversation messages;
- context optimization;
- calling the LLM;
- dispatching tool calls;
- executing tools;
- collecting metrics;
- terminating the ReAct loop.

## LLM abstraction

The current abstraction is:

`src/ai/client.ts`

It defines:

- `Message`
- `ToolCall`
- `LLMUsage`
- `LLMResponse`
- `LLMClient`

The interface is currently:

```ts
chat(messages, tools): Promise<LLMResponse>