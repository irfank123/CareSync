// src/services/availabilityService.mjs

import { Doctor, TimeSlot, User, AuditLog } from '../models/index.mjs';
import mongoose from 'mongoose';
import { google } from 'googleapis';
import config from '../config/config.mjs';
import { AppError } from '../utils/errorHandler.mjs';

/**
 * Service for managing doctor availability and time slots
 */
class AvailabilityService {
  /**
   * Get a doctor's time slots for a specific date range
   * @param {string} doctorId - Doctor ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Array} All time slots
   */
  async getTimeSlots(doctorId, startDate, endDate) {
    try {
      // Default to current date if not provided
      const start = startDate || new Date();
      
      // Default to 7 days from start date if not provided
      const end = endDate || new Date(new Date(start).setDate(start.getDate() + 7));
      
      // Get existing time slots
      const timeSlots = await TimeSlot.find({
        doctorId,
        date: { $gte: start, $lte: end }
      }).sort({ date: 1, startTime: 1 }).lean();
      
      // Ensure ObjectIds are properly serialized
      return timeSlots.map(slot => ({
        ...slot,
        _id: slot._id.toString(),
        doctorId: slot.doctorId.toString()
      }));
    } catch (error) {
      console.error('Get time slots error:', error);
      throw new Error('Failed to retrieve time slots');
    }
  }

  /**
   * Get a doctor's available time slots for a specific date range
   * @param {string} doctorId - Doctor ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Array} Available time slots
   */
  async getAvailableTimeSlots(doctorId, startDate, endDate) {
    try {
      console.log(`[service.getAvailableTimeSlots] Called with doctorId: ${doctorId}`);
      
      // Default to current date if not provided
      const start = startDate || new Date();
      
      // Default to 7 days from start date if not provided
      const end = endDate || new Date(new Date(start).setDate(start.getDate() + 7));
      
      console.log(`[service.getAvailableTimeSlots] Date range: ${start.toISOString()} to ${end.toISOString()}`);
      
      // Log the query we're about to execute
      console.log(`[service.getAvailableTimeSlots] Querying TimeSlot with filter: { doctorId: ${doctorId}, date range, status: 'available' }`);
      
      // Get existing time slots with status 'available'
      const timeSlots = await TimeSlot.find({
        doctorId,
        date: { $gte: start, $lte: end },
        status: 'available'
      }).sort({ date: 1, startTime: 1 }).lean();
      
      console.log(`[service.getAvailableTimeSlots] Found ${timeSlots.length} available slots`);
      
      // Double check no booked slots are in the result
      const bookedSlots = timeSlots.filter(slot => slot.status !== 'available');
      if (bookedSlots.length > 0) {
        console.error(`[service.getAvailableTimeSlots] WARNING: Found ${bookedSlots.length} non-available slots in the result!`);
        console.error(`[service.getAvailableTimeSlots] First non-available slot: ${JSON.stringify(bookedSlots[0])}`);
      }
      
      // If we found slots, log a sample
      if (timeSlots.length > 0) {
        console.log(`[service.getAvailableTimeSlots] First slot: ${JSON.stringify(timeSlots[0])}`);
      }
      
      // Ensure ObjectIds are properly serialized
      const serializedSlots = timeSlots.map(slot => ({
        ...slot,
        _id: slot._id.toString(),
        doctorId: slot.doctorId.toString()
      }));
      
      return serializedSlots;
    } catch (error) {
      console.error('[service.getAvailableTimeSlots] Error:', error);
      throw new Error('Failed to retrieve available time slots');
    }
  }

  /**
   * Get a specific time slot by ID
   * @param {string} slotId - Time slot ID
   * @returns {Object} Time slot (plain object)
   */
  async getTimeSlotById(slotId) {
    try {
      // Use .lean() to return a plain JS object
      return await TimeSlot.findById(slotId).lean();
    } catch (error) {
      console.error('Get time slot by ID error:', error);
      throw new Error('Failed to retrieve time slot');
    }
  }

