# Expansão estratégica

Escopo: pedido original de 30 seções e issues #1–#12 de Nicolas25vlad/OpenFrontIO.
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
- [ ] 2. Sete recursos em camadas determinísticas independentes; zonas geológicas amplas, graduais e irregulares, lacunas sem depósitos, níveis de riqueza e somente terra válida.
- [ ] 3. Heatmap com cinturões geológicos sobrepostos, ícones reconhecíveis de minério/gota e botão junto ao estoque; apenas visual.
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

## Distribuição geológica determinística — requisitos 2 e 3 (parcial)

A geração já usa quatro oitavas de value noise determinístico, com seed
independente por recurso e cache por mapa/partida. A distribuição agora usa
somente os limiares configurados: removi os depósitos de fallback que preenchiam
células sem ocorrência e a garantia artificial de um ponto de cada recurso em
cada continente. Isso mantém vazios geológicos e concentrações contínuas onde o
noise ultrapassa o limiar. Escala, frequência, limiar e abundância continuam
configuráveis em `RESOURCE_GENERATION_CONFIG`; a abundância desloca o limiar e a
riqueza é calculada em faixas sobre o mesmo valor do noise. Cada candidato ainda
é resolvido para terra passável. A malha de amostragem e a escala do noise se
adaptam às dimensões do mapa. No overlay, manchas de contorno suave e irregular
se sobrepõem para que depósitos vizinhos apareçam como cinturões geológicos
contínuos, sem a aparência de círculos isolados. A forma visual é determinística
por coordenada e recurso; a riqueza amplia a área do depósito sem alterar posição
ou reserva. A
menor abundância do ouro foi
ajustada para formar regiões produtoras conectadas sem tornar o recurso
uniforme. A distribuição é cacheada por mapa e seed; o cálculo não roda durante
os ticks da partida. O campo amplo também recebe uma distorção espacial suave
por duas camadas determinísticas independentes, deixando as bordas dos cinturões
menos regulares sem fragmentar as regiões produtoras.

Arquivos: `src/core/game/Resources.ts`, `src/client/ResourceMap.ts` e
`tests/core/game/Resources.test.ts`. A suíte testa determinismo e cache,
independência das camadas, riqueza progressiva, regiões conectadas, áreas vazias,
cobertura em múltiplas zonas de continente e exclusão de água/terreno
intransitável. Também foram validados os fluxos de mineração, prioridades da IA,
produção e replay: 30 testes passaram em 6 arquivos. A suíte completa passou
com 474 arquivos/5.611 testes; a suíte de servidor, com 63 arquivos/656 testes.
`tsc --noEmit`, lint, `npm run build-dev`, Prettier e `git diff --check` também
passaram. Nesta revisão, os testes focados de geração, contorno visual e extração
passaram em 3 arquivos/22 testes; ESLint, `tsc --noEmit`, build de desenvolvimento,
Prettier e `git diff --check` também passaram.

### Validação visual pendente no PC principal

1. Rode `npm run dev:host`, inicie uma partida estratégica e ative o mapa de
   recursos pelo botão junto ao estoque.
2. Observe cada continente em zoom médio e aproximado. Procure cinturões
   irregulares com ícones próximos em áreas produtoras, transições de intensidade
   e regiões sem depósitos; verifique também sobreposições ocasionais.
3. Reabra a mesma partida e confirme que posições e riqueza são idênticas.
   Inicie uma partida com outra seed e confirme que as camadas mudam.

Os contornos de cada depósito devem parecer irregulares e se unir em manchas
amplas; confirme que não aparecem halos circulares isolados.

Esperado: os depósitos aparecem somente em terra passável, em regiões amplas e
irregulares compostas por tiles próximos; os níveis de riqueza variam segundo o
noise, áreas sem ocorrência permanecem visíveis e cada recurso conserva uma
distribuição independente. A conferência visual continua pendente.

## Tropas visuais agrupadas — issue #5 (parcial)

O renderer agora desenha grupos de soldados em pixel art nas fronteiras de
território. Cada grupo representa 25.000 tropas; o total é limitado a 32 por
jogador e 2.048 instâncias por mapa. A camada é visual, não cria unidades no
core nem altera combate, updates ou replay. A lista de grupos é recalculada a
cada 50 ticks por padrão, com tamanho, zoom mínimo, opacidade e limite no
`render-settings.json`.
Tiles nos limites externos do mapa também contam como fronteira, para que
territórios encostados na borda não fiquem sem grupos visuais.
`tests/client/render/gl/TroopGarrisons.test.ts` confirma esse caso, além da
amostragem determinística e do limite de instâncias; os 4 testes passaram.
`npm run build-dev`, Oxlint, ESLint, Prettier e `git diff --check` passaram.

Como início da etapa de tanques da mesma issue, a Vehicle Factory já produz
reservas autoritativas: cada lote consome 5 unidades de aço e 2 de combustível,
e o estoque é sincronizado em `PlayerUpdate` e mostrado no painel econômico.
Em ataques terrestres da economia estratégica, um tanque acompanha cada 10.000
infantes enviados (limitado ao estoque disponível). Cada tanque contribui força
equivalente a 5.000 infantes e dá 5% de velocidade de avanço, limitado a 50% por
ataque. A velocidade é calculada no core e seus parâmetros ficam em
`STRATEGIC_COMBAT`. Tanques podem sofrer baixas determinísticas; retiradas
devolvem os tanques sobreviventes. Ataques navais podem levar tanques como carga
opcional, limitada pela proporção infantaria/tanques e pelo estoque disponível;
o pedido antigo sem o campo `tanks` continua enviando apenas infantaria. O navio
mantém a carga sincronizada durante a rota e a transfere para o ataque ao chegar.
A contagem viaja nos updates de unidade e no delta compacto de ataques; aparece
no detalhe do transporte e nas listas/rótulos de ataques.

### Tanques independentes — issue #13 (em andamento)

Tanques produzidos continuam disponíveis no estoque estratégico e agora podem
ser implantados como unidades móveis individuais. O core valida economia
estratégica ativa, propriedade e terreno terrestre passável, reserva disponível
e limite configurável de 24 tanques implantados por jogador. O cliente seleciona
um tanque separadamente das tropas e aceita ordens de movimento por terra
passável. Ordens a território neutro ou inimigo avançam tile a tile usando a
fórmula de combate existente, aplicam baixas à guarnição, desgaste a postos e
trincheiras, dano determinístico aos tanques envolvidos e capturam cada tile
alcançado. Tanques implantados também se enfrentam quando disputam o mesmo tile;
tiles bloqueados por tanques aliados encerram a ordem sem sobreposição. O
caminho é determinístico, limitado a 250 tiles e calculado uma vez por ordem.
A busca usa o iterador cardinal com buffer reutilizado e limita a fila ao maior
losango que cabe nesse alcance, em vez de reservar uma fila do tamanho do mapa.
Updates de unidade sincronizam movimento e saúde entre clientes e replay. A IA
de nações e tribos pode implantar e ordenar até dois tanques quando há estoque,
mantendo uma unidade de reserva para os ataques legados. Unidades móveis recebem
sprite no carregamento do atlas, sem alterar o PNG compartilhado.

