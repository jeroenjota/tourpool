import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { apiRouter } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { allowedOrigins, checkOrigin } from './auth.js';
import { scheduleGuestCleanup } from './guestCleanup.js';

const app = express();
const port = Number(process.env.PORT ?? 3000);

if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
app.use(cors({ origin: allowedOrigins(), credentials: true }));
app.use(express.json({ limit: '64kb' }));
app.use(checkOrigin);

app.get('/health', (_request, response) => {
  response.json({ ok: true });
});

app.use('/api', apiRouter);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Tourpool API running on http://localhost:${port}`);
  scheduleGuestCleanup();
});