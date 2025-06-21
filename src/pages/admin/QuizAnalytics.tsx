import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase, Quiz, Question, QuizAttempt, Profile } from '../../lib/supabase';
import { 
  Brain, ArrowLeft, Users, TrendingUp, Clock, Award, 
  Download, Search, 
  CheckCircle, XCircle, BarChart3, 
} from 'lucide-react';
import AlertModal from '../../components/AlertModal';

interface QuizAttemptWithProfile extends QuizAttempt {
  profiles: Profile;
}

interface QuizStats {
  totalAttempts: number;
  uniqueUsers: number;
  averageScore: number;
  passRate: number;
  averageTime: number;
  bestScore: number;
  worstScore: number;
  userPassRate: number; // Pass rate based on unique users
}

interface QuestionStats {
  questionId: string;
  questionText: string;
  correctAnswers: number;
  totalAnswers: number;
  successRate: number;
  options: string[];
  correctOption: number;
  optionStats: { option: number; count: number; percentage: number }[];
}

export default function QuizAnalytics() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempts, setAttempts] = useState<QuizAttemptWithProfile[]>([]);
  const [stats, setStats] = useState<QuizStats | null>(null);
  const [questionStats, setQuestionStats] = useState<QuestionStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'attempts' | 'questions'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'passed' | 'failed'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'score' | 'name'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  // --- Fetch passingScore from section_content for this quiz ---
  const [passingScore, setPassingScore] = useState<number>(70); // default 70
  const [gradingDisabled, setGradingDisabled] = useState<boolean>(false);

  useEffect(() => {
    async function fetchPassingScore() {
      if (!quizId) return;
      const { data, error } = await supabase
        .from('section_content')
        .select('content_data')
        .eq('content_type', 'quiz')
        .contains('content_data', { quiz_id: quizId })
        .maybeSingle();
      if (data && data.content_data) {
        const score = typeof data.content_data.passingScore === 'number' ? data.content_data.passingScore : 70;
        setPassingScore(score);
        setGradingDisabled(score === 0);
      } else {
        setPassingScore(70);
        setGradingDisabled(false);
      }
    }
    fetchPassingScore();
  }, [quizId]);

  useEffect(() => {
    if (quizId && isAdmin()) {
      loadQuizAnalytics();
    }
  }, [quizId, profile]);

  const calculateStats = (attemptsData: QuizAttemptWithProfile[], questionsData: Question[]) => {
    if (!attemptsData.length) {
      setStats({
        totalAttempts: 0,
        uniqueUsers: 0,
        averageScore: 0,
        passRate: 0,
        averageTime: 0,
        bestScore: 0,
        worstScore: 0,
        userPassRate: 0
      });
      setQuestionStats([]);
      return;
    }

    // Calculate basic stats
    const totalAttempts = attemptsData.length;
    const uniqueUsers = new Set(attemptsData.map(a => a.user_id)).size;
    const scores = attemptsData.map(a => (a.score / a.max_score) * 100);
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    // Use passingScore for pass/fail
    const passedAttempts = gradingDisabled ? attemptsData.length : scores.filter(score => score >= passingScore).length;
    const passRate = (passedAttempts / totalAttempts) * 100;

    // Calculate time spent (in minutes)
    const timesSpent = attemptsData
      .filter(a => a.started_at && a.completed_at)
      .map(a => {
        const start = new Date(a.started_at!).getTime();
        const end = new Date(a.completed_at!).getTime();
        return (end - start) / (1000 * 60); // Convert to minutes
      });
    const averageTime = timesSpent.length > 0 
      ? timesSpent.reduce((sum, time) => sum + time, 0) / timesSpent.length 
      : 0;

    const bestScore = Math.max(...scores);
    const worstScore = Math.min(...scores);

    // Calculate user pass rate (best attempt per user)
    const userBestScores = new Map<string, number>();
    attemptsData.forEach(attempt => {
      const userId = attempt.user_id!;
      const score = (attempt.score / attempt.max_score) * 100;
      if (!userBestScores.has(userId) || userBestScores.get(userId)! < score) {
        userBestScores.set(userId, score);
      }
    });
    const usersPassed = gradingDisabled ? userBestScores.size : Array.from(userBestScores.values()).filter(score => score >= passingScore).length;
    const userPassRate = (usersPassed / uniqueUsers) * 100;

    setStats({
      totalAttempts,
      uniqueUsers,
      averageScore,
      passRate,
      averageTime,
      bestScore,
      worstScore,
      userPassRate
    });

    // Calculate question statistics
    const questionStatsData: QuestionStats[] = questionsData.map(question => {
      const questionAnswers = attemptsData
        .map(attempt => {
          const answers = attempt.answers as Record<string, number>;
          return answers[question.id];
        })
        .filter(answer => answer !== undefined);

      const correctAnswers = questionAnswers.filter(answer => answer === question.correct_option).length;
      const totalAnswers = questionAnswers.length;
      const successRate = totalAnswers > 0 ? (correctAnswers / totalAnswers) * 100 : 0;

      // Calculate option statistics
      const optionCounts = new Map<number, number>();
      questionAnswers.forEach(answer => {
        optionCounts.set(answer, (optionCounts.get(answer) || 0) + 1);
      });

      const optionStats = Array.from(optionCounts.entries()).map(([option, count]) => ({
        option,
        count,
        percentage: totalAnswers > 0 ? (count / totalAnswers) * 100 : 0
      }));

      return {
        questionId: question.id,
        questionText: question.question_text,
        correctAnswers,
        totalAnswers,
        successRate,
        options: question.options as string[],
        correctOption: question.correct_option,
        optionStats
      };
    });

    setQuestionStats(questionStatsData);
  };

  const loadQuizAnalytics = async () => {
    if (!quizId) return;

    try {
      // Load quiz details
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select(`
          *,
          courses (*)
        `)
        .eq('id', quizId)
        .single();

      if (quizError) throw quizError;

      // Load questions
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('order_index');

      if (questionsError) throw questionsError;

      // Load all attempts with user profiles
      const { data: attemptsData, error: attemptsError } = await supabase
        .from('quiz_attempts')
        .select(`
          *,
          profiles (*)
        `)
        .eq('quiz_id', quizId)
        .eq('completed', true)
        .order('completed_at', { ascending: false });

      if (attemptsError) throw attemptsError;

      setQuiz(quizData);
      setQuestions(questionsData || []);
      setAttempts(attemptsData || []);

      // Calculate statistics
      calculateStats(attemptsData || [], questionsData || []);
    } catch (error) {
      console.error('Error loading quiz analytics:', error);
      showAlert('Error', 'Failed to load quiz analytics', 'error');
      navigate('/admin/quizzes');
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedAttempts = attempts
    .filter(attempt => {
      const matchesSearch = attempt.profiles?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
      const score = (attempt.score / attempt.max_score) * 100;
      const matchesFilter = filterStatus === 'all' || 
        (filterStatus === 'passed' && score >= 70) ||
        (filterStatus === 'failed' && score < 70);
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.completed_at || '').getTime() - new Date(b.completed_at || '').getTime();
          break;
        case 'score':
          comparison = (a.score / a.max_score) - (b.score / b.max_score);
          break;
        case 'name':
          comparison = (a.profiles?.name || '').localeCompare(b.profiles?.name || '');
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const exportData = () => {
    const csvContent = [
      ['Name', 'Score', 'Percentage', 'Completed At', 'Time Spent (min)'],
      ...filteredAndSortedAttempts.map(attempt => {
        const timeSpent = attempt.started_at && attempt.completed_at
          ? ((new Date(attempt.completed_at).getTime() - new Date(attempt.started_at).getTime()) / (1000 * 60)).toFixed(1)
          : 'N/A';
        return [
          attempt.profiles?.name || 'Unknown',
          `${attempt.score}/${attempt.max_score}`,
          `${((attempt.score / attempt.max_score) * 100).toFixed(1)}%`,
          attempt.completed_at ? new Date(attempt.completed_at).toLocaleDateString() : 'N/A',
          timeSpent
        ];
      })
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz-analytics-${quiz?.title || 'quiz'}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="text-center py-12">
        <Brain className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Quiz not found</h3>
        <p className="mt-1 text-sm text-gray-500">The quiz you're looking for doesn't exist.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/admin/quizzes')}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Quizzes
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{quiz.title}</h1>
            <p className="text-gray-600">{quiz.description}</p>
          </div>
        </div>
        <button
          onClick={exportData}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Download className="h-4 w-4 mr-2" />
          Export Data
        </button>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Attempts</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalAttempts}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Unique Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.uniqueUsers}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Average Score</p>
                <p className="text-2xl font-bold text-gray-900">{stats.averageScore.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <Award className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pass Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {gradingDisabled ? 'Grading Disabled' : `${stats.passRate.toFixed(1)}%`}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-indigo-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg. Time</p>
                <p className="text-2xl font-bold text-gray-900">{stats.averageTime.toFixed(1)}m</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Best Score</p>
                <p className="text-2xl font-bold text-gray-900">{stats.bestScore.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <XCircle className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Worst Score</p>
                <p className="text-2xl font-bold text-gray-900">{stats.worstScore.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <Award className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">User Pass Rate</p>
                <p className="text-2xl font-bold text-gray-900">{stats.userPassRate.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: 'Overview', icon: BarChart3 },
            { id: 'attempts', name: 'Attempts', icon: Users },
            { id: 'questions', name: 'Questions', icon: Brain }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4 mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Score Distribution */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Score Distribution</h3>
            {gradingDisabled ? (
              <div className="text-gray-500 text-sm">Score distribution is not available when grading is disabled.</div>
            ) : (
              <div className="space-y-3">
                {[
                  { range: '90-100%', color: 'bg-green-500', count: attempts.filter(a => (a.score / a.max_score) * 100 >= 90).length },
                  { range: '80-89%', color: 'bg-blue-500', count: attempts.filter(a => (a.score / a.max_score) * 100 >= 80 && (a.score / a.max_score) * 100 < 90).length },
                  { range: '70-79%', color: 'bg-yellow-500', count: attempts.filter(a => (a.score / a.max_score) * 100 >= 70 && (a.score / a.max_score) * 100 < 80).length },
                  { range: '60-69%', color: 'bg-orange-500', count: attempts.filter(a => (a.score / a.max_score) * 100 >= 60 && (a.score / a.max_score) * 100 < 70).length },
                  { range: 'Below 60%', color: 'bg-red-500', count: attempts.filter(a => (a.score / a.max_score) * 100 < 60).length }
                ].map((item) => (
                  <div key={item.range} className="flex items-center">
                    <div className="w-20 text-sm text-gray-600">{item.range}</div>
                    <div className="flex-1 mx-4">
                      <div className="bg-gray-200 rounded-full h-4">
                        <div
                          className={`${item.color} h-4 rounded-full`}
                          style={{ width: `${attempts.length > 0 ? (item.count / attempts.length) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="w-12 text-sm text-gray-900 text-right">{item.count}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {attempts.slice(0, 5).map((attempt) => (
                <div key={attempt.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{attempt.profiles?.name}</p>
                    <p className="text-xs text-gray-500">
                      {attempt.completed_at ? new Date(attempt.completed_at).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {attempt.score}/{attempt.max_score}
                    </p>
                    <p className="text-xs text-gray-500">
                      {((attempt.score / attempt.max_score) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'attempts' && (
        <div className="bg-white rounded-lg shadow-sm border">
          {/* Filters */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search by name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
                  />
                </div>
              </div>
              {!gradingDisabled && (
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Attempts</option>
                  <option value="passed">Passed (≥70%)</option>
                  <option value="failed">Failed (&lt;70%)</option>
                </select>
              )}
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy(field as any);
                  setSortOrder(order as any);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="date-desc">Latest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="score-desc">Highest Score</option>
                <option value="score-asc">Lowest Score</option>
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
              </select>
            </div>
          </div>

          {/* Attempts Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Percentage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time Spent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Completed
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedAttempts.map((attempt) => {
                  const percentage = (attempt.score / attempt.max_score) * 100;
                  const timeSpent = attempt.started_at && attempt.completed_at
                    ? ((new Date(attempt.completed_at).getTime() - new Date(attempt.started_at).getTime()) / (1000 * 60)).toFixed(1)
                    : 'N/A';
                  
                  return (
                    <tr key={attempt.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {attempt.profiles?.name || 'Unknown'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {attempt.score}/{attempt.max_score}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {percentage.toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {gradingDisabled ? (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-200 text-gray-700">Grading Disabled</span>
                        ) : (
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            percentage >= 70
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {percentage >= 70 ? 'Passed' : 'Failed'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {timeSpent} min
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {attempt.completed_at ? new Date(attempt.completed_at).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredAndSortedAttempts.length === 0 && (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No attempts found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || filterStatus !== 'all' 
                  ? 'Try adjusting your filters.' 
                  : 'No one has taken this quiz yet.'}
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'questions' && (
        <div className="space-y-6">
          {questionStats.map((questionStat, index) => (
            <div key={questionStat.questionId} className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Question {index + 1}
                  </h3>
                  <p className="text-gray-700 mb-4">{questionStat.questionText}</p>
                  <div className="flex items-center space-x-6 text-sm">
                    <div className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-600 mr-1" />
                      <span className="text-gray-600">
                        {questionStat.correctAnswers}/{questionStat.totalAnswers} correct
                      </span>
                    </div>
                    <div className="flex items-center">
                      <TrendingUp className="h-4 w-4 text-blue-600 mr-1" />
                      <span className="text-gray-600">
                        {questionStat.successRate.toFixed(1)}% success rate
                      </span>
                    </div>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  questionStat.successRate >= 70
                    ? 'bg-green-100 text-green-800'
                    : questionStat.successRate >= 50
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {questionStat.successRate.toFixed(1)}%
                </div>
              </div>

              {/* Answer Options Analysis */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-900">Answer Distribution</h4>
                {questionStat.options.map((option, optionIndex) => {
                  const optionStat = questionStat.optionStats.find(s => s.option === optionIndex);
                  const isCorrect = optionIndex === questionStat.correctOption;
                  const count = optionStat?.count || 0;
                  const percentage = optionStat?.percentage || 0;
                  
                  return (
                    <div key={optionIndex} className="flex items-center">
                      <div className="flex items-center w-8">
                        {isCorrect && <CheckCircle className="h-4 w-4 text-green-600" />}
                      </div>
                      <div className="flex-1 mx-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-700">{option}</span>
                          <span className="text-sm text-gray-500">{count} ({percentage.toFixed(1)}%)</span>
                        </div>
                        <div className="bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              isCorrect ? 'bg-green-500' : 'bg-gray-400'
                            }`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {questionStats.length === 0 && (
            <div className="text-center py-12">
              <Brain className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No question data</h3>
              <p className="mt-1 text-sm text-gray-500">
                Question analytics will appear once students start taking the quiz.
              </p>
            </div>
          )}
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