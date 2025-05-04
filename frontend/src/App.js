import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { theme } from './styles/theme';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import DoctorDashboard from './pages/DoctorDashboard';
import PatientDashboard from './pages/PatientDashboard';
import Appointments from './pages/Appointments';
import AppointmentDetails from './pages/AppointmentDetails';
import ScheduleAppointment from './pages/ScheduleAppointment';
import Doctors from './pages/Doctors';
import Patients from './pages/Patients';
import PatientDetails from './pages/PatientDetails';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import ManageAvailability from './pages/ManageAvailability';
import Assessment from './pages/Assessment';
import NotFound from './pages/NotFound';
import MedicalRecords from './pages/MedicalRecords';
import ClinicDashboard from './pages/ClinicDashboard';
import AuthError from './pages/AuthError';

// Components
import Header from './components/common/Header';
import Footer from './components/common/Footer';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ProtectedClinicRoute from './components/auth/ProtectedClinicRoute';
import TestConnection from './components/TestConnection';

// Context
import { AuthProvider } from './context/AuthContext';
import { ClinicAuthProvider } from './context/ClinicAuthContext';

// Optional Wrapper from second version
import AuthWrapper from './components/auth/AuthWrapper'; // Make sure this file exists

function App() {
  // Add explicit Auth0 redirect handler 
  React.useEffect(() => {
    const handleAuthRedirects = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const authStatus = urlParams.get('auth');
      const user = urlParams.get('user');
      
      if (authStatus) {
        console.log(`[App] Auth redirect detected: status=${authStatus}, user=${user || 'unknown'}`);
        
        // If we're not on the right page after auth, redirect explicitly
        if (authStatus === 'success' || authStatus === 'code_reuse') {
          if (!window.location.pathname.includes('/clinic-dashboard')) {
            console.log('[App] Redirecting to clinic dashboard after auth detection');
            window.location.href = '/clinic-dashboard' + window.location.search;
          }
        }
      }
    };
    
    handleAuthRedirects();
  }, []);
  
  return (
    <Router>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <ClinicAuthProvider>
            <AuthWrapper>
              <Header />
              <main style={{ minHeight: 'calc(100vh - 64px - 100px)', padding: '20px' }}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route 
                    path="/dashboard" 
                    element={
                      <ProtectedRoute roles={['patient']}>
                        <PatientDashboard />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/doctor-dashboard" 
                    element={
                      <ProtectedRoute roles={['doctor']}>
                        <DoctorDashboard />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/appointments" 
                    element={
                      <ProtectedRoute roles={['doctor', 'patient']}>
                        <Appointments />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/appointments/schedule" 
                    element={
                      <ProtectedRoute roles={['patient']}>
                        <ScheduleAppointment />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/appointments/:id" 
                    element={
                      <ProtectedRoute roles={['doctor', 'patient']}>
                        <AppointmentDetails />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/assessment/:patientId/:appointmentId" 
                    element={
                      <ProtectedRoute roles={['patient']}>
                        <Assessment />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/doctors" 
                    element={
                      <ProtectedRoute roles={['patient', 'staff']}>
                        <Doctors />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/patients" 
                    element={
                      <ProtectedRoute roles={['doctor', 'staff']}>
                        <Patients />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/patients/:id"
                    element={
                      <ProtectedRoute roles={['doctor', 'staff']}>
                        <PatientDetails />
                      </ProtectedRoute>
                    }
                  />
                  <Route 
                    path="/profile" 
                    element={
                      <ProtectedRoute>
                        <Profile />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/settings" 
                    element={
                      <ProtectedRoute>
                        <Settings />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/manage-availability" 
                    element={
                      <ProtectedRoute roles={['doctor']}>
                        <ManageAvailability />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/medical-records"
                    element={
                      <ProtectedRoute roles={['patient']}>
                        <MedicalRecords />
                      </ProtectedRoute>
                    }
                  />
                  <Route 
                    path="/clinic-dashboard" 
                    element={
                      <ProtectedClinicRoute>
                        <ClinicDashboard />
                      </ProtectedClinicRoute>
                    } 
                  />
                  <Route path="/auth/error" element={<AuthError />} />
                  <Route path="/test" element={<TestConnection />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
              <Footer />
              <ToastContainer position="bottom-right" />
            </AuthWrapper>
          </ClinicAuthProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;