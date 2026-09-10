import { Type } from '@google/genai';

export const agentTools = [
  {
    functionDeclarations: [
      {
        name: 'leer_archivo',
        description: 'Lee el contenido de un archivo en el ordenador.',
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