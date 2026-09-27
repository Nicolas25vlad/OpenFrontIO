# Expansão estratégica

Escopo: pedido original de 30 seções e issues #1–#11 de Nicolas25vlad/OpenFrontIO.
Este documento acompanha a implementação completa; uma etapa verde não encerra o escopo.
Antes de ativar ou alterar cada sistema, use o gate em
[`StrategicCompatibilityChecklist.md`](StrategicCompatibilityChecklist.md).

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

## Tropas visuais agrupadas — issue #5 (parcial)

O renderer agora desenha grupos de soldados em pixel art nas fronteiras de
território. Cada grupo representa 25.000 tropas; o total é limitado a 32 por
jogador e 2.048 instâncias por mapa. A camada é visual, não cria unidades no
core nem altera combate, updates ou replay. A lista de grupos é recalculada a
cada 50 ticks por padrão, com tamanho, zoom mínimo, opacidade e limite no
`render-settings.json`.

Como início da etapa de tanques da mesma issue, a Vehicle Factory já produz
reservas autoritativas: cada lote consome 5 unidades de aço e 2 de combustível,
e o estoque é sincronizado em `PlayerUpdate` e mostrado no painel econômico.
Em ataques terrestres da economia estratégica, um tanque acompanha cada 10.000
infantes enviados (limitado ao estoque disponível). Cada tanque contribui força
equivalente a 5.000 infantes e pode sofrer baixas determinísticas; retiradas
devolvem os tanques sobreviventes. Ataques por barco não carregam tanques. A
contagem viaja no delta compacto e aparece nas listas e rótulos de ataques.
Ainda faltam seleção/movimento de tanques como unidades independentes, carga
naval de tanques e decisões específicas dos bots.

Validação automatizada: `tests/client/render/gl/TroopGarrisons.test.ts` cobre
posições de fronteira, determinismo, limiar de tropas e limite global;
`tests/economy/Production.test.ts` e `tests/economy/StrategicReplay.test.ts`
cobrem produção, updates e replay dos tanques; `tests/Attack.test.ts`,
`tests/GameUpdateUtils.test.ts` e `tests/client/view/GameView.test.ts` cobrem
envio, força de combate, baixas em combate entre jogadores e sincronização da
contagem nas investidas. Build, lint e `tsc --noEmit` passaram; os testes focados
da integração de ataques passaram (154 testes), além dos 89 testes focados na
etapa de produção. A suíte completa passou em modo serial: 469 arquivos e 5.582
testes. Os testes de servidor também passaram: 63 arquivos e 656 testes. No
Node 26 do homelab, habilite Web Storage e limite o Vitest a um worker para
evitar concorrência entre os arquivos de armazenamento compartilhado:

```sh
NODE_OPTIONS="--experimental-webstorage --localstorage-file=/tmp/openfront-vitest-$$" npx vitest run --maxWorkers=1
NODE_OPTIONS="--experimental-webstorage --localstorage-file=/tmp/openfront-vitest-server-$$" npx vitest run tests/server
```

### Validação manual pendente no PC principal

1. Inicie o cliente com `npm run dev:host` e abra uma partida solo ou
   multiplayer. Faça o teste com `strategicEconomy` ligado e desligado.
2. Com a economia estratégica ligada, construa uma Vehicle Factory e forneça
   aço e combustível. Confira o contador de tanques no painel após alguns ticks.
3. Envie pelo menos 25.000 tropas por terra. Confira dois tanques no rótulo do
   ataque e a redução correspondente do estoque. Cancele a investida e confira a
   devolução dos sobreviventes; repita contra um jogador para observar baixas.
4. Em uma nação com pelo menos 25.000 tropas, aproxime a câmera da fronteira
   até os ícones aparecerem. Confira uma região interior e uma fronteira entre
   dois jogadores.
5. Afaste a câmera até os ícones desaparecerem e aproxime novamente.
6. Faça uma conquista na fronteira e confira se os grupos acompanham o novo
   território em até 50 ticks. Repita avançando e voltando em um replay.

Esperado: pequenos grupos de duas silhuetas em pixel art, coloridos pelo dono
do território e restritos às fronteiras; nenhum grupo no interior. O ataque
deve exibir a quantidade de tanques, consumir reserva ao sair e devolver apenas
os sobreviventes ao cancelar. A
quantidade cresce em degraus com as tropas, respeita o limite visual, some
abaixo do zoom mínimo e não muda os resultados de combate. O contador de
tanques deve aumentar em lotes conforme a fábrica consome aço e combustível.
Registre navegador,
mapa e resultado em `StrategicCompatibilityChecklist.md`; a aprovação visual
continua pendente até essa execução.
