import React from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Button,
  TextField,
  InputAdornment,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';

const Doctors = () => {
  // Temporary mock data
  const doctors = [
    {
      id: 1,
      name: 'Dr. Sarah Smith',
      specialty: 'Cardiology',
      image: '/doctor1.jpg',
      rating: 4.8,
      experience: '15 years',
    },
    {
      id: 2,
      name: 'Dr. John Johnson',
      specialty: 'Pediatrics',
      image: '/doctor2.jpg',
      rating: 4.9,
      experience: '12 years',
    },
    {
      id: 3,
      name: 'Dr. Emily Davis',
      specialty: 'Dermatology',
      image: '/doctor3.jpg',
      rating: 4.7,
      experience: '8 years',
    },
  ];

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Find a Doctor
      </Typography>

      <Box sx={{ mb: 4 }}>
        <TextField
          fullWidth
          placeholder="Search doctors by name, specialty, or location"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />
      </Box>

      <Grid container spacing={3}>
        {doctors.map((doctor) => (
          <Grid item xs={12} sm={6} md={4} key={doctor.id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CardMedia
                component="img"
                height="200"
                image={doctor.image}
                alt={doctor.name}
              />
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography gutterBottom variant="h5" component="h2">
                  {doctor.name}
                </Typography>
                <Typography color="text.secondary" gutterBottom>
                  {doctor.specialty}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Experience: {doctor.experience}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Rating: {doctor.rating}/5
                </Typography>
              </CardContent>
              <Box sx={{ p: 2 }}>
                <Button
                  fullWidth
                  variant="contained"
                  component={RouterLink}
                  to={`/doctors/${doctor.id}`}
                >
                  View Profile
                </Button>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
};

export default Doctors; 