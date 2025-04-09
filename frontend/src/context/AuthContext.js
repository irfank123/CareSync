import React, { createContext, useContext } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // Temporary mock authentication state
  const mockAuthState = {
    user: {
      name: 'Test User',
      email: 'test@example.com',
      role: 'user'
    },
    token: 'mock-token',
    isAuthenticated: true,
    isLoading: false,
    login: () => Promise.resolve(),
    logout: () => Promise.resolve()
  };

  return <AuthContext.Provider value={mockAuthState}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 