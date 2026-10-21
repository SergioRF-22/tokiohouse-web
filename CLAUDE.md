# tokiohouse-web

Frontend PWA de TokioHouse (uso principal en móvil, 2 usuarios). Vite + React + TypeScript + vite-plugin-pwa.

## Comandos
- `npm run dev`: servidor de desarrollo (proxy `/api` → `http://localhost:3000`)
- `npm run build`: `tsc --noEmit` + `vite build`; es también la comprobación de tipos
- `npm run preview`: sirve `dist/`; el service worker solo se prueba con build + preview
- `npm run icons`: regenera los iconos placeholder de `public/`

## Reglas
- Mobile-first: diseña para ~390px de ancho primero; respeta safe areas (`env(safe-area-inset-*)`).
- La API está en `tokiohouse-api`; URL base por `VITE_API_URL` (en dev, `/api` vía proxy). Peticiones con `credentials: 'include'`; si la API responde 401, ir a /login.
- Nada de datos sensibles en localStorage; la sesión vive en la cookie HttpOnly del backend.
- Service worker: no cachear respuestas de la API (`/api/*`), solo el app shell y estáticos.
- Sin librerías de UI ni de estado globales salvo que se pida; React + CSS simple.
- Para trabajo de diseño visual, usa `/frontend-design` explícitamente.

## Despliegue
- Coolify con `Dockerfile` (build node:22-alpine + nginx). `VITE_API_URL` es build arg.
- `nginx.conf`: fallback SPA y `no-cache` en index.html, sw.js, registerSW.js y manifest.

## Compact instructions
Al compactar conserva: cambios de código hechos, comandos que fallaron y decisiones de diseño.
