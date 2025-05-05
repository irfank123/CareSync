import { createTheme } from '@mui/material/styles';

// Define base colors inspired by index.css variables
const PRIMARY_COLOR = '#4a90e2';
const SECONDARY_COLOR = '#f5a623';
const BACKGROUND_LIGHT = '#f8f9fa';
const BACKGROUND_PAPER = '#ffffff'; // Keep paper white for contrast
const TEXT_COLOR = '#343a40';
const BORDER_COLOR = '#ced4da';
const SUCCESS_COLOR = '#28a745';
const DANGER_COLOR = '#dc3545';

export const theme = createTheme({
  palette: {
    primary: {
      main: PRIMARY_COLOR,
      // Generate light/dark shades or define explicitly if needed
    },
    secondary: {
      main: SECONDARY_COLOR,
    },
    success: {
      main: SUCCESS_COLOR,
    },
    error: {
      main: DANGER_COLOR,
    },
    background: {
      default: BACKGROUND_LIGHT,
      paper: BACKGROUND_PAPER,
    },
    text: {
      primary: TEXT_COLOR,
      // secondary: ... // Define if needed
    },
    divider: BORDER_COLOR,
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.2rem',
      fontWeight: 700, // Bold for main headings
    },
    h2: {
      fontSize: '1.8rem',
      fontWeight: 600,
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 500,
    },
    h5: {
      fontSize: '1.1rem',
      fontWeight: 500,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
    },
    body1: {
      fontSize: '1rem', // Base body size
      lineHeight: 1.6,
    },
    button: {
      textTransform: 'none', // Keep from previous override
      fontWeight: 500,
    }
  },
  spacing: 8, // Base spacing unit (8px)
  shape: {
    borderRadius: 8, // Consistent border radius
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          // Apply global gradient if desired (though default background might be cleaner)
          // background: `linear-gradient(to bottom right, ${BACKGROUND_LIGHT}, #e9ecef)`, 
          scrollBehavior: 'smooth',
        },
        '::selection': {
            backgroundColor: PRIMARY_COLOR,
            color: '#fff',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true, // Flatter buttons
      },
      styleOverrides: {
        root: {
          borderRadius: 8, // Use theme's border radius
          padding: '8px 16px', // Adjust padding based on spacing unit
        },
        containedPrimary: {
          '&:hover': {
            backgroundColor: '#3a7bc8', // Darker primary on hover
          },
        },
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0, // Use border instead of shadow for a flatter look
      },
      styleOverrides: {
        root: {
          borderRadius: 12, // Slightly larger radius for cards
          // boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)', // Lighter shadow if preferred
          border: `1px solid ${BORDER_COLOR}`, 
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
           // Common styling for Paper components if needed
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined', // Default to outlined fields
      },
      styleOverrides: {
        root: {
          // Adjust spacing or styles if needed
        },
      },
    },
    MuiAppBar: {
       defaultProps: {
        elevation: 0, // Flat app bar
        color: 'inherit', // Use custom background color
      },
      styleOverrides: {
        root: {
          backgroundColor: BACKGROUND_PAPER, // Or PRIMARY_COLOR
          borderBottom: `1px solid ${BORDER_COLOR}`,
        }
      }
    },
    MuiLink: {
      styleOverrides: {
        root: {
          color: PRIMARY_COLOR,
          textDecoration: 'none',
          '&:hover': {
            textDecoration: 'underline',
          }
        }
      }
    },
  },
}); 