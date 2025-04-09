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
import Dashboard from './pages/Dashboard';
import Appointments from './pages/Appointments';
import AppointmentDetails from './pages/AppointmentDetails';
import ScheduleAppointment from './pages/ScheduleAppointment';
import Doctors from './pages/Doctors';
import Patients from './pages/Patients';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

// Components
import Header from './components/common/Header';
import Footer from './components/common/Footer';
import AuthWrapper from './components/auth/AuthWrapper';

// Context
import { AuthProvider } from './context/AuthContext';

function App() {
  return (
    <AuthProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <AuthWrapper>
            <Header />
            <main style={{ minHeight: 'calc(100vh - 64px - 100px)', padding: '20px' }}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/appointments" element={<Appointments />} />
                <Route path="/appointments/schedule" element={<ScheduleAppointment />} />
                <Route path="/appointments/:id" element={<AppointmentDetails />} />
                <Route path="/doctors" element={<Doctors />} />
                <Route path="/patients" element={<Patients />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
            <Footer />
            <ToastContainer position="bottom-right" />
          </AuthWrapper>
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
