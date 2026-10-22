import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { routes } from './routes/index.js';
import { errorMiddleware } from './shared/middlewares/error.middleware.js';
import { notFoundMiddleware } from './shared/middlewares/not-found.middleware.js';

const app = express();

// Configuração do CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
app.use(cors({
  origin: allowedOrigins,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE'
}));

// Configuração do Rate Limit, para permitir apenas 100 requisições por minuto por IP
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, 
  max: 100, 
  message: { error: 'Muitas requisições deste IP, por favor tente novamente em 1 minuto.' },
  standardHeaders: true, 
  legacyHeaders: false, 
});

app.set('trust proxy', 1);

app.use(limiter);

app.use(express.json());
app.use(routes);
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export { app };