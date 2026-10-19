# Backend API

API REST em Node.js, TypeScript, Express, Prisma e PostgreSQL, organizada em Arquitetura Modular em Camadas.

## Tecnologias

- Node.js e TypeScript (ES Modules)
- Express, CORS e dotenv
- Prisma ORM e PostgreSQL
- Zod para validacao

## Arquitetura

Cada dominio vive em `src/modules`. O fluxo e `Route -> Controller -> Service -> Repository -> Prisma -> PostgreSQL`:

- **Routes**: declaram endpoints e conectam controllers.
- **Controllers**: leem a requisicao, validam entrada e formam a resposta HTTP.
- **Services**: aplicam regras de negocio, como conflito de email e ausencia de usuario.
- **Repositories**: executam somente consultas e mutacoes no banco por meio do Prisma.
- **Shared**: Prisma singleton, erros, middlewares e utilitarios comuns.

## Requisitos

- Node.js 22.12 ou superior
- Docker Desktop (o PostgreSQL com PostGIS e os dados de exemplo ficam em `../database`)

## Instalacao e configuracao

```bash
npm install
copy .env.example .env
```

No Linux/macOS, use `cp .env.example .env`. O arquivo de exemplo ja aponta para o banco local do projeto:

```env
DATABASE_URL="postgresql://admin:adminpassword@localhost:5432/lab_praticas?schema=public"
```

## Banco de dados

O schema e as migrations ficam centralizados em `../database/prisma`. Antes de iniciar a API, suba o banco, aplique a migration pelo backend e gere o Prisma Client:

```bash
cd ../database
docker compose up -d

cd ../backend
npm run prisma:migrate
npm run prisma:generate
```

Tambem e possivel aplicar as migrations, a partir deste diretorio, com `npm run prisma:migrate`.

Para visualizar os dados, execute `npm run prisma:studio`.

## Execucao

Desenvolvimento:

```bash
npm run dev
```

Build e producao:

```bash
npm run build
npm start
```

## Endpoints

Legenda de acesso: **público** = sem login; **logado** = munícipe, funcionário ou gestor; **equipe** = funcionário ou gestor (o gestor enxerga todos os departamentos); **gestor** = somente gestor.

| Metodo | Rota | Acesso | Descricao |
| --- | --- | --- | --- |
| GET | `/health` | público | Disponibilidade da API e conexão com o banco. |
| POST | `/api/user/register` | público | Cadastro de munícipe. Aceita `nome`/`nomeCompleto`, `cpf`/`CPF` (com ou sem máscara, validado, opcional) e `confirmarSenha` (se enviado, precisa bater). |
| POST | `/api/user/login` | público | Login. |
| GET / PATCH | `/api/user/me` | logado | Dados e edição do próprio cadastro (trocar e-mail/senha exige a senha atual). |
| GET | `/api/user` | gestor | Lista usuários. Filtros: `tipo` (`funcionario,gestor`), `ativo`, `busca` (nome, e-mail, matrícula, CPF), `page`, `limit`. CPF vem mascarado. |
| GET | `/api/user/:id` | gestor | Detalhe com departamentos e CPF completo. |
| POST | `/api/user` (alias `/api/user/funcionarios`) | gestor | Cria funcionário/gestor (exige `matricula` e `cargo`; `cpf` opcional). |
| PATCH / DELETE | `/api/user/:id` | gestor | Edita / desativa (não vale para o usuário reservado nem para si mesmo). |
| PUT | `/api/user/:id/departamentos` | gestor | Substitui os vínculos com departamentos. |
| GET | `/api/categorias` | público | Categorias ativas, com departamento. |
| GET | `/api/categorias/:id/perguntas` | público | Perguntas do formulário (`id`, `enunciado`, `ordem`). |
| POST | `/api/tickets` | público | Abre chamado (JSON ou `multipart/form-data` com até 10 imagens/vídeos em `fotos`). Anônimo recebe `tokenAcesso`. Campos: `idCategoria`, `descricao`, `latitude`/`longitude`, `endereco`, `pontoReferencia`, `respostas: [{idPergunta, valor}]`. |
| GET | `/api/tickets/acompanhar/:codigo` | público | Acompanhamento sem login. `:codigo` = token do link (visão completa) **ou** protocolo (`REG-2026-000001`, `#2026-1`...; visão sem endereço/localização). Traz `respostas`, `arquivos` e `historicos`. |
| GET | `/api/tickets/acompanhar/:codigo/arquivos/:id` | público | Imagem/vídeo do chamado (serve em `<img src>`/`<video src>`). |
| GET | `/api/tickets/meus`, `/api/tickets/meus/:id` | logado | Chamados do próprio usuário (sem dados internos). `status` aceita lista (`resolvido,fechado`) para as abas. |
| GET | `/api/tickets`, `/api/tickets/:id` | equipe | Lista/detalhe, com `localizacao: { latitude, longitude }` e `arquivos`. |
| PATCH | `/api/tickets/:id`, `/api/tickets/:id/assume` | equipe | Atualiza / assume o ticket. |
| GET / POST | `/api/tickets/:id/solicitacoes` | equipe | Solicitações do ticket / cria solicitação (deixa o ticket `pendente`). |
| GET | `/api/departamentos?excluir=<id>` | equipe | Departamentos ativos para escolher o destino de uma solicitação. |
| GET | `/api/solicitacoes?tipo=recebidas\|enviadas&status&page&limit` | equipe | Lista de solicitações. |
| GET | `/api/solicitacoes/:id` | equipe | Detalhe (ticket resumido, resposta, mensagens). |
| PATCH | `/api/solicitacoes/:id` | equipe | Responde/recusa; ao finalizar a última, o ticket volta ao status anterior ao `pendente`. |
| GET / POST | `/api/solicitacoes/:id/mensagens` | equipe | Chat interno entre departamentos (`multipart/form-data`: `mensagem` + até 10 imagens/vídeos em `imagens`). |
| GET | `/api/arquivos/:id` | logado | Entrega a imagem/vídeo (dono do ticket ou departamento envolvido; chat interno nunca para munícipe). |
| GET | `/api/notificacoes?status=nao_lidas\|todas` | equipe | Notificações do usuário, com `titulo` e `descricao` prontos (inclui `naoLidas`). |
| PATCH | `/api/notificacoes/:id/lida`, `/api/notificacoes/lidas` | equipe | Marca uma / todas como lidas. |
| GET | `/api/mapas`, `/api/relatorios/...` | equipe | Mapa e relatórios. |

### Variáveis de ambiente novas

| Variável | Uso |
| --- | --- |
| `CORS_ORIGIN` | Origens permitidas, separadas por vírgula. Em produção, sem ela nenhuma origem externa é aceita. |
| `TRUST_PROXY` | Ex.: `1` atrás de proxy/load balancer, para o rate limit usar o IP real. |
| `UPLOAD_DIR` | Pasta das imagens enviadas (padrão `uploads`). Em Docker, monte um volume. |
| `FRONTEND_URL` | Base do `linkAcompanhamento` devolvido na abertura de chamado anônimo. |
| `PRAZO_ALERTA_PERCENTUAL` / `PRAZO_ALERTA_DISABLED` | Aviso "chamado próximo do prazo": dispara quando resta esse % do prazo (padrão 20). Roda ao subir e a cada 30 min. |
| `RATE_LIMIT_DISABLED` | `true` desliga os limites (login 10/15 min, cadastro 10/h, abertura anônima 10/h por IP). |

Mídia: imagens JPEG/PNG/WebP e vídeos MP4/MOV/WebM, até 30 MB cada (como o app informa); HEIC não é aceito. O tipo real é conferido pelos bytes e o nome do arquivo é gerado pelo servidor.

---

## Guia completo de execução local

### 1. Pré-requisitos e portas

Antes de começar, confirme que o Docker Desktop está aberto e que as portas `5432` (PostgreSQL) e `3000` (API) não estão ocupadas. Na primeira instalação, o npm e o Prisma precisam de acesso à internet.

```powershell
node --version
npm --version
docker --version
docker compose version
```

No PowerShell, caso `npx` falhe por política de execução, use `npx.cmd`, como nos comandos abaixo.

### 2. Criar o banco com PostGIS

Partindo da raiz `LP-PREF`, abra um terminal e execute:

