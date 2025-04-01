// src/controllers/index.mjs

import * as authController from './authController.mjs';
import * as clinicAuthController from './clinicAuthController.mjs';
import * as adminController from './adminController.mjs';
import * as userController from './userController.mjs';
import * as patientController from './patientController.mjs';
import * as doctorController from './doctorController.mjs';
import * as staffController from './staffController.mjs';

export {
  authController,
  clinicAuthController,
  adminController,
  userController,
  patientController,
  doctorController,
  staffController
};