import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, Profile, UserRole } from '../../lib/supabase';
import { Users, Crown, Shield, User, Edit2, Trash2, Plus, ChevronDown, ChevronUp, Filter } from 'lucide-react';

export default function AdminUsers() {
  const { profile, isSuperAdmin, session, refreshProfile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'USER' as UserRole });
  
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
  }, [profile]);

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

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ));
      setEditingUser(null);
    } catch (error) {
      console.error('Error updating user role:', error);
      alert('Failed to update user role');
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    console.log('🚀 STARTING USER DELETION PROCESS');
    console.log('📋 Target User ID:', userId);
    console.log('👤 Current User ID:', profile?.id);
    console.log('🔑 Current User Role:', profile?.role);

    try {
      // Refresh profile before attempting deletion to ensure we have the latest role
      await refreshProfile();
      
      // Double-check permissions after refresh
      if (!isSuperAdmin()) {
        alert('You do not have permission to delete users. Please contact a superadmin.');
        return;
      }

      // Step 1: Verify user exists in database before deletion
      console.log('🔍 STEP 1: Checking if user exists in database...');
      const { data: userCheck, error: userCheckError } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .eq('id', userId)
        .single();

      if (userCheckError) {
        console.error('❌ User check failed:', userCheckError);
        throw new Error(`User not found: ${userCheckError.message}`);
      }

      console.log('✅ User found in database:', userCheck);

      // Step 2: Call the delete-user Edge Function
      console.log('🗑️ STEP 2: Calling delete-user Edge Function...');
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
        console.error('❌ Edge Function call failed:', response.status, errorData);
        throw new Error(`Failed to delete user: ${response.status} ${errorData}`);
      }

      const result = await response.json();
      console.log('✅ Edge Function response:', result);

      // Step 3: Update local state
      console.log('🔄 STEP 3: Updating local state...');
      const originalUsersCount = users.length;
      const newUsers = users.filter(user => user.id !== userId);
      setUsers(newUsers);
      
      console.log('📊 Users count before:', originalUsersCount);
      console.log('📊 Users count after:', newUsers.length);
      console.log('✅ Local state updated successfully');

      // Step 4: Reload users from database to verify
      console.log('🔄 STEP 4: Reloading users from database to verify...');
      await loadUsers();
      
      console.log('🎉 USER DELETION COMPLETED SUCCESSFULLY');
      alert('User deleted successfully');

    } catch (error) {
      console.error('💥 USER DELETION FAILED:', error);
      console.error('📋 Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        userId,
        timestamp: new Date().toISOString()
      });
      
      // Reload users to ensure UI is in sync with database
      console.log('🔄 Reloading users to sync UI with database...');
      await loadUsers();
      
      alert(`Failed to delete user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const createUser = async () => {
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
        
        alert(`User created successfully with temporary password: ${tempPassword}\nPlease share this password securely with the user.`);
      }
    } catch (error) {
      console.error('Error creating user:', error);
      alert(`Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
                      <select
                        value={editingUser.role}
                        onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as UserRole })}
                        className="text-sm border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="USER">User</option>
                        <option value="COURSE_ADMIN">Course Admin</option>
                        <option value="SUPERADMIN">Superadmin</option>
                      </select>
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
                          onClick={() => updateUserRole(user.id, editingUser.role)}
                          className="text-green-600 hover:text-green-900 px-2 py-1 text-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingUser(null)}
                          className="text-gray-600 hover:text-gray-900 px-2 py-1 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end space-x-2">
                        {canEditUser(user) ? (
                          <button
                            onClick={() => setEditingUser(user)}
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
    </div>
  );
}