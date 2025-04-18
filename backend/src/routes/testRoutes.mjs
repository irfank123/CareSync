// src/routes/testRoutes.mjs

import express from 'express';
import mongoose from 'mongoose';
import assessmentController from '../controllers/assessmentController.mjs';
import { authMiddleware, auditMiddleware } from '../middleware/index.mjs';

const router = express.Router();

// Get models
const Appointment = mongoose.model('Appointment');
const Patient = mongoose.model('Patient');
const Doctor = mongoose.model('Doctor');
const TimeSlot = mongoose.model('TimeSlot');

// Test routes - NO AUTHENTICATION for testing only
// WARNING: These routes should be disabled in production!

// Special route to create test data
router.post('/create-test-data', async (req, res) => {
  try {
    // Create a patient if needed
    let patient = await Patient.findOne();
    if (!patient) {
      patient = await Patient.create({
        userId: new mongoose.Types.ObjectId(),
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male',
        allergies: ['None'],
        currentMedications: ['None']
      });
    }
    
    // Create a doctor if needed
    let doctor = await Doctor.findOne();
    if (!doctor) {
      doctor = await Doctor.create({
        userId: new mongoose.Types.ObjectId(),
        specialties: ['General'],
        licenseNumber: 'TEST12345'
      });
    }
    
    // Create a timeslot if needed
    let timeSlot = await TimeSlot.findOne({ status: 'available' });
    if (!timeSlot) {
      timeSlot = await TimeSlot.create({
        doctorId: doctor._id,
        date: new Date(),
        startTime: '10:00',
        endTime: '10:30',
        status: 'available'
      });
    }
    
    // Create an appointment
    const appointment = await Appointment.create({
      patientId: patient._id,
      doctorId: doctor._id,
      timeSlotId: timeSlot._id,
      date: new Date(),
      startTime: '10:00',
      endTime: '10:30',
      type: 'virtual',
      status: 'scheduled',
      reasonForVisit: 'Testing assessment functionality',
      isVirtual: true
    });
    
    return res.status(201).json({
      success: true,
      message: 'Test data created successfully',
      data: {
        patient: patient._id,
        doctor: doctor._id,
        timeSlot: timeSlot._id,
        appointment: appointment._id
      }
    });
  } catch (error) {
    console.error('Error creating test data:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create test data',
      error: error.message
    });
  }
});

// Get test data route
router.get('/get-test-data', async (req, res) => {
  try {
    // Fetch first patient, doctor, timeslot and appointment
    const patient = await Patient.findOne();
    const doctor = await Doctor.findOne();
    const timeSlot = await TimeSlot.findOne({ status: 'available' });
    const appointment = await Appointment.findOne();
    
    if (!patient || !doctor || !timeSlot || !appointment) {
      return res.status(404).json({
        success: false,
        message: 'Test data not found',
        data: null
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Test data retrieved successfully',
      data: {
        patient: {
          id: patient._id.toString(),
          info: {
            gender: patient.gender,
            dateOfBirth: patient.dateOfBirth
          }
        },
        doctor: {
          id: doctor._id.toString(),
          info: {
            specialties: doctor.specialties,
            licenseNumber: doctor.licenseNumber
          }
        },
        timeSlot: {
          id: timeSlot._id.toString(),
          info: {
            date: timeSlot.date,
            startTime: timeSlot.startTime,
            endTime: timeSlot.endTime
          }
        },
        appointment: {
          id: appointment._id.toString(),
          info: {
            date: appointment.date,
            status: appointment.status,
            type: appointment.type,
            reasonForVisit: appointment.reasonForVisit
          }
        }
      }
    });
  } catch (error) {
    console.error('Error retrieving test data:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve test data',
      error: error.message
    });
  }
});

// Get appointment by ID
router.get('/appointments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate appointment ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid appointment ID',
        data: null
      });
    }
    
    const appointment = await Appointment.findById(id);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
        data: null
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Appointment retrieved successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Error retrieving appointment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve appointment',
      error: error.message
    });
  }
});

// Create a fresh appointment with existing data
router.post('/create-fresh-appointment', async (req, res) => {
  try {
    // Get first patient and doctor
    const patient = await Patient.findOne();
    const doctor = await Doctor.findOne();
    
    if (!patient || !doctor) {
      return res.status(404).json({
        success: false,
        message: 'Patient or doctor not found',
        data: null
      });
    }
    
    // Create a fresh timeslot
    const timeSlot = await TimeSlot.create({
      doctorId: doctor._id,
      date: new Date(),
      startTime: '10:00',
      endTime: '10:30',
      status: 'available'
    });
    
    // Create a fresh appointment
    const appointment = await Appointment.create({
      patientId: patient._id,
      doctorId: doctor._id,
      timeSlotId: timeSlot._id,
      date: new Date(),
      startTime: '10:00',
      endTime: '10:30',
      type: 'virtual',
      status: 'scheduled',
      reasonForVisit: 'Testing assessment functionality',
      isVirtual: true
    });
    
    return res.status(201).json({
      success: true,
      message: 'Fresh appointment created successfully',
      data: {
        appointmentId: appointment._id.toString(),
        patientId: patient._id.toString(),
        doctorId: doctor._id.toString(),
        timeSlotId: timeSlot._id.toString()
      }
    });
  } catch (error) {
    console.error('Error creating fresh appointment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create fresh appointment',
      error: error.message
    });
  }
});

// Assessment testing routes
router.route('/patients/:id/assessments')
  .get(
    assessmentController.getPatientAssessments
  );

router.route('/patients/:id/assessments/start')
  .post(
    assessmentController.startAssessment
  );

router.route('/patients/:id/assessments/:assessmentId')
  .get(
    assessmentController.getAssessment
  );

router.route('/patients/:id/assessments/:assessmentId/questions')
  .get(
    assessmentController.getQuestions
  );

router.route('/patients/:id/assessments/:assessmentId/responses')
  .post(
    assessmentController.saveResponses
  );

router.route('/patients/:id/assessments/:assessmentId/complete')
  .post(
    assessmentController.completeAssessment
  );

router.route('/patients/:id/assessments/:assessmentId/skip')
  .post(
    assessmentController.skipAssessment
  );

router.route('/appointments/:appointmentId/assessment')
  .get(
    assessmentController.getAssessmentByAppointment
  );

export default router; 