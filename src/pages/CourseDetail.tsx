import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePlatformSettings } from '../hooks/usePlatformSettings';
import { supabase, Course, CourseSection, SectionContent, ContentCompletion } from '../lib/supabase';
import { 
  BookOpen, Play, FileText, Brain, File, Image, 
  ChevronDown, ChevronRight, CheckCircle, Clock, 
  ArrowLeft, ArrowRight, Award, Eye, Download, 
  Menu, X, Trophy, Target
} from 'lucide-react';
import CertificateGenerator from '../components/CertificateGenerator';
import MarkdownRenderer from '../components/MarkdownRenderer';
import AlertModal from '../components/AlertModal';

interface SectionWithContent extends CourseSection {
  content: SectionContent[];
}

interface ContentWithCompletion extends SectionContent {
  completed?: boolean;
  completion?: ContentCompletion;
}

export default function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { settings } = usePlatformSettings();
  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<SectionWithContent[]>([]);
  const [allSections, setAllSections] = useState<SectionWithContent[]>([]); // All sections including unpublished
  const [currentContent, setCurrentContent] = useState<ContentWithCompletion | null>(null);
  const [completions, setCompletions] = useState<Map<string, ContentCompletion>>(new Map());
  const [courseCompletion, setCourseCompletion] = useState<any>(null);
  const [certificate, setCertificate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Sidebar closed by default
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
  });

  useEffect(() => {
    if (courseId && profile) {
      loadCourseData();
    }
  }, [courseId, profile]);

  // Load last viewed content from localStorage
  useEffect(() => {
    if (sections.length > 0 && !currentContent) {
      const lastViewedKey = `lastViewed_${courseId}`;
      const lastViewed = localStorage.getItem(lastViewedKey);
      
      if (lastViewed) {
        const content = findContentById(lastViewed);
        if (content) {
          setCurrentContent(content);
          return;
        }
      }
      
      // Default to first content item
      const firstSection = sections.find(s => s.content.length > 0);
      if (firstSection && firstSection.content.length > 0) {
        setCurrentContent(firstSection.content[0]);
      }
    }
  }, [sections, courseId]);

  // Save current content to localStorage
  useEffect(() => {
    if (currentContent && courseId) {
      const lastViewedKey = `lastViewed_${courseId}`;
      localStorage.setItem(lastViewedKey, currentContent.id);
    }
  }, [currentContent, courseId]);

  const loadCourseData = async () => {
    if (!courseId || !profile) return;

    try {
      // Load course details
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (courseError) throw courseError;

      // Check if user is enrolled
      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('*')
        .eq('user_id', profile.id)
        .eq('course_id', courseId)
        .single();

      if (!enrollment) {
        setAlertModal({
          isOpen: true,
          title: 'Not Enrolled',
          message: 'You are not enrolled in this course.',
          type: 'warning',
        });
        navigate('/available-courses');
        return;
      }

      // Check if course is already completed - use maybeSingle() instead of single()
      const { data: completionData } = await supabase
        .from('course_completions')
        .select('*')
        .eq('user_id', profile.id)
        .eq('course_id', courseId)
        .maybeSingle();

      setCourseCompletion(completionData);

      // Load certificate if course is completed
      if (completionData) {
        const { data: certificateData } = await supabase
          .from('certificates')
          .select(`
            *,
            courses (*)
          `)
          .eq('user_id', profile.id)
          .eq('course_id', courseId)
          .maybeSingle();

        setCertificate(certificateData);
      }

      // Load ALL sections (including unpublished) for progress calculation
      const { data: allSectionsData, error: allSectionsError } = await supabase
        .from('course_sections')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index');

      if (allSectionsError) throw allSectionsError;

      // Load published sections for display
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('course_sections')
        .select('*')
        .eq('course_id', courseId)
        .or('published_at.is.null,published_at.lte.' + new Date().toISOString())
        .order('order_index');

      if (sectionsError) throw sectionsError;

      // Load ALL content (including unpublished) for each section for progress calculation
      const allSectionsWithContent = await Promise.all(
        (allSectionsData || []).map(async (section) => {
          const { data: contentData, error: contentError } = await supabase
            .from('section_content')
            .select('*')
            .eq('section_id', section.id)
            .order('order_index');

          if (contentError) {
            console.error('Error loading content for section:', section.id, contentError);
            return { ...section, content: [] };
          }

          return { ...section, content: contentData || [] };
        })
      );

      // Load published content for each published section for display
      const sectionsWithContent = await Promise.all(
        (sectionsData || []).map(async (section) => {
          const { data: contentData, error: contentError } = await supabase
            .from('section_content')
            .select('*')
            .eq('section_id', section.id)
            .eq('is_published', true)
            .order('order_index');

          if (contentError) {
            console.error('Error loading content for section:', section.id, contentError);
            return { ...section, content: [] };
          }

          return { ...section, content: contentData || [] };
        })
      );

      // Load user's content completions for ALL content (including unpublished)
      const allContentIds = allSectionsWithContent.flatMap(s => s.content.map(c => c.id));
      if (allContentIds.length > 0) {
        const { data: completionsData } = await supabase
          .from('content_completions')
          .select('*')
          .eq('user_id', profile.id)
          .in('content_id', allContentIds);

        const completionsMap = new Map();
        completionsData?.forEach(completion => {
          completionsMap.set(completion.content_id, completion);
        });
        setCompletions(completionsMap);
      }

      setCourse(courseData);
      setSections(sectionsWithContent);
      setAllSections(allSectionsWithContent); // Store all sections for progress calculation
      
      // Expand sections that have content
      const sectionsWithContentIds = new Set(
        sectionsWithContent.filter(s => s.content.length > 0).map(s => s.id)
      );
      setExpandedSections(sectionsWithContentIds);

    } catch (error) {
      console.error('Error loading course data:', error);
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: 'Failed to load course data',
        type: 'error',
      });
      navigate('/my-courses');
    } finally {
      setLoading(false);
    }
  };

  const findContentById = (contentId: string): ContentWithCompletion | null => {
    for (const section of sections) {
      const content = section.content.find(c => c.id === contentId);
      if (content) {
        return {
          ...content,
          completed: completions.has(content.id),
          completion: completions.get(content.id)
        };
      }
    }
    return null;
  };

  const getAllContent = (): ContentWithCompletion[] => {
    return sections.flatMap(section => 
      section.content.map(content => ({
        ...content,
        completed: completions.has(content.id),
        completion: completions.get(content.id)
      }))
    );
  };

  // Get ALL content including unpublished for progress calculation
  const getAllContentIncludingUnpublished = (): ContentWithCompletion[] => {
    return allSections.flatMap(section => 
      section.content.map(content => ({
        ...content,
        completed: completions.has(content.id),
        completion: completions.get(content.id)
      }))
    );
  };

  const getCurrentContentIndex = (): number => {
    if (!currentContent) return -1;
    const allContent = getAllContent();
    return allContent.findIndex(c => c.id === currentContent.id);
  };

  const navigateToContent = (direction: 'prev' | 'next') => {
    const allContent = getAllContent();
    const currentIndex = getCurrentContentIndex();
    
    if (currentIndex === -1) return;
    
    let newIndex;
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
    } else {
      newIndex = currentIndex < allContent.length - 1 ? currentIndex + 1 : currentIndex;
    }
    
    if (newIndex !== currentIndex) {
      setCurrentContent(allContent[newIndex]);
    }
  };

  const canMarkContentComplete = (content: ContentWithCompletion): { canComplete: boolean; reason?: string } => {
    // If already completed, can't complete again
    if (content.completed) {
      return { canComplete: false, reason: 'Already completed' };
    }

    return { canComplete: true };
  };

  const markContentComplete = async (contentId: string) => {
    if (!profile) return;

    // Find the content to check if it can be completed
    const content = findContentById(contentId);
    if (!content) return;

    const { canComplete, reason } = canMarkContentComplete(content);
    if (!canComplete) {
      setAlertModal({
        isOpen: true,
        title: 'Cannot Complete',
        message: reason || 'Cannot mark this content as complete',
        type: 'warning',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('content_completions')
        .insert({
          user_id: profile.id,
          content_id: contentId,
          time_spent_minutes: 1 // Default value, could be tracked more accurately
        });

      if (error) throw error;

      // Update local state
      const newCompletion = {
        id: crypto.randomUUID(),
        user_id: profile.id,
        content_id: contentId,
        completed_at: new Date().toISOString(),
        time_spent_minutes: 1
      };

      setCompletions(prev => new Map(prev.set(contentId, newCompletion)));

      // Update current content if it's the one being marked complete
      if (currentContent && currentContent.id === contentId) {
        setCurrentContent({
          ...currentContent,
          completed: true,
          completion: newCompletion
        });
      }

      // Check if all PUBLISHED content is now completed (for course completion)
      const allPublishedContent = getAllContent();
      const newCompletedCount = completions.size + 1; // +1 for the one we just completed
      
      if (newCompletedCount === allPublishedContent.length && allPublishedContent.length > 0) {
        // All published content completed, show completion modal
        setShowCompletionModal(true);
      }
    } catch (error) {
      console.error('Error marking content complete:', error);
    }
  };

  const completeCourse = async () => {
    if (!courseId || !profile || courseCompletion) return;

    try {
      const { error } = await supabase
        .from('course_completions')
        .insert({
          user_id: profile.id,
          course_id: courseId,
          completion_percentage: 100
        });

      if (error) throw error;

      // Reload course data to get the completion and certificate
      await loadCourseData();
      setShowCompletionModal(false);
      
      // Show certificate modal if certificates are enabled for this course
      if (course?.enable_certificates) {
        setShowCertificateModal(true);
      }
      
    } catch (error) {
      console.error('Error completing course:', error);
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: 'Failed to complete course. Please try again.',
        type: 'error',
      });
    }
  };

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const renderContent = () => {
    if (!currentContent) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Content Selected</h3>
            <p className="text-gray-600 dark:text-gray-400">Select a content item from the sidebar to begin.</p>
          </div>
        </div>
      );
    }

    const contentData = currentContent.content_data || {};

    switch (currentContent.content_type) {
      case 'text':
        return (
          <div className="prose max-w-none dark:prose-invert">
            <MarkdownRenderer 
              content={contentData.text || 'No text content available.'} 
              className="text-gray-900 dark:text-white"
            />
          </div>
        );

      case 'video':
        return (
          <div className="space-y-4">
            {contentData.embedUrl || contentData.url ? (
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <iframe
                  src={contentData.embedUrl || contentData.url}
                  className="w-full h-full"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={currentContent.title}
                />
              </div>
            ) : (
              <div className="aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <Play className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">Video not available</p>
                </div>
              </div>
            )}
            
            {contentData.description && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">About this video</h4>
                <MarkdownRenderer 
                  content={contentData.description} 
                  className="text-gray-700 dark:text-gray-300"
                />
              </div>
            )}

            {contentData.transcript && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Transcript</h4>
                <MarkdownRenderer 
                  content={contentData.transcript} 
                  className="text-sm text-gray-700 dark:text-gray-300"
                />
              </div>
            )}
          </div>
        );

      case 'image':
        return (
          <div className="space-y-4">
            {contentData.url ? (
              <div className="text-center">
                <img
                  src={contentData.url}
                  alt={contentData.alt || currentContent.title}
                  className="max-w-full h-auto rounded-lg shadow-sm mx-auto"
                />
                {contentData.caption && (
                  <div className="mt-2">
                    <MarkdownRenderer 
                      content={contentData.caption} 
                      className="text-sm text-gray-600 dark:text-gray-400 italic"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 text-center">
                <Image className="w-16 h-16 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400">Image not available</p>
              </div>
            )}
          </div>
        );

      case 'file':
        return (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
              <div className="flex items-center">
                <File className="w-8 h-8 text-blue-600 dark:text-blue-400 mr-3" />
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {contentData.filename || 'Download File'}
                  </h4>
                  {contentData.description && (
                    <div className="mt-1">
                      <MarkdownRenderer 
                        content={contentData.description} 
                        className="text-sm text-gray-600 dark:text-gray-400"
                      />
                    </div>
                  )}
                </div>
                {contentData.url && (
                  <a
                    href={contentData.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </a>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center py-8">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Content type not supported</p>
          </div>
        );
    }
  };

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
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Course not found</h2>
        <p className="text-gray-600 dark:text-gray-400">The course you're looking for doesn't exist or you don't have access to it.</p>
      </div>
    );
  }

  // Disable all quiz support if platform setting is off
  if (settings && settings.enable_quizzes === false) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Quizzes are currently disabled</h1>
          <p className="text-gray-600 dark:text-gray-400">The platform administrator has disabled quiz functionality. Please check back later or contact support for more information.</p>
        </div>
      </div>
    );
  }

  const allContent = getAllContent();
  const allContentIncludingUnpublished = getAllContentIncludingUnpublished();
  const currentIndex = getCurrentContentIndex();
  
  // Use all content (including unpublished) for progress calculation
  const completedCount = allContentIncludingUnpublished.filter(c => c.completed).length;
  const totalContentCount = allContentIncludingUnpublished.length;
  const progressPercentage = totalContentCount > 0 ? (completedCount / totalContentCount) * 100 : 0;
  
  // For course completion, still use only published content
  const publishedCompletedCount = allContent.filter(c => c.completed).length;
  const isFullyCompleted = publishedCompletedCount === allContent.length && allContent.length > 0;

  // Handler for selecting content from sidebar
  function handleSelectContent(content, isCompleted) {
    setCurrentContent({
      ...content,
      completed: isCompleted,
      completion: completions.get(content.id)
    });
  }

  return (
    <>
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900 relative overflow-hidden">
        {/* Sidebar overlay for mobile */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}
        {/* Sidebar */}
        
        <aside className={`fixed z-50 top-0 left-0 h-full w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:static lg:translate-x-0 lg:w-80`}>
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 lg:hidden">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">{course?.title}</h2>
            <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="overflow-y-auto h-full pb-24 lg:pb-0">
            {sections.map((section) => (
              <SidebarSection
                key={section.id}
                section={section}
                expanded={expandedSections.has(section.id)}
                onToggle={() => toggleSection(section.id)}
                onSelectContent={handleSelectContent}
                currentContentId={currentContent?.id}
                completions={completions}
              />
            ))}
          </div>
        </aside>
        {/* Main content - full height, no card, minimal padding */}
        <main className="flex-1 flex flex-col min-w-0 h-full">
          {/* Top bar for mobile */}
          <div className="flex items-center justify-between bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 lg:hidden sticky top-0 z-30">
            <button onClick={() => setSidebarOpen(true)} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-base font-bold text-gray-900 dark:text-white truncate">{course?.title}</h1>
            <div className="w-6 h-6" />
          </div>
          {/* Main content area - no card, just content */}
          <div className="flex-1 overflow-y-auto h-full w-full px-0 sm:px-2 lg:px-6 py-2 lg:py-6">
            {renderContent()}
          </div>
          {/* Sticky bottom nav for all screens */}
          <MobileNavBar
            currentIndex={currentIndex}
            allContent={allContent}
            currentContent={currentContent}
            canMarkContentComplete={canMarkContentComplete}
            markContentComplete={markContentComplete}
            navigateToContent={navigateToContent}
          />
        </main>
      </div>

      {/* Course Completion Modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 w-full max-w-md mx-4">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trophy className="w-10 h-10 text-white" />
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                🎉 Congratulations!
              </h2>
              
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                You have completed all the content in this course.
                {course.enable_certificates ? " Are you ready to receive your certificate of completion?" : ""}
              </p>

              {course.enable_certificates && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                  <div className="flex items-start">
                    <Award className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-2" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Certificate Benefits</p>
                      <ul className="text-sm text-blue-600 dark:text-blue-300 mt-1 space-y-1">
                        <li>• Official completion certificate</li>
                        <li>• Downloadable PDF format</li>
                        <li>• Unique certificate number</li>
                        <li>• Shareable achievement</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {!course.enable_certificates && (
                <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 mb-6">
                  <div className="flex items-start">
                    <Shield className="w-5 h-5 text-gray-600 dark:text-gray-400 mt-0.5 mr-2" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">No Certificate Available</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        This course does not issue certificates upon completion. Your progress and completion status will still be recorded.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowCompletionModal(false)}
                  className="flex-1 px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Not Yet
                </button>
                <button
                  onClick={completeCourse}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-200"
                >
                  {course.enable_certificates ? "Get My Certificate!" : "Complete Course"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Certificate Modal */}
      {showCertificateModal && certificate && course.enable_certificates && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Your Certificate</h2>
                <button
                  onClick={() => setShowCertificateModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <CertificateGenerator 
                certificate={certificate} 
                profile={profile!}
                onDownload={() => {
                  console.log('Certificate downloaded:', certificate.certificate_number);
                }}
              />
              
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  🎉 Congratulations on completing the course! Your certificate is ready for download.
                </p>
                <button
                  onClick={() => {
                    setShowCertificateModal(false);
                    navigate('/certificates');
                  }}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  View All Certificates
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// --- Reusable SidebarSection component ---
function SidebarSection({ section, expanded, onToggle, onSelectContent, currentContentId, completions }) {
  return (
    <div className="border-b border-gray-100 dark:border-gray-700">
      <button
        onClick={onToggle}
        className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="font-medium text-gray-900 dark:text-white">{section.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{section.content.length} items</p>
          </div>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>
      {expanded && (
        <div className="pb-2">
          {section.content.map((content) => {
            const isCompleted = completions.has(content.id);
            const isCurrent = currentContentId === content.id;
            return (
              <button
                key={content.id}
                onClick={() => onSelectContent(content, isCompleted)}
                className={`w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-l-2 ${isCurrent ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-transparent'}`}
              >
                <div className="flex items-center ml-4">
                  {getContentIcon(content.content_type)}
                  <div className="ml-3 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className={`text-sm font-medium ${isCurrent ? 'text-blue-900 dark:text-blue-200' : 'text-gray-900 dark:text-white'}`}>{content.title}</h4>
                      <div className="flex items-center space-x-1">
                        {isCompleted && <CheckCircle className="w-4 h-4 text-green-500" />}
                      </div>
                    </div>
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span className="capitalize">{content.content_type}</span>
                      {content.duration_minutes > 0 && (<><span className="mx-1">•</span><Clock className="w-3 h-3 mr-1" /><span>{content.duration_minutes} min</span></>)}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Reusable MobileNavBar component ---
function MobileNavBar({ currentIndex, allContent, currentContent, canMarkContentComplete, markContentComplete, navigateToContent }) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 w-full z-30 pointer-events-none lg:sticky lg:bottom-0 lg:left-auto lg:right-auto lg:w-full lg:max-w-screen-xl lg:mx-auto lg:px-6 lg:pb-0 lg:pointer-events-auto"
    >
      <div
        className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg flex items-center justify-between px-2 py-2 space-x-2
          rounded-t-xl border-t pointer-events-auto transition-all duration-200 min-h-[56px] lg:min-h-[72px]
          w-full"
      >
        <button
          onClick={() => navigateToContent('prev')}
          disabled={currentIndex <= 0}
          className="flex-1 inline-flex items-center justify-center py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs lg:text-base"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Prev
        </button>
        {currentContent && !currentContent.completed && (() => {
          const { canComplete } = canMarkContentComplete(currentContent);
          return (
            <button
              onClick={() => canComplete ? markContentComplete(currentContent.id) : null}
              disabled={!canComplete}
              className="flex-1 inline-flex items-center justify-center py-2 rounded-lg transition-colors bg-green-600 text-white hover:bg-green-700 text-xs lg:text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-4 h-4 mr-1" /> Complete
            </button>
          );
        })()}
        <button
          onClick={() => navigateToContent('next')}
          disabled={currentIndex >= allContent.length - 1}
          className="flex-1 inline-flex items-center justify-center py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs lg:text-base"
        >
          Next <ArrowRight className="w-4 h-4 ml-1" />
        </button>
      </div>
    </div>
  );
}

// Helper to get icon for content type
function getContentIcon(type) {
  switch (type) {
    case 'video':
      return <Play className="w-4 h-4 text-blue-500" />;
    case 'file':
      return <File className="w-4 h-4 text-gray-500" />;
    case 'quiz':
      return <Brain className="w-4 h-4 text-purple-500" />;
    case 'image':
      return <Image className="w-4 h-4 text-pink-500" />;
    case 'markdown':
      return <FileText className="w-4 h-4 text-green-500" />;
    default:
      return <FileText className="w-4 h-4 text-gray-400" />;
  }
}