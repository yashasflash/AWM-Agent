import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UserRole } from '../types/auth';
import { LoadingPage } from '../components/common/Loading';

interface ProtectedRouteProps {
  children: React.ReactElement;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, loading, token } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingPage text="Verifying municipal credentials..." />;
  }

  if (!token || !user) {
    return <Navigate to="/" replace />;
  }

  // Check if account is pending approval
  if (user.approval_status === 'pending' || user.is_pending_approval) {
    return <Navigate to="/auth/pending-approval" replace />;
  }

  // Role validation
  if (allowedRoles && allowedRoles.length > 0) {
    const hasRole =
      allowedRoles.includes(user.role) ||
      (allowedRoles.includes('municipal_staff') && user.is_staff) ||
      (allowedRoles.includes('manager') && user.is_manager);

    if (!hasRole) {
      // Redirect to the appropriate portal according to their actual role
      if (user.is_manager) {
        return <Navigate to="/manager" replace />;
      }
      if (user.is_staff) {
        return <Navigate to="/municipal" replace />;
      }
      return <Navigate to="/user" replace />;
    }
  }

  return children;
};
