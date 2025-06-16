import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase, Course, CourseSection, SectionContent, ContentCompletion } from '../lib/supabase';
import { 
  BookOpen, Play, FileText, Brain, File, Image, 
  ChevronDown, ChevronRight, CheckCircle, Clock, 
  ArrowLeft, ArrowRight, Award, Eye, Download,
  ChevronLeft, Menu, X, Trophy, Star, Target, AlertCircle
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

interface QuizAttemptSummary {
  totalAttempts: number;
  bestScore: number;
  lastAttemptDate: string;
  passed: boolean;
  attemptsRemaining: number;
}

export default function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<SectionWithContent[]>([]);
  const [allSections, setAllSections] = useState<SectionWithContent[]>([]); // All sections including unpublished
  const [currentContent, setCurrentContent] = useState<ContentWithCompletion | null>(null);
  const [completions, setCompletions] = useState<Map<string, ContentCompletion>>(new Map());
  const [courseCompletion, setCourseCompletion] = useState<any>(null);
  const [certificate, setCertificate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [quizAttempts, setQuizAttempts] = useState<Map<string, QuizAttemptSummary>>(new Map());
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

      // Load quiz attempts for all quiz content
      const quizContentItems = sectionsWithContent.flatMap(s => 
        s.content.filter(c => c.content_type === 'quiz' && c.content_data?.quiz_id)
      );

      if (quizContentItems.length > 0) {
        const quizIds = quizContentItems.map(c => c.content_data.quiz_id);
        await loadQuizAttempts(quizIds);
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

  const loadQuizAttempts = async (quizIds: string[]) => {
    if (!profile || quizIds.length === 0) return;

    try {
      // Load all quiz details and user attempts
      const [quizzesResponse, attemptsResponse] = await Promise.all([
        supabase
          .from('quizzes')
          .select('*')
          .in('id', quizIds),
        supabase
          .from('quiz_attempts')
          .select('*')
          .eq('user_id', profile.id)
          .in('quiz_id', quizIds)
          .eq('completed', true)
          .order('completed_at', { ascending: false })
      ]);

      if (quizzesResponse.error) throw quizzesResponse.error;
      if (attemptsResponse.error) throw attemptsResponse.error;

      const quizzes = quizzesResponse.data || [];
      const attempts = attemptsResponse.data || [];

      // Create quiz attempt summaries
      const quizAttemptsMap = new Map<string, QuizAttemptSummary>();

      quizzes.forEach(quiz => {
        const quizAttempts = attempts.filter(attempt => attempt.quiz_id === quiz.id);
        
        if (quizAttempts.length > 0) {
          const scores = quizAttempts.map(attempt => (attempt.score / attempt.max_score) * 100);
          const bestScore = Math.max(...scores);
          const lastAttempt = quizAttempts[0]; // Already sorted by completed_at desc
          
          quizAttemptsMap.set(quiz.id, {
            totalAttempts: quizAttempts.length,
            bestScore: Math.round(bestScore),
            lastAttemptDate: lastAttempt.completed_at!,
            passed: bestScore >= 70,
            attemptsRemaining: quiz.max_attempts - quizAttempts.length
          });
        } else {
          quizAttemptsMap.set(quiz.id, {
            totalAttempts: 0,
            bestScore: 0,
            lastAttemptDate: '',
            passed: false,
            attemptsRemaining: quiz.max_attempts
          });
        }
      });

      setQuizAttempts(quizAttemptsMap);
    } catch (error) {
      console.error('Error loading quiz attempts:', error);
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

    // For quiz content, check if user has attempted the quiz
    if (content.content_type === 'quiz') {
      const quizId = content.content_data?.quiz_id;
      if (quizId) {
        const attemptSummary = quizAttempts.get(quizId);
        if (!attemptSummary || attemptSummary.totalAttempts === 0) {
          return { 
            canComplete: false, 
            reason: 'You must attempt the quiz before marking it as complete' 
          };
        }
      }
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

  const getContentIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Play className="w-4 h-4 text-red-500" />;
      case 'image':
        return <Image className="w-4 h-4 text-green-500" />;
      case 'text':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'quiz':
        return <Brain className="w-4 h-4 text-purple-500" />;
      case 'file':
        return <File className="w-4 h-4 text-gray-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
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

      case 'quiz':
        const quizId = contentData.quiz_id;
        const attemptSummary = quizId ? quizAttempts.get(quizId) : null;
        const hasAttempted = attemptSummary && attemptSummary.totalAttempts > 0;

        return (
          <div className="space-y-4">
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <Brain className="w-8 h-8 text-purple-600 dark:text-purple-400 mr-3" />
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">Quiz Assessment</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Test your knowledge and understanding</p>
                </div>
              </div>
              
              {contentData.instructions && (
                <div className="mb-4">
                  <h5 className="font-medium text-gray-900 dark:text-white mb-2">Instructions</h5>
                  <MarkdownRenderer 
                    content={contentData.instructions} 
                    className="text-gray-700 dark:text-gray-300"
                  />
                </div>
              )}

              {/* Quiz Statistics */}
              {hasAttempted && attemptSummary && (
                <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-purple-200 dark:border-purple-700">
                  <h5 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                    <Star className="w-4 h-4 mr-2 text-yellow-500" />
                    Your Performance
                  </h5>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${
                        attemptSummary.passed ? 'text-green-600' : 'text-orange-600'
                      }`}>
                        {attemptSummary.bestScore}%
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Best Score</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {attemptSummary.totalAttempts}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Attempts</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {attemptSummary.attemptsRemaining}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Remaining</div>
                    </div>
                    
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${
                        attemptSummary.passed ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {attemptSummary.passed ? '✓' : '✗'}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Status</div>
                    </div>
                  </div>

                  {attemptSummary.passed && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4">
                      <div className="flex items-center">
                        <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
                        <span className="text-green-800 dark:text-green-200 font-medium">
                          Congratulations! You passed this quiz.
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Last attempt: {new Date(attemptSummary.lastAttemptDate).toLocaleDateString()} at {new Date(attemptSummary.lastAttemptDate).toLocaleTimeString()}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                {quizId && (
                  <>
                    {hasAttempted ? (
                      <>
                        <button
                          onClick={() => navigate(`/quiz/${quizId}`)}
                          className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors border border-purple-300 dark:border-purple-700"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Quiz Details
                        </button>
                        
                        {attemptSummary && attemptSummary.attemptsRemaining > 0 && (
                          <button
                            onClick={() => navigate(`/quiz/${quizId}`)}
                            className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                          >
                            <Target className="w-4 h-4 mr-2" />
                            {attemptSummary.passed ? 'Improve Score' : 'Retake Quiz'}
                            <span className="ml-2 text-xs bg-purple-500 px-2 py-1 rounded-full">
                              {attemptSummary.attemptsRemaining} left
                            </span>
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => navigate(`/quiz/${quizId}`)}
                        className="inline-flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        <Brain className="w-4 h-4 mr-2" />
                        Start Quiz
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Passing Score Info */}
              <div className="mt-4 pt-4 border-t border-purple-200 dark:border-purple-700">
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <Target className="w-4 h-4 mr-2" />
                  <span>Passing score: 70% • {contentData.passingScore || 70}% required to pass</span>
                </div>
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

  return (
    <>
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        {/* Sidebar */}
        <div className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col`}>
          {/* Course Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => navigate('/my-courses')}
                className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back to Courses
              </button>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 lg:hidden"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{course.title}</h1>
            
            {/* Course Completion Status */}
            {courseCompletion && (
              <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center">
                  <Trophy className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">Course Completed!</p>
                    <p className="text-xs text-green-600 dark:text-green-400">
                      Completed on {new Date(courseCompletion.completed_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Progress - Now includes unpublished content */}
            <div className="mb-3">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                <span>Progress</span>
                <span>{completedCount}/{totalContentCount} completed</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    isFullyCompleted ? 'bg-green-600' : 'bg-blue-600'
                  }`}
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              {isFullyCompleted && !courseCompletion && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-medium">
                  🎉 All content completed! Ready to get your certificate.
                </p>
              )}
              {totalContentCount > allContent.length}
            </div>
          </div>

          {/* Sections List */}
          <div className="flex-1 overflow-y-auto">
            {sections.map((section) => (
              <div key={section.id} className="border-b border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 dark:text-white">{section.title}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{section.content.length} items</p>
                    </div>
                    {expandedSections.has(section.id) ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </button>

                {expandedSections.has(section.id) && (
                  <div className="pb-2">
                    {section.content.map((content) => {
                      const isCompleted = completions.has(content.id);
                      const isCurrent = currentContent?.id === content.id;
                      const isQuiz = content.content_type === 'quiz';
                      const quizId = isQuiz ? content.content_data?.quiz_id : null;
                      const attemptSummary = quizId ? quizAttempts.get(quizId) : null;
                      
                      return (
                        <button
                          key={content.id}
                          onClick={() => setCurrentContent({
                            ...content,
                            completed: isCompleted,
                            completion: completions.get(content.id)
                          })}
                          className={`w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-l-2 ${
                            isCurrent 
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                              : 'border-transparent'
                          }`}
                        >
                          <div className="flex items-center ml-4">
                            {getContentIcon(content.content_type)}
                            <div className="ml-3 flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className={`text-sm font-medium ${
                                  isCurrent ? 'text-blue-900 dark:text-blue-200' : 'text-gray-900 dark:text-white'
                                }`}>
                                  {content.title}
                                </h4>
                                <div className="flex items-center space-x-1">
                                  {isQuiz && attemptSummary && attemptSummary.totalAttempts > 0 && (
                                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                      attemptSummary.passed 
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                        : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                                    }`}>
                                      {attemptSummary.bestScore}%
                                    </span>
                                  )}
                                  {isCompleted && (
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1">
                                <span className="capitalize">{content.content_type}</span>
                                {content.duration_minutes > 0 && (
                                  <>
                                    <span className="mx-1">•</span>
                                    <Clock className="w-3 h-3 mr-1" />
                                    <span>{content.duration_minutes} min</span>
                                  </>
                                )}
                                {isQuiz && attemptSummary && attemptSummary.totalAttempts > 0 && (
                                  <>
                                    <span className="mx-1">•</span>
                                    <span>{attemptSummary.totalAttempts} attempt{attemptSummary.totalAttempts !== 1 ? 's' : ''}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Top Bar */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {!sidebarOpen && (
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="mr-3 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <Menu className="w-5 h-5" />
                  </button>
                )}
                
                {currentContent && (
                  <div className="flex items-center">
                    {getContentIcon(currentContent.content_type)}
                    <div className="ml-3">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{currentContent.title}</h2>
                      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <span className="capitalize">{currentContent.content_type}</span>
                        {currentContent.duration_minutes > 0 && (
                          <>
                            <span className="mx-2">•</span>
                            <Clock className="w-4 h-4 mr-1" />
                            <span>{currentContent.duration_minutes} min</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-3">
                {/* Complete Course Button */}
                {isFullyCompleted && !courseCompletion && (
                  <button
                    onClick={() => setShowCompletionModal(true)}
                    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-200 shadow-lg"
                  >
                    <Trophy className="w-4 h-4 mr-2" />
                    Complete Course
                    {course.enable_certificates && " & Get Certificate"}
                  </button>
                )}

                {/* Mark Content Complete Button */}
                {currentContent && !currentContent.completed && (() => {
                  const { canComplete, reason } = canMarkContentComplete(currentContent);
                  return (
                    <div className="relative">
                      <button
                        onClick={() => canComplete ? markContentComplete(currentContent.id) : null}
                        disabled={!canComplete}
                        className={`inline-flex items-center px-4 py-2 rounded-lg transition-colors ${
                          canComplete
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                        title={!canComplete ? reason : 'Mark as complete'}
                      >
                        {!canComplete && currentContent.content_type === 'quiz' && (
                          <AlertCircle className="w-4 h-4 mr-2" />
                        )}
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Mark Complete
                      </button>
                      {!canComplete && reason && (
                        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                          {reason}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* View Certificate Button */}
                {courseCompletion && certificate && course.enable_certificates && (
                  <button
                    onClick={() => setShowCertificateModal(true)}
                    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all duration-200"
                  >
                    <Award className="w-4 h-4 mr-2" />
                    View Certificate
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {renderContent()}
          </div>

          {/* Navigation Footer */}
          <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => navigateToContent('prev')}
                disabled={currentIndex <= 0}
                className="inline-flex items-center px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous
              </button>

              <div className="text-sm text-gray-500 dark:text-gray-400">
                {currentIndex >= 0 && (
                  <span>{currentIndex + 1} of {allContent.length}</span>
                )}
              </div>

              <button
                onClick={() => navigateToContent('next')}
                disabled={currentIndex >= allContent.length - 1}
                className="inline-flex items-center px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
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
      </div>
    </>
  );
}