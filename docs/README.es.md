# Guía de Git Sentinel

Git Sentinel es una aplicación de escritorio Linux, local-first, para observar varios repositorios Git desde un solo lugar. Ayuda a decidir qué necesita atención sin reemplazar Git, un IDE, la terminal ni tu flujo habitual.

## Contenido

- [Primeros pasos](#primeros-pasos)
- [Cómo leer el estado de un repositorio](#cómo-leer-el-estado-de-un-repositorio)
- [Acciones y actividad](#acciones-y-actividad)
- [Personalidades e idiomas](#personalidades-e-idiomas)
- [Modelo de seguridad](#modelo-de-seguridad)
- [Plataformas y limitaciones](#plataformas-y-limitaciones)
- [Arquitectura](#arquitectura)
- [Contribuir](#contribuir)

## Primeros pasos

En el primer inicio, elige una personalidad visual, el idioma de la interfaz y cómo debe llamarte Sentinel. Añade una o varias carpetas de repositorios Git locales desde HQ. Sentinel valida cada carpeta antes de registrarla, omite duplicados y guarda solamente las rutas y sus propias preferencias.

La inspección inicial es local y ocurre detrás de una pantalla nativa de inicio. Mientras un repositorio todavía no devuelve un resultado, aparece como cargando; nunca se cuenta como saludable solo porque la inspección está pendiente.

## Cómo leer el estado de un repositorio

HQ agrupa repositorios por urgencia. La presentación puede cambiar según la personalidad, pero los hechos son idénticos.

### Rama actual

La rama actual se muestra junto al nombre del repositorio cuando HEAD está attached. Un HEAD desacoplado se indica explícitamente. Los conflictos tienen prioridad visual sobre el estado desacoplado, porque resolverlos es la necesidad inmediata.

### Local

La señal **Local** describe el working tree. Puede mostrar un árbol limpio, un total compacto de cambios locales o el número de conflictos. El texto secundario detalla archivos en stage, modificados, eliminados y sin seguimiento.

### Upstream

La señal **Upstream** compara la rama actual con su propia rama de tracking. Puede indicar sincronizada, adelante, atrás, divergida, no disponible o sin upstream.

“Tracking no disponible” significa que Sentinel no tiene información Git suficiente para hacer la comparación. **No** significa que el upstream haya desaparecido.

### Referencia

La señal opcional **Referencia** compara la rama actual con la rama de referencia configurada para el proyecto. Se mantiene separada del upstream de forma intencional. Una feature puede estar sincronizada con su upstream y aun así diferir de `origin/main`, `origin/homolog` u otra referencia del proyecto.

### Actualidad

Los datos de tracking remoto son una instantánea local. Sentinel muestra cuándo buscó las refs remotas por última vez, ya que los números de adelante/atrás no prueban el estado actual de un servidor. El Fetch automático es opcional, está desactivado por defecto y solo funciona mientras la aplicación está abierta.

## Acciones y actividad

### Actualizar

Actualizar vuelve a inspeccionar un repositorio usando solo información Git local. No usa red. Sentinel también observa metadatos Git locales relevantes con debounce; por eso, un commit externo o un cambio en el working tree actualiza solo el repositorio afectado.

### Fetch y Fetch en todos

Fetch actualiza las refs de tracking remoto de un repositorio. Fetch en todos realiza el mismo trabajo en la fleet con un límite pequeño de concurrencia. Los comandos de red se ejecutan fuera del event loop gráfico, por lo que la aplicación sigue siendo navegable mientras la operación está en curso.

### Push y revisión de solo lectura

Push es una acción explícita de `git push` normal para una rama con commits esperando su upstream configurado. Git Sentinel nunca usa force. Repository Details también puede listar archivos modificados y mostrar diffs staged y unstaged sin escribir en el árbol de trabajo ni en el índice.

La franja de actividad informa progreso de inspecciones y fetches, incluidos completados, fallos y un repositorio activo. Las acciones incompatibles pueden deshabilitarse temporalmente, pero la navegación permanece disponible.

### Otras acciones

- **Abrir en Terminal** abre la ruta del repositorio en un emulador de terminal disponible.
- **Abrir carpeta** abre el directorio en el gestor de archivos.
- **Quitar de Sentinel** elimina solamente el registro guardado por Sentinel. Nunca elimina el repositorio ni modifica su historial Git. Si una carpeta registrada se elimina fuera de Sentinel, su entrada sigue visible como no disponible hasta que decidas quitarla.

## Personalidades e idiomas

Technical, Cute, Sci-Fi, Jarbas, Retro, Line Art, Pixel Art y Modern Glass son presentaciones compartidas de una única aplicación. No implementan lógicas Git independientes. Cambiar de personalidad modifica el tratamiento visual y pequeños matices de tono, nunca los hechos Git.

La interfaz está disponible en inglés, portugués de Brasil y español. Las refs, rutas, hashes y resultados de comandos Git se mantienen factuales y no se traducen.

## Modelo de seguridad

Git Sentinel es un observador con una acción explícita de publicación: Push normal. No ofrece pull, checkout, merge, rebase, reset, stash ni creación de ramas. Tampoco instala hooks Git en los repositorios registrados.

Fetch es la única operación Git que usa red. Actualiza referencias de tracking, pero nunca integra cambios remotos en la rama de trabajo.

Sentinel no administra GitHub, GitLab, SSH, HTTPS, OAuth, tokens ni credenciales. La autenticación sigue siendo responsabilidad de la configuración Git existente en el sistema.

## Plataformas y limitaciones

La aplicación se desarrolla actualmente para Linux, especialmente para entornos Debian y Ubuntu. Windows y macOS todavía no están listos ni son compatibles.

Límites actuales:

- Fetch automático es opt-in y solo funciona con la aplicación abierta; no hay servicio de polling remoto;
- no hay notificaciones de escritorio, tray ni cuenta alojada;
- no hay sincronización en la nube;
- abrir la terminal depende de un emulador compatible instalado;
- el estado remoto es tan reciente como el último fetch exitoso.

## Arquitectura

```text
Repositorio Git
  -> inspección mediante el core Rust
  -> RepositoryState normalizado
  -> comandos Tauri y watcher local
  -> estado React compartido
  -> presentación de personalidad
```

El core Rust recoge hechos Git mediante argumentos explícitos y salidas legibles por máquina. Produce un `RepositoryState` normalizado; el frontend deriva prioridad de la fleet, copy humano, señales, traducciones y presentación visual desde esos hechos. Así, el comportamiento Git y la apariencia permanecen separados.

## Contribuir

Ejecuta las verificaciones antes de proponer un cambio:

```bash
npm test
npm run test:core
npm run build
```

Son bienvenidos los portes de plataforma, documentación, accesibilidad, traducciones, refinamientos de diseño y cobertura de pruebas. Git Sentinel usa la [Licencia MIT](../LICENSE), por lo que también puedes hacer un fork y adaptarlo a tu flujo de trabajo.
