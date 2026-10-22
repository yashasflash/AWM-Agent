import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ToastProvider } from './hooks/useToast';
import { LandingLayout } from './layouts/LandingLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { ProtectedRoute } from './layouts/ProtectedRoute';

// Pages
import { LandingPage } from './pages/landing/LandingPage';
import { PortalsPage } from './pages/portals/PortalsPage';
import { LoginPage } from './pages/auth/LoginPage';
import { AuthCallbackPage } from './pages/auth/AuthCallbackPage';
import { RegisterCitizenPage } from './pages/auth/RegisterCitizenPage';
import { RegisterStaffPage } from './pages/auth/RegisterStaffPage';
import { RegisterManagerPage } from './pages/auth/RegisterManagerPage';
import { SetupManagerPage } from './pages/auth/SetupManagerPage';
import { PendingApprovalPage } from './pages/auth/PendingApprovalPage';
import { DashboardLayout } from './layouts/DashboardLayout';
import { CitizenDashboard } from './pages/citizen/CitizenDashboard';
import { StaffDashboard } from './pages/municipal/StaffDashboard';
import { ManagerDashboard } from './pages/manager/ManagerDashboard';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* 1. Public Landing Page with Marketing Navbar & Footer */}
            <Route element={<LandingLayout />}>
              <Route path="/" element={<LandingPage />} />
            </Route>

            {/* 2. Standalone Role Selection Page */}
            <Route path="/portals" element={<PortalsPage />} />

            {/* 3. Dedicated Authentication Layout (Zero Landing Marketing Content) */}
            <Route element={<AuthLayout />}>
              {/* Three Role-Specific Login Routes */}
              <Route path="/login/user" element={<LoginPage forcedRole="citizen" />} />
              <Route path="/login/municipal" element={<LoginPage forcedRole="municipal_staff" />} />
              <Route path="/login/manager" element={<LoginPage forcedRole="manager" />} />

              {/* General Login & OAuth Callback */}
              <Route path="/login" element={<Navigate to="/portals" replace />} />
              <Route path="/auth/login" element={<LoginPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />

              {/* Registration & Account Setup Routes */}
              <Route path="/auth/register-citizen" element={<RegisterCitizenPage />} />
              <Route path="/auth/register-staff" element={<RegisterStaffPage />} />
              <Route path="/auth/register-manager" element={<RegisterManagerPage />} />
              <Route path="/auth/setup-manager" element={<SetupManagerPage />} />
              <Route path="/auth/pending-approval" element={<PendingApprovalPage />} />
            </Route>

            {/* 4. Authenticated Dashboards Layout with Top-Right Profile & Logout */}
            <Route element={<DashboardLayout />}>
              <Route
                path="/user"
                element={
                  <ProtectedRoute allowedRoles={['citizen']}>
                    <CitizenDashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="/citizen" element={<Navigate to="/user" replace />} />

              <Route
                path="/municipal"
                element={
                  <ProtectedRoute allowedRoles={['municipal_staff']}>
                    <StaffDashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/manager"
                element={
                  <ProtectedRoute allowedRoles={['manager']}>
                    <ManagerDashboard />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Catch-all Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
