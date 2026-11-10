# Chipeo Presion V2 — Music Studio

Aplicación web de edición de audio con ecualizador de 10 bandas y control de velocidad.

## Requisitos

- Node.js 20 o superior
- npm

## Ejecutar en tu computadora

1. Descomprime el proyecto.
2. Abre una terminal dentro de la carpeta del proyecto.
3. Ejecuta `npm install`.
4. Ejecuta `npm run dev`.
5. Abre la dirección local que indique Vite.

## Publicar en Vercel

1. Sube todos los archivos de esta carpeta a un repositorio nuevo de GitHub.
2. En Vercel, importa ese repositorio.
3. Vercel detectará Vite automáticamente.
4. Usa `npm run build` como comando de compilación y `dist` como carpeta de salida.
5. Pulsa Deploy.

## Formato de exportación

La exportación genera audio con códec FLAC dentro de un contenedor OGG (`.ogg`), con nivel de compresión FLAC 8. FLAC es un códec sin pérdida: no elimina información del audio, aunque el tamaño depende del contenido original.

El procesamiento se ejecuta en el navegador con FFmpeg WebAssembly. La primera exportación necesita descargar el motor FFmpeg desde un CDN, por lo que requiere conexión a internet. Los archivos de audio no se envían a un servidor de esta aplicación.

## Nota

El control de velocidad cambia también el tono, igual que la reproducción a distinta velocidad. El ecualizador se aplica al archivo exportado.
