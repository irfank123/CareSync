import React, { useState } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Chip, 
  Paper, 
  List, 
  ListItem,
  IconButton
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

/**
 * Component for inputting and managing a list of patient symptoms
 */
const SymptomInput = ({ symptoms, setSymptoms }) => {
  const [currentSymptom, setCurrentSymptom] = useState('');
  const [error, setError] = useState('');

  /**
   * Add a symptom to the list
   */
  const addSymptom = () => {
    // Validate input
    if (!currentSymptom.trim()) {
      setError('Please enter a symptom');
      return;
    }

    // Add to list and clear input
    setSymptoms([...symptoms, currentSymptom.trim()]);
    setCurrentSymptom('');
    setError('');
  };

  /**
   * Remove a symptom from the list
   * @param {number} index - Index of the symptom to remove
   */
  const removeSymptom = (index) => {
    const updatedSymptoms = [...symptoms];
    updatedSymptoms.splice(index, 1);
    setSymptoms(updatedSymptoms);
  };

  /**
   * Handle key press events (add symptom on Enter)
   * @param {Object} e - Keyboard event
   */
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSymptom();
    }
  };

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" gutterBottom>
        What symptoms are you experiencing?
      </Typography>
      
      <Box sx={{ display: 'flex', mb: 2 }}>
        <TextField
          fullWidth
          label="Enter symptom"
          variant="outlined"
          value={currentSymptom}
          onChange={(e) => setCurrentSymptom(e.target.value)}
          onKeyPress={handleKeyPress}
          error={!!error}
          helperText={error}
          sx={{ mr: 1 }}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={addSymptom}
          startIcon={<AddIcon />}
        >
          Add
        </Button>
      </Box>

      {symptoms.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Current Symptoms ({symptoms.length}):
          </Typography>
          <List dense>
            {symptoms.map((symptom, index) => (
              <ListItem
                key={index}
                secondaryAction={
                  <IconButton edge="end" onClick={() => removeSymptom(index)}>
                    <DeleteIcon />
                  </IconButton>
                }
              >
                <Chip 
                  label={symptom} 
                  color="primary" 
                  variant="outlined" 
                  sx={{ mr: 1 }}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
};

export default SymptomInput; 