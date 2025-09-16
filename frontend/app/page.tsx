
"use client";
import { getSession, signIn } from "next-auth/react";
import { useEffect, useState } from "react";

export default function HomePage() {
  const [session, setSession] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

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
        
        fetch("https://s42api.edbmotte.com/projects", {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          }
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

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!session) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center">
        <h1 className="text-3xl font-bold">Welcome to S42 Project</h1>
        <button
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
          onClick={() => signIn("google")}
        >
          Sign in with Google V3
        </button>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-3xl font-bold mb-4">Projects</h1>
      <table className="min-w-full border">
        <thead>
          <tr>
            <th className="border px-4 py-2">ID</th>
            <th className="border px-4 py-2">Name</th>
            <th className="border px-4 py-2">Description</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project: any) => (
            <tr key={project.id}>
              <td className="border px-4 py-2">{project.id}</td>
              <td className="border px-4 py-2">{project.name}</td>
              <td className="border px-4 py-2">{project.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