Arquivos desta etapa: `src/core/game/Game.ts`, `src/core/game/PlayerImpl.ts`,
`src/core/game/UnitImpl.ts`, `src/core/configuration/Config.ts`,
`src/core/configuration/StrategyConfig.ts`,
`src/core/execution/ConstructionExecution.ts`,
`src/core/execution/MoveTankExecution.ts`, `src/core/Schemas.ts`,
`src/core/StatsSchemas.ts`, `src/client/controllers/TankSelectionController.ts`,
`src/client/render/gl/passes/UnitPass.ts`, `resources/images/TankIcon.svg`,
`src/core/execution/nation/AiTankBehavior.ts`, as execuções de nação e tribo,
traduções e a tabela de estatísticas. Testes cobrem implantação, reserva,
limite e ocupação, economia legada, movimento e combate determinísticos,
captura/baixas, uso da reserva pela IA, isolamento da infantaria e seleção.
Também há cobertura do fluxo normal de implantação pelo intent `build_unit` →
`Executor` e do round-trip wire desse intent para a unidade Tank. O movimento
também passa pelo intent `move_tank` no `Executor`, com ticks reais confirmando
que a ordem move o tanque selecionado sem alterar a infantaria; testes na
fronteira de 250/251 tiles validam o limite de alcance do core.
Revalidação focada de implantação, alcance, movimento, seleção e wire passou em
3 arquivos/51 testes; `tsc --noEmit`, ESLint, Prettier e `git diff --check`
também passaram.
`tests/AiTankBehavior.test.ts` também exercita as execuções completas de nação e
tribo: ambas implantam uma unidade móvel a partir da reserva e preservam um
tanque legado.

### Validação manual pendente no PC principal

1. Rode `npm run dev:host` e inicie uma partida multiplayer com dois clientes,
   economia estratégica ativa e tanques produzidos em uma Vehicle Factory.
2. No menu Militar, implante um tanque em terra própria passável. Confirme que o
   estoque cai em uma unidade, aparece o sprite do tanque e a unidade recebe
   seleção independente.
3. Clique em uma tile de terra própria conectada e depois numa tile inimiga
   adjacente. O tanque deve avançar, reduzir tropas inimigas, sofrer dano e
   capturar o território sem deslocar a infantaria. Se houver um tanque inimigo
   no caminho, ambos devem trocar dano até um ser destruído; um tanque aliado
   deve bloquear a rota sem empilhamento.
4. Tente implantar sem reserva, em terra alheia, numa tile já ocupada por tanque
   ou acima do limite. Nenhuma unidade deve ser criada. Veja também uma partida
   com IA e confirme que ela implanta tanques sem gastar a última reserva.
5. Compare posição e saúde nos dois clientes. Repita o ataque no replay e
   confira a mesma sequência de tiles, baixas e captura.

Esperado: implantação, movimento e combate determinísticos; ordens ilegais não
alteram estoque ou posição e tanques aliados não ocupam o mesmo tile.

Agora a interface estratégica também oferece um controle de 0–100% para a
quantidade de tanques que acompanha cada ataque terrestre, calculada sobre o
limite permitido pelo número de tropas e pelo estoque. O padrão em 100% mantém
o comportamento anterior; 0% envia apenas infantaria. O mesmo controle de
compromisso vale para navios. O campo opcional no protocolo preserva clientes e
partidas que ainda usam a alocação automática terrestre.

Arquivos desta etapa: `src/client/hud/layers/ControlPanel.ts`,
`src/client/hud/TankCommitment.ts`, `src/client/Transport.ts`,
`src/core/Schemas.ts`, `src/core/execution/ExecutionManager.ts`,
`src/core/execution/AttackExecution.ts` e os testes de `Attack`, painel e
transporte. Os testes focados passaram (43 testes); `npm run build-dev`, lint,
Prettier e `git diff --check` também passaram no homelab.

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

A velocidade de avanço dos tanques foi adicionada em
`src/core/configuration/StrategyConfig.ts`, `src/core/configuration/Config.ts`
e `src/core/execution/AttackExecution.ts`. `tests/economy/StrategicBalance.test.ts`
confirma o bônus configurado, seu teto e compatibilidade legada;
`tests/Attack.test.ts` confirma que os tanques embarcados no ataque chegam ao
cálculo de combate. Os testes focados de ataque, supply e balance passaram
(3 arquivos/33 testes), assim como `tsc --noEmit`, lint e build após essa
alteração.

Revalidação completa do branch em 2026-09-27: a suíte principal passou com 473
arquivos e 5.607 testes, e a suíte de servidor com 63 arquivos e 656 testes.

### Validação manual pendente no PC principal

1. Inicie o cliente com `npm run dev:host` e abra uma partida solo ou
   multiplayer. Faça o teste com `strategicEconomy` ligado e desligado. O novo
   controle deve aparecer apenas com a economia estratégica ativa.
2. Com a economia estratégica ligada, construa uma Vehicle Factory e forneça
   aço e combustível. Confira o contador de tanques no painel após alguns ticks.
3. Envie pelo menos 25.000 tropas por terra. Confira dois tanques no rótulo do
   ataque e a redução correspondente do estoque. Compare o avanço com uma
   investida sem tanques: os dois tanques devem acelerar o avanço terrestre.
   Cancele a investida e confira a devolução dos sobreviventes; repita contra
   um jogador para observar baixas. Ajuste o controle de compromisso para 0%,
   50% e 100%; com 25.000 tropas, o ataque deve levar 0, 1 e 2 tanques,
   respectivamente, quando houver estoque suficiente.
4. Faça uma investida naval com a economia estratégica ligada e o controle de
   compromisso em 50% ou 100%. O transporte deve mostrar os tanques no detalhe;
   após o desembarque, o ataque deve carregar a mesma quantidade. Se a rota for
   cancelada, o estoque deve recuperar apenas os tanques sobreviventes.
5. Em uma nação com pelo menos 25.000 tropas, aproxime a câmera da fronteira
   até os ícones aparecerem. Confira uma região interior e uma fronteira entre
   dois jogadores.
6. Afaste a câmera até os ícones desaparecerem e aproxime novamente.
7. Faça uma conquista na fronteira e confira se os grupos acompanham o novo
   território em até 50 ticks. Repita avançando e voltando em um replay.

Esperado: pequenos grupos de duas silhuetas em pixel art, coloridos pelo dono
do território e restritos às fronteiras; nenhum grupo no interior. O ataque
deve exibir a quantidade de tanques, consumir reserva ao sair, avançar mais
rápido com os tanques e devolver apenas os sobreviventes ao cancelar. A
quantidade cresce em degraus com as tropas, respeita o limite visual, some
abaixo do zoom mínimo e os ícones de guarnição não mudam o combate. O contador de
tanques deve aumentar em lotes conforme a fábrica consome aço e combustível.
O controle de compromisso aparece apenas na economia estratégica e limita os
tanques embarcados sem ultrapassar o limite das tropas ou o estoque disponível.
Registre navegador,
mapa e resultado em `StrategicCompatibilityChecklist.md`; a aprovação visual
continua pendente até essa execução.

### Carga naval de tanques — validação desta etapa

O intent naval agora pode solicitar tanques; o servidor reserva o estoque ao
embarcar, replica a carga junto ao transporte, transfere os tanques ao ataque
no desembarque e devolve os sobreviventes em retirada ou cancelamento. Bots
também incluem a carga quando a economia estratégica está ativa. Intents
antigos sem `tanks` e partidas sem economia estratégica continuam
infantaria-only.

