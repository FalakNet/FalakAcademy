import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, Save, X, BarChart2, Settings, ArrowUp, ArrowDown } from 'lucide-react';

// Types matching legacy implementation
export type QuizQuestion = {
  id: string;
  quiz_id: string;
  question_text: string;
  options: string[];
  correct_option: number;
  points: number;
  order_index: number;
};

export type QuizSettings = {
  id: string;
  title: string;
  description?: string;
  max_attempts: number;
  time_limit: number | null;
  // Add any other fields as needed
};

interface QuizManagerProps {
  quizId: string;
  showAnalyticsButton?: boolean; // If true, show analytics button for parent
}

export default function QuizManager({ quizId, showAnalyticsButton }: QuizManagerProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [alert, setAlert] = useState<{ open: boolean; message: string; type: 'error' | 'success' | 'warning' | 'info' }>({ open: false, message: '', type: 'info' });

  // New question state
  const [newQuestion, setNewQuestion] = useState<Partial<QuizQuestion>>({
    question_text: '',
    options: ['', '', '', ''],
    correct_option: 0,
    points: 1,
    order_index: 0,
  });

  // Settings
  const [settings, setSettings] = useState<QuizSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsEdit, setSettingsEdit] = useState(false);

  useEffect(() => {
    if (quizId) {
      fetchQuestions();
      fetchSettings();
    }
  }, [quizId]);

  async function fetchQuestions() {
    setLoading(true);
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('order_index');
    if (!error) setQuestions(data || []);
    setLoading(false);
  }

  async function fetchSettings() {
    setSettingsLoading(true);
    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .single();
    if (!error && data) setSettings({
      id: data.id,
      title: data.title,
      description: data.description,
      max_attempts: data.max_attempts ?? 3,
      time_limit: data.time_limit !== null && data.time_limit !== undefined ? Number(data.time_limit) : null,
      // ...add any other fields as needed
    });
    setSettingsLoading(false);
  }

  async function updateSettings() {
    if (!settings) return;
    // Validate required fields (remove passing_score)
    if (!settings.title || typeof settings.max_attempts !== 'number' || isNaN(settings.max_attempts) || settings.max_attempts < 1) {
      setAlert({ open: true, message: 'Please fill all required fields (title, max attempts) with valid values.', type: 'error' });
      return;
    }
    setSettingsLoading(true);
    // Strictly build the update payload
    const updatePayload: Record<string, any> = {};
    if (typeof settings.title === 'string' && settings.title.trim() !== '') updatePayload.title = settings.title.trim();
    if (typeof settings.description === 'string') updatePayload.description = settings.description.trim() === '' ? null : settings.description.trim();
    if (typeof settings.max_attempts === 'number' && !isNaN(settings.max_attempts)) updatePayload.max_attempts = settings.max_attempts;
    // Only send time_limit if it's a number or null
    if (settings.time_limit === null || (typeof settings.time_limit === 'number' && !isNaN(settings.time_limit))) updatePayload.time_limit = settings.time_limit;
    // passing_score removed from update payload
    // Add more fields as needed, following the same pattern

    const { error } = await supabase
      .from('quizzes')
      .update(updatePayload)
      .eq('id', quizId);
    if (!error) setSettingsEdit(false);
    else setAlert({ open: true, message: error.message || 'Failed to update quiz settings.', type: 'error' });
    setSettingsLoading(false);
    fetchSettings();
  }

  // CRUD for questions
  async function addQuestion() {
    // Validation
    const filteredOptions = (newQuestion.options || []).filter(opt => opt.trim() !== '');
    if (!newQuestion.question_text?.trim() || filteredOptions.length < 2) {
      setAlert({ open: true, message: 'Please provide question text and at least 2 options.', type: 'warning' });
      return;
    }
    if ((newQuestion.correct_option ?? 0) >= filteredOptions.length) {
      setAlert({ open: true, message: 'Please select a valid correct option.', type: 'warning' });
      return;
    }
    const { error } = await supabase.from('questions').insert({
      quiz_id: quizId,
      question_text: newQuestion.question_text,
      options: filteredOptions,
      correct_option: newQuestion.correct_option ?? 0,
      points: newQuestion.points ?? 1,
      order_index: questions.length,
    });
    if (!error) {
      setNewQuestion({ question_text: '', options: ['', '', '', ''], correct_option: 0, points: 1, order_index: 0 });
      fetchQuestions();
    } else {
      setAlert({ open: true, message: 'Failed to add question.', type: 'error' });
    }
  }

  async function updateQuestion() {
    if (!editingQuestion) return;
    const filteredOptions = editingQuestion.options.filter(opt => opt.trim() !== '');
    if (!editingQuestion.question_text.trim() || filteredOptions.length < 2) {
      setAlert({ open: true, message: 'Please provide question text and at least 2 options.', type: 'warning' });
      return;
    }
    if (editingQuestion.correct_option >= filteredOptions.length) {
      setAlert({ open: true, message: 'Please select a valid correct option.', type: 'warning' });
      return;
    }
    const { error } = await supabase.from('questions').update({
      question_text: editingQuestion.question_text,
      options: filteredOptions,
      correct_option: editingQuestion.correct_option,
      points: editingQuestion.points,
      order_index: editingQuestion.order_index,
    }).eq('id', editingQuestion.id);
    if (!error) {
      setShowEditModal(false);
      setEditingQuestion(null);
      fetchQuestions();
    } else {
      setAlert({ open: true, message: 'Failed to update question.', type: 'error' });
    }
  }

  async function deleteQuestion() {
    if (!showDeleteModal.id) return;
    const { error } = await supabase.from('questions').delete().eq('id', showDeleteModal.id);
    if (!error) {
      setShowDeleteModal({ open: false, id: null });
      fetchQuestions();
    } else {
      setAlert({ open: true, message: 'Failed to delete question.', type: 'error' });
    }
  }

  // Reorder questions
  async function moveQuestion(idx: number, dir: 'up' | 'down') {
    if ((dir === 'up' && idx === 0) || (dir === 'down' && idx === questions.length - 1)) return;
    const newQuestions = [...questions];
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    [newQuestions[idx], newQuestions[swapIdx]] = [newQuestions[swapIdx], newQuestions[idx]];
    // Update order_index in DB
    await Promise.all(newQuestions.map((q, i) =>
      supabase.from('questions').update({ order_index: i }).eq('id', q.id)
    ));
    fetchQuestions();
  }

  // UI
  return (
    <div className="space-y-8">
      {/* Analytics Button for parent/main screen */}
      {showAnalyticsButton && (
        <div className="flex justify-end mb-2">
          <a
            href={`/admin/quiz-analytics/${quizId}`}
            className="inline-flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            <BarChart2 className="w-4 h-4 mr-1" />
            Analytics
          </a>
        </div>
      )}

      {/* Settings */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow flex flex-col gap-2">
        <div className="flex items-center gap-2 mb-2 text-blue-700 dark:text-blue-300">
          <Settings className="w-5 h-5" />
          <span className="font-bold text-lg">Quiz Settings</span>
        </div>
        {settingsLoading ? (
          <span className="text-gray-500 dark:text-gray-400">Loading...</span>
        ) : settingsEdit && settings ? (
          <form className="flex flex-wrap md:flex-nowrap gap-4 items-end bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-800 rounded-lg p-4 mt-2 shadow-sm">
            {/* Add title/description fields if you want to allow editing them inline */}
            <div className="flex flex-col min-w-[120px]">
              <label className="block text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Max Attempts</label>
              <input type="number" min={1} max={20} value={settings.max_attempts} onChange={e => setSettings(s => s ? { ...s, max_attempts: parseInt(e.target.value) } : s)} className="px-2 py-1 border border-blue-200 dark:border-blue-700 rounded w-full bg-white dark:bg-blue-900 text-blue-900 dark:text-blue-100 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div className="flex flex-col min-w-[140px]">
              <label className="block text-xs font-semibold mb-1 text-blue-900 dark:text-blue-200">Time Limit (min)</label>
              <input type="number" min={0} max={240} value={settings.time_limit ?? ''} onChange={e => setSettings(s => s ? { ...s, time_limit: e.target.value ? parseInt(e.target.value) : null } : s)} className="px-2 py-1 border border-blue-200 dark:border-blue-700 rounded w-full bg-white dark:bg-blue-900 text-blue-900 dark:text-blue-100 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div className="w-full flex flex-col gap-2 mt-4 md:mt-0 md:ml-4">
              <button type="button" onClick={updateSettings} className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow flex items-center gap-1 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 w-full justify-center"><Save className="w-4 h-4" />Save</button>
              <button type="button" onClick={() => setSettingsEdit(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg shadow flex items-center gap-1 hover:bg-gray-300 dark:hover:bg-gray-600 focus:ring-2 focus:ring-blue-300 w-full justify-center"><X className="w-4 h-4" />Cancel</button>
            </div>
          </form>
        ) : settings ? (
          <div className="flex flex-wrap gap-6 items-center text-sm px-2 py-2">
            <span className="inline-flex items-center gap-1 text-blue-900 dark:text-blue-200"><b>{settings.max_attempts}</b> attempts</span>
            <span className="inline-flex items-center gap-1 text-blue-900 dark:text-blue-200">Time Limit: <b>{settings.time_limit !== null && settings.time_limit !== undefined ? `${settings.time_limit} min` : 'None'}</b></span>
            <button onClick={() => setSettingsEdit(true)} className="ml-auto px-3 py-1 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded shadow hover:bg-blue-200 dark:hover:bg-blue-700 transition">Edit</button>
          </div>
        ) : null}
      </div>

      {/* Questions CRUD */}
      <div className="space-y-6">
        <h4 className="text-lg font-bold text-blue-700 dark:text-blue-300 mt-4">Quiz Questions</h4>
        {loading ? <div>Loading...</div> : (
          <div className="space-y-4">
            {questions.map((q, idx) => (
              <div key={q.id} className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Q{idx + 1}: {q.question_text} <span className="ml-2 text-xs text-gray-500">({q.points} pts)</span></span>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingQuestion(q); setShowEditModal(true); }} className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900"><Edit2 className="w-4 h-4 text-blue-600" /></button>
                    <button onClick={() => setShowDeleteModal({ open: true, id: q.id })} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900"><Trash2 className="w-4 h-4 text-red-600" /></button>
                    <button onClick={() => moveQuestion(idx, 'up')} disabled={idx === 0} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"><ArrowUp className="w-4 h-4" /></button>
                    <button onClick={() => moveQuestion(idx, 'down')} disabled={idx === questions.length - 1} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"><ArrowDown className="w-4 h-4" /></button>
                  </div>
                </div>
                <ul className="ml-4 mt-1 space-y-1">
                  {q.options.map((opt, i) => (
                    <li key={i} className={q.correct_option === i ? 'font-semibold text-green-600 dark:text-green-400' : ''}>
                      {String.fromCharCode(65 + i)}. {opt} {q.correct_option === i && <span className="ml-1">✓</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        {/* Modern Add New Question Card */}
        <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow p-6 mt-6 max-w-2xl mx-auto">
          <div className="absolute -top-5 left-6 flex items-center gap-2">
            <Plus className="w-6 h-6 text-green-600 bg-white dark:bg-gray-900 rounded-full border border-green-200 dark:border-green-700 shadow p-1" />
            <h5 className="font-bold text-lg text-green-700 dark:text-green-300">Add New Question</h5>
          </div>
          <form className="space-y-5 pt-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Question Text</label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-green-500 focus:border-green-500 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="Enter your question here..."
                value={newQuestion.question_text || ''}
                onChange={e => setNewQuestion(q => ({ ...q, question_text: e.target.value }))}
                rows={2}
                maxLength={300}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Answer Options</label>
              <div className="grid grid-cols-1 2xl:grid-cols-2 gap-2">
                {(newQuestion.options || []).map((opt, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1">
                    <input
                      className="flex-1 px-2 py-1 border-none bg-transparent focus:ring-0 text-gray-900 dark:text-gray-100"
                      placeholder={`Option ${String.fromCharCode(65 + i)}`}
                      value={opt}
                      onChange={e => setNewQuestion(q => ({ ...q, options: (q.options || []).map((o, oi) => oi === i ? e.target.value : o) }))}
                      maxLength={100}
                    />
                    <input
                      type="radio"
                      checked={newQuestion.correct_option === i}
                      onChange={() => setNewQuestion(q => ({ ...q, correct_option: i }))}
                      className="accent-green-600"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Select the radio button next to the correct answer</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Points</label>
                <input
                  type="number"
                  min={1}
                  value={newQuestion.points || 1}
                  onChange={e => setNewQuestion(q => ({ ...q, points: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-green-500 focus:border-green-500 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder="Points"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Order</label>
                <input
                  type="number"
                  min={0}
                  value={newQuestion.order_index || 0}
                  onChange={e => setNewQuestion(q => ({ ...q, order_index: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-green-500 focus:border-green-500 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder="Order"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={addQuestion}
                className="inline-flex items-center px-5 py-2 bg-green-600 text-white font-semibold rounded-lg shadow hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition"
              >
                <Plus className="w-4 h-4 mr-1" />Add Question
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Edit Question Modal */}
      {showEditModal && editingQuestion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold mb-4">Edit Question</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Question Text</label>
                  <textarea
                    value={editingQuestion.question_text}
                    onChange={e => setEditingQuestion(q => q ? { ...q, question_text: e.target.value } : null)}
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
                          name="correct_option_edit"
                          checked={editingQuestion.correct_option === index}
                          onChange={() => setEditingQuestion(q => q ? { ...q, correct_option: index } : null)}
                          className="text-purple-600 focus:ring-purple-500"
                        />
                        <input
                          type="text"
                          value={option}
                          onChange={e => setEditingQuestion(q => q ? { ...q, options: q.options.map((o, i) => i === index ? e.target.value : o) } : null)}
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
                      value={editingQuestion.points}
                      onChange={e => setEditingQuestion(q => q ? { ...q, points: parseInt(e.target.value) } : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
                    <input
                      type="number"
                      min="0"
                      value={editingQuestion.order_index}
                      onChange={e => setEditingQuestion(q => q ? { ...q, order_index: parseInt(e.target.value) } : null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 mt-6">
                <button
                  onClick={() => { setShowEditModal(false); setEditingQuestion(null); }}
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

      {/* Delete Confirmation Modal */}
      {showDeleteModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
              <p className="mb-4">Are you sure you want to delete this question? This action cannot be undone.</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowDeleteModal({ open: false, id: null })} className="px-4 py-2 text-gray-600 hover:text-gray-800">Cancel</button>
                <button onClick={deleteQuestion} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {alert.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">{alert.type === 'error' ? 'Error' : alert.type === 'warning' ? 'Warning' : 'Info'}</h3>
              <p className="mb-4">{alert.message}</p>
              <div className="flex justify-end">
                <button onClick={() => setAlert({ ...alert, open: false })} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">OK</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
