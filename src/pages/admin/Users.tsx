import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, Profile, UserRole } from '../../lib/supabase';
import { Users, Crown, Shield, User, Edit2, Trash2, Plus, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import ConfirmModal from '../../components/ConfirmModal';
import AlertModal from '../../components/AlertModal';
import PasswordModal from '../../components/PasswordModal';

export default function AdminUsers() {
  const { profile, isSuperAdmin, session, refreshProfile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'USER' as UserRole });
  const [updating, setUpdating] = useState(false);
  const [creating, setCreating] = useState(false);
  
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

  const [passwordModal, setPasswordModal] = useState<{
    isOpen: boolean;
    password: string;
    userName: string;
  }>({
    isOpen: false,
    password: '',
    userName: ''
  });
  
  // Sorting and filtering state
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'created_at'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const initializeComponent = async () => {
      // Refresh the user's profile to ensure we have the latest role information
      await refreshProfile();
      
      if (isSuperAdmin()) {
        loadUsers();
      } else {
        setLoading(false);
      }
    };

    initializeComponent();
  }, [profile?.id]); // Only depend on profile.id to prevent excessive reloads

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    if (!isSuperAdmin()) {
      showAlert('Access Denied', 'You do not have permission to update user roles.', 'error');
      return;
    }

    // Find the user being updated
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) {
      showAlert('Error', 'User not found', 'error');
      return;
    }

    setUpdating(true);
    try {
      // Use the service role key for admin operations
      const { data, error } = await supabase.rpc('update_user_role', {
        target_user_id: userId,
        new_role: newRole
      });

      if (error) {
        // Fallback to direct update
        const { data: directData, error: directError } = await supabase
          .from('profiles')
          .update({ 
            role: newRole,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId)
          .select();

        if (directError) {
          throw directError;
        }
      }

      // Wait a moment for the database to process
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify the update by fetching the user again
      const { data: verifyData, error: verifyError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (verifyError) {
        throw verifyError;
      } else {
        if (verifyData.role !== newRole) {
          throw new Error(`Role update failed. Database still shows: ${verifyData.role}`);
        }
      }

      // Update local state with verified data
      const updatedUsers = users.map(user => 
        user.id === userId ? verifyData : user
      );
      setUsers(updatedUsers);
      
      setEditingUser(null);
      showAlert('Success', `User role updated to ${newRole.toLowerCase().replace('_', ' ')} successfully!`, 'success');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showAlert('Update Failed', `Failed to update user role: ${errorMessage}`, 'error');
      
      // Reset the editing state on error
      setEditingUser(null);
    } finally {
      setUpdating(false);
    }
  };

  const handleRoleChange = (newRole: UserRole) => {
    if (!editingUser) {
      return;
    }
    
    setEditingUser({
      ...editingUser,
      role: newRole
    });
  };

  const saveRoleChange = async () => {
    if (!editingUser) {
      return;
    }
    
    await updateUserRole(editingUser.id, editingUser.role);
  };

  const cancelEdit = () => {
    setEditingUser(null);
  };

  const startEdit = (user: Profile) => {
    setEditingUser(user);
  };

  const deleteUser = async (userId: string) => {
    const userToDelete = users.find(u => u.id === userId);
    if (!userToDelete) return;

    showConfirm(
      'Delete User',
      `Are you sure you want to delete "${userToDelete.name}"? This action cannot be undone and will permanently remove all user data.`,
      async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        
        try {
          // Refresh profile before attempting deletion to ensure we have the latest role
          await refreshProfile();
          
          // Double-check permissions after refresh
          if (!isSuperAdmin()) {
            showAlert('Access Denied', 'You do not have permission to delete users. Please contact a superadmin.', 'error');
            return;
          }

          // Step 1: Verify user exists in database before deletion
          const { data: userCheck, error: userCheckError } = await supabase
            .from('profiles')
            .select('id, name, email, role')
            .eq('id', userId)
            .single();

          if (userCheckError) {
            throw new Error(`User not found: ${userCheckError.message}`);
          }

          // Step 2: Call the delete-user Edge Function
          const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`;
          
          // Use the authenticated user's session token instead of the anonymous key
          if (!session?.access_token) {
            throw new Error('No valid session token available');
          }

          const headers = {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          };

          const response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ userId })
          });

          if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Failed to delete user: ${response.status} ${errorData}`);
          }

          const result = await response.json();

          // Step 3: Update local state
          const newUsers = users.filter(user => user.id !== userId);
          setUsers(newUsers);
          
          // Step 4: Reload users from database to verify
          await loadUsers();
          
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          showAlert('Success', 'User deleted successfully', 'success');

        } catch (error) {
          console.error('Error deleting user:', error);
          
          // Reload users to ensure UI is in sync with database
          await loadUsers();
          
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
          showAlert('Delete Failed', `Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
        }
      },
      'danger'
    );
  };

  const createUser = async () => {
    if (!newUser.name || !newUser.email) {
      showAlert('Validation Error', 'Please fill in all required fields.', 'warning');
      return;
    }

    setCreating(true);
    try {
      // Generate a temporary password
      const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';
      
      const { data, error } = await supabase.auth.admin.createUser({
        email: newUser.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          name: newUser.name
        }
      });

      if (error) throw error;

      if (data.user) {
        // Create the profile
        const { error: profileError } = await supabase.from('profiles').insert({
          id: data.user.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role
        });

        if (profileError) {
          console.error('Error creating profile:', profileError);
          // Try to clean up the auth user if profile creation failed
          try {
            await supabase.auth.admin.deleteUser(data.user.id);
          } catch (cleanupError) {
            console.warn('Could not clean up auth user after profile creation failure:', cleanupError);
          }
          throw profileError;
        }

        loadUsers();
        setShowCreateModal(false);
        setNewUser({ name: '', email: '', role: 'USER' });
        
        // Show password modal instead of alert
        setPasswordModal({
          isOpen: true,
          password: tempPassword,
          userName: newUser.name
        });
      }
    } catch (error) {
      console.error('Error creating user:', error);
      showAlert('Creation Failed', `Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setCreating(false);
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'SUPERADMIN':
        return <Crown className="w-4 h-4 text-purple-600" />;
      case 'COURSE_ADMIN':
        return <Shield className="w-4 h-4 text-blue-600" />;
      default:
        return <User className="w-4 h-4 text-gray-600" />;
    }
  };

  const getRoleBadge = (role: UserRole) => {
    const colors = {
      SUPERADMIN: 'bg-purple-100 text-purple-800',
      COURSE_ADMIN: 'bg-blue-100 text-blue-800',
      USER: 'bg-gray-100 text-gray-800'
    };

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colors[role]}`}>
        {getRoleIcon(role)}
        <span className="ml-1">{role.replace('_', ' ')}</span>
      </span>
    );
  };

  const getRolePriority = (role: UserRole): number => {
    switch (role) {
      case 'SUPERADMIN': return 3;
      case 'COURSE_ADMIN': return 2;
      case 'USER': return 1;
      default: return 0;
    }
  };

  const handleSort = (field: 'name' | 'role' | 'created_at') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field: 'name' | 'role' | 'created_at') => {
    if (sortBy !== field) {
      return <ChevronDown className="w-4 h-4 text-gray-400" />;
    }
    return sortOrder === 'asc' ? 
      <ChevronUp className="w-4 h-4 text-blue-600" /> : 
      <ChevronDown className="w-4 h-4 text-blue-600" />;
  };

  // Check if user can edit another user's role
  const canEditUser = (user: Profile): boolean => {
    // Users cannot edit their own role
    if (user.id === profile?.id) {
      return false;
    }
    
    // Only superadmins can edit roles
    return isSuperAdmin();
  };

  // Check if user can delete another user
  const canDeleteUser = (user: Profile): boolean => {
    // Users cannot delete themselves
    if (user.id === profile?.id) {
      return false;
    }
    
    // Only superadmins can delete users
    return isSuperAdmin();
  };

  // Filter and sort users
  const filteredAndSortedUsers = users
    .filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'role':
          comparison = getRolePriority(a.role) - getRolePriority(b.role);
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  if (!isSuperAdmin()) {
    return (
      <div className="text-center py-12">
        <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600">You need superadmin privileges to access this page.</p>
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">User Management</h1>
          <p className="mt-2 text-sm sm:text-base text-gray-600">Manage users and their roles in the system.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add User
        </button>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Users</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder="Search by name..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Roles</option>
              <option value="USER">Users</option>
              <option value="COURSE_ADMIN">Course Admins</option>
              <option value="SUPERADMIN">Superadmins</option>
            </select>
          </div>

          <div className="flex items-end">
            <div className="text-sm text-gray-600">
              Showing {filteredAndSortedUsers.length} of {users.length} users
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center space-x-1">
                    <span>User</span>
                    {getSortIcon('name')}
                  </div>
                </th>
                <th 
                  className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('role')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Role</span>
                    {getSortIcon('role')}
                  </div>
                </th>
                <th 
                  className="hidden sm:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('created_at')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Created</span>
                    {getSortIcon('created_at')}
                  </div>
                </th>
                <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-blue-100 flex-shrink-0">
                        <span className="font-semibold text-blue-600 text-sm sm:text-base">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="ml-3 min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {user.name}
                          {user.id === profile?.id && (
                            <span className="ml-2 text-xs text-blue-600 font-medium">(You)</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 font-mono truncate">
                          {user.id.slice(0, 8)}...
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    {editingUser?.id === user.id ? (
                      <div className="flex items-center space-x-2">
                        <select
                          value={editingUser.role}
                          onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                          className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-blue-500 focus:border-blue-500"
                          disabled={updating}
                        >
                          <option value="USER">User</option>
                          <option value="COURSE_ADMIN">Course Admin</option>
                          <option value="SUPERADMIN">Superadmin</option>
                        </select>
                        {updating && (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        )}
                      </div>
                    ) : (
                      getRoleBadge(user.role)
                    )}
                  </td>
                  <td className="hidden sm:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>
                      {new Date(user.created_at).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(user.created_at).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {editingUser?.id === user.id ? (
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={saveRoleChange}
                          disabled={updating}
                          className="text-green-600 hover:text-green-900 px-2 py-1 text-sm disabled:opacity-50 font-medium"
                        >
                          {updating ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={updating}
                          className="text-gray-600 hover:text-gray-900 px-2 py-1 text-sm disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end space-x-2">
                        {canEditUser(user) ? (
                          <button
                            onClick={() => startEdit(user)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Edit user role"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <div className="w-4 h-4"></div> // Placeholder to maintain spacing
                        )}
                        {canDeleteUser(user) && (
                          <button
                            onClick={() => deleteUser(user.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete user"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Empty State */}
      {filteredAndSortedUsers.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No users found</h3>
          <p className="text-gray-600">
            {searchTerm || roleFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria.'
              : 'No users have been created yet.'
            }
          </p>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Create New User</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="USER">User</option>
                    <option value="COURSE_ADMIN">Course Admin</option>
                    <option value="SUPERADMIN">Superadmin</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 order-2 sm:order-1 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={createUser}
                  disabled={creating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 order-1 sm:order-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating...
                    </div>
                  ) : (
                    'Create User'
                  )}
                </button>
              </div>
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
        confirmText="Delete"
        cancelText="Cancel"
      />

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />

      <PasswordModal
        isOpen={passwordModal.isOpen}
        onClose={() => setPasswordModal(prev => ({ ...prev, isOpen: false }))}
        password={passwordModal.password}
        userName={passwordModal.userName}
      />
    </div>
  );
}