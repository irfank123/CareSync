import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import loadAndValidateConfig from '../../config/config.mjs';
import EmailService from './emailService.mjs';

// ... existing code ... 