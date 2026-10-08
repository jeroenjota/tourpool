import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { emailService } from '../email.js';

export const adminRouter = Router();

const testEmailLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: { message: 'Er zijn te veel testmails verstuurd. Probeer het later opnieuw.' },
  standardHeaders: 'draft-8',
  legacyHeaders: false
});

adminRouter.post('/test-email', testEmailLimit, async (_request, response, next) => {
  try {
    await emailService.sendTestEmail();
    response.json({ message: 'Testmail verzonden naar het ingestelde CONTACT_RECEIVER-adres.' });
  } catch (error) {
    next(error);
  }
});
