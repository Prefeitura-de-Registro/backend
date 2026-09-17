import { z } from "zod";
import { getManyTicketSchema } from "../schemas/ticket.schema.js";

/*
    DTOs são tipagens para os dados entre as camadas de controllers e services
    DTOs inferem os tipos definidos nos schemas zod
*/

export type GetManyTicketSchema = z.infer<typeof getManyTicketSchema>