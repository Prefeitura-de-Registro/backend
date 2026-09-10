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

- Node.js 20 ou superior
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

| Metodo | Rota | Descricao |
| --- | --- | --- |
| GET | `/health` | Verifica a disponibilidade da API e a conexão com o banco. |

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
