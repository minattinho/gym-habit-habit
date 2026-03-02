

## Mostrar Histórico da Sessão Anterior Durante o Treino

### Objetivo
Exibir, para cada exercício e série na sessão atual, os valores de carga e repetições da última sessão completada do mesmo treino (`workout_id`), permitindo comparação direta.

### Como funciona

A sessão atual já tem `workout_id`. Ao carregar a sessão, faremos uma query adicional para buscar a última sessão completada do mesmo `workout_id` (excluindo a atual), com seus exercícios e séries. Os dados anteriores serão exibidos como referência ao lado de cada série.

### Alterações

**`src/pages/SessionPage.tsx`**

1. **Nova query**: Adicionar uma segunda `useQuery` que busca a última sessão completada do mesmo `workout_id`:
   - `training_sessions` onde `workout_id = session.workout_id`, `completed_at IS NOT NULL`, `id != session.id`, ordenado por `completed_at DESC`, limit 1
   - Incluir `session_exercises` e `session_sets` dessa sessão

2. **Mapa de dados anteriores**: Criar um mapa `exercise_id -> sets[]` da sessão anterior para lookup rápido

3. **UI por série**: Abaixo dos campos de Carga e Repetições de cada série, mostrar uma linha discreta com os valores anteriores, ex:
   - `Anterior: 40kg × 12` em texto pequeno e cor `muted-foreground`
   - Se a carga atual for maior, destacar com seta verde (↑); se menor, seta vermelha (↓)

4. **UI será compacta**: Apenas uma linha de texto pequena por série, sem ocupar espaço extra significativo

### Exemplo visual

```text
┌─────────────────────────────────┐
│ Série 1                    [✓] │
│ Carga (Kg)       Repetições    │
│ [- 42 +]         [- 12 +]     │
│ Anterior: 40kg × 10  ↑        │
└─────────────────────────────────┘
```

