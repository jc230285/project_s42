"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from '@/components/DashboardLayout';
import { WithScale42Access } from '@/components/WithScale42Access';
import toast from 'react-hot-toast';

interface User {
  id: number;
  email: string;
  name: string;
  is_active: boolean;
  created_at: string;
  last_login: string;
  groups: { name: string }[];
}

interface Group {
  id: number;
  name: string;
  domain: string;
  description: string;
  permissions: any;
  is_active: boolean;
  created_at: string;
}

export default function UsersPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<Group[]>([]);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDomain, setNewGroupDomain] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const router = useRouter();

  const fetchData = async () => {
    if (!session) return;

    try {
      const userInfo = {
        email: session.user?.email,
        name: session.user?.name,
        authenticated: true
      };
      const authToken = btoa(JSON.stringify(userInfo));
      const baseURL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;
      
      const [usersRes, groupsRes] = await Promise.all([
        fetch(`${baseURL}/users`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          }
        }),
        fetch(`${baseURL}/groups`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          }
        })
      ]);

      if (!usersRes.ok) {
        throw new Error(`Users API: HTTP ${usersRes.status}: ${usersRes.statusText}`);
      }
      if (!groupsRes.ok) {
        throw new Error(`Groups API: HTTP ${groupsRes.status}: ${groupsRes.statusText}`);
      }

      const [usersData, groupsData] = await Promise.all([
        usersRes.json(),
        groupsRes.json()
      ]);

      setUsers(usersData);
      setGroups(groupsData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchData();
    } else if (status !== "loading") {
      router.push('/');
    }
  }, [session, status, router]);

  const assignUserToGroup = async (userId: number, groupId: number) => {
    if (!session) return;

    try {
      const userInfo = {
        email: session.user?.email,
        name: session.user?.name,
        authenticated: true
      };
      const authToken = btoa(JSON.stringify(userInfo));
      const baseURL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;

      const response = await fetch(`${baseURL}/users/${userId}/groups`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          group_id: groupId
        })
      });

      if (response.ok) {
        toast.success('User assigned to group successfully');
        fetchData(); // Refresh data
        setShowGroupModal(false);
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        toast.error(errorData.detail || 'Failed to assign user to group');
      }
    } catch (error) {
      console.error('Error assigning user to group:', error);
      toast.error('Error assigning user to group');
    }
  };

  const removeUserFromGroup = async (userId: number, groupId: number) => {
    if (!session) return;

    try {
      const userInfo = {
        email: session.user?.email,
        name: session.user?.name,
        authenticated: true
      };
      const authToken = btoa(JSON.stringify(userInfo));
      const baseURL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;

      const response = await fetch(`${baseURL}/users/${userId}/groups/${groupId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        toast.success('User removed from group successfully');
        fetchData(); // Refresh data
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        toast.error(errorData.detail || 'Failed to remove user from group');
      }
    } catch (error) {
      console.error('Error removing user from group:', error);
      toast.error('Error removing user from group');
    }
  };

  const createGroup = async () => {
    if (!session || !newGroupName) {
      toast.error('Group name is required');
      return;
    }

    try {
      const userInfo = {
        email: session.user?.email,
        name: session.user?.name,
        authenticated: true
      };
      const authToken = btoa(JSON.stringify(userInfo));
      const baseURL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;

      const response = await fetch(`${baseURL}/groups`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newGroupName,
          domain: newGroupDomain,
          description: newGroupDescription
        })
      });

      if (response.ok) {
        toast.success(`Group "${newGroupName}" created successfully`);
        setShowCreateGroupModal(false);
        setNewGroupName('');
        setNewGroupDomain('');
        setNewGroupDescription('');
        fetchData(); // Refresh data
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        const errorMessage = errorData.detail || `Failed to create group (${response.status})`;
        toast.error(errorMessage);
        console.error('Failed to create group:', response.status, errorData);
      }
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error('Error creating group. Please check the console for details.');
    }
  };

  const deleteGroup = async (groupId: number, groupName: string) => {
    if (groupName === 'Public') {
      toast.error('Cannot delete the Public group - it is required for all users');
      return;
    }

    if (!confirm(`Are you sure you want to delete the group "${groupName}"?`)) {
      return;
    }

    if (!session) return;

    try {
      const userInfo = {
        email: session.user?.email,
        name: session.user?.name,
        authenticated: true
      };
      const authToken = btoa(JSON.stringify(userInfo));
      const baseURL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL;

      const response = await fetch(`${baseURL}/groups/${groupId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        toast.success(`Group "${groupName}" deleted successfully`);
        fetchData(); // Refresh data
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        toast.error(errorData.detail || 'Failed to delete group');
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error('Error deleting group');
    }
  };

  const openGroupModal = (user: User) => {
    setSelectedUser(user);
    // Filter out groups the user is already in
    const userGroupIds = user.groups.map(g => 
      groups.find(group => group.name === g.name)?.id
    ).filter(Boolean);
    
    setAvailableGroups(groups.filter(g => !userGroupIds.includes(g.id)));
    setShowGroupModal(true);
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading users and groups...</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Enhanced User & Group Management</h1>
          <p className="mt-2 text-muted-foreground">Manage users, groups, and role-based permissions with many-to-many relationships</p>
        </div>

        {/* Users Table */}
        <div className="bg-card shadow-sm rounded-lg overflow-hidden border border-border">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-medium text-foreground">System Users ({users.length})</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    User Info
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Groups & Roles
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {users.map((user: User) => (
                  <tr key={user.id} className="hover:bg-accent">
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-foreground">{user.name || user.email}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                        <div className="text-xs text-muted-foreground">
                          ID: {user.id} | Created: {new Date(user.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Last Login: {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {user.groups && user.groups.length > 0 ? (
                          user.groups.map((group, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                {group.name}
                              </span>
                              <button
                                onClick={() => {
                                  const groupObj = groups.find(g => g.name === group.name);
                                  if (groupObj) {
                                    removeUserFromGroup(user.id, groupObj.id);
                                  }
                                }}
                                className="text-red-600 hover:text-red-800 text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">No groups assigned</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.is_active 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => openGroupModal(user)}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Add to Group
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Groups Table */}
        <div className="bg-card shadow-sm rounded-lg overflow-hidden border border-border">
          <div className="px-6 py-4 border-b border-border flex justify-between items-center">
            <h2 className="text-lg font-medium text-foreground">User Groups ({groups.length})</h2>
            <button
              onClick={() => setShowCreateGroupModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              + Create Group
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Group Info
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Domain & Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Permissions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {groups.map((group: Group) => (
                  <tr key={group.id} className="hover:bg-accent">
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-foreground">{group.name}</div>
                        <div className="text-xs text-muted-foreground">
                          ID: {group.id} | Created: {new Date(group.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="text-sm text-foreground">
                          Domain: {group.domain || 'All domains'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {group.description || 'No description'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {group.permissions ? (
                          <div className="space-y-1">
                            <div className="text-xs text-muted-foreground">
                              Pages: {group.permissions.pages?.join(', ') || 'None'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Actions: {group.permissions.actions?.join(', ') || 'None'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">No permissions defined</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        group.is_active 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {group.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => deleteGroup(group.id, group.name)}
                        className={`px-3 py-1 text-sm rounded ${
                          group.name === 'Public'
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-red-600 text-white hover:bg-red-700'
                        }`}
                        disabled={group.name === 'Public'}
                        title={group.name === 'Public' ? 'Cannot delete Public group' : 'Delete group'}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Group Assignment Modal */}
        {showGroupModal && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-card rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-medium text-foreground mb-4">
                Add {selectedUser.name || selectedUser.email} to Group
              </h3>
              
              <div className="space-y-4">
                {availableGroups.length > 0 ? (
                  availableGroups.map((group) => (
                    <div key={group.id} className="border border-border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-foreground">{group.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {group.description || 'No description'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Domain: {group.domain || 'All domains'}
                          </div>
                        </div>
                        <div>
                          <button
                            onClick={() => assignUserToGroup(selectedUser.id, group.id)}
                            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Add to Group
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    User is already assigned to all available groups
                  </p>
                )}
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowGroupModal(false)}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Group Modal */}
        {showCreateGroupModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-card rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-foreground mb-4">Create New Group</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Group Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded bg-background text-foreground"
                    placeholder="e.g., Developers"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Domain (optional)
                  </label>
                  <input
                    type="text"
                    value={newGroupDomain}
                    onChange={(e) => setNewGroupDomain(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded bg-background text-foreground"
                    placeholder="e.g., @scale-42.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    value={newGroupDescription}
                    onChange={(e) => setNewGroupDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded bg-background text-foreground"
                    placeholder="Describe this group's purpose"
                    rows={3}
                  />
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setShowCreateGroupModal(false);
                    setNewGroupName('');
                    setNewGroupDomain('');
                    setNewGroupDescription('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={createGroup}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
                  disabled={!newGroupName}
                >
                  Create Group
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}