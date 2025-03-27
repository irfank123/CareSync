// import React from 'react';

// const AppointmentBooking = () => {
//   return (
//     <div>
//       <h2>AppointmentBooking Component</h2>
//       <p>This component will be implemented in a future sprint.</p>
//     </div>
//   );
// };

// export default AppointmentBooking;


import React, { useState } from 'react';

const AppointmentScheduling = () => {
  const [currentStep, setCurrentStep] = useState(3); // Date & Time step
  const [selectedSlot, setSelectedSlot] = useState('11:00 AM - 11:30 AM');
  const [selectedDate, setSelectedDate] = useState(24); // 24th day selected
  
  // Mock data for available time slots
  const availableSlots = [
    { id: 1, time: '9:00 AM - 9:30 AM', available: true },
    { id: 2, time: '10:30 AM - 11:00 AM', available: true },
    { id: 3, time: '11:00 AM - 11:30 AM', available: true, selected: true },
    { id: 4, time: '2:00 PM - 2:30 PM', available: true },
    { id: 5, time: '3:30 PM - 4:00 PM', available: true },
  ];

  // Generate calendar days for March 2025
  const generateCalendarDays = () => {
    const days = [];
    // Starting with the last few days of February (for display purposes)
    for (let i = 23; i <= 29; i++) {
      days.push({ day: i, month: 'Feb', date: new Date(2025, 1, i) });
    }
    
    // March days
    for (let i = 1; i <= 29; i++) {
      days.push({ day: i, month: 'Mar', date: new Date(2025, 2, i) });
    }
    
    return days;
  };

  const calendarDays = generateCalendarDays();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const goToNextStep = () => {
    setCurrentStep(currentStep + 1);
  };

  const goToPreviousStep = () => {
    setCurrentStep(currentStep - 1);
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      <div className="bg-blue-500 text-white p-4">
        <h1 className="text-xl font-bold">Patient Appointment Scheduling</h1>
      </div>

      <div className="max-w-4xl mx-auto mt-6 bg-white rounded-lg shadow-md overflow-hidden">
        {/* Progress Steps */}
        <div className="flex justify-between">
          <div 
            className={`flex-1 text-center py-3 ${currentStep >= 1 ? 'bg-green-100' : ''}`}
          >
            1. Appointment Type
          </div>
          <div 
            className={`flex-1 text-center py-3 ${currentStep >= 2 ? 'bg-green-100' : ''}`}
          >
            2. Select Doctor
          </div>
          <div 
            className={`flex-1 text-center py-3 ${currentStep >= 3 ? 'bg-blue-500 text-white' : ''}`}
          >
            3. Date & Time
          </div>
          <div 
            className={`flex-1 text-center py-3 ${currentStep >= 4 ? 'bg-green-100' : ''}`}
          >
            4. Preliminary Checkup
          </div>
          <div 
            className={`flex-1 text-center py-3 ${currentStep >= 5 ? 'bg-green-100' : ''}`}
          >
            5. Confirmation
          </div>
        </div>

        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Select Date & Time</h2>
          <p className="mb-6 text-gray-600">Please select a date and time for your virtual consultation with Dr. Smith</p>

          <div className="flex flex-col md:flex-row md:space-x-6">
            {/* Calendar */}
            <div className="md:w-2/3 mb-6 md:mb-0">
              <div className="flex justify-between items-center mb-4">
                <button className="px-3 py-1 bg-gray-200 rounded text-gray-700">← Previous</button>
                <h3 className="font-medium">March 2025</h3>
                <button className="px-3 py-1 bg-gray-200 rounded text-gray-700">Next →</button>
              </div>

              <div className="border rounded">
                {/* Week days header */}
                <div className="grid grid-cols-7 border-b">
                  {weekDays.map(day => (
                    <div key={day} className="text-center py-2 font-medium text-sm">{day}</div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7">
                  {calendarDays.map((dayInfo, index) => {
                    const isCurrentMonth = dayInfo.month === 'Mar';
                    const isSelected = isCurrentMonth && dayInfo.day === selectedDate;
                    
                    return (
                      <div
                        key={index}
                        onClick={() => isCurrentMonth && setSelectedDate(dayInfo.day)}
                        className={`
                          h-10 flex items-center justify-center border-t border-r
                          ${index % 7 === 0 ? 'border-l' : ''}
                          ${!isCurrentMonth ? 'text-gray-400 bg-gray-50' : 'cursor-pointer hover:bg-blue-50'}
                          ${isSelected ? 'bg-blue-100 font-bold' : ''}
                        `}
                      >
                        {dayInfo.day}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Time slots */}
            <div className="md:w-1/3">
              <h3 className="font-medium mb-3">Available Time Slots for March {selectedDate}, 2025</h3>
              <div className="space-y-3">
                {availableSlots.map(slot => (
                  <div key={slot.id} className="flex justify-between items-center">
                    <span className="text-gray-700">{slot.time}</span>
                    <button
                      onClick={() => setSelectedSlot(slot.time)}
                      className={`px-3 py-1 rounded text-white text-sm ${
                        slot.time === selectedSlot ? 'bg-green-600' : 'bg-blue-500'
                      }`}
                    >
                      {slot.time === selectedSlot ? 'Selected' : 'Select'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-between">
            <button 
              onClick={goToPreviousStep}
              className="px-4 py-2 bg-gray-300 rounded"
            >
              Back
            </button>
            <button 
              onClick={goToNextStep}
              className="px-4 py-2 bg-blue-500 text-white rounded"
            >
              Continue to Preliminary Checkup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentScheduling;