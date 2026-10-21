# tokiohouse-web

Frontend de TokioHouse: PWA (Vite + React + TypeScript) para 2 personas, pensada para móvil.

## Arranque local (PowerShell)

Se necesita el backend (`../tokiohouse-api`) y este repo, cada uno en su terminal:

```powershell
# Terminal 1: API (http://localhost:3000)
cd ..\tokiohouse-api
npm install
npm run dev

# Terminal 2: web (http://localhost:5173)
cd ..\tokiohouse-web
npm install
npm run dev
```

Crea un usuario en la API (una vez):

```powershell
cd ..\tokiohouse-api
npm run user:create -- <usuario>
```

En dev el front llama a `/api/*` y el proxy de Vite lo reenvía a `http://localhost:3000/*`
(quita el prefijo `/api`). Así la cookie de sesión es same-origin y no hace falta CORS.

## Probar la PWA en el móvil (red local)

```powershell
npm run dev -- --host
```

Vite mostrará una URL `Network` (p. ej. `http://192.168.1.X:5173`); abre esa URL en el móvil
conectado a la misma wifi (si Windows pregunta por el firewall, permite redes privadas).

**Limitación:** el service worker y la instalación como PWA exigen un contexto seguro: HTTPS o
`localhost`. Por IP de red local con `http://` la app carga y funciona, pero el SW no se
registrará ni podrá instalarse. Para probar SW/instalación usa `localhost` en el PC
(`npm run build` + `npm run preview`) o un túnel HTTPS, o prueba directamente en producción.

## Variables

| Variable | Cuándo | Descripción |
|---|---|---|
| `VITE_API_URL` | build (prod) | URL base de la API, p. ej. `https://api.tokiohouse.vocadiet.es`. En dev se omite y se usa `/api` con el proxy. |

Ver `.env.example`. Al ser una variable de Vite se incrusta en el build: cambiarla exige reconstruir.

## Producción

- Web: `https://tokiohouse.vocadiet.es` (contenedor nginx con los estáticos de `dist/`).
- API: `https://api.tokiohouse.vocadiet.es`.
- Se despliega en Coolify con el `Dockerfile`; `VITE_API_URL` se pasa como build arg.
- `nginx.conf` hace fallback SPA a `index.html` y sirve con `no-cache` `index.html`, `sw.js`,
  `registerSW.js` y `manifest.webmanifest`; los assets con hash se cachean un año.
- Las peticiones van con `credentials: 'include'`, así que la API debe:
  - responder CORS con `Access-Control-Allow-Origin: https://tokiohouse.vocadiet.es` (origen exacto, no `*`) y `Access-Control-Allow-Credentials: true`;
  - emitir la cookie httpOnly con `Secure` y `SameSite=Lax` (mismo *site* `vocadiet.es`) o `SameSite=None; Secure`.

## Iconos

Los de `public/` son placeholders generados con `npm run icons`. Sustitúyelos por los definitivos
(192, 512 y maskable 512) manteniendo los nombres.

## Estructura

- `src/api.ts`: cliente de `/auth/login`, `/auth/logout`, `/auth/me`.
- `src/App.tsx`: comprueba sesión y muestra `Login` o `Home`.
