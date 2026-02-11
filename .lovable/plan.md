

## Próximo Treino - Início Rápido

### Funcionalidade
Ao abrir o app, exibir um card destacado no topo da página de treinos mostrando o **próximo treino a ser feito**, com botão de início rápido. A lógica determina qual treino vem a seguir baseado no último treino completado.

### Lógica de Rotação
1. Buscar a **última sessão completada** do usuário (`training_sessions` ordenado por `completed_at DESC`)
2. Buscar **todos os treinos** do usuário ordenados por `created_at`
3. Encontrar o índice do treino da última sessão na lista
4. O próximo treino é o **seguinte na lista** (com rotação circular - após o último, volta ao primeiro)
5. Se não houver sessões anteriores, sugere o primeiro treino da lista

### UI - Card "Próximo Treino"
- Card destacado no topo da página, antes da lista de treinos
- Visual diferenciado: borda colorida, ícone de relâmpago/foguete
- Mostra o nome do treino, quantidade de exercícios, e cor
- Texto contextual: "Seu último treino foi **Treino B**. Hoje é dia de:"
- Botão grande "INICIAR AGORA" com a cor do treino
- Se não houver treinos cadastrados, não exibe o card

---

### Detalhes Técnicos

**Arquivo modificado:** `src/pages/WorkoutsPage.tsx`

1. Adicionar query para buscar a última sessão completada:
   - `SELECT workout_id FROM training_sessions WHERE completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 1`

2. Calcular o próximo treino com lógica de rotação circular sobre a lista de workouts

3. Renderizar um card hero no topo com o próximo treino sugerido e botão de início rápido (reutilizando a função `startSession` já existente)

