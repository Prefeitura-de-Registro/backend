-- Identificadores complementares de usuarios e tickets.
-- As colunas sao opcionais para preservar os registros existentes.

ALTER TABLE "usuarios"
  ADD COLUMN "cpf" VARCHAR(11),
  ADD COLUMN "matricula" VARCHAR,
  ADD COLUMN "cargo" VARCHAR;

ALTER TABLE "tickets"
  ADD COLUMN "protocolo" VARCHAR;

CREATE UNIQUE INDEX "usuarios_cpf_key" ON "usuarios"("cpf");
CREATE UNIQUE INDEX "usuarios_matricula_key" ON "usuarios"("matricula");
CREATE UNIQUE INDEX "tickets_protocolo_key" ON "tickets"("protocolo");
