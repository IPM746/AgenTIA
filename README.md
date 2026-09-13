# ia-agent-core

**ia-agent-core** es un motor base en Node.js y TypeScript para construir un agente de codificación. Está diseñado para operar sobre proyectos locales mediante un entorno de línea de comandos (CLI).

Su filosofía se basa en la **simplicidad y la transparencia**: mantiene una arquitectura ligera, utiliza memoria específica por proyecto y delega la responsabilidad visual al consumidor mediante callbacks, lo que permite que el núcleo (Core) pueda ser integrado en el futuro en interfaces como una futura extensión de VS Code.

##  Características

*   **Motor ReAct:** Bucle iterativo de pensamiento y acción que permite al LLM razonar antes de invocar herramientas.
*   **Herramientas Locales:** Capacidad para leer archivos, crear/modificar archivos y ejecutar comandos en la terminal.
*   **Memoria por Proyecto:** Inyección de reglas y contexto mediante la carpeta local `.ia/`.
*   **Agnóstico de Proveedor (Factory):** Soporte actual para Gemini y OpenRouter.
*   **Gestión de Contexto:** Límite de 3000 caracteres en la lectura de archivos grandes y salidas de terminal para controlar el tamaño del contexto. Los archivos de memoria (`.ia/`) están excluidos de este límite. (Todavía no existe lectura por rangos o búsqueda avanzada).
*   **Diagnóstico Integrado:** Comando `doctor` para validar requisitos y configuraciones del entorno.

## Arquitectura

El núcleo está diseñado para separar la lógica del agente de la interfaz que lo consume.

```text
       [ Consola CLI (src/cli/bin.ts) ]  ... (Futura UI)
                     │
          (Callbacks de Eventos)
                     ↓
        [ Agent Engine (ReAct Loop) ] ──→ [ Sistema de Herramientas ]
                     │                    (Archivos, Terminal, Filtros)
                     ↓
       [ LLM Factory (src/ai/factory.ts) ]
             ↙               ↘
    [ GeminiClient ]      [ OpenRouterClient ]