import * as fs from 'fs';
import * as path from 'path';
import { Message } from '../ai/client';

export const projectKnowledgeSections = [
  'identity',
  'architecture',
  'technologies',
  'conventions',
  'decisions',
  'constraints',
  'security',
] as const;

export type ProjectKnowledgeSectionName = typeof projectKnowledgeSections[number];

export interface ProjectKnowledgeSection {
  name: ProjectKnowledgeSectionName;
  content: string;
  files: readonly string[];
  source: 'project_memory';
}

export interface ProjectKnowledge {
  workspacePath: string;
  iaPath: string;
  sections: Readonly<Partial<Record<ProjectKnowledgeSectionName, ProjectKnowledgeSection>>>;
}

const sectionFiles: Record<ProjectKnowledgeSectionName, readonly string[]> = {
  identity: ['identity.md'],
  architecture: ['architecture.md'],
  technologies: ['technologies.md'],
  conventions: ['conventions.md', 'rules.md', 'style.md'],
  decisions: ['decisions.md', 'lessons.md'],
  constraints: ['constraints.md'],
  security: ['security.md'],
};

const readSection = (
  iaPath: string,
  name: ProjectKnowledgeSectionName,
): ProjectKnowledgeSection | undefined => {
  const files = sectionFiles[name].filter((file) =>
    fs.existsSync(path.join(iaPath, file)),
  );
  if (!files.length) {
    return undefined;
  }

  const content = files
    .map((file) => `--- ${file} ---\n${fs.readFileSync(path.join(iaPath, file), 'utf-8')}`)
    .join('\n\n');

  return { name, content, files, source: 'project_memory' };
};

export const loadProjectKnowledge = (workspacePath: string): ProjectKnowledge => {
  const iaPath = path.join(workspacePath, '.ia');
  const sections: Partial<Record<ProjectKnowledgeSectionName, ProjectKnowledgeSection>> = {};

  if (fs.existsSync(iaPath)) {
    for (const name of projectKnowledgeSections) {
      const section = readSection(iaPath, name);
      if (section) {
        sections[name] = section;
      }
    }
  }

  return {
    workspacePath,
    iaPath,
    sections,
  };
};

export const getAvailableKnowledgeSections = (
  knowledge: ProjectKnowledge,
): ProjectKnowledgeSectionName[] =>
  projectKnowledgeSections.filter((name) => knowledge.sections[name] !== undefined);

export const renderProjectKnowledge = (
  knowledge: ProjectKnowledge,
  names: readonly ProjectKnowledgeSectionName[],
): string => names
  .map((name) => knowledge.sections[name])
  .filter((section): section is ProjectKnowledgeSection => section !== undefined)
  .map((section) => `=== ${section.name.toUpperCase()} ===\n${section.content}`)
  .join('\n\n');

export const createProjectKnowledgeMessage = (
  knowledge: ProjectKnowledge,
  names: readonly ProjectKnowledgeSectionName[],
): Message => ({
  role: 'user',
  source: 'project_memory',
  content: renderProjectKnowledge(knowledge, names),
});

const sectionKeywords: Record<ProjectKnowledgeSectionName, readonly string[]> = {
  identity: ['project', 'proyecto', 'purpose', 'objetivo'],
  architecture: ['architecture', 'arquitectura', 'module', 'módulo', 'api', 'structure', 'estructura'],
  technologies: ['typescript', 'javascript', 'node', 'dependency', 'dependencia', 'technology', 'tecnolog', 'version'],
  conventions: ['style', 'estilo', 'format', 'lint', 'convention', 'convencion', 'rule', 'regla'],
  decisions: ['decision', 'decisión', 'migration', 'migración', 'legacy', 'lesson', 'lección'],
  constraints: ['constraint', 'restric', 'limit', 'límite', 'performance', 'rendimiento'],
  security: ['security', 'seguridad', 'permission', 'permiso', 'auth', 'secret', 'secreto'],
};

export const selectProjectKnowledgeSections = (
  task: string,
  knowledge: ProjectKnowledge,
): ProjectKnowledgeSectionName[] => {
  const available = getAvailableKnowledgeSections(knowledge);
  const normalizedTask = task.toLowerCase();
  const selected = available.filter((section) =>
    sectionKeywords[section].some((keyword) => normalizedTask.includes(keyword)),
  );

  if (selected.length) {
    return selected;
  }

  return available.filter((section) =>
    section === 'identity' || section === 'conventions',
  );
};

const truncateSection = (content: string, maxCharsPerSection: number): string =>
  content.length > maxCharsPerSection
    ? `${content.slice(0, maxCharsPerSection)}\n[Sección de ProjectKnowledge truncada para el contexto inicial.]`
    : content;

export const createProjectKnowledgeTaskMessage = (
  task: string,
  knowledge: ProjectKnowledge,
  maxCharsPerSection = 2000,
): Message => {
  const selected = selectProjectKnowledgeSections(task, knowledge);
  const content = selected
    .map((name) => knowledge.sections[name])
    .filter((section): section is ProjectKnowledgeSection => section !== undefined)
    .map((section) =>
      `=== ${section.name.toUpperCase()} ===\n${truncateSection(section.content, maxCharsPerSection)}`,
    )
    .join('\n\n');

  return {
    role: 'user',
    source: 'project_memory',
    content: content || 'No hay conocimiento de proyecto relevante disponible.',
  };
};

/**
 * Initial prompts get only an inventory. A future ContextBuilder can select
 * concrete sections with renderProjectKnowledge without changing the source.
 */
export const createProjectKnowledgeOverviewMessage = (
  knowledge: ProjectKnowledge,
): Message => {
  const available = getAvailableKnowledgeSections(knowledge);
  const content = available.length
    ? `ProjectKnowledge disponible: ${available.join(', ')}. Lee solo los archivos .ia/ necesarios para la tarea.`
    : 'ProjectKnowledge no contiene secciones disponibles.';

  return {
    role: 'user',
    source: 'project_memory',
    content,
  };
};
