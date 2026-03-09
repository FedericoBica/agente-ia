// src/nodes/agendador.js
// ============================================
// NODO 3: Agendador de Visitas
// Valida datos de contacto y registra la visita
// ============================================

import { ChatGroq } from '@langchain/groq';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { guardarVisita, upsertLead } from '../memory/database.js';

const llm = new ChatGroq({
  model: 'llama-3.1-8b-instant',
  temperature: 0.3,
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Valida si tenemos los datos mínimos para agendar
 */
function tieneDatosContacto(userInfo) {
  return !!(userInfo?.nombre && userInfo?.telefono);
}

const SYSTEM_AGENDADOR = `Eres un asesor inmobiliario que está agendando una visita a una propiedad.
Responde en español, sé amable y profesional.
Usa emojis para mensajes de WhatsApp.`;

/**
 * Nodo Agendador
 */
export async function nodoAgendador(state) {
  console.log('[NODO] Agendador → Procesando solicitud de visita...');

  // APLICADO: Blindaje contra undefined/null en el estado
  const { 
    messages = [], 
    user_info = {}, 
    userId, 
    propiedades_encontradas = [] 
  } = state;

  // ── CASO 1: Faltan datos de contacto ──────────────────────────────
  if (!tieneDatosContacto(user_info)) {
    console.log('[NODO] Agendador → Faltan datos de contacto, solicitándolos...');

    const faltantes = [];
    if (!user_info?.nombre) faltantes.push('tu nombre completo');
    if (!user_info?.telefono) faltantes.push('tu número de teléfono');

    const prompt = `El cliente quiere agendar una visita pero le faltan estos datos: ${faltantes.join(' y ')}.
Pídele amablemente que los proporcione para poder confirmar la visita.
Si ya mencionó alguna propiedad de interés, inclúyela en el mensaje.`;

    try {
      const response = await llm.invoke([
        new SystemMessage(SYSTEM_AGENDADOR),
        new HumanMessage(prompt),
      ]);
      const respuesta = new AIMessage(response.content);
      return {
        messages: [respuesta],
        respuesta_final: response.content,
        visita_agendada: false,
      };
    } catch {
      const fallback = new AIMessage(
        `Para agendar tu visita necesito: ${faltantes.join(' y ')}. ` +
        `¿Podés proporcionarlos? 😊`
      );
      return {
        messages: [fallback],
        respuesta_final: fallback.content,
        visita_agendada: false,
      };
    }
  }

  // ── CASO 2: Tenemos datos, proceder a agendar ─────────────────────
  console.log('[NODO] Agendador → Datos completos, agendando visita...');

  const propiedadId = propiedades_encontradas?.[0]?.id || null;

  // Guardar en DB
  const visitaId = await guardarVisita(userId, {
    nombre: user_info.nombre,
    telefono: user_info.telefono,
    propiedad_id: propiedadId,
    fecha_visita: null,
    hora_visita: null,
  });

  // Actualizar estado del lead
  await upsertLead(userId, {
    nombre: user_info.nombre,
    telefono: user_info.telefono,
    email: user_info.email,
    intent: 'agendar',
    estado: 'visita_agendada',
  });

  const propiedad = propiedades_encontradas?.[0];

  const prompt = `La visita fue agendada exitosamente. ID de reserva: ${visitaId || 'VIS-' + Date.now()}.
Datos del cliente:
- Nombre: ${user_info.nombre}
- Teléfono: ${user_info.telefono}
${propiedad ? `- Propiedad: ${propiedad.titulo} en ${propiedad.barrio}` : ''}

Genera un mensaje de confirmación entusiasta que incluya:
1. Confirmación de la visita agendada
2. Que un asesor se comunicará para coordinar el día y horario exacto
3. El número de referencia de la reserva
4. Invitación a contactarnos por cualquier consulta`;

  try {
    const response = await llm.invoke([
      new SystemMessage(SYSTEM_AGENDADOR),
      new HumanMessage(prompt),
    ]);

    const respuesta = new AIMessage(response.content);
    return {
      messages: [respuesta],
      respuesta_final: response.content,
      visita_agendada: true,
    };

  } catch (err) {
    console.error('[NODO] Agendador → Error LLM:', err.message);
    const fallback = new AIMessage(
      `✅ *¡Visita agendada exitosamente!* \n\n` +
      `📋 *Confirmación para:* ${user_info.nombre}\n` +
      `📞 *Teléfono:* ${user_info.telefono}\n` +
      `${propiedad ? `🏠 *Propiedad:* ${propiedad.titulo}\n` : ''}` +
      `🔖 *Nro. de referencia:* VIS-${Date.now()}\n\n` +
      `Un asesor se comunicará contigo en las próximas horas para coordinar el día y horario. ¡Gracias! 🙏`
    );
    return {
      messages: [fallback],
      respuesta_final: fallback.content,
      visita_agendada: true,
    };
  }
}