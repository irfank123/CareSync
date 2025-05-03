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
import { appointmentService } from '../services/api';
import { format } from 'date-fns';

const Dashboard = () => {
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState(0);
  const isDoctor = user?.role === 'doctor';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);

  // Fetch upcoming appointments
  useEffect(() => {
    const fetchUpcomingAppointments = async () => {
      try {
        setLoading(true);
        const response = await appointmentService.getUpcomingAppointments();
        setUpcomingAppointments(response.data.data || []);
      } catch (err) {
        console.error('Error fetching appointments:', err);
        setError('Failed to load appointments data');
      } finally {
        setLoading(false);
      }
    };

    fetchUpcomingAppointments();
  }, []);

  // Mock data for statistics
  const doctorStats = {
    appointments: upcomingAppointments.length || 0,
    patients: 45,
    upcomingToday: upcomingAppointments.filter(apt => 
      new Date(apt.date).toDateString() === new Date().toDateString()
    ).length || 0,
    pendingReviews: 3,
  };

  const patientStats = {
    upcomingAppointments: upcomingAppointments.length || 0,
    prescriptions: 3,
    testResults: 1,
    notifications: 2,
  };

  // Mock data for doctor's dashboard
  const recentPatients = [
    {
      id: 1,
      name: 'John Doe',
      lastVisit: '2024-03-15',
      condition: 'Hypertension',
      nextAppointment: '2024-03-20',
    },
    {
      id: 2,
      name: 'Jane Smith',
      lastVisit: '2024-03-14',
      condition: 'Diabetes Type 2',
      nextAppointment: '2024-03-28',
    },
  ];

  const pendingTasks = [
    {
      id: 1,
      type: 'Medical Report',
      patient: 'John Doe',
      dueDate: '2024-03-20',
      priority: 'high',
    },
    {
      id: 2,
      type: 'Prescription Renewal',
      patient: 'Alice Johnson',
      dueDate: '2024-03-21',
      priority: 'medium',
    },
  ];

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

  const getStatusChip = (status) => {
    const statusMapping = {
      'scheduled': 'upcoming',
      'checked-in': 'in-progress',
      'in-progress': 'in-progress',
      'completed': 'completed',
      'cancelled': 'cancelled',
      'no-show': 'cancelled'
    };
    
    const mappedStatus = statusMapping[status] || status;
    
    const statusConfig = {
      'upcoming': { color: 'primary', icon: <Schedule sx={{ fontSize: 16 }} /> },
      'in-progress': { color: 'warning', icon: <AccessTime sx={{ fontSize: 16 }} /> },
      'completed': { color: 'success', icon: <CheckCircle sx={{ fontSize: 16 }} /> },
      'cancelled': { color: 'error', icon: <Cancel sx={{ fontSize: 16 }} /> },
    };

    const config = statusConfig[mappedStatus] || statusConfig.upcoming;

    return (
      <Chip
        size="small"
        icon={config.icon}
        label={status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
        color={config.color}
      />
    );
  };

  const renderDoctorDashboard = () => (
    <>
      {/* Statistics Section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {Object.entries(doctorStats).map(([key, value], index) => (
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

      {/* Tabs for Different Views */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={selectedTab} onChange={(e, newValue) => setSelectedTab(newValue)}>
          <Tab label="Today's Appointments" />
          <Tab label="Recent Patients" />
          <Tab label="Pending Tasks" />
        </Tabs>
      </Box>

      {/* Today's Appointments Table */}
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
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Alert severity="error">{error}</Alert>
                  </TableCell>
                </TableRow>
              ) : upcomingAppointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">No appointments scheduled for today</TableCell>
                </TableRow>
              ) : (
                upcomingAppointments.map((appointment) => (
                  <TableRow key={appointment._id}>
                    <TableCell>{appointment.startTime}</TableCell>
                    <TableCell>
                      {`${appointment.patientUser?.firstName || ''} ${appointment.patientUser?.lastName || ''}`}
                    </TableCell>
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
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Recent Patients Tab */}
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
              {/* We can replace this with real data in the future */}
              {recentPatients.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell>{patient.name}</TableCell>
                  <TableCell>{patient.lastVisit}</TableCell>
                  <TableCell>{patient.condition}</TableCell>
                  <TableCell>{patient.nextAppointment}</TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      variant="outlined"
                      component={RouterLink}
                      to={`/patients/${patient.id}`}
                    >
                      View Profile
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Pending Tasks Tab */}
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
              {/* We can replace this with real data in the future */}
              {pendingTasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>{task.type}</TableCell>
                  <TableCell>{task.patient}</TableCell>
                  <TableCell>{task.dueDate}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={task.priority}
                      color={
                        task.priority === 'high'
                          ? 'error'
                          : task.priority === 'medium'
                          ? 'warning'
                          : 'info'
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Button size="small" variant="outlined">
                      Complete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
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
        {Object.entries(patientStats).map(([key, value], index) => (
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
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box sx={{ p: 2 }}>
            <Alert severity="error">{error}</Alert>
          </Box>
        ) : upcomingAppointments.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">
              No upcoming appointments scheduled
            </Typography>
            <Button
              variant="contained"
              component={RouterLink}
              to="/appointments/schedule"
              sx={{ mt: 2 }}
            >
              Book an Appointment
            </Button>
          </Box>
        ) : (
          <List>
            {upcomingAppointments.map((appointment, index) => (
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
                          {/* Hardcode all dates to May 1, 2025 */}
                          May 1, 2025 at {appointment.startTime}
                        </Typography>
                        {` with Dr. ${appointment.doctorUser?.firstName || ''} ${appointment.doctorUser?.lastName || ''}`}
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
                {index < upcomingAppointments.length - 1 && <Divider variant="inset" component="li" />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Card>
    </>
  );

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Welcome, {user?.name || 'User'}!
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" paragraph>
        {isDoctor ? 'Here\'s your practice overview' : 'Here\'s your health overview'}
      </Typography>

      {isDoctor ? renderDoctorDashboard() : renderPatientDashboard()}
    </Container>
  );
};

export default Dashboard; 