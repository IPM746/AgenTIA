import { Type } from '@google/genai';

export const agentTools = [
  {
    functionDeclarations: [
      {
        name: 'leer_archivo',
        description: "Lee el contenido de un archivo. ADVERTENCIA: Consume muchos tokens. Úsalo SOLO cuando necesites leer o sobrescribir el archivo completo. Para explorar código o buscar dónde se define algo, es OBLIGATORIO usar 'searchFileTool' primero.",
        parametersJsonSchema: {
          type: Type.OBJECT,
          properties: {
            ruta: { type: Type.STRING, description: 'La ruta del archivo (ej. package.json)' }
          },
          required: ['ruta']
        }
      },
      {
        name: 'escribir_archivo',
        description: 'Crea o sobrescribe un archivo con nuevo contenido.',
        parametersJsonSchema: {
          type: Type.OBJECT,
          properties: {
            ruta: { type: Type.STRING, description: 'La ruta del archivo' },
            contenido: { type: Type.STRING, description: 'El contenido completo a escribir' }
          },
          required: ['ruta', 'contenido']
        }
      },
      {
        name: 'searchFileTool',
        description: "Busca un texto dentro de un archivo y devuelve las líneas coincidentes con su contexto y número de línea. Úsalo SIEMPRE como primera opción para explorar código, localizar variables, funciones, clases o dependencias, en lugar de leer el archivo completo.",        parametersJsonSchema: {
          type: Type.OBJECT,
          properties: {
            filePath: { type: Type.STRING, description: 'La ruta del archivo (ej. src/index.ts)' },
            searchTerm: { type: Type.STRING, description: 'El término a buscar dentro del archivo' }
          },
          required: ['filePath', 'searchTerm']
        }
      },
      {
        name: 'ejecutar_comando',
        description: 'Ejecuta un comando en la terminal (ej. tests o lints).',
        parametersJsonSchema: {
          type: Type.OBJECT,
          properties: {
            comando: { type: Type.STRING, description: 'El comando de consola a ejecutar' }
          },
          required: ['comando']
        }
      }
    ]
  }
];