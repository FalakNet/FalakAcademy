import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase, Quiz, Question, QuizAttempt } from '../lib/supabase';
import { Brain, Clock, CheckCircle, XCircle, ArrowLeft, ArrowRight, AlertTriangle } from 'lucide-react';

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
      alert('Failed to load quiz');
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
      alert('Failed to start quiz');
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
      alert('Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getBestScore = () => {
    if (previousAttempts.length === 0) return null;
    const completedAttempts = previousAttempts.filter(attempt => attempt.completed);
    if (completedAttempts.length === 0) return null;
    
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
      <div className="text-center py-12">
        <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Quiz not found</h2>
        <p className="text-gray-600">This quiz doesn't exist or has no questions.</p>
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center bg-blue-100">
            <Brain className="w-10 h-10 text-blue-600" />
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Quiz Completed
          </h1>
          
          <p className="text-gray-600 mb-6">
            You have used all {quiz.max_attempts} attempt{quiz.max_attempts !== 1 ? 's' : ''} for this quiz.
          </p>

          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">Final Results</h3>
            <div className="grid grid-cols-2 gap-4 text-center mb-6">
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {attemptsUsed}
                </p>
                <p className="text-sm text-gray-600">Attempts Used</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {bestScore !== null ? `${bestScore}%` : 'N/A'}
                </p>
                <p className="text-sm text-gray-600">Best Score</p>
              </div>
            </div>

            {completedAttempts.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">All Attempts</h4>
                <div className="space-y-2">
                  {completedAttempts.map((attempt, index) => {
                    const percentage = Math.round((attempt.score / attempt.max_score) * 100);
                    const passed = percentage >= 70;
                    
                    return (
                      <div key={attempt.id} className="flex justify-between items-center p-3 bg-white rounded border">
                        <div className="flex items-center">
                          <span className="text-sm text-gray-600 mr-3">
                            Attempt {index + 1}
                          </span>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            passed
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {passed ? (
                              <CheckCircle className="w-3 h-3 mr-1" />
                            ) : (
                              <XCircle className="w-3 h-3 mr-1" />
                            )}
                            {passed ? 'Passed' : 'Failed'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-medium">
                            {percentage}%
                          </span>
                          <div className="text-xs text-gray-500">
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

          {bestScore !== null && bestScore >= 70 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                <p className="text-green-800 font-medium">
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
    const passed = percentage >= 70; // 70% passing grade
    const bestScore = getBestScore();
    const isNewBest = bestScore === null || percentage > bestScore;
    const attemptsRemaining = getAttemptsRemaining();

    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <div className={`w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center ${
            passed ? 'bg-green-100' : 'bg-red-100'
          }`}>
            {passed ? (
              <CheckCircle className="w-10 h-10 text-green-600" />
            ) : (
              <XCircle className="w-10 h-10 text-red-600" />
            )}
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {passed ? 'Congratulations!' : 'Quiz Completed'}
          </h1>
          
          <p className="text-gray-600 mb-6">
            {passed 
              ? 'You have successfully completed the quiz!' 
              : 'You completed the quiz, but didn\'t reach the passing grade.'}
          </p>

          {isNewBest && bestScore !== null && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-yellow-800 font-medium">🎉 New Personal Best!</p>
              <p className="text-yellow-700 text-sm">
                Previous best: {bestScore}% → New best: {percentage}%
              </p>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-900">{score.score}</p>
                <p className="text-sm text-gray-600">Points Earned</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{score.maxScore}</p>
                <p className="text-sm text-gray-600">Total Points</p>
              </div>
              <div>
                <p className={`text-2xl font-bold ${passed ? 'text-green-600' : 'text-red-600'}`}>
                  {percentage}%
                </p>
                <p className="text-sm text-gray-600">Score</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Attempts used: {attemptsUsed} of {quiz.max_attempts}</span>
                <span>Attempts remaining: {attemptsRemaining}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-center space-x-4">
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Back to Course
            </button>
            {!passed && attemptsRemaining > 0 && (
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Brain className="w-8 h-8 text-purple-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{quiz.title}</h1>
            <p className="text-gray-600">{quiz.description}</p>
          </div>

          {/* Attempts Warning */}
          {attemptsRemaining <= 3 && (
            <div className={`mb-6 p-4 rounded-lg border ${
              attemptsRemaining === 1 
                ? 'bg-red-50 border-red-200' 
                : 'bg-yellow-50 border-yellow-200'
            }`}>
              <div className="flex items-center">
                <AlertTriangle className={`w-5 h-5 mr-2 ${
                  attemptsRemaining === 1 ? 'text-red-600' : 'text-yellow-600'
                }`} />
                <div>
                  <p className={`font-medium ${
                    attemptsRemaining === 1 ? 'text-red-800' : 'text-yellow-800'
                  }`}>
                    {attemptsRemaining === 1 ? 'Final Attempt!' : 'Limited Attempts Remaining'}
                  </p>
                  <p className={`text-sm ${
                    attemptsRemaining === 1 ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    You have {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} left for this quiz.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h3 className="font-semibold text-gray-900 mb-4">Quiz Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Questions</p>
                <p className="font-medium">{questions.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Attempts Remaining</p>
                <p className="font-medium">{attemptsRemaining} of {quiz.max_attempts}</p>
              </div>
              {quiz.time_limit && (
                <div>
                  <p className="text-sm text-gray-600">Time Limit</p>
                  <p className="font-medium">{quiz.time_limit} minutes</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600">Passing Grade</p>
                <p className="font-medium">70%</p>
              </div>
              {bestScore !== null && (
                <div className="col-span-2">
                  <p className="text-sm text-gray-600">Your Best Score</p>
                  <p className="font-medium text-green-600">{bestScore}%</p>
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
  const progress = (answeredQuestions / questions.length) * 100;
  const attemptsRemaining = getAttemptsRemaining();

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{quiz.title}</h1>
            <p className="text-sm text-gray-600">
              Attempt {currentAttemptNumber} of {quiz.max_attempts}
            </p>
          </div>
          {timeLeft !== null && (
            <div className="flex items-center text-purple-600">
              <Clock className="w-5 h-5 mr-2" />
              <span className="font-mono text-lg">{formatTime(timeLeft)}</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
            <span>{answeredQuestions} answered</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {currentQuestion.question_text}
          </h2>
          <p className="text-sm text-gray-500">
            Worth {currentQuestion.points} point{currentQuestion.points !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="space-y-3">
          {currentQuestion.options.map((option, index) => (
            <label
              key={index}
              className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                answers[currentQuestion.id] === index
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-gray-200 hover:bg-gray-50'
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
              <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                answers[currentQuestion.id] === index
                  ? 'border-purple-500 bg-purple-500'
                  : 'border-gray-300'
              }`}>
                {answers[currentQuestion.id] === index && (
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                )}
              </div>
              <span className="text-gray-900">{option}</span>
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
      <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Question Overview</h3>
        <div className="grid grid-cols-10 gap-2">
          {questions.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentQuestionIndex(index)}
              className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                index === currentQuestionIndex
                  ? 'bg-purple-600 text-white'
                  : answers[questions[index].id] !== undefined
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}