'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Home, 
  LogOut, 
  Users, 
  Menu, 
  FolderOpen, 
  MapPin, 
  Map, 
  Building, 
  CreditCard, 
  Workflow, 
  Database, 
  HardDrive, 
  Settings, 
  LogIn,
  Zap
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

function DashboardLayout({ children, initialSidebarCollapsed = false }: { children: React.ReactNode, initialSidebarCollapsed?: boolean }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(!initialSidebarCollapsed);
  const { data: session } = useSession();
  const router = useRouter();

  async function handleSignOut() {
    await signOut({ redirect: false });
    router.push('/');
  }

  // Initialize n8n chat widget
  useEffect(() => {
    if (session) {
      // Add CSS for n8n chat
      const link = document.createElement('link');
      link.href = 'https://cdn.jsdelivr.net/npm/@n8n/chat/dist/style.css';
      link.rel = 'stylesheet';
      document.head.appendChild(link);

      // Add custom CSS for better styling
      const customStyle = document.createElement('style');
      customStyle.textContent = `
        :root {
          --chat--color-primary: #2563eb;
          --chat--color-primary-shade-50: #1d4ed8;
          --chat--color-primary-shade-100: #1e40af;
          --chat--color-secondary: #10b981;
          --chat--color-secondary-shade-50: #059669;
          --chat--color-white: #ffffff;
          --chat--color-light: #f8fafc;
          --chat--color-light-shade-50: #f1f5f9;
          --chat--color-light-shade-100: #e2e8f0;
          --chat--color-medium: #94a3b8;
          --chat--color-dark: #0f172a;
          --chat--color-disabled: #64748b;
          --chat--color-typing: #475569;

          --chat--spacing: 1rem;
          --chat--border-radius: 0.5rem;
          --chat--transition-duration: 0.2s;

          --chat--window--width: 400px;
          --chat--window--height: 600px;

          --chat--header--background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          --chat--header--color: #f8fafc;
          --chat--header--border-bottom: 1px solid #334155;
          
          --chat--toggle--background: #2563eb;
          --chat--toggle--hover--background: #1d4ed8;
          --chat--toggle--active--background: #1e40af;
          --chat--toggle--color: #ffffff;
          --chat--toggle--size: 60px;
          
          --chat--message--bot--background: #f1f5f9;
          --chat--message--bot--color: #0f172a;
          --chat--message--user--background: #2563eb;
          --chat--message--user--color: #ffffff;
        }
        
        /* Hide the subtitle */
        .n8n-chat .n8n-chat-subtitle {
          display: none !important;
        }
      `;
      document.head.appendChild(customStyle);

      // Add script for n8n chat
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        import { createChat } from 'https://cdn.jsdelivr.net/npm/@n8n/chat/dist/chat.bundle.es.js';
        
        createChat({
          webhookUrl: 'https://n8n.edbmotte.com/webhook/28a43e86-8af5-41f8-97e4-c2bba9e6393e/chat',
          mode: 'window',
          showWelcomeScreen: false,
          loadPreviousSession: true,
          chatSessionKey: 'sessionId',
          metadata: {
            sessionId: 'scale42-shared-chat-session'
          },
          initialMessages: [
            'Scale-42 Chat 👋',
            'My name is Mr Gribberstad. How can I assist you today?'
          ],
          i18n: {
            en: {
              title: 'Scale-42 Chat 👋',
              subtitle: '',
              footer: '',
              getStarted: 'New Conversation',
              inputPlaceholder: 'Type your question...',
            },
          },
        });
      `;
      document.head.appendChild(script);

      // Cleanup function
      return () => {
        const existingLink = document.querySelector('link[href="https://cdn.jsdelivr.net/npm/@n8n/chat/dist/style.css"]');
        if (existingLink) {
          document.head.removeChild(existingLink);
        }
        
        const existingScript = document.querySelector('script[type="module"]');
        if (existingScript && existingScript.textContent?.includes('createChat')) {
          document.head.removeChild(existingScript);
        }
        
        const existingStyle = document.querySelector('style');
        if (existingStyle && existingStyle.textContent?.includes('--chat--color-primary')) {
          document.head.removeChild(existingStyle);
        }
      };
    }
  }, [session]);

  const menuSections = [
    {
      title: 'Dashboard',
      items: [
        { href: '/', icon: Home, label: 'Home' },
      ]
    },
        {
      title: 'Projects',
      items: [
        { href: '/projects', icon: FolderOpen, label: 'Projects' },
        { href: '/map', icon: Map, label: 'Map' },
        { href: '/schema', icon: Database, label: 'Schema' },
      ]
    },
    {
      title: 'Hoyanger Power',
      items: [
        { href: '/hoyanger', icon: Zap, label: 'Overview' },
      ]
    },
    {
      title: 'Account Management',
      items: [
        { href: '/accounts', icon: CreditCard, label: 'Accounts' },
      ]
    },
    {
      title: 'Tools',
      items: [
        { href: 'https://n8n.edbmotte.com/projects/A35bALSD6kzKLUi6/workflows', icon: Workflow, label: 'n8n' },
        { href: 'https://nocodb.edbmotte.com/dashboard/#/nc/pjqgy4ri85jks06/mmqclkrvx9lbtpc', icon: Database, label: 'nocodb' },
        { href: 'https://drive.google.com/drive/recent', icon: HardDrive, label: 'drive' },
        { href: 'https://www.notion.so', icon: HardDrive, label: 'notion' },
      ]
    },
    {
      title: 'Settings',
      items: [
        { href: '/users', icon: Users, label: 'Users' },
        ...(session 
          ? [{ href: '#', icon: LogOut, label: 'Logout', action: 'signout' }]
          : [{ href: '/login', icon: LogIn, label: 'Login' }]
        ),
      ]
    }
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Full-height Sidebar */}
      <aside
        className={`${
          isSidebarOpen ? 'w-64' : 'w-16'
        } bg-card border-r border-border transition-all duration-300 ease-in-out flex flex-col`}
      >
        {/* Sidebar Header with Logo and Toggle */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-accent"
            >
              <Menu className="h-5 w-5" />
            </Button>
            {isSidebarOpen && (
              <img
                src="https://static.wixstatic.com/media/02157e_2734ffe4f4d44b319f9cc6c5f92628bf~mv2.png/v1/fill/w_506,h_128,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/Scale42%20Logo%200_1%20-%20White%20-%202kpx.png"
                alt="Scale42 Logo"
                className="h-12 w-auto px-2 py-1 ml-3"
              />
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          {menuSections.map((section) => (
            <div key={section.title} className="mb-6">
              {/* Section Heading */}
              {isSidebarOpen && (
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
                  {section.title}
                </h3>
              )}
              
              {/* Section Items */}
              {section.items.map((item) => {
                if (item.action === 'signout') {
                  return (
                    <Button
                      key="signout"
                      variant="ghost"
                      className={`w-full justify-start mb-2 text-destructive hover:text-destructive hover:bg-destructive/10 ${!isSidebarOpen ? 'px-2' : ''}`}
                      onClick={handleSignOut}
                      title={!isSidebarOpen ? item.label : undefined}
                    >
                      <item.icon className="h-5 w-5" />
                      {isSidebarOpen && <span className="ml-3">{item.label}</span>}
                    </Button>
                  );
                }
                
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={pathname === item.href ? 'secondary' : 'ghost'}
                      className={`w-full justify-start mb-2 ${
                        pathname === item.href ? 'bg-accent text-accent-foreground' : ''
                      } ${!isSidebarOpen ? 'px-2' : ''}`}
                      title={!isSidebarOpen ? item.label : undefined}
                    >
                      <item.icon className="h-5 w-5" />
                      {isSidebarOpen && <span className="ml-3">{item.label}</span>}
                    </Button>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}

export default DashboardLayout;