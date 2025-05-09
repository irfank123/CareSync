# CareSync - Telehealth Application

## Overview

CareSync is a comprehensive telehealth platform designed to bridge the gap between healthcare providers and patients through virtual consultations. Our platform enables seamless scheduling, virtual appointments, and digital health management while maintaining the highest standards of privacy and security.

## Features

•⁠  ⁠🩺 *Physician Availability Management*: Doctors can set and manage their availability through an intuitive calendar interface
•⁠  ⁠📅 *Smart Appointment Scheduling*: Patients can book appointments based on real-time doctor availability
•⁠  ⁠🔍 *Preliminary Health Assessments*: AI-assisted symptom analysis and initial health evaluations
•⁠  ⁠💻 *Virtual Consultations*: Secure video conferencing for remote medical consultations
•⁠  ⁠💊 *Digital Prescriptions*: Electronic prescription management system

## Technologies

### Frontend

•⁠  ⁠React.js with TypeScript
•⁠  ⁠Tailwind CSS for styling
•⁠  ⁠Context API for state management

### Backend

•⁠  ⁠Node.js with Express.js
•⁠  ⁠MongoDB (using Mongoose)
•⁠  ⁠JWT authentication
•⁠  ⁠RESTful API architecture
•⁠  ⁠Google Meets API

## Prerequisites

Before you begin, ensure you have met the following requirements:

* You have installed Node.js (v14.0.0 or later) and npm (v6.0.0 or later). You can download them from [https://nodejs.org/](https://nodejs.org/).
* You have a running instance of MongoDB.

## Getting Started

Follow these instructions to set up and run the project locally.

1. *Clone the repository:*
   ⁠ bash
   git clone https://github.com/irfank123/CareSync.git
   cd CareSync
2. .env's in the project deliverable - one for front end and one for backend ⁠
3. *Set up and run the Backend:*

   * Navigate to the backend directory:
     ⁠ bash
     cd backend
      ⁠
   * Install dependencies:
     ⁠ bash
     npm install
      ⁠
   * Create a ⁠ .env ⁠ file in the ⁠ backend ⁠ directory if needed, based on ⁠ .env.example ⁠ or project requirements (e.g., for database connection strings, JWT secrets, etc.).
   * Start the backend server:
     * For development (uses ⁠ dotenv/config ⁠ for environment variables and may include features like hot reloading):
       ⁠ bash
       npm run dev
        ⁠
       The backend server will typically run on a port specified in your environment variables or configuration (e.g., ⁠ http://localhost:5001 ⁠).
4. *Set up and run the Frontend:*

   * Navigate to the frontend directory (from the project root, so if you are in ⁠ CareSync/backend ⁠, type ⁠ cd ../frontend ⁠):
     ⁠ bash
     cd frontend
      ⁠
   * Install dependencies:
     ⁠ bash
     npm install
      ⁠
   * Start the frontend development server:
     ⁠ bash
     npm start
      ⁠
   * Open your browser and navigate to ⁠ http://localhost:3000 ⁠.

## Running Tests and Generating Coverage Reports

This project uses Jest for testing the backend and ⁠ react-scripts ⁠ (which uses Jest underneath) for the frontend.

### Backend Tests & Coverage

1. Navigate to the ⁠ backend ⁠ directory:
   ⁠ bash
   cd backend
    ⁠
2. Run the tests. This command will also generate a coverage report because ⁠ --coverage ⁠ is included in the script defined in ⁠ backend/package.json ⁠ (⁠ "test": "jest --coverage --testTimeout=30000" ⁠):
   ⁠ bash
   npm test
    ⁠
   A coverage summary will be displayed in the console. A detailed HTML coverage report can be found in the ⁠ backend/coverage/lcov-report/index.html ⁠ file.

## Project Structure

CareSync/
├── Deliverables/        # Project documentation
├── frontend/
│   ├── public/          # Static files
│   ├── src/
│   │   ├── assets/      # Images and other assets
│   │   ├── components/  # Reusable UI components
│   │   ├── context/     # React context providers
│   │   ├── hooks/       # Custom React hooks
│   │   ├── pages/       # Page components
│   │   ├── services/    # API services
│   │   ├── types/       # TypeScript definitions
│   │   ├── utils/       # Utility functions
│   │   ├── App.tsx      # Main application component
│   │   └── index.tsx    # Application entry point
│   ├── tailwind.config.js
│   └── tsconfig.json
└── backend/
    ├── src/             # Backend source code (e.g., server.mjs, routes, controllers, models)
    └── package.json     # Backend dependencies and scripts

## Current Status

This project is currently in development. Key UI components for the frontend have been implemented, and backend services are being developed.

### Implemented

•⁠  ⁠Project structure and architecture for frontend and backend
•⁠  ⁠Physician availability management interface (Frontend)
•⁠  ⁠Appointment scheduling interface (Frontend)
•⁠  ⁠Core backend setup with Express.js and Mongoose

## Roadmap

1. *Phase 1: Frontend Structure & Core UI (Largely Complete)*
   * Set up project architecture
   * Implement key UI components
   * Create responsive design
2. *Phase 2: Backend Development & Initial API (In Progress)*
   * Build RESTful API with Node.js, Express, MongoDB
   * Implement core business logic for scheduling and user management
   * Set up database schemas
3. *Phase 3: Authentication & State Management*
   * Implement user authentication (JWT)
   * Integrate frontend with backend authentication
   * Refine global state management in frontend
   * Create protected routes
4. *Phase 4: Video Consultations & Advanced Features*
   * Integrate WebRTC for video consultations
   * Add prescription system functionality
   * Implement notifications

## Contact

Project Link: [https://github.com/irfank123/CareSync](https://github.com/irfank123/CareSync)
