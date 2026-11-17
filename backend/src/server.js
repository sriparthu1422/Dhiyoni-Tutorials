import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
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
import feedbackRoutes from './routes/feedbackRoutes.js';
import galleryRoutes from './routes/galleryRoutes.js';
import exportRoutes from './routes/exportRoutes.js';

// Resolve directory paths in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Database connection will be awaited per-request in the middleware below

const app = express();

// Trust proxy for proper IP resolution on Vercel / reverse proxies
app.set('trust proxy', 1);

// Security Headers via Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://*.googleapis.com', 'https://*.mongodb.net'],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configuration with allowed origins and credential support
const allowedOrigins = [
  'https://www.dhiyonitutorials.com',
  'https://dhiyonitutorials.com',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // In development or test, or requests with no origin, allow all
      if (!origin || process.env.NODE_ENV !== 'production' || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Blocked by CORS policy'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Idempotency-Key',
    ],
  })
);

app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}


// Diagnostic Health Check
app.get('/api/health', async (req, res) => {
  // Ensure we try to connect if not already connected
  try {
    await connectDB();
  } catch (err) {
    // ignore here, handled in middleware mostly, but good for healthcheck
  }

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

// -------------------------------------------------------------
// DATABASE CONNECTION MIDDLEWARE (REQUIRED FOR SERVERLESS)
// -------------------------------------------------------------
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error('Failed to connect to database in middleware:', error);
    res.status(500).json({ message: 'Database connection failed. Please try again.' });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/parent-signups', parentSignupRoutes);
app.use('/api/tutor-signups', tutorSignupRoutes);
app.use('/api/newsletters', newsletterRoutes);
app.use('/api/tutors', tutorRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/export', exportRoutes);

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
