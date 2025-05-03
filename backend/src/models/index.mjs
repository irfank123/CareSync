// src/models/index.mjs
import mongoose from 'mongoose';

// Import models one by one to avoid circular dependencies
import UserModel from './User.mjs';
import ClinicModel from './Clinic.mjs';
import PatientModel from './Patient.mjs';
import DoctorModel from './Doctor.mjs';
import StaffModel from './Staff.mjs';
import TimeSlotModel from './TimeSlot.mjs';
import AppointmentModel from './Appointment.mjs';
import AssessmentModel from './Assessment.mjs';
import ConsultationModel from './Consultation.mjs';
import PrescriptionModel from './Prescription.mjs';
import NotificationModel from './Notification.mjs';
import AuditLogModel from './AuditLog.mjs';
import SystemSettingsModel from './SystemSettings.mjs';

// Export models
export const User = UserModel;
export const Clinic = ClinicModel;
export const Patient = PatientModel;
export const Doctor = DoctorModel;
export const Staff = StaffModel;
export const TimeSlot = TimeSlotModel;
export const Appointment = AppointmentModel;
export const Assessment = AssessmentModel;
export const Consultation = ConsultationModel;
export const Prescription = PrescriptionModel;
export const Notification = NotificationModel;
export const AuditLog = AuditLogModel;
export const SystemSettings = SystemSettingsModel;

// Remove duplicate exports below
// export { default as AuditLog } from './auditLogModel.mjs';
// export { default as TimeSlot } from './timeSlotModel.mjs';
// export { default as Notification } from './notificationModel.mjs';