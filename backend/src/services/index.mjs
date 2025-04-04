// src/services/index.mjs

import userService from './userService.mjs';
import patientService from './patientService.mjs';
import doctorService from './doctorService.mjs';
import staffService from './staffService.mjs';
import appointmentService from './appointmentService.mjs';
import emailService from './emailService.mjs';
import authService from './authService.mjs';
import clinicAuthService from './clinicAuthService.mjs';
import tokenBlacklistService from './tokenBlacklistService.mjs';
import availabilityService from './availabilityService.mjs';

export {
  userService,
  patientService,
  doctorService,
  staffService,
  appointmentService,
  emailService,
  authService,
  clinicAuthService,
  tokenBlacklistService,
  availabilityService
};