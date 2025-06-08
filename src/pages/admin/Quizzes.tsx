import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, Quiz, Question, Course } from '../../lib/supabase';
import { Brain, Edit2, Trash2, Clock, HelpCircle, Eye, Users, X, BarChart3, Info } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminQuizzes() {
  const { profile, isAdmin } = useAuth();
  const [quizzes, setQuizzes] = useState<(Quiz & { courses: Course; question_count?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [showQuestionsModal, setShowQuestionsModal] = useState(false);
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [newQuestion, setNewQuestion] = useState({
    quiz_id: '',
    question_text: '',
    options: ['', '', '', ''],
    correct_option: 0,
    points: 1,
    order_index: 0
  });

  useEffect(() => {
    if (isAdmin()) {
      loadQuizzes();
    }
  }, [profile]);

  const loadQuizzes = async () => {
    try {
      let query = supabase
        .from('quizzes')
        .select(`
          *,
          courses (*)
        `);
      
      // If not superadmin, only show quizzes from courses they can manage
      if (profile?.role !== 'SUPERADMIN') {
        const { data: adminCourses } = await supabase
          .from('course_admins')
          .select('course_id')
          .eq('admin_id', profile?.id);
        
        const courseIds = adminCourses?.map(ca => ca.course_id) || [];
        if (courseIds.length > 0) {
          query = query.in('course_id', courseIds);
        } else {
          query = query.eq('created_by', profile?.id);
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // Get question counts for each quiz
      const quizzesWithCounts = await Promise.all(
        (data || []).map(async (quiz) => {
          const { count } = await supabase
            .from('questions')
            .select('*', { count: 'exact', head: true })
            .eq('quiz_id', quiz.id);
          
          return { ...quiz, question_count: count || 0 };
        })
      );

      setQuizzes(quizzesWithCounts);
    } catch (error) {
      console.error('Error loading quizzes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadQuestions = async (quizId: string) => {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('order_index');

      if (error) throw error;
      setQuestions(data || []);
    } catch (error) {
      console.error('Error loading questions:', error);
    }
  };

  const updateQuiz = async () => {
    if (!editingQuiz) return;

    try {
      const { error } = await supabase
        .from('quizzes')
        .update({
          title: editingQuiz.title,
          description: editingQuiz.description,
          max_attempts: editingQuiz.max_attempts,
          time_limit: editingQuiz.time_limit
        })
        .eq('id', editingQuiz.id);

      if (error) throw error;

      loadQuizzes();
      setEditingQuiz(null);
    } catch (error) {
      console.error('Error updating quiz:', error);
      alert('Failed to update quiz');
    }
  };

  const deleteQuiz = async (quizId: string) => {
    if (!confirm('Are you sure you want to delete this quiz? This will also delete all questions and attempts. This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('quizzes')
        .delete()
        .eq('id', quizId);

      if (error) throw error;

      setQuizzes(quizzes.filter(quiz => quiz.id !== quizId));
    } catch (error) {
      console.error('Error deleting quiz:', error);
      alert('Failed to delete quiz');
    }
  };

  const createQuestion = async () => {
    try {
      // Filter out empty options
      const filteredOptions = newQuestion.options.filter(option => option.trim() !== '');
      
      if (filteredOptions.length < 2) {
        alert('Please provide at least 2 options');
        return;
      }

      if (newQuestion.correct_option >= filteredOptions.length) {
        alert('Please select a valid correct option');
        return;
      }

      const { error } = await supabase
        .from('questions')
        .insert({
          ...newQuestion,
          options: filteredOptions
        });

      if (error) throw error;

      // Reload questions and quiz data
      if (selectedQuiz) {
        await loadQuestions(selectedQuiz.id);
      }
      loadQuizzes();
      setShowAddQuestionModal(false);
      setNewQuestion({
        quiz_id: '',
        question_text: '',
        options: ['', '', '', ''],
        correct_option: 0,
        points: 1,
        order_index: 0
      });
    } catch (error) {
      console.error('Error creating question:', error);
      alert('Failed to create question');
    }
  };

  const updateQuestion = async () => {
    if (!editingQuestion) return;

    try {
      // Filter out empty options
      const filteredOptions = editingQuestion.options.filter(option => option.trim() !== '');
      
      if (filteredOptions.length < 2) {
        alert('Please provide at least 2 options');
        return;
      }

      if (editingQuestion.correct_option >= filteredOptions.length) {
        alert('Please select a valid correct option');
        return;
      }

      const { error } = await supabase
        .from('questions')
        .update({
          question_text: editingQuestion.question_text,
          options: filteredOptions,
          correct_option: editingQuestion.correct_option,
          points: editingQuestion.points,
          order_index: editingQuestion.order_index
        })
        .eq('id', editingQuestion.id);

      if (error) throw error;

      // Reload questions and quiz data
      if (selectedQuiz) {
        await loadQuestions(selectedQuiz.id);
      }
      loadQuizzes();
      setEditingQuestion(null);
    } catch (error) {
      console.error('Error updating question:', error);
      alert('Failed to update question');
    }
  };

  const deleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', questionId);

      if (error) throw error;

      // Reload questions and quiz data
      if (selectedQuiz) {
        await loadQuestions(selectedQuiz.id);
      }
      loadQuizzes();
    } catch (error) {
      console.error('Error deleting question:', error);
      alert('Failed to delete question');
    }
  };

  const viewQuestions = async (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    await loadQuestions(quiz.id);
    setShowQuestionsModal(true);
  };

  const openAddQuestionModal = (quiz: Quiz) => {
    setNewQuestion({
      ...newQuestion,
      quiz_id: quiz.id,
      order_index: questions.length
    });
    setShowAddQuestionModal(true);
  };

  const updateQuestionOption = (index: number, value: string, isEditing = false) => {
    if (isEditing && editingQuestion) {
      const newOptions = [...editingQuestion.options];
      newOptions[index] = value;
      setEditingQuestion({ ...editingQuestion, options: newOptions });
    } else {
      const newOptions = [...newQuestion.options];
      newOptions[index] = value;
      setNewQuestion({ ...newQuestion, options: newOptions });
    }
  };

  if (!isAdmin()) {
    return (
      <div className="text-center py-12">
        <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Quiz Management</h1>
          <p className="mt-2 text-sm sm:text-base text-gray-600">Manage existing quizzes and their questions.</p>
        </div>
      </div>

      {/* Info Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800">Quiz Creation</p>
            <p className="text-sm text-blue-600 mt-1">
              To create new quizzes, go to <strong>Course Management → [Select Course] → Manage Content</strong> and add quiz content to your course sections. 
              This ensures quizzes are properly integrated with your course structure.
            </p>
          </div>
        </div>
      </div>

      {/* Quizzes Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {quizzes.map((quiz) => (
          <div key={quiz.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="p-4 sm:p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-purple-100 rounded-lg flex-shrink-0">
                  <Brain className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                    {quiz.question_count} questions
                  </span>
                </div>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                {quiz.title}
              </h3>
              
              <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                {quiz.description || 'No description available'}
              </p>

              <div className="text-sm text-gray-500 mb-4">
                <p className="font-medium truncate">{quiz.courses.title}</p>
              </div>
              
              <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-1" />
                  <span>{quiz.max_attempts} attempts</span>
                </div>
                {quiz.time_limit && (
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    <span>{quiz.time_limit}m</span>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  onClick={() => viewQuestions(quiz)}
                  className="flex items-center justify-center px-2 sm:px-3 py-2 text-xs sm:text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  <span className="hidden sm:inline">Questions</span>
                  <span className="sm:hidden">Q</span>
                </button>
                <Link
                  to={`/admin/quiz-analytics/${quiz.id}`}
                  className="flex items-center justify-center px-2 sm:px-3 py-2 text-xs sm:text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  <span className="hidden sm:inline">Analytics</span>
                  <span className="sm:hidden">A</span>
                </Link>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                <button
                  onClick={() => setEditingQuiz(quiz)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteQuiz(quiz.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {quizzes.length === 0 && (
        <div className="text-center py-12">
          <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No quizzes yet</h2>
          <p className="text-gray-600 mb-4">
            Create quizzes through the Course Management interface to get started.
          </p>
          <Link
            to="/admin/courses"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Course Management
          </Link>
        </div>
      )}

      {/* Edit Quiz Modal */}
      {editingQuiz && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Edit Quiz Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={editingQuiz.title}
                    onChange={(e) => setEditingQuiz({ ...editingQuiz, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={editingQuiz.description || ''}
                    onChange={(e) => setEditingQuiz({ ...editingQuiz, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Attempts</label>
                  <input
                    type="number"
                    min="1"
                    value={editingQuiz.max_attempts}
                    onChange={(e) => setEditingQuiz({ ...editingQuiz, max_attempts: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time Limit (minutes)</label>
                  <input
                    type="number"
                    min="1"
                    value={editingQuiz.time_limit || ''}
                    onChange={(e) => setEditingQuiz({ ...editingQuiz, time_limit: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 mt-6">
                <button
                  onClick={() => setEditingQuiz(null)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  onClick={updateQuiz}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 order-1 sm:order-2"
                >
                  Update Quiz
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Questions Modal */}
      {showQuestionsModal && selectedQuiz && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Questions for "{selectedQuiz.title}"</h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => openAddQuestionModal(selectedQuiz)}
                  className="inline-flex items-center px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
                >
                  <HelpCircle className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">Add Question</span>
                  <span className="sm:hidden">Add</span>
                </button>
                <button
                  onClick={() => setShowQuestionsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-4 sm:p-6">
              {questions.length > 0 ? (
                <div className="space-y-4">
                  {questions.map((question, index) => (
                    <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-gray-900">
                          Question {index + 1} ({question.points} points)
                        </h4>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setEditingQuestion(question)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteQuestion(question.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-gray-700 mb-3">{question.question_text}</p>
                      <div className="space-y-2">
                        {question.options.map((option, optionIndex) => (
                          <div
                            key={optionIndex}
                            className={`p-2 rounded text-sm ${
                              optionIndex === question.correct_option
                                ? 'bg-green-100 text-green-800 font-medium'
                                : 'bg-gray-50 text-gray-700'
                            }`}
                          >
                            {String.fromCharCode(65 + optionIndex)}. {option}
                            {optionIndex === question.correct_option && ' ✓'}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <HelpCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No questions added yet.</p>
                  <button
                    onClick={() => openAddQuestionModal(selectedQuiz)}
                    className="mt-4 inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    <HelpCircle className="w-4 h-4 mr-2" />
                    Add First Question
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Question Modal */}
      {showAddQuestionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold mb-4">Add New Question</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Question Text</label>
                  <textarea
                    value={newQuestion.question_text}
                    onChange={(e) => setNewQuestion({ ...newQuestion, question_text: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                    placeholder="Enter your question here..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Answer Options</label>
                  <div className="space-y-2">
                    {newQuestion.options.map((option, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="correct_option"
                          checked={newQuestion.correct_option === index}
                          onChange={() => setNewQuestion({ ...newQuestion, correct_option: index })}
                          className="text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm font-medium text-gray-700 w-6">
                          {String.fromCharCode(65 + index)}.
                        </span>
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => updateQuestionOption(index, e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                          placeholder={`Option ${String.fromCharCode(65 + index)}`}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Select the radio button next to the correct answer</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
                    <input
                      type="number"
                      min="1"
                      value={newQuestion.points}
                      onChange={(e) => setNewQuestion({ ...newQuestion, points: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
                    <input
                      type="number"
                      min="0"
                      value={newQuestion.order_index}
                      onChange={(e) => setNewQuestion({ ...newQuestion, order_index: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 mt-6">
                <button
                  onClick={() => setShowAddQuestionModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  onClick={createQuestion}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 order-1 sm:order-2"
                >
                  Add Question
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Question Modal */}
      {editingQuestion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold mb-4">Edit Question</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Question Text</label>
                  <textarea
                    value={editingQuestion.question_text}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, question_text: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Answer Options</label>
                  <div className="space-y-2">
                    {editingQuestion.options.map((option, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="edit_correct_option"
                          checked={editingQuestion.correct_option === index}
                          onChange={() => setEditingQuestion({ ...editingQuestion, correct_option: index })}
                          className="text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm font-medium text-gray-700 w-6">
                          {String.fromCharCode(65 + index)}.
                        </span>
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => updateQuestionOption(index, e.target.value, true)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
                    <input
                      type="number"
                      min="1"
                      value={editingQuestion.points}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, points: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
                    <input
                      type="number"
                      min="0"
                      value={editingQuestion.order_index}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, order_index: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 mt-6">
                <button
                  onClick={() => setEditingQuestion(null)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 order-2 sm:order-1"
                >
                  Cancel
                </button>
                <button
                  onClick={updateQuestion}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 order-1 sm:order-2"
                >
                  Update Question
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}