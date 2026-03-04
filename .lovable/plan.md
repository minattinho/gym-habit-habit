

## Refatorar Tela de Progresso

A tela atual é básica: um select simples, 2 cards de stats e 2 gráficos separados. Vamos reconstruí-la completamente conforme os requisitos.

### Arquitetura

Dividir em componentes menores para manter o arquivo gerenciável:

- `src/pages/ProgressPage.tsx` — orquestrador principal (state, queries)
- `src/components/progress/ExerciseSearchSelect.tsx` — dropdown com busca + seção "Recentes"
- `src/components/progress/SummaryCards.tsx` — 4 cards de resumo
- `src/components/progress/ProgressChart.tsx` — gráfico principal com filtros
- `src/components/progress/SessionHistory.tsx` — histórico detalhado por sessão

### Data Fetching (ProgressPage.tsx)

**Query principal**: Uma única query que busca todas as `session_exercises` do exercício selecionado com joins:
```
session_exercises -> training_sessions (started_at, workout_name, completed_at, user_id)
                  -> session_sets (weight, reps, is_completed, id, order_index)
```
Filtrar apenas sessões completadas (`completed_at IS NOT NULL`). Processar todos os cálculos no cliente (e1RM, volume, melhor set, PRs).

**Query de exercícios recentes**: Buscar os últimos 5 `session_exercises` distintos por `exercise_id` do usuário, ordenados por `created_at DESC`, para popular a seção "Recentes" no dropdown.

**State**:
- `selectedExercise: string`
- `period: '30d' | '90d' | '1y' | 'all'` (default: 'all')
- `metric: 'e1rm' | 'weight' | 'volume' | 'reps'` (default: 'e1rm')

### 1) ExerciseSearchSelect

- Usar `Popover` + `Command` (cmdk, já instalado) para criar um combobox com busca
- Input de busca no topo filtra exercícios pelo nome
- Seção "Recentes" (últimos 5 exercícios usados) aparece primeiro, separada por `CommandGroup`
- Seção "Todos os exercícios" abaixo, agrupada alfabeticamente
- Mostrar `muscle_group` como badge ao lado do nome
- No estado vazio da tela (sem exercício selecionado), o CTA "Ver recentes" abre o popover programaticamente

### 2) SummaryCards (4 cards em grid 2x2)

Todos os cálculos derivados dos dados da query principal:

| Card | Título | Valor principal | Subtexto |
|------|--------|----------------|----------|
| Última sessão | "Última sessão" | Data + treino | Melhor set: "8×60kg" |
| PR de carga | "PR de carga" | "60kg" | Data + treino |
| PR de 1RM | "1RM estimado" | "92kg" (Epley) | Data + treino |
| PR de volume | "PR de volume" | "1200kg" | Data + treino |

**Fórmula Epley**: `e1RM = weight * (1 + reps / 30)`
**Melhor set do dia**: set com maior e1RM (não apenas maior carga)

Ícones: Calendar, Trophy, TrendingUp, Dumbbell

### 3) Filtros (inline, compactos)

- **Período**: 4 botões tipo toggle group (30d / 90d / 1a / Tudo)
- **Métrica**: Select dropdown pequeno (1RM estimado / Carga / Volume / Reps)
- Layout: uma linha horizontal com período à esquerda e métrica à direita

### 4) ProgressChart (gráfico principal)

- `LineChart` do recharts (já instalado)
- Eixo X: datas das sessões
- Eixo Y: valor da métrica selecionada
- **Tooltip customizado**: mostra data completa, nome do treino, total de sets, melhor set, volume, valor da métrica
- **Marcadores de PR**: pontos onde o valor é o maior até aquele momento recebem um dot maior com label "PR" (usar `ReferenceDot` ou customizar o dot do recharts)
- Filtragem por período aplicada nos dados antes de passar ao gráfico

### 5) SessionHistory (abaixo do gráfico)

- Lista agrupada por sessão (data descendente)
- Cada item:
  - Header: data formatada + nome do treino
  - Sets listados inline: "12×40 · 10×45 · 8×50" (sets com dados incompletos mostram "—" discretamente)
  - Volume total do dia
  - Melhor set destacado com badge "Melhor"
- **Editar/Excluir set**: botões discretos (icon buttons) que abrem modal para editar peso/reps ou confirmar exclusão. Mutations atualizam `session_sets` diretamente e invalidam a query.

### 6) Estados

- **Loading**: Skeleton cards + skeleton gráfico
- **Vazio (sem exercício)**: Card com ícone TrendingUp + texto + CTA "Ver recentes"
- **Sem dados no período**: Card com ícone Calendar + "Sem treinos neste período" + sugestão de ampliar filtro
- **Sem dados nunca**: Card com "Treine este exercício para ver seu progresso"
- **Erro**: Toast com mensagem genérica

### Arquivos a criar/editar

| Arquivo | Ação |
|---------|------|
| `src/pages/ProgressPage.tsx` | Reescrever completamente |
| `src/components/progress/ExerciseSearchSelect.tsx` | Criar |
| `src/components/progress/SummaryCards.tsx` | Criar |
| `src/components/progress/ProgressChart.tsx` | Criar |
| `src/components/progress/SessionHistory.tsx` | Criar |
| `src/lib/exercise-stats.ts` | Criar — funções puras de cálculo (e1RM, melhor set, PRs, filtragem por período) |

Nenhuma alteração de banco de dados necessária. Todos os dados já existem nas tabelas `session_exercises`, `session_sets` e `training_sessions`.

