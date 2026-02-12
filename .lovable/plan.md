

## PWA Completo para GymFriend

### O que falta hoje
O app tem apenas um `manifest.json` básico e meta tags no HTML, mas **não possui service worker** -- o que significa que não funciona offline, não é instalável de verdade e não passa nos critérios de PWA do Google Lighthouse.

### O que será feito

**1. Instalar `vite-plugin-pwa`**
- Adicionar o plugin que gera automaticamente o service worker (via Workbox) e gerencia cache, atualização e manifest.

**2. Configurar `vite.config.ts`**
- Registrar o plugin `VitePWA` com:
  - Estratégia `generateSW` (auto-gera service worker)
  - Manifest completo (nome, cores, ícones em múltiplos tamanhos)
  - Cache de assets estáticos (JS, CSS, imagens, fontes)
  - Runtime caching para chamadas à API do Supabase (network-first)
  - `navigateFallbackDenylist: [/^\/~oauth/]` para não interferir com autenticação

**3. Gerar ícones PWA**
- Criar ícones SVG em `public/` nos tamanhos padrão: 192x192 e 512x512
- Adicionar `maskable` icon para Android

**4. Registrar o service worker no app**
- Usar `registerSW` do `vite-plugin-pwa/virtual` no `main.tsx`
- Adicionar prompt de atualização para quando houver nova versão

**5. Remover `manifest.json` manual**
- O plugin gera o manifest automaticamente, então o arquivo `public/manifest.json` será removido
- A tag `<link rel="manifest">` no `index.html` também será removida (o plugin injeta automaticamente)

**6. Página/prompt de instalação**
- Capturar o evento `beforeinstallprompt` para oferecer um botão de "Instalar App" na página de perfil

---

### Detalhes Técnicos

**Dependência:** `vite-plugin-pwa`

**Arquivos modificados:**
- `vite.config.ts` -- configuração do plugin VitePWA
- `src/main.tsx` -- registro do service worker
- `index.html` -- remover link manual do manifest (plugin injeta)
- `src/pages/ProfilePage.tsx` -- botão "Instalar App"

**Arquivos criados:**
- `public/pwa-192x192.svg` -- ícone 192px
- `public/pwa-512x512.svg` -- ícone 512px

**Arquivos removidos:**
- `public/manifest.json` -- substituído pelo manifest gerado pelo plugin

