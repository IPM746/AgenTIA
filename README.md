# AgenTIA

AgenTIA es un agente personal de programación para trabajar desde la terminal en proyectos locales. Puede leer y editar archivos dentro del workspace, ejecutar comprobaciones permitidas y usar un proveedor LLM configurable.

La primera versión personal prioriza resultados trazables y límites claros:

- herramientas con resultados estructurados, estados de error y códigos de salida;
- modos explícitos de solo lectura y edición;
- Security Gate para permisos, rutas, enlaces simbólicos, archivos sensibles y comandos de riesgo;
- verificación acotada tras cambios con `test`, `typecheck` y `build` cuando el proyecto los define;
- configuración global sin secretos y conocimiento por proyecto en `.ia/`;
- benchmarks aislados con criterios de aceptación sobre archivos y pruebas reales.

No es un sandbox ni una herramienta de aislamiento de procesos. Los comandos permitidos se ejecutan con los permisos del usuario. Tampoco incluye una GUI, multiagente ni un sistema de skills integrado en el flujo normal.

## Inicio rápido

En Windows 11, tras instalar Node.js y Git:

```powershell
git clone https://github.com/IPM746/AgenTIA.git
cd AgenTIA
npm install
npm test
npm run build
npm link
```

Configura un proveedor y comprueba el entorno:

```powershell
ia-agent doctor
```

Desde el directorio de un proyecto:

```powershell
ia-agent init
ia-agent --mode read-only "Explica la arquitectura de este proyecto"
ia-agent --mode edit "Corrige el fallo de las pruebas y verifica el cambio"
```

Si se omite `--mode`, el modo actual por compatibilidad es `edit`. Para revisiones y exploración usa siempre `--mode read-only`.

## Documentación

- [Guía de uso en español](docs/GUIA_USO.md): instalación, proveedores, configuración, seguridad, `.ia/`, verificación y diagnóstico.
- [Ejemplos de uso](docs/EJEMPLOS_USO.md): comandos que se pueden copiar y adaptar.

## Desarrollo

```powershell
npm test
npm run build
npm run benchmark
```

Las ejecuciones de benchmark se realizan sobre copias de las fixtures y se guardan en `benchmarks/runs/`, que está excluido de Git. Un benchmark puede terminar como `provider_error` si el proveedor remoto agota cuota o no está disponible; eso no se registra como éxito.

## Estado

El proyecto está preparado para uso personal supervisado. Las protecciones reducen riesgos frecuentes, pero no sustituyen la revisión humana, copias de seguridad ni un sandbox real. Consulta la guía antes de usar el modo de edición en un repositorio importante.
