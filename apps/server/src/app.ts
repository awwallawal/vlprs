import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import healthRoutes from './routes/healthRoutes';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', healthRoutes);

export default app;
