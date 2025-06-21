import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase, Course, CourseCompletion } from '../lib/supabase';
import { BookOpen, Clock, Users, ChevronRight, Trophy, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface CourseWithCompletion extends Course {
  completion?: CourseCompletion;
  enrolled_at?: string;
}

export default function MyCourses() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMyCourses();
  }, [profile]);

  const loadMyCourses = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          *,
          courses (*)
        `)
        .eq('user_id', profile.id);

      if (error) throw error;

      const enrolledCourses = data?.map(enrollment => ({
        ...enrollment.courses,
        enrolled_at: enrollment.enrolled_at
      })) || [];

      // Get course completions for these courses
      const courseIds = enrolledCourses.map(course => course.id);
      
      if (courseIds.length > 0) {
        const { data: completions, error: completionsError } = await supabase
          .from('course_completions')
          .select('*')
          .eq('user_id', profile.id)
          .in('course_id', courseIds);

        if (completionsError) throw completionsError;

        // Map completions to courses
        const coursesWithCompletion = enrolledCourses.map(course => {
          const completion = completions?.find(c => c.course_id === course.id);
          return {
            ...course,
            completion
          };
        });

        setCourses(coursesWithCompletion);
      } else {
        setCourses(enrolledCourses);
      }
    } catch (error) {
      console.error('Error loading my courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBackgroundImageUrl = (course: Course) => {
    if (!course.background_image_url) return null;
    
    const { data } = supabase.storage
      .from('course-backgrounds')
      .getPublicUrl(course.background_image_url);
    
    return data.publicUrl;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 lg:p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Courses</h1>
        <p className="mt-2 text-gray-600">
          Continue your learning journey with these enrolled courses.
        </p>
      </div>

      {/* Courses Grid */}
      {courses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => {
            const isCompleted = !!course.completion;
            const backgroundImageUrl = getBackgroundImageUrl(course);
            
            return (
              <div key={course.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow overflow-hidden flex flex-col h-full">
                {/* Background Image Header */}
                <div className="relative h-32 bg-gradient-to-r from-blue-500 to-purple-600 flex-shrink-0">
                  {backgroundImageUrl ? (
                    <img
                      src={backgroundImageUrl}
                      alt={`${course.title} background`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                      <BookOpen className="w-12 h-12 text-white opacity-50" />
                    </div>
                  )}
                  
                  {/* Course Status Overlay */}
                  <div className="absolute top-3 right-3 flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full backdrop-blur-sm ${
                      course.is_public 
                        ? 'bg-green-100/90 text-green-800' 
                        : 'bg-orange-100/90 text-orange-800'
                    }`}>
                      {course.is_public ? 'Public' : 'Private'}
                    </span>
                    {isCompleted && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-emerald-100/90 text-emerald-800 flex items-center backdrop-blur-sm">
                        <Trophy className="w-3 h-3 mr-1" />
                        Completed
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 flex flex-col flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {course.title}
                  </h3>
                  
                  {/* Fixed 3-line description space */}
                  <div className="h-16 mb-4">
                    <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-3 leading-relaxed">
                      {course.description || 'No description available'}
                    </p>
                  </div>

                  {/* Spacer to push button to bottom */}
                  <div className="flex-1"></div>
                  
                  <Link
                    to={`/courses/${course.id}`}
                    className={`inline-flex items-center justify-center w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isCompleted
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isCompleted ? (
                      <>
                        <Trophy className="w-4 h-4 mr-2" />
                        View Details & Certificate
                      </>
                    ) : (
                      <>
                        Continue Learning
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No courses yet</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You haven't enrolled in any courses. Explore available courses to start learning!
          </p>
          <Link
            to="/available-courses"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Browse Courses
            <ChevronRight className="w-4 h-4 ml-2" />
          </Link>
        </div>
      )}
    </div>
  );
}