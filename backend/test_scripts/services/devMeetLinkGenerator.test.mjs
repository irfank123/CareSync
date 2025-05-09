import crypto from 'crypto';
// The service itself will be imported after mocks are set up.

// Mock crypto
const mockRandomBytes = jest.fn();
const mockRandomUUID = jest.fn();
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'), // Import and retain default behavior
  randomBytes: (size) => mockRandomBytes(size),
  randomUUID: () => mockRandomUUID(),
}));

// Mock Appointment model
const mockAppointmentFindByIdAndUpdate = jest.fn();
jest.mock('../../src/models/Appointment.mjs', () => ({
  findByIdAndUpdate: mockAppointmentFindByIdAndUpdate,
}));

// Now, import the service (it's a singleton)
import devMeetLinkGeneratorInstance from '../../src/services/devMeetLinkGenerator.mjs';

describe('DevMeetLinkGenerator', () => {
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    // Reset mocks before each test
    mockRandomBytes.mockReset();
    mockRandomUUID.mockReset();
    mockAppointmentFindByIdAndUpdate.mockReset();

    // Spy on console.log and console.error
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Default mock implementations
    // crypto.randomBytes(5).toString('hex') -> 'aabbccddeeff' (10 chars used)
    mockRandomBytes.mockReturnValue({ toString: () => 'aabbccddeeff112233' }); 
    mockRandomUUID.mockReturnValue('test-uuid-12345');
  });

  afterEach(() => {
    // Restore console spies
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('generateMeetLink', () => {
    test('should generate a formatted fake Google Meet link', () => {
      mockRandomBytes.mockReturnValue({ toString: () => 'abcdef1234' }); // 10 chars
      const link = devMeetLinkGeneratorInstance.generateMeetLink();
      expect(mockRandomBytes).toHaveBeenCalledWith(5);
      expect(link).toMatch(new RegExp('^https://meet\\.google\\.com/[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}$'));
      expect(link).toBe('https://meet.google.com/abc-def1-234');
    });

    test('should use different random codes for different links', () => {
      mockRandomBytes.mockReturnValueOnce({ toString: () => 'abcdef1234' });
      const link1 = devMeetLinkGeneratorInstance.generateMeetLink();
      expect(link1).toBe('https://meet.google.com/abc-def1-234');

      mockRandomBytes.mockReturnValueOnce({ toString: () => '567890ghij' });
      const link2 = devMeetLinkGeneratorInstance.generateMeetLink();
      expect(link2).toBe('https://meet.google.com/567-890g-hij');
      
      expect(mockRandomBytes).toHaveBeenCalledTimes(2);
    });
  });

  describe('createMeetingForAppointment', () => {
    const userId = 'user-123';
    const appointmentId = 'appt-456';
    const expectedMeetLink = 'https://meet.google.com/aab-bccd-dee'; // from 'aabbccddeeff'
    const expectedEventId = 'dev_test-uuid-12345';

    test('should create a fake meeting and update appointment successfully', async () => {
      mockAppointmentFindByIdAndUpdate.mockResolvedValue({ _id: appointmentId }); // Simulate success

      const result = await devMeetLinkGeneratorInstance.createMeetingForAppointment(userId, appointmentId);

      expect(consoleLogSpy).toHaveBeenCalledWith(`DEV MODE: Creating fake meeting for appointment ${appointmentId}`);
      expect(mockRandomBytes).toHaveBeenCalledWith(5); // For generateMeetLink
      expect(mockRandomUUID).toHaveBeenCalled();      // For eventId
      
      expect(mockAppointmentFindByIdAndUpdate).toHaveBeenCalledWith(appointmentId, {
        googleMeetLink: expectedMeetLink,
        googleEventId: expectedEventId,
        videoConferenceLink: expectedMeetLink,
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(`DEV MODE: Created fake meeting link: ${expectedMeetLink}`);
      expect(result).toEqual({
        success: true,
        meetLink: expectedMeetLink,
        eventId: expectedEventId,
        event: {
          id: expectedEventId,
          hangoutLink: expectedMeetLink,
          summary: "DEV MODE: Fake Google Meet Event",
        },
      });
    });

    test('should throw an error if Appointment.findByIdAndUpdate fails', async () => {
      const dbError = new Error('DB update failed');
      mockAppointmentFindByIdAndUpdate.mockRejectedValue(dbError);

      await expect(
        devMeetLinkGeneratorInstance.createMeetingForAppointment(userId, appointmentId)
      ).rejects.toThrow('Failed to create fake meet link: DB update failed');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in dev mode creating fake meet link:', dbError);
    });
  });

  describe('updateMeetingForAppointment', () => {
    // Since it directly calls createMeetingForAppointment, we can test it similarly
    // or trust that createMeetingForAppointment is well-tested.
    // For completeness, a basic test ensuring it behaves like create.
    const userId = 'user-789';
    const appointmentId = 'appt-012';
    const expectedMeetLink = 'https://meet.google.com/aab-bccd-dee';
    const expectedEventId = 'dev_test-uuid-12345';

    test('should effectively create/update a fake meeting', async () => {
      mockAppointmentFindByIdAndUpdate.mockResolvedValue({ _id: appointmentId });

      const result = await devMeetLinkGeneratorInstance.updateMeetingForAppointment(userId, appointmentId);

      expect(mockAppointmentFindByIdAndUpdate).toHaveBeenCalledWith(appointmentId, {
        googleMeetLink: expectedMeetLink,
        googleEventId: expectedEventId,
        videoConferenceLink: expectedMeetLink,
      });
      expect(result.success).toBe(true);
      expect(result.meetLink).toBe(expectedMeetLink);
    });
  });

  describe('deleteMeetingForAppointment', () => {
    const userId = 'user-del-123';
    const appointmentId = 'appt-del-456';

    test('should simulate deleting a meeting and update appointment successfully', async () => {
      mockAppointmentFindByIdAndUpdate.mockResolvedValue({ _id: appointmentId }); // Simulate success

      const result = await devMeetLinkGeneratorInstance.deleteMeetingForAppointment(userId, appointmentId);

      expect(consoleLogSpy).toHaveBeenCalledWith(`DEV MODE: Deleting fake meeting for appointment ${appointmentId}`);
      expect(mockAppointmentFindByIdAndUpdate).toHaveBeenCalledWith(appointmentId, {
        googleMeetLink: null,
        googleEventId: null,
        videoConferenceLink: null,
      });
      expect(result).toEqual({
        success: true,
        message: 'DEV MODE: Fake Google meeting deleted successfully',
      });
    });

    test('should throw an error if Appointment.findByIdAndUpdate fails during delete', async () => {
      const dbError = new Error('DB update failed during delete');
      mockAppointmentFindByIdAndUpdate.mockRejectedValue(dbError);

      await expect(
        devMeetLinkGeneratorInstance.deleteMeetingForAppointment(userId, appointmentId)
      ).rejects.toThrow('Failed to delete fake meet link: DB update failed during delete');
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in dev mode deleting fake meet link:', dbError);
    });
  });
}); 