# InvoTrack

Plataforma SaaS de gestión de facturas y gastos para PyMEs argentinas.

## Arquitectura en una mirada

InvoTrack tiene un frontend React en `src/`, una API Express en `server/` y
Supabase para autenticación, PostgreSQL y funciones Edge. El frontend no envía
todas las operaciones a Express: algunos módulos consultan Supabase directamente.

```text
Navegador (React, src/)
├── Supabase Auth ─────────────────────────── sesión y usuarios
├── API Express (server/, /api/v1) ───────── clientes, proveedores y productos
├── Supabase PostgreSQL + RLS ────────────── empresas, facturas, pagos y reportes
└── Supabase Edge Functions ───────────────── ARCA, OCR y notificaciones
```

## Stack

- React 19, Vite 8, React Router 7 y Tailwind CSS 4.
- TanStack Query, React Hook Form, Zod, Radix UI y Recharts.
- Node.js y Express 5 para la API propia.
- Supabase Auth, PostgreSQL con RLS y Edge Functions.
- Vitest y `fast-check` para pruebas.

## Estructura del proyecto

```text
src/                    Frontend React
├── main.jsx            Monta la aplicación
├── App.jsx             Proveedores de Auth, Company, Query y Toast
├── app/router.jsx      Rutas públicas, protegidas y onboarding
├── layouts/            Estructuras visuales y controles de acceso
├── components/ui/      Controles compartidos
├── lib/                Cliente Supabase, cliente API y utilidades
└── features/           Módulos de negocio
server/src/             API Express: rutas, middleware, módulos y repositorios
supabase/               Esquema SQL, migraciones y Edge Functions
scripts/                Arranque local y utilidades de ARCA
```

`src/features/` contiene `auth`, `companies`, `landing`, `dashboard`,
`invoices`, `clients`, `providers`, `products`, `ocr`, `reports`, `alerts` y
`settings`. Cada módulo puede incluir `pages/` (pantallas), `components/`,
`hooks/`, `services/` (acceso a datos), `schemas/` y `__tests__/`. Los imports
del frontend usan el alias `@/` para `src/`.

### Flujo del frontend

`main.jsx` monta React y `App.jsx` instala los proveedores de caché, sesión,
empresa y notificaciones. `app/router.jsx` selecciona la pantalla y usa los
layouts para proteger rutas. Las pantallas llaman a hooks y servicios; estos
últimos consultan la API Express o Supabase. Los contextos entregan la sesión y
la empresa activa a los componentes, que pasan sus identificadores a los
servicios.

### OCR

`src/features/ocr/services/ocrService.js` valida el archivo, elige un adaptador,
extrae texto y normaliza los campos. Hay adaptadores para mock, Google Document
AI y GPT-4V; los proveedores externos se llaman desde Edge Functions. Para
agregar uno nuevo, extendé `BaseOcrAdapter` e implementá `extractText(file)`.

## Supabase

- `src/lib/supabase.js` crea el cliente del navegador con la URL del proyecto y
  la clave pública o `anon`; Supabase Auth mantiene la sesión.
- `supabase/schema.sql` define el esquema base: perfiles, empresas, roles,
  clientes, proveedores, facturas, ítems, pagos, adjuntos, alertas y auditoría.
- `supabase/migrations/` agrega cambios posteriores, entre ellos productos,
  stock, ficha fiscal, tokens ARCA, ajustes de RLS y vistas financieras como
  `invoice_financial_summary` y `company_cash_flow`. **`schema.sql` por sí solo
  no representa todos los cambios usados por el código actual.** Al preparar
  una base, revisá y aplicá las migraciones pendientes según su estado.
- `supabase/functions/` contiene `afip-emit` y `afip-validate` (ARCA),
  `ocr-google` y `ocr-gpt4v` (OCR), `check-alerts` (generación de alertas) y
  `send-notification` (correo con Resend). `_shared/` reúne código de ARCA.
- `supabase/config.toml` contiene la configuración del proyecto y de las
  funciones de ARCA.

Los datos de negocio se organizan por `company_id` y se protegen con políticas
RLS. Las credenciales `service_role` y las claves de proveedores externos deben
quedar en el servidor o en los secretos de las Edge Functions, nunca en `VITE_*`.

