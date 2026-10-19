import 'dotenv/config';
import { app } from './app.js';
import { iniciarAlertaDePrazos } from './modules/notificacoes/prazo-alerta.service.js';

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`HTTP server running on http://localhost:${port}`);
  iniciarAlertaDePrazos();
});
