

## 🏋️ Gestor Pessoal de Treinos de Musculação

### Visão Geral
Um app mobile-first com tema escuro moderno, instalável como PWA, onde você pode criar treinos, registrar sessões e acompanhar sua evolução com gráficos e estatísticas.

---

### 🎨 Design e Interface
- **Tema escuro** com cores vibrantes de destaque (verde/azul neon para ações positivas)
- **Navegação bottom tab bar** com 4 abas: Treinos, Histórico, Progresso, Perfil
- **Botões grandes e touch-friendly** otimizados para uso durante o treino
- **PWA instalável** com ícone na home do celular

---

### 📱 Telas e Funcionalidades

#### 1. **Autenticação**
- Tela de login/cadastro com email e senha
- Design clean e mobile-optimized
- Redirecionamento automático após login

#### 2. **Meus Treinos** (Home)
- Cards com seus treinos criados
- Cada card mostra: nome, descrição, número de exercícios
- Ações rápidas: Iniciar Treino, Editar, Duplicar, Excluir
- Botão flutuante (+) para criar novo treino

#### 3. **Criar/Editar Treino**
- Nome e descrição do treino
- Adicionar exercícios da biblioteca ou criar novos
- Para cada exercício: definir número de séries planejadas (peso/reps alvo)
- Reordenar exercícios arrastando

#### 4. **Biblioteca de Exercícios**
- ~50 exercícios pré-cadastrados organizados por grupo muscular
- Grupos: Peito, Costas, Pernas, Ombros, Bíceps, Tríceps, Core
- Você pode criar exercícios personalizados
- Busca e filtros por grupo muscular

#### 5. **Sessão de Treino** (Executar)
- Cronômetro da sessão
- Lista de exercícios com séries
- Para cada série, registrar:
  - Peso (kg) - com auto-preenchimento da última sessão
  - Repetições
  - Toggle "Concluída"
  - Observações opcionais
- Botão rápido "Adicionar série"
- Observações gerais da sessão ao finalizar
- Indicador de PR quando bater recorde

#### 6. **Histórico**
- Lista de sessões por data (mais recentes primeiro)
- Filtros por treino e período
- Ao clicar, ver detalhes completos da sessão
- Resumo: duração, volume total, exercícios realizados

#### 7. **Progresso**
- Selecionar exercício para ver evolução
- **Estatísticas rápidas**: PR de peso, melhor volume, último treino
- **Gráficos de linha**: evolução de peso máximo e volume ao longo do tempo
- Comparativo: esta semana vs semana passada

#### 8. **Perfil**
- Dados do usuário
- Toggle tema claro/escuro (futuro)
- Logout

---

### 🗄️ Banco de Dados (Supabase)

**Tabelas principais:**
- `profiles` - dados do usuário
- `exercises` - biblioteca de exercícios (globais + do usuário)
- `workouts` - treinos/modelos criados pelo usuário
- `workout_exercises` - exercícios em cada treino com ordem
- `sessions` - sessões de treino executadas
- `session_sets` - séries registradas com peso/reps

**Segurança:**
- RLS (Row Level Security) em todas as tabelas
- Cada usuário acessa apenas seus próprios dados

---

### ⚡ Diferenciais UX para Treino

- **Auto-fill inteligente**: ao iniciar série, já sugere peso/reps da última sessão
- **Inputs numéricos grandes**: fácil de digitar com dedos suados
- **Feedback visual imediato**: série concluída fica verde
- **PR Badge**: destaque quando você bate um recorde pessoal
- **Swipe actions**: arrastar para marcar como completo

---

### 📦 Primeira Versão (MVP)

1. ✅ Autenticação (login/cadastro)
2. ✅ CRUD de treinos com exercícios
3. ✅ Biblioteca com exercícios pré-cadastrados
4. ✅ Executar sessão de treino com registro de séries
5. ✅ Histórico de sessões
6. ✅ Progresso com estatísticas + gráficos
7. ✅ PWA instalável