## Backend propio

`server/src/index.js` inicia Express; `server/src/app.js` monta las rutas bajo
`/api/v1`. `routes/catalogRoutes.js` implementa el CRUD de clientes, proveedores
y productos y valida los datos con Zod. `middleware/authMiddleware.js` verifica
el JWT de Supabase, la membresía de la empresa y el rol requerido. Las consultas
normales usan el JWT del usuario para aplicar RLS y filtran por `company_id`.

`routes/invoiceRoutes.js`, `controllers/`, `modules/` y `repositories/`
implementan `POST /api/v1/invoices/emit`: emite con ARCA mediante Express y
guarda el resultado en Supabase. **El formulario actual del frontend no usa esa
ruta.** Invoca la Edge Function `afip-emit` para solicitar el CAE en homologación
y luego guarda la factura y sus ítems desde `invoiceService`.

Auth, empresas, facturas, pagos, dashboard, reportes y alertas consultan
Supabase desde el frontend. Clientes, proveedores y productos usan
`src/lib/apiClient.js` para comunicarse con Express. OCR y notificaciones
también invocan Edge Functions.

### Arranque local

1. Instalá las dependencias de ambos paquetes:

   ```bash
   npm install
   npm install --prefix server
   ```

2. Copiá `.env.example` a `.env` y completá `VITE_SUPABASE_URL` y
   `VITE_SUPABASE_ANON_KEY`. Usá la URL base del proyecto
   (`https://<proyecto>.supabase.co`), sin `/rest/v1`.

3. Copiá `server/.env.example` a `server/.env`. Configurá `SUPABASE_URL` y
   `SUPABASE_ANON_KEY` para el mismo proyecto, o dejá que el servidor tome los
   valores públicos de `.env`. La ruta Express de emisión requiere además
   `SUPABASE_SERVICE_ROLE_KEY` y `AFIPSDK_ACCESS_TOKEN`.

4. Prepará Supabase con el esquema base y las migraciones pendientes para tu
   base de datos. Las Edge Functions necesitan despliegue y secretos propios;
   `npm run dev` no las despliega.

5. Iniciá frontend y API juntos desde la raíz:

   ```bash
   npm run dev
   ```

   El frontend se sirve normalmente en `http://localhost:5173` y la API en
   `http://localhost:3001`. Vite redirige `/api` a la API. Verificá
   `http://localhost:3001/api/v1/health` (devuelve `ok: true`). También podés
   iniciarlos por separado con `npm run dev:web` y `npm run dev:api`.

Para el registro con Google, habilitar Google en Supabase Authentication y
agregar `http://localhost:5173/dashboard` a las Redirect URLs permitidas.
Reiniciar Vite después de cambiar `.env`.

En producción, configurar `VITE_API_URL` con la URL pública de la API terminada
en `/api/v1`, o dirigir `/api` al servidor Express desde el proxy de despliegue.
Configurar `CORS_ORIGIN` con el origen público del frontend.

La clave `service_role` nunca se coloca en una variable `VITE_*` ni se envía al
navegador.

### Rutas de catálogo

Todas las rutas salvo `health` requieren `Authorization: Bearer <token de Supabase>`.
El servidor verifica la membresía de la empresa y consulta PostgreSQL con ese
token, por lo que también se aplican las políticas RLS.

- `GET /api/v1/companies/:companyId/{clients|providers|products}`: lista con
  `search`, `page` y `pageSize` (máximo 100).
- `GET /api/v1/companies/:companyId/{clients|providers|products}/:id`: detalle.
- `POST /api/v1/companies/:companyId/{clients|providers|products}`: crear
  (admin o accountant).
- `PATCH /api/v1/companies/:companyId/{clients|providers|products}/:id`:
  actualizar (admin o accountant).
- `DELETE /api/v1/companies/:companyId/{clients|providers|products}/:id`:
  eliminar (solo admin).

## Comandos útiles

```bash
npm run lint           # ESLint
npm run test           # Vitest, una ejecución
npm run test:watch     # Vitest en modo observación
npm run test:coverage  # Cobertura
npm run build          # Build del frontend
```