Arquivos alterados nesta etapa: `src/core/game/Game.ts`,
`src/core/game/UnitImpl.ts`, `src/core/Schemas.ts`,
`src/core/configuration/StrategyConfig.ts`,
`src/core/execution/ExecutionManager.ts`,
`src/core/execution/AttackExecution.ts`,
`src/core/execution/TransportShipExecution.ts`,
`src/core/execution/utils/AiAttackBehavior.ts`,
`src/client/Transport.ts`, `src/client/ClientGameRunner.ts`,
`src/client/hud/layers/PlayerActionHandler.ts`,
`src/client/hud/layers/PlayerInfoOverlay.ts` e os testes
`tests/economy/NavalTankCargo.test.ts`,
`tests/core/IntentTileRefSchemas.test.ts`,
`tests/client/view/UnitView.test.ts` e
`tests/client/ClientGameRunnerActions.test.ts`.

Validação no homelab: 95 testes focados em 6 arquivos passaram; `tsc
--noEmit`, lint, `npm run build-dev` e `git diff --check` passaram. O build
emitiu somente avisos de bundle grande e tempo de plugins.

No PC principal, faça o passo 4 da lista acima em multiplayer: envie um
transporte com 25.000 tropas e pelo menos 2 tanques disponíveis, usando 100%
de compromisso. O detalhe do navio deve mostrar 2 tanques; após o desembarque,
o rótulo do ataque deve continuar mostrando 2. Em outra travessia, use o botão
de cancelar do transporte: a rota deve retornar e o estoque recuperar apenas
os tanques sobreviventes. Com a economia estratégica desligada, navio e ataque
devem seguir sem tanques.

## Fortificações e trincheiras — issue #6 (parcial)

Na economia estratégica, postos de defesa podem ser melhorados até o nível 3.
Cada nível amplia a perda de tropas e o custo de avanço dos ataques inimigos,
acrescenta 100 pontos de saúde máxima e restaura a fortificação ao novo máximo.
Quando uma investida resolve combate dentro do alcance, o posto de maior nível
recebe 25 pontos de desgaste por tile. A saúde e o nível seguem no update da
unidade existente e no hash determinístico; nukes continuam destruindo
estruturas como antes. O sistema atual de artilharia naval só escolhe navios
como alvo, então a regra de alvo naval permanece inalterada. A configuração
legada mantém os bônus antigos e não permite melhoria de postos.

Validação automatizada: `tests/PlayerImpl.test.ts` cobre níveis, teto, saúde e
limite de melhorias em lote; `tests/UnitGrid.test.ts` cobre consulta espacial
do posto de maior nível; `tests/economy/StrategicBalance.test.ts` verifica os
bônus por nível sem alterar o modo legado; `tests/Attack.test.ts` cobre bônus
observado pelo combate e desgaste, e `tests/PlayerImpl.test.ts` confirma que
nível/saúde mudam o hash. Validação local: 7 arquivos/116 testes focados,
`tsc --noEmit`, lint e build passaram; replay estratégico/nuclear: 2 arquivos,
15 testes; servidor: 63 arquivos, 656 testes.

### Validação manual pendente no PC principal

1. Com `strategicEconomy` ligado, construa um posto de defesa e melhore-o duas
   vezes. Confira os níveis 1, 2 e 3 e que a quarta melhoria não é oferecida.
2. Deixe um inimigo atacar tiles dentro do alcance. Confira o avanço mais lento,
   maiores perdas do atacante e a redução da saúde do posto após cada tile.
3. Detone uma bomba próxima e confirme a destruição normal da estrutura.
4. Repita com `strategicEconomy` desligado: o posto não deve ser melhorável e o
   cálculo de ataque deve manter os valores legados.

Esperado: níveis e saúde sincronizam sem recriar unidades nem duplicar bônus;
desgaste é determinístico por tile e o posto deixa de conceder defesa ao ser
destruído.

Na mesma opção estratégica, tiles próprios de fronteira podem receber trincheiras
de nível 1 a 3 pelo menu de construção. Cada nível custa aço conforme
`STRATEGIC_COMBAT.trenchSteelPerLevel`. Os dois bits reservados do estado
compacto de tile carregam o nível nos updates existentes; não há uma entidade
por tile. O combate usa o nível daquele tile, aplica defesa e atraso de avanço,
e reduz um nível por tile resolvido. Conquista, abandono e conversão para água
limpam a fortificação. O modo legado ignora o bônus.

Ataques estratégicos também podem reduzir o bônus defensivo e o atraso das
trincheiras: cada tanque atribuído reduz 10% do efeito enquanto tiver suprimento,
com redução máxima de 75%. A baixa de suprimento reduz proporcionalmente essa
eficiência. Os valores ficam em `STRATEGIC_COMBAT`; sem tanques, o efeito
anterior permanece igual.

Arquivos desta etapa: `src/core/game/GameMap.ts`, `src/core/game/GameImpl.ts`,
`src/core/Schemas.ts`, `src/core/execution/BuildTrenchExecution.ts`,
`src/core/execution/ExecutionManager.ts`, `src/core/execution/AttackExecution.ts`,
`src/core/configuration/Config.ts`, `src/core/configuration/StrategyConfig.ts`,
`src/client/Transport.ts`, `src/client/hud/layers/BuildMenu.ts`,
`src/client/view/GameView.ts`, `src/client/render/gl/utils/TileCodec.ts` e
`src/client/render/gl/shaders/map-overlay/territory.frag.glsl`, além das
traduções em `resources/lang/en.json` e `resources/lang/pt-BR.json`.

Validação automatizada específica: `tests/core/game/GameMap.tileStateBuffer.test.ts`,
`tests/core/executions/BuildTrenchExecution.test.ts`,
`tests/economy/StrategicBalance.test.ts` e `tests/Attack.test.ts` — 4 arquivos,
49 testes passaram após adicionar os counters de tanque/suprimento. `tsc --noEmit`,
lint e `npm run build-dev` passaram, incluindo o shader no bundle. A suite
completa passou com 471 arquivos e 5.595 testes;
os testes de servidor são executados separadamente. `tests/core/executions/NukeExecution.test.ts`
também confirma que a detonação limpa o estado de trincheira dos tiles atingidos
e sem dono; os 15 testes desse arquivo passaram nesta rodada.
Em 2026-09-28, acrescentei cobertura do `build_trench` via `Executor` e do
round-trip wire desse intent; `BuildTrenchExecution` e `zbin/wire` passaram em
2 arquivos/43 testes, junto com `tsc --noEmit`, ESLint, Prettier e
`git diff --check`.
Também acrescentei `tests/client/graphics/layers/BuildMenuTrench.test.ts` para
validar nível visível, emissão do intent, fronteira, aço, teto e economia legada.
A regressão conjunta do menu, execução e wire passou em 3 arquivos/48 testes;
TypeScript, ESLint, Prettier e `git diff --check` passaram.
Também foi adicionada uma regressão de concorrência: dois intents válidos com
apenas cinco unidades de aço constroem uma trincheira, preservam o saldo restante
e não deixam o segundo tile parcialmente alterado. A revalidação de execução,
menu e combate passou em 3 arquivos/40 testes.

