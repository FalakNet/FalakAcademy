import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase, Quiz, Question, QuizAttempt } from '../lib/supabase';
import { Brain, Clock, CheckCircle, XCircle, ArrowLeft, ArrowRight, AlertTriangle } from 'lucide-react';
import AlertModal from '../components/AlertModal';

export default function QuizTaking() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [score, setScore] = useState<{ score: number; maxScore: number } | null>(null);
  const [previousAttempts, setPreviousAttempts] = useState<QuizAttempt[]>([]);
  const [canTakeQuiz, setCanTakeQuiz] = useState(true);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [currentAttemptNumber, setCurrentAttemptNumber] = useState(1);
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'warning' | 'info',
  });

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setAlertModal({
      isOpen: true,
      title,
      message,
      type,
    });
  };

  useEffect(() => {
    if (quizId && profile) {
      loadQuizData();
    }
  }, [quizId, profile]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (quizStarted && timeLeft !== null && timeLeft > 0 && !quizCompleted) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev === null || prev <= 1) {
            submitQuiz();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [quizStarted, timeLeft, quizCompleted]);

  const loadQuizData = async () => {
    if (!quizId || !profile) return;

    try {
      // Load quiz details
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .single();

      if (quizError) throw quizError;

      // Load previous attempts
      const { data: attemptsData, error: attemptsError } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('user_id', profile.id)
        .eq('quiz_id', quizId)
        .order('started_at', { ascending: false });

      if (attemptsError) throw attemptsError;

      const attempts = attemptsData || [];
      setPreviousAttempts(attempts);

      // Count completed attempts only
      const completedAttempts = attempts.filter(attempt => attempt.completed);
      const usedAttempts = completedAttempts.length;
      const remainingAttempts = quizData.max_attempts - usedAttempts;
      const nextAttemptNumber = usedAttempts + 1;

      setAttemptsUsed(usedAttempts);
      setCurrentAttemptNumber(nextAttemptNumber);
      setCanTakeQuiz(remainingAttempts > 0);

      // Always load questions for display purposes (even if can't take quiz)
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('order_index');

      if (questionsError) throw questionsError;
      setQuestions(questionsData || []);

      setQuiz(quizData);
      
      if (quizData.time_limit) {
        setTimeLeft(quizData.time_limit * 60); // Convert minutes to seconds
      }
    } catch (error) {
      console.error('Error loading quiz data:', error);
      showAlert('Error', 'Failed to load quiz', 'error');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const startQuiz = async () => {
    if (!quiz || !profile || !canTakeQuiz) return;

    try {
      // Create a new attempt record when starting
      const { data: attemptData, error } = await supabase
        .from('quiz_attempts')
        .insert({
          user_id: profile.id,
          quiz_id: quiz.id,
          answers: {},
          score: 0,
          max_score: 0,
          completed: false,
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      setQuizStarted(true);
    } catch (error) {
      console.error('Error starting quiz:', error);
      showAlert('Error', 'Failed to start quiz', 'error');
    }
  };

  const selectAnswer = (questionId: string, optionIndex: number) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: optionIndex
    }));
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const submitQuiz = async () => {
    if (!quiz || !profile || submitting) return;

    setSubmitting(true);
    try {
      // Calculate score
      let totalScore = 0;
      let maxScore = 0;

      questions.forEach(question => {
        maxScore += question.points;
        const userAnswer = answers[question.id];
        if (userAnswer === question.correct_option) {
          totalScore += question.points;
        }
      });

      // Update the most recent incomplete attempt or create a new one
      const { data: incompleteAttempt } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('user_id', profile.id)
        .eq('quiz_id', quiz.id)
        .eq('completed', false)
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (incompleteAttempt) {
        // Update existing incomplete attempt
        const { error } = await supabase
          .from('quiz_attempts')
          .update({
            answers,
            score: totalScore,
            max_score: maxScore,
            completed: true,
            completed_at: new Date().toISOString()
          })
          .eq('id', incompleteAttempt.id);

        if (error) throw error;
      } else {
        // Create new attempt if none exists
        const { error } = await supabase
          .from('quiz_attempts')
          .insert({
            user_id: profile.id,
            quiz_id: quiz.id,
            answers,
            score: totalScore,
            max_score: maxScore,
            completed: true,
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString()
          });

        if (error) throw error;
      }

      setScore({ score: totalScore, maxScore });
      setQuizCompleted(true);
      
      // Update attempts count
      setAttemptsUsed(prev => prev + 1);
    } catch (error) {
      console.error('Error submitting quiz:', error);
      showAlert('Error', 'Failed to submit quiz', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Helper to get passingScore from section_content for this quiz
  function getPassingScoreFromSectionContent(): number {
    // Try to find the section_content for this quiz
    // This assumes the quizId is in the URL and matches a section_content
    // You may want to pass it as a prop or context if needed
    const allSections = window.__ALL_COURSE_SECTIONS__ || [];
    for (const section of allSections) {
      for (const content of section.content || []) {
        if (content.content_type === 'quiz' && content.content_data?.quiz_id === quizId) {
          return typeof content.content_data.passingScore === 'number' ? content.content_data.passingScore : 70;
        }
      }
    }
    return 70;
  }

  // Detect grading disabled using section_content passingScore
  const passingScore = getPassingScoreFromSectionContent();
  const gradingDisabled = passingScore === 0;

  const getBestScore = () => {
    if (previousAttempts.length === 0) return null;
    const completedAttempts = previousAttempts.filter(attempt => attempt.completed);
    if (completedAttempts.length === 0) return null;
    if (gradingDisabled) return 100;
    return Math.max(...completedAttempts.map(attempt => 
      Math.round((attempt.score / attempt.max_score) * 100)
    ));
  };

  const getAttemptsRemaining = () => {
    return quiz ? quiz.max_attempts - attemptsUsed : 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="text-center py-12 p-4 lg:p-6">
        <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Quiz not found</h2>
        <p className="text-gray-600 dark:text-gray-400">This quiz doesn't exist or has no questions.</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  // No attempts remaining screen - show final results
  if (!canTakeQuiz && !quizStarted && !quizCompleted) {
    const bestScore = getBestScore();
    const completedAttempts = previousAttempts.filter(attempt => attempt.completed);
    
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/30">
            <Brain className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          </div>

          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Quiz Completed
          </h1>
          
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You have used all {quiz.max_attempts} attempt{quiz.max_attempts !== 1 ? 's' : ''} for this quiz.
          </p>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Final Results</h3>
            <div className="grid grid-cols-2 gap-4 text-center mb-6">
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {attemptsUsed}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Attempts Used</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {gradingDisabled ? 'Grading Disabled' : bestScore !== null ? `${bestScore}%` : 'N/A'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{gradingDisabled ? 'Grading Disabled' : 'Best Score'}</p>
              </div>
            </div>

            {completedAttempts.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">All Attempts</h4>
                <div className="space-y-2">
                  {completedAttempts.map((attempt, index) => {
                    const percentage = Math.round((attempt.score / attempt.max_score) * 100);
                    const passed = gradingDisabled ? true : percentage >= passingScore;
                    
                    return (
                      <div key={attempt.id} className="flex justify-between items-center p-3 bg-white dark:bg-gray-600 rounded border border-gray-200 dark:border-gray-500">
                        <div className="flex items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-300 mr-3">
                            Attempt {index + 1}
                          </span>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            gradingDisabled
                              ? 'bg-gray-200 text-gray-700'
                              : passed
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                          }`}>
                            {gradingDisabled ? 'Grading Disabled' : passed ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                            {gradingDisabled ? 'Grading Disabled' : passed ? 'Passed' : 'Failed'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {gradingDisabled ? '—' : `${percentage}%`}
                          </span>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(attempt.completed_at!).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          {gradingDisabled ? (
            <div className="bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-gray-600 dark:text-gray-400 mr-2" />
                <p className="text-gray-800 dark:text-gray-200 font-medium">
                  Grading is disabled for this quiz. All attempts are considered passing.
                </p>
              </div>
            </div>
          ) : bestScore !== null && bestScore >= passingScore && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
                <p className="text-green-800 dark:text-green-200 font-medium">
                  Congratulations! You passed this quiz with a best score of {bestScore}%
                </p>
              </div>
            </div>
          )}
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Course
          </button>
        </div>
      </div>
    );
  }

  // Quiz completion screen
  if (quizCompleted && score) {
    const percentage = Math.round((score.score / score.maxScore) * 100);
    const passed = gradingDisabled ? true : percentage >= passingScore;
    const bestScore = getBestScore();
    const isNewBest = bestScore === null || percentage > bestScore;
    const attemptsRemaining = getAttemptsRemaining();
    // Show answers if allowed
    const canViewAnswers = quiz?.view_answers;
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
          <div className={`w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center ${
            gradingDisabled ? 'bg-gray-200 dark:bg-gray-700' : passed ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
          }`}>
            {gradingDisabled ? (
              <CheckCircle className="w-10 h-10 text-gray-600 dark:text-gray-400" />
            ) : passed ? (
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            ) : (
              <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
            )}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {gradingDisabled ? 'Grading Disabled' : passed ? 'Congratulations!' : 'Quiz Completed'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {gradingDisabled
              ? 'Grading is disabled for this quiz. All attempts are considered passing.'
              : passed 
                ? 'You have successfully completed the quiz!' 
                : 'You completed the quiz, but didn\'t reach the passing grade.'}
          </p>
          {isNewBest && bestScore !== null && !gradingDisabled && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
              <p className="text-yellow-800 dark:text-yellow-200 font-medium">🎉 New Personal Best!</p>
              <p className="text-yellow-700 dark:text-yellow-300 text-sm">
                Previous best: {bestScore}% → New best: {percentage}%
              </p>
            </div>
          )}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 mb-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{score.score}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Points Earned</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{score.maxScore}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Points</p>
              </div>
              <div>
                <p className={`text-2xl font-bold ${gradingDisabled ? 'text-gray-600 dark:text-gray-400' : passed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{gradingDisabled ? '—' : `${percentage}%`}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{gradingDisabled ? 'Grading Disabled' : 'Score'}</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>Attempts used: {attemptsUsed} of {quiz.max_attempts}</span>
                <span>Attempts remaining: {attemptsRemaining}</span>
              </div>
            </div>
          </div>
          {/* Show correct answers if allowed */}
          {canViewAnswers && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-6 mt-6">
              <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-4">Quiz Answers</h3>
              <div className="space-y-4 text-left">
                {questions.map((q, idx) => (
                  <div key={q.id} className="p-4 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                    <div className="font-medium text-gray-900 dark:text-white mb-2">Q{idx + 1}: {q.question_text}</div>
                    <ul className="list-disc ml-6">
                      {q.options.map((opt, i) => (
                        <li key={i} className={
                          i === q.correct_option
                            ? 'text-green-700 dark:text-green-400 font-semibold'
                            : 'text-gray-700 dark:text-gray-300'
                        }>
                          {opt} {i === q.correct_option && <span className="ml-2">(Correct)</span>}
                          {answers[q.id] === i && i !== q.correct_option && (
                            <span className="ml-2 text-red-500">(Your answer)</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Back to Course
            </button>
            {!gradingDisabled && !passed && attemptsRemaining > 0 && (
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Retake Quiz ({attemptsRemaining} attempts left)
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Quiz start screen
  if (!quizStarted) {
    const bestScore = getBestScore();
    const attemptsRemaining = getAttemptsRemaining();
    
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Brain className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{quiz.title}</h1>
            <p className="text-gray-600 dark:text-gray-400">{quiz.description}</p>
          </div>

          {/* Attempts Warning */}
          {attemptsRemaining <= 3 && (
            <div className={`mb-6 p-4 rounded-lg border ${
              attemptsRemaining === 1 
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
                : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
            }`}>
              <div className="flex items-center">
                <AlertTriangle className={`w-5 h-5 mr-2 ${
                  attemptsRemaining === 1 ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'
                }`} />
                <div>
                  <p className={`font-medium ${
                    attemptsRemaining === 1 ? 'text-red-800 dark:text-red-200' : 'text-yellow-800 dark:text-yellow-200'
                  }`}>
                    {attemptsRemaining === 1 ? 'Final Attempt!' : 'Limited Attempts Remaining'}
                  </p>
                  <p className={`text-sm ${
                    attemptsRemaining === 1 ? 'text-red-600 dark:text-red-300' : 'text-yellow-600 dark:text-yellow-300'
                  }`}>
                    You have {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} left for this quiz.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 mb-8">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Quiz Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Questions</p>
                <p className="font-medium text-gray-900 dark:text-white">{questions.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Attempts Remaining</p>
                <p className="font-medium text-gray-900 dark:text-white">{attemptsRemaining} of {quiz.max_attempts}</p>
              </div>
              {quiz.time_limit && !gradingDisabled && (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Time Limit</p>
                  <p className="font-medium text-gray-900 dark:text-white">{quiz.time_limit} minutes</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Passing Grade</p>
                <p className="font-medium text-gray-900 dark:text-white">{gradingDisabled ? 'Grading Disabled' : `${passingScore}%`}</p>
              </div>
              {bestScore !== null && !gradingDisabled && (
                <div className="col-span-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Your Best Score</p>
                  <p className="font-medium text-green-600 dark:text-green-400">{bestScore}%</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-center space-x-4">
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={startQuiz}
              disabled={!canTakeQuiz}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {canTakeQuiz ? 'Start Quiz' : 'No Attempts Remaining'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Quiz taking interface
  const currentQuestion = questions[currentQuestionIndex];
  const answeredQuestions = Object.keys(answers).length;

  return (
    <div className="max-w-4xl mx-auto p-4 lg:p-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{quiz.title}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Attempt {currentAttemptNumber} of {quiz.max_attempts}
            </p>
          </div>
          {timeLeft !== null && (
            <div className="flex items-center text-purple-600 dark:text-purple-400">
              <Clock className="w-5 h-5 mr-2" />
              <span className="font-mono text-lg">{formatTime(timeLeft)}</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
            <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
            <span>{answeredQuestions} answered</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-purple-600 dark:bg-purple-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 mb-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            {currentQuestion.question_text}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Worth {currentQuestion.points} point{currentQuestion.points !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="space-y-3">
          {currentQuestion.options.map((option, index) => (
            <label
              key={index}
              className={`flex items-center p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
                answers[currentQuestion.id] === index
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-400 ring-2 ring-purple-200 dark:ring-purple-800'
                  : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <input
                type="radio"
                name={`question-${currentQuestion.id}`}
                value={index}
                checked={answers[currentQuestion.id] === index}
                onChange={() => selectAnswer(currentQuestion.id, index)}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center transition-all duration-200 ${
                answers[currentQuestion.id] === index
                  ? 'border-purple-500 bg-purple-500 dark:border-purple-400 dark:bg-purple-400'
                  : 'border-gray-300 dark:border-gray-500'
              }`}>
                {answers[currentQuestion.id] === index && (
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                )}
              </div>
              <span className="text-gray-900 dark:text-white flex-1">{option}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={previousQuestion}
          disabled={currentQuestionIndex === 0}
          className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Previous
        </button>

        <div className="flex space-x-4">
          {currentQuestionIndex === questions.length - 1 ? (
            <button
              onClick={submitQuiz}
              disabled={submitting || answeredQuestions < questions.length}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Quiz'}
            </button>
          ) : (
            <button
              onClick={nextQuestion}
              className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          )}
        </div>
      </div>

      {/* Question overview */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Question Overview</h3>
        <div className="grid grid-cols-10 gap-2">
          {questions.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentQuestionIndex(index)}
              className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                index === currentQuestionIndex
                  ? 'bg-purple-600 dark:bg-purple-500 text-white'
                  : answers[questions[index].id] !== undefined
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border border-green-300 dark:border-green-700'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600'
              }`}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>

      {/* If grading is disabled, show info banner */}
      {gradingDisabled && (
        <div className="mt-6 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
          <div className="flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-gray-600 dark:text-gray-400 mr-2" />
            <p className="text-gray-800 dark:text-gray-200 font-medium">
              Grading is disabled for this quiz. All attempts are considered passing.
            </p>
          </div>
        </div>
      )}

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />
    </div>
  );
}