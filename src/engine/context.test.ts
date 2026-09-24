import * as assert from 'assert';
import {
    compareContexts,
    ContextOptions,
    measureContext,
    optimizeContext,
} from './context';
import { Message } from '../ai/client';
import { Tool } from '../tools/types';

const runTests = () => {
    console.log("Iniciando tests de Context Engine...");

    const BIG_TEXT = 'A'.repeat(2000);
    const options: ContextOptions = { maxRecentIterations: 1, truncateThreshold: 1000 };

    // --- TEST 1: Progresión lineal (t1 -> t2 -> t3) ---
    const linearMessages: Message[] = [
        { role: 'system', content: 'Sys' },
        { role: 'user', content: 'User' },
        // Bloque 1
        { role: 'assistant', content: 'Pensando 1', toolCalls: [{ id: 't1', name: 'read', args: {}, thoughtSignature: 'sig1' }] },
        { role: 'tool', content: BIG_TEXT, toolCallId: 't1', toolName: 'read' },
        // Bloque 2
        { role: 'assistant', content: 'Pensando 2', toolCalls: [{ id: 't2', name: 'read', args: {}, thoughtSignature: 'sig2' }] },
        { role: 'tool', content: BIG_TEXT, toolCallId: 't2', toolName: 'read' },
        // Bloque 3 (Reciente)
        { role: 'assistant', content: 'Pensando 3', toolCalls: [{ id: 't3', name: 'read', args: {}, thoughtSignature: 'sig3' }] },
        { role: 'tool', content: BIG_TEXT, toolCallId: 't3', toolName: 'read' }
    ];

    const optLinear = optimizeContext(linearMessages, options);

    // Verificaciones Test 1
    assert.strictEqual(optLinear.length, linearMessages.length, "Se borraron mensajes");
    assert.ok(optLinear[3].content.includes('truncado'), "t1 debería estar truncado");
    assert.ok(optLinear[5].content.includes('truncado'), "t2 debería estar truncado");
    assert.strictEqual(optLinear[7].content.length, 2000, "t3 NO debería estar truncado (es reciente)");
    
    // Inmutabilidad de propiedades clave
    assert.strictEqual(optLinear[2].toolCalls![0].thoughtSignature, 'sig1', "Se perdió thoughtSignature");
    assert.strictEqual(optLinear[3].toolCallId, 't1', "Se perdió toolCallId");
    assert.strictEqual(linearMessages[3].content.length, 2000, "El array original fue mutado");


    // --- TEST 2: Múltiples tools en una iteración (t1+t2 -> t3) ---
    const multiMessages: Message[] = [
        { role: 'system', content: 'Sys' },
        { role: 'user', content: 'User' },
        // Bloque 1 (Multi-tool)
        { role: 'assistant', content: 'Pensando 1', toolCalls: [
            { id: 't1', name: 'read', args: {}, thoughtSignature: 'sig1' },
            { id: 't2', name: 'read', args: {}, thoughtSignature: 'sig2' }
        ]},
        { role: 'tool', content: BIG_TEXT, toolCallId: 't1', toolName: 'read' },
        { role: 'tool', content: 'Pequeño', toolCallId: 't2', toolName: 'read' }, // Tool pequeño no debe truncarse
        // Bloque 2 (Reciente)
        { role: 'assistant', content: 'Pensando 2', toolCalls: [{ id: 't3', name: 'read', args: {}, thoughtSignature: 'sig3' }] },
        { role: 'tool', content: BIG_TEXT, toolCallId: 't3', toolName: 'read' }
    ];

    const optMulti = optimizeContext(multiMessages, options);

    // Verificaciones Test 2
    assert.ok(optMulti[3].content.includes('truncado'), "t1 (Bloque 1) debería estar truncado");
    assert.strictEqual(optMulti[4].content, 'Pequeño', "t2 (Bloque 1) NO debería truncarse porque es pequeño");
    assert.strictEqual(optMulti[6].content.length, 2000, "t3 (Bloque 2) NO debería truncarse");

    // --- TEST 3: Métricas de contexto bruto y optimizado ---
    const tools: Tool[] = [{
        name: 'read',
        description: 'Lee un archivo.',
        inputSchema: {
            type: 'object',
            properties: { filePath: { type: 'string' } },
            required: ['filePath'],
            additionalProperties: false,
        },
        execute: () => 'ok',
    }];
    const comparison = compareContexts(linearMessages, optLinear, tools);
    const measurement = measureContext(optLinear, tools);

    assert.ok(comparison.rawContextTokens > comparison.optimizedContextTokens);
    assert.ok(comparison.savedTokens > 0);
    assert.strictEqual(comparison.estimated, true);
    assert.ok(comparison.systemTokens > 0);
    assert.ok(comparison.userTokens > 0);
    assert.ok(comparison.toolResultTokens > 0);
    assert.ok(comparison.toolSchemaTokens > 0);
    assert.strictEqual(measurement.totalTokens, comparison.optimizedContextTokens);

    // --- TEST 4: Presupuesto determinista y mensajes protegidos ---
    const budgetMessages: Message[] = [
        { role: 'system', content: 'System instructions must remain.' },
        { role: 'user', content: 'User task must remain.' },
        { role: 'assistant', content: 'Using a tool.', toolCalls: [{ id: 'budget-1', name: 'read', args: {} }] },
        { role: 'tool', content: 'A'.repeat(3000), toolCallId: 'budget-1', toolName: 'read' },
        { role: 'assistant', content: 'Using another tool.', toolCalls: [{ id: 'budget-2', name: 'read', args: {} }] },
        { role: 'tool', content: 'B'.repeat(3000), toolCallId: 'budget-2', toolName: 'read' },
    ];
    const budgeted = optimizeContext(budgetMessages, {
        maxRecentIterations: 2,
        truncateThreshold: 5000,
        budget: { maxTokens: 200 },
    }, tools);

    assert.strictEqual(budgeted[0].content, budgetMessages[0].content);
    assert.strictEqual(budgeted[1].content, budgetMessages[1].content);
    assert.ok(budgeted[3].content.includes('presupuesto de contexto'));
    assert.ok(budgeted[5].content.includes('presupuesto de contexto'));
    assert.ok(
        measureContext(budgeted, tools).totalTokens < measureContext(budgetMessages, tools).totalTokens,
    );

    console.log("✅ Todos los tests pasaron correctamente.");
};

if (require.main === module) {
    runTests();
}
