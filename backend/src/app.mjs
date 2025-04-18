// src/app.mjs

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';
import { v4 as uuidv4 } from 'uuid';
import config from './config/config.mjs';
import setupRoutes from './routes/index.mjs';
import { errorMiddleware } from './middleware/index.mjs';
import { AppServiceProvider } from './utils/di/serviceProviders.mjs';

/**
 * Create and configure Express application
 * @returns {Object} Express app
 */
const createApp = () => {
  const app = express();
  
  // Assign unique ID to each request for tracking
  app.use((req, res, next) => {
    req.id = uuidv4();
    next();
  });
  
  // Set security headers
  app.use(helmet());
  
  // Sanitize inputs against XSS and MongoDB injection
  app.use(xss());
  app.use(mongoSanitize());
  
  // Prevent HTTP parameter pollution
  app.use(hpp());
  
  // Parse cookies
  app.use(cookieParser());
  
  // Body parser middleware
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  
  // Handle too large payloads
  app.use(errorMiddleware.payloadTooLarge);
  
  // CORS middleware
  app.use(cors(config.cors));
  
  // Logging middleware
  if (config.env === 'development') {
    app.use(morgan('dev'));
  } else {
    app.use(morgan('combined'));
  }
  
  // Add timestamp to all requests for logging
  app.use((req, res, next) => {
    req.requestTime = new Date().toISOString();
    next();
  });
  
  // Add DI container to the request
  app.use((req, res, next) => {
    req.container = AppServiceProvider;
    next();
  });
  
  return app;
};

/**
 * Setup routes for application
 * @param {Object} app - Express app
 */
const setupAppRoutes = (app) => {
  // Setup API routes
  setupRoutes(app);
  
  // Health check route
  app.get('/health', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Server is healthy',
      timestamp: new Date(),
      services: {
        // Check which core services are initialized
        email: req.container.getService('emailService').initialized,
        auth: true,
        database: true
      }
    });
  });
  
  // Apply 404 handler for undefined routes
  app.use(errorMiddleware.notFound);
  
  // Apply global error handler
  app.use(errorMiddleware.globalErrorHandler);
};

/**
 * Bootstrap the application
 * @returns {Object} Configured Express app
 */
const bootstrap = async () => {
  try {
    // Initialize all services
    await AppServiceProvider.initializeAsync();
    
    // Create Express app
    const app = createApp();
    
    // Setup routes
    setupAppRoutes(app);
    
    return app;
  } catch (error) {
    console.error('Failed to bootstrap application:', error);
    throw error;
  }
};

export { createApp, bootstrap };
export default bootstrap;