// import React from 'react';

// const AvailabilityCalendar = () => {
//   return (
//     <div>
//       <h2>AvailabilityCalendar Component</h2>
//       <p>This component will be implemented in a future sprint.</p>
//     </div>
//   );
// };

// export default AvailabilityCalendar;



import React, { useState } from 'react';

const DoctorDashboard = () => {
  const [currentDate, setCurrentDate] = useState(new Date(2025, 2, 23)); // March 23, 2025
  const [selectedDate, setSelectedDate] = useState(23); // 23rd day selected

  // Mock availability data
  const timeSlots = [
    { id: 1, time: '9:00 AM - 9:30 AM', status: 'available' },
    { id: 2, time: '9:30 AM - 10:00 AM', status: 'booked' },
    { id: 3, time: '10:00 AM - 10:30 AM', status: 'booked' },
    { id: 4, time: '10:30 AM - 11:00 AM', status: 'available' },
    { id: 5, time: '11:00 AM - 11:30 AM', status: 'available' },
    { id: 6, time: '11:30 AM - 12:00 PM', status: 'available' },
  ];

  // Mock upcoming appointments
  const appointments = [
    { id: 1, patientName: 'John Smith', type: 'Virtual Consultation', time: 'Today, 9:30 AM - 10:00 AM' },
    { id: 2, patientName: 'Emily Johnson', type: 'Follow-up Appointment', time: 'Today, 10:00 AM - 10:30 AM' },
    { id: 3, patientName: 'Michael Brown', type: 'Initial Consultation', time: 'Tomorrow, 11:00 AM - 11:30 AM' },
  ];

  // Generate calendar days
  const generateCalendarDays = () => {
    const days = [];
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    
    // Previous month days
    for (let i = 0; i < firstDay; i++) {
      const prevMonthDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0).getDate() - firstDay + i + 1;
      days.push({ day: prevMonthDay, isCurrentMonth: false });
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, isCurrentMonth: true });
    }
    
    // Next month days to fill out the calendar
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ day: i, isCurrentMonth: false });
    }
    
    return days;
  };

  const calendarDays = generateCalendarDays();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthYear = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Top Navigation Bar */}
      <div className="bg-blue-500 text-white p-4">
        <h1 className="text-xl font-bold">Doctor Dashboard</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-64 bg-gray-800 text-white">
          <div className="p-4">
            <div className="flex items-center space-x-4 mb-6">
              <div className="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center text-sm">
                DR
              </div>
              <div>
                <h2 className="font-semibold">Dr. Sarah Johnson</h2>
                <p className="text-xs text-gray-400">General Practitioner</p>
              </div>
            </div>

            <ul className="space-y-2">
              <li className="bg-blue-600 rounded p-2 flex items-center">
                <span className="mr-2">📊</span> Dashboard
              </li>
              <li className="hover:bg-gray-700 rounded p-2 flex items-center">
                <span className="mr-2">📅</span> My Schedule
              </li>
              <li className="hover:bg-gray-700 rounded p-2 flex items-center">
                <span className="mr-2">👥</span> Patients
              </li>
              <li className="hover:bg-gray-700 rounded p-2 flex items-center">
                <span className="mr-2">💊</span> Prescriptions
              </li>
              <li className="hover:bg-gray-700 rounded p-2 flex items-center">
                <span className="mr-2">💬</span> Consultations
              </li>
              <li className="hover:bg-gray-700 rounded p-2 flex items-center">
                <span className="mr-2">📝</span> Reports
              </li>
              <li className="hover:bg-gray-700 rounded p-2 flex items-center">
                <span className="mr-2">⚙️</span> Settings
              </li>
            </ul>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-auto p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center">
              <div className="mr-4">
                <button className="bg-blue-500 text-white px-4 py-2 rounded">View Profile</button>
              </div>
            </div>
          </div>

          {/* Availability Management */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Manage Availability</h2>

            <div className="mb-4 flex justify-between items-center">
              <button className="px-3 py-1 bg-gray-200 rounded">← Previous</button>
              <h3 className="font-medium text-lg">{monthYear}</h3>
              <button className="px-3 py-1 bg-gray-200 rounded">Next →</button>
            </div>

            {/* Calendar Grid */}
            <div className="mb-6">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {weekDays.map(day => (
                  <div key={day} className="text-center font-medium">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.slice(0, 35).map((item, index) => (
                  <div
                    key={index}
                    onClick={() => item.isCurrentMonth && setSelectedDate(item.day)}
                    className={`
                      h-8 flex items-center justify-center rounded-full cursor-pointer
                      ${!item.isCurrentMonth ? 'text-gray-400' : ''}
                      ${item.isCurrentMonth && item.day === selectedDate ? 'bg-blue-500 text-white' : ''}
                      ${item.isCurrentMonth && item.day !== selectedDate ? 'hover:bg-gray-200' : ''}
                    `}
                  >
                    {item.day}
                  </div>
                ))}
              </div>
            </div>

            {/* Time Slots */}
            <div>
              <h3 className="font-medium mb-2">Time Slots for March {selectedDate}, 2025</h3>
              <div className="space-y-2">
                {timeSlots.map(slot => (
                  <div key={slot.id} className="flex justify-between items-center">
                    <span>{slot.time}</span>
                    <span 
                      className={`px-3 py-1 rounded text-white text-sm ${
                        slot.status === 'available' ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    >
                      {slot.status === 'available' ? 'Available' : 'Booked'}
                    </span>
                  </div>
                ))}
              </div>
              <button className="mt-4 w-full bg-blue-500 text-white py-2 rounded">Save Availability</button>
            </div>
          </div>

          {/* Upcoming Appointments */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Upcoming Appointments</h2>
            
            <div className="space-y-4">
              {appointments.map(appointment => (
                <div key={appointment.id} className="pb-4 border-b">
                  <h3 className="font-medium">{appointment.patientName}</h3>
                  <p className="text-sm text-gray-600">{appointment.type}</p>
                  <p className="text-sm text-gray-600">{appointment.time}</p>
                  <div className="mt-2 flex space-x-2">
                    <button className="bg-blue-500 text-white px-3 py-1 rounded text-sm">
                      Start Consultation
                    </button>
                    <button className="bg-gray-200 px-3 py-1 rounded text-sm">
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorDashboard;