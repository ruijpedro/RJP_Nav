## RJP Navigator V3.1.0

Cada PN, estação, apeadeiro e EDF é um atalho direto para escolher Google Maps ou Waze. As PN usam a coordenada ferroviária correspondente ao Km da Linha do Oeste.

# RJP Navigator V3.0.8

Correção da apresentação das Passagens de Nível: os quilómetros são mostrados exclusivamente com vírgula, por exemplo `157,708`, sem o formato `157+708`.

# RJP Navigator V3

Aplicação Android/Web para apoio à navegação técnica na Linha do Oeste.

## Troço configurado

- Início: PK 21+190
- Fim: PK 191+197

## Funcionalidades

- Estações e apeadeiros com coordenadas SIG importadas do ficheiro fornecido.
- Edifícios ferroviários associados às estações.
- Nova lista de Passagens de Nível, filtrada ao troço.
- Clique num ativo e escolha Google Maps ou Waze.
- Pedido de permissão GPS no Android.
- Guardar/atualizar coordenadas GPS num ativo.
- Pesquisa por PK, distrito, concelho, freguesia e classificação.
- Exportação local JSON.
- Build automático de WebApp e APK no GitHub Actions.

## Criar o repositório

1. Cria um repositório vazio chamado `RJP-Navigator-V3`.
2. Extrai este ZIP.
3. Carrega todos os ficheiros e pastas para a raiz do repositório.
4. Abre **Actions** e executa `Build RJP Navigator Android APK`.
5. O APK ficará em **Artifacts**.

## Nota sobre coordenadas das PN

Quando uma PN ainda não tem GPS confirmado, a aplicação calcula uma posição aproximada pelo PK entre as estações/apeadeiros de referência mais próximos. A localização guardada no terreno substitui sempre essa estimativa.


## Correção V3.0.1 — Vite não encontrado
Os workflows fixam o npm em `10.9.2`, limpam a cache, executam `npm ci --include=dev` e verificam a instalação local do Vite antes do build.

## Correção V3.0.3
Os workflows usam Node.js 22 e `npm install --include=dev`, validando a existência do Vite e do Capacitor antes do build. Isto corrige o caso em que `npm ci` terminava sem criar `node_modules/.bin/vite`.

## V3.0.4 — correção do gestor de pacotes
Os workflows usam Yarn 4 através do Corepack. O npm foi removido do processo de build para evitar o erro interno `Exit handler never called` observado no GitHub Actions.


## V3.0.9 — Referenciação ferroviária das PN
- PN ordenadas por Km crescente e apresentadas com vírgula.
- Localidade/concelho/freguesia mantidos apenas como dados informativos.
- Google Maps e Waze usam sempre latitude/longitude calculadas a partir do Km na Linha do Oeste.
- Cálculo por interpolação entre estações/apeadeiros oficiais do SIG IP ordenados por Km; não usa pesquisa por nomes de terras.
