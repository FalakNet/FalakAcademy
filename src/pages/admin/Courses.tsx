import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, Course } from '../../lib/supabase';
import { BookOpen, Plus, Edit2, Trash2, Users, Eye, EyeOff, Settings, UserPlus, Award, X, AlertTriangle, Upload, Image, Crown, CreditCard, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import CertificateTemplateManager from '../../components/CertificateTemplateManager';
import ConfirmModal from '../../components/ConfirmModal';
import AlertModal from '../../components/AlertModal';
import { getSupportedCurrencies, formatCurrency, convertToPaymentAmount } from '../../lib/ziina';

export default function AdminCourses() {
  const { profile, isAdmin } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [showCertificateModal, setShowCertificateModal] = useState<Course | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<Course | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploadingBackground, setUploadingBackground] = useState<string | null>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const [newCourse, setNewCourse] = useState({
    title: '',
    description: '',
    is_public: true,
    course_type: 'free' as 'free' | 'paid',
    price: '',
    currency: 'AED',
    enable_certificates: true
  });

  // Modal states
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'warning' | 'info';
    loading?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'warning',
    loading: false
  });

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'success' | 'error' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const supportedCurrencies = getSupportedCurrencies();

  useEffect(() => {
    if (isAdmin()) {
      loadCourses();
    }
  }, [profile]);

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setAlertModal({
      isOpen: true,
      title,
      message,
      type
    });
  };

  const showConfirm = (
    title: string, 
    message: string, 
    onConfirm: () => void, 
    type: 'danger' | 'warning' | 'info' = 'warning'
  ) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm,
      type,
      loading: false
    });
  };

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
      const courseData: any = {
        title: newCourse.title,
        description: newCourse.description,
        is_public: newCourse.is_public,
        course_type: newCourse.course_type,
        enable_certificates: newCourse.enable_certificates,
        created_by: profile?.id
      };

      // Add price and currency for paid courses
      if (newCourse.course_type === 'paid') {
        if (!newCourse.price || parseFloat(newCourse.price) <= 0) {
          showAlert('Validation Error', 'Please enter a valid price for paid courses.', 'warning');
          return;
        }
        
        const displayPrice = parseFloat(newCourse.price);
        const paymentAmount = convertToPaymentAmount(displayPrice, newCourse.currency);
        
        courseData.price = paymentAmount;
        courseData.currency = newCourse.currency;
      }

      const { error } = await supabase
        .from('courses')
        .insert(courseData);

      if (error) throw error;

      loadCourses();
      setShowCreateModal(false);
      setNewCourse({ 
        title: '', 
        description: '', 
        is_public: true, 
        course_type: 'free',
        price: '',
        currency: 'AED',
        enable_certificates: true
      });
      showAlert('Success', 'Course created successfully!', 'success');
    } catch (error) {
      console.error('Error creating course:', error);
      showAlert('Error', 'Failed to create course', 'error');
    }
  };

  const updateCourse = async () => {
    if (!editingCourse) return;

    try {
      const updateData: any = {
        title: editingCourse.title,
        description: editingCourse.description,
        is_public: editingCourse.is_public,
        course_type: editingCourse.course_type,
        enable_certificates: editingCourse.enable_certificates
      };

      // Handle price and currency for paid courses
      if (editingCourse.course_type === 'paid') {
        if (!editingCourse.price || editingCourse.price <= 0) {
          showAlert('Validation Error', 'Please enter a valid price for paid courses.', 'warning');
          return;
        }
        updateData.price = editingCourse.price;
        updateData.currency = editingCourse.currency;
      } else {
        // Clear price and currency for free courses
        updateData.price = null;
        updateData.currency = null;
      }

      const { error } = await supabase
        .from('courses')
        .update(updateData)
        .eq('id', editingCourse.id);

      if (error) throw error;

      setCourses(courses.map(course => 
        course.id === editingCourse.id ? editingCourse : course
      ));
      setEditingCourse(null);
      showAlert('Success', 'Course updated successfully!', 'success');
    } catch (error) {
      console.error('Error updating course:', error);
      showAlert('Error', 'Failed to update course', 'error');
    }
  };

  const handleBackgroundUpload = async (courseId: string, file: File) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showAlert('Invalid File', 'Please upload an image file', 'warning');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showAlert('File Too Large', 'Image size must be less than 5MB', 'warning');
      return;
    }

    setUploadingBackground(courseId);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${courseId}_${Date.now()}.${fileExt}`;

      // Upload to course-backgrounds bucket
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('course-backgrounds')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Update course with background image URL
      const { error: updateError } = await supabase
        .from('courses')
        .update({
          background_image_url: uploadData.path
        })
        .eq('id', courseId);

      if (updateError) throw updateError;

      // Update local state
      setCourses(courses.map(course => 
        course.id === courseId 
          ? { ...course, background_image_url: uploadData.path }
          : course
      ));

      showAlert('Success', 'Background image uploaded successfully!', 'success');
    } catch (error) {
      console.error('Error uploading background image:', error);
      showAlert('Upload Failed', 'Failed to upload background image', 'error');
    } finally {
      setUploadingBackground(null);
    }
  };

  const removeBackgroundImage = async (courseId: string, imagePath: string) => {
    showConfirm(
      'Remove Background Image',
      'Are you sure you want to remove the background image?',
      async () => {
        try {
          // Delete from storage
          const { error: deleteError } = await supabase.storage
            .from('course-backgrounds')
            .remove([imagePath]);

          if (deleteError) {
            console.warn('Could not delete file from storage:', deleteError);
          }

          // Update course to remove background image URL
          const { error: updateError } = await supabase
            .from('courses')
            .update({
              background_image_url: null
            })
            .eq('id', courseId);

          if (updateError) throw updateError;

          // Update local state
          setCourses(courses.map(course => 
            course.id === courseId 
              ? { ...course, background_image_url: undefined }
              : course
          ));

          showAlert('Success', 'Background image removed successfully!', 'success');
        } catch (error) {
          console.error('Error removing background image:', error);
          showAlert('Error', 'Failed to remove background image', 'error');
        }
      },
      'warning'
    );
  };

  const getBackgroundImageUrl = (course: Course) => {
    if (!course.background_image_url) return null;
    
    const { data } = supabase.storage
      .from('course-backgrounds')
      .getPublicUrl(course.background_image_url);
    
    return data.publicUrl;
  };

  const deleteCourse = async (course: Course) => {
    if (!course) return;

    showConfirm(
      'Delete Course',
      `Are you sure you want to delete "${course.title}"? This will permanently delete all course content, enrollments, quizzes, and certificates. This action cannot be undone.`,
      async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        
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

          // Delete payments
          await supabase
            .from('payments')
            .delete()
            .eq('course_id', course.id);

          // Delete enrollments
          await supabase
            .from('enrollments')
            .delete()
            .eq('course_id', course.id);

          // Delete background image from storage if exists
          if (course.background_image_url) {
            await supabase.storage
              .from('course-backgrounds')
              .remove([course.background_image_url]);
          }

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
          
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          showAlert('Success', `Course "${course.title}" and all related data have been successfully deleted.`, 'success');
        } catch (error) {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          showAlert('Delete Failed', `Failed to delete course: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
          
          // Reload courses to ensure UI is in sync with database
          await loadCourses();
        }
      },
      'danger'
    );
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
      showAlert('Error', 'Failed to update course visibility', 'error');
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
        {courses.map((course) => {
          const backgroundImageUrl = getBackgroundImageUrl(course);
          const isPaid = course.course_type === 'paid';
          const price = course.price && course.currency ? formatCurrency(course.price, course.currency) : null;
          
          return (
            <div key={course.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow overflow-hidden flex flex-col h-full">
              {/* Background Image Section */}
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
                
                {/* Background Image Controls */}
                <div className="absolute top-2 right-2 flex space-x-1">
                  <input
                    ref={backgroundInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleBackgroundUpload(course.id, file);
                      }
                    }}
                    className="hidden"
                  />
                  
                  <button
                    onClick={() => backgroundInputRef.current?.click()}
                    disabled={uploadingBackground === course.id}
                    className="p-1.5 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-colors disabled:opacity-50"
                    title="Upload background image"
                  >
                    {uploadingBackground === course.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                  </button>
                  
                  {backgroundImageUrl && (
                    <button
                      onClick={() => removeBackgroundImage(course.id, course.background_image_url!)}
                      className="p-1.5 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-colors"
                      title="Remove background image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Course Type and Price Overlay */}
                <div className="absolute top-2 left-2 flex items-center space-x-2">
                  {isPaid && (
                    <>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white backdrop-blur-sm flex items-center">
                        <Crown className="w-3 h-3 mr-1" />
                        Premium
                      </span>
                      <div className="flex items-center space-x-2">
                      {isPaid && price && (
                        <span
                          className={`
                            px-3 py-1 text-sm font-bold rounded-full
                            bg-white/90 text-gray-900 backdrop-blur-sm
                            dark:bg-gray-900/90 dark:text-white
                          `}
                        >
                          {price}
                        </span>
                      )}
                    </div>
                    </>
                  )}
                </div>
              </div>

              <div className="p-4 sm:p-6 flex flex-col flex-1">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex flex-wrap gap-1">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      course.is_public 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-orange-100 text-orange-800'
                    }`}>
                      {course.is_public ? 'Public' : 'Private'}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      isPaid
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {isPaid ? 'Paid' : 'Free'}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      course.enable_certificates
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {course.enable_certificates ? 'Certificates' : 'No Certificates'}
                    </span>
                    {course.certificate_template_url && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                        Custom Cert
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => toggleCourseVisibility(course)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {course.is_public ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                  {course.title}
                </h3>
                
                {/* Fixed 3-line description space */}
                <div className="h-16 mb-4">
                  <p className="text-gray-600 text-sm line-clamp-3 leading-relaxed">
                    {course.description || 'No description available'}
                  </p>
                </div>
                
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs sm:text-sm text-gray-500">
                    Created {new Date(course.created_at).toLocaleDateString()}
                  </span>
                </div>

                {/* Spacer to push buttons to bottom */}
                <div className="flex-1"></div>

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
                      onClick={() => deleteCourse(course)}
                      className="text-red-600 hover:text-red-800"
                      title="Delete course"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
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
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
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

                {/* Course Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Course Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                      newCourse.course_type === 'free'
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input
                        type="radio"
                        name="course_type"
                        value="free"
                        checked={newCourse.course_type === 'free'}
                        onChange={(e) => setNewCourse({ ...newCourse, course_type: e.target.value as 'free' | 'paid' })}
                        className="sr-only"
                      />
                      <div className="flex items-center">
                        <BookOpen className="w-5 h-5 text-blue-600 mr-2" />
                        <span className="font-medium">Free</span>
                      </div>
                    </label>
                    
                    <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                      newCourse.course_type === 'paid'
                        ? 'border-yellow-500 bg-yellow-50 ring-2 ring-yellow-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input
                        type="radio"
                        name="course_type"
                        value="paid"
                        checked={newCourse.course_type === 'paid'}
                        onChange={(e) => setNewCourse({ ...newCourse, course_type: e.target.value as 'free' | 'paid' })}
                        className="sr-only"
                      />
                      <div className="flex items-center">
                        <Crown className="w-5 h-5 text-yellow-600 mr-2" />
                        <span className="font-medium">Premium</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Price and Currency for Paid Courses */}
                {newCourse.course_type === 'paid' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newCourse.price}
                        onChange={(e) => setNewCourse({ ...newCourse, price: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                      <select
                        value={newCourse.currency}
                        onChange={(e) => setNewCourse({ ...newCourse, currency: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      >
                        {supportedCurrencies.map(currency => (
                          <option key={currency.code} value={currency.code}>
                            {currency.code} - {currency.symbol}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_public"
                    checked={newCourse.is_public}
                    onChange={(e) => setNewCourse({ ...newCourse, is_public: e.target.checked })}
                    className="mr-2"
                  />
                  <label htmlFor="is_public" className="text-sm text-gray-700">
                    Make this course public (students can see and enroll)
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="enable_certificates"
                    checked={newCourse.enable_certificates}
                    onChange={(e) => setNewCourse({ ...newCourse, enable_certificates: e.target.checked })}
                    className="mr-2"
                  />
                  <label htmlFor="enable_certificates" className="text-sm text-gray-700">
                    Issue certificates upon course completion
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Publish Date & Time</label>
                  <input
                    type="datetime-local"
                    value={newCourse.published_at || ''}
                    onChange={e => setNewCourse({ ...newCourse, published_at: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave blank to publish immediately.</p>
                </div>
                
                {!newCourse.is_public && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <p className="text-sm text-orange-800">
                      <strong>Private Course:</strong> Only administrators can enroll students. 
                      Students cannot see or enroll in this course themselves.
                    </p>
                  </div>
                )}

                {!newCourse.enable_certificates && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="flex items-start">
                      <Shield className="w-4 h-4 text-gray-600 mt-0.5 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">No Certificates</p>
                        <p className="text-sm text-gray-600 mt-1">
                          Students will not receive certificates when they complete this course. 
                          You can enable this later if needed.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {newCourse.course_type === 'paid' && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex items-start">
                      <CreditCard className="w-4 h-4 text-yellow-600 mt-0.5 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800">Premium Course</p>
                        <p className="text-sm text-yellow-600 mt-1">
                          Students will need to purchase this course before accessing the content. 
                          Payments are processed securely through Ziina.
                        </p>
                      </div>
                    </div>
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
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
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

                {/* Course Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Course Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                      editingCourse.course_type === 'free'
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input
                        type="radio"
                        name="edit_course_type"
                        value="free"
                        checked={editingCourse.course_type === 'free'}
                        onChange={(e) => setEditingCourse({ ...editingCourse, course_type: e.target.value as 'free' | 'paid' })}
                        className="sr-only"
                      />
                      <div className="flex items-center">
                        <BookOpen className="w-5 h-5 text-blue-600 mr-2" />
                        <span className="font-medium">Free</span>
                      </div>
                    </label>
                    
                    <label className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                      editingCourse.course_type === 'paid'
                        ? 'border-yellow-500 bg-yellow-50 ring-2 ring-yellow-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input
                        type="radio"
                        name="edit_course_type"
                        value="paid"
                        checked={editingCourse.course_type === 'paid'}
                        onChange={(e) => setEditingCourse({ ...editingCourse, course_type: e.target.value as 'free' | 'paid' })}
                        className="sr-only"
                      />
                      <div className="flex items-center">
                        <Crown className="w-5 h-5 text-yellow-600 mr-2" />
                        <span className="font-medium">Premium</span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Price and Currency for Paid Courses */}
                {editingCourse.course_type === 'paid' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editingCourse.price ? (editingCourse.price / (editingCourse.currency && ['BHD', 'KWD', 'OMR'].includes(editingCourse.currency) ? 1000 : 100)) : ''}
                        onChange={(e) => {
                          const displayPrice = parseFloat(e.target.value) || 0;
                          const paymentAmount = convertToPaymentAmount(displayPrice, editingCourse.currency || 'AED');
                          setEditingCourse({ ...editingCourse, price: paymentAmount });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                      <select
                        value={editingCourse.currency || 'AED'}
                        onChange={(e) => setEditingCourse({ ...editingCourse, currency: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      >
                        {supportedCurrencies.map(currency => (
                          <option key={currency.code} value={currency.code}>
                            {currency.code} - {currency.symbol}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="edit_is_public"
                    checked={editingCourse.is_public}
                    onChange={(e) => setEditingCourse({ ...editingCourse, is_public: e.target.checked })}
                    className="mr-2"
                  />
                  <label htmlFor="edit_is_public" className="text-sm text-gray-700">
                    Make this course public (students can see and enroll)
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="edit_enable_certificates"
                    checked={editingCourse.enable_certificates}
                    onChange={(e) => setEditingCourse({ ...editingCourse, enable_certificates: e.target.checked })}
                    className="mr-2"
                  />
                  <label htmlFor="edit_enable_certificates" className="text-sm text-gray-700">
                    Issue certificates upon course completion
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Publish Date & Time</label>
                  <input
                    type="datetime-local"
                    value={editingCourse.published_at ? new Date(editingCourse.published_at).toISOString().slice(0, 16) : ''}
                    onChange={e => setEditingCourse({ ...editingCourse, published_at: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave blank to publish immediately.</p>
                </div>
                
                {!editingCourse.is_public && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <p className="text-sm text-orange-800">
                      <strong>Private Course:</strong> Only administrators can enroll students. 
                      Students cannot see or enroll in this course themselves.
                    </p>
                  </div>
                )}

                {!editingCourse.enable_certificates && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="flex items-start">
                      <Shield className="w-4 h-4 text-gray-600 mt-0.5 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">No Certificates</p>
                        <p className="text-sm text-gray-600 mt-1">
                          Students will not receive certificates when they complete this course. 
                          You can enable this later if needed.
                        </p>
                      </div>
                    </div>
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
              
              {!showCertificateModal.enable_certificates && (
                <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-start">
                    <Shield className="w-5 h-5 text-gray-600 mt-0.5 mr-2" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">Certificates Disabled</p>
                      <p className="text-sm text-gray-600 mt-1">
                        Certificates are currently disabled for this course. To enable certificates, 
                        edit the course settings and check the "Issue certificates upon course completion" option.
                      </p>
                      <button
                        onClick={() => {
                          setShowCertificateModal(null);
                          setEditingCourse(showCertificateModal);
                        }}
                        className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                      >
                        Edit Course Settings
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {showCertificateModal.enable_certificates && (
                <CertificateTemplateManager 
                  course={showCertificateModal}
                  onUpdate={handleCourseUpdate}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Modals */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        loading={confirmModal.loading}
        confirmText={confirmModal.type === 'danger' ? 'Delete' : 'Confirm'}
        cancelText="Cancel"
      />

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />
    </div>
  );
}