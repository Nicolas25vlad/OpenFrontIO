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

Após o commit `58684a3a`, a suíte principal passou com 472 arquivos e 5.600
testes; a suíte de servidor passou com 63 arquivos e 656 testes. Os comandos
foram executados em modo serial no Node 26 com Web Storage:

```sh
NODE_OPTIONS="--experimental-webstorage --localstorage-file=/tmp/openfront-vitest-quality-20260927" npx vitest run --maxWorkers=1
NODE_OPTIONS="--experimental-webstorage --localstorage-file=/tmp/openfront-vitest-server-quality-20260927" npx vitest run tests/server --maxWorkers=1
```

`npm run build-dev`, `npm run lint` e `npx prettier --check` nos arquivos
alterados também passaram. A prioridade de fábrica de veículos não cria estado
por tile, não altera schemas ou updates de rede e é coberta em economia
estratégica e modo legado por `tests/economy/NationVehicleFactoryPriority.test.ts`.
As decisões visuais e de multiplayer dos sistemas com HUD continuam pendentes
no PC principal, conforme os procedimentos por issue em
[`StrategicExpansion.md`](StrategicExpansion.md).

## Comparação dos harnesses — 2026-09-27

Os harnesses `perf:game` e `perf:client` agora aceitam `--strategic-economy`,
para comparar a mesma seed e população com a regra desligada/ligada. O shim de
cliente fornece `document` e eventos via JSDOM, e o stub WebGL reconhece os
uploads de glow e ribbons que o builder já dispara.

Execução no mapa World, seed `strategic-quality-nations-20260927`, 40 bots,
nações padrão (112 jogadores), 300 ticks de jogo, sem profiler:

```sh
npm run perf:game -- --ticks 300 --bots 40 --seed strategic-quality-nations-20260927 --window 100 --no-cpu-profile --no-exec-profile --no-gc-profile --no-alloc-profile
npm run perf:game -- --ticks 300 --bots 40 --seed strategic-quality-nations-20260927 --window 100 --no-cpu-profile --no-exec-profile --no-gc-profile --no-alloc-profile --strategic-economy
npm run perf:client -- --ticks 300 --bots 40 --seed strategic-quality-nations-20260927 --no-cpu-profile
npm run perf:client -- --ticks 300 --bots 40 --seed strategic-quality-nations-20260927 --no-cpu-profile --strategic-economy
```

| Medida | Legado | Estratégica |
| --- | ---: | ---: |
| Simulação por tick: média / p95 / máximo | 4,96 / 10,1 / 23,4 ms | 5,56 / 12,3 / 23,4 ms |
| Heap máximo da simulação | 55 MB | 43 MB |
| Worker tick: média / p95 / máximo | 5,05 / 10,4 / 23,1 ms | 5,46 / 12,0 / 22,9 ms |
| Cliente: burst principal média / p95 / máximo | 0,40 / 0,69 / 1,82 ms | 0,58 / 1,46 / 3,03 ms |
| Pares de tile: média / máximo por tick | 1.152 / 3.530 | 1.155 / 3.530 |
| Updates de jogador no período | 1.262 | 5.925 |
| Heap máximo do cliente | 98 MB | 109 MB |

Hashes finais reproduzidos entre harnesses para cada modo: `6485522067183785`
(legado) e `6070320339526102` (estratégico). Esta amostra é curta e muda a
simulação ao alternar o modo; os tempos não são uma comparação estatística de
regressão. Não houve crescimento relevante nos pares de tile. O maior número de
updates de jogador coincide com os campos econômicos ativos e deve ser medido
em uma janela mais longa antes de qualquer otimização; nesta amostra, os p95 de
clone e GameView ficaram individualmente abaixo de 1,5 ms por tick, e o p95 do
burst principal ficou abaixo do limite de 16,7 ms do cliente. Nenhum estado
novo por tile ou schema de rede foi introduzido pela prioridade de bot.
