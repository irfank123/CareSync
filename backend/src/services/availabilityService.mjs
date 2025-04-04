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
      }).sort({ date: 1, startTime: 1 });
      
      return timeSlots;
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
      // Default to current date if not provided
      const start = startDate || new Date();
      
      // Default to 7 days from start date if not provided
      const end = endDate || new Date(new Date(start).setDate(start.getDate() + 7));
      
      // Get existing time slots with status 'available'
      const timeSlots = await TimeSlot.find({
        doctorId,
        date: { $gte: start, $lte: end },
        status: 'available'
      }).sort({ date: 1, startTime: 1 });
      
      return timeSlots;
    } catch (error) {
      console.error('Get available time slots error:', error);
      throw new Error('Failed to retrieve available time slots');
    }
  }

  /**
   * Get a specific time slot by ID
   * @param {string} slotId - Time slot ID
   * @returns {Object} Time slot
   */
  async getTimeSlotById(slotId) {
    try {
      return await TimeSlot.findById(slotId);
    } catch (error) {
      console.error('Get time slot by ID error:', error);
      throw new Error('Failed to retrieve time slot');
    }
  }

  /**
   * Create a new time slot for a doctor
   * @param {Object} slotData - Time slot data
   * @returns {Object} Created time slot
   */
  async createTimeSlot(slotData) {
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
      
      // Check for existing overlapping time slots
      const overlappingSlot = await this.checkOverlappingTimeSlots(
        slotData.doctorId,
        slotData.date,
        slotData.startTime,
        slotData.endTime
      );
      
      if (overlappingSlot) {
        throw new Error('Time slot overlaps with an existing slot');
      }
      
      // Create the time slot
      const timeSlot = await TimeSlot.create({
        doctorId: slotData.doctorId,
        date: slotData.date,
        startTime: slotData.startTime,
        endTime: slotData.endTime,
        status: slotData.status || 'available'
      });
      
      // Create audit log
      await AuditLog.create({
        userId: slotData.createdBy || slotData.doctorId,
        action: 'create',
        resource: 'timeslot',
        resourceId: timeSlot._id,
        details: {
          doctorId: slotData.doctorId,
          date: slotData.date,
          startTime: slotData.startTime,
          endTime: slotData.endTime,
          status: timeSlot.status
        }
      });
      
      return timeSlot;
    } catch (error) {
      console.error('Create time slot error:', error);
      throw new Error(`Failed to create time slot: ${error.message}`);
    }
  }

  /**
   * Update a time slot
   * @param {string} slotId - Time slot ID
   * @param {Object} updateData - Data to update
   * @param {string} userId - User making the update
   * @returns {Object} Updated time slot
   */
  async updateTimeSlot(slotId, updateData, userId) {
    try {
      // Find the time slot
      const timeSlot = await TimeSlot.findById(slotId);
      if (!timeSlot) {
        throw new Error('Time slot not found');
      }
      
      // If updating time or date, check for overlaps
      if ((updateData.startTime && updateData.startTime !== timeSlot.startTime) ||
          (updateData.endTime && updateData.endTime !== timeSlot.endTime) ||
          (updateData.date && updateData.date.toString() !== timeSlot.date.toString())) {
            
        const overlappingSlot = await this.checkOverlappingTimeSlots(
          timeSlot.doctorId,
          updateData.date || timeSlot.date,
          updateData.startTime || timeSlot.startTime,
          updateData.endTime || timeSlot.endTime,
          slotId
        );
        
        if (overlappingSlot) {
          throw new Error('Updated time slot would overlap with an existing slot');
        }
      }
      
      // Check if the slot is already booked but trying to change the time
      if (timeSlot.status === 'booked' && 
          (updateData.startTime || updateData.endTime || updateData.date)) {
        throw new Error('Cannot change time or date of a booked slot');
      }
      
      // Update the time slot
      const updatedSlot = await TimeSlot.findByIdAndUpdate(
        slotId,
        { $set: updateData },
        { new: true, runValidators: true }
      );
      
      // Create audit log
      await AuditLog.create({
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
      });
      
      return updatedSlot;
    } catch (error) {
      console.error('Update time slot error:', error);
      throw new Error(`Failed to update time slot: ${error.message}`);
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
      // Get doctor and their availability schedule
      const doctor = await Doctor.findById(doctorId);
      if (!doctor) {
        throw new Error('Doctor not found');
      }
      
      // Default to current date if not provided
      const start = startDate || new Date();
      
      // Default to 30 days from start date if not provided
      const end = endDate || new Date(new Date(start).setDate(start.getDate() + 30));
      
      // Validate schedule exists
      if (!doctor.availabilitySchedule || doctor.availabilitySchedule.length === 0) {
        throw new Error('Doctor has no availability schedule defined');
      }
      
      const generatedSlots = [];
      
      // Get appointment duration for the doctor (default to 30 minutes if not set)
      const appointmentDuration = doctor.appointmentDuration || 30;
      
      // Loop through each day in the date range
      for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
        const currentDate = new Date(day);
        const dayOfWeek = currentDate.getDay(); // 0-6 (Sunday-Saturday)
        
        // Find the schedule for this day of week
        const daySchedule = doctor.availabilitySchedule.find(
          schedule => schedule.dayOfWeek === dayOfWeek && schedule.isAvailable
        );
        
        // Skip if no schedule for this day or not available
        if (!daySchedule) continue;
        
        // Check if this is a vacation day
        const isVacationDay = doctor.vacationDays && doctor.vacationDays.some(
          vacation => 
            vacation.date.getFullYear() === currentDate.getFullYear() &&
            vacation.date.getMonth() === currentDate.getMonth() &&
            vacation.date.getDate() === currentDate.getDate() &&
            !vacation.isWorkDay
        );
        
        // Skip if vacation day
        if (isVacationDay) continue;
        
        // Parse start and end times
        const [startHour, startMinute] = daySchedule.startTime.split(':').map(Number);
        const [endHour, endMinute] = daySchedule.endTime.split(':').map(Number);
        
        // Set slot start and end times
        const slotStart = new Date(currentDate);
        slotStart.setHours(startHour, startMinute, 0, 0);
        
        const slotEnd = new Date(currentDate);
        slotEnd.setHours(endHour, endMinute, 0, 0);
        
        // Generate slots while slot end time is before the end of day
        while (slotStart.getTime() + appointmentDuration * 60000 <= slotEnd.getTime()) {
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
    
    // Create query to find overlapping slots
    const query = {
      doctorId,
      date: dateToCheck
    };
    
    // Exclude the current slot ID if provided (for updates)
    if (excludeSlotId) {
      query._id = { $ne: excludeSlotId };
    }
    
    // Find all slots for this doctor on this date
    const slotsOnDate = await TimeSlot.find(query);
    
    // Check each slot for overlap
    for (const slot of slotsOnDate) {
      const slotStartMinutes = this._timeToMinutes(slot.startTime);
      const slotEndMinutes = this._timeToMinutes(slot.endTime);
      
      // Check for overlap
      if (
        // New slot starts during existing slot
        (startTimeMinutes >= slotStartMinutes && startTimeMinutes < slotEndMinutes) ||
        // New slot ends during existing slot
        (endTimeMinutes > slotStartMinutes && endTimeMinutes <= slotEndMinutes) ||
        // New slot completely contains existing slot
        (startTimeMinutes <= slotStartMinutes && endTimeMinutes >= slotEndMinutes)
      ) {
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
      const doctor = await Doctor.findById(doctorId);
      if (!doctor) {
        throw new Error('Doctor not found');
      }
      
      // Set up Google Calendar client
      const calendar = await this._setupGoogleCalendarClient(refreshToken);
      
      // Default to current date if not provided
      const start = startDate || new Date();
      
      // Default to 7 days from start date if not provided
      const end = endDate || new Date(new Date(start).setDate(start.getDate() + 7));
      
      // Get time slots from database
      const dbSlots = await TimeSlot.find({
        doctorId,
        date: { $gte: start, $lte: end }
      });
      
      // Get events from Google Calendar
      const events = await calendar.events.list({
        calendarId: 'primary',
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      });
      
      const syncResults = {
        created: 0,
        updated: 0,
        deleted: 0,
        errors: 0,
        details: []
      };
      
      // Map of Google Calendar event IDs to events
      const eventMap = {};
      events.data.items.forEach(event => {
        eventMap[event.id] = event;
      });
      
      // First, process slots from the database
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
      
      // Then, process remaining events from Google Calendar
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
          
          // Format times as HH:MM
          const startTime = 
            `${String(eventStart.getHours()).padStart(2, '0')}:${String(eventStart.getMinutes()).padStart(2, '0')}`;
          
          const endTime = 
            `${String(eventEnd.getHours()).padStart(2, '0')}:${String(eventEnd.getMinutes()).padStart(2, '0')}`;
          
          // Check for availability in the calendar
          const isAvailabilityEvent = event.summary && 
                                    (event.summary.includes('Available') || 
                                     event.summary.includes('CareSync'));
          
          if (isAvailabilityEvent) {
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
      
      // Create audit log
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
   * Convert time string (HH:MM) to minutes since midnight
   * @param {string} timeString - Time string in HH:MM format
   * @returns {number} Minutes since midnight
   * @private
   */
  _timeToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }
}

// Create a singleton instance
const availabilityService = new AvailabilityService();

export default availabilityService;