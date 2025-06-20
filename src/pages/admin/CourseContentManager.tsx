import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase, Course, CourseSection, SectionContent, ContentType } from '../../lib/supabase';
import { 
  BookOpen, Plus, Edit2, Trash2, ChevronDown, ChevronRight, 
  Play, Image, FileText, Brain, File, Eye, 
  X} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

// --- TypeScript Fixes: Extend types locally for UI logic ---

type UICourseSection = CourseSection & { published_at?: string | null };
type UISectionContent = SectionContent & {
  content_data: {
    text?: string;
    url?: string;
    description?: string;
    transcript?: string;
    alt?: string;
    caption?: string;
    filename?: string;
    instructions?: string;
    passingScore?: number;
    quiz_id?: string;
    embedUrl?: string;
    originalUrl?: string;
    [key: string]: any;
  };
};

type NewSectionState = {
  title: string;
  description: string;
  order_index: number;
  is_published: boolean;
  published_at: string;
};

type NewContentState = {
  title: string;
  content_type: ContentType;
  content_data: UISectionContent['content_data'];
  order_index: number;
  duration_minutes: number;
  is_published: boolean;
};

export default function CourseContentManager() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<(UICourseSection & { content: UISectionContent[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [showContentModal, setShowContentModal] = useState(false);
  const [editingSection, setEditingSection] = useState<UICourseSection | null>(null);
  const [editingContent, setEditingContent] = useState<UISectionContent | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  
  const [newSection, setNewSection] = useState<NewSectionState>({
    title: '',
    description: '',
    order_index: 0,
    is_published: true, // Default to published
    published_at: '' // Add published_at field
  });

  const [newContent, setNewContent] = useState<NewContentState>({
    title: '',
    content_type: 'text' as ContentType,
    content_data: {},
    order_index: 0,
    duration_minutes: 0,
    is_published: false // Add published state for content too
  });

  useEffect(() => {
    if (courseId && isAdmin()) {
      loadCourseData();
    }
  }, [courseId, profile]);

  // Expand last section by default when sections change
  useEffect(() => {
    if (sections.length > 0) {
      setExpandedSections((prev) => {
        // If already expanded, don't collapse others
        if (prev.size === 0 || !prev.has(sections[sections.length - 1].id)) {
          return new Set([sections[sections.length - 1].id]);
        }
        return prev;
      });
    }
  }, [sections]);

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

      // Load sections first
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('course_sections')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index')
        .or('published_at.is.null,published_at.lte.' + new Date().toISOString());

      if (sectionsError) throw sectionsError;

      // Load content for each section separately
      const sectionsWithContent = await Promise.all(
        (sectionsData || []).map(async (section) => {
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

      setCourse(courseData);
      setSections(sectionsWithContent);
    } catch (error) {
      console.error('Error loading course data:', error);
      alert('Failed to load course data');
      navigate('/admin/courses');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to convert video URLs to embed URLs
  const getEmbedUrl = (url: string): string => {
    if (!url) return '';

    // YouTube URL patterns
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const youtubeMatch = url.match(youtubeRegex);
    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }

    // Vimeo URL patterns
    const vimeoRegex = /(?:vimeo\.com\/)([0-9]+)/;
    const vimeoMatch = url.match(vimeoRegex);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }

    // If already an embed URL, return as is
    if (url.includes('embed') || url.includes('player')) {
      return url;
    }

    // For other URLs, return as is (might be direct video files)
    return url;
  };

  const createSection = async () => {
    if (!courseId) return;

    try {
      // Calculate the next order index
      const nextOrderIndex = sections.length;

      const { data, error } = await supabase
        .from('course_sections')
        .insert({
          ...newSection,
          published_at: newSection.published_at ? new Date(newSection.published_at).toISOString() : null,
          course_id: courseId,
          created_by: profile?.id,
          order_index: nextOrderIndex
        })
        .select()
        .single();

      if (error) throw error;

      console.log('Section created successfully:', data);

      // Reload the data to show the new section
      await loadCourseData();
      
      setShowSectionModal(false);
      setNewSection({ 
        title: '', 
        description: '', 
        order_index: 0, 
        is_published: false,
        published_at: ''
      });
    } catch (error) {
      console.error('Error creating section:', error);
      alert('Failed to create section: ' + (error as any).message);
    }
  };

  const updateSection = async () => {
    if (!editingSection) return;

    try {
      const { error } = await supabase
        .from('course_sections')
        .update({
          title: editingSection.title,
          description: editingSection.description,
          is_published: editingSection.is_published,
          published_at: editingSection.published_at ? new Date(editingSection.published_at).toISOString() : null
        })
        .eq('id', editingSection.id);

      if (error) throw error;

      await loadCourseData();
      setEditingSection(null);
    } catch (error) {
      console.error('Error updating section:', error);
      alert('Failed to update section');
    }
  };

  const deleteSection = async (sectionId: string) => {
    if (!confirm('Are you sure you want to delete this section? All content will be lost.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('course_sections')
        .delete()
        .eq('id', sectionId);

      if (error) throw error;

      await loadCourseData();
    } catch (error) {
      console.error('Error deleting section:', error);
      alert('Failed to delete section');
    }
  };

  const createContent = async () => {
    if (!selectedSectionId || !courseId) return;

    try {
      // Calculate the next order index for this section
      const section = sections.find(s => s.id === selectedSectionId);
      const nextOrderIndex = section ? section.content.length : 0;

      // If this is a quiz content, create a quiz record first
      let quizId = null;
      if (newContent.content_type === 'quiz') {
        const { data: quizData, error: quizError } = await supabase
          .from('quizzes')
          .insert({
            course_id: courseId,
            title: newContent.title,
            description: newContent.content_data.instructions || '',
            max_attempts: 3, // Default value
            time_limit: newContent.duration_minutes || null,
            created_by: profile?.id
          })
          .select()
          .single();

        if (quizError) throw quizError;
        quizId = quizData.id;

        // Update content_data to include the quiz_id
        newContent.content_data = {
          ...newContent.content_data,
          quiz_id: quizId
        };
      }

      // If this is video content, convert URL to embed URL
      if (newContent.content_type === 'video' && newContent.content_data.url) {
        newContent.content_data = {
          ...newContent.content_data,
          embedUrl: getEmbedUrl(newContent.content_data.url),
          originalUrl: newContent.content_data.url
        };
      }

      const { error } = await supabase
        .from('section_content')
        .insert({
          ...newContent,
          section_id: selectedSectionId,
          created_by: profile?.id,
          order_index: nextOrderIndex
        });

      if (error) throw error;

      await loadCourseData();
      setShowContentModal(false);
      setNewContent({
        title: '',
        content_type: 'text',
        content_data: {},
        order_index: 0,
        duration_minutes: 0,
        is_published: false
      });
      setSelectedSectionId('');

      // Show success message for quiz creation
      if (newContent.content_type === 'quiz') {
        alert('Quiz content created successfully! You can now add questions to this quiz in the Quiz Management section.');
      }
    } catch (error) {
      console.error('Error creating content:', error);
      alert('Failed to create content');
    }
  };

  const updateContent = async () => {
    if (!editingContent || !courseId) return;

    try {
      // If this is a quiz content and we have a quiz_id, update the quiz record too
      if (editingContent.content_type === 'quiz' && editingContent.content_data.quiz_id) {
        const { error: quizError } = await supabase
          .from('quizzes')
          .update({
            title: editingContent.title,
            description: editingContent.content_data.instructions || '',
            time_limit: editingContent.duration_minutes || null
          })
          .eq('id', editingContent.content_data.quiz_id);

        if (quizError) {
          console.error('Error updating quiz:', quizError);
          // Don't throw here, continue with content update
        }
      }

      // If this is video content, update embed URL
      if (editingContent.content_type === 'video' && editingContent.content_data.url) {
        editingContent.content_data = {
          ...editingContent.content_data,
          embedUrl: getEmbedUrl(editingContent.content_data.url),
          originalUrl: editingContent.content_data.url
        };
      }

      const { error } = await supabase
        .from('section_content')
        .update({
          title: editingContent.title,
          content_data: editingContent.content_data,
          is_published: editingContent.is_published,
          duration_minutes: editingContent.duration_minutes
        })
        .eq('id', editingContent.id);

      if (error) throw error;

      await loadCourseData();
      setEditingContent(null);
    } catch (error) {
      console.error('Error updating content:', error);
      alert('Failed to update content');
    }
  };

  const deleteContent = async (contentId: string) => {
    if (!confirm('Are you sure you want to delete this content?')) {
      return;
    }

    try {
      // First, get the content to check if it's a quiz
      const { data: contentData } = await supabase
        .from('section_content')
        .select('*')
        .eq('id', contentId)
        .single();

      // If it's a quiz content with a quiz_id, delete the quiz record too
      if (contentData?.content_type === 'quiz' && contentData.content_data?.quiz_id) {
        const { error: quizError } = await supabase
          .from('quizzes')
          .delete()
          .eq('id', contentData.content_data.quiz_id);

        if (quizError) {
          console.error('Error deleting quiz:', quizError);
          // Don't throw here, continue with content deletion
        }
      }

      const { error } = await supabase
        .from('section_content')
        .delete()
        .eq('id', contentId);

      if (error) throw error;

      await loadCourseData();
    } catch (error) {
      console.error('Error deleting content:', error);
      alert('Failed to delete content');
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

  const getContentIcon = (type: ContentType) => {
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

  const renderContentForm = (content: Partial<SectionContent>, isEditing = false) => {
    const updateContentData = (field: string, value: any) => {
      if (isEditing && editingContent) {
        setEditingContent({
          ...editingContent,
          content_data: { ...editingContent.content_data, [field]: value }
        });
      } else {
        setNewContent({
          ...newContent,
          content_data: { ...newContent.content_data, [field]: value }
        });
      }
    };

    const contentData = content.content_data || {};

    switch (content.content_type) {
      case 'text':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Text Content</label>
            <textarea
              value={contentData.text || ''}
              onChange={(e) => updateContentData('text', e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your text content here..."
            />
          </div>
        );

      case 'video':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Video URL</label>
              <input
                type="url"
                value={contentData.url || ''}
                onChange={(e) => updateContentData('url', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://www.youtube.com/watch?v=... or https://vimeo.com/..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Supports YouTube, Vimeo, and direct video file URLs. The video will be automatically embedded.
              </p>
            </div>
            
            {/* Video Preview */}
            {contentData.url && (
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Video Preview</h4>
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  <iframe
                    src={getEmbedUrl(contentData.url)}
                    className="w-full h-full"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="Video preview"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Video Description</label>
              <textarea
                value={contentData.description || ''}
                onChange={(e) => updateContentData('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="Brief description of the video content..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Video Transcript (Optional)</label>
              <textarea
                value={contentData.transcript || ''}
                onChange={(e) => updateContentData('transcript', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="Video transcript for accessibility..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Adding a transcript improves accessibility for hearing-impaired users.
              </p>
            </div>
          </div>
        );

      case 'image':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
              <input
                type="url"
                value={contentData.url || ''}
                onChange={(e) => updateContentData('url', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://example.com/image.jpg"
              />
            </div>
            
            {/* Image Preview */}
            {contentData.url && (
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Image Preview</h4>
                <img
                  src={contentData.url}
                  alt={contentData.alt || 'Preview'}
                  className="max-w-full h-auto rounded-lg"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alt Text</label>
              <input
                type="text"
                value={contentData.alt || ''}
                onChange={(e) => updateContentData('alt', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="Description of the image for accessibility"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Caption</label>
              <input
                type="text"
                value={contentData.caption || ''}
                onChange={(e) => updateContentData('caption', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="Image caption (optional)"
              />
            </div>
          </div>
        );

      case 'file':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">File URL</label>
              <input
                type="url"
                value={contentData.url || ''}
                onChange={(e) => updateContentData('url', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://example.com/document.pdf"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">File Name</label>
              <input
                type="text"
                value={contentData.filename || ''}
                onChange={(e) => updateContentData('filename', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="document.pdf"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">File Description</label>
              <textarea
                value={contentData.description || ''}
                onChange={(e) => updateContentData('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="What does this file contain?"
              />
            </div>
          </div>
        );

      case 'quiz':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quiz Instructions</label>
              <textarea
                value={contentData.instructions || ''}
                onChange={(e) => updateContentData('instructions', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="Instructions for the quiz..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Passing Score (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={contentData.passingScore || 70}
                onChange={(e) => updateContentData('passingScore', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <Brain className="w-5 h-5 text-blue-600 mt-0.5 mr-2" />
                <div>
                  <p className="text-sm font-medium text-blue-800">Quiz Integration</p>
                  <p className="text-sm text-blue-600 mt-1">
                    When you create this quiz content, it will automatically appear in the Quiz Management section where you can add questions and configure settings.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Handler for drag end
  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    // Reorder sections
    if (result.type === 'section') {
      const reordered = Array.from(sections);
      const [removed] = reordered.splice(result.source.index, 1);
      reordered.splice(result.destination.index, 0, removed);
      // Update order_index locally
      setSections(reordered.map((s, idx) => ({ ...s, order_index: idx })));
      // Update order_index in DB
      for (let i = 0; i < reordered.length; i++) {
        await supabase.from('course_sections').update({ order_index: i }).eq('id', reordered[i].id);
      }
      await loadCourseData();
    }
    // Reorder content within a section
    if (result.type === 'content') {
      const sectionIdx = sections.findIndex(s => s.id === result.source.droppableId);
      if (sectionIdx === -1) return;
      const section = sections[sectionIdx];
      const reorderedContent = Array.from(section.content);
      const [removed] = reorderedContent.splice(result.source.index, 1);
      reorderedContent.splice(result.destination.index, 0, removed);
      // Update order_index locally
      const updatedSections = [...sections];
      updatedSections[sectionIdx] = {
        ...section,
        content: reorderedContent.map((c, idx) => ({ ...c, order_index: idx }))
      };
      setSections(updatedSections);
      // Update order_index in DB
      for (let i = 0; i < reorderedContent.length; i++) {
        await supabase.from('section_content').update({ order_index: i }).eq('id', reorderedContent[i].id);
      }
      await loadCourseData();
    }
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
    <div className="space-y-10 max-w-5xl mx-auto px-2 md:px-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 md:gap-0 pb-2 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">Course Content Manager</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400 text-base">Manage sections and content for <span className="font-semibold text-blue-700 dark:text-blue-300">"{course.title}"</span></p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => navigate('/admin/courses')}
            className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 shadow-sm transition"
          >
            Back to Courses
          </button>
          <button
            onClick={() => setShowSectionModal(true)}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-700 dark:to-blue-600 text-white rounded-lg shadow hover:from-blue-700 hover:to-blue-600 dark:hover:from-blue-800 dark:hover:to-blue-700 transition"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Section
          </button>
        </div>
      </div>

      {/* Sections List */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="sections" type="section">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-8">
              {sections.map((section, sectionIdx) => (
                <Draggable key={section.id} draggableId={section.id} index={sectionIdx}>
                  {(sectionProvided) => (
                    <div ref={sectionProvided.innerRef} {...sectionProvided.draggableProps} className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 transition hover:shadow-xl dark:hover:shadow-2xl">
                      <div className="flex items-center justify-between px-6 py-4 cursor-pointer group rounded-t-2xl">
                        <div className="flex items-center gap-3 flex-1 select-none" onClick={() => toggleSection(section.id)}>
                          <span className="font-bold text-lg text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition">{section.title}</span>
                          <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full px-2 py-0.5 font-semibold">{section.content.length} items</span>
                          <span className="ml-2 relative group">
                            <span
                              className={`inline-block w-2 h-2 rounded-full align-middle ${
                                section.is_published
                                  ? 'bg-green-500'
                                  : 'bg-yellow-400 dark:bg-yellow-600'
                              }`}
                              aria-label={section.is_published ? 'Published' : 'Draft'}
                            />
                            <span className="absolute left-1/2 -translate-x-1/2 mt-1 px-2 py-1 text-xs rounded bg-gray-800 text-white opacity-0 group-hover:opacity-100 pointer-events-none z-10 transition whitespace-nowrap">
                              {section.is_published ? 'Published' : 'Draft'}
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setEditingSection(section)} className="p-2 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 transition" title="Edit Section"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => deleteSection(section.id)} className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900 text-red-600 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200 transition" title="Delete Section"><Trash2 className="w-4 h-4" /></button>
                          <button onClick={() => { setShowContentModal(true); setSelectedSectionId(section.id); }} className="p-2 rounded-full hover:bg-green-50 dark:hover:bg-green-900 text-green-600 dark:text-green-300 hover:text-green-800 dark:hover:text-green-200 transition" title="Add Content"><Plus className="w-4 h-4" /></button>
                          <button onClick={() => toggleSection(section.id)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition" title="Expand/Collapse">
                            {expandedSections.has(section.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      {expandedSections.has(section.id) && (
                        <Droppable droppableId={section.id} type="content">
                          {(contentProvided) => (
                            <div ref={contentProvided.innerRef} {...contentProvided.droppableProps} className="px-6 pb-6 pt-2">
                              {section.content.length === 0 && (
                                <div className="text-gray-400 dark:text-gray-500 text-sm py-6 text-center">No content yet. Add content to this section.</div>
                              )}
                              <div className="space-y-3">
                                {section.content.map((content, contentIdx) => (
                                  <Draggable key={content.id} draggableId={content.id} index={contentIdx}>
                                    {(contentDraggableProvided) => (
                                      <div ref={contentDraggableProvided.innerRef} {...contentDraggableProvided.draggableProps} className="flex items-center justify-between bg-white dark:bg-gray-900 rounded-xl p-3 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md dark:hover:shadow-lg transition group">
                                        <div className="flex items-center gap-3">
                                          <span {...contentDraggableProvided.dragHandleProps} className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition" title="Drag to reorder">
                                            {/* Braille 6-dot icon, now with a blue accent on hover */}
                                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                                              <circle cx="5" cy="4" r="1.5" fill="#A3A3A3" className="group-hover:fill-blue-400 dark:group-hover:fill-blue-300 transition" />
                                              <circle cx="5" cy="9" r="1.5" fill="#A3A3A3" className="group-hover:fill-blue-400 dark:group-hover:fill-blue-300 transition" />
                                              <circle cx="5" cy="14" r="1.5" fill="#A3A3A3" className="group-hover:fill-blue-400 dark:group-hover:fill-blue-300 transition" />
                                              <circle cx="13" cy="4" r="1.5" fill="#A3A3A3" className="group-hover:fill-blue-400 dark:group-hover:fill-blue-300 transition" />
                                              <circle cx="13" cy="9" r="1.5" fill="#A3A3A3" className="group-hover:fill-blue-400 dark:group-hover:fill-blue-300 transition" />
                                              <circle cx="13" cy="14" r="1.5" fill="#A3A3A3" className="group-hover:fill-blue-400 dark:group-hover:fill-blue-300 transition" />
                                            </svg>
                                          </span>
                                          {getContentIcon(content.content_type)}
                                          <span className="font-medium text-gray-800 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition">{content.title}</span>
                                          <span className="ml-2 relative group">
                                            <span
                                              className={`inline-block w-2 h-2 rounded-full align-middle ${
                                                content.is_published
                                                  ? 'bg-green-500'
                                                  : 'bg-yellow-400 dark:bg-yellow-600'
                                              }`}
                                              aria-label={content.is_published ? 'Published' : 'Draft'}
                                            />
                                            <span className="absolute left-1/2 -translate-x-1/2 mt-1 px-2 py-1 text-xs rounded bg-gray-800 text-white opacity-0 group-hover:opacity-100 pointer-events-none z-10 transition whitespace-nowrap">
                                              {content.is_published ? 'Published' : 'Draft'}
                                            </span>
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <button onClick={() => setEditingContent(content)} className="p-2 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 transition" title="Edit Content"><Edit2 className="w-4 h-4" /></button>
                                          <button onClick={() => deleteContent(content.id)} className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900 text-red-600 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200 transition" title="Delete Content"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                              </div>
                              {contentProvided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      )}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {sections.length === 0 && (
        <div className="text-center py-16">
          <BookOpen className="w-16 h-16 text-gray-200 dark:text-gray-700 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">No sections yet</h2>
          <p className="text-gray-500 dark:text-gray-400">Create your first section to start organizing your course content.</p>
        </div>
      )}

      {/* Add Section Modal */}
      {showSectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 dark:bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 w-full max-w-md relative animate-fadeIn border border-gray-100 dark:border-gray-700">
            <button onClick={() => setShowSectionModal(false)} className="absolute top-3 right-3 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition" title="Close"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-bold mb-6 text-blue-700 dark:text-blue-300">Add New Section</h3>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Section Title</label>
                <input
                  type="text"
                  value={newSection.title}
                  onChange={(e) => setNewSection({ ...newSection, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100"
                  placeholder="e.g., Day 1: Introduction"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Description</label>
                <textarea
                  value={newSection.description}
                  onChange={(e) => setNewSection({ ...newSection, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100"
                  placeholder="Brief description of this section..."
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="section_published"
                  checked={newSection.is_published}
                  onChange={(e) => setNewSection({ ...newSection, is_published: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                />
                <label htmlFor="section_published" className="ml-2 text-sm text-gray-700 dark:text-gray-200">
                  Publish this section immediately
                </label>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Publish Date & Time</label>
                <input
                  type="datetime-local"
                  value={newSection.published_at}
                  onChange={(e) => setNewSection({ ...newSection, published_at: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Leave blank to keep as draft or publish immediately.</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div className="flex items-start">
                  <Eye className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 mr-2" />
                  <div className="text-xs text-gray-600 dark:text-gray-300">
                    <p className="font-medium mb-1">Publishing Options:</p>
                    <ul className="space-y-1">
                      <li>• <strong>Published:</strong> Visible to enrolled students immediately</li>
                      <li>• <strong>Draft:</strong> Only visible to course administrators</li>
                    </ul>
                    <p className="mt-2">You can change the publishing status later by editing the section.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-8">
              <button
                onClick={() => setShowSectionModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={createSection}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 shadow"
              >
                Add Section
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Content Modal */}
      {showContentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 dark:bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 w-full max-w-2xl max-h-[80vh] overflow-y-auto relative animate-fadeIn border border-gray-100 dark:border-gray-700">
            <button onClick={() => {
              setShowContentModal(false);
              setSelectedSectionId('');
              setNewContent({
                title: '',
                content_type: 'text',
                content_data: {},
                order_index: 0,
                duration_minutes: 0,
                is_published: false
              });
            }} className="absolute top-3 right-3 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition" title="Close"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-bold mb-6 text-blue-700 dark:text-blue-300">Add New Content</h3>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Content Title</label>
                <input
                  type="text"
                  value={newContent.title}
                  onChange={(e) => setNewContent({ ...newContent, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100"
                  placeholder="e.g., Introduction Video"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Content Type</label>
                <select
                  value={newContent.content_type}
                  onChange={(e) => setNewContent({ ...newContent, content_type: e.target.value as ContentType, content_data: {} })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="text">Text Content</option>
                  <option value="video">Video (Embedded)</option>
                  <option value="image">Image</option>
                  <option value="file">File/Document</option>
                  <option value="quiz">Quiz</option>
                </select>
              </div>
              {renderContentForm(newContent)}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  min="0"
                  value={newContent.duration_minutes}
                  onChange={(e) => setNewContent({ ...newContent, duration_minutes: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100"
                  placeholder="Estimated time to complete"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="content_published"
                  checked={newContent.is_published}
                  onChange={(e) => setNewContent({ ...newContent, is_published: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                />
                <label htmlFor="content_published" className="ml-2 text-sm text-gray-700 dark:text-gray-200">
                  Publish this content immediately
                </label>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div className="flex items-start">
                  <Eye className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 mr-2" />
                  <div className="text-xs text-gray-600 dark:text-gray-300">
                    <p className="font-medium mb-1">Content Publishing:</p>
                    <ul className="space-y-1">
                      <li>• <strong>Published:</strong> Students can view and interact with this content</li>
                      <li>• <strong>Draft:</strong> Only visible to course administrators for review</li>
                    </ul>
                    <p className="mt-2">Draft content won't appear in student progress calculations.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-8">
              <button
                onClick={() => {
                  setShowContentModal(false);
                  setSelectedSectionId('');
                  setNewContent({
                    title: '',
                    content_type: 'text',
                    content_data: {},
                    order_index: 0,
                    duration_minutes: 0,
                    is_published: false
                  });
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={createContent}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 shadow"
              >
                Add Content
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Section Modal */}
      {editingSection && (
        <div className="fixed inset-0 bg-black bg-opacity-40 dark:bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 w-full max-w-md relative animate-fadeIn border border-gray-100 dark:border-gray-700">
            <button onClick={() => setEditingSection(null)} className="absolute top-3 right-3 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition" title="Close"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-bold mb-6 text-blue-700 dark:text-blue-300">Edit Section</h3>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Section Title</label>
                <input
                  type="text"
                  value={editingSection.title}
                  onChange={(e) => setEditingSection({ ...editingSection, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Description</label>
                <textarea
                  value={editingSection.description || ''}
                  onChange={(e) => setEditingSection({ ...editingSection, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="edit_section_published"
                  checked={editingSection.is_published}
                  onChange={(e) => setEditingSection({ ...editingSection, is_published: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                />
                <label htmlFor="edit_section_published" className="ml-2 text-sm text-gray-700 dark:text-gray-200">
                  Publish this section
                </label>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Publish Date & Time</label>
                <input
                  type="datetime-local"
                  value={editingSection.published_at ? editingSection.published_at.substring(0, 16) : ''}
                  onChange={(e) => setEditingSection({ ...editingSection, published_at: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Leave blank to keep as draft or publish immediately.</p>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-8">
              <button
                onClick={() => setEditingSection(null)}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={updateSection}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 shadow"
              >
                Update Section
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Content Modal */}
      {editingContent && (
        <div className="fixed inset-0 bg-black bg-opacity-40 dark:bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 w-full max-w-2xl max-h-[80vh] overflow-y-auto relative animate-fadeIn border border-gray-100 dark:border-gray-700">
            <button onClick={() => setEditingContent(null)} className="absolute top-3 right-3 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition" title="Close"><X className="w-5 h-5" /></button>
            <h3 className="text-xl font-bold mb-6 text-blue-700 dark:text-blue-300">Edit Content</h3>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Content Title</label>
                <input
                  type="text"
                  value={editingContent.title}
                  onChange={(e) => setEditingContent({ ...editingContent, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              
              {renderContentForm(editingContent, true)}

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  min="0"
                  value={editingContent.duration_minutes || 0}
                  onChange={(e) => setEditingContent({ ...editingContent, duration_minutes: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="edit_content_published"
                  checked={editingContent.is_published}
                  onChange={(e) => setEditingContent({ ...editingContent, is_published: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                />
                <label htmlFor="edit_content_published" className="ml-2 text-sm text-gray-700 dark:text-gray-200">
                  Publish this content
                </label>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-8">
              <button
                onClick={() => setEditingContent(null)}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={updateContent}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 shadow"
              >
                Update Content
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}