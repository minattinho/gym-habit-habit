

## Adicionar Fotos aos Exercícios

O banco de dados já possui o campo `image_url` na tabela `exercises` e um bucket de storage `exercise-media` configurado. A implementação consiste em exibir essas imagens nos locais onde exercícios aparecem.

### Alterações

**1. ExerciseSelector.tsx** -- Exibir thumbnail ao lado de cada exercício na lista de seleção
- Incluir `image_url` na query do Supabase
- Mostrar a imagem (ou ícone fallback `Dumbbell`) à esquerda do nome do exercício
- Layout: avatar circular de 40px + nome + grupo muscular

**2. WorkoutFormPage.tsx** -- Mostrar a imagem do exercício no cabeçalho de cada exercício adicionado ao treino
- Buscar `image_url` junto com o nome ao carregar exercícios existentes
- Passar `image_url` na interface `WorkoutExercise` (campo opcional)
- Exibir thumbnail pequeno (32px) ao lado do nome no header do exercício

**3. SessionPage.tsx** -- Mostrar a imagem do exercício durante a sessão de treino
- Incluir `image_url` na query que busca os exercícios da sessão (via join com `exercises`)
- Exibir thumbnail ao lado do nome de cada exercício

**4. ExerciseSelector - callback atualizado**
- Passar `image_url` no callback `onSelect` para que a página de criação de treino já tenha a URL da imagem sem precisar de query adicional

### Detalhes Técnicos

- A interface `Exercise` no `ExerciseSelector` será expandida para incluir `image_url: string | null`
- A interface `WorkoutExercise` no `WorkoutFormPage` receberá `image_url?: string | null`
- O callback `onSelect` passará a receber um terceiro parâmetro: `imageUrl: string | null`
- Componente de imagem usará fallback com ícone `Dumbbell` quando `image_url` for null
- Imagens serão exibidas com `object-cover` e bordas arredondadas
- Não será necessária nenhuma migração de banco de dados -- o campo e o bucket já existem

