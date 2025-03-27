import React, { createContext, useContext, ReactNode } from 'react';

type AppointmentContextType = {
  // This will be implemented in a future sprint
};

const AppointmentContext = createContext<AppointmentContextType | undefined>(undefined);

export const AppointmentContextProvider = ({ children }: { children: ReactNode }) => {
  return (
    <AppointmentContext.Provider value={undefined}>
      {children}
    </AppointmentContext.Provider>
  );
};

export const useAppointmentContext = () => {
  const context = useContext(AppointmentContext);
  if (context === undefined) {
    throw new Error('useAppointmentContext must be used within a AppointmentContextProvider');
  }
  return context;
};

export default AppointmentContext;
