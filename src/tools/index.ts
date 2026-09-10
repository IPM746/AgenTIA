import * as fs from 'fs';
import * as path from 'path';
// importamos 'execSync', una utilidad de Node para ejecutar comandos en la terminal 
// y esperar a que terminen (de forma síncrona).
import { execSync } from 'child_process'; 

/**
 * HERRAMIENTA 1: Leer un archivo
 */
export const readFileTool = (filePath: string): string => {
  try {
    // path.resolve convierte una ruta relativa ('src/app.js') en una ruta completa de Windows ('C:\...')
    const fullPath = path.resolve(filePath);
    
    // fs.readFileSync lee el contenido del archivo. 'utf-8' es para que nos devuelva texto, no código binario.
    const content = fs.readFileSync(fullPath, 'utf-8');
    return content;
  } catch (error: any) {
    // IMPORTANTE: Si hay un error (ej. el archivo no existe), NO rompemos el programa.
    // Le devolvemos el error a la IA en forma de texto para que sepa qué ha fallado y pueda corregirlo.
    return `Error al leer el archivo: ${error.message}`;
  }
};

/**
 * HERRAMIENTA 2: Escribir o modificar un archivo
 */
export const writeFileTool = (filePath: string, content: string): string => {
  try {
    const fullPath = path.resolve(filePath);
    
    // Aseguramos que la carpeta existe antes de crear el archivo (por si la IA quiere crear un archivo nuevo en una carpeta nueva)
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // fs.writeFileSync sobrescribe el archivo con el nuevo contenido.
    fs.writeFileSync(fullPath, content, 'utf-8');
    return `Archivo guardado con éxito en: ${filePath}`;
  } catch (error: any) {
    return `Error al escribir el archivo: ${error.message}`;
  }
};

/**
 * HERRAMIENTA 3: Ejecutar un comando de consola (Terminal)
 */
export const runCommandTool = (command: string): string => {
  console.log(`\n[+] Ejecutando comando por orden de la IA: ${command}`);
  try {
    // execSync ejecuta el comando en la consola de tu ordenador.
    // El resultado (stdout) suele venir en formato Buffer, así que lo pasamos a String.
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    return output || "Comando ejecutado con éxito (sin salida por consola).";
  } catch (error: any) {
    // Si el comando falla (ej. si 'npm test' detecta un test fallido), execSync lanza un error.
    // error.stdout contiene los detalles del fallo que la IA necesita leer.
    return `El comando falló.\nSalida de error:\n${error.stdout ? error.stdout : error.message}`;
  }
};