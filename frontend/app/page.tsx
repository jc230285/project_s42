
"use client";
import { useSession, signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import DashboardLayout from '@/components/DashboardLayout';
import toast from 'react-hot-toast';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  DollarSign, 
  Users, 
  Activity,
  CheckCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';

// Sample data for charts
const energyData = [
  { month: 'Jan', solar: 4000, wind: 2400, hydro: 2400 },
  { month: 'Feb', solar: 3000, wind: 1398, hydro: 2210 },
  { month: 'Mar', solar: 2000, wind: 9800, hydro: 2290 },
  { month: 'Apr', solar: 2780, wind: 3908, hydro: 2000 },
  { month: 'May', solar: 1890, wind: 4800, hydro: 2181 },
  { month: 'Jun', solar: 2390, wind: 3800, hydro: 2500 },
];

const pieData = [
  { name: 'Solar', value: 400, color: '#8884d8' },
  { name: 'Wind', value: 300, color: '#82ca9d' },
  { name: 'Hydro', value: 200, color: '#ffc658' },
  { name: 'Other', value: 100, color: '#ff7300' },
];

const performanceData = [
  { time: '00:00', efficiency: 65 },
  { time: '04:00', efficiency: 72 },
  { time: '08:00', efficiency: 89 },
  { time: '12:00', efficiency: 95 },
  { time: '16:00', efficiency: 88 },
  { time: '20:00', efficiency: 76 },
];

const timelineData = [
  { id: 1, title: 'Project Alpha Initiated', time: '2 hours ago', status: 'completed' },
  { id: 2, title: 'Site Survey Completed', time: '4 hours ago', status: 'completed' },
  { id: 3, title: 'Environmental Assessment', time: '1 day ago', status: 'in-progress' },
  { id: 4, title: 'Permit Application', time: '2 days ago', status: 'pending' },
  { id: 5, title: 'Community Meeting', time: '3 days ago', status: 'completed' },
];

const recentProjects = [
  { id: 'P001', name: 'Solar Farm Norway', status: 'Active', capacity: '150 MW', completion: 85 },
  { id: 'P002', name: 'Wind Project Beta', status: 'Planning', capacity: '200 MW', completion: 30 },
  { id: 'P003', name: 'Hydro Station Gamma', status: 'Active', capacity: '75 MW', completion: 92 },
  { id: 'P004', name: 'Solar Rooftop Delta', status: 'Completed', capacity: '50 MW', completion: 100 },
];

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();

  // Show toast if redirected from unauthorized page
  useEffect(() => {
    const from = searchParams.get('from');
    if (from === 'unauthorized') {
      toast('Redirected from unauthorized page', {
        icon: '🔒',
        duration: 3000,
      });
    }
  }, [searchParams]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show public dashboard for everyone (logged in or not)
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-2 text-muted-foreground">Welcome to Scale42 - Your renewable energy command center</p>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-card p-6 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Capacity</p>
                <p className="text-2xl font-bold text-foreground">2,450 MW</p>
                <p className="text-sm text-green-500 flex items-center mt-1">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  +12.5% from last month
                </p>
              </div>
              <Zap className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-card p-6 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Revenue</p>
                <p className="text-2xl font-bold text-foreground">$8.2M</p>
                <p className="text-sm text-green-500 flex items-center mt-1">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  +8.1% from last month
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="bg-card p-6 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Projects</p>
                <p className="text-2xl font-bold text-foreground">24</p>
                <p className="text-sm text-red-500 flex items-center mt-1">
                  <TrendingDown className="w-4 h-4 mr-1" />
                  -2 from last month
                </p>
              </div>
              <Activity className="h-8 w-8 text-orange-500" />
            </div>
          </div>

          <div className="bg-card p-6 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Team Members</p>
                <p className="text-2xl font-bold text-foreground">156</p>
                <p className="text-sm text-green-500 flex items-center mt-1">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  +5 new this month
                </p>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Energy Production Chart */}
          <div className="bg-card p-6 rounded-lg border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">Energy Production by Source</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={energyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="solar" fill="#8884d8" />
                <Bar dataKey="wind" fill="#82ca9d" />
                <Bar dataKey="hydro" fill="#ffc658" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Energy Mix Pie Chart */}
          <div className="bg-card p-6 rounded-lg border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">Energy Portfolio Mix</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}MW`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Performance and Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performance Chart */}
          <div className="bg-card p-6 rounded-lg border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">System Efficiency (24h)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="efficiency" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Activity Timeline */}
          <div className="bg-card p-6 rounded-lg border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h3>
            <div className="space-y-4">
              {timelineData.map((item) => (
                <div key={item.id} className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    {item.status === 'completed' && <CheckCircle className="w-5 h-5 text-green-500" />}
                    {item.status === 'in-progress' && <Clock className="w-5 h-5 text-blue-500" />}
                    {item.status === 'pending' && <AlertTriangle className="w-5 h-5 text-yellow-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Projects Table */}
        <div className="bg-card rounded-lg border border-border">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground">Recent Projects</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Project ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Capacity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Completion
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {recentProjects.map((project) => (
                  <tr key={project.id} className="hover:bg-accent">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                      {project.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {project.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        project.status === 'Active' ? 'bg-green-100 text-green-800' :
                        project.status === 'Planning' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {project.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {project.capacity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      <div className="flex items-center">
                        <div className="w-full bg-muted rounded-full h-2 mr-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${project.completion}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">{project.completion}%</span>
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
