import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase, Course } from '../lib/supabase';
import { BookOpen, Clock, Users, ChevronRight, Check } from 'lucide-react';

export default function AvailableCourses() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set());
  const [enrollingCourseId, setEnrollingCourseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAvailableCourses();
  }, [profile]);

  const loadAvailableCourses = async () => {
    if (!profile) return;

    try {
      // Load all public courses
      const { data: publicCourses, error: coursesError } = await supabase
        .from('courses')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (coursesError) throw coursesError;

      // Load user's enrolled courses
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('user_id', profile.id);

      if (enrollmentsError) throw enrollmentsError;

      const enrolledIds = new Set(enrollments?.map(e => e.course_id) || []);
      
      setCourses(publicCourses || []);
      setEnrolledCourseIds(enrolledIds);
    } catch (error) {
      console.error('Error loading available courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async (courseId: string) => {
    if (!profile) return;

    setEnrollingCourseId(courseId);
    try {
      const { error } = await supabase
        .from('enrollments')
        .insert({
          user_id: profile.id,
          course_id: courseId
        });

      if (error) throw error;

      setEnrolledCourseIds(prev => new Set([...prev, courseId]));
    } catch (error) {
      console.error('Error enrolling in course:', error);
      alert('Failed to enroll in course. Please try again.');
    } finally {
      setEnrollingCourseId(null);
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
        <h1 className="text-3xl font-bold text-gray-900">Available Courses</h1>
        <p className="mt-2 text-gray-600">
          Discover and enroll in courses to expand your knowledge.
        </p>
      </div>

      {/* Courses Grid */}
      {courses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => {
            const isEnrolled = enrolledCourseIds.has(course.id);
            const isEnrolling = enrollingCourseId === course.id;

            return (
              <div key={course.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <BookOpen className="w-6 h-6 text-blue-600" />
                    </div>
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                      Public
                    </span>
                  </div>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {course.title}
                  </h3>
                  
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {course.description || 'No description available'}
                  </p>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      <span>Self-paced</span>
                    </div>
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-1" />
                      <span>Online</span>
                    </div>
                  </div>
                  
                  {isEnrolled ? (
                    <button
                      disabled
                      className="inline-flex items-center justify-center w-full px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg cursor-not-allowed"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Enrolled
                    </button>
                  ) : (
                    <button
                      onClick={() => handleEnroll(course.id)}
                      disabled={isEnrolling}
                      className="inline-flex items-center justify-center w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isEnrolling ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Enrolling...
                        </>
                      ) : (
                        <>
                          Enroll Now
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No courses available</h2>
          <p className="text-gray-600">
            There are no public courses available at the moment. Check back later!
          </p>
        </div>
      )}
    </div>
  );
}