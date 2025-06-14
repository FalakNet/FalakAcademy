import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase, Certificate, Course } from '../lib/supabase';
import { Award, Download, Calendar, Hash, BookOpen } from 'lucide-react';
import CertificateGenerator from '../components/CertificateGenerator';

interface CertificateWithCourse extends Certificate {
  courses: Course;
}

export default function Certificates() {
  const { profile } = useAuth();
  const [certificates, setCertificates] = useState<CertificateWithCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCertificates();
  }, [profile]);

  const loadCertificates = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('certificates')
        .select(`
          *,
          courses (*)
        `)
        .eq('user_id', profile.id)
        .order('issued_at', { ascending: false });

      if (error) throw error;
      setCertificates(data || []);
    } catch (error) {
      console.error('Error loading certificates:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Certificates</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          View and download your course completion certificates.
        </p>
      </div>

      {/* Certificates Grid */}
      {certificates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {certificates.map((certificate) => (
            <div key={certificate.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg">
                    <Award className="w-8 h-8 text-white" />
                  </div>
                  <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                    Certified
                  </span>
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {certificate.courses && certificate.courses.title ? certificate.courses.title : 'Untitled Course'}
                </h3>
                
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Hash className="w-4 h-4 mr-2" />
                    <span className="font-mono">{certificate.certificate_number}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span>Issued {new Date(certificate.issued_at).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <CertificateGenerator 
                  certificate={certificate} 
                  profile={profile!}
                  onDownload={() => {
                    // Optional: Track download analytics
                    console.log('Certificate downloaded:', certificate.certificate_number);
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Award className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No certificates yet</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Complete courses to earn certificates and showcase your achievements!
          </p>
          <a
            href="/my-courses"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <BookOpen className="w-4 h-4 mr-2" />
            View My Courses
          </a>
        </div>
      )}
    </div>
  );
}