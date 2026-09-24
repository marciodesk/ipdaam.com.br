---
name: "IPDAAM — ETDA Manaus"
description: "Comunidade de formação: acolhedora, próxima e funcional."
colors:
  azul-institucional: "#2563eb"
  verde-profundo: "#126b5b"
  verde-profundo-hover: "#0b4d42"
  violeta: "#6d3fd1"
  amarelo: "#f4c400"
  indigo: "#4457c0"
  indigo-hover: "#33449d"
  danger: "#b43f4c"
  site-bg: "#0f172a"
  site-depth: "#111827"
  site-text: "#e5e7eb"
  site-muted: "#9ca3af"
  site-card: "rgba(255,255,255,.04)"
  site-line: "rgba(255,255,255,.12)"
  white: "#fff"
  enrollment-bg: "#f4f7f6"
  enrollment-soft: "#edf4f1"
  enrollment-text: "#1c2a28"
  enrollment-muted: "#64736f"
  enrollment-line: "#d8e2de"
  courses-bg: "#f7f3ff"
  courses-soft: "#fffdf0"
  courses-text: "#26312f"
  courses-muted: "#68746f"
  courses-line: "#e1d9f5"
  attendance-bg: "#f6f7fb"
  attendance-soft: "#eef4ff"
  attendance-text: "#1d2733"
  attendance-muted: "#687385"
  attendance-line: "#dde3ef"
  attendance-nav-bg: "#f8f9fc"
  attendance-nav-text: "#536174"
  attendance-nav-hover: "#eaf0ff"
  admin-bg: "#f3f4f6"
  admin-sidebar: "#050609"
  admin-line: "#dfe3ea"
typography:
  display-site:
    fontFamily: "Inter,system-ui,-apple-system,Segoe UI,Arial,sans-serif"
    fontSize: "42px"
    lineHeight: 1.08
  display-site-mobile:
    fontSize: "34px"
    lineHeight: 1.08
  headline-enrollment:
    fontFamily: "Arial,Helvetica,sans-serif"
    fontSize: "clamp(2rem,5vw,3.4rem)"
    lineHeight: 1
  headline-courses:
    fontFamily: "Arial,Helvetica,sans-serif"
    fontSize: "clamp(2rem,5vw,3.6rem)"
    lineHeight: 1
  headline-admin:
    fontFamily: "Arial,Helvetica,sans-serif"
    fontSize: "clamp(1.7rem,3vw,2.35rem)"
    lineHeight: 1.08
  title-site:
    fontSize: "26px"
  body-site:
    fontFamily: "Inter,system-ui,-apple-system,Segoe UI,Arial,sans-serif"
  body-academic:
    fontFamily: "Arial,Helvetica,sans-serif"
  label-enrollment:
    fontSize: ".86rem"
    fontWeight: 700
  label-attendance:
    fontSize: ".85rem"
    fontWeight: 800
  button-public:
    fontWeight: 800
  navigation-attendance:
    fontSize: ".84rem"
    fontWeight: 800
  status-admin:
    fontSize: ".82rem"
    fontWeight: 800
rounded:
  control: "6px"
  control-alt: "7px"
  panel: "8px"
  account: "9px"
  header: "12px"
  site-action: "14px"
  site-banner: "16px"
  site-card: "18px"
  pill: "999px"
spacing:
  gap-small: "8px"
  gap-fields: "12px"
  gap-form: "14px"
  mobile-padding: "16px"
  panel-padding: "18px"
  auth-padding: "20px"
  site-padding: "24px"
  admin-padding: "28px"
