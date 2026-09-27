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
