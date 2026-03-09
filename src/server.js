// src/server.js
// ============================================
// Servidor Express — Punto de entrada principal
// ============================================

import 'dotenv/config';
import express from 'express';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { getGraph } from './graph.js';
import {
  cargarHistorial,
  guardarMensaje,
  upsertLead,
} from './memory/database.js';

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ── Middleware de logging ──────────────────────────────────────────
app.use((req, _res, next) => {
  if (req.path !== '/health') {
    console.log(`[SERVER] ${req.method} ${req.path} - ${new Date().toISOString()}`);
  }
  next();
});

// ── Middleware de autenticación para n8n (opcional pero recomendado) ──
function verificarWebhookSecret(req, res, next) {
  const secret = req.headers['x-webhook-secret'];
  if (
    process.env.WEBHOOK_SECRET &&
    secret !== process.env.WEBHOOK_SECRET
  ) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

// ─────────────────────────────────────────────────────────────────
// POST /agente
// Endpoint principal — recibe mensajes de n8n (WhatsApp, Instagram, Email)
// Body: { userId: string, mensaje: string, channel?: string }
// ─────────────────────────────────────────────────────────────────
app.post('/agente', verificarWebhookSecret, async (req, res) => {
  const { userId, mensaje, channel = 'api' } = req.body;

  if (!userId || !mensaje) {
    return res.status(400).json({ error: 'Faltan campos requeridos.' });
  }

  const userIdLimpio = userId.trim();
  const mensajeLimpio = mensaje.trim();

  try {
    // 1. Intentar cargar historial (si falla, seguimos con array vacío)
    let mensajesHistorial = [];
    try {
      const historialDB = await cargarHistorial(userIdLimpio, 20);
      mensajesHistorial = historialDB.map(row => 
        row.role === 'human' ? new HumanMessage(row.content) : new AIMessage(row.content)
      );
    } catch (dbErr) {
      console.error('[DB] Error en historial, continuando sin él:', dbErr.message);
    }

    // 2. Intentar guardar mensaje del usuario y upsert lead
    guardarMensaje(userIdLimpio, 'human', mensajeLimpio, { channel }).catch(e => console.error("[DB] Error guardando msg"));
    upsertLead(userIdLimpio, { canal_origen: channel }).catch(e => console.error("[DB] Error upsert lead"));

    // 3. Ejecutar el grafo
    let resultado;
    try {
      resultado = await getGraph().invoke({
        messages: [...mensajesHistorial, new HumanMessage(mensajeLimpio)],
        userId: userIdLimpio,
        channel,
      }, { recursionLimit: 10 });
    } catch (graphErr) {
      console.error('[GRAPH] Error crítico en ejecución:', graphErr.message);
      // Resultado fallback si el grafo explota
      resultado = { respuesta_final: "¡Hola! Soy Sofía. En este momento tengo un inconveniente técnico para procesar tu consulta, pero ya le avisé a un asesor para que te contacte personalmente. 😊" };
    }

    const respuesta = resultado?.respuesta_final || 'Lo siento, no pude procesar tu mensaje.';
    const intent = resultado?.intent || null;

    // 4. Intentar guardar respuesta (asíncrono, no bloquea al usuario)
    if (resultado?.respuesta_final) {
      guardarMensaje(userIdLimpio, 'assistant', respuesta, {
        channel,
        intent,
        metadata: { visita_agendada: resultado.visita_agendada || false }
      }).catch(e => {});
    }

    // 5. Simular escritura y responder
    const delayMs = Math.min(Math.max(respuesta.split(' ').length * 80, 1500), 3500);
    await new Promise(resolve => setTimeout(resolve, delayMs));
    
    return res.json({
      success: true,
      respuesta,
      intent,
      visita_agendada: resultado?.visita_agendada || false,
      propiedades: resultado?.propiedades_encontradas || [],
      channel,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[AGENTE] Error total:', err);
    return res.status(200).json({ // Respondemos 200 aunque falle para que n8n no se cuelgue
      success: false,
      respuesta: "Hola! Disculpame, estoy teniendo un problema interno. ¿Podrías intentar de nuevo en unos minutos?"
    });
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /agente/whatsapp  — Adaptador específico para formato n8n/WhatsApp
// Body n8n WhatsApp: { from: string, body: string, ... }
// ─────────────────────────────────────────────────────────────────
app.post('/agente/whatsapp', verificarWebhookSecret, async (req, res) => {
  // n8n envía el mensaje de WhatsApp con esta estructura típica
  const { from, body, profileName } = req.body;

  if (!from || !body) {
    return res.status(400).json({ error: 'Payload de WhatsApp inválido.' });
  }

  // Reutilizar el endpoint principal internamente
  req.body = {
    userId: `wa_${from}`,
    mensaje: body,
    channel: 'whatsapp',
  };

  // Continuar al handler de /agente
  return app._router.handle(
    Object.assign(req, { url: '/agente', path: '/agente' }),
    res,
    () => {}
  );
});

// ─────────────────────────────────────────────────────────────────
// POST /agente/instagram — Adaptador para Instagram DM vía n8n
// ─────────────────────────────────────────────────────────────────
app.post('/agente/instagram', verificarWebhookSecret, async (req, res) => {
  const { senderId, text, username } = req.body;

  if (!senderId || !text) {
    return res.status(400).json({ error: 'Payload de Instagram inválido.' });
  }

  req.body = {
    userId: `ig_${senderId}`,
    mensaje: text,
    channel: 'instagram',
  };

  return app._router.handle(
    Object.assign(req, { url: '/agente', path: '/agente' }),
    res,
    () => {}
  );
});

// ─────────────────────────────────────────────────────────────────
// POST /agente/email — Adaptador para Email vía n8n
// ─────────────────────────────────────────────────────────────────
app.post('/agente/email', verificarWebhookSecret, async (req, res) => {
  const { from, subject, text, html } = req.body;

  if (!from || (!text && !html)) {
    return res.status(400).json({ error: 'Payload de Email inválido.' });
  }

  const contenido = text || html?.replace(/<[^>]+>/g, ' ') || '';

  req.body = {
    userId: `email_${from.replace(/[^a-zA-Z0-9]/g, '_')}`,
    mensaje: subject ? `Asunto: ${subject}\n\n${contenido}` : contenido,
    channel: 'email',
  };

  return app._router.handle(
    Object.assign(req, { url: '/agente', path: '/agente' }),
    res,
    () => {}
  );
});

// ─────────────────────────────────────────────────────────────────
// GET /health — Health check para monitoreo
// ─────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Agente Inmobiliaria IA',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ── Iniciar servidor ───────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n══════════════════════════════════════════');
  console.log('  🏠 Agente IA Inmobiliaria — ACTIVO');
  console.log(`  Puerto: ${PORT}`);
  console.log(`  Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log('══════════════════════════════════════════');
  console.log('\nEndpoints disponibles:');
  console.log(`  POST http://localhost:${PORT}/agente`);
  console.log(`  POST http://localhost:${PORT}/agente/whatsapp`);
  console.log(`  POST http://localhost:${PORT}/agente/instagram`);
  console.log(`  POST http://localhost:${PORT}/agente/email`);
  console.log(`  GET  http://localhost:${PORT}/health\n`);
});