### Validação manual pendente no PC principal

1. Rode `npm run dev:host`, inicie uma partida com `strategicEconomy` ligado e
   abra o menu de construção com o botão direito sobre um tile próprio da
   fronteira.
2. Selecione “Trincheira” três vezes. Confira o custo de aço por nível, o rótulo
   `1/3`, `2/3`, `3/3` e o tom terroso crescente no tile. No nível 3, a opção
   deve ficar desativada.
3. Deixe um ataque terrestre alcançar o tile. Cada tile resolvido deve reduzir
   o nível uma vez; a captura pelo atacante deve limpar a trincheira. Compare
   também ataques com e sem tanques/suprimento: tanques bem supridos devem
   reduzir parte do bônus da trincheira, e a mesma força sem suprimento deve
   perder parte desse contra-efeito.
4. Repita em tile interior, território inimigo e com aço insuficiente: a opção
   deve ficar desativada e nenhum recurso deve ser consumido. Repita com
   `strategicEconomy` desligado e confirme que o botão não aparece.
5. Detone uma bomba sobre uma fronteira com trincheira. Os tiles atingidos que
   perderem seu dono devem ficar sem nível de trincheira.

Esperado: o servidor/core rejeita qualquer tile inválido mesmo que um cliente
envie o intent manualmente; clientes e replay recebem o mesmo nível via update
compacto. Trincheiras retêm mais do bônus contra forças sem tanques ou sem
suprimento. A revisão visual em replay/multiplayer continua pendente; não foram
alteradas regras de seleção de alvos navais ou nucleares.

## Supremacia local por setor marítimo — issue #7 (parcial)

Na economia estratégica, cada setor costeiro de 64 tiles deriva sua supremacia
dos navios de guerra ativos, nível e fração de saúde. Uma rota comercial nova
não escolhe um porto cujo setor tenha vantagem hostil líquida de pelo menos
dois navios. Navios aliados no setor reduzem a vantagem; navios destruídos,
retirados ou em reparo deixam de contar. O cálculo consulta somente a vizinhança
espacial do porto e o componente de água conectado; não mantém estado por tile.
Rotas já em curso continuam seguindo as regras de interceptação existentes.

Navios comerciais estratégicos também transportam até cinco unidades de um
recurso por viagem, na ordem comida, combustível e aço. A rota carrega apenas
estoque acima da reserva do exportador e abaixo do alvo de importação do
comprador; cada unidade custa 100 de ouro. O comprador deposita o valor quando
o navio parte e o exportador recebe ao chegar. Se o porto de destino for
capturado pelo dono da origem, a rota é cancelada e carga e depósito retornam
aos donos originais. Quando o próprio comboio é capturado, ele redireciona para
um porto ativo do captor: a carga é entregue ali e o comprador recebe o depósito
de volta. Sem porto alcançável ou se o navio for afundado, carga e depósito são
perdidos. Quando vários produtos estão disponíveis, o comboio carrega aquele
com maior déficit proporcional ao alvo de importação; `NAVAL_TRADE.cargoOrder`
resolve empates de forma determinística. Valores, reservas, alvos, preço e
capacidade ficam centralizados em `NAVAL_TRADE`. O replay integrado exercita um
déficit parcial de comida contra ausência total de combustível e confirma que o
comboio escolhe combustível com hashes idênticos em simulações repetidas.

A consulta de supremacia agora cobre a diagonal completa do setor quadrado antes
de filtrar os navios pela coordenada exata. Assim, uma frota no canto oposto ao
porto não fica invisível para o bloqueio; navios no setor adjacente e em outra
massa d'água continuam sem influenciar o resultado. A regressão
`tests/core/game/NavalSupremacy.test.ts` cobre os dois limites espaciais, e
`tests/PortExecution.test.ts` confirma o bloqueio de novas rotas após presença,
contrapressão de escolta e perdas.

Arquivos desta etapa: `src/core/configuration/StrategyConfig.ts`,
`src/core/configuration/Config.ts`, `src/core/game/NavalSupremacy.ts`,
`src/core/execution/PortExecution.ts`, `src/core/execution/TradeShipExecution.ts`,
`src/client/controllers/MapLayerController.ts`,
`src/client/controllers/ResourceMapController.ts`,
`src/client/render/gl/passes/MapLayerPass.ts`, `src/client/ResourceMap.ts`,
`src/client/hud/layers/ResourcePanel.ts`, traduções em `resources/lang/`,
`tests/PortExecution.test.ts`, `tests/core/executions/TradeShipExecution.test.ts`
e `tests/client/ResourcePanel.test.ts`.

O painel econômico também lista os setores que contêm portos próprios, com suas
coordenadas na grade, quantidade de portos e força naval aliada/de outros
jogadores. A força segue a mesma fórmula do core (fração de saúde efetiva,
incluindo veterania, multiplicada pelo nível). O painel agrega pela coordenada
do setor; o filtro por massa d'água permanece na decisão autoritativa de bloqueio
no core. A seção de comboios lista navios ativos ligados ao jogador ou a um
aliado, indicando os donos do navio/destino e o setor do porto de destino. Essa
leitura usa os updates de unidades existentes e não altera as regras do core.

Também há uma camada visual opcional com a grade quadrada dos setores de 64
tiles, coordenadas `x,y` e preenchimento azul translúcido. O renderer a recorta
para tiles de água; o botão “Setores marítimos” alterna essa camada
independentemente do mapa geológico. Ela mostra a divisão espacial estática; a
força naval estimada continua no painel e é atualizada pelos snapshots de
unidades existentes.

O mesmo botão agora mostra uma heatmap estimada de força naval: verde indica
vantagem aliada, amarelo equilíbrio e vermelho vantagem hostil. O cliente agrega
somente navios ativos por setor, atualiza a textura a cada 500 ms enquanto a
camada está visível e só redesenha quando a força/setor muda. A estimativa visual
não é autoritativa e não separa massas d'água dentro do mesmo setor; o core ainda
filtra por água conectada ao porto ao decidir bloqueios.

Validação automatizada: os testes cobrem bloqueio por presença, contrapressão
de escolta, retomada após perda de navio, carga/pagamento na chegada, respeito à
reserva dos recursos e devolução após captura do porto. A regressão
naval/econômica passou:
5 arquivos/38 testes. `tsc --noEmit`, lint, `npm run build-dev` e Prettier
também passaram após esta etapa.

A UI e a camada passaram nos testes de `ResourcePanel`, `NavalSectorMap` e
`ResourceMapController`: cobertura do botão, emissão de evento, desenho das
coordenadas, grade parcial nas bordas do mapa e controle independente das duas
camadas. A camada usa o placement `water` já suportado pelo renderer.
O painel também mostra força naval estimada, validada com navio danificado,
nível, veterania e exclusão de navio fora dos setores com portos próprios. As
regressões focadas passaram em 4 arquivos/7 testes. A heatmap atualiza a textura
quando força/setor muda e mantém a imagem quando os dados são iguais.
`npm run build-dev`, lint direcionado, Prettier e `git diff --check` passaram.

