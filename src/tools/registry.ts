import { Tool } from './types';

export class ToolRegistry {
  private readonly toolsByName = new Map<string, Tool>();
  private readonly registeredTools: Tool[] = [];

  register(tool: Tool): void {
    const names = [tool.name, ...(tool.aliases ?? [])];

    for (const name of names) {
      if (this.toolsByName.has(name)) {
        throw new Error(`La herramienta ${name} ya está registrada.`);
      }
    }

    for (const name of names) {
      this.toolsByName.set(name, tool);
    }

    this.registeredTools.push(tool);
  }

  resolve(name: string): Tool | undefined {
    return this.toolsByName.get(name);
  }

  list(): readonly Tool[] {
    return this.registeredTools;
  }
}
