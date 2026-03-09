-- ============================================
-- SCHEMA: Agente IA Inmobiliaria (Supabase/PostgreSQL)
-- Ejecutar este script en el SQL Editor de Supabase
-- ============================================

-- Tabla principal de historial de conversaciones
CREATE TABLE IF NOT EXISTS chat_history (
  id          BIGSERIAL PRIMARY KEY,
  user_id     TEXT        NOT NULL,
  role        TEXT        NOT NULL CHECK (role IN ('human', 'assistant', 'system')),
  content     TEXT        NOT NULL,
  channel     TEXT        DEFAULT 'unknown', -- 'whatsapp' | 'instagram' | 'email' | 'api'
  intent      TEXT,                          -- 'comprar' | 'alquilar' | 'agendar' | 'consulta'
  metadata    JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsquedas rápidas por usuario
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id
  ON chat_history (user_id, created_at DESC);

-- Tabla de usuarios/leads capturados
CREATE TABLE IF NOT EXISTS leads (
  id            BIGSERIAL PRIMARY KEY,
  user_id       TEXT        UNIQUE NOT NULL,
  nombre        TEXT,
  telefono      TEXT,
  email         TEXT,
  canal_origen  TEXT,
  intent        TEXT,
  estado        TEXT        DEFAULT 'nuevo', -- 'nuevo' | 'contactado' | 'visita_agendada' | 'cerrado'
  notas         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de propiedades (demo)
CREATE TABLE IF NOT EXISTS propiedades (
  id            BIGSERIAL PRIMARY KEY,
  titulo        TEXT        NOT NULL,
  tipo          TEXT        NOT NULL CHECK (tipo IN ('casa', 'apartamento', 'local', 'terreno')),
  operacion     TEXT        NOT NULL CHECK (operacion IN ('venta', 'alquiler')),
  precio        NUMERIC     NOT NULL,
  moneda        TEXT        DEFAULT 'USD',
  habitaciones  INT,
  banos         INT,
  metros        NUMERIC,
  barrio        TEXT,
  ciudad        TEXT        DEFAULT 'Buenos Aires',
  descripcion   TEXT,
  disponible    BOOLEAN     DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla de visitas agendadas
CREATE TABLE IF NOT EXISTS visitas (
  id            BIGSERIAL PRIMARY KEY,
  user_id       TEXT        NOT NULL,
  propiedad_id  BIGINT      REFERENCES propiedades(id),
  nombre        TEXT        NOT NULL,
  telefono      TEXT        NOT NULL,
  fecha_visita  DATE,
  hora_visita   TIME,
  estado        TEXT        DEFAULT 'pendiente', -- 'pendiente' | 'confirmada' | 'cancelada'
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Datos de ejemplo para propiedades
INSERT INTO propiedades (titulo, tipo, operacion, precio, habitaciones, banos, metros, barrio, descripcion) VALUES
  ('Moderno Apartamento en Palermo', 'apartamento', 'venta', 185000, 2, 1, 65, 'Palermo', 'Luminoso apto con balcón, cocina integrada y amenities.'),
  ('Casa Familiar en Belgrano', 'casa', 'venta', 420000, 4, 3, 220, 'Belgrano', 'Amplia casa con jardín, garage doble y dependencia.'),
  ('Apartamento Céntrico en Microcentro', 'apartamento', 'alquiler', 850, 1, 1, 45, 'Microcentro', 'Monoambiente remodelado, ideal profesionales.'),
  ('Casa con Pileta en Caballito', 'casa', 'alquiler', 1200, 3, 2, 150, 'Caballito', 'Casa con jardín, pileta y quincho. Pet friendly.'),
  ('Oficina Premium en Puerto Madero', 'local', 'alquiler', 2500, NULL, 2, 120, 'Puerto Madero', 'Piso completo con vista al río, cochera incluida.');