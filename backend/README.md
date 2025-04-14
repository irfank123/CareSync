# CareSync API Endpoints Summary

## Health Check

•⁠  ⁠⁠ GET /health ⁠ - Check API server health status

## Authentication

•⁠  ⁠⁠ POST /api/auth/register ⁠ - Register a new user
•⁠  ⁠⁠ POST /api/auth/login ⁠ - Login user
•⁠  ⁠⁠ POST /api/auth/verify-mfa ⁠ - Verify MFA code during login
•⁠  ⁠⁠ POST /api/auth/auth0/callback ⁠ - Handle Auth0 callback
•⁠  ⁠⁠ POST /api/auth/logout ⁠ - Logout user
•⁠  ⁠⁠ GET /api/auth/me ⁠ - Get current user profile
•⁠  ⁠⁠ POST /api/auth/forgot-password ⁠ - Request password reset
•⁠  ⁠⁠ PUT /api/auth/reset-password/:resetToken ⁠ - Reset password with token
•⁠  ⁠⁠ POST /api/auth/update-password ⁠ - Update password when logged in
•⁠  ⁠⁠ POST /api/auth/toggle-mfa ⁠ - Enable/disable MFA
•⁠  ⁠⁠ POST /api/auth/refresh-token ⁠ - Refresh authentication token
•⁠  ⁠⁠ POST /api/auth/verify-email ⁠ - Verify email with code

## Clinic Authentication

•⁠  ⁠⁠ POST /api/auth/clinic/register ⁠ - Register new clinic
•⁠  ⁠⁠ POST /api/auth/clinic/login ⁠ - Login as clinic administrator
•⁠  ⁠⁠ POST /api/auth/clinic/verify-email ⁠ - Verify clinic email
•⁠  ⁠⁠ POST /api/auth/clinic/submit-verification ⁠ - Submit clinic verification documents
•⁠  ⁠⁠ GET /api/auth/clinic/me ⁠ - Get current clinic profile
•⁠  ⁠⁠ POST /api/auth/clinic/forgot-password ⁠ - Request clinic password reset
•⁠  ⁠⁠ PUT /api/auth/clinic/reset-password/:resetToken ⁠ - Reset clinic password
•⁠  ⁠⁠ POST /api/auth/clinic/update-password ⁠ - Update clinic password
•⁠  ⁠⁠ POST /api/auth/clinic/refresh-token ⁠ - Refresh clinic authentication token

## User Management

•⁠  ⁠⁠ GET /api/users ⁠ - Get all users (with filtering & pagination)
•⁠  ⁠⁠ GET /api/users/:id ⁠ - Get single user
•⁠  ⁠⁠ POST /api/users ⁠ - Create new user
•⁠  ⁠⁠ PUT /api/users/:id ⁠ - Update user
•⁠  ⁠⁠ DELETE /api/users/:id ⁠ - Delete user
•⁠  ⁠⁠ GET /api/users/profile ⁠ - Get current user profile
•⁠  ⁠⁠ PUT /api/users/profile ⁠ - Update current user profile
•⁠  ⁠⁠ GET /api/users/search ⁠ - Search for users

## Patient Management

•⁠  ⁠⁠ GET /api/patients ⁠ - Get all patients (with filtering & pagination)
•⁠  ⁠⁠ GET /api/patients/:id ⁠ - Get single patient
•⁠  ⁠⁠ POST /api/patients ⁠ - Create new patient
•⁠  ⁠⁠ PUT /api/patients/:id ⁠ - Update patient
•⁠  ⁠⁠ DELETE /api/patients/:id ⁠ - Delete patient
•⁠  ⁠⁠ GET /api/patients/me ⁠ - Get current patient profile
•⁠  ⁠⁠ PUT /api/patients/me ⁠ - Update current patient profile
•⁠  ⁠⁠ GET /api/patients/:id/medical-history ⁠ - Get patient medical history

## Doctor Management

