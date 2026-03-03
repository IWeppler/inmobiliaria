# 🏡 Inmobiliaria TerraNova - Plataforma Inmobiliaria & CRM Integrado

Plataforma web de alto rendimiento diseñada para modernizar las operaciones de agencias inmobiliarias (rurales y urbanas). El sistema nació con el objetivo de superar las limitaciones de los sitios web tradicionales, creando un ecosistema digital completo que funciona como una verdadera herramienta de cierre de ventas.

Reemplaza los catálogos estáticos y la gestión desordenada de clientes por un portal público optimizado para SEO y un potente panel de administración (CRM) para los agentes.

## 🚀 Funcionalidades Principales

### 1. 🏢 Portal Público de Alta Conversión (Frontend)

Diseñado para captar la atención del cliente y facilitar el contacto inmediato.

- **Buscador Avanzado:** Filtros dinámicos por tipo de operación (Venta/Alquiler), tipo de propiedad, ubicación y comodidades.

- **SEO Técnico:** Implementación de JSON-LD, OpenGraph, optimización de imágenes (Next/Image) y enrutamiento instantáneo para máxima visibilidad en Google.

Herramientas de Conversión: Integración rápida con WhatsApp, mapas satelitales interactivos y contador de visitas por propiedad.

### 2. 💼 CRM Integrado y Gestión de Leads (Core)

El panel de control donde los agentes cierran las ventas.

- **Pipeline de Leads:** Captura automática de consultas desde la web y asignación a agentes específicos.

- **Colaboración Interna:** Sistema de notas internas en cada lead y chat para seguimiento del historial del cliente.

- **Gestión de Propiedades:** ABM (Alta, Baja, Modificación) completo de propiedades, galerías de imágenes y características técnicas.

### 3. 🔐 Arquitectura de Seguridad y Roles (RBAC)

Control granular de quién ve qué información.

-  **Row Level Security (RLS):** Políticas de seguridad a nivel de base de datos implementadas en Supabase.

- **Gestión de Equipos:** Permisos diferenciados entre Administradores (acceso total) y Agentes Inmobiliarios (acceso restringido a sus propios leads y propiedades asignadas).

## 🛠 Tech Stack

Arquitectura moderna, tipada y construida para la escalabilidad.

- **Frontend:** [Next.js 15](https://nextjs.org/) (App Router)
- **Lenguaje:** [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **UI & Estilos:** [Tailwind CSS](https://tailwindcss.com/) + [Shadcn UI](https://ui.shadcn.com/)
- **Base de Datos & Auth:** [Supabase](https://supabase.com/) (PostgreSQL + RLS)
- **Manejo de Formularios:** React Hook Form + Zod
- **Iconos:** Lucide React

## 📂 Estructura de Base de Datos (Resumen)

El modelo de datos conecta el inventario público con la gestión comercial privada.

`properties:` Catálogo maestro de inmuebles (precio, ubicación, características).

`agents:` Perfiles de los agentes inmobiliarios y sus datos de contacto.

`leads:` Registro de prospectos y consultas entrantes desde la web.

`property_views:` Tabla analítica para el contador de visitas únicas.

`internal_notes:` Historial de interacciones y comentarios privados sobre cada lead.

## 🚀 Instalación y Setup

1. **Clonar repositorio:**

git clone [https://github.com/tu-usuario/terranova-crm.git](https://github.com/tu-usuario/terranova-crm.git)


2.  **Instalar dependencias:**
pnpm install


3.  **Variables de Entorno:**
Configurar .env.local con las credenciales de Supabase:

NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...


4.  **Correr el proyecto:**
pnpm run dev


## 🔮 Roadmap / Próximos Pasos

El sistema se encuentra en constante evolución para automatizar el 100% del flujo de trabajo del agente inmobiliario:

1. Smart WhatsApp Integration: Mensajes pre-llenados dinámicamente según la URL de la propiedad.

2. Share Button & OG Tags Dinámicos: Generación de tarjetas de previsualización enriquecidas para compartir propiedades en redes sociales.

3. Framer Motion UI: Transiciones fluidas y expansiones de galerías de imágenes nativas para una experiencia premium (estilo Airbnb).

4. Generador de Descripciones con IA: Integración de Vercel AI SDK para redactar textos de venta persuasivos y optimizados para SEO con un solo clic.

5. Fichas PDF Automáticas: Generación de brochures comerciales descargables (@react-pdf/renderer) listos para enviar al cliente o imprimir.

Desarrollado para potenciar el mercado inmobiliario. 🏡🔑