import * as assert from 'assert';
import { optimizeContext, ContextOptions } from './context';
import { Message } from '../ai/client';

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

    console.log("✅ Todos los tests pasaron correctamente.");
};

if (require.main === module) {
    runTests();
}