```powershell
cd database
docker compose up -d
docker compose ps
```

O Docker não exige um `.env` em `database`; a `DATABASE_URL` usada pelo Prisma fica apenas em `backend/.env`.

O serviço esperado é `praticas-db-local`, baseado em `postgis/postgis:15-3.4`. Essa imagem é necessária pois a migration utiliza a extensão PostGIS e o campo geográfico dos tickets.

### 3. Configurar o backend e aplicar a migration

Volte ao backend. Ele contém o Prisma CLI e usa o schema compartilhado de `database/prisma`:

```powershell
cd ../backend
npm install
Copy-Item .env.example .env
npm run prisma:migrate
```

Esse passo cria enums, tabelas, relacionamentos, PostGIS e os dados de exemplo. Valide a carga com:

```powershell
docker compose exec postgres psql -U admin -d lab_praticas -c "SELECT PostGIS_Version();"
docker compose exec postgres psql -U admin -d lab_praticas -c "SELECT COUNT(*) AS total_tickets FROM tickets;"
```

O total esperado para os dados de exemplo atuais é `5` tickets.

O `.env` local criado no passo anterior deve conter:

```env
PORT=3000
DATABASE_URL="postgresql://admin:adminpassword@localhost:5432/lab_praticas?schema=public"
```

Não versione esse arquivo. Se precisar publicar o PostgreSQL em uma porta diferente, altere a porta tanto em `database/docker-compose.yml` quanto em `DATABASE_URL`.

### 4. Gerar o Prisma Client e iniciar

```powershell
npm run prisma:generate
npm run dev
```

Quando a inicialização for bem-sucedida, a API estará em `http://localhost:3000`.

### 5. Testar a API

O health check também consulta o banco, portanto confirma que API e PostgreSQL estão conectados:

```powershell
Invoke-RestMethod http://localhost:3000/health
```

Resposta esperada:

```json
{ "status": "ok", "database": "connected" }
```

## Comandos do dia a dia

Execute a partir de `backend`:

```powershell
# Aplica as migrations centralizadas em ../database
npm run prisma:migrate

# Atualiza o Prisma Client depois de alterar o schema
npm run prisma:generate

# Interface visual para navegar pelos dados
npm run prisma:studio

# Checagem de tipos sem escrever em dist/
npx.cmd tsc --noEmit

# Build e execução do build
npm run build
npm start
```

## Reinicialização e limpeza do ambiente

Para parar/iniciar o PostgreSQL sem apagar dados:

```powershell
cd ../database
docker compose stop
docker compose up -d
```

Para recriar a base do zero, todos os dados locais serão perdidos. Só faça isso se `database/.pgdata` puder ser descartado:

```powershell
cd ../database
docker compose down
Remove-Item -LiteralPath .pgdata -Recurse -Force
docker compose up -d
cd ../backend
npm run prisma:migrate
```

Depois, volte ao backend, gere o client se necessário e execute `npm run dev`.

## Solução de problemas

### Comandos Prisma no PowerShell

Use os scripts do backend: `npm run prisma:migrate`, `npm run prisma:generate` e `npm run prisma:studio`. Para o typecheck direto, use `npx.cmd tsc --noEmit` caso o PowerShell bloqueie `npx`.

### Erro no endpoint `/health`

Confirme que o container está ativo e que a migration foi aplicada:

```powershell
cd ../database
docker compose ps
docker compose logs postgres
cd ../backend
npm run prisma:migrate
```

Em seguida, confira a `DATABASE_URL` de `backend/.env` e reinicie a API.

### Porta 5432 ou 3000 já está em uso

Pare o processo que está usando a porta ou escolha outra. Para o PostgreSQL, atualize a porta publicada no `docker-compose.yml` e a `DATABASE_URL` do backend; para a API, atualize `PORT` no `.env`.

### `npm run prisma:generate` falha na primeira execução

O Prisma pode baixar binários nessa etapa. Confirme acesso à internet, rode `npm install` novamente e repita o comando.

### Inspecionar o banco sem usar a API

Execute `npm run prisma:studio` dentro de `backend`, ou conecte DBeaver/pgAdmin a `localhost:5432` com banco `lab_praticas`, usuário `admin` e senha `adminpassword`.
