import * as assert from 'assert';
import {
  toGeminiTools,
  toOpenAICompatibleTools,
} from '../src/ai/toolAdapters';
import { ToolExecutor } from '../src/tools/executor';
import { ToolRegistry } from '../src/tools/registry';
import { Tool, ToolContext } from '../src/tools/types';

const schema = { type: 'object' };
const context: ToolContext = { workspacePath: 'C:/workspace' };

const createTool = (
  execute: Tool['execute'] = () => 'ok',
): Tool => ({
  name: 'sample_tool',
  description: 'A test tool.',
  inputSchema: schema,
  aliases: ['sample'],
  execute,
});

const runTests = async () => {
  const registry = new ToolRegistry();
  const tool = createTool();

  registry.register(tool);
  assert.strictEqual(registry.resolve('sample_tool'), tool);
  assert.strictEqual(registry.resolve('sample'), tool);
  assert.deepStrictEqual(registry.list(), [tool]);
  assert.throws(
    () => registry.register(createTool()),
    /ya está registrada/,
  );

  let receivedContext: ToolContext | undefined;
  let receivedArgs: Record<string, unknown> | undefined;
  const executableTool = createTool((args, toolContext) => {
    receivedArgs = args;
    receivedContext = toolContext;
    return 'executed';
  });
  const executor = new ToolExecutor();
  const result = await executor.execute(
    executableTool,
    { value: 1 },
    context,
  );

  assert.strictEqual(result, 'executed');
  assert.deepStrictEqual(receivedArgs, { value: 1 });
  assert.strictEqual(receivedContext, context);

  const failure = await executor.execute(
    createTool(() => {
      throw new Error('boom');
    }),
    {},
    context,
  );
  assert.strictEqual(failure, 'Excepción al ejecutar sample_tool: boom');

  const geminiTools = toGeminiTools(registry.list());
  assert.strictEqual(
    geminiTools[0].functionDeclarations[0].name,
    'sample_tool',
  );

  const openAICompatibleTools = toOpenAICompatibleTools(registry.list());
  assert.strictEqual(
    openAICompatibleTools[0].function.name,
    'sample_tool',
  );

  const resolved = registry.resolve('sample');
  assert.ok(resolved);
  assert.strictEqual(
    await executor.execute(resolved, {}, context),
    'ok',
  );

  console.log('Registry, executor y adapters superados.');
};

void runTests();
