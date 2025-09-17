"use client";
import { useSession, signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import DashboardLayout from '@/components/DashboardLayout';
import { useRouter } from "next/navigation";

export default function ProjectsPage() {
  const { data: session, status } = useSession();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (session) {
      // Create a simple auth token with user info
      const userInfo = {
        email: session.user?.email,
        name: session.user?.name,
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
    } else if (status !== "loading") {
      setLoading(false);
    }
  }, [session, status]);

  const renderProjectSites = (sitesString: string) => {
    if (!sitesString) return null;
    const sites = sitesString.split(',').map(site => site.trim());
    return (
      <div className="flex flex-wrap gap-1">
        {sites.map((site, index) => (
          <span
            key={index}
            className="inline-block bg-accent text-accent-foreground text-xs px-2 py-1 rounded-full border border-border"
          >
            {site}
          </span>
        ))}
      </div>
    );
  };

  useEffect(() => {
    if (status !== "loading" && !session) {
      router.push('/');
    }
  }, [session, status, router]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Projects</h1>
          <p className="mt-2 text-muted-foreground">Manage and monitor your renewable energy projects</p>
        </div>

        {/* Projects Table */}
        <div className="bg-card shadow-sm rounded-lg overflow-hidden border border-border">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-medium text-foreground">Active Projects</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Project ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Country
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Project Sites
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Power Availability (MW)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {projects.map((project: any) => (
                  <tr key={project.id} className="hover:bg-accent">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-foreground">{project.ProjectID}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-foreground">{project.Country__OLD_ || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-foreground">
                        {renderProjectSites(project.Project_Site_Names)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-foreground">
                        {project.Power_Availability__Min_} - {project.Power_Availability__Max_}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}