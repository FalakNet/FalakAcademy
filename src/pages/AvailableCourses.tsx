import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase, Course } from '../lib/supabase';
import { BookOpen, Clock, Users, ChevronRight, Check, Info, X, Calendar, Eye, FileText, CreditCard, Crown, Star } from 'lucide-react';
import { formatCurrency } from '../lib/ziina';
import PaymentModal from '../components/PaymentModal';

interface CourseWithStats extends Course {
  enrollmentCount?: number;
  sectionCount?: number;
  contentCount?: number;
}

export default function AvailableCourses() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<CourseWithStats[]>([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set());
  const [enrollingCourseId, setEnrollingCourseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<CourseWithStats | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentCourse, setPaymentCourse] = useState<CourseWithStats | null>(null);
  const [filter, setFilter] = useState<'all' | 'free' | 'paid'>('all');

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

      // Load user's enrolled courses AND payments
      const [enrollmentsResponse, paymentsResponse] = await Promise.all([
        supabase
          .from('enrollments')
          .select('course_id')
          .eq('user_id', profile.id),
        supabase
          .from('payments')
          .select('course_id')
          .eq('user_id', profile.id)
          .eq('status', 'completed')
      ]);

      if (enrollmentsResponse.error) throw enrollmentsResponse.error;
      if (paymentsResponse.error) throw paymentsResponse.error;

      // Combine enrolled courses and paid courses
      const enrolledIds = new Set([
        ...(enrollmentsResponse.data?.map(e => e.course_id) || []),
        ...(paymentsResponse.data?.map(p => p.course_id) || [])
      ]);
      
      // Load additional stats for each course
      const coursesWithStats = await Promise.all(
        (publicCourses || []).map(async (course) => {
          // Get enrollment count
          const { count: enrollmentCount } = await supabase
            .from('enrollments')
            .select('*', { count: 'exact', head: true })
            .eq('course_id', course.id);

          // Get section count
          const { count: sectionCount } = await supabase
            .from('course_sections')
            .select('*', { count: 'exact', head: true })
            .eq('course_id', course.id)
            .eq('is_published', true);

          // Get content count
          const { data: sections } = await supabase
            .from('course_sections')
            .select('id')
            .eq('course_id', course.id)
            .eq('is_published', true);

          let contentCount = 0;
          if (sections && sections.length > 0) {
            const sectionIds = sections.map(s => s.id);
            const { count } = await supabase
              .from('section_content')
              .select('*', { count: 'exact', head: true })
              .in('section_id', sectionIds)
              .eq('is_published', true);
            contentCount = count || 0;
          }

          return {
            ...course,
            enrollmentCount: enrollmentCount || 0,
            sectionCount: sectionCount || 0,
            contentCount
          };
        })
      );
      
      setCourses(coursesWithStats);
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
      
      // Update enrollment count for the course
      setCourses(prev => prev.map(course => 
        course.id === courseId 
          ? { ...course, enrollmentCount: (course.enrollmentCount || 0) + 1 }
          : course
      ));
    } catch (error) {
      console.error('Error enrolling in course:', error);
      alert('Failed to enroll in course. Please try again.');
    } finally {
      setEnrollingCourseId(null);
    }
  };

  const handlePurchase = (course: CourseWithStats) => {
    setPaymentCourse(course);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = () => {
    // Reload courses to update enrollment status
    loadAvailableCourses();
  };

  const showCourseInfo = (course: CourseWithStats) => {
    setSelectedCourse(course);
    setShowInfoModal(true);
  };

  const getBackgroundImageUrl = (course: Course) => {
    if (!course.background_image_url) return null;
    
    const { data } = supabase.storage
      .from('course-backgrounds')
      .getPublicUrl(course.background_image_url);
    
    return data.publicUrl;
  };

  const filteredCourses = courses.filter(course => {
    if (filter === 'free') return course.course_type === 'free';
    if (filter === 'paid') return course.course_type === 'paid';
    return true;
  });

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Available Courses</h1>
          <p className="mt-2 text-gray-600">
            Discover and enroll in courses to expand your knowledge.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="mt-4 sm:mt-0">
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                filter === 'all'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              All Courses
            </button>
            <button
              onClick={() => setFilter('free')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                filter === 'free'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Free
            </button>
            <button
              onClick={() => setFilter('paid')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                filter === 'paid'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Premium
            </button>
          </div>
        </div>
      </div>

      {/* Courses Grid */}
      {filteredCourses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => {
            const isEnrolled = enrolledCourseIds.has(course.id);
            const isEnrolling = enrollingCourseId === course.id;
            const backgroundImageUrl = getBackgroundImageUrl(course);
            const isPaid = course.course_type === 'paid';
            const price = course.price && course.currency ? formatCurrency(course.price, course.currency) : null;

            return (
              <div key={course.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow overflow-hidden flex flex-col h-full">
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
                  
                  {/* Course Status Overlays */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100/90 text-green-800 backdrop-blur-sm">
                        Public
                      </span>
                      {isPaid && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white backdrop-blur-sm flex items-center">
                          <Crown className="w-3 h-3 mr-1" />
                          Premium
                        </span>
                      )}
                    </div>
                    
                    {isPaid && price && (
                      <span className="px-3 py-1 text-sm font-bold rounded-full bg-white/90 text-gray-900 backdrop-blur-sm">
                        {price}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-6 flex flex-col flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {course.title}
                  </h3>
                  
                  {/* Fixed 3-line description space */}
                  <div className="h-16 mb-4">
                    <p className="text-gray-600 text-sm line-clamp-3 leading-relaxed">
                      {course.description || 'No description available'}
                    </p>
                  </div>

                  {/* Course Stats */}
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                    <div className="flex items-center">
                      <Users className="w-3 h-3 mr-1" />
                      <span>{course.enrollmentCount || 0} enrolled</span>
                    </div>
                    <div className="flex items-center">
                      <FileText className="w-3 h-3 mr-1" />
                      <span>{course.contentCount || 0} lessons</span>
                    </div>
                    {isPaid && (
                      <div className="flex items-center">
                        <Star className="w-3 h-3 mr-1 text-yellow-500" />
                        <span className="text-yellow-600">Premium</span>
                      </div>
                    )}
                  </div>

                  {/* Spacer to push buttons to bottom */}
                  <div className="flex-1"></div>
                  
                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    {/* Info Button */}
                    <button
                      onClick={() => showCourseInfo(course)}
                      className="flex items-center justify-center px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      title="View course details"
                    >
                      <Info className="w-4 h-4" />
                    </button>

                    {/* Primary Action Button */}
                    {isEnrolled ? (
                      <button
                        disabled
                        className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg cursor-not-allowed"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Enrolled
                      </button>
                    ) : isPaid ? (
                      <button
                        onClick={() => handlePurchase(course)}
                        className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-sm font-medium rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all duration-200"
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
                        Purchase {price}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEnroll(course.id)}
                        disabled={isEnrolling}
                        className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isEnrolling ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Enrolling...
                          </>
                        ) : (
                          <>
                            Enroll Free
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
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
            {filter === 'free' 
              ? 'No free courses available at the moment.'
              : filter === 'paid'
              ? 'No premium courses available at the moment.'
              : 'There are no public courses available at the moment.'
            } Check back later!
          </p>
        </div>
      )}

      {/* Course Info Modal */}
      {showInfoModal && selectedCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="relative">
              {/* Background Image */}
              <div className="h-32 bg-gradient-to-r from-blue-500 to-purple-600 relative overflow-hidden">
                {getBackgroundImageUrl(selectedCourse) ? (
                  <img
                    src={getBackgroundImageUrl(selectedCourse)!}
                    alt={`${selectedCourse.title} background`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                    <BookOpen className="w-16 h-16 text-white opacity-50" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black bg-opacity-20"></div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setShowInfoModal(false)}
                className="absolute top-4 right-4 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Course Title Overlay */}
              <div className="absolute bottom-4 left-6 right-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">{selectedCourse.title}</h2>
                    <div className="flex items-center space-x-4 text-white/90 text-sm">
                      <span className="px-2 py-1 bg-green-500/80 rounded-full text-xs font-medium">
                        Public Course
                      </span>
                      {selectedCourse.course_type === 'paid' && (
                        <span className="px-2 py-1 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full text-xs font-medium flex items-center">
                          <Crown className="w-3 h-3 mr-1" />
                          Premium
                        </span>
                      )}
                      <div className="flex items-center">
                        <Users className="w-4 h-4 mr-1" />
                        <span>{selectedCourse.enrollmentCount || 0} enrolled</span>
                      </div>
                    </div>
                  </div>
                  
                  {selectedCourse.course_type === 'paid' && selectedCourse.price && selectedCourse.currency && (
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">
                        {formatCurrency(selectedCourse.price, selectedCourse.currency)}
                      </div>
                      <div className="text-sm text-white/80">One-time payment</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {/* Description */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">About This Course</h3>
                <p className="text-gray-700 leading-relaxed">
                  {selectedCourse.description || 'No description available for this course.'}
                </p>
              </div>

              {/* Course Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{selectedCourse.sectionCount || 0}</div>
                  <div className="text-sm text-gray-600">Sections</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{selectedCourse.contentCount || 0}</div>
                  <div className="text-sm text-gray-600">Lessons</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">
                    {selectedCourse.course_type === 'paid' ? 'Premium' : 'Free'}
                  </div>
                  <div className="text-sm text-gray-600">Access</div>
                </div>
              </div>

              {/* Course Details */}
              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div className="flex items-center">
                    <Calendar className="w-5 h-5 text-gray-400 mr-3" />
                    <span className="text-gray-700">Created</span>
                  </div>
                  <span className="text-gray-900 font-medium">
                    {new Date(selectedCourse.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>

                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div className="flex items-center">
                    <Eye className="w-5 h-5 text-gray-400 mr-3" />
                    <span className="text-gray-700">Visibility</span>
                  </div>
                  <span className="text-gray-900 font-medium">
                    {selectedCourse.is_public ? 'Public' : 'Private'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div className="flex items-center">
                    <Clock className="w-5 h-5 text-gray-400 mr-3" />
                    <span className="text-gray-700">Last Updated</span>
                  </div>
                  <span className="text-gray-900 font-medium">
                    {new Date(selectedCourse.updated_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>

                {selectedCourse.course_type === 'paid' && (
                  <div className="flex items-center justify-between py-3 border-b border-gray-100">
                    <div className="flex items-center">
                      <CreditCard className="w-5 h-5 text-gray-400 mr-3" />
                      <span className="text-gray-700">Price</span>
                    </div>
                    <span className="text-gray-900 font-medium">
                      {selectedCourse.price && selectedCourse.currency 
                        ? formatCurrency(selectedCourse.price, selectedCourse.currency)
                        : 'Not set'
                      }
                    </span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="flex justify-center">
                {enrolledCourseIds.has(selectedCourse.id) ? (
                  <button
                    disabled
                    className="inline-flex items-center px-8 py-3 bg-green-600 text-white text-lg font-medium rounded-lg cursor-not-allowed"
                  >
                    <Check className="w-5 h-5 mr-2" />
                    Already Enrolled
                  </button>
                ) : selectedCourse.course_type === 'paid' ? (
                  <button
                    onClick={() => {
                      setShowInfoModal(false);
                      handlePurchase(selectedCourse);
                    }}
                    className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-lg font-medium rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all duration-200"
                  >
                    <CreditCard className="w-5 h-5 mr-2" />
                    Purchase Course
                    {selectedCourse.price && selectedCourse.currency && (
                      <span className="ml-2">
                        {formatCurrency(selectedCourse.price, selectedCourse.currency)}
                      </span>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      handleEnroll(selectedCourse.id);
                      setShowInfoModal(false);
                    }}
                    disabled={enrollingCourseId === selectedCourse.id}
                    className="inline-flex items-center px-8 py-3 bg-blue-600 text-white text-lg font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {enrollingCourseId === selectedCourse.id ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Enrolling...
                      </>
                    ) : (
                      <>
                        Enroll in Course
                        <ChevronRight className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && paymentCourse && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setPaymentCourse(null);
          }}
          course={paymentCourse}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}