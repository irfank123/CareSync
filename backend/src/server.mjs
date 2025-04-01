// src/server.mjs

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import hpp from 'hpp';
import { v4 as uuidv4 } from 'uuid';
import config from './config/config.mjs';
import { globalErrorHandler } from './utils/errorHandler.mjs';
import { 
  authRoutes, 
  adminRoutes, 
  userRoutes, 
  patientRoutes, 
  doctorRoutes, 
  staffRoutes 
} from './routes/index.mjs';

//initialize express app
const app = express();

//connect to MongoDB
mongoose.connect(config.mongoURI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => {
    console.error('MongoDB Connection Error:', err);
    process.exit(1);
});

//assign unique ID to each request (for logging/tracking)
app.use((req, res, next) => {
  req.id = uuidv4();
  next();
});

//security middleware
app.use(helmet()); // Set security headers
app.use(xss()); // Sanitize inputs
app.use(mongoSanitize()); // Prevent MongoDB injection
app.use(hpp()); // Prevent HTTP parameter pollution

//rate limiting
const limiter = rateLimit({
  windowMs: config.security.rateLimit.windowMs,
  max: config.security.rateLimit.max,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
});
app.use('/api/', limiter); //rate limiting to all API routes

//body parser middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());

//CORS middleware
app.use(cors(config.cors));

//logging middleware
if (config.env === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

//routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/staff', staffRoutes);

//timestamp to all requests for logging
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

//health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is healthy',
    environment: config.env,
    timestamp: new Date()
  });
});

//404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Cannot find ${req.method} ${req.originalUrl} on this server`
  });
});

//global error handling middleware
app.use(globalErrorHandler);

//start server
const PORT = config.port;
const server = app.listen(PORT, () => {
  console.log(`Server running in ${config.env} mode on port ${PORT}`);
});

//handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
  //close server & exit process
  server.close(() => {
    console.error('  Server closed due to unhandled promise rejection');
    process.exit(1);
  });
});

//handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  //close server & exit process
  server.close(() => {
    console.error('Server closed due to uncaught exception');
    process.exit(1);
  });
});

export default server;