O painel econômico agora permite escolher um porto próprio de origem e um porto
de destino negociável, e solicitar um comboio direto. O core valida novamente
propriedade e estado dos portos, autorização de comércio, capacidade de
construção do navio, limite de três comboios ativos por jogador, bloqueio do
porto e conexão pela mesma massa d'água antes de iniciar a viagem. O intent é
validado por schema e passa pelo fluxo normal de turnos; a UI não cria unidades
nem decide o resultado. A viagem usa carga, pagamento, captura e interceptação
já existentes. A rota manual só aparece na economia estratégica.

Arquivos desta etapa: `src/core/Schemas.ts`,
`src/core/configuration/StrategyConfig.ts`,
`src/core/execution/ExecutionManager.ts`,
`src/core/execution/DispatchTradeRouteExecution.ts`, `src/client/Transport.ts`,
`src/client/hud/layers/ResourcePanel.ts`, traduções em `resources/lang/`, e
testes em `tests/DispatchTradeRouteExecution.test.ts`,
`tests/client/ResourcePanel.test.ts`,
`tests/client/TransportSendPaths.test.ts` e `tests/zbin/wire.test.ts`.
Os testes de execução também confirmam a rejeição de uma origem alheia, da
economia legada, de comércio sob embargo, do limite atingido e de um porto
bloqueado.
Pedidos simultâneos contam contra o mesmo limite, incluindo comboios ainda
enfileirados. A regressão foi reproduzida e coberta em
`tests/DispatchTradeRouteExecution.test.ts`. A revalidação de despacho,
`PortExecution` e `TradeShipExecution` passou em 3 arquivos/21 testes;
`tsc --noEmit`, `npm run lint`, `npm run build-dev`, Prettier e
`git diff --check` também passaram.

Os pathfinders marítimos agora recebem slots de reconstrução determinísticos por
partida. O contador não é compartilhado entre jogos no mesmo processo, então a
ordem de partidas anteriores não muda quando cada comboio recalcula sua rota.
`tests/core/pathfinding/WaterPathStagger.test.ts` cobre isolamento entre jogos
e retorno ao início ao atingir o limite do ciclo.

Complemento em 2026-09-28: `tests/core/executions/TradeShipExecution.test.ts`
passou com 12 testes, incluindo envio de comida, combustível e aço com as
reservas e metas de importação configuradas. `tests/economy/NavalTradeReplay.test.ts`
também passou, comparando hashes, carga e pagamentos em duas simulações. A
revalidação conjunta de `NavalTradeReplay`, `DispatchTradeRouteExecution`,
`PortExecution`, `ResourcePanel`, `ResourceMapController` e `NavalSectorMap`
passou em 6 arquivos/19 testes; `tsc --noEmit`, ESLint, Prettier e
`git diff --check` também passaram.

### Validação manual pendente no PC principal

1. Rode `npm run dev:host`, inicie uma partida com `strategicEconomy` ligado e
   construa dois portos com acesso ao mesmo mar.
2. Mantenha dois navios de guerra inimigos no setor marítimo do porto de destino.
   Novas rotas para esse porto devem parar; navios que já saíram continuam a
   viagem e podem ser interceptados pelas regras atuais.
3. Posicione um navio do dono do porto ou de um aliado no setor. Quando a
   vantagem hostil ficar abaixo de dois, novas rotas devem voltar a ocorrer.
   Afunde ou retire um navio hostil e confirme que a rota também é retomada.
4. Observe uma viagem em que o porto de origem tenha excedente de comida e o
   destino esteja abaixo do alvo. A carga deve sair do estoque ao partir e
   chegar ao porto; o ouro deve ser debitado do importador no embarque e creditado
   ao exportador na chegada. Verifique também os limites da reserva de cada
   recurso e a devolução de carga/depósito ao capturar o porto de destino pelo
   dono da origem.
5. Capture um comboio carregado com outro jogador. Ele deve seguir para o porto
   do captor, que recebe a carga; o comprador original recupera o depósito.
   Afunde um comboio carregado: carga e depósito devem ser perdidos. Repita com
   `strategicEconomy` desligado e confirme que não há carga automática.
6. Com portos próprios e navios de guerra em setores diferentes, abra “Setores e
   rotas marítimas” no painel econômico. Mova ou retire navios aliados/inimigos,
   danifique um navio e melhore outro; a força estimada deve acompanhar saúde,
   nível e veterania. Navios em outro setor não devem entrar na conta.
7. Com a economia estratégica ligada, abra “Despachar rota comercial”, escolha
   dois portos conectados ao mesmo mar e despache. O comboio deve sair do porto
   escolhido e seguir ao destino escolhido, usando as regras existentes de
   carga e pagamento. Tente também destino bloqueado, sem ligação marítima ou
   sob embargo: nenhum comboio deve ser criado. Faça três comboios ativos e
   confirme que o botão fica desabilitado até um deles deixar de estar ativo.
   Com a economia estratégica desligada, essa seção não deve aparecer.
   Observe um comboio próprio ou aliado e confira o dono do porto de destino e
   as coordenadas do setor. Repita em replay e multiplayer.
8. Clique em “Setores marítimos”. Confira as bordas e coordenadas da grade sobre
   a água, compare `x,y` com as coordenadas exibidas no painel e confira a
   heatmap: vantagem aliada verde, equilíbrio amarelo, vantagem hostil vermelha.
   Mova, danifique ou retire navios; a cor/intensidade deve acompanhar os valores
   agregados. Desligue a camada sem afetar o mapa de recursos.

Esperado: o resultado muda deterministicamente com presença, escolta e perdas;
nenhum update por tile ou mapa inteiro é criado. O painel econômico mostra a
força naval estimada nos setores dos portos próprios e os comboios ativos
relacionados ao jogador. A camada do mapa mostra a grade setorial e uma heatmap
agregada estimada na água, sem substituir o bloqueio autoritativo do core. O
jogador escolhe os portos de origem e destino no painel; o core valida a rota
antes de criar o comboio. A validação visual em multiplayer/replay continua
pendente no PC principal.

## Cancelamento de proposta de aliança — issue #8 (parcial)

O jogador que enviou uma proposta pendente pode cancelá-la pelo painel ou menu
radial. O servidor procura a proposta na lista de saídas do remetente autenticado;
cancelamentos feitos pelo destinatário, para outro jogador, ou depois de resolvida
a proposta não alteram o estado. O update de resposta distingue cancelamento de
recusa: o remetente recebe o resultado no histórico e o destinatário remove o
card acionável. A aliança só é criada pelo fluxo de aceite já existente.

Arquivos desta etapa: `src/core/Schemas.ts`,
`src/core/execution/alliance/AllianceCancelExecution.ts`,
`src/core/execution/ExecutionManager.ts`, `src/core/game/AllianceRequestImpl.ts`,
`src/core/game/GameImpl.ts`, `src/core/game/GameUpdates.ts`,
`src/core/GameRunner.ts`, `src/client/Transport.ts`,
`src/client/hud/layers/PlayerPanel.ts`,
`src/client/hud/layers/RadialMenuElements.ts`, `src/client/hud/layers/EventsDisplay.ts`,
`src/client/hud/layers/PlayerActionHandler.ts`, traduções em `resources/lang/` e
testes de execução/wire.

### Validação manual pendente no PC principal

1. Rode `npm run dev:host` e inicie uma partida local com dois jogadores.
2. Envie uma proposta de aliança pelo painel ou menu radial. No jogador remetente,
   deve aparecer “Cancelar pedido de aliança”; no destinatário, o card normal de
   aceitar/recusar deve continuar disponível.
