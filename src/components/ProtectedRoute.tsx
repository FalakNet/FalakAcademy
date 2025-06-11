import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UserRole } from '../lib/supabase';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole;
  requireAuth?: boolean;
  adminOnly?: boolean;
  userOnly?: boolean;
}

export default function ProtectedRoute({ 
  children, 
  requiredRole,
  requireAuth = true,
  adminOnly = false,
  userOnly = false
}: ProtectedRouteProps) {
  const { user, profile, loading, isAdmin, isSuperAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (requireAuth && !user) {
    return <Navigate to="/login" replace />;
  }

  // Check if admin trying to access user-only pages
  if (userOnly && (isAdmin() || isSuperAdmin())) {
    return <Navigate to="/dashboard\" replace />;
  }

  // Check if user trying to access admin-only pages
  if (adminOnly && !isAdmin() && !isSuperAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requiredRole && profile?.role !== requiredRole) {
    // Check if user has sufficient privileges
    const roleHierarchy = { 'USER': 0, 'COURSE_ADMIN': 1, 'SUPERADMIN': 2 };
    const userLevel = roleHierarchy[profile?.role || 'USER'];
    const requiredLevel = roleHierarchy[requiredRole];
    
    if (userLevel < requiredLevel) {
      return <Navigate to="/dashboard\" replace />;
    }
  }

  return <>{children}</>;
}