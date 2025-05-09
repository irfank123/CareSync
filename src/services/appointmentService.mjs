const clinic = await this.Clinic.findOne({ _id: clinicId }).session(session).exec();
this.log(TAG, `Found clinic ID: ${clinic?._id} to associate appointment with.`);

if (!clinic) {
  await session.abortTransaction();
  this.error(TAG, `Clinic with ID ${clinicId} not found during appointment creation.`);
  throw new AppError('Clinic not found', 404);
}

// Ensure the timeslot is available and belongs to the specified doctor and clinic
const timeSlot = await this.TimeSlot.findById(timeSlotIdFromData).session(session).exec();

// Create the appointment
this.log(TAG, `About to create appointment. Clinic object: ${JSON.stringify(clinic)}, Clinic ID: ${clinic?._id}`);

const appointmentPayload = {
  ...data, // Spread data first
};
appointmentPayload.clinicId = String(clinic._id); // Then explicitly set/overwrite clinicId
appointmentPayload.status = status; // Explicitly set status

// If 'data' might contain a 'clinic' key that we don't want, remove it.
// This is important because the test failure shows a 'clinic' key.
delete appointmentPayload.clinic;

const appointment = await this.Appointment.create(
  [appointmentPayload],
  { session }
);

try { // INNER TRY
  // --- Fetch Doctor's User ID for Google Auth --- 
  console.log(`[TEST DEBUG] About to call Doctor.findById with ID: ${appointment.doctorId}`); // DEBUG LINE
  const doctor = await this.Doctor.findById(appointment.doctorId).select('userId').session(session);
  if (!doctor || !doctor.userId) {
    await session.abortTransaction();
    this.error(TAG, `Doctor with ID ${appointment.doctorId} not found or missing userId during appointment creation.`);
    throw new AppError('Doctor not found', 404);
  }
} catch (error) {
  await session.abortTransaction();
  this.error(TAG, `Error fetching doctor: ${error.message}`);
  throw error;
}

return appointment; 