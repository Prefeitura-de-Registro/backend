import cors from 'cors';
import express from 'express';
import { routes } from './routes/index.js';
import { errorMiddleware } from './shared/middlewares/error.middleware.js';
import { notFoundMiddleware } from './shared/middlewares/not-found.middleware.js';

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];

app.use(cors({
  origin: allowedOrigins,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE'
}));

app.use(express.json());
app.use(routes);
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export { app };
