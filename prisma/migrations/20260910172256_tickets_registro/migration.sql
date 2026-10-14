-- ==========================================================
-- SISTEMA DE TICKETS — Secretaria de Infraestrutura
-- Prefeitura de Registro/SP
-- Schema estrutural (sem dados de exemplo)
-- ==========================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- ----------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------

CREATE TYPE tipo_usuario_enum AS ENUM ('municipe', 'funcionario');

CREATE TYPE ticket_status_enum AS ENUM (
  'aberto', 'em_analise', 'em_andamento', 'pendente', 'resolvido', 'fechado'
);

CREATE TYPE ticket_prioridade_enum AS ENUM ('normal', 'urgente');

CREATE TYPE solicitacao_status_enum AS ENUM (
  'pendente', 'em_analise', 'respondida', 'recusada'
);

CREATE TYPE tipo_evento_enum AS ENUM (
  'criacao', 'mudanca_status', 'ajuste_prazo', 'atribuicao'
);

CREATE TYPE notificacao_tipo_enum AS ENUM (
  'novo_ticket', 'nova_solicitacao', 'solicitacao_respondida'
);

CREATE TYPE notificacao_canal_enum AS ENUM ('push', 'email');

CREATE TYPE notificacao_status_enum AS ENUM (
  'pendente', 'enviada', 'falhou', 'lida'
);

-- ----------------------------------------------------------
-- TABELAS
-- ----------------------------------------------------------

