import type { z } from "zod";
import type {
  respondSolicitacaoBodySchema,
  solicitacaoIdParamsSchema,
} from "../schemas/solicitacao.schema.js";

export type SolicitacaoIdParamsDTO = z.infer<typeof solicitacaoIdParamsSchema>;
export type RespondSolicitacaoBodyDTO = z.infer<typeof respondSolicitacaoBodySchema>;
