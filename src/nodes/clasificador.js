// src/nodes/clasificador.js
import { ChatGroq } from '@langchain/groq';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

const llm = new ChatGroq({
  model: 'llama-3.1-8b-instant',
  temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_CLASIFICADOR = `Eres un clasificador de intenciones para una inmobiliaria.
Analiza el último mensaje del usuario y responde ÚNICAMENTE con un JSON con este formato exacto:
{
  "intent": "<intención>",
  "user_info": {
    "nombre": "<nombre si lo mencionó, sino null>",
    "telefono": "<teléfono si lo mencionó, sino null>",
    "email": "<email si lo mencionó, sino null>",
    "presupuesto": "<presupuesto si lo mencionó, sino null>",
    "zona_preferida": "<zona o barrio si lo mencionó, sino null>"
  }
}

Intenciones posibles:
- "comprar": quiere comprar una propiedad
- "alquilar": quiere alquilar una propiedad
- "agendar": quiere agendar una visita a una propiedad
- "negociacion": pregunta sobre negociación de precio, contraoferta, descuentos
- "financiamiento": pregunta sobre créditos, hipotecas, financiamiento, cuotas
- "consulta_precio": pregunta solo por el precio de una propiedad específica
- "cierre": quiere terminar la conversación, se despide, dice gracias/chau/hasta luego
- "hablar_asesor": pide hablar con una persona humana, un asesor real
- "consulta_general": consulta genérica, saludo, o no queda claro

Responde SOLO con el JSON, sin texto adicional, sin markdown.`;

export async function nodoClasificador(state) {
  console.log('[NODO] Clasificador → Analizando intención...');

const { messages = [] } = state;
  if (!messages || messages.length === 0) {
    return { intent: 'consulta_general', user_info: {} };
  }
  const ultimoMensaje = messages[messages.length - 1];

  const contextMessages = messages.slice(-6).map(m => {
    const role = m._getType?.() === 'human' ? 'Cliente' : 'Sofía';
    return `${role}: ${m.content}`;
  }).join('\n');

  try {
    const response = await llm.invoke([
      new SystemMessage(SYSTEM_CLASIFICADOR),
      new HumanMessage(
        `Historial reciente:\n${contextMessages}\n\nMensaje a clasificar: "${ultimoMensaje.content}"`
      ),
    ]);

    const texto = response.content.trim();
    console.log('[NODO] Clasificador → Respuesta raw:', texto);
    const parsed = JSON.parse(texto);

    console.log(`[NODO] Clasificador → Intent detectado: ${parsed.intent}`);

    return {
      intent: parsed.intent,
      user_info: parsed.user_info || {},
    };

  } catch (err) {
      console.error('[NODO] Clasificador → Error completo:', err.message);
      console.error('[NODO] Clasificador → Respuesta recibida:', err);
      return {
        intent: 'consulta_general',
        user_info: {},
      };
    }
  }

export function routerIntent(state) {
  const { intent } = state;

  switch (intent) {
    case 'comprar':
    case 'alquilar':
      return 'buscar';
    case 'agendar':
      return 'agendar';
    case 'negociacion':
      return 'negociacion';
    case 'financiamiento':
      return 'financiamiento';
    case 'consulta_precio':
      return 'buscar';
    case 'cierre':
      return 'cierre';
    case 'hablar_asesor':
      return 'hablar_asesor';
    default:
      return 'responder_general';
  }
}