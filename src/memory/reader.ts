import * as fs from 'fs';
import * as path from 'path';

export const readProjectMemory = (projectPath: string): string => {
  const iaPath = path.join(projectPath, '.ia');
  
  // Si el proyecto no tiene carpeta .ia/, devolvemos un aviso
  if (!fs.existsSync(iaPath)) {
    return "No se encontró carpeta .ia/ en este proyecto. El agente operará sin contexto específico.";
  }

  let memoryContext = "=== CONTEXTO DEL PROYECTO (.ia) ===\n\n";
  const filesToRead = ['rules.md', 'architecture.md', 'lessons.md'];

  // Leemos cada archivo y lo añadimos al texto final
  for (const file of filesToRead) {
    const filePath = path.join(iaPath, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      memoryContext += `--- ${file} ---\n${content}\n\n`;
    } else {
      memoryContext += `--- ${file} ---\n(Archivo no creado todavía)\n\n`;
    }
  }

  return memoryContext;
};