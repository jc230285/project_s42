"use client";
import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import DashboardLayout from '@/components/DashboardLayout';
import { hasUserGroup } from '@/lib/auth-utils';
import toast from 'react-hot-toast';
import { Calendar, Clock, MapPin, Users, ExternalLink, Loader2, Filter, Search, Video } from 'lucide-react';

interface AttendeeInfo {
  name?: string;
  email: string;
  status?: 'ACCEPTED' | 'DECLINED' | 'TENTATIVE' | 'NEEDS-ACTION' | 'DELEGATED';
}

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  attendees?: AttendeeInfo[];
  organizer?: string;
  status?: 'ACCEPTED' | 'DECLINED' | 'TENTATIVE' | 'NEEDS-ACTION' | 'DELEGATED';
  meetingLink?: string;
  meetingType?: 'zoom' | 'teams' | 'google-meet' | 'other';
  source: string; // Which calendar it came from
  isRecurring: boolean;
  url?: string;
  timezone?: string;
}

interface CalendarSource {
  name: string;
  url: string;
  color: string;
  owner: string;
}

const CALENDAR_SOURCES: CalendarSource[] = [
  {
    name: "James Scale-42",
    url: "https://calendar.google.com/calendar/ical/james%40scale-42.com/private-0716b6dcd538ae493a642aba972e8514/basic.ics",
    color: "bg-blue-500",
    owner: "james@scale-42.com"
  },
  {
    name: "Jamie Scale-42",
    url: "https://calendar.google.com/calendar/ical/jamie%40scale-42.com/private-175306a2e97ccf81088ffa67aa19ec2d/basic.ics",
    color: "bg-purple-500",
    owner: "jamie@scale-42.com"
  },
  {
    name: "William Scale-42",
    url: "https://calendar.google.com/calendar/ical/william%40scale-42.com/private-1e5690ca8c3bf7a174f5cf549fa2b76f/basic.ics",
    color: "bg-indigo-500",
    owner: "william@scale-42.com"
  },
  {
    name: "Abbie Scale-42",
    url: "https://calendar.google.com/calendar/ical/abbie%40scale-42.com/private-10f68867fa0c085d634f954854449ac3/basic.ics",
    color: "bg-pink-500",
    owner: "abbie@scale-42.com"
  },
  {
    name: "Bendik Scale-42",
    url: "https://calendar.google.com/calendar/ical/bendik%40scale-42.com/private-83f19c78cd699ab79afb1c0787d9ff65/basic.ics",
    color: "bg-cyan-500",
    owner: "bendik@scale-42.com"
  },
  {
    name: "Daniel Scale-42",
    url: "https://calendar.google.com/calendar/ical/daniel%40scale-42.com/private-cf119a351098bb6354534dd5114aa2be/basic.ics",
    color: "bg-teal-500",
    owner: "daniel@scale-42.com"
  },
  {
    name: "Tom Scale-42",
    url: "https://calendar.google.com/calendar/ical/tom%40scale-42.com/private-4f9d86f3ada2cc651ff570297fc3c44b/basic.ics",
    color: "bg-orange-500",
    owner: "tom@scale-42.com"
  },
  {
    name: "Zeehan Scale-42",
    url: "https://calendar.google.com/calendar/ical/zeehan%40scale-42.com/private-03f6279d291a0a3eb9af89f536d0902b/basic.ics",
    color: "bg-red-500",
    owner: "zeehan@scale-42.com"
  },
  {
    name: "James (BI)",
    url: "https://calendar.google.com/calendar/ical/3fa9nkehl91tonojd8hv1pbr6evgelsf%40import.calendar.google.com/public/basic.ics",
    color: "bg-sky-500",
    owner: "james-bi"
  },
  {
    name: "Jamie (BI)",
    url: "https://calendar.google.com/calendar/ical/4hqopv0p0fafb43r0ggj4ki7kh21oq3i%40import.calendar.google.com/public/basic.ics",
    color: "bg-violet-500",
    owner: "jamie-bi"
  },
  {
    name: "Patrik",
    url: "https://outlook.office365.com/owa/calendar/ae9f649a931f4fe386bd62c5653ef16c@cfocentre.com/bf3f90895b75434799142c537f77fdcc8242784080053590891/S-1-8-2523918155-1156594587-487720289-1248018643/reachcalendar.ics",
    color: "bg-amber-500",
    owner: "patrik@cfocentre.com"
  },
  {
    name: "Jane Elvis",
    url: "https://calendar.google.com/calendar/ical/janerloveselvis%40gmail.com/private-9a5ebd25666cc4948a8f28c605a87407/basic.ics",
    color: "bg-lime-500",
    owner: "janerloveselvis@gmail.com"
  },
  {
    name: "Hingleby",
    url: "https://calendar.google.com/calendar/ical/hingleby87%40gmail.com/private-c4e36a211d1d1b8ebd65cc7cba05559e/basic.ics",
    color: "bg-emerald-500",
    owner: "hingleby87@gmail.com"
  },
  {
    name: "Harden",
    url: "https://calendar.google.com/calendar/ical/hardenml8517%40gmail.com/private-27632a844c198ffc0d45dec416c347de/basic.ics",
    color: "bg-rose-500",
    owner: "hardenml8517@gmail.com"
  },
  {
    name: "Theta",
    url: "https://calendar.google.com/calendar/ical/thetaz73%40gmail.com/public/basic.ics",
    color: "bg-fuchsia-500",
    owner: "thetaz73@gmail.com"
  },
  {
    name: "Ismael Scale-42",
    url: "https://calendar.google.com/calendar/ical/ismael%40scale-42.com/private-3e4385c6ee5c64017160b03e4a7870b5/basic.ics",
    color: "bg-purple-500",
    owner: "ismael@scale-42.com"
  }
];