components:
  button-site-primary:
    backgroundColor: "{colors.azul-institucional}"
    textColor: "{colors.white}"
    typography: "{typography.button-public}"
    rounded: "{rounded.site-action}"
    padding: "12px 18px"
  button-site-secondary:
    textColor: "{colors.site-text}"
    typography: "{typography.button-public}"
    rounded: "{rounded.site-action}"
    padding: "12px 18px"
  button-enrollment-primary:
    backgroundColor: "{colors.verde-profundo}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "0 18px"
  button-enrollment-primary-hover:
    backgroundColor: "{colors.verde-profundo-hover}"
  button-admin-ghost:
    backgroundColor: "{colors.enrollment-soft}"
    textColor: "{colors.enrollment-text}"
    rounded: "{rounded.control}"
    padding: "0 14px"
  button-attendance-primary:
    backgroundColor: "{colors.indigo}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "0 14px"
  button-attendance-primary-hover:
    backgroundColor: "{colors.indigo-hover}"
  input-enrollment:
    backgroundColor: "{colors.white}"
    textColor: "{colors.enrollment-text}"
    rounded: "{rounded.control}"
    padding: "10px 11px"
  navigation-attendance:
    backgroundColor: "{colors.attendance-nav-bg}"
    padding: "7px 10px"
  navigation-attendance-link:
    textColor: "{colors.attendance-nav-text}"
    typography: "{typography.navigation-attendance}"
    rounded: "{rounded.control-alt}"
    padding: "0 12px"
  navigation-attendance-active:
    backgroundColor: "{colors.indigo}"
    textColor: "{colors.white}"
  status-admin-cancelled:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.white}"
    typography: "{typography.status-admin}"
    rounded: "{rounded.pill}"
    padding: "5px 10px"
  card-enrollment:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel-padding}"
  card-student:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.panel}"
    padding: "11px 12px"
---

# Design System: IPDAAM — ETDA Manaus

## Navegação lateral compartilhada

