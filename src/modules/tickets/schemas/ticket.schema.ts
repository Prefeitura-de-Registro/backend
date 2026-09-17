import { z } from "zod";

/*
    Schemas Zod validam entradas em runtime
    Schemas Zod são aplicados no validate.middleware
*/

export const getManyTicketSchema = z.object({
    page: z
        .coerce
        .number()
        .int()
        .positive()
        .default(1),
    limit: z
        .coerce
        .number()
        .int()
        .positive()
        .max(25)
        .default(20),
    status: z
        .enum( ["open", "in_service", "closed"])
        .optional(),
})