3. Cancele no remetente. A proposta deve desaparecer do destinatário e o histórico
   do remetente deve dizer que o pedido foi cancelado, sem criar uma aliança.
4. Envie uma nova proposta e aceite ou recuse no destinatário. O botão de cancelar
   deve desaparecer; uma tentativa tardia não pode alterar a decisão nem criar uma
   aliança parcialmente aplicada.

A validação automatizada desta etapa passou em 13 arquivos/122 testes e cobre
autorização, cancelamento, estado terminal de propostas resolvidas, transferência
territorial, duração da trégua, atualização sincronizada e codificação do intent.
`tsc --noEmit`, lint e `npm run build-dev` passaram. O painel agora permite
escolher qualquer percentual inteiro de 1% a 50%. Ainda faltam outros termos e
capitulação (acompanhada separadamente na
[issue #12](https://github.com/Nicolas25vlad/OpenFrontIO/issues/12)) e validação
visual em replay e multiplayer; a issue #8 permanece aberta.

### Oferta de paz com cessão territorial (parcial)

O painel do jogador agora permite solicitar uma trégua em troca da cessão de
10% do território do destinatário. O intent mantém `territoryPercent` opcional,
portanto pedidos antigos continuam sendo alianças sem transferência. Ao
aceitar, o servidor planeja toda a cessão antes de alterar o mapa e escolhe uma
região contígua que toque o território do solicitante. O tile de surgimento do
cedente fica protegido. Se o mapa mudou e não existe uma região conectada grande
o bastante, a proposta é recusada sem transferir tiles, criar aliança ou aplicar
os efeitos de aceite.
O core aceita termos inteiros de 1% a 50%; a interface atual oferece 10% como
primeiro valor negociável.

Uma cessão válida cria uma trégua de 180 segundos usando o estado temporário de
aliança existente: ataques ficam bloqueados, a quebra mantém a penalidade de
traição e a expiração é sincronizada pelo fluxo de updates/replay já existente.
`tests/core/game/GameImpl.test.ts` avança o ciclo real de `PlayerExecution` até
o prazo vencer e confirma que a aliança termina, ataques voltam a ser permitidos
e o update `AllianceExpired` é emitido.
As mensagens de proposta e resultado mostram a porcentagem. O planejador ordena
tiles por referência e resolve empates de regiões da mesma forma em todos os
clientes. Para bots, uma oferta de cessão só é aceita se o solicitante for uma
ameaça segundo a heurística atual, não for traidor, não tiver alianças em excesso
e pedir no máximo 10%; termos maiores ou sem ameaça são recusados.

O painel do jogador agora permite escolher qualquer percentual inteiro de 1% a
50% antes de enviar a oferta. A seleção usa o intent e o planejador territorial
existentes; o limite do core continua aceitando apenas percentuais inteiros até
50%.
`tests/client/graphics/layers/PlayerPanelActions.test.ts` confirma que o valor
selecionado chega ao evento e que entradas são limitadas ao intervalo do core.
A revalidação do painel, execução da proposta e planejador de transferência
passou em 3 arquivos/19 testes; `tsc --noEmit`, Oxlint, ESLint, Prettier,
`git diff --check` e `npm run build-dev` passaram.
Os testes focados de painel, proposta, cancelamento, transferência territorial e
comportamento dos bots passaram em 5 arquivos/30 testes. `npm run build-dev`,
`tsc --noEmit`, Oxlint, ESLint, Prettier e `git diff --check` passaram.
Em 2026-09-28, `tests/core/game/GameImpl.test.ts` passou com 5 testes incluindo
a expiração automática da trégua pelo ciclo real da simulação; também passaram
`tsc --noEmit`, ESLint, Prettier e `git diff --check`.

Arquivos desta etapa: `src/core/game/TerritoryTransfer.ts`,
`src/core/game/GameImpl.ts`, `src/core/game/AllianceImpl.ts`,
`src/core/game/AllianceRequestImpl.ts`, `src/core/game/Game.ts`,
`src/core/game/GameUpdates.ts`, `src/core/Schemas.ts`,
`src/core/execution/ExecutionManager.ts`,
`src/core/execution/alliance/AllianceRequestExecution.ts`,
`src/client/Transport.ts`, `src/client/hud/layers/PlayerPanel.ts`,
`src/client/hud/layers/ActionableEvents.ts`, `src/client/hud/layers/EventsDisplay.ts`,
`src/core/execution/nation/NationAllianceBehavior.ts`, traduções em inglês e
português do Brasil e testes de transferência/execução/IA.

Validação no homelab cobre seleção conectada determinística, proteção do spawn,
recusa de termos obsoletos sem estado parcial, duração da trégua e compatibilidade
do intent wire antigo/novo. A validação visual em multiplayer e replay permanece
pendente.

### Validação manual pendente no PC principal

1. Rode `npm run dev:host`, inicie uma partida com dois jogadores em terra
   conectada e abra o painel do destinatário.
2. No campo percentual, envie ofertas de 1%, 37% e 50%. O destinatário deve ver
   a porcentagem correta e poder aceitar ou recusar; o remetente deve poder
   cancelar enquanto estiver pendente.
3. Ao aceitar, confira que o destinatário cede uma região contígua junto à
   fronteira do solicitante, preserva seu tile de surgimento e ambos ficam em
   trégua por 180 segundos. Durante a trégua, ataques entre eles devem ser
   bloqueados; quebrá-la deve aplicar a penalidade normal de traição.
4. Repita após uma terceira conquista separar os territórios ou deixar menos
   área conectada que a porcentagem solicitada. A proposta deve ser recusada sem
   alterar tiles, relações ou aliança.
5. Repita em replay/multiplayer e compare o resultado entre clientes.

Esperado: os mesmos tiles são transferidos em todos os clientes; uma oferta
inválida não produz transferência nem trégua; pedidos comuns de aliança seguem
com o comportamento anterior. A issue #8 continua aberta para outros termos de
paz; capitulação está na
[issue #12](https://github.com/Nicolas25vlad/OpenFrontIO/issues/12).

## Capitulação explícita — issue #12 (implementada; validação manual pendente)

A capitulação agora é uma proposta separada de aliança e cessão percentual. Um
jogador vivo pode propô-la a um inimigo elegível; o destinatário precisa aceitar
explicitamente. Recusa, cancelamento pelo remetente e expiração não mudam
território. Bots não aceitam capitulação automaticamente, e uma contraproposta
comum de aliança não aceita a rendição.

O aceite valida ambos os jogadores e todos os tiles antes de alterar o estado.
Transfere o território inteiro, inclusive o spawn, cancela ataques de entrada e
saída, remove unidades e estruturas, encerra alianças e pedidos pendentes do
rendido e registra a eliminação pelo evento de conquista existente. Aplica a
regra usual de ouro de conquista; ouro restante e estoques de recursos são
descartados. As mensagens e updates usam o fluxo determinístico já replicado e
reproduzido pelo jogo.

Arquivos principais: `src/core/execution/alliance/CapitulationExecution.ts`,
`src/core/game/GameImpl.ts`, `src/core/game/AllianceRequestImpl.ts`,
`src/core/Schemas.ts`, `src/client/Transport.ts`,
`src/client/hud/layers/PlayerPanel.ts`,
`src/client/hud/layers/ActionableEvents.ts` e
`src/client/hud/layers/EventsDisplay.ts`. Termos, etapas manuais e comportamento
esperado estão em [CapitulationDesign.md](CapitulationDesign.md).

Validação no homelab: 35 testes focados passaram em seis arquivos, incluindo
transferência do spawn, autorização, contraproposta, ataques ativos, estruturas,
míssil e limpeza de estoques. Em 2026-09-28, `tests/CapitulationExecution.test.ts`
passou com 8 testes, incluindo hash repetível após aceite por intents do
`Executor`, tentativa de aceite depois da recusa e resolução dos pedidos
diplomáticos de entrada/saída após a eliminação; `tests/AiTankBehavior.test.ts`
passou com 5 testes, incluindo os ciclos integrados de nação e tribo. Também
passaram `tsc --noEmit`, ESLint, Prettier e `git diff --check`. A conferência
visual em dois clientes e replay ainda depende do PC principal; a issue #12
permanece aberta até essa etapa.
O round-trip wire de `capitulation` também está incluído em
`tests/zbin/wire.test.ts` junto com o novo caso de trincheira.
Em 2026-09-28, a interface também ganhou cobertura para propor a capitulação,
distingui-la de um pedido comum, remover o cartão após resolução e registrar o
aceite como conquista. `ActionableEventsCapitulation`, `EventsDisplayHandlers`
e `PlayerPanelActions` passaram em 3 arquivos/26 testes.

## Economia nuclear e Anti-ICBM — issue #9

Na economia estratégica, a usina nuclear enriquece urânio com lotes limitados
por período e exige urânio natural e combustível. Bombas atômicas, de hidrogênio
e MIRVs consomem aço, circuitos e urânio enriquecido no pedido; o lançamento
aguarda o tempo configurado e a fila do silo. Capturar o silo cancela a produção
pendente sem devolver os materiais já consumidos. O Anti-ICBM usa no core os
modificadores centrais de 20% de alcance e 15% de eficiência, enquanto a
configuração legada conserva seus valores anteriores.

Arquivos centrais: `src/core/configuration/StrategyConfig.ts`,
`src/core/configuration/Config.ts`, `src/core/execution/ProductionExecution.ts`,
`src/core/execution/ConstructionExecution.ts`, `src/core/execution/NukeExecution.ts`
e `src/core/execution/SAMLauncherExecution.ts`.

Validação automatizada nuclear: 9 arquivos/56 testes passaram, cobrindo receitas
e custos, tempo de preparo e captura de silo, interceptação estratégica/legada,
trajetórias, balanço, salvas contra SAM e replay determinístico. A suíte geral
passou com 471 arquivos/5.595 testes; os testes de servidor passaram com 63
arquivos/656 testes.

### Checagem manual opcional no PC principal

1. Em partida estratégica, abasteça uma usina com urânio e combustível e observe
   o estoque de urânio enriquecido crescer por período. Sem qualquer insumo, a
   produção deve parar.
2. Construa um silo e encomende cada tipo de arma nuclear. Confira o consumo de
   materiais e os tempos de preparo; captura do silo deve interromper a fila.
3. Lance contra um SAM e confira a interceptação. Com a economia estratégica
   desligada, compare o alcance e a cadência antigos do Anti-ICBM.

O core, custos e resultados já foram validados automaticamente; a checagem acima
serve para observar o feedback visual durante uma partida.

## Prioridade de fábrica de veículos para nações — issue #10 (parcial)

Na economia estratégica, uma nação sem Vehicle Factory pode priorizar uma
construção quando ainda não tem tanques suficientes para acompanhar o tamanho
do exército. O alvo é um tanque por 10.000 infantes, usando a proporção de
`STRATEGIC_COMBAT`; a tentativa exige aço e combustível para o primeiro lote,
respeita a configuração que desativa a estrutura e mantém apenas um pedido
pendente durante o tempo de construção. O comportamento não roda em partidas
legadas. A fábrica é posicionada usando os mesmos critérios de espaçamento e
valor das fábricas existentes.

O benchmark de 1.800 ticks também expôs que a prioridade de comida já tentava
construir fazendas, mas faltava um critério de posicionamento para `Farm`. A
seleção agora espaça fazendas existentes e conclui a decisão sem erro; o caso
ganhou um teste focado.

A prioridade de comida também aguarda uma fazenda em construção terminar antes
de pedir outra. Isso evita que as chamadas frequentes da IA empilhem construções
quando a reserva ainda está baixa e a demanda exige várias fazendas.
Após essa correção, 4 arquivos/78 testes de comportamento estrutural e benchmark
dos bots passaram; `tsc --noEmit`, Oxlint e ESLint também passaram.

Arquivos desta etapa: `src/core/execution/nation/NationStructureBehavior.ts` e
`tests/economy/NationVehicleFactoryPriority.test.ts`,
`tests/economy/NationFarmPriority.test.ts` e
`tests/AiAttackBehavior.test.ts`.

Validação automatizada: 76 testes passaram nos cenários de fazenda, fábrica de
veículos e `NationStructureBehavior`. Os casos incluem exércitos pequeno, médio
e grande, estoque de tanque cheio, insumos insuficientes, economia legada,
repetição sem duplicar pedido e posicionamento da fazenda até enfileirar sua
construção. A decisão de fábrica agora também tem cenários de estoque baixo,
médio (custo da fábrica mais os insumos do primeiro tanque) e alto; nos cenários
médio e alto, o teste executa a construção real sem simular
`maybeSpawnStructure` e confirma a produção do primeiro tanque com o estoque
restante. Agora a cobertura de
5.000, 25.000 e 100.000 tropas usa partidas
reais e confirma que a fazenda é construída após o pedido. A regressão de
economia da IA passou em mais 7 arquivos/24 testes,
cobrindo prioridades de mina, infraestrutura, expansão de recursos, usinas
nucleares, produção e replay determinístico. `tsc --noEmit`, lint,
`npm run build-dev` e Prettier passaram. A suíte completa atual passou com 474
arquivos/5.610 testes; a de servidor, com 63 arquivos/656 testes. O teste novo
de `AiAttackBehavior.test.ts` confirma que uma nação em partida estratégica
desconta tanques da reserva e os embarca em ataques terrestres e navais; a regressão
focada em `AiAttackBehavior`, `Attack` e `NationVehicleFactoryPriority` passou
com 49 testes. A regressão focada em `NationTrenchPriority`,
`NationVehicleFactoryPriority`, `NationStructureBehavior` e `BuildTrenchExecution`
passou com 79 testes.

Agora a IA também pode implantar até dois tanques controláveis quando tem pelo
menos três na reserva, preservando uma unidade para o ataque legado. Unidades
implantadas recebem ordens determinísticas contra uma fronteira hostil. A rotina
roda nas execuções de nação e tribo, fica inativa na economia legada e não varre
fronteiras quando não há tanques para ordenar. `tests/AiTankBehavior.test.ts`
cobre implantação/ordens, reserva protegida e economia legada; o teste de
salvas nucleares confirma que a IA mantém o tempo de resposta esperado.

Na mesma prioridade, nações agora constroem trincheiras em frentes terrestres
sob ameaça, desde que a economia estratégica esteja ativa e haja aço para o
custo configurado. Cada decisão envia uma construção por vez; a quantidade de
tiles fortificados é limitada pela proporção de tropas recebidas, com máximo de
oito tiles, e os níveis existentes são respeitados. A regra usa os ataques
ativos já presentes na simulação e não altera partidas legadas. Cobertura nova
em `tests/economy/NationTrenchPriority.test.ts` verifica construção e consumo
de aço, além dos casos sem recursos e com economia legada.

Na economia estratégica, nações Hard e Impossible também procuram responder
quando um porto próprio está bloqueado: constroem um navio de guerra direcionado
ao bloqueador mais próximo no mesmo setor e massa d'água. A prioridade respeita
limite de frota, unidade desativada, ouro, aço e combustível. As prioridades
existentes de criação inicial e retaliação naval também verificam os insumos
antes de enfileirar a execução, evitando falhas de construção por estoque baixo.
Na economia estratégica, o bot limita a uma ordem naval por tick para não
duplicar um navio ainda pendente; partidas legadas preservam a cadência anterior.
`tests/economy/NationBlockadeResponse.test.ts` cobre a resposta, a compatibilidade
com a economia legada e a ausência de intent sem os insumos.
Em ofertas de paz, o bot agora só cede até 10% do território quando o emissor é
uma ameaça pela heurística de dificuldade e não é traidor; pedidos maiores ou de
atores que não são ameaça são recusados. `tests/NationAllianceBehavior.test.ts`
cobre esses limites.
Em pedidos explícitos de capitulação, a IA de nações e tribos rejeita a proposta
por padrão e só aceita quando o solicitante passa pela heurística de ameaça da
dificuldade, tem mais de quatro vezes as tropas e mais que o dobro do território.
Pedidos obsoletos do spawn são rejeitados antes da decisão. Testes cobrem ambos
os fluxos e preservam a aceitação comum de alianças pelas tribos.
`CapitulationPolicy.test.ts` cobre os ramos Easy, Medium, Hard e Impossible,
incluindo a exceção de muitas alianças. `CapitulationExecution` continua
responsável pela transferência e eliminação autoritativas.
Os testes focados de resposta a bloqueio e infestação naval passaram em 2
arquivos/5 testes; `npm run build-dev`, `tsc --noEmit`, Oxlint, ESLint,
Prettier e `git diff --check` também passaram no homelab.
A suíte principal completa executou 478 arquivos/5.619 testes; 477 arquivos
passaram. O único snapshot divergente identificou a mudança de cadência em modo
legado; após limitar a trava à economia estratégica, o benchmark
`NationGoldPerMinute` e os testes de bots passaram juntos em 3 arquivos/6 testes.
A suíte de servidor passou em 63 arquivos/656 testes.

Atualização de cobertura em 2026-09-28: os testes de IA, fábrica de veículos e
carga naval passaram em 3 arquivos/29 testes. A IA agora tem cobertura de envio
naval com tanques, e a prioridade de fábrica cobre reservas baixas, no custo
mínimo e altas; `tsc --noEmit`, lint, Prettier e `git diff --check` também
passaram.

Correção em 2026-09-28: a prioridade de Vehicle Factory agora exige, antes de
enfileirar, o estoque combinado para construir a fábrica e financiar o primeiro
lote de tanques. A regra anterior conferia apenas o lote; o teste integrado
mostrou que `canBuild` recusava a fábrica sem os 30 de aço e 5 circuitos da
construção. Os cenários baixo, médio e alto agora executam a construção real
quando há materiais suficientes; médio e alto também produzem o primeiro tanque
com o estoque restante. Testes também recusam aço abaixo do custo ou
circuitos insuficientes. A regressão relacionada passou em 5 arquivos/92 testes;
`tsc --noEmit`, Oxlint, ESLint, Prettier, `git diff --check` e
`npm run build-dev` também passaram. O build mantém os avisos conhecidos de
chunks maiores que 500 kB e tempo do plugin de assets.

Na primeira execução completa, 484 de 485 arquivos passaram; os nove casos
falhos em `NationAllianceBehavior.test.ts` usavam fixtures sem o novo `kind()`.
Após atualizar os fixtures e cobrir capitulações, a suíte completa foi repetida
e passou em 485 arquivos/5.667 testes. `tsc --noEmit` e lint também passaram.

### Validação manual pendente no PC principal

1. Rode `npm run dev:host` e inicie partidas com nações usando
   `strategicEconomy` e tropas suficientes para consumir a reserva de comida.
2. Observe a construção de fazendas quando o estoque de comida fica abaixo do
   alvo; a decisão deve escolher um tile válido e não gerar erro no turno.
3. Teste com 10.000, 50.000 e 100.000 infantes se a nação solicita uma única
   Vehicle Factory quando faltam tanques e existem os materiais para construir
   a fábrica e produzir o primeiro lote (aço, circuitos e combustível). Com
   estoque no alvo ou sem qualquer insumo, ela não deve solicitá-la.
4. Sob ataque terrestre, confira se a nação fortifica tiles próprios na linha de
   contato quando há aço. O total de tiles fortificados deve crescer com a
   proporção entre tropas recebidas e tropas próprias, até o limite de oito;
   ataques navais, aço insuficiente e economia legada não devem criar trincheiras.
5. Repita com economia estratégica desligada; essas novas prioridades não devem
   atuar.
6. Em dificuldade Hard ou Impossible, bloqueie o setor de um porto da nação
   com navios inimigos. Com ouro, aço e combustível disponíveis, ela deve enviar
   um navio de resposta ao setor; sem qualquer insumo, não deve enfileirar a
   construção nem interromper a partida.
7. Envie ofertas de cessão de 10% e 11% para uma nação Medium. Ela só deve
   aceitar 10% se o solicitante tiver mais de 2,5 vezes suas tropas; em condições
   iguais, ou com pedido acima de 10%, deve recusar.
8. Com pelo menos três tanques em reserva e economia estratégica ativa, observe
   uma nação implantar até dois tanques e enviar ordens contra uma fronteira
   hostil. Ela deve conservar um tanque para os ataques de infantaria. Com uma
   reserva ou economia legada, não deve implantar unidades independentes.
9. Solicite capitulação a uma nação e a uma tribo com forças próximas: ambas
   devem recusar. Repita quando o solicitante tiver mais de quatro vezes as
   tropas e mais que o dobro do território, atendendo também à heurística de
   ameaça da dificuldade: ambas devem aceitar e o core deve concluir a
   transferência. Uma solicitação criada durante o spawn deve ser rejeitada.

Esperado: a nação tenta no máximo uma construção por vez, respeita o limite de
reserva e continua a usar as regras de construção existentes. A issue permanece
aberta para decisões adicionais de tanques, fortificações, marinha, bloqueios e
negociação de bots, além da cobertura adicional dos critérios de economia
baixa/média/alta.

### Revalidação geral do branch — 2026-09-28

A suíte completa passou em 485 arquivos/5.667 testes após a correção dos
fixtures de capitulação e inclui as regressões de carga/replay naval e tanques
transportados por bots. `tsc --noEmit`, `npm run lint`, Prettier e
`git diff --check` também passaram. `npm run build-dev` passou após a última
alteração de código de runtime (carga naval); os commits posteriores só alteram
testes e documentação. A revisão visual continua pendente no PC principal
conforme os procedimentos descritos nas respectivas seções.
