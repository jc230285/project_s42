"use client";
import { getSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function UsersPage() {
  const [session, setSession] = useState(null);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    getSession().then((sess) => {
      setSession(sess);
      if (sess) {
        // Create a simple auth token with user info
        const userInfo = {
          email: sess.user?.email,
          name: sess.user?.name,
          authenticated: true
        };
        const authToken = btoa(JSON.stringify(userInfo));
        
        // Fetch both users and groups
        Promise.all([
          fetch("https://s42api.edbmotte.com/users", {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            }
          }),
          fetch("https://s42api.edbmotte.com/groups", {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            }
          })
        ])
          .then(([usersRes, groupsRes]) => {
            if (!usersRes.ok) {
              throw new Error(`Users API: HTTP ${usersRes.status}: ${usersRes.statusText}`);
            }
            if (!groupsRes.ok) {
              throw new Error(`Groups API: HTTP ${groupsRes.status}: ${groupsRes.statusText}`);
            }
            return Promise.all([usersRes.json(), groupsRes.json()]);
          })
          .then(([usersData, groupsData]) => {
            setUsers(usersData);
            setGroups(groupsData);
            setLoading(false);
          })
          .catch((error) => {
            console.error("Error fetching data:", error);
            setLoading(false);
          });
      } else {
        router.push('/');
      }
    });
  }, [router]);

  const getGroupName = (groupId: number) => {
    const group = groups.find((g: any) => g.id === groupId);
    return group ? group.name : 'No Group';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading users and groups...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <img
                src="https://static.wixstatic.com/media/02157e_2734ffe4f4d44b319f9cc6c5f92628bf~mv2.png/v1/fill/w_506,h_128,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/Scale42%20Logo%200_1%20-%20White%20-%202kpx.png"
                alt="Scale42 Logo"
                className="h-8 w-auto bg-gray-900 px-2 py-1 rounded mr-4"
              />
              <nav className="flex space-x-8">
                <a href="/" className="text-gray-500 hover:text-blue-600 px-3 py-2 text-sm font-medium">
                  Projects
                </a>
                <a href="/users" className="text-blue-600 px-3 py-2 text-sm font-medium border-b-2 border-blue-600">
                  Users & Groups
                </a>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">Welcome, {session.user?.name}</span>
              <button
                onClick={() => router.push('/')}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">User & Group Management</h1>
          <p className="mt-2 text-gray-600">Manage system users and their group assignments</p>
        </div>

        {/* Users Table */}
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">System Users ({users.length})</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Group
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user: any) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{user.id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{user.email || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{user.name || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {getGroupName(user.group_id)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Groups Table */}
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">User Groups ({groups.length})</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Group Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email Domain
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Users Count
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {groups.map((group: any) => (
                  <tr key={group.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{group.id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{group.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {group.domain ? `@${group.domain}` : 'Any domain'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {users.filter((user: any) => user.group_id === group.id).length}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {group.created_at ? new Date(group.created_at).toLocaleDateString() : 'N/A'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}