As páginas internas e a inscrição autenticada usam `assets/system-navigation.css`.
Os tokens `--nav-bg` (#080a0e), `--nav-active` (#4457c0), `--nav-text` (#d5dbe6),
`--nav-muted` (#b9c8e5), `--nav-border` (#465064), `--nav-focus` (#93c5fd),
`--nav-hover` (#18202e) e `--nav-mobile-text` (#26334a) preservam a lateral escura aprovada.
A marca usa 1rem e o subtítulo .68rem. Links têm altura mínima de 46px e ícones SVG de 18px
presentes no HTML. A página ativa usa `aria-current="page"`. “Sair” fica no rodapé.
Até 760px, o menu expansível ocupa espaço no fluxo da página, sem sobrepor formulários.

## Overview

**Creative North Star: "Comunidade de formação"**

“Comunidade de formação” é a expressão escolhida para descrever o sistema existente: acolhedor e próximo da comunidade. Botões, cartões e campos devem ser simples, acolhedores e fáceis de reconhecer. A documentação evita recomendar aparência de loja ou publicidade.

O código reúne famílias visuais por área: página inicial escura com azul institucional; inscrição e formulários da secretaria com verde profundo; cursos com violeta e amarelo; presença e páginas relacionadas com índigo. A secretaria também possui uma estrutura administrativa de barra lateral escura e conteúdo claro. Essas diferenças são registradas como implementadas; não constituem um alternador global de tema.

Registro baseado no código local, sem validação visual em navegador. As descrições qualitativas foram confirmadas pelo responsável; as medidas foram extraídas dos estilos, considerando suas sobrescritas. Os nomes dos tokens desta documentação distinguem áreas que reutilizam nomes CSS como --brand. O arquivo assets/ipda-system.css existe, mas nenhum dos dez HTML examinados o referencia; seus valores não são tratados como tema ativo.

**Key Characteristics:**

- Acolhedor e próximo da comunidade.
- Componentes simples e reconhecíveis.
- Paletas contextualizadas por área.
- Sombras e camadas para separação discreta.
- Sem recomendação de aparência de loja ou publicidade.

## Colors

Os nomes aprovados descrevem as cores existentes; os valores no frontmatter são a referência numérica. O uso continua condicionado à área de origem.

### Primary

| Nome | Token | Aplicação e fonte |
|---|---|---|
| Azul institucional | `azul-institucional` | Ação principal da página inicial; `index.html`, variável `--brand`. |
| Verde profundo | `verde-profundo` | Ações e foco da inscrição e dos formulários da secretaria; `inscricao.html` e `secretaria.html`. A variação `verde-profundo-hover` aparece no hover. |
| Violeta | `violeta` | Ações, foco e seleção de curso em `cursos.html`. |
| Índigo | `indigo` | Ações e navegação de `presenca.html`, também presente em notas e páginas de conta. O hover mais escuro está em `indigo-hover` na presença. |

### Secondary

**Amarelo** (`amarelo`) destaca aniversariantes no dashboard de cursos; não é uma cor global para botões principais. **Perigo** (`danger`) aparece em erros e cancelamento. Sucessos e avisos têm variações locais; consultar a página antes de reutilizá-los.

### Neutral

- `site-*`: fundo escuro, texto claro e camadas brancas translúcidas da página inicial.
- `enrollment-*`: fundos levemente esverdeados, texto escuro e divisórias dos formulários; a superfície principal é `white`.
- `courses-*`: lavanda, creme, texto e divisórias do dashboard.
- `attendance-*`: neutros frios, superfícies auxiliares azuladas e navegação da presença.
- `admin-*`: fundo cinza, barra lateral quase preta e bordas da estrutura final da secretaria. O estado selecionado da barra lateral usa `site-depth`, e não o antigo verde de navegação.

Os nomes são documentais: não foram adicionadas variáveis ao CSS. As rampas OKLCH do arquivo complementar são amostras geradas para visualização, não novos tokens normativos.

## Typography

A página inicial usa a família `body-site` (Inter com alternativas de sistema). O carregamento de Inter solicita pesos 400, 600 e 800. As páginas acadêmicas principais usam `body-academic` (Arial com Helvetica e sans-serif); as páginas compactas de conta e notas declaram Arial.

A hierarquia combina títulos fortes, rótulos menores e texto auxiliar com a cor atenuada de cada área. Não há família monoespaçada nem escala modular global declarada.

| Papel | Token / comportamento observado |
|---|---|
| Título da página inicial | `display-site`; muda para `display-site-mobile` até 900 px. |
| Seções da página inicial | `title-site`. |
| Título de inscrição e presença | `headline-enrollment`, com a mesma medida observada nessas duas páginas. |
| Título do dashboard de cursos | `headline-courses`. |
| Título da secretaria | `headline-admin`, definido pelo último bloco de estilos. |
| Rótulos | `label-enrollment` na inscrição/secretaria; `label-attendance` na presença. |
| Navegação da presença | `navigation-attendance`; a barra lateral da secretaria usa texto menor (.82rem) e peso 500. |

Os tokens omitem tamanho de corpo e pesos de títulos quando dependem do padrão do navegador. Não há limite de linha global confirmado.

## Layout

O arranjo agrupa informações em painéis com espaçamento recorrente, sem uma escala rígida única. Os tokens de espaçamento registram valores observados, não novas variáveis de implementação.

| Área | Organização existente | Adaptação |
|---|---|---|
| Página inicial | Contêiner de até 1100 px; cartões e grade de cursos com três colunas. | Até 900 px, cursos e mapa ficam em uma coluna; até 700 px, redes sociais e links oficiais também ficam em uma coluna. |
| Inscrição | Página de até 980 px; grupos de campos em duas colunas e linha de endereço em três. | Até 680 px, grupos viram uma coluna e o botão ocupa a largura disponível. |
| Cursos | Contêiner de até 1180 px; cartões de alunos com grade automática de mínimo 290 px. | Regras locais em 1160, 900 e 560 px reduzem grades e espaçamentos. |
| Presença | Contêiner de até 1200 px; área operacional e coluna auxiliar. | Regras em 980, 640 e 560 px reorganizam o conteúdo; navegação admite rolagem horizontal. |
| Secretaria | Estrutura de largura total, barra lateral de 230 px e conteúdo com padding de 28 px; workspace com coluna de 390 px. | Workspace empilha até 920 px; barra lateral passa ao topo até 760 px; menu vira uma coluna até 480 px. Há ajustes de formulários em 560 px e boletim em 720 px. |
| Notas e usuários | Contêineres com formulários e tabelas em painéis. | Notas adapta filtros em 860/720 px; usuários em 760 px. Tabelas mantêm rolagem interna. |

As tabelas largas são uma exceção à redução para uma coluna. As regras de impressão da secretaria e da presença escondem controles e removem decoração. Na presença, a regra final imprime os cartões QR em duas colunas, sobrescrevendo a regra anterior de três.

## Elevation & Depth

**Separação discreta:** sombras e camadas ajudam a distinguir painéis e conteúdos. Este é o papel confirmado; não significa que todas as sombras atuais tenham a mesma intensidade.

| Papel observado | Sombra CSS | Origem |
|---|---|---|
| Cartões da página inicial | `0 10px 30px rgba(0,0,0,.28)` | `index.html` |
| Formulário de inscrição | `0 18px 48px rgba(22,44,39,.12)` | `inscricao.html` |
| Painéis de cursos | `0 18px 42px rgba(74,45,122,.14)` | `cursos.html` |
| Painéis de presença | `0 18px 40px rgba(37,47,77,.11)` | `presenca.html` |
| Painéis operacionais da secretaria | `0 1px 2px rgba(15,23,42,.05)` | Sobrescrita final em `secretaria.html` |

A autenticação da secretaria mantém a sombra original; sua barra lateral final não tem sombra. Bordas e fundos auxiliares também separam regiões.

## Shapes

Cantos suavizados reforçam componentes reconhecíveis. Campos e controles acadêmicos usam `control` ou `control-alt`; painéis usam `panel`, com `account` em páginas de conta. A página inicial utiliza `site-action`, `site-banner` e `site-card`; etiquetas usam `pill`.

Bordas de 1 px aparecem em campos, cartões e divisórias. A barra lateral final da secretaria tem cantos retos. Fotos de alunos, prévias de câmera e cartões QR têm proporções e regras próprias; não são substitutos de um único componente de imagem.

## Components

**Simples, acolhedores e fáceis de reconhecer.** Os exemplos em `.impeccable/design.json` representam famílias existentes e não uma biblioteca compartilhada já instalada.

### Buttons

- **Página inicial:** ação azul preenchida e alternativa contornada. Medidas nos tokens `button-site-*`; o estado indisponível usa opacidade .55.
- **Inscrição:** botão verde com altura mínima de 44 px; hover mais escuro e estado disabled com opacidade .72.
- **Secretaria:** primários verdes; alternativas sobre fundo suave com borda. Altura mínima de 40 px.
- **Presença:** primário índigo com altura mínima de 40 px e hover mais escuro.
- Não existe indicador de foco customizado universal para botões. Os exemplos preservam o foco nativo; não documentam uma correção como se já estivesse implementada.

### Chips

Etiquetas arredondadas distinguem matrícula, frequência e aniversariantes. A secretaria usa preenchimento sólido para Ativa, Em espera e Cancelada; a presença combina fundos suaves e textos de estado. Os nomes de estado fazem parte da informação e acompanham a cor.

### Cards / Containers

Painéis acadêmicos usam superfícies claras, borda fina e sombra contextual. O cartão de aluno em cursos combina foto ou iniciais, nome e metadados; aniversariantes recebem uma variação amarela. A página inicial usa cartões translúcidos sobre fundo escuro.

### Inputs / Fields

Campos acadêmicos têm altura mínima de 42 px, padding de 10px 11px e borda contextual. Na inscrição e secretaria, o foco muda a borda para verde e aplica `0 0 0 3px rgba(18,107,91,.13)`; cursos e presença usam anéis equivalentes nas respectivas cores.

Rótulos ficam acima dos campos na maioria dos formulários. Mensagens de erro usam a cor de perigo, mas a associação acessível não é uniforme. Campos de nota gerados dinamicamente carecem de rótulos acessíveis; esse comportamento não é um padrão a reproduzir.

### Navigation

Cursos e presença têm navegação horizontal com destaque preenchido no item atual. A presença possui hover suave e sombra no item ativo. A secretaria usa barra lateral escura no desktop e menu no topo em telas menores, conforme Layout.

Os snippets são estáticos e não reproduzem autenticação, troca de abas ou atualização de estado. Usam classes `ds-` e variáveis CSS com fallback para a área de origem; quando inseridos em uma página com variáveis locais, herdam essas cores.

### Motion and States

Os cartões de redes sociais da página inicial usam transição de transform, border-color e background (.2s ease), com deslocamento de -2 px no hover. Não há política global implementada de movimento reduzido. Não generalizar esse movimento para todas as ações.

O registro não certifica acessibilidade: a auditoria anterior identificou contraste insuficiente em estados de sucesso, controles pequenos e anúncios dinâmicos incompletos. Esses pontos permanecem pendentes; nenhuma correção de interface foi realizada ao documentar.

## Do's and Don'ts

### Do:

- **Do** preservar a família visual da página ao refinar componentes existentes.
- **Do** usar sombras e camadas para distinguir painéis e conteúdos.
- **Do** manter botões, cartões e campos simples, acolhedores e fáceis de reconhecer.
- **Do** consultar as regras posteriores e as media queries antes de reutilizar medidas.
- **Do** preservar os rótulos de campos e os indicadores de foco já presentes.

### Don't:

- **Don't** recomendar aparência de loja ou publicidade.
- **Don't** tratar a paleta de uma área como tema global de todo o portal.
- **Don't** assumir que assets/ipda-system.css já governa as páginas.
- **Don't** transformar uma deficiência de acessibilidade observada em regra a replicar.
- **Don't** apresentar rampas tonais geradas para o painel como cores já implementadas.
