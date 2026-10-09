# Guía de uso de AgenTIA

## 1. Alcance y límites

AgenTIA es un agente de programación para usar desde la terminal dentro de un proyecto local. Puede analizar código, modificar archivos en modo de edición y ejecutar verificaciones detectadas en `package.json`.

No es un sandbox. Los comandos que la política permita se ejecutan con los permisos de tu cuenta de Windows. Revise siempre el diff, use control de versiones y mantenga copias de seguridad. La herramienta no incorpora GUI, multiagente ni skills activas en el flujo normal.

## 2. Requisitos en Windows 11

Necesitas Git, Node.js y npm. Esta versión se ha comprobado con Node.js `v22.20.0`; use una versión actual compatible de Node.js. Para el proveedor local instala además [Ollama](https://ollama.com/) y descarga el modelo elegido.

```powershell
git clone https://github.com/IPM746/AgenTIA.git
cd AgenTIA
npm install
npm test
npm run build
npm link
```

`npm link` registra el comando `ia-agent` para tu usuario. Si prefieres no enlazarlo globalmente, ejecute `npx tsx C:\ruta\a\AgenTIA\src\index.ts` desde el directorio del proyecto objetivo.

## 3. Configurar un proveedor

La configuración global se lee de `%APPDATA%\ia-agent\config.json`. Puede partir de `config.example.json`; el archivo no contiene ni debe contener claves.

```powershell
$configDir = Join-Path $env:APPDATA 'ia-agent'
New-Item -ItemType Directory -Force $configDir
Copy-Item .\config.example.json (Join-Path $configDir 'config.json')
```

Las opciones admitidas son:

```json
{
  "provider": "ollama",
  "model": "qwen3.5:4b",
  "maxIter": 5,
  "contextMaxTokens": 12000,
  "verificationMaxCycles": 3
}
```

Todos los límites deben ser enteros positivos. Las variables de entorno `AI_PROVIDER`, `AI_MODEL`, `AI_MAX_ITER`, `AI_CONTEXT_MAX_TOKENS` y `AI_VERIFICATION_MAX_CYCLES` tienen prioridad sobre el archivo. Sin configuración, AgenTIA usa Ollama con `qwen3.5:4b`.

### Ollama local

```powershell
ollama pull qwen3.5:4b
$env:AI_PROVIDER = 'ollama'
$env:AI_MODEL = 'qwen3.5:4b'
ia-agent doctor
```

Ollama no requiere una clave en AgenTIA. Si el servidor de Ollama es local, las solicitudes del modelo permanecen en la máquina, salvo que usted haya configurado Ollama contra un servidor remoto.

### Gemini

```powershell
$env:AI_PROVIDER = 'gemini'
$env:AI_MODEL = 'gemini-3.6-flash'
$env:GEMINI_API_KEY = 'su-clave'
ia-agent doctor
```

Gemini requiere `GEMINI_API_KEY` en el entorno. No la añada a `config.json`, `.ia/` ni al repositorio.

### OpenRouter

```powershell
$env:AI_PROVIDER = 'openrouter'
$env:AI_MODEL = 'provider/model-name'
$env:OPENROUTER_API_KEY = 'su-clave'
ia-agent doctor
```

OpenRouter requiere un modelo explícito y `OPENROUTER_API_KEY` en el entorno.

## 4. Comprobar la instalación

Ejecute este comando desde el proyecto con el que vaya a trabajar:

```powershell
ia-agent doctor
```

`doctor` valida Node.js, la sintaxis y los valores de la configuración, el secreto requerido para el proveedor elegido y las secciones disponibles en `.ia/`. Muestra proveedor, modelo y límites, pero nunca el valor de las claves. No comprueba la cuota remota ni que un modelo de Ollama concreto esté descargado; esos fallos aparecerán al ejecutar una tarea.

## 5. Elegir proyecto y ejecutar una tarea

Cambie al directorio raíz del proyecto objetivo antes de invocar el agente. El workspace es ese directorio.

```powershell
cd C:\codigo\mi-proyecto
ia-agent --mode read-only "Describe los módulos principales y los riesgos técnicos"
ia-agent --mode edit "Corrige el test que falla y verifica el cambio"
```

`read-only` concede únicamente `filesystem.read`: no permite escritura ni ejecución de procesos. `edit` permite las herramientas de lectura, escritura y ejecución que superen la política de seguridad. El modo se imprime al comenzar. Por compatibilidad, no indicar `--mode` equivale a `edit`; para una tarea que no deba alterar nada, especifique siempre `--mode read-only`.

El proceso termina con:

- `0`: tarea completada; si hubo cambios, la verificación detectada terminó correctamente.
- `1`: error, límite de iteraciones, verificación fallida o bloqueo que impidió completar la tarea.
- `2`: hubo cambios pero el proyecto no ofrecía comandos automáticos de verificación.

El CLI también muestra `Estado de verificación`: `not_needed`, `passed`, `failed` o `unavailable`.

## 6. Verificación y límites

Después de una escritura correcta, o de ejecutar un comando que pudiera cambiar el workspace, AgenTIA busca en `package.json` los scripts `test`, `typecheck` y `build`. Los ejecuta por este orden mediante el mismo Security Gate que usan las demás herramientas.

Si una comprobación falla, el resultado se devuelve al agente como datos no confiables para que pueda reparar y volver a intentarlo. Los ciclos están limitados por `verificationMaxCycles`, con valor predeterminado `3`; nunca se repiten indefinidamente. Si no se detecta ningún script, el resultado se marca como no verificado y el proceso termina con código `2`.

`maxIter` limita las iteraciones del agente. Alcanzarlo no equivale a éxito.

## 7. Memoria y personalización por proyecto

Inicialice la estructura opcional del proyecto:

```powershell
cd C:\codigo\mi-proyecto
ia-agent init
```

El comando crea únicamente archivos ausentes, sin sobrescribir los existentes:

```text
.ia/
  identity.md       propósito y personas usuarias
  architecture.md   módulos y responsabilidades
  technologies.md   lenguajes, runtimes y versiones
  rules.md          reglas y convenciones de desarrollo
  style.md          formato, nombres y documentación
  lessons.md        errores conocidos y decisiones previas
  constraints.md    límites funcionales o técnicos
  security.md       precauciones del proyecto
```

También se reconocen `conventions.md` junto a `rules.md` y `decisions.md` junto a `lessons.md`. AgenTIA selecciona secciones por palabras relacionadas con la tarea, usa `identity` y `conventions` como respaldo y limita cada sección enviada inicialmente a 2.000 caracteres. No carga toda `.ia/` para cada petición.

La memoria del proyecto conserva la procedencia `project_memory` y se trata como datos no confiables. Las reglas de `.ia/` pueden orientar estilo y decisiones, pero no pueden aumentar permisos, cambiar la SecurityPolicy, desactivar límites ni convertirse en instrucciones de sistema.

## 8. Seguridad práctica

Antes de cada herramienta el Security Gate valida esquema, permisos, rutas y riesgo léxico. Las rutas se validan mediante rutas reales para evitar traversal, rutas absolutas externas y escapes por enlaces simbólicos. Se bloquea el acceso a `.git`, `.env` y variantes de `.env`.

Las operaciones destructivas obvias, cadenas de comandos, shells secundarias, ejecución indirecta y otros patrones de riesgo quedan bloqueados porque no existe una interfaz de aprobación humana. La salida de los comandos y de las lecturas se limita, y el timeout de la herramienta de comandos es de 30 segundos.

Estas medidas no detectan todas las formas posibles de una orden dañina. En modo `edit`, un comando permitido sigue teniendo los permisos de su usuario. No use AgenTIA como frontera de seguridad frente a código hostil; revise cambios y trabaje en repositorios con control de versiones.

El contenido de archivos, `.ia/`, resultados de herramientas y datos externos llega al modelo como datos de baja confianza. No puede convertirse en un mensaje `system` ni alterar permisos o políticas aplicados por el motor.

## 9. Pruebas, compilación y benchmark

Desde el repositorio de AgenTIA:

```powershell
npm test
npm run build
npm run benchmark
```

El benchmark copia cada fixture a `benchmarks/runs/`, ejecuta la tarea con modo explícito y comprueba aserciones de contenido, ausencia de cambios en tareas de solo lectura y pruebas de comportamiento cuando la fixture las exige. En cada `run.json` registra proveedor, modelo, límites no secretos, commit, modo, duración, métricas, estado de verificación y fallos de aceptación.

Los estados distinguen `success`, `acceptance_failed`, `provider_error`, `max_iterations`, `verification_failed`, `unverified`, `failure` y `process_error`. Una cuota agotada o una caída del proveedor es `provider_error`, no una tarea resuelta.

## 10. Diagnóstico de problemas

- `ia-agent` no se reconoce: ejecute `npm run build` y `npm link` de nuevo, o use la alternativa con `npx tsx` indicada en la instalación.
- `doctor` informa de una clave faltante: defina la variable del proveedor en la misma sesión de PowerShell o cambie a Ollama.
- Error de cuota o red: el proveedor remoto no está disponible o ha agotado cuota. Espere, ajuste la cuenta o use Ollama local. La tarea no se habrá completado automáticamente.
- Error de conexión con Ollama: inicie Ollama y compruebe que el modelo indicado existe con `ollama list`.
- Una operación queda bloqueada: use una tarea más concreta; no intente evadir el Security Gate con cadenas, shells secundarias o rutas alternativas.
- Código de salida `2`: el cambio se aplicó, pero el proyecto no tenía scripts `test`, `typecheck` o `build`. Ejecute una comprobación apropiada manualmente y añádala a `package.json` si procede.
- La verificación falla: lea el resultado final y el estado, repare el problema o revierta el cambio con las herramientas habituales de su repositorio.

## 11. Privacidad y datos enviados

Con Gemini u OpenRouter, el proveedor recibe la instrucción de sistema, su tarea, las secciones seleccionadas de `.ia/`, definiciones de herramientas y los resultados de herramientas necesarios para la conversación. Esto puede incluir fragmentos de código o mensajes de comandos. Evite trabajar con secretos y datos personales que no deban salir del ordenador.

Las claves se leen solo de variables de entorno y no se imprimen ni se guardan en la plantilla global. Los comandos, archivos y tests se ejecutan localmente. Con Ollama local, las solicitudes de modelo pueden permanecer locales; con un endpoint de Ollama remoto, se aplican las políticas de ese endpoint.
