# Expansão estratégica

Escopo: pedido original de 30 seções e issues #1–#11 de Nicolas25vlad/OpenFrontIO.
Este documento acompanha a implementação completa; uma etapa verde não encerra o escopo.

## Plano e arquitetura

1. Reutilizar `GameImpl`, `PlayerImpl`, `UnitImpl`, `ConstructionExecution`, o fluxo Intent → Turn → Execution → GameUpdate, índices espaciais, ferrovias, alianças, marinha, renderer WebGL e i18n.
2. Estender estoques com produtos processados; depósitos com reservas por recurso; adicionar fazenda, usina nuclear, fábrica de veículos e trincheiras. Supply, tanques, comércio e diplomacia terão dados agregados próprios.
3. Reutilizar intents de construção/upgrade; adicionar somente comandos de produção, pintura de trincheiras, missão naval e proposta/resposta/cancelamento de paz. Dados de leitura via updates incrementais.
4. Completar categorias de construção, painel compacto/detalhado de economia, assets militares, heatmap/setores navais, tropas agrupadas e tooltips de causas.
5. Heurísticas de bots por gargalo: recursos, alimento, indústria, supply, tanques, marinha e paz. Preservar comportamento legado em partidas com expansão desativada.
6. Testar regras, fronteiras de confiança, concorrência no mesmo turno, conservação de recursos, captura/destruição, determinismo entre simulações e replay, updates, UI e desempenho.
7. Ordem: recursos/estoque → extração/processamento → comida/infraestrutura → custos/supply → tanques/visuais → trincheiras → comércio/comboios → supremacia → paz → nuclear → bots/qualidade. Cada etapa precisa compilar e passar testes pertinentes antes de avançar.

## Requisitos e evidência de conclusão

Itens só são marcados após implementação e verificação. `src/core` é a simulação determinística executada no worker de cada cliente; o servidor distribui turns. Nenhuma UI decide produção ou resultados de combate.

- [ ] 1. Categorias em dados, barra secundária acima, mouse e teclado; todas as novas construções acessíveis.
- [ ] 2. Sete recursos, camadas determinísticas por partida, terra válida, riqueza, sobreposição, fallback; todos os tipos por continente.
- [ ] 3. Heatmap forte, sobreposição, ícones reconhecíveis de minério/gota e botão junto ao estoque; apenas visual.
- [ ] 4. Minas com reserva compartilhada persistente por depósito/recurso, riqueza, nível, infraestrutura/indústria; captura e esgotamento.
- [ ] 5. Petróleo → combustível; ferro → refinado → aço com carvão; ouro → barras; cobre → circuitos; urânio → enriquecido só em usina; potássio → fertilizante; fazendas → comida. Throughput limitado.
- [ ] 6. Estoques sincronizados, painel compacto + detalhe de produção, consumo e saldo por período.
- [ ] 7. Custos centralizados em dinheiro/recursos; preview e execução atômica; insuficiência explicada.
- [ ] 8. Fábricas processam, portos participam de comércio/supply; renda ligada à atividade.
- [ ] 9. Infraestrutura conectada melhora indústria, logística, avanço e supply; sem novas entidades de trem no core.
- [ ] 10. Comida limita crescimento suavemente; cidades aumentam capacidade e mão de obra local.
- [ ] 11. Supply agregado: comida da infantaria, comida/combustível/aço dos tanques, combustível/manutenção naval; indicador e penalidades.
- [ ] 12. Soldados pixel art agrupados nas fronteiras, LOD e limite de instâncias; nenhuma entidade RTS no core.
- [ ] 13. Vehicle Factory, tanques complementares, custos/manutenção, penalidade naval, assets militares e contagem no HUD/ataques.
- [ ] 14. Trincheiras pintadas na própria fronteira; defesa, desgaste, penalidade ofensiva e counters por tanques/supply.
- [ ] 15. Fortificações existentes fortalecidas por balanceamento central.
- [ ] 16. Setores navais lógicos; modo naval manual e automático para navios/frotas/missões.
- [ ] 17. Designação de warships, supremacia por força/supply/presença; invasões, comboios e interceptação.
- [ ] 18. Comércio automático por escassez, estoque, aliança/neutralidade, distância, preço e rota; inimigos excluídos.
- [ ] 19. Especialização viável: importar matérias-primas, processar e exportar com lucro, inclusive bots.
- [ ] 20. Comboios transportam recursos reais, captura/destruição afeta carga/dinheiro; número de rotas limitado.
- [ ] 21. Barras de ouro amortecem falta de dinheiro com fórmula simples e ajustável.
- [ ] 22. Paz branca/oferta/exigência percentual de território, aceite/recusa/cancelamento, transferência conectada, trégua de 180 s e bloqueio de ataques, UI e bots.
- [ ] 23. Anti-ICBM: +20% alcance, +15% eficiência, valores configuráveis.
- [ ] 24. Usina cara, enriquecimento limitado, armas consomem materiais/dinheiro/tempo; sem spam por dinheiro infinito.
- [ ] 25. Bots usam todos os sistemas e expansão por gargalos; cenários de economia baixa/média/alta.
- [ ] 26. i18n, motivos de ineficiência/escassez/supply e contadores visíveis em tooltips/painéis.
- [ ] 27. Custos, receitas, intervalos, modificadores, thresholds e alcances centralizados.
- [ ] 28. Mapas/configurações/replays legados; novas partidas ativam expansão; modo legado explicitamente preservado.
- [ ] 29. Medir tick/memória/payload; nada de scan de mapa por jogador/tick; índices/caches/intervalos/limites.
- [ ] 30. Testes de extração, processamento, custos/concorrência/cancelamento, comida, supply, tanques, trincheiras, comércio/comboios, supremacia, paz/trégua, nuclear e determinismo; suite completa, lint, build e QA visual.

## Estado inicial verificado em 2026-09-13

Issues #1–#11 abertas. Worktree contém fundação de recursos, heatmap, categorias e implementação parcial de mina. Ainda falta processamento e a integração da mina na barra inferior; testes anteriores não demonstram a expansão completa. Corrigir também reservas sobrepostas, validade de terreno após alterações e semântica de replay (repetir um build não equivale a reproduzir uma partida).
