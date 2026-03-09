// src/memory/database.js
// ============================================
// Módulo de Memoria Persistente con PostgreSQL
// ============================================

import pg from 'pg';
const { Pool } = pg;

// Pool de conexiones reutilizable
let pool;

export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    
    // Si no hay URL, avisamos pero no explotamos
    if (!connectionString) {
      console.warn('[DB] ADVERTENCIA: DATABASE_URL no definida. El bot funcionará sin memoria.');
      return null;
    }

    pool = new Pool({
      connectionString,
      // Forzamos a que no use SSL si estamos en local para evitar errores de certificado
      ssl: false, 
      max: 10,
      connectionTimeoutMillis: 5000, // No esperar una eternidad
    });

    pool.on('error', (err) => {
      console.error('[DB] Error en el pool:', err.message);
    });
  }
  return pool;
}

/**
 * Recupera el historial de mensajes de un usuario
 * @param {string} userId - ID único del usuario
 * @param {number} limit - Máximo de mensajes a recuperar (contexto)
 * @returns {Array} - Array de { role, content }
 */
export async function cargarHistorial(userId, limit = 20) {
  const db = getPool();
  if (!db) return [];
  try {
    const result = await db.query(
      `SELECT role, content
       FROM chat_history
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    // Revertir para orden cronológico (más antiguo primero)
    return result.rows.reverse();
  } catch (err) {
    console.error('[DB] Error cargando historial:', err.message);
    return [];
  }
}

/**
 * Guarda un mensaje en el historial
 * @param {string} userId
 * @param {string} role - 'human' | 'assistant'
 * @param {string} content
 * @param {object} opciones - { channel, intent, metadata }
 */
export async function guardarMensaje(userId, role, content, opciones = {}) {
  const db = getPool();
  if (!db) return [];
  const { channel = 'api', intent = null, metadata = {} } = opciones;
  try {
    await db.query(
      `INSERT INTO chat_history (user_id, role, content, channel, intent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, role, content, channel, intent, JSON.stringify(metadata)]
    );
  } catch (err) {
    console.error('[DB] Error guardando mensaje:', err.message);
  }
}

/**
 * Upsert de lead (crea o actualiza datos del usuario)
 * @param {string} userId
 * @param {object} datos - { nombre, telefono, email, canal_origen, intent, estado }
 */
export async function upsertLead(userId, datos = {}) {
  const db = getPool();
  if (!db) return [];
  const { nombre, telefono, email, canal_origen, intent, estado } = datos;
  try {
    await db.query(
      `INSERT INTO leads (user_id, nombre, telefono, email, canal_origen, intent, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id) DO UPDATE
       SET
         nombre       = COALESCE($2, leads.nombre),
         telefono     = COALESCE($3, leads.telefono),
         email        = COALESCE($4, leads.email),
         intent       = COALESCE($6, leads.intent),
         estado       = COALESCE($7, leads.estado),
         updated_at   = NOW()`,
      [userId, nombre, telefono, email, canal_origen, intent, estado]
    );
  } catch (err) {
    console.error('[DB] Error upsertando lead:', err.message);
  }
}

/**
 * Guarda una visita agendada
 */
export async function guardarVisita(userId, datosVisita = {}) {
  const db = getPool();
  if (!db) return [];
  const { nombre, telefono, propiedad_id, fecha_visita, hora_visita } = datosVisita;
  try {
    const result = await db.query(
      `INSERT INTO visitas (user_id, propiedad_id, nombre, telefono, fecha_visita, hora_visita)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [userId, propiedad_id, nombre, telefono, fecha_visita, hora_visita]
    );
    return result.rows[0].id;
  } catch (err) {
    console.error('[DB] Error guardando visita:', err.message);
    return null;
  }
}