  /**
   * Get a specific time slot by ID with formatted date string
   * @param {string} slotId - Time slot ID
   * @returns {Object} Time slot with formatted date
   */
  async getTimeSlotWithFormattedDate(slotId) {
    try {
      // Use lean() to get a plain JavaScript object instead of a Mongoose document
      const timeSlot = await TimeSlot.findById(slotId).lean();
      
      if (!timeSlot) {
        return null;
      }
      
      // Explicitly convert the date to a string format
      if (timeSlot.date) {
        // Format the date as YYYY-MM-DD string
        const date = new Date(timeSlot.date);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          timeSlot.date = `${year}-${month}-${day}`;
        } else {
          // If date is invalid, set to empty string instead of empty object
          timeSlot.date = '';
        }
      } else {
        // If date is missing, set to empty string instead of null/undefined
        timeSlot.date = '';
      }
      
      // Convert MongoDB ObjectIds to strings to ensure they serialize properly
      if (timeSlot._id) {
        timeSlot._id = timeSlot._id.toString();
      }
      if (timeSlot.doctorId) {
        timeSlot.doctorId = timeSlot.doctorId.toString();
      }
      
      return timeSlot;
    } catch (error) {
      console.error('Get time slot with formatted date error:', error);
      throw new Error('Failed to retrieve time slot with formatted date');
    }
  }

  /**
   * Create a new time slot for a doctor
   * @param {Object} slotData - Time slot data
   * @returns {Object} Created time slot
   */
  async createTimeSlot(slotData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Validate required fields
      if (!slotData.doctorId || !slotData.date || !slotData.startTime || !slotData.endTime) {
        throw new Error('Missing required time slot data');
      }
      
      // Check if doctor exists
      const doctor = await Doctor.findById(slotData.doctorId);
      if (!doctor) {
        throw new Error('Doctor not found');
      }
      
      // Convert input times to standard format if needed
      const startTime = slotData.startTime.includes(':') ? slotData.startTime : `${slotData.startTime}:00`;
      const endTime = slotData.endTime.includes(':') ? slotData.endTime : `${slotData.endTime}:00`;
      
      // Check for existing overlapping time slots - this is critical
      const overlappingSlot = await this.checkOverlappingTimeSlots(
        slotData.doctorId,
        slotData.date,
        startTime,
        endTime
      );
      
      if (overlappingSlot) {
        const dateString = new Date(overlappingSlot.date).toLocaleDateString();
        throw new Error(`Time slot conflicts with an existing appointment (${dateString}, ${overlappingSlot.startTime}-${overlappingSlot.endTime})`);
      }
      
      // Create the time slot
      const timeSlot = await TimeSlot.create([{
        doctorId: slotData.doctorId,
        date: slotData.date,
        startTime: startTime,
        endTime: endTime,
        status: slotData.status || 'available'
      }], { session });
      
      // Create audit log
      await AuditLog.create([{
        userId: slotData.createdBy || slotData.doctorId,
        action: 'create',
        resource: 'timeslot',
        resourceId: timeSlot[0]._id,
        details: {
          doctorId: slotData.doctorId,
          date: slotData.date,
          startTime: startTime,
          endTime: endTime,
          status: timeSlot[0].status
        }
      }], { session });
      
      // Commit transaction
      await session.commitTransaction();
      
      return timeSlot[0];
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      console.error('Create time slot error:', error);
      throw new Error(`Failed to create time slot: ${error.message}`);
    } finally {
      session.endSession();
    }
  }

  /**
   * Update a time slot
   * @param {string} slotId - Time slot ID
   * @param {Object} updateData - Data to update
   * @param {string} userId - User making the update
   * @returns {Object} Updated time slot (plain object)
   */
  async updateTimeSlot(slotId, updateData, userId) {
    let session;
    try {
      session = await mongoose.startSession();
      session.startTransaction();

      // Find the time slot within the transaction
      const timeSlot = await TimeSlot.findById(slotId).session(session);
      if (!timeSlot) {
        throw new Error('Time slot not found');
      }
      
      // If updating time or date, check for overlaps
      if ((updateData.startTime && updateData.startTime !== timeSlot.startTime) ||
          (updateData.endTime && updateData.endTime !== timeSlot.endTime) ||
          (updateData.date && new Date(updateData.date).toISOString() !== timeSlot.date.toISOString())) {
            
        const overlappingSlot = await this.checkOverlappingTimeSlots(
          timeSlot.doctorId,
          updateData.date || timeSlot.date,
          updateData.startTime || timeSlot.startTime,
          updateData.endTime || timeSlot.endTime,
          slotId
        );
        
        if (overlappingSlot) {
          const dateString = new Date(overlappingSlot.date).toLocaleDateString();
          throw new Error(`Updated time slot would conflict with an existing appointment (${dateString}, ${overlappingSlot.startTime}-${overlappingSlot.endTime})`);
        }
      }
      
      // Check if the slot is already booked but trying to change the time
      if (timeSlot.status === 'booked' && 
          (updateData.startTime || updateData.endTime || updateData.date)) {
        throw new Error('Cannot change time or date of a booked slot');
      }
      
      // Update the time slot within the transaction
      const updatedSlotDoc = await TimeSlot.findByIdAndUpdate(
        slotId,
        { $set: updateData },
        { new: true, runValidators: true, session: session }
      );

      if (!updatedSlotDoc) {
        // Should not happen if findById found it, but good practice
        throw new Error('Failed to update time slot after finding it.');
      }
      
      // Create audit log within the transaction
      await AuditLog.create([{
        userId: userId || timeSlot.doctorId,
        action: 'update',
        resource: 'timeslot',
        resourceId: slotId,
        details: {
          doctorId: timeSlot.doctorId,
          updatedFields: Object.keys(updateData),
          previousStatus: timeSlot.status,
          newStatus: updateData.status || timeSlot.status
        }
      }], { session });
      
      // Commit the transaction
      await session.commitTransaction();

      // Return a plain JS object
      return updatedSlotDoc.toObject();
    } catch (error) {
      if (session) {
        await session.abortTransaction();
      }
      console.error('Update time slot error:', error);
      throw new Error(`Failed to update time slot: ${error.message}`);
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }

  /**
   * Delete a time slot
   * @param {string} slotId - Time slot ID
   * @param {string} userId - User deleting the slot
   * @returns {boolean} Success status
   */
  async deleteTimeSlot(slotId, userId) {
    try {
      // Find the time slot
      const timeSlot = await TimeSlot.findById(slotId);
      if (!timeSlot) {
        throw new Error('Time slot not found');
      }
      
      // Prevent deletion of booked slots
      if (timeSlot.status === 'booked') {
        throw new Error('Cannot delete a booked time slot');
      }
      
      // Delete the time slot
      await TimeSlot.findByIdAndDelete(slotId);
      
      // Create audit log
      await AuditLog.create({
        userId: userId || timeSlot.doctorId,
        action: 'delete',
        resource: 'timeslot',
        resourceId: slotId,
        details: {
          doctorId: timeSlot.doctorId,
          date: timeSlot.date,
          startTime: timeSlot.startTime,
          endTime: timeSlot.endTime,
          status: timeSlot.status
        }
      });
      
      return true;
    } catch (error) {
      console.error('Delete time slot error:', error);
      throw new Error(`Failed to delete time slot: ${error.message}`);
    }
  }

  /**
   * Generate time slots based on doctor's availability schedule
   * @param {string} doctorId - Doctor ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {string} userId - User generating the slots
   * @returns {Array} Generated time slots
   */
  async generateTimeSlotsFromSchedule(doctorId, startDate, endDate, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Get doctor
      const doctor = await Doctor.findById(doctorId);
      if (!doctor) {
        throw new Error('Doctor not found');
      }
      
      // Default to current date if not provided
      const start = startDate || new Date();
      
      // Default to the same day if endDate not provided
      const end = endDate || new Date(start);
      
      const generatedSlots = [];
      
      // Fixed appointment duration of 20 minutes
      const appointmentDuration = 20;
      
      // Loop through each day in the date range
      for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
        const currentDate = new Date(day);
        
        // Morning slots (9am to 12pm)
        let slotStart = new Date(currentDate);
        slotStart.setHours(9, 0, 0, 0);
        
        const morningEnd = new Date(currentDate);
        morningEnd.setHours(12, 0, 0, 0);
        
        // Generate morning slots (9am to 12pm)
        while (slotStart.getTime() + appointmentDuration * 60000 <= morningEnd.getTime()) {
          const slotEndTime = new Date(slotStart.getTime() + appointmentDuration * 60000);
          
          // Format times as HH:MM
          const formattedStartTime = 
            `${String(slotStart.getHours()).padStart(2, '0')}:${String(slotStart.getMinutes()).padStart(2, '0')}`;
          
          const formattedEndTime = 
            `${String(slotEndTime.getHours()).padStart(2, '0')}:${String(slotEndTime.getMinutes()).padStart(2, '0')}`;
          
          // Check for existing overlapping slots
          const overlappingSlot = await this.checkOverlappingTimeSlots(
            doctorId,
            new Date(currentDate),
            formattedStartTime,
            formattedEndTime
          );
          
          // Only create slot if no overlap exists
          if (!overlappingSlot) {
            const newSlot = await TimeSlot.create([{
              doctorId,
              date: new Date(currentDate),
              startTime: formattedStartTime,
              endTime: formattedEndTime,
              status: 'available'
            }], { session });
            
            generatedSlots.push(newSlot[0]);
          }
          
          // Move to next slot
          slotStart.setTime(slotStart.getTime() + appointmentDuration * 60000);
        }
        
        // Afternoon slots (1pm to 5pm)
        slotStart = new Date(currentDate);
        slotStart.setHours(13, 0, 0, 0);
        
        const afternoonEnd = new Date(currentDate);
        afternoonEnd.setHours(17, 0, 0, 0);
        
        // Generate afternoon slots (1pm to 5pm)
        while (slotStart.getTime() + appointmentDuration * 60000 <= afternoonEnd.getTime()) {
          const slotEndTime = new Date(slotStart.getTime() + appointmentDuration * 60000);
          
          // Format times as HH:MM
          const formattedStartTime = 
            `${String(slotStart.getHours()).padStart(2, '0')}:${String(slotStart.getMinutes()).padStart(2, '0')}`;
          
          const formattedEndTime = 
            `${String(slotEndTime.getHours()).padStart(2, '0')}:${String(slotEndTime.getMinutes()).padStart(2, '0')}`;
          
          // Check for existing overlapping slots
          const overlappingSlot = await this.checkOverlappingTimeSlots(
            doctorId,
            new Date(currentDate),
            formattedStartTime,
            formattedEndTime
          );
          
          // Only create slot if no overlap exists
          if (!overlappingSlot) {
            const newSlot = await TimeSlot.create([{
              doctorId,
              date: new Date(currentDate),
              startTime: formattedStartTime,
              endTime: formattedEndTime,
              status: 'available'
            }], { session });
            
            generatedSlots.push(newSlot[0]);
          }
          
          // Move to next slot
          slotStart.setTime(slotStart.getTime() + appointmentDuration * 60000);
        }
      }
      
      // Create audit log
      await AuditLog.create([{
        userId: userId || doctorId,
        action: 'create',
        resource: 'timeslot',
        details: {
          doctorId,
          startDate: start,
          endDate: end,
          slotsGenerated: generatedSlots.length
        }
      }], { session });
      
      // Commit the transaction
      await session.commitTransaction();
      
      return generatedSlots;
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      console.error('Generate time slots error:', error);
      throw new Error(`Failed to generate time slots: ${error.message}`);
    } finally {
      session.endSession();
    }
  }

  /**
   * Check for overlapping time slots
   * @param {string} doctorId - Doctor ID
   * @param {Date} date - Date to check
   * @param {string} startTime - Start time (HH:MM)
   * @param {string} endTime - End time (HH:MM)
   * @param {string} excludeSlotId - Slot ID to exclude (for updates)
   * @returns {Object|null} Overlapping time slot if found, null otherwise
   */
  async checkOverlappingTimeSlots(doctorId, date, startTime, endTime, excludeSlotId = null) {
    // Convert date to a Date object if it's not already
    const checkDate = new Date(date);
    
    // Set time to midnight to compare only the date part
    const dateToCheck = new Date(checkDate.setHours(0, 0, 0, 0));
    
    // Convert HH:MM time strings to minutes for easy comparison
    const startTimeMinutes = this._timeToMinutes(startTime);
    const endTimeMinutes = this._timeToMinutes(endTime);
    
    // Ensure end time is after start time
    if (endTimeMinutes <= startTimeMinutes) {
      throw new Error('End time must be after start time');
    }
    
    // Create query to find overlapping slots
    const query = {
      doctorId,
      date: dateToCheck
    };
    
    // Exclude the current slot ID if provided (for updates)
    if (excludeSlotId) {
      query._id = { $ne: excludeSlotId };
    }
    
    console.log(`Checking for overlaps: ${startTime}-${endTime} on ${dateToCheck.toISOString()}`);
    
    // Find all slots for this doctor on this date
    const slotsOnDate = await TimeSlot.find(query);
    console.log(`Found ${slotsOnDate.length} existing slots to check against`);
    
    // Check each slot for overlap
    for (const slot of slotsOnDate) {
      const slotStartMinutes = this._timeToMinutes(slot.startTime);
      const slotEndMinutes = this._timeToMinutes(slot.endTime);
      
      console.log(`Comparing with existing slot: ${slot.startTime}-${slot.endTime} (${slotStartMinutes}-${slotEndMinutes} minutes)`);
      console.log(`New slot: ${startTime}-${endTime} (${startTimeMinutes}-${endTimeMinutes} minutes)`);
      
      // Check for any type of overlap:
      // 1. New slot starts during existing slot
      // 2. New slot ends during existing slot
      // 3. New slot completely contains existing slot
      // 4. New slot is completely contained within existing slot
      const overlap = (
        // New slot starts during existing slot
        (startTimeMinutes >= slotStartMinutes && startTimeMinutes < slotEndMinutes) ||
        // New slot ends during existing slot
        (endTimeMinutes > slotStartMinutes && endTimeMinutes <= slotEndMinutes) ||
        // New slot completely contains existing slot
        (startTimeMinutes <= slotStartMinutes && endTimeMinutes >= slotEndMinutes) ||
        // New slot is completely contained within existing slot
        (startTimeMinutes >= slotStartMinutes && endTimeMinutes <= slotEndMinutes)
      );
      
      if (overlap) {
        console.log(`OVERLAP DETECTED: New slot ${startTime}-${endTime} overlaps with existing slot ${slot.startTime}-${slot.endTime}`);
        return slot;
      }
    }
    
    // No overlap found
    return null;
  }

  /**
   * Set up Google Calendar client
   * @param {string} refreshToken - Google refresh token
   * @returns {Object} Google Calendar client
   * @private
   */
  async _setupGoogleCalendarClient(refreshToken) {
    try {
      // Set up OAuth2 client
      const oauth2Client = new google.auth.OAuth2(
        config.googleCalendar.clientId,
        config.googleCalendar.clientSecret,
        config.googleCalendar.redirectUri
      );
      
      // Set credentials
      oauth2Client.setCredentials({
        refresh_token: refreshToken
      });
      
      // Create calendar client
      const calendar = google.calendar({
        version: 'v3',
        auth: oauth2Client
      });
      
      return calendar;
    } catch (error) {
      console.error('Setup Google Calendar client error:', error);
      throw new Error('Failed to set up Google Calendar client');
    }
  }

  /**
   * Import time slots from Google Calendar
   * @param {string} doctorId - Doctor ID
   * @param {string} refreshToken - Google refresh token
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {string} userId - User performing the import
   * @returns {Object} Import results
   */
  async importFromGoogleCalendar(doctorId, refreshToken, startDate, endDate, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Get doctor
      const doctor = await Doctor.findById(doctorId);
      if (!doctor) {
        throw new Error('Doctor not found');
      }
      
      // Set up Google Calendar client
      const calendar = await this._setupGoogleCalendarClient(refreshToken);
      
      // Default to current date if not provided
      const start = startDate || new Date();
      
      // Default to 30 days from start date if not provided
      const end = endDate || new Date(new Date(start).setDate(start.getDate() + 30));
      
      // Get events from Google Calendar
      const events = await calendar.events.list({
        calendarId: 'primary',
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      });
      
      const importResults = {
        imported: 0,
        skipped: 0,
        errors: 0,
        details: []
      };
      
      // Process each event
      for (const event of events.data.items || []) {
        try {
          // Skip events without start or end time
          if (!event.start.dateTime || !event.end.dateTime) {
            importResults.skipped++;
            importResults.details.push({
              event: event.summary,
              status: 'skipped',
              reason: 'Missing start or end time'
            });
            continue;
          }
          
          // Extract date and times
          const eventStart = new Date(event.start.dateTime);
          const eventEnd = new Date(event.end.dateTime);
          
          // Skip events on different days (crossing midnight)
          if (eventStart.getDate() !== eventEnd.getDate() ||
              eventStart.getMonth() !== eventEnd.getMonth() ||
              eventStart.getFullYear() !== eventEnd.getFullYear()) {
            importResults.skipped++;
            importResults.details.push({
              event: event.summary,
              status: 'skipped',
              reason: 'Event spans multiple days'
            });
            continue;
          }
          
          // Format times as HH:MM
          const startTime = 
            `${String(eventStart.getHours()).padStart(2, '0')}:${String(eventStart.getMinutes()).padStart(2, '0')}`;
          
          const endTime = 
            `${String(eventEnd.getHours()).padStart(2, '0')}:${String(eventEnd.getMinutes()).padStart(2, '0')}`;
          
          // Check for overlapping slots
          const overlappingSlot = await this.checkOverlappingTimeSlots(
            doctorId,
            eventStart,
            startTime,
            endTime
          );
          
          if (overlappingSlot) {
            importResults.skipped++;
            importResults.details.push({
              event: event.summary,
              status: 'skipped',
              reason: 'Overlaps with existing time slot'
            });
            continue;
          }
          
          // Create time slot
          const newSlot = await TimeSlot.create([{
            doctorId,
            date: new Date(eventStart.setHours(0, 0, 0, 0)),
            startTime,
            endTime,
            status: 'available',
            googleEventId: event.id // Store Google Calendar event ID for future sync
          }], { session });
          
          importResults.imported++;
          importResults.details.push({
            event: event.summary,
            status: 'imported',
            slotId: newSlot[0]._id
          });
        } catch (eventError) {
          console.error('Import event error:', eventError);
          importResults.errors++;
          importResults.details.push({
            event: event.summary,
            status: 'error',
            error: eventError.message
          });
        }
      }
      
      // Create audit log
      await AuditLog.create([{
        userId: userId || doctorId,
        action: 'import',
        resource: 'timeslot',
        details: {
          doctorId,
          startDate: start,
          endDate: end,
          source: 'googleCalendar',
          imported: importResults.imported,
          skipped: importResults.skipped,
          errors: importResults.errors
        }
      }], { session });
      
      // Commit the transaction
      await session.commitTransaction();
      
      return importResults;
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      console.error('Import from Google Calendar error:', error);
      throw new Error(`Failed to import from Google Calendar: ${error.message}`);
    } finally {
      session.endSession();
    }
  }

  /**
   * Export time slots to Google Calendar
   * @param {string} doctorId - Doctor ID
   * @param {string} refreshToken - Google refresh token
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {string} userId - User performing the export
   * @returns {Object} Export results
   */
  async exportToGoogleCalendar(doctorId, refreshToken, startDate, endDate, userId) {
    try {
      // Get doctor
      const doctor = await Doctor.findById(doctorId);
      if (!doctor) {
        throw new Error('Doctor not found');
      }
      
      // Get doctor's user info for name
      const doctorUser = await User.findById(doctor.userId);
      if (!doctorUser) {
        throw new Error('Doctor user not found');
      }
      
      // Set up Google Calendar client
      const calendar = await this._setupGoogleCalendarClient(refreshToken);
      
      // Default to current date if not provided
      const start = startDate || new Date();
      
      // Default to 30 days from start date if not provided
      const end = endDate || new Date(new Date(start).setDate(start.getDate() + 30));
      
      // Get time slots to export
      const slots = await TimeSlot.find({
        doctorId,
        date: { $gte: start, $lte: end },
        googleEventId: { $exists: false } // Only export slots that haven't been exported yet
      });
      
      const exportResults = {
        exported: 0,
        skipped: 0,
        errors: 0,
        details: []
      };
      
      // Process each slot
      for (const slot of slots) {
        try {
          // Create event date objects
          const eventDate = new Date(slot.date);
          
          // Parse start and end times
          const [startHour, startMinute] = slot.startTime.split(':').map(Number);
          const [endHour, endMinute] = slot.endTime.split(':').map(Number);
          
          // Set event start and end times
          const eventStart = new Date(eventDate);
          eventStart.setHours(startHour, startMinute, 0, 0);
          
          const eventEnd = new Date(eventDate);
          eventEnd.setHours(endHour, endMinute, 0, 0);
          
          // Create event in Google Calendar
          const event = await calendar.events.insert({
            calendarId: 'primary',
            resource: {
              summary: `Available: Dr. ${doctorUser.firstName} ${doctorUser.lastName}`,
              description: 'Automatically created by CareSync Availability Management System',
              start: {
                dateTime: eventStart.toISOString(),
                timeZone: 'UTC'
              },
              end: {
                dateTime: eventEnd.toISOString(),
                timeZone: 'UTC'
              },
              colorId: '2', // Green
              transparency: 'transparent', // Do not block time
              reminders: {
                useDefault: false,
                overrides: [
                  { method: 'popup', minutes: 10 }
                ]
              }
            }
          });
          
          // Update slot with Google Calendar event ID
          await TimeSlot.findByIdAndUpdate(slot._id, {
            googleEventId: event.data.id
          });
          
          exportResults.exported++;
          exportResults.details.push({
            slotId: slot._id,
            status: 'exported',
            eventId: event.data.id
          });
        } catch (slotError) {
          console.error('Export slot error:', slotError);
          exportResults.errors++;
          exportResults.details.push({
            slotId: slot._id,
            status: 'error',
            error: slotError.message
          });
        }
      }
      
      // Create audit log
      await AuditLog.create({
        userId: userId || doctorId,
        action: 'export',
        resource: 'timeslot',
        details: {
          doctorId,
          startDate: start,
          endDate: end,
          destination: 'googleCalendar',
          exported: exportResults.exported,
          skipped: exportResults.skipped,
          errors: exportResults.errors
        }
      });
      
      return exportResults;
    } catch (error) {
      console.error('Export to Google Calendar error:', error);
      throw new Error(`Failed to export to Google Calendar: ${error.message}`);
    }
  }

