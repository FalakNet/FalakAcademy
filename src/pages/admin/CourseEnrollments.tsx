import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase, Course, Profile, Enrollment } from '../../lib/supabase';
import { 
  Users, ArrowLeft, Plus, Trash2, Search, Check, X, 
  UserPlus, UserMinus, Filter, ChevronDown, ChevronUp,
  Mail, Calendar, BookOpen
} from 'lucide-react';

interface EnrollmentWithProfile extends Enrollment {
  profiles: Profile;
}

export default function CourseEnrollments() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { profile, isAdmin, isSuperAdmin } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [enrolledUsers, setEnrolledUsers] = useState<EnrollmentWithProfile[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [enrolling, setEnrolling] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'enrolled_at'>('enrolled_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (courseId && isAdmin()) {
      loadCourseData();
    }
  }, [courseId, profile]);

  const loadCourseData = async () => {
    if (!courseId) return;

    try {
      // Load course details
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (courseError) throw courseError;

      // Check if user has permission to manage this course
      if (!isSuperAdmin() && courseData.created_by !== profile?.id) {
        // Check if user is a course admin for this course
        const { data: adminCheck } = await supabase
          .from('course_admins')
          .select('*')
          .eq('course_id', courseId)
          .eq('admin_id', profile?.id)
          .single();

        if (!adminCheck) {
          alert('You do not have permission to manage enrollments for this course.');
          navigate('/admin/courses');
          return;
        }
      }

      // Load enrolled users with their profiles (including email)
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('enrollments')
        .select(`
          *,
          profiles (*)
        `)
        .eq('course_id', courseId)
        .order('enrolled_at', { ascending: false });

      if (enrollmentsError) throw enrollmentsError;

      // Load all users who are not enrolled in this course
      const enrolledUserIds = enrollmentsData?.map(e => e.user_id) || [];
      
      let availableQuery = supabase
        .from('profiles')
        .select('*')
        .eq('role', 'USER'); // Only regular users can be enrolled

      if (enrolledUserIds.length > 0) {
        availableQuery = availableQuery.not('id', 'in', `(${enrolledUserIds.join(',')})`);
      }

      const { data: availableData, error: availableError } = await availableQuery
        .order('name');

      if (availableError) throw availableError;

      setCourse(courseData);
      setEnrolledUsers(enrollmentsData || []);
      setAvailableUsers(availableData || []);
    } catch (error) {
      console.error('Error loading course data:', error);
      alert('Failed to load course data');
      navigate('/admin/courses');
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollUsers = async () => {
    if (!courseId || selectedUsers.size === 0) return;

    setEnrolling(true);
    try {
      const enrollments = Array.from(selectedUsers).map(userId => ({
        user_id: userId,
        course_id: courseId
      }));

      const { error } = await supabase
        .from('enrollments')
        .insert(enrollments);

      if (error) throw error;

      // Reload data
      await loadCourseData();
      setShowAddModal(false);
      setSelectedUsers(new Set());
    } catch (error) {
      console.error('Error enrolling users:', error);
      alert('Failed to enroll users');
    } finally {
      setEnrolling(false);
    }
  };

  const handleUnenrollUser = async (enrollmentId: string, userName: string) => {
    if (!confirm(`Are you sure you want to remove "${userName}" from this course? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('enrollments')
        .delete()
        .eq('id', enrollmentId);

      if (error) throw error;

      // Reload data
      await loadCourseData();
    } catch (error) {
      console.error('Error unenrolling user:', error);
      alert('Failed to remove student from course');
    }
  };

  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const filteredAvailableUsers = availableUsers.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const sortedEnrolledUsers = [...enrolledUsers].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'name':
        comparison = a.profiles.name.localeCompare(b.profiles.name);
        break;
      case 'enrolled_at':
        comparison = new Date(a.enrolled_at).getTime() - new Date(b.enrolled_at).getTime();
        break;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  if (!isAdmin()) {
    return (
      <div className="text-center py-12">
        <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600">You need admin privileges to access this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-12">
        <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Course Not Found</h2>
        <p className="text-gray-600">The course you're looking for doesn't exist.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/admin/courses')}
            className="mr-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Course Enrollments</h1>
            <p className="mt-2 text-gray-600">
              Manage student enrollments for "{course.title}"
            </p>
            <div className="flex items-center mt-1 text-sm text-gray-500">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                course.is_public 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-orange-100 text-orange-800'
              }`}>
                {course.is_public ? 'Public Course' : 'Private Course'}
              </span>
            </div>
          </div>
        </div>
        
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Add Students
        </button>
      </div>

      {/* Course Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{enrolledUsers.length}</div>
            <div className="text-sm text-gray-600">Enrolled Students</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{availableUsers.length}</div>
            <div className="text-sm text-gray-600">Available Students</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">
              {course.is_public ? 'Open' : 'Managed'}
            </div>
            <div className="text-sm text-gray-600">Enrollment Type</div>
          </div>
        </div>
      </div>

      {/* Public Course Notice */}
      {course.is_public && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <BookOpen className="w-5 h-5 text-blue-600 mt-0.5 mr-2" />
            <div>
              <p className="text-sm font-medium text-blue-800">Public Course</p>
              <p className="text-sm text-blue-600 mt-1">
                This is a public course. Students can enroll themselves from the "Available Courses" page. 
                You can manually add or remove students as needed for administrative purposes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Enrolled Students */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Enrolled Students</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setSortBy(sortBy === 'name' ? 'enrolled_at' : 'name')}
                className="flex items-center text-sm text-gray-600 hover:text-gray-900"
              >
                Sort by {sortBy === 'name' ? 'Date' : 'Name'}
                {sortOrder === 'asc' ? (
                  <ChevronUp className="w-4 h-4 ml-1" />
                ) : (
                  <ChevronDown className="w-4 h-4 ml-1" />
                )}
              </button>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Student
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Enrolled Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedEnrolledUsers.map((enrollment) => (
                <tr key={enrollment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold">
                          {enrollment.profiles.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {enrollment.profiles.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {enrollment.profiles.role}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <Mail className="w-4 h-4 mr-2 text-gray-400" />
                      <span className={!enrollment.profiles.email ? 'text-gray-400 italic' : ''}>
                        {enrollment.profiles.email || 'Email not available'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-500">
                      <Calendar className="w-4 h-4 mr-2" />
                      {new Date(enrollment.enrolled_at).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(enrollment.enrolled_at).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleUnenrollUser(enrollment.id, enrollment.profiles.name)}
                      className="text-red-600 hover:text-red-900"
                      title="Remove from course"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {enrolledUsers.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No students enrolled</h3>
            <p className="text-gray-600">
              {course.is_public 
                ? 'Students can enroll themselves from the Available Courses page, or you can manually add them using the "Add Students" button above.'
                : 'Add students to this private course using the "Add Students" button above.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Add Students Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Add Students to Course</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Search */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Search students by name or email..."
                  />
                </div>
              </div>

              {/* Selected count */}
              {selectedUsers.size > 0 && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    {selectedUsers.size} student{selectedUsers.size !== 1 ? 's' : ''} selected
                  </p>
                </div>
              )}

              {/* Available students list */}
              <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                {filteredAvailableUsers.length > 0 ? (
                  <div className="divide-y divide-gray-200">
                    {filteredAvailableUsers.map((user) => (
                      <label
                        key={user.id}
                        className="flex items-center p-4 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(user.id)}
                          onChange={() => toggleUserSelection(user.id)}
                          className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div className="flex items-center flex-1">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                            <span className="text-gray-600 font-semibold">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-3 flex-1">
                            <div className="text-sm font-medium text-gray-900">
                              {user.name}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center">
                              <Mail className="w-3 h-3 mr-1" />
                              <span className={!user.email ? 'text-gray-400 italic' : ''}>
                                {user.email || 'Email not available'}
                              </span>
                            </div>
                            <div className="text-xs text-gray-400">
                              Joined {new Date(user.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">
                      {searchTerm 
                        ? 'No students found matching your search.'
                        : 'All students are already enrolled in this course.'
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleEnrollUsers}
                disabled={selectedUsers.size === 0 || enrolling}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {enrolling ? 'Enrolling...' : `Enroll ${selectedUsers.size} Student${selectedUsers.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}