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
import path from 'path';
import { fileURLToPath } from 'url';
import setupRoutes from './routes/index.mjs';
import { errorMiddleware } from './middleware/index.mjs';
import { AppServiceProvider } from './utils/di/serviceProviders.mjs';

// Import the config loader function
import loadAndValidateConfig from './config/config.mjs';

// Helper to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create and configure Express application
 * @param {object} config - The loaded application configuration.
 * @returns {Object} Express app
 */
const createApp = (config) => {
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
  app.use(cors({
    origin: config.cors.origin,
    credentials: config.cors.credentials,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'Expires']
  }));
  
  // Add middleware for tracking the origin to help with debugging redirection issues
  app.use((req, res, next) => {
    // Log the origin and referer to help diagnose cross-origin issues
    console.log('Request origin:', req.headers.origin || 'None');
    console.log('Request referer:', req.headers.referer || 'None');
    
    // For the Auth0 callback specifically, log more details
    if (req.path.includes('/auth0/callback')) {
      console.log('Auth0 callback request details:', {
        path: req.path,
        method: req.method,
        query: req.query,
        hasCookies: !!req.headers.cookie,
        origin: req.headers.origin || 'none'
      });
    }
    
    // Ensure we can send cookies cross-origin if needed
    res.header('Access-Control-Allow-Credentials', 'true');
    next();
  });
  
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
 * @param {object} config - The loaded application configuration.
 * @returns {Promise<object>} Configured Express app
 */
const bootstrap = async (config) => {
  try {
    // Initialize all services
    await AppServiceProvider.initializeAsync();
    
    // Create Express app
    const app = createApp(config);
    
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