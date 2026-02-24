

## Corrigir Performance da Sessão de Treino (Mobile)

### Problemas identificados

**1. Cada clique no +/- dispara uma chamada ao banco de dados**
Toda vez que o usuário clica no botão + ou - do `NumberStepper`, o `onChange` é chamado imediatamente, o que dispara `updateSetMutation.mutate()`. Isso faz uma request HTTP ao Supabase e, no `onSuccess`, invalida toda a query da sessão -- causando um refetch completo de todos os exercícios e séries. Em conexões móveis lentas, a UI trava esperando o ciclo completo (update -> invalidate -> refetch).

**2. Finalizar treino faz N+1 queries sequenciais**
A função `checkAndSubmitPRs` faz, para cada série completada, uma query sequencial ao banco (buscar PR existente + inserir novo PR). Com 5 exercícios x 3 séries = até 15 queries sequenciais antes de redirecionar.

### Soluções

**1. Debounce no NumberStepper + Optimistic Updates**
- Adicionar debounce de 500ms no `NumberStepper` para que múltiplos cliques rápidos resultem em apenas uma chamada ao banco
- Usar optimistic update no `updateSetMutation` para atualizar o cache local imediatamente, sem esperar a resposta do servidor

**2. Otimizar checkAndSubmitPRs**
- Buscar todos os PRs do usuário de uma vez (uma única query) em vez de um por exercício
- Fazer os inserts de novos PRs em paralelo com `Promise.all`

### Alterações por arquivo

**`src/components/ui/number-stepper.tsx`**
- Adicionar debounce interno: acumular cliques e só chamar `onChange` após 500ms de inatividade
- Atualizar o valor visual imediatamente (estado local), mas atrasar a chamada ao banco

**`src/pages/SessionPage.tsx`**
- Implementar optimistic update no `updateSetMutation`: atualizar o cache do React Query imediatamente no `onMutate`, sem esperar a resposta
- Remover a invalidação no `onSuccess` para weight/reps (o cache já está atualizado)
- Manter invalidação apenas para `is_completed` (checkbox)

**`src/lib/pr.ts`**
- Refatorar `checkAndSubmitPRs` para:
  1. Buscar todos os PRs existentes do usuário em uma única query
  2. Comparar localmente
  3. Inserir todos os novos PRs de uma vez (batch ou `Promise.all`)

### Detalhes Técnicos

**Debounce no NumberStepper:**
```text
Clique +  ->  valor visual atualiza instantaneamente (estado local)
             ->  timer de 500ms reseta
Clique +  ->  valor visual atualiza instantaneamente
             ->  timer de 500ms reseta
(500ms sem clique)
             ->  onChange(valorFinal) dispara UMA vez
```

**Optimistic Update no updateSetMutation:**
```text
onMutate: (variables) => {
  // Cancela queries pendentes
  // Salva snapshot do cache
  // Atualiza cache imediatamente com os novos valores
}
onError: (err, variables, context) => {
  // Restaura snapshot em caso de erro
}
onSettled: () => {
  // Invalida queries apenas se necessário
}
```

**PR check otimizado:**
```text
Antes: N queries sequenciais (1 por exercício com séries)
Depois: 1 query para buscar todos os PRs + 1 insert batch
```

