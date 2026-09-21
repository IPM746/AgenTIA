import { Message } from '../ai/client';

export interface ContextOptions {
    maxRecentIterations: number;
    truncateThreshold: number;
}

export const optimizeContext = (
    messages: Message[],
    options: ContextOptions = { maxRecentIterations: 2, truncateThreshold: 1000 }
): Message[] => {
    // 1. Contar el número total de bloques de herramientas (iteraciones)
    let totalBlocks = 0;
    for (const msg of messages) {
        if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
            totalBlocks++;
        }
    }

    // 2. Crear la copia optimizada
    const optimized: Message[] = [];
    let currentBlock = 0;

    for (const msg of messages) {
        // Copia superficial inmutable
        const newMsg: Message = { ...msg };

        if (newMsg.role === 'assistant' && newMsg.toolCalls && newMsg.toolCalls.length > 0) {
            currentBlock++;
        }

        if (newMsg.role === 'tool') {
            const isRecent = currentBlock > (totalBlocks - options.maxRecentIterations);
            
            if (!isRecent && newMsg.content && newMsg.content.length > options.truncateThreshold) {
                newMsg.content = newMsg.content.substring(0, options.truncateThreshold) + 
                    `\n\n[... Contenido truncado por Context Engine: superaba el umbral de ${options.truncateThreshold} caracteres y pertenece a un paso previo ...]`;
            }
        }

        optimized.push(newMsg);
    }

    return optimized;
};