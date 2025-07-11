import { useEffect, useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { SettingsProvider } from './hooks/useSettings';
import { PlatformSettingsProvider } from './hooks/usePlatformSettings';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import MyCourses from './pages/MyCourses';
import AvailableCourses from './pages/AvailableCourses';
import CourseDetail from './pages/CourseDetail';
import Certificates from './pages/Certificates';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentCancel from './pages/PaymentCancel';
import AdminUsers from './pages/admin/Users';
import AdminCourses from './pages/admin/Courses';
import CourseContentManager from './pages/admin/CourseContentManager';
import CourseEnrollments from './pages/admin/CourseEnrollments';
import AdminSettings from './pages/admin/Settings';
import AlertModal from './components/AlertModal';

function getPwaDismissCount() {
  return parseInt(localStorage.getItem('falak_pwa_dismiss_count') || '0', 10);
}
function setPwaDismissCount(val: number) {
  localStorage.setItem('falak_pwa_dismiss_count', val.toString());
}

function App() {
  // PWA install prompt state
  const [installPromptEvent, setInstallPromptEvent] = useState<null | any>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);

  useEffect(() => {
    const current = getPwaDismissCount();
    if (current > 20) {
      setPwaDismissCount(0);
    } else if (current > 0) {
      setPwaDismissCount(current - 1);
    }
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPromptEvent(e);
      if (getPwaDismissCount() === 0) {
        setShowInstallModal(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = useCallback(() => {
    if (installPromptEvent) {
      installPromptEvent.prompt();
      installPromptEvent.userChoice?.then(() => {
        setShowInstallModal(false);
        setInstallPromptEvent(null);
      });
    } else {
      setShowInstallModal(false);
    }
  }, [installPromptEvent]);

  const handleNotNow = useCallback(() => {
    setPwaDismissCount(10);
    setShowInstallModal(false);
  }, []);

  return (
    <>
      <AlertModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        title="Install Falak Academy?"
        message="Add Falak Academy to your home screen for a better experience."
        type="info"
        buttonText="Install"
        onButtonClick={handleInstall}
        secondaryButtonText="Not Now"
        onSecondaryButtonClick={handleNotNow}
      />
      <PlatformSettingsProvider>
        <SettingsProvider>
          <AuthProvider>
            <Router>
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                
                {/* Payment routes */}
                <Route path="/payment/success" element={<PaymentSuccess />} />
                <Route path="/payment/cancel" element={<PaymentCancel />} />
                
                {/* Protected routes */}
                <Route path="/" element={<Navigate to="/dashboard\" replace />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Dashboard />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                
                {/* User-only routes */}
                <Route
                  path="/my-courses"
                  element={
                    <ProtectedRoute userOnly>
                      <Layout>
                        <MyCourses />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/available-courses"
                  element={
                    <ProtectedRoute userOnly>
                      <Layout>
                        <AvailableCourses />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/courses/:courseId"
                  element={
                    <ProtectedRoute userOnly>
                      <Layout>
                        <CourseDetail />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/certificates"
                  element={
                    <ProtectedRoute userOnly>
                      <Layout>
                        <Certificates />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                
                {/* Admin routes */}
                <Route
                  path="/admin/users"
                  element={
                    <ProtectedRoute requiredRole="SUPERADMIN\" adminOnly>
                      <Layout>
                        <AdminUsers />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/courses"
                  element={
                    <ProtectedRoute requiredRole="COURSE_ADMIN\" adminOnly>
                      <Layout>
                        <AdminCourses />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/courses/:courseId/content"
                  element={
                    <ProtectedRoute requiredRole="COURSE_ADMIN\" adminOnly>
                      <Layout>
                        <CourseContentManager />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/courses/:courseId/enrollments"
                  element={
                    <ProtectedRoute requiredRole="COURSE_ADMIN\" adminOnly>
                      <Layout>
                        <CourseEnrollments />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/settings"
                  element={
                    <ProtectedRoute requiredRole="SUPERADMIN\" adminOnly>
                      <Layout>
                        <AdminSettings />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                
                {/* Catch all route */}
                <Route path="*" element={<Navigate to="/dashboard\" replace />} />
              </Routes>
            </Router>
          </AuthProvider>
        </SettingsProvider>
      </PlatformSettingsProvider>
    </>
  );
}

export default App;