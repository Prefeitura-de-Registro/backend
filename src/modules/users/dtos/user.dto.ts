import { z } from "zod";
import { createUserSchema, loginUserSchema } from "../schemas/user.schema.js";

/*
    DTOs são tipagens para os dados entre as camadas de controllers e services
    DTOs inferem os tipos definidos nos schemas zod
*/

export type CreateUserDTO = z.infer<typeof createUserSchema>;

export type LoginUserDTO = z.infer<typeof loginUserSchema>;