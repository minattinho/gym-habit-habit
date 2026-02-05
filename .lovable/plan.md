

## Plano de Implementação - Gestor de Treinos "GymOG"

### Resumo

Implementar o app completo de treinos utilizando o banco de dados Supabase já configurado com as tabelas: `profiles`, `exercises`, `workouts`, `workout_exercises`, `training_sessions`, `session_exercises`, `session_sets`, `personal_records` e `goals`.

---

### Fase 1: Configuracao Base

**1.1 PWA e Tema Escuro**
- Configurar `manifest.json` para PWA instalavel
- Adicionar service worker basico
- Atualizar `index.html` com meta tags PWA
- Configurar tema escuro como padrao em `index.css` com cores vibrantes (verde neon #22c55e para acoes)

**1.2 Estrutura de Rotas**
```text
/auth          -> Login/Cadastro
/              -> Meus Treinos (Home)
/workout/new   -> Criar Treino
/workout/:id   -> Editar Treino
/session/:id   -> Executar Sessao
/history       -> Historico
/progress      -> Progresso
/profile       -> Perfil
```

**1.3 Layout Base**
- Criar `MainLayout.tsx` com bottom tab bar (4 abas)
- Criar `AuthLayout.tsx` para telas de login

---

### Fase 2: Autenticacao

**2.1 Contexto de Auth**
- Criar `AuthContext.tsx` com estado do usuario
- Listener `onAuthStateChange` para sessao persistente
- Hook `useAuth()` para acesso global

**2.2 Tela de Login/Cadastro**
- `AuthPage.tsx` com tabs Login/Cadastro
- Formularios com email/senha
- Validacao com Zod
- Redirect automatico apos login

**2.3 Protecao de Rotas**
- `ProtectedRoute.tsx` que redireciona para `/auth` se nao logado

---

### Fase 3: Meus Treinos (Home)

**3.1 Lista de Treinos**
- `WorkoutsPage.tsx` - lista de cards
- Cada card mostra: nome, cor, descricao, numero de exercicios
- Botoes: Iniciar, Editar, Duplicar, Excluir

**3.2 Criar/Editar Treino**
- `WorkoutFormPage.tsx`
- Formulario: nome, descricao, cor
- Adicionar exercicios da biblioteca
- Para cada exercicio: series planejadas, reps alvo, peso alvo
- Reordenar exercicios (drag and drop simples)

**3.3 Hooks de Dados**
- `useWorkouts()` - listar treinos do usuario
- `useWorkout(id)` - detalhes de um treino
- `useCreateWorkout()` - criar
- `useUpdateWorkout()` - atualizar
- `useDeleteWorkout()` - excluir
- `useDuplicateWorkout()` - duplicar

---

### Fase 4: Biblioteca de Exercicios

**4.1 Componente Seletor**
- `ExerciseSelector.tsx` - modal/sheet para escolher exercicio
- Busca por nome
- Filtros por grupo muscular (tabs ou chips)
- Opcao de criar exercicio personalizado

**4.2 Seed de Exercicios Globais**
- Inserir ~50 exercicios pre-cadastrados via SQL (is_global = true)
- Organizados por grupo: Peito, Costas, Pernas, Ombros, Biceps, Triceps, Core, Cardio

**4.3 Hooks**
- `useExercises()` - listar todos (globais + do usuario)
- `useCreateExercise()` - criar exercicio customizado

---

### Fase 5: Sessao de Treino (Executar)

**5.1 Iniciar Sessao**
- Criar registro em `training_sessions`
- Copiar exercicios do treino modelo para `session_exercises`
- Criar sets iniciais em `session_sets`

**5.2 Tela de Execucao**
- `SessionPage.tsx`
- Cronometro da sessao (tempo decorrido)
- Lista de exercicios com suas series
- Para cada serie:
  - Input peso (numerico grande)
  - Input reps (numerico grande)
  - Toggle concluido (checkbox grande)
  - Auto-fill com dados da ultima sessao
- Botao "Adicionar Serie"
- Indicador de PR quando peso/volume supera recorde

**5.3 Finalizar Sessao**
- Modal para observacoes finais
- Calcular duracao
- Atualizar `completed_at` e `duration_seconds`
- Verificar e salvar novos PRs em `personal_records`

**5.4 Hooks**
- `useStartSession()` - iniciar nova sessao
- `useSession(id)` - dados da sessao ativa
- `useUpdateSet()` - atualizar serie
- `useAddSet()` - adicionar serie
- `useCompleteSession()` - finalizar
- `useLastSessionData(exerciseId)` - buscar peso/reps anteriores

---

### Fase 6: Historico

**6.1 Lista de Sessoes**
- `HistoryPage.tsx`
- Lista ordenada por data (mais recentes primeiro)
- Filtros: por treino, por periodo
- Card resumo: data, nome do treino, duracao, volume total

**6.2 Detalhes da Sessao**
- `SessionDetailsPage.tsx` ou modal
- Lista completa de exercicios e series realizadas
- Estatisticas: total de series, volume, PRs batidos

**6.3 Hooks**
- `useSessions()` - listar sessoes com filtros
- `useSessionDetails(id)` - detalhes completos

---

### Fase 7: Progresso

**7.1 Selecao de Exercicio**
- `ProgressPage.tsx`
- Dropdown/select para escolher exercicio
- Busca rapida

**7.2 Estatisticas**
- Cards com:
  - PR de peso (maior peso levantado)
  - PR de volume (peso x reps)
  - Ultimo treino deste exercicio
  - Total de vezes treinado

**7.3 Graficos**
- Grafico de linha: evolucao do peso maximo ao longo do tempo
- Grafico de linha: evolucao do volume total
- Usar Recharts (ja instalado)

**7.4 Hooks**
- `useExerciseProgress(exerciseId)` - estatisticas e dados para grafico
- `usePersonalRecords(exerciseId)` - lista de PRs

---

### Fase 8: Perfil

**8.1 Tela de Perfil**
- `ProfilePage.tsx`
- Avatar (upload para storage bucket `avatars`)
- Nome do usuario
- Email (readonly)
- Estatisticas gerais: total de treinos, total de sessoes

**8.2 Acoes**
- Editar nome/avatar
- Botao Logout

**8.3 Hooks**
- `useProfile()` - dados do perfil
- `useUpdateProfile()` - atualizar

---

### Arquivos a Criar

```text
src/
├── contexts/
│   └── AuthContext.tsx
├── components/
│   ├── layout/
│   │   ├── MainLayout.tsx
│   │   ├── AuthLayout.tsx
│   │   ├── BottomNav.tsx
│   │   └── ProtectedRoute.tsx
│   ├── workout/
│   │   ├── WorkoutCard.tsx
│   │   ├── WorkoutForm.tsx
│   │   └── ExerciseItem.tsx
│   ├── exercise/
│   │   ├── ExerciseSelector.tsx
│   │   ├── ExerciseCard.tsx
│   │   └── ExerciseForm.tsx
│   ├── session/
│   │   ├── SessionTimer.tsx
│   │   ├── SessionExercise.tsx
│   │   ├── SetRow.tsx
│   │   └── PRBadge.tsx
│   └── progress/
│       ├── StatCard.tsx
│       └── ProgressChart.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useWorkouts.ts
│   ├── useExercises.ts
│   ├── useSessions.ts
│   └── useProgress.ts
├── pages/
│   ├── AuthPage.tsx
│   ├── WorkoutsPage.tsx
│   ├── WorkoutFormPage.tsx
│   ├── SessionPage.tsx
│   ├── HistoryPage.tsx
│   ├── SessionDetailsPage.tsx
│   ├── ProgressPage.tsx
│   └── ProfilePage.tsx
└── lib/
    └── exercises-seed.ts
```

---

### Detalhes Tecnicos

**Banco de Dados (ja configurado)**
- RLS ativo em todas as tabelas
- Helper functions: `owns_workout()`, `owns_session()`, `owns_session_exercise()`
- Trigger `handle_new_user()` cria perfil automaticamente
- Storage buckets: `avatars`, `exercise-media`

**Seed de Exercicios (50+ exercicios)**
Inserir via migracao SQL com `is_global = true`:
- Peito: Supino reto, inclinado, declinado, crucifixo, crossover, etc.
- Costas: Puxada frontal, remada, levantamento terra, etc.
- Pernas: Agachamento, leg press, extensora, flexora, etc.
- Ombros: Desenvolvimento, elevacao lateral, frontal, etc.
- Biceps: Rosca direta, alternada, martelo, concentrada, etc.
- Triceps: Triceps pulley, frances, testa, mergulho, etc.
- Core: Abdominal, prancha, russian twist, etc.
- Cardio: Esteira, bicicleta, eliptico, etc.

**UX Mobile**
- Inputs numericos com `inputMode="decimal"` para teclado numerico
- Botoes com min-height 48px para touch
- Feedback visual imediato (cores, animacoes)
- Bottom sheet em vez de modais fullscreen

---

### Ordem de Implementacao

1. PWA + Tema escuro
2. Auth (contexto + pagina + protecao)
3. Layout base com navegacao
4. Seed de exercicios globais
5. Meus Treinos (listar + criar + editar)
6. Sessao de treino (executar)
7. Historico
8. Progresso com graficos
9. Perfil

