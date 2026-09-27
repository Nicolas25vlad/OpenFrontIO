# Checklist de compatibilidade estratégica

Use esta checklist antes de ativar ou alterar o comportamento de cada sistema
estratégico. A opção `strategicEconomy` continua sendo o limite de compatibilidade:
configurações antigas sem esse campo devem manter o comportamento legado.
Marque os itens por sistema e registre os comandos, mapas e configurações usados;
uma aprovação de outro sistema não aprova este.

## Gate automatizado

- [ ] Configurações antigas sem `strategicEconomy` carregam sem migração e
  mantêm o sistema novo desligado.
- [ ] O mesmo mapa, seed, configuração e sequência de intents produzem os
  mesmos estoques, unidades e hashes em duas simulações independentes.
- [ ] Valores autoritativos são calculados no core. Updates completos e diffs
  levam os campos necessários a dois clientes; campos inalterados não são
  reenviados a cada turno.
- [ ] Nenhum payload serializa estado por tile quando o estado pode ser
  agregado por jogador ou estrutura.
- [ ] Custos são validados no preview e novamente na execução. Falta de
  estoque, cancelamento e intents concorrentes não duplicam nem perdem
  recursos.
- [ ] Com `strategicEconomy: false` ou ausente, testes confirmam o resultado
  legado para produção, custos, supply e combate afetados pelo sistema.
- [ ] `npm test`, `npm run build-dev` e `npm run lint` passam.
- [ ] Quando houver alteração no custo por mapa, jogador ou turno, comparar
  baseline e resultado com `npm run perf:game`, `npm run perf:client` e
  `npm run perf:client-mem`; registrar diferenças e tamanho dos updates.

## Gate manual no cliente

Para cada sistema com UI ou visual novo, executar no PC principal usando
`npm run dev:host` e uma partida local. Repetir com a opção estratégica ligada
e desligada e registrar mapa, navegador, configuração e resultado.

- [ ] Opção e estado aparecem corretamente no lobby, partida solo e partida
  multiplayer hospedada.
- [ ] Estoques, custos, produção, consumo e mensagens de insuficiência
  correspondem ao estado do core após construir, cancelar, capturar e esgotar
  estruturas relevantes.
- [ ] Painéis, heatmaps, unidades e indicadores continuam legíveis em zooms
  diferentes; conferir console e erros de renderização.
- [ ] O cliente que entra ou reconecta recebe o estado atual sem divergência
  visual ou de interação.
- [ ] Replay da partida conserva valores, ordem dos eventos e aparência do
  sistema após avançar, pausar e voltar.

## Registro por sistema

Copie este bloco para a validação de cada sistema. Deixe a ativação pendente
enquanto houver um item aplicável sem evidência.

```text
Sistema / issue:
Commit:
Configuração e mapa:
Evidência automatizada (comandos e resultado):
Evidência manual (navegador e resultado):
Diferenças de performance / payload:
Pendências e responsável:
Decisão: pendente | aprovado | reprovado
```

O plano de requisitos e o estado de implementação ficam em
[`StrategicExpansion.md`](StrategicExpansion.md). Este documento é um gate de
validação, não uma declaração de que todos os sistemas estratégicos já foram
aprovados.

## Regressão automatizada — 2026-09-27

Após corrigir o posicionamento de fazendas, a suíte principal passou com 473
arquivos e 5.601 testes; a suíte de servidor passou com 63 arquivos e 656
testes. Os comandos foram executados em modo serial no Node 26 com Web Storage:

```sh
NODE_OPTIONS="--experimental-webstorage --localstorage-file=/tmp/openfront-vitest-final-20260927" npx vitest run --maxWorkers=1
NODE_OPTIONS="--experimental-webstorage --localstorage-file=/tmp/openfront-vitest-server-final-20260927" npx vitest run tests/server --maxWorkers=1
```