CREATE TABLE secretarias (
  id       INTEGER PRIMARY KEY,
  nome     VARCHAR NOT NULL,
  sigla    VARCHAR,
  ativo    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE departamentos (
  id             INTEGER PRIMARY KEY,
  id_secretaria  INTEGER NOT NULL REFERENCES secretarias(id),
  nome           VARCHAR NOT NULL,
  sigla          VARCHAR,
  ativo          BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE usuarios (
  id           INTEGER PRIMARY KEY,
  tipo_usuario tipo_usuario_enum NOT NULL DEFAULT 'municipe',
  nome         VARCHAR,
  email        VARCHAR,
  senha_hash   VARCHAR,
  reservado    BOOLEAN NOT NULL DEFAULT FALSE,
  ativo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP NOT NULL DEFAULT now()
);
-- Só pode existir UMA linha reservada (usuário anônimo compartilhado)
CREATE UNIQUE INDEX uq_usuarios_unico_reservado ON usuarios (reservado) WHERE reservado = TRUE;

CREATE TABLE usuario_departamentos (
  id               INTEGER PRIMARY KEY,
  id_usuario       INTEGER NOT NULL REFERENCES usuarios(id),
  id_departamento  INTEGER NOT NULL REFERENCES departamentos(id),
  UNIQUE (id_usuario, id_departamento)
);

CREATE TABLE categorias (
  id                                INTEGER PRIMARY KEY,
  id_departamento                   INTEGER NOT NULL REFERENCES departamentos(id),
  nome                              VARCHAR NOT NULL,
  tempo_primeira_resposta_minutos   INTEGER NOT NULL,
  tempo_maximo_resolucao_minutos    INTEGER NOT NULL,
  tempo_minimo_resolucao_minutos    INTEGER NOT NULL,
  tempo_resolucao_urgente_minutos   INTEGER NOT NULL,
  ativo                             BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE perguntas (
  id                          INTEGER PRIMARY KEY,
  id_categoria                INTEGER NOT NULL REFERENCES categorias(id),
  enunciado                   TEXT NOT NULL,
  reducao_minutos             INTEGER NOT NULL DEFAULT 0 CHECK (reducao_minutos >= 0),
  critica                     BOOLEAN NOT NULL DEFAULT FALSE,
  id_departamento_solicitado  INTEGER REFERENCES departamentos(id),
  ordem                       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tickets (
  id                              INTEGER PRIMARY KEY,
  id_usuario                      INTEGER NOT NULL REFERENCES usuarios(id),
  id_categoria                    INTEGER NOT NULL REFERENCES categorias(id),
  id_departamento                 INTEGER NOT NULL REFERENCES departamentos(id),
  id_funcionario_responsavel      INTEGER REFERENCES usuarios(id),
  status                          ticket_status_enum NOT NULL DEFAULT 'aberto',
  prioridade                      ticket_prioridade_enum NOT NULL DEFAULT 'normal',
  descricao                       TEXT,
  geom                            GEOGRAPHY(Point, 4326),
  token_acesso                    VARCHAR UNIQUE,
  prazo_primeira_resposta_minutos INTEGER NOT NULL,
  prazo_resolucao_minutos         INTEGER NOT NULL,
  created_at                      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE respostas (
  id           INTEGER PRIMARY KEY,
  id_pergunta  INTEGER NOT NULL REFERENCES perguntas(id),
  id_ticket    INTEGER NOT NULL REFERENCES tickets(id),
  valor        BOOLEAN NOT NULL
);

-- id_usuario é NULLABLE: NULL = ação automática do sistema
-- (ex: mudança de status ao abrir/reverter uma solicitação sozinho)
CREATE TABLE ticket_historico (
  id            INTEGER PRIMARY KEY,
  id_ticket     INTEGER NOT NULL REFERENCES tickets(id),
  tipo_evento   tipo_evento_enum NOT NULL,
  status        ticket_status_enum,
  prazo_minutos INTEGER,
  id_usuario    INTEGER REFERENCES usuarios(id),
  texto         TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE solicitacoes (
  id                          INTEGER PRIMARY KEY,
  id_ticket                   INTEGER NOT NULL REFERENCES tickets(id),
  id_departamento_solicitado  INTEGER NOT NULL REFERENCES departamentos(id),
  status                      solicitacao_status_enum NOT NULL DEFAULT 'pendente',
  descricao                   TEXT NOT NULL,
  resposta                    TEXT,
  respondido_por              INTEGER REFERENCES usuarios(id),
  created_at                  TIMESTAMP NOT NULL DEFAULT now(),
  respondido_em               TIMESTAMP
);

CREATE TABLE solicitacao_mensagens (
  id               INTEGER PRIMARY KEY,
  id_solicitacao   INTEGER NOT NULL REFERENCES solicitacoes(id),
  id_usuario       INTEGER NOT NULL REFERENCES usuarios(id),
  mensagem         TEXT NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT now()
);

-- arquivo pertence a EXATAMENTE um dono: o ticket (foto de abertura)
-- ou uma mensagem do chat entre departamentos — nunca os dois, nunca nenhum
CREATE TABLE arquivos (
  id                       INTEGER PRIMARY KEY,
  id_ticket                INTEGER REFERENCES tickets(id),
  id_solicitacao_mensagem  INTEGER REFERENCES solicitacao_mensagens(id),
  path                     VARCHAR NOT NULL,
  tipo                     VARCHAR,
  created_at               TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT chk_arquivo_dono_unico CHECK (
    (id_ticket IS NOT NULL AND id_solicitacao_mensagem IS NULL) OR
    (id_ticket IS NULL AND id_solicitacao_mensagem IS NOT NULL)
  )
);

CREATE TABLE notificacoes (
  id             INTEGER PRIMARY KEY,
  id_usuario     INTEGER NOT NULL REFERENCES usuarios(id),
  tipo_evento    notificacao_tipo_enum NOT NULL,
  id_ticket      INTEGER REFERENCES tickets(id),
  id_solicitacao INTEGER REFERENCES solicitacoes(id),
  canal          notificacao_canal_enum NOT NULL DEFAULT 'push',
  status         notificacao_status_enum NOT NULL DEFAULT 'pendente',
  tentativas     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMP NOT NULL DEFAULT now(),
  enviado_em     TIMESTAMP,
  lido_em        TIMESTAMP
);

CREATE TABLE logs_auditoria (
  id             INTEGER PRIMARY KEY,
  id_usuario     INTEGER REFERENCES usuarios(id),
  acao           VARCHAR NOT NULL,
  entidade_tipo  VARCHAR NOT NULL,
  entidade_id    INTEGER NOT NULL,
  dados_antigos  JSONB,
  dados_novos    JSONB,
  created_at     TIMESTAMP NOT NULL DEFAULT now()
);

-- Ajustes de índices e integridade referencial do schema Prisma

-- DropForeignKey
ALTER TABLE "arquivos" DROP CONSTRAINT "arquivos_id_solicitacao_mensagem_fkey";

-- DropForeignKey
ALTER TABLE "arquivos" DROP CONSTRAINT "arquivos_id_ticket_fkey";

-- DropForeignKey
ALTER TABLE "categorias" DROP CONSTRAINT "categorias_id_departamento_fkey";

-- DropForeignKey
ALTER TABLE "departamentos" DROP CONSTRAINT "departamentos_id_secretaria_fkey";

-- DropForeignKey
ALTER TABLE "logs_auditoria" DROP CONSTRAINT "logs_auditoria_id_usuario_fkey";

-- DropForeignKey
ALTER TABLE "notificacoes" DROP CONSTRAINT "notificacoes_id_solicitacao_fkey";

-- DropForeignKey
ALTER TABLE "notificacoes" DROP CONSTRAINT "notificacoes_id_ticket_fkey";

-- DropForeignKey
ALTER TABLE "notificacoes" DROP CONSTRAINT "notificacoes_id_usuario_fkey";

-- DropForeignKey
ALTER TABLE "perguntas" DROP CONSTRAINT "perguntas_id_categoria_fkey";

-- DropForeignKey
ALTER TABLE "perguntas" DROP CONSTRAINT "perguntas_id_departamento_solicitado_fkey";

-- DropForeignKey
ALTER TABLE "respostas" DROP CONSTRAINT "respostas_id_pergunta_fkey";

-- DropForeignKey
ALTER TABLE "respostas" DROP CONSTRAINT "respostas_id_ticket_fkey";

-- DropForeignKey
ALTER TABLE "solicitacao_mensagens" DROP CONSTRAINT "solicitacao_mensagens_id_solicitacao_fkey";

-- DropForeignKey
ALTER TABLE "solicitacao_mensagens" DROP CONSTRAINT "solicitacao_mensagens_id_usuario_fkey";

-- DropForeignKey
ALTER TABLE "solicitacoes" DROP CONSTRAINT "solicitacoes_id_departamento_solicitado_fkey";

-- DropForeignKey
ALTER TABLE "solicitacoes" DROP CONSTRAINT "solicitacoes_id_ticket_fkey";

-- DropForeignKey
ALTER TABLE "solicitacoes" DROP CONSTRAINT "solicitacoes_respondido_por_fkey";

-- DropForeignKey
ALTER TABLE "ticket_historico" DROP CONSTRAINT "ticket_historico_id_ticket_fkey";

-- DropForeignKey
ALTER TABLE "ticket_historico" DROP CONSTRAINT "ticket_historico_id_usuario_fkey";

-- DropForeignKey
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_id_categoria_fkey";

-- DropForeignKey
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_id_departamento_fkey";

-- DropForeignKey
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_id_funcionario_responsavel_fkey";

-- DropForeignKey
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_id_usuario_fkey";

-- DropForeignKey
ALTER TABLE "usuario_departamentos" DROP CONSTRAINT "usuario_departamentos_id_departamento_fkey";

-- DropForeignKey
ALTER TABLE "usuario_departamentos" DROP CONSTRAINT "usuario_departamentos_id_usuario_fkey";

-- CreateIndex
CREATE INDEX "arquivos_id_ticket_idx" ON "arquivos"("id_ticket");

-- CreateIndex
CREATE INDEX "arquivos_id_solicitacao_mensagem_idx" ON "arquivos"("id_solicitacao_mensagem");

-- CreateIndex
CREATE INDEX "categorias_id_departamento_idx" ON "categorias"("id_departamento");

-- CreateIndex
CREATE INDEX "departamentos_id_secretaria_idx" ON "departamentos"("id_secretaria");

-- CreateIndex
CREATE INDEX "logs_auditoria_id_usuario_idx" ON "logs_auditoria"("id_usuario");

-- CreateIndex
CREATE INDEX "notificacoes_id_usuario_idx" ON "notificacoes"("id_usuario");

-- CreateIndex
CREATE INDEX "notificacoes_id_ticket_idx" ON "notificacoes"("id_ticket");

-- CreateIndex
CREATE INDEX "notificacoes_id_solicitacao_idx" ON "notificacoes"("id_solicitacao");

-- CreateIndex
CREATE INDEX "perguntas_id_categoria_idx" ON "perguntas"("id_categoria");

-- CreateIndex
CREATE INDEX "perguntas_id_departamento_solicitado_idx" ON "perguntas"("id_departamento_solicitado");

-- CreateIndex
CREATE INDEX "respostas_id_pergunta_idx" ON "respostas"("id_pergunta");

-- CreateIndex
CREATE INDEX "respostas_id_ticket_idx" ON "respostas"("id_ticket");

-- CreateIndex
CREATE INDEX "solicitacao_mensagens_id_solicitacao_idx" ON "solicitacao_mensagens"("id_solicitacao");

-- CreateIndex
CREATE INDEX "solicitacao_mensagens_id_usuario_idx" ON "solicitacao_mensagens"("id_usuario");

-- CreateIndex
CREATE INDEX "solicitacoes_id_ticket_idx" ON "solicitacoes"("id_ticket");

-- CreateIndex
CREATE INDEX "solicitacoes_id_departamento_solicitado_idx" ON "solicitacoes"("id_departamento_solicitado");

-- CreateIndex
CREATE INDEX "solicitacoes_respondido_por_idx" ON "solicitacoes"("respondido_por");

-- CreateIndex
CREATE INDEX "ticket_historico_id_ticket_idx" ON "ticket_historico"("id_ticket");

-- CreateIndex
CREATE INDEX "ticket_historico_id_usuario_idx" ON "ticket_historico"("id_usuario");

-- CreateIndex
CREATE INDEX "tickets_id_usuario_idx" ON "tickets"("id_usuario");

-- CreateIndex
CREATE INDEX "tickets_id_categoria_idx" ON "tickets"("id_categoria");

-- CreateIndex
CREATE INDEX "tickets_id_departamento_idx" ON "tickets"("id_departamento");

-- CreateIndex
CREATE INDEX "tickets_id_funcionario_responsavel_idx" ON "tickets"("id_funcionario_responsavel");

-- CreateIndex
CREATE INDEX "usuario_departamentos_id_departamento_idx" ON "usuario_departamentos"("id_departamento");

-- AddForeignKey
ALTER TABLE "departamentos" ADD CONSTRAINT "departamentos_id_secretaria_fkey" FOREIGN KEY ("id_secretaria") REFERENCES "secretarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_departamentos" ADD CONSTRAINT "usuario_departamentos_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_departamentos" ADD CONSTRAINT "usuario_departamentos_id_departamento_fkey" FOREIGN KEY ("id_departamento") REFERENCES "departamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_id_departamento_fkey" FOREIGN KEY ("id_departamento") REFERENCES "departamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perguntas" ADD CONSTRAINT "perguntas_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perguntas" ADD CONSTRAINT "perguntas_id_departamento_solicitado_fkey" FOREIGN KEY ("id_departamento_solicitado") REFERENCES "departamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_id_departamento_fkey" FOREIGN KEY ("id_departamento") REFERENCES "departamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_id_funcionario_responsavel_fkey" FOREIGN KEY ("id_funcionario_responsavel") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas" ADD CONSTRAINT "respostas_id_pergunta_fkey" FOREIGN KEY ("id_pergunta") REFERENCES "perguntas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas" ADD CONSTRAINT "respostas_id_ticket_fkey" FOREIGN KEY ("id_ticket") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_historico" ADD CONSTRAINT "ticket_historico_id_ticket_fkey" FOREIGN KEY ("id_ticket") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_historico" ADD CONSTRAINT "ticket_historico_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes" ADD CONSTRAINT "solicitacoes_id_ticket_fkey" FOREIGN KEY ("id_ticket") REFERENCES "tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes" ADD CONSTRAINT "solicitacoes_id_departamento_solicitado_fkey" FOREIGN KEY ("id_departamento_solicitado") REFERENCES "departamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacoes" ADD CONSTRAINT "solicitacoes_respondido_por_fkey" FOREIGN KEY ("respondido_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao_mensagens" ADD CONSTRAINT "solicitacao_mensagens_id_solicitacao_fkey" FOREIGN KEY ("id_solicitacao") REFERENCES "solicitacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitacao_mensagens" ADD CONSTRAINT "solicitacao_mensagens_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arquivos" ADD CONSTRAINT "arquivos_id_ticket_fkey" FOREIGN KEY ("id_ticket") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arquivos" ADD CONSTRAINT "arquivos_id_solicitacao_mensagem_fkey" FOREIGN KEY ("id_solicitacao_mensagem") REFERENCES "solicitacao_mensagens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_id_ticket_fkey" FOREIGN KEY ("id_ticket") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_id_solicitacao_fkey" FOREIGN KEY ("id_solicitacao") REFERENCES "solicitacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_auditoria" ADD CONSTRAINT "logs_auditoria_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Sequences e defaults para geração automática das chaves primárias.
DO $$
DECLARE
  tabela TEXT;
BEGIN
  FOREACH tabela IN ARRAY ARRAY[
    'secretarias',
    'departamentos',
    'usuarios',
    'usuario_departamentos',
    'categorias',
    'perguntas',
    'tickets',
    'respostas',
    'ticket_historico',
    'solicitacoes',
    'solicitacao_mensagens',
    'arquivos',
    'notificacoes',
    'logs_auditoria'
  ]
  LOOP
    EXECUTE format('CREATE SEQUENCE %I', tabela || '_id_seq');
    EXECUTE format('ALTER SEQUENCE %I OWNED BY %I.id', tabela || '_id_seq', tabela);
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN id SET DEFAULT nextval(%L::regclass)',
      tabela,
      tabela || '_id_seq'
    );
    EXECUTE format(
      'SELECT setval(%L::regclass, COALESCE(MAX(id), 1), COUNT(*) > 0) FROM %I',
      tabela || '_id_seq',
      tabela
    );
  END LOOP;
END $$;
