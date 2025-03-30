// src/config/config.mjs

import auth0Config from './auth0Config.mjs';
import dotenv from 'dotenv';

//load environment variables
dotenv.config();

// Main application configuration

const config = {
  //environment
  env: process.env.NODE_ENV || 'development',
  
  //server
  port: process.env.PORT || 5000,
  
  //mongoDB connection string
  mongoURI: process.env.MONGO_URI,
  
  //JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '30d', // 30 days
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      maxAge: parseInt(process.env.JWT_COOKIE_EXPIRE || '30') * 24 * 60 * 60 * 1000 // days to ms
    }
  },
  
  //CORS
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  },
  
  //Auth0
  auth0: auth0Config,
  
  //frontend URL
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  
  //fmail
  email: {
    from: process.env.EMAIL_FROM,
    service: process.env.EMAIL_SERVICE,
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  },
  
  // File upload
  upload: {
    maxSize: parseInt(process.env.MAX_FILE_SIZE || '5242880'), // 5MB default
    allowedTypes: (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,application/pdf').split(','),
    storageType: process.env.STORAGE_TYPE || 'local', // 'local', 's3', etc.
    localPath: process.env.LOCAL_STORAGE_PATH || './uploads',
    // S3 configuration if needed
    s3: {
      bucket: process.env.S3_BUCKET,
      region: process.env.S3_REGION,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
    }
  },
  
  // Security
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10'),
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes default
      max: parseInt(process.env.RATE_LIMIT_MAX || '100') // limit each IP to 100 requests per windowMs
    }
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log'
  }
};

//validate essential configuration
const validateConfig = () => {
  const requiredVars = [
    { key: 'mongoURI', name: 'MONGO_URI' },
    { key: 'jwt.secret', name: 'JWT_SECRET' },
    { key: 'auth0.domain', name: 'AUTH0_DOMAIN' },
    { key: 'auth0.clientId', name: 'AUTH0_CLIENT_ID' },
    { key: 'auth0.clientSecret', name: 'AUTH0_CLIENT_SECRET' }
  ];
  
  const missingVars = [];
  
  requiredVars.forEach(({ key, name }) => {
    //check nested properties 
    const value = key.split('.').reduce((obj, path) => obj && obj[path], config);
    
    if (!value) {
      missingVars.push(name);
    }
  });
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(name => console.error(`   - ${name}`));
    console.error('Please set these environment variables and restart the server.');
    
    if (process.env.NODE_ENV === 'production') {
      //exit in production to prevent insecure deployment
      process.exit(1);
    } else {
      console.warn('⚠️ Running in development mode with missing variables. This is not recommended.');
    }
  }
};

// Run validation
validateConfig();

export default config;