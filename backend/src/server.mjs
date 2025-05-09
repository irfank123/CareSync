// src/server.mjs
import dotenv from 'dotenv';
dotenv.config(); // <-- Load .env variables FIRST

import mongoose from 'mongoose';
import loadAndValidateConfig from './config/config.mjs';
const config = loadAndValidateConfig();

import { bootstrap } from './app.mjs';
import clinicAuthService from './services/clinicAuthService.mjs';
import clinicAuth0Service from './services/clinicAuth0Service.mjs';
import clinicService from './services/clinicService.mjs';
import clinicRoutes from './routes/clinicRoutes.mjs';
import authRoutes from './routes/authRoutes.mjs';
import clinicAuthRoutes from './routes/clinicAuthRoutes.mjs';
import googleRoutes from './routes/googleRoutes.mjs';
import AppServiceProvider from './utils/di/serviceProviders.mjs';

/**
 * Connect to MongoDB with retry logic
 * @returns {Promise<void>} 
 */
const connectDB = async (retries = 5, delay = 5000) => {
  let lastError;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`MongoDB connection attempt ${attempt}/${retries}...`);
      await mongoose.connect(config.mongoURI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      });
      
      console.log('MongoDB Connected');
      return;
    } catch (error) {
      console.error(`Connection failed (attempt ${attempt}/${retries}):`, error.message);
      lastError = error;
      
      // If we have more retries, wait before next attempt
      if (attempt < retries) {
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Increase delay for next attempt (exponential backoff)
        delay = Math.min(delay * 1.5, 30000); // Cap at 30 seconds
      }
    }
  }
  
  console.error(`Failed to connect to MongoDB after ${retries} attempts`);
  throw lastError;
};

/**
 * Start the server
 * @param {Object} app - Express app
 * @returns {Object} HTTP server
 */
const startServer = (app) => {
  const PORT = config.port;
  
  return app.listen(PORT, () => {
    console.log(`Server running in ${config.env} mode on port ${PORT}`);
  });
};

/**
 * Setup global error handlers
 */
const setupErrorHandlers = (server) => {
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION:', err);
    
    // Attempt graceful shutdown
    gracefulShutdown(server, 'unhandled promise rejection');
  });
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
    
    // Uncaught exceptions are more serious, exit immediately
    gracefulShutdown(server, 'uncaught exception', true);
  });
  
  // Handle termination signals
  ['SIGTERM', 'SIGINT'].forEach(signal => {
    console.log(`Attaching listener for ${signal}`);
    process.on(signal, () => {
      console.log(`${signal} listener explicitly fired! Exiting immediately.`);
      process.exit(0);
    });
  });
};

/**
 * Gracefully shut down the server
 * @param {Object} server - HTTP server
 * @param {string} reason - Shutdown reason
 * @param {boolean} immediate - If true, exit immediately
 */
const gracefulShutdown = (server, reason, immediate = false) => {
  console.log(`Shutting down due to ${reason}`);
  
  if (immediate) {
    console.log('Exiting immediately');
    process.exit(1);
  }
  
  // Close server and disconnect from database
  server.close(() => {
    console.log('HTTP server closed callback entered.');
    
    mongoose.connection.close(false)
      .then(() => {
        console.log('MongoDB connection closed successfully.');
        process.exit(0);
      })
      .catch(err => {
        console.error('Error closing MongoDB connection:', err);
        console.log('Exiting due to DB close error.');
        process.exit(1);
      });
    console.log('mongoose.connection.close() called.');
    
    // Force exit after timeout if graceful shutdown fails
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  });
};

/**
 * Main function to start the application
 */
const startApp = async () => {
  try {
    // Connect to database
    await connectDB();
    
    // Bootstrap the application (sets up core middleware)
    const app = await bootstrap(config);
    
    // --- Initialize services via Service Provider ---
    // This step ensures all services are registered and async ones are ready.
    await AppServiceProvider.initializeAsync(); 
    // --- Remove Manual Service Instantiation and Attachment ---
    /* 
    // Instantiate services (REMOVED - Handled by DI Container)
    const services = {
      clinicAuthService,
      clinicAuth0Service,
      clinicService,
    };

    // Middleware to attach services to req (REMOVED - Handled by DI Helper)
    app.use((req, res, next) => {
      req.services = services;
      next();
    });
    */

    // --- Mount Routers ---
    app.use('/api/auth', authRoutes);
    app.use('/api/auth/clinic', clinicAuthRoutes);
    app.use('/api/clinics', clinicRoutes);
    app.use('/api/google', googleRoutes);
    // TODO: Mount other resource routers

    // --- Global Error Handler --- 
    // app.use(globalErrorHandler); 
    
    // Start server
    const server = startServer(app);
    
    // Setup process error handlers
    setupErrorHandlers(server);
    
    return server;
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
};

startApp();

export default startApp;