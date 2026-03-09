// src/graph.js
import { StateGraph, END } from '@langchain/langgraph';
import { AgenteState } from './state.js';
import { nodoClasificador, routerIntent } from './nodes/clasificador.js';
import { nodoBuscador } from './nodes/buscador.js';
import { nodoAgendador } from './nodes/agendador.js';
import {
  nodoResponderGeneral,
  nodoNegociacion,
  nodoFinanciamiento,
  nodoCierre,
  nodoHablarAsesor,
} from './nodes/responderGeneral.js';

let compiledGraph = null;

export function getGraph() {
  if (compiledGraph) return compiledGraph;

  const workflow = new StateGraph({ channels: AgenteState });

  // ── Registrar nodos ──────────────────────────────────────────────
  workflow.addNode('clasificador', nodoClasificador);
  workflow.addNode('buscar', nodoBuscador);
  workflow.addNode('agendar', nodoAgendador);
  workflow.addNode('responder_general', nodoResponderGeneral);
  workflow.addNode('negociacion', nodoNegociacion);
  workflow.addNode('financiamiento', nodoFinanciamiento);
  workflow.addNode('cierre', nodoCierre);
  workflow.addNode('hablar_asesor', nodoHablarAsesor);

  // ── Punto de entrada ─────────────────────────────────────────────
  workflow.setEntryPoint('clasificador');

  // ── Router condicional ───────────────────────────────────────────
  workflow.addConditionalEdges('clasificador', routerIntent, {
    buscar: 'buscar',
    agendar: 'agendar',
    negociacion: 'negociacion',
    financiamiento: 'financiamiento',
    cierre: 'cierre',
    hablar_asesor: 'hablar_asesor',
    responder_general: 'responder_general',
  });

  // ── Todos terminan en END ────────────────────────────────────────
  workflow.addEdge('buscar', END);
  workflow.addEdge('agendar', END);
  workflow.addEdge('negociacion', END);
  workflow.addEdge('financiamiento', END);
  workflow.addEdge('cierre', END);
  workflow.addEdge('hablar_asesor', END);
  workflow.addEdge('responder_general', END);

  compiledGraph = workflow.compile();
  console.log('[GRAPH] Grafo compilado con 8 nodos ✅');

  return compiledGraph;
}