`npm run build-dev`, `npm run lint` e `npx prettier --check` nos arquivos
alterados também passaram. A prioridade de fábrica de veículos não cria estado
por tile, não altera schemas ou updates de rede e é coberta em economia
estratégica e modo legado por `tests/economy/NationVehicleFactoryPriority.test.ts`.
O caminho de posicionamento de fazendas está coberto em
`tests/economy/NationFarmPriority.test.ts`.
As decisões visuais e de multiplayer dos sistemas com HUD continuam pendentes
no PC principal, conforme os procedimentos por issue em
[`StrategicExpansion.md`](StrategicExpansion.md).

## Comparação dos harnesses — 2026-09-27

Os harnesses `perf:game` e `perf:client` agora aceitam `--strategic-economy`,
para comparar a mesma seed e população com a regra desligada/ligada. O shim de
cliente fornece `document` e eventos via JSDOM, e o stub WebGL reconhece os
uploads de glow e ribbons que o builder já dispara.

Execução no mapa World, seed `strategic-quality-long-20260927`, 40 bots,
nações padrão (112 no início), 1.800 ticks de jogo, sem profiler:

```sh
npm run perf:game -- --ticks 1800 --bots 40 --seed strategic-quality-long-20260927 --window 300 --no-cpu-profile --no-exec-profile --no-gc-profile --no-alloc-profile
npm run perf:game -- --ticks 1800 --bots 40 --seed strategic-quality-long-20260927 --window 300 --no-cpu-profile --no-exec-profile --no-gc-profile --no-alloc-profile --strategic-economy
npm run perf:client -- --ticks 1800 --bots 40 --seed strategic-quality-long-20260927 --no-cpu-profile
npm run perf:client -- --ticks 1800 --bots 40 --seed strategic-quality-long-20260927 --no-cpu-profile --strategic-economy
```

| Medida | Legado | Estratégica |
| --- | ---: | ---: |
| Simulação por tick: média / p95 / máximo | 4,51 / 9,26 / 33,2 ms | 4,04 / 8,53 / 30,5 ms |
| Heap máximo da simulação | 78 MB | 83 MB |
| Worker tick: média / p95 / máximo | 4,68 / 9,33 / 34,3 ms | 4,20 / 8,70 / 34,4 ms |
| Cliente: burst principal média / p95 / máximo | 0,36 / 0,58 / 3,02 ms | 0,40 / 0,85 / 3,77 ms |
| Pares de tile: média / máximo por tick | 629 / 3.489 | 493 / 3.489 |
| Updates de jogador no período | 4.563 | 17.187 |
| PlayerUpdate records (V8 estimate) | 0,62 MB | 3,24 MB |
| Other object data (V8 estimate) | 2,31 MB | 2,35 MB |
| Transfer buffers (exact byteLength) | 19,65 MB | 17,08 MB |
| Payload estimate combined | 22,57 MB | 22,67 MB |
| Heap máximo do cliente | 128 MB | 131 MB |

Hashes finais reproduzidos entre os harnesses para cada modo: `20338747193607844`
(legado) e `13300853492325580` (estratégico). Os modos divergem no estado da
partida, então estes números são um perfil de referência, não uma comparação
estatística de regressão. O volume de pares de tile não cresceu no modo
estratégico. O objeto de PlayerUpdate cresceu porque envia stocks, rates e supply
quando mudam (`supply=8.134`, `resources=5.569`, `resourceRates=2.279` campos);
os campos inalterados continuam omitidos pelo diff. A estimativa total ficou
praticamente igual porque o modo estratégico emitiu menos pares de tile nessa
simulação. A parte de objetos usa `v8.serialize` como aproximação da clonagem;
os buffers transferidos usam `byteLength` exato. O p95 do burst principal ficou
abaixo de 16,7 ms. O perfil estratégico também percorreu o gatilho de fazenda no
tick 702, que revelou e levou à correção do critério ausente de posicionamento.
Nenhum estado novo por tile ou schema de rede foi introduzido pela prioridade
de bot.