•⁠  ⁠⁠ GET /api/doctors ⁠ - Get all doctors (with filtering & pagination)
•⁠  ⁠⁠ GET /api/doctors/:id ⁠ - Get single doctor
•⁠  ⁠⁠ POST /api/doctors ⁠ - Create new doctor
•⁠  ⁠⁠ PUT /api/doctors/:id ⁠ - Update doctor
•⁠  ⁠⁠ DELETE /api/doctors/:id ⁠ - Delete doctor
•⁠  ⁠⁠ GET /api/doctors/me ⁠ - Get current doctor profile
•⁠  ⁠⁠ PUT /api/doctors/me ⁠ - Update current doctor profile
•⁠  ⁠⁠ GET /api/doctors/:id/availability ⁠ - Get doctor availability

## Staff Management

•⁠  ⁠⁠ GET /api/staff ⁠ - Get all staff (with filtering & pagination)
•⁠  ⁠⁠ GET /api/staff/:id ⁠ - Get single staff member
•⁠  ⁠⁠ POST /api/staff ⁠ - Create new staff member
•⁠  ⁠⁠ PUT /api/staff/:id ⁠ - Update staff member
•⁠  ⁠⁠ DELETE /api/staff/:id ⁠ - Delete staff member
•⁠  ⁠⁠ GET /api/staff/me ⁠ - Get current staff profile
•⁠  ⁠⁠ PUT /api/staff/me ⁠ - Update current staff profile

## Appointment Management

•⁠  ⁠⁠ GET /api/appointments ⁠ - Get all appointments (with filtering & pagination)
•⁠  ⁠⁠ GET /api/appointments/:id ⁠ - Get single appointment
•⁠  ⁠⁠ POST /api/appointments ⁠ - Create new appointment
•⁠  ⁠⁠ PUT /api/appointments/:id ⁠ - Update appointment
•⁠  ⁠⁠ DELETE /api/appointments/:id ⁠ - Delete appointment
•⁠  ⁠⁠ GET /api/appointments/upcoming ⁠ - Get upcoming appointments for current user
•⁠  ⁠⁠ GET /api/appointments/patient/:patientId ⁠ - Get patient's appointments
•⁠  ⁠⁠ GET /api/appointments/doctor/:doctorId ⁠ - Get doctor's appointments

## Availability Management

•⁠  ⁠⁠ GET /api/availability/doctor/:doctorId/slots ⁠ - Get all time slots for a doctor
•⁠  ⁠⁠ GET /api/availability/doctor/:doctorId/slots/available ⁠ - Get available time slots for a doctor
•⁠  ⁠⁠ POST /api/availability/slots ⁠ - Create new time slot
•⁠  ⁠⁠ PUT /api/availability/slots/:slotId ⁠ - Update time slot
•⁠  ⁠⁠ DELETE /api/availability/slots/:slotId ⁠ - Delete time slot
•⁠  ⁠⁠ POST /api/availability/doctor/:doctorId/generate ⁠ - Generate time slots from doctor's schedule
•⁠  ⁠⁠ POST /api/availability/doctor/:doctorId/import/google ⁠ - Import time slots from Google Calendar
•⁠  ⁠⁠ POST /api/availability/doctor/:doctorId/export/google ⁠ - Export time slots to Google Calendar
•⁠  ⁠⁠ POST /api/availability/doctor/:doctorId/sync/google ⁠ - Sync time slots with Google Calendar

## Admin Management

•⁠  ⁠⁠ GET /api/admin/clinics ⁠ - Get all clinics (with filtering & pagination)
•⁠  ⁠⁠ GET /api/admin/clinics/:id ⁠ - Get single clinic
•⁠  ⁠⁠ PUT /api/admin/clinics/:id/verification ⁠ - Update clinic verification status
•⁠  ⁠⁠ GET /api/admin/clinics/:id/documents ⁠ - Get clinic verification documents
•⁠  ⁠⁠ GET /api/admin/clinics/:id/staff ⁠ - Get clinic staff
•⁠  ⁠⁠ PUT /api/admin/clinics/:id/suspend ⁠ - Suspend/reactivate clinic
