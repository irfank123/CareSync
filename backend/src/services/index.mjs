// src/services/index.mjs

import userService from './userService.mjs';
import patientService from './patientService.mjs';
import doctorService from './doctorService.mjs';
import staffService from './staffService.mjs';
import emailService from './emailService.mjs';
import tokenBlacklistService from './tokenBlacklistService.mjs';
import authService from './authService.mjs';
import clinicAuthService from './clinicAuthService.mjs';

export {
  userService,
  patientService,
  doctorService,
  staffService,
  emailService,
  tokenBlacklistService,
  authService,
  clinicAuthService
};