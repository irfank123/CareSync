// src/config/config.mjs

import dotenv from 'dotenv';

// Do NOT call dotenv.config() here anymore

// Function to create and validate the config object
const loadAndValidateConfig = () => {
  // Load environment variables INSIDE the function
  // This ensures it happens *after* this function is called
  // However, relying on the call in server.mjs is cleaner.
  // dotenv.config(); // Keep this commented unless the server.mjs call isn't sufficient

  const config = {
    // App
    appName: process.env.APP_NAME || 'CareSync',
    
    // Environment
    env: process.env.NODE_ENV || 'development',
    
    // Server
    port: process.env.PORT || 5000,
    
    // MongoDB connection string
    mongoURI: process.env.MONGO_URI,
    
    // JWT
    jwt: {
      secret: process.env.JWT_SECRET,
      expiresIn: process.env.JWT_EXPIRES_IN || '30d', // 30 days
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        maxAge: parseInt(process.env.JWT_COOKIE_EXPIRE || '30') * 24 * 60 * 60 * 1000 // days to ms
      }
    },
    
    // Auth
    auth: {
      // Paths that require clinic verification
      clinicRestrictedRoutes: [
        '/api/clinic/patients',
        '/api/clinic/doctors',
        '/api/clinic/appointments',
        '/api/clinic/prescriptions'
      ],
      // Token blacklist TTL (time to live) in seconds
      tokenBlacklistTTL: 86400, // 24 hours
      // Account lockout threshold
      maxLoginAttempts: 5,
      // Account lockout duration in milliseconds
      accountLockoutDuration: 30 * 60 * 1000, // 30 minutes
      // Password reset token expiry in milliseconds
      passwordResetExpiry: 60 * 60 * 1000, // 1 hour
      // Email verification token expiry in milliseconds
      emailVerificationExpiry: 24 * 60 * 60 * 1000, // 24 hours
      // MFA token expiry in milliseconds
      mfaTokenExpiry: 10 * 60 * 1000 // 10 minutes
    },
    
    // CORS
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true
    },
    
    // Auth0
    auth0: {
      domain: process.env.AUTH0_DOMAIN,
      clientId: process.env.AUTH0_CLIENT_ID,
      clientSecret: process.env.AUTH0_CLIENT_SECRET,
      callbackUrl: process.env.AUTH0_CALLBACK_URL,
      audience: process.env.AUTH0_AUDIENCE || `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
    },
    
    // Google API
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
      refreshTokenEncryptionKey: process.env.REFRESH_TOKEN_ENCRYPTION_KEY
    },
    
    // Frontend URL
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    
    // Email
    email: {
      from: process.env.EMAIL_FROM || 'noreply@caresync.example.com',
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

  // --- Validation Logic --- (Moved inside the function)
  const criticalVars = [
      { key: 'mongoURI', name: 'MONGO_URI' },
      { key: 'jwt.secret', name: 'JWT_SECRET' }
  ];
  const recommendedVars = [
      // Keep Auth0 checks recommended but don't exit immediately in dev if missing
      { key: 'auth0.domain', name: 'AUTH0_DOMAIN' },
      { key: 'auth0.clientId', name: 'AUTH0_CLIENT_ID' },
      { key: 'auth0.clientSecret', name: 'AUTH0_CLIENT_SECRET' },
      { key: 'auth0.callbackUrl', name: 'AUTH0_CALLBACK_URL' }
      // Google OAuth values moved to optionalVars
  ];
  
  // Optional vars that won't produce warnings if missing
  const optionalVars = [
      // Google OAuth configuration is optional
      { key: 'google.clientId', name: 'GOOGLE_CLIENT_ID' },
      { key: 'google.clientSecret', name: 'GOOGLE_CLIENT_SECRET' },
      { key: 'google.redirectUri', name: 'GOOGLE_REDIRECT_URI' },
      { key: 'google.refreshTokenEncryptionKey', name: 'REFRESH_TOKEN_ENCRYPTION_KEY' },
  ];

  const missingCriticalVars = [];
  const missingRecommendedVars = [];

  criticalVars.forEach(({ key, name }) => {
      const value = key.split('.').reduce((obj, path) => obj && obj[path], config);
      if (!value) missingCriticalVars.push(name);
  });

  recommendedVars.forEach(({ key, name }) => {
      const value = key.split('.').reduce((obj, path) => obj && obj[path], config);
      if (!value) missingRecommendedVars.push(name);
  });

  if (missingCriticalVars.length > 0) {
      console.error('❌ Missing critical environment variables:', missingCriticalVars.join(', '));
      process.exit(1);
  }

  if (missingRecommendedVars.length > 0) {
      console.warn('⚠️ Missing recommended environment variables:', missingRecommendedVars.join(', '));
      // Don't exit in dev, but maybe add more specific warnings
      if (config.env !== 'development') {
           console.error('Exiting due to missing recommended variables in non-development environment.');
           process.exit(1);
      }
  }

  console.log('✅ Configuration loaded and validated successfully.');
  return config;
};

// Export the function, not the object directly
export default loadAndValidateConfig;