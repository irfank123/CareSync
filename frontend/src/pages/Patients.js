import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';

const Patients = () => {
  const { user } = useAuth();

  // Temporary mock data
  const patients = [
    {
      id: 1,
      name: 'John Doe',
      age: 45,
      gender: 'Male',
      lastVisit: '2024-03-15',
      status: 'Active',
    },
    {
      id: 2,
      name: 'Jane Smith',
      age: 32,
      gender: 'Female',
      lastVisit: '2024-03-20',
      status: 'Active',
    },
  ];

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4 }}>
        <Typography variant="h4" component="h1">
          Patients
        </Typography>
        <Button
          variant="contained"
          color="primary"
          component={RouterLink}
          to="/patients/new"
        >
          Add New Patient
        </Button>
      </Box>

      <Box sx={{ mb: 4 }}>
        <TextField
          fullWidth
          placeholder="Search patients by name or ID"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Age</TableCell>
              <TableCell>Gender</TableCell>
              <TableCell>Last Visit</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {patients.map((patient) => (
              <TableRow key={patient.id}>
                <TableCell>{patient.name}</TableCell>
                <TableCell>{patient.age}</TableCell>
                <TableCell>{patient.gender}</TableCell>
                <TableCell>{patient.lastVisit}</TableCell>
                <TableCell>{patient.status}</TableCell>
                <TableCell>
                  <Button
                    size="small"
                    component={RouterLink}
                    to={`/patients/${patient.id}`}
                  >
                    View Details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
};

export default Patients; 