import React, { useState } from 'react';
import './App.css';
import DoctorDashboard from './components/doctor/AvailabilityCalendar';
import AppointmentScheduling from './components/patient/AppointmentBooking';

function App() {
  const [currentView, setCurrentView] = useState('doctor-dashboard');

  return (
    <div className="App">
      <div className="flex justify-center mb-4 bg-gray-100 p-4">
        <button 
          className={`px-4 py-2 rounded mr-4 ${currentView === 'doctor-dashboard' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setCurrentView('doctor-dashboard')}
        >
          Doctor Dashboard
        </button>
        <button 
          className={`px-4 py-2 rounded ${currentView === 'appointment-scheduling' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setCurrentView('appointment-scheduling')}
        >
          Appointment Scheduling
        </button>
      </div>

      {currentView === 'doctor-dashboard' && <DoctorDashboard />}
      {currentView === 'appointment-scheduling' && <AppointmentScheduling />}
    </div>
  );
}

export default App;
