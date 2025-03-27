#!/bin/bash

# List of empty files that need to be fixed
FILES=(
  "src/components/common/Button.tsx"
  "src/components/common/Calendar.tsx"
  "src/components/common/Modal.tsx"
  "src/components/common/Navbar.tsx"
  "src/components/doctor/PrescriptionForm.tsx"
  "src/components/doctor/VirtualConsultationRoom.tsx"
  "src/components/patient/HealthAssessment.tsx"
  "src/components/patient/PatientDashboard.tsx"
  "src/context/AppointmentContext.tsx"
  "src/context/AuthContext.tsx"
  "src/hooks/useAuth.ts"
  "src/hooks/useAvailability.ts"
  "src/pages/DashboardPage.tsx"
  "src/pages/DoctorAvailabilityPage.tsx"
  "src/pages/LoginPage.tsx"
  "src/pages/PatientAppointmentPage.tsx"
  "src/pages/PreliminaryCheckupPage.tsx"
  "src/pages/VirtualConsultationPage.tsx"
  "src/services/api.ts"
  "src/services/appointmentService.ts"
  "src/services/authService.ts"
  "src/services/videoService.ts"
  "src/types/appointment.types.ts"
  "src/types/doctor.types.ts"
  "src/types/patient.types.ts"
  "src/types/prescription.types.ts"
  "src/utils/dateUtils.ts"
  "src/utils/validationUtils.ts"
)

# Add a basic React component boilerplate to TSX files or an export statement to TS files
for file in "${FILES[@]}"; do
  if [[ $file == *.tsx ]]; then
    echo "import React from 'react';

const ${file##*/src/*/} = () => {
  return (
    <div>
      <h2>${file##*/src/*/} Component</h2>
      <p>This component will be implemented in a future sprint.</p>
    </div>
  );
};

export default ${file##*/src/*/};" > "$file"
  else
    # For .ts files
    echo "// This file will be implemented in a future sprint
export {};" > "$file"
  fi
  echo "Fixed: $file"
done