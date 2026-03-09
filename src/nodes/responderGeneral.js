// src/nodes/responderGeneral.js
import { ChatGroq } from '@langchain/groq';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';

const llm = new ChatGroq({
  model: 'llama-3.1-8b-instant',
  temperature: 0.6,
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_GENERAL = `Eres "Sofía", la asesora virtual de una inmobiliaria profesional.
Eres amable, empática, entusiasta y muy conocedora del mercado inmobiliario.
Tu objetivo es entender qué necesita el cliente y guiarlo de forma natural hacia:
1. Ver propiedades disponibles → preguntá si quiere comprar o alquilar, zona, presupuesto
2. Agendar una visita → si ya mostró interés en alguna propiedad
3. Resolver dudas sobre financiamiento o negociación
4. Derivar a un asesor humano si la consulta es muy específica o técnica

Reglas importantes:
- Respondé en español rioplatense (usá "vos", "podés", "tenés")
- Usá emojis moderadamente, hace el chat más amigable en WhatsApp
- Nunca inventes datos de propiedades o precios
- Si el usuario saluda, preséntate brevemente y preguntá en qué podés ayudar
- Sé concisa: mensajes cortos y directos, máximo 4-5 líneas
- Si el usuario ya dio información (zona, presupuesto), usala en tu respuesta
- Mostrá interés genuino en ayudar al cliente`;

export async function nodoResponderGeneral(state) {
  console.log('[NODO] ResponderGeneral → Generando respuesta...');

  // APLICADO: Valores por defecto para evitar undefined
  const { messages = [], user_info = {} } = state;

  // APLICADO: Fallback a array vacío antes del slice
  const historial = (messages || []).slice(-10).map(m => ({
    role: m._getType?.() === 'human' ? 'user' : 'assistant',
    content: m.content,
  }));

  // Contexto adicional si tenemos info del usuario
  let contextoUsuario = '';
  if (user_info?.nombre) contextoUsuario += `\nEl cliente se llama ${user_info.nombre}.`;
  if (user_info?.zona_preferida) contextoUsuario += `\nBusca en la zona: ${user_info.zona_preferida}.`;
  if (user_info?.presupuesto) contextoUsuario += `\nSu presupuesto es: ${user_info.presupuesto}.`;

  try {
    const response = await llm.invoke([
      new SystemMessage(SYSTEM_GENERAL + contextoUsuario),
      ...historial.map(m =>
        m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
      ),
    ]);

    const respuesta = new AIMessage(response.content);
    return {
      messages: [respuesta],
      respuesta_final: response.content,
    };

  } catch (err) {
console.error("[NODO] ResponderGeneral → Error completo:", err);    const fallback = new AIMessage(
      `¡Hola! Soy Sofía, tu asesora virtual 🏠\n` +
      `Estoy acá para ayudarte a encontrar la propiedad ideal.\n` +
      `¿Estás buscando *comprar* o *alquilar*?`
    );
    return {
      messages: [fallback],
      respuesta_final: fallback.content,
    };
  }
}

// ── NODO NEGOCIACIÓN ──────────────────────────────────────────────────
const SYSTEM_NEGOCIACION = `Eres "Sofía", asesora virtual de una inmobiliaria profesional.
El cliente tiene preguntas sobre negociación de precio.
Explicá que en inmobiliaria siempre hay margen para negociar, pero depende del propietario y el mercado.
Invitalo a agendar una visita o hablar con un asesor para negociar directamente.
Respondé en español rioplatense, sé amable y usá emojis moderadamente.`;

export async function nodoNegociacion(state) {
  console.log('[NODO] Negociacion → Respondiendo consulta de negociación...');

  // APLICADO: Valores por defecto
  const { messages = [] } = state;
  
  // APLICADO: Fallback a array vacío antes del slice
  const historial = (messages || []).slice(-6).map(m =>
    m._getType?.() === 'human' ? new HumanMessage(m.content) : new AIMessage(m.content)
  );

  try {
    const response = await llm.invoke([
      new SystemMessage(SYSTEM_NEGOCIACION),
      ...historial,
    ]);

    return {
      messages: [new AIMessage(response.content)],
      respuesta_final: response.content,
    };
  } catch {
    const fallback = new AIMessage(
      `¡Buena pregunta! 💬 En el mercado inmobiliario siempre hay margen para negociar.\n\n` +
      `El precio publicado es orientativo y depende mucho del propietario y las condiciones del mercado.\n\n` +
      `Te recomiendo que agendemos una visita para que puedas conocer la propiedad en persona y ahí podemos hablar de números con el asesor. ¿Qué te parece? 🏠`
    );
    return { messages: [fallback], respuesta_final: fallback.content };
  }
}

// ── NODO FINANCIAMIENTO ───────────────────────────────────────────────
const SYSTEM_FINANCIAMIENTO = `Eres "Sofía", asesora virtual de una inmobiliaria profesional.
El cliente pregunta sobre financiamiento, créditos hipotecarios o formas de pago.
Explicá de forma general las opciones típicas: contado, crédito hipotecario bancario, financiamiento del desarrollador.
Recomendá consultar con un asesor financiero o banco para los detalles específicos.
Invitalo a agendar una reunión con nuestros asesores para orientarlo mejor.
Respondé en español rioplatense, sé amable y usá emojis moderadamente.`;

export async function nodoFinanciamiento(state) {
  console.log('[NODO] Financiamiento → Respondiendo consulta de financiamiento...');

  // APLICADO: Valores por defecto
  const { messages = [] } = state;
  
  // APLICADO: Fallback a array vacío antes del slice
  const historial = (messages || []).slice(-6).map(m =>
    m._getType?.() === 'human' ? new HumanMessage(m.content) : new AIMessage(m.content)
  );

  try {
    const response = await llm.invoke([
      new SystemMessage(SYSTEM_FINANCIAMIENTO),
      ...historial,
    ]);

    return {
      messages: [new AIMessage(response.content)],
      respuesta_final: response.content,
    };
  } catch {
    const fallback = new AIMessage(
      `¡Claro! Te cuento las opciones más comunes 💰\n\n` +
      `💵 *Contado:* La opción más simple y con mejor poder de negociación.\n` +
      `🏦 *Crédito hipotecario:* A través de bancos, generalmente hasta el 70-80% del valor.\n` +
      `🏗️ *Financiamiento del desarrollador:* En propiedades nuevas, suelen ofrecer planes en cuotas.\n\n` +
      `Para asesorarte mejor según tu situación, te recomiendo hablar con uno de nuestros asesores. ¿Te agendo una consulta? 😊`
    );
    return { messages: [fallback], respuesta_final: fallback.content };
  }
}

// ── NODO CIERRE ───────────────────────────────────────────────────────
export async function nodoCierre(state) {
  console.log('[NODO] Cierre → Cerrando conversación...');

  // APLICADO: Valores por defecto
  const { user_info = {} } = state;
  const nombre = user_info?.nombre ? `, ${user_info.nombre}` : '';

  const despedida = new AIMessage(
    `¡Fue un placer ayudarte${nombre}! 😊🏠\n\n` +
    `Si en algún momento querés retomar la búsqueda, necesitás más información o querés agendar una visita, ` +
    `no dudes en escribirme. ¡Estoy acá para ayudarte!\n\n` +
    `¡Hasta pronto! 👋`
  );

  return {
    messages: [despedida],
    respuesta_final: despedida.content,
  };
}

// ── NODO HABLAR CON ASESOR ────────────────────────────────────────────
export async function nodoHablarAsesor(state) {
  console.log('[NODO] HablarAsesor → Derivando a asesor humano...');

  // APLICADO: Valores por defecto
  const { user_info = {} } = state;
  const nombre = user_info?.nombre ? `${user_info.nombre}` : 'cliente';

  const mensaje = new AIMessage(
    `¡Por supuesto! Entiendo que preferís hablar con una persona 😊\n\n` +
    `Voy a pasarle tu consulta a uno de nuestros asesores. ` +
    `Te contactarán a la brevedad en este mismo chat o al teléfono que nos indiques.\n\n` +
    `📞 También podés comunicarte directamente al *[número de la inmobiliaria]*\n` +
    `⏰ Horario de atención: Lunes a Viernes 9:00 - 18:00\n\n` +
    `¿Hay algo más en lo que pueda ayudarte mientras tanto? 🏠`
  );

  return {
    messages: [mensaje],
    respuesta_final: mensaje.content,
  };
}