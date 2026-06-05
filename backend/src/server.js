import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dns from 'dns';
import mongoose from 'mongoose';

// Force Node to resolve DNS via IPv4 first to prevent Atlas SRV errors
dns.setDefaultResultOrder('ipv4first');

import connectDB from './config/db.js';
import seedData from './config/seeder.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import parentSignupRoutes from './routes/parentSignupRoutes.js';
import tutorSignupRoutes from './routes/tutorSignupRoutes.js';
import newsletterRoutes from './routes/newsletterRoutes.js';
import tutorRoutes from './routes/tutorRoutes.js';

// Resolve directory paths in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Connect to Database
connectDB().then(() => {
  // Seed initial data
  seedData();
});

const app = express();

// Rate Limiting Middlewares
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per 15 minutes
  message: { message: 'Too many requests from this IP, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 submissions or logins per 15 minutes
  message: { message: 'Too many requests or form submissions from this IP, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Apply rate limiters
app.use('/api', generalLimiter);
app.use('/api/auth/login', strictLimiter);
app.use('/api/parent-signups', strictLimiter);
app.use('/api/tutor-signups', strictLimiter);
app.use('/api/contacts', strictLimiter);
app.use('/api/newsletters', strictLimiter);

// Diagnostic Health Check
app.get('/api/health', (req, res) => {
  let dbStatus = 'disconnected';
  const readyState = mongoose.connection.readyState;
  if (readyState === 0) dbStatus = 'disconnected';
  else if (readyState === 1) dbStatus = 'connected';
  else if (readyState === 2) dbStatus = 'connecting';
  else if (readyState === 3) dbStatus = 'disconnecting';

  res.json({
    status: 'UP',
    database: dbStatus,
    env: {
      nodeEnv: process.env.NODE_ENV,
      hasMongoUri: !!process.env.MONGODB_URI,
      hasEmailUser: !!process.env.EMAIL_USER,
      hasEmailPass: !!process.env.EMAIL_PASS,
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/parent-signups', parentSignupRoutes);
app.use('/api/tutor-signups', tutorSignupRoutes);
app.use('/api/newsletters', newsletterRoutes);
app.use('/api/tutors', tutorRoutes);

// Base route
app.get('/', (req, res) => {
  res.json({ message: 'Dhiyoni API is running successfully on Vercel Serverless!' });
});

// Error Middleware
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Only listen locally, Vercel serverless will use the exported app directly
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
}

// Export the app for Vercel serverless functions
export default app;
