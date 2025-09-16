
"use client";
import { getSession, signIn, signOut } from "next-auth/react";
import { useEffect, useState } from "react";

export default function HomePage() {
  const [session, setSession] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdminDropdown, setShowAdminDropdown] = useState(false);

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
        
        // First, create/update user in the database
        fetch("https://s42api.edbmotte.com/users/create-or-update", {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          }
        })
        .then(() => {
          // Then fetch projects data
          return fetch("https://s42api.edbmotte.com/projects", {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            }
          });
        })
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          return res.json();
        })
        .then((data) => {
          setProjects(data);
          setLoading(false);
        })
        .catch((error) => {
          console.error("Error fetching projects:", error);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });
  }, []);

  const renderProjectSites = (sitesString: string) => {
    if (!sitesString) return null;
    const sites = sitesString.split(',').map(site => site.trim());
    return (
      <div className="flex flex-wrap gap-1">
        {sites.map((site, index) => (
          <span
            key={index}
            className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full border"
          >
            {site}
          </span>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <img
                  src="https://static.wixstatic.com/media/02157e_2734ffe4f4d44b319f9cc6c5f92628bf~mv2.png/v1/fill/w_506,h_128,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/Scale42%20Logo%200_1%20-%20White%20-%202kpx.png"
                  alt="Scale42 Logo"
                  className="h-8 w-auto bg-gray-900 px-2 py-1 rounded"
                />
              </div>
              <button
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                onClick={() => signIn("google")}
              >
                Sign In
              </button>
            </div>
          </div>
        </header>
        
        <main className="flex min-h-screen flex-col items-center justify-center px-4">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome to Scale42 Project Manager</h1>
            <p className="text-xl text-gray-600 mb-8">Manage your renewable energy projects with ease</p>
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg text-lg font-medium transition-colors shadow-lg"
              onClick={() => signIn("google")}
            >
              Sign in with Google
            </button>
          </div>
        </main>
      </div>
    );
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
                <a href="#" className="text-gray-900 hover:text-blue-600 px-3 py-2 text-sm font-medium">
                  Projects
                </a>
              </nav>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">Welcome, {session.user?.name}</span>
              
              {/* Admin Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowAdminDropdown(!showAdminDropdown)}
                  className="text-gray-400 hover:text-gray-600 p-2 rounded-md"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                
                {showAdminDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                    <a href="/users" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                      Users List
                    </a>
                    <a href="/groups" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                      Groups List
                    </a>
                  </div>
                )}
              </div>
              
              <button
                onClick={() => signOut()}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Project Dashboard</h1>
          <p className="mt-2 text-gray-600">Manage and monitor your renewable energy projects</p>
        </div>

        {/* Projects Table */}
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Active Projects</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Country
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project Sites
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Power Availability (MW)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {projects.map((project: any) => (
                  <tr key={project.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{project.ProjectID}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{project.Country__OLD_ || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {renderProjectSites(project.Project_Site_Names)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {project.Power_Availability__Min_} - {project.Power_Availability__Max_}
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
