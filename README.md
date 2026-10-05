# InvoTrack frontend

Aplicación React/Vite de gestión de facturas y gastos. Este directorio es el
futuro proyecto `invotrack-frontend`. La API Express se desarrolla y ejecuta
desde `server/` durante la preparación local; el frontend no importa archivos
de ese directorio.

## Arquitectura actual

- Supabase Auth mantiene la sesión del usuario en el navegador.
- Clientes, proveedores y productos usan la API Express bajo `/api/v1`.
- Empresas, facturas, pagos, reportes y alertas aún consultan Supabase con RLS.
- OCR, ARCA y notificaciones usan Supabase Edge Functions.

## Instalación y ejecución

```bash
npm install
```

Copiá `.env.example` a `.env` y configurá `VITE_SUPABASE_URL` y
`VITE_SUPABASE_ANON_KEY` del mismo proyecto Supabase. Configurá
`VITE_API_URL` con la URL completa del backend, por ejemplo
`http://localhost:3001/api/v1`. Solo `VITE_*` se expone al navegador:
nunca coloques `service_role` ni secretos de ARCA allí.

```bash
npm run dev
npm run build
npm run lint
npm run test
```

Durante desarrollo, si se omite `VITE_API_URL`, `src/lib/apiClient.js`
usa `/api/v1` y Vite redirige `/api` a `http://localhost:3001`.
Con una API en otro origen, definí `VITE_API_URL` y habilitá ese origen en
`CORS_ORIGIN` del backend. El backend tiene su propio `package.json`, `.env`
y comandos; no necesita instalar este proyecto.

Para Google OAuth, habilitá el proveedor y agregá la URL de redirección del
frontend en Supabase Auth. Las Edge Functions deben estar desplegadas en el
mismo proyecto Supabase; `npm run dev` no las despliega.

## Separación pendiente de Git

El contenido de `server/` será el futuro repositorio `invotrack-backend`.
Contiene `supabase/` (schema, migraciones, configuración y Edge Functions)
y `scripts/arca/` (utilidades de homologación). El resto de este directorio
será `invotrack-frontend`. Todavía no se creó ni publicó ningún repositorio.
