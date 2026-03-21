import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import healthRoutes from './routes/healthRoutes';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import mdaRoutes from './routes/mdaRoutes';
import loanRoutes from './routes/loanRoutes';
import ledgerRoutes from './routes/ledgerRoutes';
import scheduleRoutes from './routes/scheduleRoutes';
import balanceRoutes from './routes/balanceRoutes';
import reportRoutes from './routes/reportRoutes';
import staffProfileRoutes from './routes/staffProfileRoutes';
import migrationRoutes from './routes/migrationRoutes';
import migrationDashboardRoutes from './routes/migrationDashboardRoutes';
import observationRoutes from './routes/observationRoutes';
import traceReportRoutes from './routes/traceReportRoutes';
import delineationRoutes from './routes/delineationRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import submissionRoutes from './routes/submissionRoutes';
import preSubmissionRoutes from './routes/preSubmissionRoutes';
import employmentEventRoutes from './routes/employmentEventRoutes';
import reconciliationRoutes from './routes/reconciliationRoutes';
import historicalSubmissionRoutes from './routes/historicalSubmissionRoutes';
import { AppError } from './lib/appError';
import { VOCABULARY } from '@vlprs/shared';
import { requestLogger } from './middleware/requestLogger';
import { queryCounter } from './middleware/queryCounter';
import { env } from './config/env';

const app = express();

// Trust proxy for correct IP extraction behind Nginx
app.set('trust proxy', 'loopback');

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.NODE_ENV === 'production'
      ? process.env.CLIENT_ORIGIN || 'https://vlprs.oyo.gov.ng'
      : ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  }),
);
app.use(cookieParser());

// Body parsing with size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Structured request logging (global — logs all requests)
app.use(requestLogger);

// N+1 query detection (dev/test only — zero overhead in production)
if (env.NODE_ENV !== 'production') {
  app.use(queryCounter);
}

// Routes
app.use('/api', healthRoutes);
app.use('/api', authRoutes);
app.use('/api', userRoutes);
app.use('/api', mdaRoutes);
app.use('/api', loanRoutes);
app.use('/api', ledgerRoutes);
app.use('/api', scheduleRoutes);
app.use('/api', balanceRoutes);
app.use('/api', reportRoutes);
app.use('/api', staffProfileRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', migrationDashboardRoutes);
app.use('/api', observationRoutes);
app.use('/api', traceReportRoutes);
app.use('/api', delineationRoutes);
app.use('/api', migrationRoutes);
app.use('/api', submissionRoutes);
app.use('/api', preSubmissionRoutes);
app.use('/api', employmentEventRoutes);
app.use('/api', reconciliationRoutes);
app.use('/api', historicalSubmissionRoutes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'The requested resource was not found' },
  });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Map csrf-csrf errors to the AC-specified response format
  // csrf-csrf v4 sets err.code = 'EBADCSRFTOKEN' (matching legacy csurf convention)
  if ('code' in err && (err as Error & { code: string }).code === 'EBADCSRFTOKEN') {
    res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_VALIDATION_FAILED',
        message: VOCABULARY.CSRF_VALIDATION_FAILED,
      },
    });
    return;
  }

  const status = 'statusCode' in err ? (err as Error & { statusCode: number }).statusCode : 500;
  res.status(status).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
    },
  });
});

export default app;