/**
 * Sync time slots with Google Calendar (two-way sync)
 * @param {string} doctorId - Doctor ID
 * @param {string} refreshToken - Google refresh token
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {string} userId - User performing the sync
 * @returns {Object} Sync results
 */
async syncWithGoogleCalendar(doctorId, refreshToken, startDate, endDate, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Get doctor
      const doctor = await this._getDoctorForSync(doctorId);
      
      // Set up Google Calendar client
      const calendar = await this._setupGoogleCalendarClient(refreshToken);
      
      // Set date range
      const { start, end } = this._getDateRange(startDate, endDate);
      
      // Get time slots from database
      const dbSlots = await this._getTimeSlots(doctorId, start, end);
      
      // Get events from Google Calendar
      const events = await this._getGoogleCalendarEvents(calendar, start, end);
      
      // Process database slots and Google events
      const syncResults = await this._processSyncOperations(
        doctor, calendar, dbSlots, events, userId, session
      );
      
      // Create audit log
      await this._createSyncAuditLog(userId, doctorId, start, end, syncResults, session);
      
      // Commit the transaction
      await session.commitTransaction();
      
      return syncResults;
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      console.error('Sync with Google Calendar error:', error);
      throw new Error(`Failed to sync with Google Calendar: ${error.message}`);
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Get doctor for sync operation
   * @param {string} doctorId - Doctor ID
   * @returns {Object} Doctor
   * @private
   */
  async _getDoctorForSync(doctorId) {
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      throw new Error('Doctor not found');
    }
    return doctor;
  }
  
  /**
   * Get standardized date range for sync
   * @param {Date} startDate - Start date (optional)
   * @param {Date} endDate - End date (optional)
   * @returns {Object} Standardized start and end dates
   * @private
   */
  _getDateRange(startDate, endDate) {
    // Default to current date if not provided
    const start = startDate || new Date();
    
    // Default to 7 days from start date if not provided
    const end = endDate || new Date(new Date(start).setDate(start.getDate() + 7));
    
    return { start, end };
  }
  
  /**
   * Get time slots from database
   * @param {string} doctorId - Doctor ID
   * @param {Date} start - Start date
   * @param {Date} end - End date
   * @returns {Array} Time slots
   * @private
   */
  async _getTimeSlots(doctorId, start, end) {
    return await TimeSlot.find({
      doctorId,
      date: { $gte: start, $lte: end }
    });
  }
  
  /**
   * Get events from Google Calendar
   * @param {Object} calendar - Google Calendar client
   * @param {Date} start - Start date
   * @param {Date} end - End date
   * @returns {Object} Events response and mapped by ID
   * @private
   */
  async _getGoogleCalendarEvents(calendar, start, end) {
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    });
    
    // Create a map of event IDs to events for easy lookup
    const eventMap = {};
    response.data.items.forEach(event => {
      eventMap[event.id] = event;
    });
    
    return { response, eventMap };
  }
  
  /**
   * Process sync operations between database slots and Google events
   * @param {Object} doctor - Doctor object
   * @param {Object} calendar - Google Calendar client
   * @param {Array} dbSlots - Database time slots
   * @param {Object} events - Google Calendar events data
   * @param {string} userId - User ID
   * @param {Object} session - MongoDB session
   * @returns {Object} Sync results
   * @private
   */
  async _processSyncOperations(doctor, calendar, dbSlots, events, userId, session) {
    const { response, eventMap } = events;
    
    const syncResults = {
      created: 0,
      updated: 0,
      deleted: 0,
      errors: 0,
      details: []
    };
    
    // First, process slots from the database
    await this._processDbSlots(doctor, calendar, dbSlots, eventMap, syncResults, session);
    
    // Then, process remaining events from Google Calendar
    await this._processGoogleEvents(doctor, eventMap, syncResults, session);
    
    return syncResults;
  }
  
  /**
   * Process database slots for sync
   * @param {Object} doctor - Doctor object
   * @param {Object} calendar - Google Calendar client
   * @param {Array} dbSlots - Database time slots
   * @param {Object} eventMap - Map of Google event IDs to events
   * @param {Object} syncResults - Results object to update
   * @param {Object} session - MongoDB session
   * @private
   */
  async _processDbSlots(doctor, calendar, dbSlots, eventMap, syncResults, session) {
    for (const slot of dbSlots) {
      try {
        // If slot has a Google Calendar event ID, update the event
        if (slot.googleEventId && eventMap[slot.googleEventId]) {
          // Update event in Google Calendar if needed
          // You could check if the event times match the slot times first
          
          // Mark this event as processed
          delete eventMap[slot.googleEventId];
        } 
        // If slot has no Google Calendar event ID, create a new event
        else if (!slot.googleEventId) {
          await this._createGoogleEvent(doctor, slot, calendar, syncResults, session);
        }
      } catch (slotError) {
        console.error('Sync slot error:', slotError);
        syncResults.errors++;
        syncResults.details.push({
          slotId: slot._id,
          status: 'error',
          error: slotError.message
        });
      }
    }
  }
  
  /**
   * Create a Google Calendar event for a time slot
   * @param {Object} doctor - Doctor object
   * @param {Object} slot - Time slot
   * @param {Object} calendar - Google Calendar client
   * @param {Object} syncResults - Results object to update
   * @param {Object} session - MongoDB session
   * @private
   */
  async _createGoogleEvent(doctor, slot, calendar, syncResults, session) {
    // Create event date objects
    const eventDate = new Date(slot.date);
    
    // Parse start and end times
    const [startHour, startMinute] = slot.startTime.split(':').map(Number);
    const [endHour, endMinute] = slot.endTime.split(':').map(Number);
    
    // Set event start and end times
    const eventStart = new Date(eventDate);
    eventStart.setHours(startHour, startMinute, 0, 0);
    
    const eventEnd = new Date(eventDate);
    eventEnd.setHours(endHour, endMinute, 0, 0);
    
    // Get doctor's user info for name
    const doctorUser = await User.findById(doctor.userId);
    const doctorName = doctorUser ? 
      `Dr. ${doctorUser.firstName} ${doctorUser.lastName}` : 
      `Dr. CareSync Provider`;
      
    // Create event in Google Calendar
    const event = await calendar.events.insert({
      calendarId: 'primary',
      resource: {
        summary: `Available: ${doctorName}`,
        description: 'Automatically created by CareSync Availability Management System',
        start: {
          dateTime: eventStart.toISOString(),
          timeZone: 'UTC'
        },
        end: {
          dateTime: eventEnd.toISOString(),
          timeZone: 'UTC'
        },
        colorId: '2', // Green
        transparency: 'transparent' // Do not block time
      }
    });
    
    // Update slot with Google Calendar event ID
    await TimeSlot.findByIdAndUpdate(slot._id, {
      googleEventId: event.data.id
    }, { session });
    
    syncResults.created++;
    syncResults.details.push({
      slotId: slot._id,
      status: 'created',
      eventId: event.data.id
    });
  }
  
  /**
   * Process Google Calendar events for sync
   * @param {Object} doctor - Doctor object
   * @param {Object} eventMap - Map of Google event IDs to events
   * @param {Object} syncResults - Results object to update
   * @param {Object} session - MongoDB session
   * @private
   */
  async _processGoogleEvents(doctor, eventMap, syncResults, session) {
    for (const eventId in eventMap) {
      try {
        const event = eventMap[eventId];
        
        // Skip all-day events
        if (!event.start.dateTime || !event.end.dateTime) {
          continue;
        }
        
        // Extract date and times
        const eventStart = new Date(event.start.dateTime);
        const eventEnd = new Date(event.end.dateTime);
        
        // Skip events on different days (crossing midnight)
        if (eventStart.getDate() !== eventEnd.getDate() ||
            eventStart.getMonth() !== eventEnd.getMonth() ||
            eventStart.getFullYear() !== eventEnd.getFullYear()) {
          continue;
        }
        
        // Check if this is an availability event
        const isAvailabilityEvent = this._isAvailabilityEvent(event);
        
        if (isAvailabilityEvent) {
          await this._createTimeSlotFromEvent(doctor._id, event, syncResults, session);
        }
      } catch (eventError) {
        console.error('Sync event error:', eventError);
        syncResults.errors++;
        syncResults.details.push({
          eventId,
          status: 'error',
          error: eventError.message
        });
      }
    }
  }
  
  /**
   * Check if a Google Calendar event is an availability event
   * @param {Object} event - Google Calendar event
   * @returns {boolean} Is an availability event
   * @private
   */
  _isAvailabilityEvent(event) {
    return event.summary && 
           (event.summary.includes('Available') || 
            event.summary.includes('CareSync'));
  }
  
  /**
   * Create a time slot from a Google Calendar event
   * @param {string} doctorId - Doctor ID
   * @param {Object} event - Google Calendar event
   * @param {Object} syncResults - Results object to update
   * @param {Object} session - MongoDB session
   * @private
   */
  async _createTimeSlotFromEvent(doctorId, event, syncResults, session) {
    // Extract date and times
    const eventStart = new Date(event.start.dateTime);
    const eventEnd = new Date(event.end.dateTime);
    
    // Format times as HH:MM
    const startTime = 
      `${String(eventStart.getHours()).padStart(2, '0')}:${String(eventStart.getMinutes()).padStart(2, '0')}`;
    
    const endTime = 
      `${String(eventEnd.getHours()).padStart(2, '0')}:${String(eventEnd.getMinutes()).padStart(2, '0')}`;
    
    // Create a new time slot in the database
    const newSlot = await TimeSlot.create([{
      doctorId,
      date: new Date(eventStart.setHours(0, 0, 0, 0)),
      startTime,
      endTime,
      status: 'available',
      googleEventId: event.id
    }], { session });
    
    syncResults.created++;
    syncResults.details.push({
      slotId: newSlot[0]._id,
      status: 'imported',
      eventId: event.id
    });
  }
  
  /**
   * Create audit log for sync operation
   * @param {string} userId - User ID
   * @param {string} doctorId - Doctor ID
   * @param {Date} start - Start date
   * @param {Date} end - End date
   * @param {Object} syncResults - Sync results
   * @param {Object} session - MongoDB session
   * @private
   */
  async _createSyncAuditLog(userId, doctorId, start, end, syncResults, session) {
    await AuditLog.create([{
      userId: userId || doctorId,
      action: 'sync',
      resource: 'timeslot',
      details: {
        doctorId,
        startDate: start,
        endDate: end,
        service: 'googleCalendar',
        created: syncResults.created,
        updated: syncResults.updated,
        deleted: syncResults.deleted,
        errors: syncResults.errors
      }
    }], { session });
  }

  /**
   * Convert time string (HH:MM) to minutes since midnight
   * @param {string} timeString - Time string in HH:MM format
   * @returns {number} Minutes since midnight
   * @private
   */
  _timeToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Generate standard time slots with fixed schedule (9am-12pm and 1pm-5pm)
   * @param {string} doctorId - Doctor ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {string} userId - User generating the slots
   * @returns {Array} Generated time slots
   */
  async generateStandardTimeSlots(doctorId, startDate, endDate, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    console.log(`[generateStandardTimeSlots] Transaction started for doctor ${doctorId}`);
    
    try {
      const doctor = await Doctor.findById(doctorId);
      if (!doctor) {
        throw new Error('Doctor not found');
      }
      
      const start = startDate || new Date();
      const end = endDate || new Date(start);
      console.log(`[generateStandardTimeSlots] Date range: ${start.toISOString()} to ${end.toISOString()}`);
      
      // --- Deletion Phase ---
      console.log(`[generateStandardTimeSlots] Starting deletion phase...`);
      for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
        // Calculate start and end of the target day in UTC
        const targetDayStart = new Date(day);
        targetDayStart.setUTCHours(0, 0, 0, 0); // Start of the day in UTC

        const nextDayStart = new Date(targetDayStart);
        nextDayStart.setUTCDate(targetDayStart.getUTCDate() + 1); // Start of the next day in UTC

        console.log(`[generateStandardTimeSlots] Processing deletion for date range: ${targetDayStart.toISOString()} to ${nextDayStart.toISOString()}`);
          
        // Query for slots within the entire day
        const deleteQuery = {
          doctorId,
          date: {
            $gte: targetDayStart,
            $lt: nextDayStart
          }
        };
        console.log(`[generateStandardTimeSlots] Delete query (deleting ALL slots for the day range):`, JSON.stringify(deleteQuery));

        const deleteResult = await TimeSlot.deleteMany(deleteQuery, { session });
        console.log(`[generateStandardTimeSlots] Deletion result for ${targetDayStart.toISOString().split('T')[0]}:`, deleteResult);

        if (deleteResult.deletedCount > 0) {
          await AuditLog.create([{
            userId: userId || doctorId,
            action: 'delete',
            resource: 'timeslot',
            details: {
            doctorId,
              date: targetDayStart.toISOString().split('T')[0], // Log the date string
              count: deleteResult.deletedCount,
              reason: 'regenerate-slots-delete-all'
            }
            }], { session });
          console.log(`[generateStandardTimeSlots] Audit log created for deletion of ${deleteResult.deletedCount} slots.`);
        }
      }
      console.log(`[generateStandardTimeSlots] Deletion phase completed.`);

      // --- Creation Phase ---
      console.log(`[generateStandardTimeSlots] Starting creation phase...`);
      const generatedSlots = [];
      const appointmentDuration = 20;

      for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
        const currentDate = new Date(day);
        const dateForOverlapCheck = new Date(day).setHours(0, 0, 0, 0); // Normalized date for overlap query
        console.log(`[generateStandardTimeSlots] Generating slots for date: ${currentDate.toISOString()}`);

        const timeRanges = [
          { startHour: 9, endHour: 12 }, // Morning
          { startHour: 13, endHour: 17 } // Afternoon
        ];

        for (const range of timeRanges) {
          let slotStart = new Date(currentDate);
          slotStart.setHours(range.startHour, 0, 0, 0);
          const rangeEnd = new Date(currentDate);
          rangeEnd.setHours(range.endHour, 0, 0, 0);
        
          console.log(`[generateStandardTimeSlots] Processing range ${range.startHour}:00 to ${range.endHour}:00`);

          while (slotStart.getTime() + appointmentDuration * 60000 <= rangeEnd.getTime()) {
          const slotEndTime = new Date(slotStart.getTime() + appointmentDuration * 60000);
            const formattedStartTime = `${String(slotStart.getHours()).padStart(2, '0')}:${String(slotStart.getMinutes()).padStart(2, '0')}`;
            const formattedEndTime = `${String(slotEndTime.getHours()).padStart(2, '0')}:${String(slotEndTime.getMinutes()).padStart(2, '0')}`;
          
            // Check overlap ONLY against BOOKED slots
            const bookedOverlapQuery = {
            doctorId,
              date: dateForOverlapCheck,
              status: 'booked',
              $or: [
                { startTime: { $gte: formattedStartTime, $lt: formattedEndTime } }
              ]
            };
            // console.log(`[generateStandardTimeSlots] Checking booked overlap for ${formattedStartTime}-${formattedEndTime} with query:`, JSON.stringify(bookedOverlapQuery));
            const bookedOverlappingSlot = await TimeSlot.findOne(bookedOverlapQuery).session(session);

            if (!bookedOverlappingSlot) {
              console.log(`[generateStandardTimeSlots] Creating slot: ${formattedStartTime} - ${formattedEndTime}`);
              const newSlotData = {
              doctorId,
                date: new Date(currentDate), // Use the non-normalized date for storage
              startTime: formattedStartTime,
              endTime: formattedEndTime,
              status: 'available'
              };
              const newSlotResult = await TimeSlot.create([newSlotData], { session });
              if (newSlotResult && newSlotResult.length > 0) {
                generatedSlots.push(newSlotResult[0]);
                console.log(`[generateStandardTimeSlots] Slot created successfully: ID ${newSlotResult[0]._id}`);
              } else {
                console.error(`[generateStandardTimeSlots] Failed to create slot for ${formattedStartTime}-${formattedEndTime}`);
              }
            } else {
              console.log(`[generateStandardTimeSlots] Skipping slot ${formattedStartTime}-${formattedEndTime} due to overlap with booked slot ID: ${bookedOverlappingSlot._id}`);
            }
          slotStart.setTime(slotStart.getTime() + appointmentDuration * 60000);
        }
      }
      }
      console.log(`[generateStandardTimeSlots] Creation phase completed. ${generatedSlots.length} slots generated.`);
      
      // --- Audit Log for Creation ---
      if (generatedSlots.length > 0) {
      await AuditLog.create([{
        userId: userId || doctorId,
        action: 'create',
        resource: 'timeslot',
        details: {
          doctorId,
          startDate: start,
          endDate: end,
            slotsGenerated: generatedSlots.length,
            reason: 'regenerate-slots'
        }
      }], { session });
        console.log(`[generateStandardTimeSlots] Audit log created for generation of ${generatedSlots.length} slots.`);
      }
      
      // --- Commit ---
      console.log(`[generateStandardTimeSlots] Attempting to commit transaction...`);
      await session.commitTransaction();
      console.log(`[generateStandardTimeSlots] Transaction committed successfully.`);
      
      const plainGeneratedSlots = generatedSlots.map(slot => slot.toObject());
      return plainGeneratedSlots;
    } catch (error) {
      console.error(`[generateStandardTimeSlots] Error occurred: ${error.message}. Aborting transaction.`);
      await session.abortTransaction();
      console.error('Generate time slots error details:', error);
      throw new Error(`Failed to generate time slots: ${error.message}`);
    } finally {
      console.log(`[generateStandardTimeSlots] Ending session.`);
      session.endSession();
    }
  }
}

// Create a singleton instance
const availabilityService = new AvailabilityService();

export default availabilityService;