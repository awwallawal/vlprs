import app from './app';
import { pino } from 'pino';

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
});

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, () => {
  logger.info(`VLPRS server running on port ${PORT}`);
});
