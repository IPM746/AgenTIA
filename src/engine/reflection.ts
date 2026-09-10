import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Aseguramos que las variables de entorno están cargadas
dotenv.config();

export const reflectAndLearn = async (projectPath: string, taskHistory: string) => {
  console.log("\n🤔 [Reflexión] Analizando la ejecución para extraer aprendizajes...");
  
  // Mover esto dentro de la función garantiza que se cree CUANDO la API key ya está cargada
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const prompt = `Eres un Arquitecto de Software analizando una tarea que acaba de completar un agente de IA.
  
  HISTORIAL DE LA TAREA:
  ${taskHistory}

  OBJETIVO:
  ¿El agente cometió algún error que tuvo que corregir? ¿Descubrió alguna peculiaridad de este proyecto que debería recordar para no volver a fallar en el futuro?
  
  - Si consideras que NO hay nada nuevo que aprender de esta tarea ordinaria, responde EXACTAMENTE con la palabra: NADA.
  - Si hay un aprendizaje valioso, escribe una regla breve, clara y en formato Markdown explicando el aprendizaje. No escribas introducciones, solo la regla.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
    });

    const text = response.text?.trim() || "NADA";

    if (text !== "NADA" && text.length > 10) {
      const iaPath = path.join(projectPath, '.ia');
      if (!fs.existsSync(iaPath)) fs.mkdirSync(iaPath, { recursive: true });

      const proposedPath = path.join(iaPath, 'proposed_lessons.md');
      const date = new Date().toLocaleString();
      const contentToAppend = `\n### Aprendizaje propuesto (${date}):\n${text}\n---\n`;
      
      fs.appendFileSync(proposedPath, contentToAppend, 'utf-8');
      console.log(`\n💡 [Aprendizaje] ¡El agente ha propuesto una nueva regla!`);
      console.log(`👉 Revisa el archivo: .ia/proposed_lessons.md`);
    } else {
      console.log("\n🤷 [Reflexión] Tarea rutinaria. No se detectaron aprendizajes nuevos.");
    }
  } catch (error: any) {
    console.error("❌ Error durante la reflexión:", error.message);
  }
};