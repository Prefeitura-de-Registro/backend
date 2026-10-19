import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { routes } from './routes/index.js';
import { errorMiddleware } from './shared/middlewares/error.middleware.js';
import { notFoundMiddleware } from './shared/middlewares/not-found.middleware.js';

const app = express();

// Atrás de proxy/load balancer (ex.: TRUST_PROXY=1) o rate limit usa o IP real.
if (process.env.TRUST_PROXY) {
  const valor = process.env.TRUST_PROXY;
  app.set('trust proxy', /^\d+$/.test(valor) ? Number(valor) : valor);
}

// "cross-origin": o front (outra origem) precisa carregar as imagens de /api/arquivos.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

/**
 * CORS: CORS_ORIGIN aceita uma lista separada por vírgula
 * (ex.: "https://app.prefeitura.gov.br,http://localhost:5173").
 * Sem CORS_ORIGIN: libera qualquer origem fora de produção; em produção
 * nenhuma origem externa é aceita até a variável ser definida.
 */
const origensPermitidas = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((origem) => origem.trim())
  .filter(Boolean);

app.use(
  cors({
    origin:
      origensPermitidas.length > 0
        ? origensPermitidas
        : process.env.NODE_ENV !== 'production',
  }),
);
app.use(express.json({ limit: '100kb' }));
app.use(routes);
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export { app };
