// src/routes/index.mjs

import express from 'express';
import authRoutes from './authRoutes.mjs';
import clinicAuthRoutes from './clinicAuthRoutes.mjs';
import adminRoutes from './adminRoutes.mjs';
import userRoutes from './userRoutes.mjs';
import patientRoutes from './patientRoutes.mjs';
import doctorRoutes from './doctorRoutes.mjs';
import staffRoutes from './staffRoutes.mjs';
import appointmentRoutes from './appointmentRoutes.mjs';
import availabilityRoutes from './availabilityRoutes.mjs';
import testRoutes from './testRoutes.mjs';
import assessmentRoutes from './assessmentRoutes.mjs';
import { 
  errorMiddleware, 
  rateLimitMiddleware,
  dataMiddleware 
} from '../middleware/index.mjs';

/**
 * Setup application routes
 * @param {Object} app - Express application
 */
const setupRoutes = (app) => {
  // Apply global middleware to all routes
  app.use(dataMiddleware.sanitizeResponse());
  
  // API routes
  const apiRouter = express.Router();
  
  // Apply rate limiting to all API routes
  apiRouter.use(rateLimitMiddleware.apiLimiter);
  
  // Auth routes
  apiRouter.use('/auth', authRoutes);
  
  // Clinic auth routes
  apiRouter.use('/auth/clinic', clinicAuthRoutes);
  
  // Admin routes
  apiRouter.use('/admin', adminRoutes);
  
  // User management routes
  apiRouter.use('/users', userRoutes);
  
  // Patient routes
  apiRouter.use('/patients', patientRoutes);
  
  // Doctor routes
  apiRouter.use('/doctors', doctorRoutes);
  
  // Staff routes
  apiRouter.use('/staff', staffRoutes);
  
  // Appointment routes
  apiRouter.use('/appointments', appointmentRoutes);
  
  // Availability routes
  apiRouter.use('/availability', availabilityRoutes);
  
  // Assessment routes
  apiRouter.use('/assessments', assessmentRoutes);
  
  // Test routes (for development only)
  if (process.env.NODE_ENV === 'development') {
    apiRouter.use('/test', testRoutes);
  }
  
  // Mount API router at /api
  app.use('/api', apiRouter);
  
  // Health check route
  app.get('/health', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Server is healthy',
      timestamp: new Date()
    });
  });
  
  // Apply 404 handler for undefined routes
  app.use(errorMiddleware.notFound);
  
  // Apply global error handler
  app.use(errorMiddleware.globalErrorHandler);
};

export default setupRoutes;