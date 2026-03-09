// src/state.js
// ============================================
// Definición del Estado del Grafo (LangGraph)
// ============================================

import { Annotation, messagesStateReducer } from '@langchain/langgraph';

/**
 * Estado principal del agente inmobiliario.
 * LangGraph usa "Annotations" para definir el esquema y
 * los reducers de cada campo del estado.
 */
export const AgenteState = Annotation.Root({

  // ── Historial de mensajes (acumulativo) ──────────────────────────
  // messagesStateReducer añade mensajes sin reemplazar el array completo
  messages: Annotation({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  // ── Identificador único del usuario/conversación ─────────────────
  userId: Annotation({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // ── Canal de origen del mensaje ──────────────────────────────────
  // 'whatsapp' | 'instagram' | 'email' | 'api'
  channel: Annotation({
    reducer: (_, next) => next,
    default: () => 'api',
  }),

  // ── Intención detectada por el clasificador ───────────────────────
  // 'comprar' | 'alquilar' | 'agendar' | 'consulta_general' | null
  intent: Annotation({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // ── Información del usuario capturada durante la conversación ─────
  user_info: Annotation({
    reducer: (prev, next) => ({ ...prev, ...next }), // merge incremental
    default: () => ({
      nombre: null,
      telefono: null,
      email: null,
      presupuesto: null,
      zona_preferida: null,
    }),
  }),

  // ── Propiedades encontradas por el buscador ───────────────────────
  propiedades_encontradas: Annotation({
    reducer: (_, next) => next,
    default: () => [],
  }),

  // ── Respuesta final que se enviará al usuario ─────────────────────
  respuesta_final: Annotation({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // ── Indica si la visita fue agendada exitosamente ─────────────────
  visita_agendada: Annotation({
    reducer: (_, next) => next,
    default: () => false,
  }),

});