function CalendarPage() {
  const { data: session, status } = useSession();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSources, setSelectedSources] = useState<string[]>(
    CALENDAR_SOURCES.map(s => s.name)
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'week' | 'month' | 'year'>('month');
  const [statusFilter, setStatusFilter] = useState<string[]>(['ACCEPTED', 'TENTATIVE', 'NEEDS-ACTION']);

  // Check if user has Scale42 access
  const hasScale42Access = hasUserGroup(session, 'Scale42');

  const fetchCalendarEvents = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('📅 Fetching calendar events...');
      
      // Create a date range for the next year
      const now = new Date();
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(now.getFullYear() + 1);
      
      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sources: CALENDAR_SOURCES,
          startDate: now.toISOString(),
          endDate: oneYearFromNow.toISOString()
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || `Failed to fetch calendar events (${response.status})`);
      }

      const eventsData = await response.json();
      console.log('📅 Calendar events fetched:', eventsData.length);
      
      // Convert date strings back to Date objects
      const parsedEvents = eventsData.map((event: any) => ({
        ...event,
        start: new Date(event.start),
        end: new Date(event.end)
      }));
      
      // Sort events by start time
      parsedEvents.sort((a: CalendarEvent, b: CalendarEvent) => a.start.getTime() - b.start.getTime());
      
      setEvents(parsedEvents);
      toast.success(`Loaded ${parsedEvents.length} calendar events`);
      
    } catch (error) {
      console.error('❌ Error fetching calendar events:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load calendar events';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('🔍 Calendar Page - hasScale42Access:', hasScale42Access, 'status:', status);
    if (hasScale42Access && status === "authenticated") {
      console.log('✅ Fetching calendar events...');
      fetchCalendarEvents();
    } else if (status === "authenticated" && !hasScale42Access) {
      console.log('⛔ User does not have Scale42 access');
      setError('You do not have permission to view calendar events');
    }
  }, [hasScale42Access, status]);

  // Filter events based on selected sources, search term, date range, and status
  const filteredEvents = events.filter(event => {
    // Source filter
    if (!selectedSources.includes(event.source)) return false;
    
    // Search filter
    if (searchTerm && !event.title.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !event.description?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    // Status filter - if event has no status, show it with ACCEPTED filter
    if (statusFilter.length > 0) {
      const eventStatus = event.status || 'ACCEPTED';
      if (!statusFilter.includes(eventStatus)) return false;
    }
    
    // Date filter
    const now = new Date();
    const eventStart = event.start;
    
    switch (dateFilter) {
      case 'week':
        const oneWeekFromNow = new Date();
        oneWeekFromNow.setDate(now.getDate() + 7);
        return eventStart >= now && eventStart <= oneWeekFromNow;
      case 'month':
        const oneMonthFromNow = new Date();
        oneMonthFromNow.setMonth(now.getMonth() + 1);
        return eventStart >= now && eventStart <= oneMonthFromNow;
      case 'year':
        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(now.getFullYear() + 1);
        return eventStart >= now && eventStart <= oneYearFromNow;
      default:
        return true;
    }
  });

  // Get status color and styling
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'ACCEPTED':
        return {
          bg: 'bg-green-500/10',
          border: 'border-green-500/30',
          text: 'text-green-700 dark:text-green-400',
          icon: '✓',
          label: 'Accepted'
        };
      case 'DECLINED':
        return {
          bg: 'bg-red-500/10',
          border: 'border-red-500/30',
          text: 'text-red-700 dark:text-red-400',
          icon: '✗',
          label: 'Declined'
        };
      case 'TENTATIVE':
        return {
          bg: 'bg-yellow-500/10',
          border: 'border-yellow-500/30',
          text: 'text-yellow-700 dark:text-yellow-400',
          icon: '?',
          label: 'Tentative'
        };
      case 'NEEDS-ACTION':
        return {
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/30',
          text: 'text-blue-700 dark:text-blue-400',
          icon: '!',
          label: 'Needs Action'
        };
      case 'DELEGATED':
        return {
          bg: 'bg-purple-500/10',
          border: 'border-purple-500/30',
          text: 'text-purple-700 dark:text-purple-400',
          icon: '→',
          label: 'Delegated'
        };
      default:
        return {
          bg: 'bg-muted/30',
          border: 'border-border',
          text: 'text-muted-foreground',
          icon: '',
          label: ''
        };
    }
  };

  // Get attendee initials from name or email
  const getInitials = (attendee: AttendeeInfo): string => {
    if (attendee.name) {
      const parts = attendee.name.split(' ').filter(p => p.length > 0);
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return parts[0].substring(0, 2).toUpperCase();
    }
    // Use email if no name
    const emailPart = attendee.email.split('@')[0];
    return emailPart.substring(0, 2).toUpperCase();
  };

  // Get display name for attendee
  const getAttendeeName = (attendee: AttendeeInfo): string => {
    if (attendee.name) {
      return `${attendee.name} <${attendee.email}>`;
    }
    return attendee.email;
  };

  // Get meeting type icon and label
  const getMeetingInfo = (meetingType?: string) => {
    switch (meetingType) {
      case 'zoom':
        return { icon: '📹', label: 'Join Zoom', color: 'text-blue-600' };
      case 'teams':
        return { icon: '💼', label: 'Join Teams', color: 'text-purple-600' };
      case 'google-meet':
        return { icon: '📞', label: 'Join Google Meet', color: 'text-green-600' };
      default:
        return { icon: '🔗', label: 'Join Meeting', color: 'text-primary' };
    }
  };

  // Format date and time for display
  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }).format(date);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }).format(date);
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      timeStyle: 'short',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }).format(date);
  };

  // Check if event is today
  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Check if event is this week
  const isThisWeek = (date: Date) => {
    const today = new Date();
    const weekFromToday = new Date();
    weekFromToday.setDate(today.getDate() + 7);
    return date >= today && date <= weekFromToday;
  };

  // Get calendar source info
  const getSourceInfo = (sourceName: string) => {
    return CALENDAR_SOURCES.find(s => s.name === sourceName);
  };

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Calendar className="w-8 h-8" />
              Calendar Events
            </h1>
            <p className="text-muted-foreground mt-1">
              Unified view of calendar events from multiple sources
            </p>
          </div>
          <button
            onClick={fetchCalendarEvents}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Calendar className="w-4 h-4" />
            )}
            Refresh Events
          </button>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Search Events
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search title or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Time Range
              </label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as 'week' | 'month' | 'year')}
                className="w-full px-3 py-2 border border-border rounded bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="week">Next Week</option>
                <option value="month">Next Month</option>
                <option value="year">Next Year</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Event Status
              </label>
              <div className="space-y-2">
                {[
                  { value: 'ACCEPTED', label: 'Accepted', icon: '✓' },
                  { value: 'TENTATIVE', label: 'Tentative', icon: '?' },
                  { value: 'NEEDS-ACTION', label: 'Needs Action', icon: '!' },
                  { value: 'DECLINED', label: 'Declined', icon: '✗' },
                ].map((status) => {
                  const statusInfo = getStatusColor(status.value);
                  return (
                    <label key={status.value} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={statusFilter.includes(status.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setStatusFilter([...statusFilter, status.value]);
                          } else {
                            setStatusFilter(statusFilter.filter(s => s !== status.value));
                          }
                        }}
                        className="rounded border-border"
                      />
                      <span className={`text-sm ${statusInfo.text}`}>
                        {status.icon} {status.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Calendar Sources */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Calendar Sources
              </label>
              <div className="space-y-2">
                {CALENDAR_SOURCES.map((source) => (
                  <label key={source.name} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedSources.includes(source.name)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSources([...selectedSources, source.name]);
                        } else {
                          setSelectedSources(selectedSources.filter(s => s !== source.name));
                        }
                      }}
                      className="rounded border-border"
                    />
                    <div className={`w-3 h-3 rounded-full ${source.color}`}></div>
                    <span className="text-sm text-foreground">{source.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Events List */}
        <div className="bg-card rounded-lg border border-border">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading calendar events...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-red-500 mb-4">Error: {error}</p>
              <button
                onClick={fetchCalendarEvents}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="p-8 text-center">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No events found matching your criteria</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {/* Results Summary */}
              <div className="px-6 py-4 bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  Showing {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} 
                  {searchTerm && ` matching "${searchTerm}"`}
                </p>
              </div>

              {/* Events */}
              <div className="max-h-[600px] overflow-y-auto">
                {filteredEvents.map((event) => {
                  const sourceInfo = getSourceInfo(event.source);
                  const statusInfo = getStatusColor(event.status);
                  return (
                    <div 
                      key={event.id} 
                      className={`p-6 hover:bg-muted/50 transition-colors border-l-4 ${statusInfo.border} ${statusInfo.bg}`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Date/Time */}
                        <div className="flex-shrink-0 text-center min-w-[80px]">
                          <div className={`text-sm font-medium ${isToday(event.start) ? 'text-primary' : 'text-foreground'}`}>
                            {formatDate(event.start)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatTime(event.start)}
                            {event.start.getTime() !== event.end.getTime() && (
                              <span> - {formatTime(event.end)}</span>
                            )}
                          </div>
                          {isToday(event.start) && (
                            <div className="text-xs font-medium text-primary mt-1">TODAY</div>
                          )}
                          {isThisWeek(event.start) && !isToday(event.start) && (
                            <div className="text-xs font-medium text-orange-600 mt-1">THIS WEEK</div>
                          )}
                        </div>

                        {/* Event Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-foreground truncate">
                                  {event.title}
                                </h3>
                                {/* Status Badge */}
                                {event.status && statusInfo.label && (
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusInfo.text} ${statusInfo.bg} border ${statusInfo.border}`}>
                                    <span>{statusInfo.icon}</span>
                                    <span>{statusInfo.label}</span>
                                  </span>
                                )}
                              </div>
                              {event.description && (
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {event.description}
                                </p>
                              )}
                            </div>
                            
                            {/* Source Badge */}
                            {sourceInfo && (
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <div className={`w-3 h-3 rounded-full ${sourceInfo.color}`}></div>
                                <span className="text-xs text-muted-foreground">{sourceInfo.name}</span>
                              </div>
                            )}
                          </div>

                          {/* Event Metadata */}
                          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs">
                            {/* Organizer */}
                            {event.organizer && (
                              <div className="flex items-center gap-1 text-primary">
                                <Users className="w-3 h-3" />
                                <span className="font-medium">Organizer:</span>
                                <span className="text-foreground">{event.organizer}</span>
                              </div>
                            )}
                            
                            {event.location && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <MapPin className="w-3 h-3" />
                                <span className="truncate max-w-[200px]">{event.location}</span>
                              </div>
                            )}
                            
                            {/* Attendees */}
                            {event.attendees && event.attendees.length > 0 && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Users className="w-3 h-3" />
                                <span>
                                  {event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}:
                                </span>
                              </div>
                            )}
                            
                            {/* Show source as a badge if it's a merged event (contains comma) */}
                            {event.source.includes(',') && (
                              <div className="flex items-center gap-1 bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded">
                                <span className="font-medium">Merged from multiple calendars</span>
                              </div>
                            )}
                            
                            {event.isRecurring && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                <span>Recurring</span>
                              </div>
                            )}
                            
                            {event.url && (
                              <a
                                href={event.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-primary hover:text-primary/80"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Open</span>
                              </a>
                            )}
                          </div>
                          
                          {/* Attendees List */}
                          {event.attendees && event.attendees.length > 0 && (
                            <div className="mt-3 p-3 bg-muted/30 rounded-md">
                              <div className="text-xs font-medium text-foreground mb-2">
                                Attendees ({event.attendees.length}):
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {event.attendees.map((attendee, idx) => (
                                  <div 
                                    key={idx} 
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-background border border-border rounded text-xs text-foreground"
                                  >
                                    <Users className="w-3 h-3 text-muted-foreground" />
                                    <span>{attendee}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default CalendarPage;