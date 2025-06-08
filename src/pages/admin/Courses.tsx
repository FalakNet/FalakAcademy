import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, Course, Profile } from '../../lib/supabase';
import { BookOpen, Plus, Edit2, Trash2, Users, Eye, EyeOff, Settings, UserPlus, Award, X, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import CertificateTemplateManager from '../../components/CertificateTemplateManager';

export default function AdminCourses() {
  const { profile, isAdmin } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [showCertificateModal, setShowCertificateModal] = useState<Course | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<Course | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [newCourse, setNewCourse] = useState({
    title: '',
    description: '',
    is_public: true
  });

  useEffect(() => {
    if (isAdmin()) {
      loadCourses();
    }
  }, [profile]);

  const loadCourses = async () => {
    try {
      let query = supabase.from('courses').select('*');
      
      // If not superadmin, only show courses they can manage
      if (profile?.role !== 'SUPERADMIN') {
        query = query.or(`created_by.eq.${profile?.id},id.in.(${await getCourseAdminCourses()})`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error('Error loading courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCourseAdminCourses = async () => {
    const { data } = await supabase
      .from('course_admins')
      .select('course_id')
      .eq('admin_id', profile?.id);
    
    return data?.map(ca => ca.course_id).join(',') || '';
  };

  const createCourse = async () => {
    try {
      const { error } = await supabase
        .from('courses')
        .insert({
          ...newCourse,
          created_by: profile?.id
        });

      if (error) throw error;

      loadCourses();
      setShowCreateModal(false);
      setNewCourse({ title: '', description: '', is_public: true });
    } catch (error) {
      console.error('Error creating course:', error);
      alert('Failed to create course');
    }
  };

  const updateCourse = async () => {
    if (!editingCourse) return;

    try {
      const { error } = await supabase
        .from('courses')
        .update({
          title: editingCourse.title,
          description: editingCourse.description,
          is_public: editingCourse.is_public
        })
        .eq('id', editingCourse.id);

      if (error) throw error;

      setCourses(courses.map(course => 
        course.id === editingCourse.id ? editingCourse : course
      ));
      setEditingCourse(null);
    } catch (error) {
      console.error('Error updating course:', error);
      alert('Failed to update course');
    }
  };

  const deleteCourse = async (course: Course) => {
    if (!course) return;

    setDeleting(true);
    try {
      // Delete content completions first (references section_content)
      const { data: sections } = await supabase
        .from('course_sections')
        .select('id')
        .eq('course_id', course.id);

      if (sections && sections.length > 0) {
        const sectionIds = sections.map(s => s.id);
        
        // Get all content IDs for these sections
        const { data: contentItems } = await supabase
          .from('section_content')
          .select('id')
          .in('section_id', sectionIds);

        if (contentItems && contentItems.length > 0) {
          const contentIds = contentItems.map(c => c.id);
          
          // Delete content completions
          await supabase
            .from('content_completions')
            .delete()
            .in('content_id', contentIds);
        }
      }

      // Delete quiz attempts and questions
      const { data: quizzes } = await supabase
        .from('quizzes')
        .select('id')
        .eq('course_id', course.id);

      if (quizzes && quizzes.length > 0) {
        const quizIds = quizzes.map(q => q.id);
        
        // Delete quiz attempts
        await supabase
          .from('quiz_attempts')
          .delete()
          .in('quiz_id', quizIds);

        // Delete questions
        await supabase
          .from('questions')
          .delete()
          .in('quiz_id', quizIds);
      }

      // Delete section content
      if (sections && sections.length > 0) {
        const sectionIds = sections.map(s => s.id);
        
        await supabase
          .from('section_content')
          .delete()
          .in('section_id', sectionIds);
      }

      // Delete course sections
      await supabase
        .from('course_sections')
        .delete()
        .eq('course_id', course.id);

      // Delete quizzes
      await supabase
        .from('quizzes')
        .delete()
        .eq('course_id', course.id);

      // Delete materials
      await supabase
        .from('materials')
        .delete()
        .eq('course_id', course.id);

      // Delete certificates
      await supabase
        .from('certificates')
        .delete()
        .eq('course_id', course.id);

      // Delete course completions
      await supabase
        .from('course_completions')
        .delete()
        .eq('course_id', course.id);

      // Delete assignments
      await supabase
        .from('assignments')
        .delete()
        .eq('course_id', course.id);

      // Delete course admins
      await supabase
        .from('course_admins')
        .delete()
        .eq('course_id', course.id);

      // Delete enrollments
      await supabase
        .from('enrollments')
        .delete()
        .eq('course_id', course.id);

      // Finally, delete the course itself
      const { error: courseError } = await supabase
        .from('courses')
        .delete()
        .eq('id', course.id);

      if (courseError) {
        throw new Error(`Failed to delete course: ${courseError.message}`);
      }

      // Reload courses from database to ensure UI is accurate
      await loadCourses();
      
      setShowDeleteModal(null);
      
      alert(`Course "${course.title}" and all related data have been successfully deleted.`);
    } catch (error) {
      alert(`Failed to delete course: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Reload courses to ensure UI is in sync with database
      await loadCourses();
    } finally {
      setDeleting(false);
    }
  };

  const toggleCourseVisibility = async (course: Course) => {
    try {
      const { error } = await supabase
        .from('courses')
        .update({ is_public: !course.is_public })
        .eq('id', course.id);

      if (error) throw error;

      setCourses(courses.map(c => 
        c.id === course.id ? { ...c, is_public: !c.is_public } : c
      ));
    } catch (error) {
      console.error('Error updating course visibility:', error);
      alert('Failed to update course visibility');
    }
  };

  const handleCourseUpdate = (updatedCourse: Course) => {
    setCourses(courses.map(course => 
      course.id === updatedCourse.id ? updatedCourse : course
    ));
  };

  const canDeleteCourse = (course: Course): boolean => {
    // Only superadmins and course creators can delete courses
    return profile?.role === 'SUPERADMIN' || course.created_by === profile?.id;
  };

  if (!isAdmin()) {
    return (
      <div className="text-center py-12">
        <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
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

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Course Management</h1>
          <p className="mt-2 text-sm sm:text-base text-gray-600">Create and manage courses in the system.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Course
        </button>
      </div>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {courses.map((course) => (
          <div key={course.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="p-4 sm:p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                  <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    course.is_public 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-orange-100 text-orange-800'
                  }`}>
                    {course.is_public ? 'Public' : 'Private'}
                  </span>
                  {course.certificate_template_url && (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                      Custom Cert
                    </span>
                  )}
                  <button
                    onClick={() => toggleCourseVisibility(course)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {course.is_public ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                {course.title}
              </h3>
              
              <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                {course.description || 'No description available'}
              </p>
              
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs sm:text-sm text-gray-500">
                  Created {new Date(course.created_at).toLocaleDateString()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <Link
                  to={`/admin/courses/${course.id}/content`}
                  className="flex items-center justify-center px-2 sm:px-3 py-2 text-xs sm:text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Settings className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  <span className="hidden sm:inline">Content</span>
                  <span className="sm:hidden">Edit</span>
                </Link>
                <Link
                  to={`/admin/courses/${course.id}/enrollments`}
                  className="flex items-center justify-center px-2 sm:px-3 py-2 text-xs sm:text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <UserPlus className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  <span className="hidden sm:inline">Students</span>
                  <span className="sm:hidden">Users</span>
                </Link>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                <div className="flex space-x-2">
                  <button
                    onClick={() => setEditingCourse(course)}
                    className="text-blue-600 hover:text-blue-800"
                    title="Edit course"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowCertificateModal(course)}
                    className="text-purple-600 hover:text-purple-800"
                    title="Certificate settings"
                  >
                    <Award className="w-4 h-4" />
                  </button>
                </div>
                {canDeleteCourse(course) && (
                  <button
                    onClick={() => setShowDeleteModal(course)}
                    className="text-red-600 hover:text-red-800"
                    title="Delete course"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {courses.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No courses yet</h2>
          <p className="text-gray-600">Create your first course to get started.</p>
        </div>
      )}

      {/* Create Course Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Create New Course</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={newCourse.title}
                    onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={newCourse.description}
                    onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_public"
                    checked={newCourse.is_public}
                    onChange={(e) => setNewCourse({ ...newCourse, is_public: e.target.checked })}
                    className="mr-2"
                  />
                  <label htmlFor="is_public" className="text-sm text-gray-700">
                    Make this course public (students can self-enroll)
                  </label>
                </div>
                {!newCourse.is_public && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <p className="text-sm text-orange-800">
                      <strong>Private Course:</strong> Only administrators can enroll students. 
                      Students cannot see or enroll in this course themselves.
                    </p>
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  onClick={createCourse}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 order-1 sm:order-2"
                >
                  Create Course
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Course Modal */}
      {editingCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Edit Course</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={editingCourse.title}
                    onChange={(e) => setEditingCourse({ ...editingCourse, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={editingCourse.description || ''}
                    onChange={(e) => setEditingCourse({ ...editingCourse, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="edit_is_public"
                    checked={editingCourse.is_public}
                    onChange={(e) => setEditingCourse({ ...editingCourse, is_public: e.target.checked })}
                    className="mr-2"
                  />
                  <label htmlFor="edit_is_public" className="text-sm text-gray-700">
                    Make this course public (students can self-enroll)
                  </label>
                </div>
                {!editingCourse.is_public && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <p className="text-sm text-orange-800">
                      <strong>Private Course:</strong> Only administrators can enroll students. 
                      Students cannot see or enroll in this course themselves.
                    </p>
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 mt-6">
                <button
                  onClick={() => setEditingCourse(null)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  onClick={updateCourse}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 order-1 sm:order-2"
                >
                  Update Course
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Course Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Delete Course</h3>
                  <p className="text-sm text-gray-600">This action cannot be undone</p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 mb-4">
                  Are you sure you want to delete <strong>"{showDeleteModal.title}"</strong>?
                </p>
                
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-medium text-red-800 mb-2">This will permanently delete:</h4>
                  <ul className="text-sm text-red-700 space-y-1">
                    <li>• All course content and sections</li>
                    <li>• All student enrollments and progress</li>
                    <li>• All quizzes and quiz attempts</li>
                    <li>• All course materials</li>
                    <li>• All certificates issued for this course</li>
                    <li>• All related data and analytics</li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
                <button
                  onClick={() => setShowDeleteModal(null)}
                  disabled={deleting}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 order-2 sm:order-1 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteCourse(showDeleteModal)}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 order-1 sm:order-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                      Deleting...
                    </>
                  ) : (
                    'Delete Course'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Certificate Template Modal */}
      {showCertificateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  Certificate Settings - {showCertificateModal.title}
                </h3>
                <button
                  onClick={() => setShowCertificateModal(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <CertificateTemplateManager 
                course={showCertificateModal}
                onUpdate={handleCourseUpdate}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}