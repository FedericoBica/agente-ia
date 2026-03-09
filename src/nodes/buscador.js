// src/nodes/buscador.js
// ============================================
// NODO 2: Buscador de Propiedades
// Simula búsqueda en DB y genera respuesta con GPT
// ============================================

import { ChatGroq } from '@langchain/groq';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { getPool } from '../memory/database.js';

const llm = new ChatGroq({
  model: 'llama-3.1-8b-instant',
  temperature: 0.4,
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Busca propiedades en la base de datos según la intención y preferencias
 */
async function buscarPropiedades(intent, userInfo) {
  const db = getPool();
  const operacion = intent === 'comprar' ? 'venta' : 'alquiler';

  // Construir filtros dinámicos
  const params = [operacion];
  let whereExtra = '';

  if (userInfo?.zona_preferida) {
    params.push(`%${userInfo.zona_preferida}%`);
    whereExtra += ` AND (barrio ILIKE $${params.length} OR ciudad ILIKE $${params.length})`;
  }

  if (userInfo?.presupuesto) {
    // Intento de extraer el número del presupuesto
    const numPresupuesto = parseFloat(
      String(userInfo.presupuesto).replace(/[^0-9.]/g, '')
    );
    if (!isNaN(numPresupuesto)) {
      params.push(numPresupuesto * 1.2); // 20% de margen superior
      whereExtra += ` AND precio <= $${params.length}`;
    }
  }

  try {
    const result = await db.query(
      `SELECT id, titulo, tipo, operacion, precio, moneda,
              habitaciones, banos, metros, barrio, descripcion
       FROM propiedades
       WHERE operacion = $1 AND disponible = TRUE
       ${whereExtra}
       ORDER BY created_at DESC
       LIMIT 3`,
      params
    );
    return result.rows;
  } catch (err) {
    console.error('[NODO] Buscador → Error DB:', err.message);
    // Fallback: propiedades de demostración si la DB no está disponible
    return [
      {
        id: 1,
        titulo: 'Apartamento Luminoso en Palermo',
        tipo: 'apartamento',
        operacion,
        precio: operacion === 'venta' ? 175000 : 900,
        moneda: 'USD',
        habitaciones: 2,
        banos: 1,
        metros: 65,
        barrio: 'Palermo',
        descripcion: 'Hermoso departamento con balcón y amenities completos.',
      },
      {
        id: 2,
        titulo: 'Casa Amplia en Caballito',
        tipo: 'casa',
        operacion,
        precio: operacion === 'venta' ? 320000 : 1400,
        moneda: 'USD',
        habitaciones: 3,
        banos: 2,
        metros: 180,
        barrio: 'Caballito',
        descripcion: 'Casa con jardín y garage. Ideal para familias.',
      },
    ];
  }
}

const SYSTEM_BUSCADOR = `Eres un asesor inmobiliario profesional, amable y entusiasta.
Tu tarea es presentar las propiedades encontradas de manera atractiva y clara.
Usa emojis moderadamente para hacer el mensaje más visual (especialmente en WhatsApp).
Al final, siempre invita al usuario a agendar una visita o pedir más información.
Responde en español. Sé conciso pero informativo.`;

/**
 * Nodo Buscador
 */
export async function nodoBuscador(state) {
  console.log('[NODO] Buscador → Buscando propiedades...');

  const { messages = [], intent, user_info = {} } = state;

  // 1. Buscar propiedades
  const propiedades = await buscarPropiedades(intent, user_info);

  if (propiedades.length === 0) {
    const sinResultados = new AIMessage(
      '😔 No encontré propiedades que coincidan exactamente con tu búsqueda en este momento. ' +
      '¿Puedo ayudarte con otros criterios? También podés dejarme tu contacto y te aviso cuando tengamos nuevas opciones.'
    );
    return {
      propiedades_encontradas: [],
      messages: [sinResultados],
      respuesta_final: sinResultados.content,
    };
  }

  // 2. Formatear propiedades para el LLM
  const propiedadesTexto = propiedades.map((p, i) =>
    `Propiedad ${i + 1}:
    - Título: ${p.titulo}
    - Tipo: ${p.tipo} en ${p.operacion}
    - Precio: ${p.moneda} ${p.precio?.toLocaleString()}${p.operacion === 'alquiler' ? '/mes' : ''}
    - Habitaciones: ${p.habitaciones ?? 'N/A'} | Baños: ${p.banos ?? 'N/A'} | ${p.metros}m²
    - Barrio: ${p.barrio}
    - Descripción: ${p.descripcion}`
  ).join('\n\n');

  // 3. Generar respuesta con LLM
  const historialReciente = (messages || []).slice(-4).map(m => {
    const esHuman = m._getType?.() === 'human';
    return `${esHuman ? 'Cliente' : 'Asesor'}: ${m.content}`;
  }).join('\n');

  try {
    const response = await llm.invoke([
      new SystemMessage(SYSTEM_BUSCADOR),
      new HumanMessage(
        `Historial de conversación:\n${historialReciente}\n\n` +
        `El cliente quiere ${intent} una propiedad.\n` +
        `Zona preferida: ${user_info?.zona_preferida || 'no especificada'}\n` +
        `Presupuesto: ${user_info?.presupuesto || 'no especificado'}\n\n` +
        `Propiedades disponibles:\n${propiedadesTexto}\n\n` +
        `Presenta las propiedades de forma atractiva y termina invitando a agendar una visita.`
      ),
    ]);

    const respuesta = new AIMessage(response.content);

    return {
      propiedades_encontradas: propiedades,
      messages: [respuesta],
      respuesta_final: response.content,
    };

  } catch (err) {
    console.error('[NODO] Buscador → Error LLM:', err.message);
    const fallback = new AIMessage(
      `¡Tengo excelentes opciones para vos! 🏠\n\n` +
      propiedades.map(p =>
        `✅ *${p.titulo}*\n💰 ${p.moneda} ${p.precio?.toLocaleString()} | 📍 ${p.barrio} | ${p.metros}m²`
      ).join('\n\n') +
      `\n\n¿Te interesa alguna? ¡Puedo agendar una visita para que la conozcas en persona!`
    );
    return {
      propiedades_encontradas: propiedades,
      messages: [fallback],
      respuesta_final: fallback.content,
    };
  }
}