import * as fs from 'fs';
import * as path from 'path';

const templates: Record<string, string> = {
  'identity.md': '# Identidad\n\nDescribe el propósito del proyecto y a quién sirve.\n',
  'architecture.md': '# Arquitectura\n\nDescribe módulos, responsabilidades y puntos de integración.\n',
  'technologies.md': '# Tecnologías\n\nIndica lenguajes, runtimes, dependencias y versiones relevantes.\n',
  'rules.md': '# Reglas y convenciones\n\nAnota reglas de desarrollo y revisión específicas del proyecto.\n',
  'style.md': '# Estilo\n\nAnota preferencias de formato, nombres y documentación.\n',
  'lessons.md': '# Lecciones y decisiones\n\nRegistra errores conocidos y decisiones que conviene conservar.\n',
  'constraints.md': '# Restricciones\n\nAnota límites técnicos, funcionales o de rendimiento.\n',
  'security.md': '# Seguridad\n\nAnota precauciones específicas del proyecto.\n',
};

export interface ProjectInitResult {
  created: readonly string[];
  existing: readonly string[];
}

export const initializeProjectKnowledge = (workspacePath: string): ProjectInitResult => {
  const iaPath = path.join(workspacePath, '.ia');
  fs.mkdirSync(iaPath, { recursive: true });
  const created: string[] = [];
  const existing: string[] = [];

  for (const [fileName, content] of Object.entries(templates)) {
    const targetPath = path.join(iaPath, fileName);
    if (fs.existsSync(targetPath)) {
      existing.push(fileName);
      continue;
    }
    fs.writeFileSync(targetPath, content, 'utf-8');
    created.push(fileName);
  }

  return { created, existing };
};
