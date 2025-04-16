import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import {
  CalendarMonth,
  Person,
  MedicalServices,
  Assignment,
  AccessTime,
  TrendingUp,
  Notifications,
  CheckCircle,
  Cancel,
  Schedule,
} from '@mui/icons-material';
import { appointmentService, patientService, doctorService } from '../services/api';

const Dashboard = () => {
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    stats: {},
    appointments: [],
    patients: [],
    tasks: []
  });

  // Determine user role
  const userRole = user?.role || 'patient';
  const isDoctor = userRole === 'doctor';

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch upcoming appointments
        const appointmentsData = await appointmentService.getUpcoming();
        
        // Different stats based on role
        let stats = {};
        let patients = [];
        
        if (isDoctor) {
          // For doctors
          const doctorProfile = await doctorService.getProfile();
          stats = {
            appointments: appointmentsData.count || 0,
            patients: doctorProfile.patientCount || 0,
            upcomingToday: appointmentsData.data.filter(apt => 
              new Date(apt.date).toDateString() === new Date().toDateString()
            ).length,
            pendingReviews: 0 // This would come from another endpoint
          };
          
          // Get recent patients if needed
          // This is a placeholder since we don't have a direct endpoint for this
          patients = [];
        } else {
          // For patients
          const patientProfile = await patientService.getProfile();
          stats = {
            upcomingAppointments: appointmentsData.count || 0,
            prescriptions: patientProfile.prescriptionsCount || 0,
            testResults: patientProfile.testResultsCount || 0,
            notifications: 0 // This would come from another endpoint
          };
        }
        
        setDashboardData({
          stats,
          appointments: appointmentsData.data || [],
          patients,
          tasks: [] // Placeholder for tasks which would come from another endpoint
        });
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboardData();
  }, [isDoctor]);

  const getStatusChip = (status) => {
    const statusConfig = {
      upcoming: { color: 'primary', icon: <Schedule sx={{ fontSize: 16 }} /> },
      scheduled: { color: 'primary', icon: <Schedule sx={{ fontSize: 16 }} /> },
      completed: { color: 'success', icon: <CheckCircle sx={{ fontSize: 16 }} /> },
      cancelled: { color: 'error', icon: <Cancel sx={{ fontSize: 16 }} /> },
      'in-progress': { color: 'warning', icon: <AccessTime sx={{ fontSize: 16 }} /> },
      'no-show': { color: 'error', icon: <Cancel sx={{ fontSize: 16 }} /> },
    };

    const config = statusConfig[status] || statusConfig.upcoming;

    return (
      <Chip
        size="small"
        icon={config.icon}
        label={status.charAt(0).toUpperCase() + status.slice(1).replace(/-/g, ' ')}
        color={config.color}
      />
    );
  };

  const doctorQuickActions = [
    {
      title: 'Manage Appointments',
      description: 'View and manage your appointments',
      link: '/appointments',
      icon: <CalendarMonth />,
    },
    {
      title: 'Patient Records',
      description: 'Access your patient records',
      link: '/patients',
      icon: <Person />,
    },
    {
      title: 'Prescriptions',
      description: 'Write and manage prescriptions',
      link: '/prescriptions',
      icon: <MedicalServices />,
    },
    {
      title: 'Medical Reports',
      description: 'View and create medical reports',
      link: '/reports',
      icon: <Assignment />,
    },
  ];

  const patientQuickActions = [
    {
      title: 'Book Appointment',
      description: 'Schedule a new appointment',
      link: '/appointments/schedule',
      icon: <CalendarMonth />,
    },
    {
      title: 'Find Doctors',
      description: 'Browse and search for doctors',
      link: '/doctors',
      icon: <Person />,
    },
    {
      title: 'Medical History',
      description: 'View your medical records',
      link: '/profile/medical-history',
      icon: <Assignment />,
    },
    {
      title: 'Prescriptions',
      description: 'View your prescriptions',
      link: '/prescriptions',
      icon: <MedicalServices />,
    },
  ];

  const renderDoctorDashboard = () => (
    <>
      {/* Statistics Section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {Object.entries(dashboardData.stats).map(([key, value], index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom sx={{ textTransform: 'capitalize' }}>
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </Typography>
                <Typography variant="h4" component="div">
                  {value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Tabs for different views */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={selectedTab} onChange={(e, newValue) => setSelectedTab(newValue)}>
          <Tab label="Today's Schedule" />
          <Tab label="Recent Patients" />
          <Tab label="Pending Tasks" />
        </Tabs>
      </Box>

      {/* Today's Schedule */}
      {selectedTab === 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Time</TableCell>
                <TableCell>Patient</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dashboardData.appointments.length > 0 ? (
                dashboardData.appointments.map((appointment) => (
                  <TableRow key={appointment._id}>
                    <TableCell>{appointment.startTime}</TableCell>
                    <TableCell>{appointment.patientName || 'Patient Name'}</TableCell>
                    <TableCell>{appointment.type}</TableCell>
                    <TableCell>{getStatusChip(appointment.status)}</TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        component={RouterLink}
                        to={`/appointments/${appointment._id}`}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No appointments scheduled for today
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Recent Patients */}
      {selectedTab === 1 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Patient Name</TableCell>
                <TableCell>Last Visit</TableCell>
                <TableCell>Condition</TableCell>
                <TableCell>Next Appointment</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dashboardData.patients.length > 0 ? (
                dashboardData.patients.map((patient) => (
                  <TableRow key={patient._id}>
                    <TableCell>{patient.name}</TableCell>
                    <TableCell>{patient.lastVisit}</TableCell>
                    <TableCell>{patient.condition}</TableCell>
                    <TableCell>{patient.nextAppointment}</TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        component={RouterLink}
                        to={`/patients/${patient._id}`}
                      >
                        View Profile
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No recent patients
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Pending Tasks */}
      {selectedTab === 2 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Task Type</TableCell>
                <TableCell>Patient</TableCell>
                <TableCell>Due Date</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {dashboardData.tasks.length > 0 ? (
                dashboardData.tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>{task.type}</TableCell>
                    <TableCell>{task.patient}</TableCell>
                    <TableCell>{task.dueDate}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={task.priority}
                        color={task.priority === 'high' ? 'error' : 'warning'}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => {}}
                      >
                        Complete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No pending tasks
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Quick Actions */}
      <Typography variant="h5" sx={{ mt: 4, mb: 2 }}>
        Quick Actions
      </Typography>
      <Grid container spacing={3}>
        {doctorQuickActions.map((action, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  {action.icon}
                  <Typography variant="h6" component="h2" sx={{ ml: 1 }}>
                    {action.title}
                  </Typography>
                </Box>
                <Typography variant="body2">{action.description}</Typography>
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  color="primary"
                  component={RouterLink}
                  to={action.link}
                >
                  Go
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  );

  const renderPatientDashboard = () => (
    <>
      {/* Statistics Section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {Object.entries(dashboardData.stats).map(([key, value], index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom sx={{ textTransform: 'capitalize' }}>
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </Typography>
                <Typography variant="h4" component="div">
                  {value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Quick Actions */}
      <Typography variant="h5" gutterBottom>
        Quick Actions
      </Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {patientQuickActions.map((action, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  {action.icon}
                  <Typography variant="h6" component="h2" sx={{ ml: 1 }}>
                    {action.title}
                  </Typography>
                </Box>
                <Typography variant="body2">{action.description}</Typography>
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  color="primary"
                  component={RouterLink}
                  to={action.link}
                >
                  Go
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Upcoming Appointments */}
      <Typography variant="h5" gutterBottom>
        Upcoming Appointments
      </Typography>
      <Card sx={{ mb: 4 }}>
        <List>
          {dashboardData.appointments.length > 0 ? (
            dashboardData.appointments.map((appointment, index) => (
              <React.Fragment key={appointment._id}>
                <ListItem alignItems="flex-start">
                  <ListItemAvatar>
                    <Avatar>
                      <AccessTime />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography variant="subtitle1">
                        {appointment.type}
                      </Typography>
                    }
                    secondary={
                      <>
                        <Typography component="span" variant="body2" color="text.primary">
                          {appointment.startTime} on {new Date(appointment.date).toLocaleDateString()}
                        </Typography>
                        {` with ${appointment.doctorName || 'Doctor'}`}
                      </>
                    }
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    component={RouterLink}
                    to={`/appointments/${appointment._id}`}
                  >
                    View Details
                  </Button>
                </ListItem>
                {index < dashboardData.appointments.length - 1 && <Divider variant="inset" component="li" />}
              </React.Fragment>
            ))
          ) : (
            <ListItem>
              <ListItemText 
                primary="No upcoming appointments" 
                secondary="Click 'Book Appointment' to schedule one"
              />
            </ListItem>
          )}
        </List>
      </Card>
    </>
  );

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Welcome, {user?.firstName || 'User'}!
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" paragraph>
        {isDoctor ? 'Here\'s your practice overview' : 'Here\'s your health overview'}
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ my: 2 }}>
          {error}
        </Alert>
      ) : (
        isDoctor ? renderDoctorDashboard() : renderPatientDashboard()
      )}
    </Container>
  );
};

export default Dashboard;