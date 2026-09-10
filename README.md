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

O backend usa a migration centralizada no diretorio `../database`. Antes de iniciar a API, suba o banco, aplique a migration e gere o Prisma Client:

```bash
cd ../database
npm install
Copy-Item .env.example .env
docker compose up -d
npx.cmd prisma migrate deploy

cd ../backend
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
npm install
Copy-Item .env.example .env
docker compose up -d
docker compose ps
```

O `.env` criado em `database` fornece a `DATABASE_URL` usada pelos comandos do Prisma.

O serviço esperado é `praticas-db-local`, baseado em `postgis/postgis:15-3.4`. Essa imagem é necessária pois a migration utiliza a extensão PostGIS e o campo geográfico dos tickets.

### 3. Aplicar a migration e a carga de exemplo

Ainda dentro de `database`, aplique o histórico de migrations:

```powershell
npx.cmd prisma migrate deploy
npx.cmd prisma migrate status
```

Esse passo cria enums, tabelas, relacionamentos, PostGIS e os dados de exemplo. Valide a carga com:

```powershell
docker compose exec postgres psql -U admin -d lab_praticas -c "SELECT PostGIS_Version();"
docker compose exec postgres psql -U admin -d lab_praticas -c "SELECT COUNT(*) AS total_tickets FROM tickets;"
```

O total esperado para os dados de exemplo atuais é `5` tickets.

### 4. Instalar e configurar a API

Em um segundo terminal, a partir da raiz do repositório:

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

O `.env` local deve conter:

```env
PORT=3000
DATABASE_URL="postgresql://admin:adminpassword@localhost:5432/lab_praticas?schema=public"
```

Não versione esse arquivo. Se precisar publicar o PostgreSQL em uma porta diferente, altere a porta tanto em `database/docker-compose.yml` quanto em `DATABASE_URL`.

### 5. Gerar o Prisma Client e iniciar

```powershell
npm run prisma:generate
npm run dev
```

Quando a inicialização for bem-sucedida, a API estará em `http://localhost:3000`.

### 6. Testar a API

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
npx.cmd prisma migrate deploy
```

Depois, volte ao backend, gere o client se necessário e execute `npm run dev`.

## Solução de problemas

### `npx.ps1` bloqueado pelo PowerShell

Use `npx.cmd prisma migrate deploy` em vez de `npx prisma migrate deploy`.

### Erro no endpoint `/health`

Confirme que o container está ativo e que a migration foi aplicada:

```powershell
cd ../database
docker compose ps
docker compose logs postgres
npx.cmd prisma migrate status
```

Em seguida, confira a `DATABASE_URL` de `backend/.env` e reinicie a API.

### Porta 5432 ou 3000 já está em uso

Pare o processo que está usando a porta ou escolha outra. Para o PostgreSQL, atualize a porta publicada no `docker-compose.yml` e a `DATABASE_URL` do backend; para a API, atualize `PORT` no `.env`.

### `npm run prisma:generate` falha na primeira execução

O Prisma pode baixar binários nessa etapa. Confirme acesso à internet, rode `npm install` novamente e repita o comando.

### Inspecionar o banco sem usar a API

Execute `npm run prisma:studio` dentro de `backend`, ou conecte DBeaver/pgAdmin a `localhost:5432` com banco `lab_praticas`, usuário `admin` e senha `adminpassword`.
