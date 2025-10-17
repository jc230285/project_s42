import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

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
  source: string;
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

// Cache for calendar ICS files
interface CacheEntry {
  content: string;
  fetchedAt: number;
}

const calendarCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.fetchedAt < CACHE_DURATION;
}

// ICS parsing helper functions
function parseICSDate(dateStr: string): Date {
  // Handle different ICS date formats
  if (dateStr.includes('T')) {
    // YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
    const cleanDate = dateStr.replace(/[TZ]/g, '');
    const year = parseInt(cleanDate.substr(0, 4));
    const month = parseInt(cleanDate.substr(4, 2)) - 1; // Month is 0-indexed
    const day = parseInt(cleanDate.substr(6, 2));
    const hour = parseInt(cleanDate.substr(8, 2)) || 0;
    const minute = parseInt(cleanDate.substr(10, 2)) || 0;
    const second = parseInt(cleanDate.substr(12, 2)) || 0;
    
    return new Date(year, month, day, hour, minute, second);
  } else {
    // YYYYMMDD (all-day event)
    const year = parseInt(dateStr.substr(0, 4));
    const month = parseInt(dateStr.substr(4, 2)) - 1;
    const day = parseInt(dateStr.substr(6, 2));
    
    return new Date(year, month, day);
  }
}

function parseICSContent(icsContent: string, sourceName: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  
  // First, unfold lines (handle line continuations in ICS format)
  // Lines that start with space or tab are continuations of the previous line
  const rawLines = icsContent.split(/\r?\n/);
  const unfoldedLines: string[] = [];
  let currentLine = '';
  
  for (const line of rawLines) {
    if (line.startsWith(' ') || line.startsWith('\t')) {
      // Continuation line - append to current line (removing the leading space/tab)
      currentLine += line.substring(1);
    } else {
      // New line - save previous if exists
      if (currentLine) {
        unfoldedLines.push(currentLine.trim());
      }
      currentLine = line;
    }
  }
  // Don't forget the last line
  if (currentLine) {
    unfoldedLines.push(currentLine.trim());
  }
  
  console.log(`📄 Processing ${unfoldedLines.length} unfolded lines for ${sourceName}`);
  
  let currentEvent: Partial<CalendarEvent> | null = null;
  let inEvent = false;
  
  for (let i = 0; i < unfoldedLines.length; i++) {
    const line = unfoldedLines[i];
    
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {
        source: sourceName,
        isRecurring: false,
        attendees: []
      };
      continue;
    }
    
    if (line === 'END:VEVENT' && currentEvent && inEvent) {
      if (currentEvent.title && currentEvent.start && currentEvent.end) {
        if (currentEvent.attendees && currentEvent.attendees.length > 0) {
          console.log(`📅 Event with attendees: "${currentEvent.title}" - ${currentEvent.attendees.length} attendees`);
        }
        events.push(currentEvent as CalendarEvent);
      }
      currentEvent = null;
      inEvent = false;
      continue;
    }
    
    if (!inEvent || !currentEvent) continue;
    
    // Parse event properties
    if (line.startsWith('UID:')) {
      currentEvent.id = line.substring(4);
    } else if (line.startsWith('SUMMARY:')) {
      currentEvent.title = line.substring(8);
    } else if (line.startsWith('DTSTART')) {
      const dateValue = line.split(':')[1];
      if (dateValue) {
        currentEvent.start = parseICSDate(dateValue);
      }
    } else if (line.startsWith('DTEND')) {
      const dateValue = line.split(':')[1];
      if (dateValue) {
        currentEvent.end = parseICSDate(dateValue);
      }
    } else if (line.startsWith('URL:')) {
      currentEvent.url = line.substring(4);
    } else if (line.startsWith('ORGANIZER')) {
      // Extract organizer email and name
      const emailMatch = line.match(/mailto:([^;]+)/);
      const nameMatch = line.match(/CN=([^;:]+)/);
      
      if (emailMatch) {
        currentEvent.organizer = emailMatch[1];
      }
      if (nameMatch && emailMatch) {
        // If we have a name, use "Name <email>" format
        currentEvent.organizer = `${nameMatch[1]} <${emailMatch[1]}>`;
      }
    } else if (line.startsWith('ATTENDEE')) {
      // Extract attendee email, name, and participation status
      const emailMatch = line.match(/mailto:([^;]+)/);
      const nameMatch = line.match(/CN=([^;:]+)/);
      const partstatMatch = line.match(/PARTSTAT=([A-Z-]+)/);
      
      // Check if this attendee's email matches the calendar owner
      // to determine the user's personal status for this event
      if (partstatMatch && !currentEvent.status) {
        const status = partstatMatch[1] as CalendarEvent['status'];
        currentEvent.status = status;
      }
      
      if (emailMatch && currentEvent.attendees) {
        const attendeeInfo: AttendeeInfo = {
          email: emailMatch[1],
          name: nameMatch?.[1],
          status: partstatMatch?.[1] as AttendeeInfo['status']
        };
        currentEvent.attendees.push(attendeeInfo);
      }
    } else if (line.startsWith('DESCRIPTION:')) {
      const description = line.substring(12).replace(/\\n/g, '\n').replace(/\\,/g, ',');
      currentEvent.description = description;
      
      // Extract meeting links from description
      const zoomMatch = description.match(/(https?:\/\/[^\s]*zoom\.us\/[^\s<)"']+)/i);
      const teamsMatch = description.match(/(https?:\/\/teams\.microsoft\.com\/[^\s<)"']+)/i);
      const meetMatch = description.match(/(https?:\/\/meet\.google\.com\/[^\s<)"']+)/i);
      
      if (zoomMatch) {
        currentEvent.meetingLink = zoomMatch[1];
        currentEvent.meetingType = 'zoom';
      } else if (teamsMatch) {
        currentEvent.meetingLink = teamsMatch[1];
        currentEvent.meetingType = 'teams';
      } else if (meetMatch) {
        currentEvent.meetingLink = meetMatch[1];
        currentEvent.meetingType = 'google-meet';
      }
    } else if (line.startsWith('LOCATION:')) {
      const location = line.substring(9);
      currentEvent.location = location;
      
      // Also check location field for meeting links if not found in description
      if (!currentEvent.meetingLink) {
        const zoomMatch = location.match(/(https?:\/\/[^\s]*zoom\.us\/[^\s<)"']+)/i);
        const teamsMatch = location.match(/(https?:\/\/teams\.microsoft\.com\/[^\s<)"']+)/i);
        const meetMatch = location.match(/(https?:\/\/meet\.google\.com\/[^\s<)"']+)/i);
        
        if (zoomMatch) {
          currentEvent.meetingLink = zoomMatch[1];
          currentEvent.meetingType = 'zoom';
        } else if (teamsMatch) {
          currentEvent.meetingLink = teamsMatch[1];
          currentEvent.meetingType = 'teams';
        } else if (meetMatch) {
          currentEvent.meetingLink = meetMatch[1];
          currentEvent.meetingType = 'google-meet';
        }
      }
    } else if (line.startsWith('STATUS:')) {
      // Event-level status (CONFIRMED, TENTATIVE, CANCELLED)
      const eventStatus = line.substring(7).trim();
      if (eventStatus === 'CANCELLED') {
        currentEvent.status = 'DECLINED';
      } else if (eventStatus === 'TENTATIVE') {
        currentEvent.status = 'TENTATIVE';
      }
    } else if (line.startsWith('RRULE:')) {
      currentEvent.isRecurring = true;
      // TODO: Implement full recurring event expansion
      // For now, just mark as recurring
    }
  }
  
  return events;
}

async function fetchCalendarEvents(sources: CalendarSource[], startDate: string, endDate: string): Promise<CalendarEvent[]> {
  const allEvents: CalendarEvent[] = [];
  
  for (const source of sources) {
    try {
      console.log(`📅 Fetching calendar: ${source.name} from ${source.url}`);
      
      let icsContent: string;
      
      // Check cache first
      const cachedEntry = calendarCache.get(source.url);
      if (cachedEntry && isCacheValid(cachedEntry)) {
        console.log(`✅ Using cached data for ${source.name}`);
        icsContent = cachedEntry.content;
      } else {
        // Fetch ICS data with a timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const response = await fetch(source.url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Calendar-Aggregator/1.0)',
            'Accept': 'text/calendar, text/plain, */*',
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.error(`❌ Failed to fetch ${source.name}: ${response.status} ${response.statusText}`);
          continue;
        }
        
        icsContent = await response.text();
        console.log(`📅 Fetched ${icsContent.length} characters from ${source.name}`);
        
        // Store in cache
        calendarCache.set(source.url, {
          content: icsContent,
          fetchedAt: Date.now()
        });
        console.log(`💾 Cached data for ${source.name}`);
      }
      
      // Parse ICS content
      const events = parseICSContent(icsContent, source.name);
      console.log(`📅 Parsed ${events.length} events from ${source.name}`);
      
      // Filter events within date range
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      const filteredEvents = events.filter(event => {
        return event.start >= start && event.start <= end;
      });
      
      console.log(`📅 ${filteredEvents.length} events from ${source.name} are within date range`);
      allEvents.push(...filteredEvents);
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`⏰ Timeout fetching calendar: ${source.name}`);
      } else {
        console.error(`❌ Error fetching calendar ${source.name}:`, error);
      }
    }
  }
  
  // Sort all events by start time
  allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
  
  // Merge duplicate events (same start time and title)
  const mergedEvents = mergeDuplicateEvents(allEvents);
  
  console.log(`📅 Total events fetched: ${allEvents.length}, merged to: ${mergedEvents.length}`);
  return mergedEvents;
}

function mergeDuplicateEvents(events: CalendarEvent[]): CalendarEvent[] {
  const eventMap = new Map<string, CalendarEvent>();
  
  for (const event of events) {
    // Create a unique key based on start time and title
    const key = `${event.start.toISOString()}_${event.title.toLowerCase().trim()}`;
    
    if (eventMap.has(key)) {
      // Event already exists, merge attendees and sources
      const existingEvent = eventMap.get(key)!;
      
      // Merge attendees (remove duplicates by email)
      const attendeeMap = new Map<string, AttendeeInfo>();
      
      // Add existing attendees
      (existingEvent.attendees || []).forEach(att => {
        attendeeMap.set(att.email, att);
      });
      
      // Add new attendees (will overwrite if email exists, keeping newer status)
      (event.attendees || []).forEach(att => {
        attendeeMap.set(att.email, att);
      });
      
      existingEvent.attendees = Array.from(attendeeMap.values());
      
      // Keep organizer from first event, or use new one if existing doesn't have it
      if (!existingEvent.organizer && event.organizer) {
        existingEvent.organizer = event.organizer;
      }
      
      // Keep meeting link from first event with one
      if (!existingEvent.meetingLink && event.meetingLink) {
        existingEvent.meetingLink = event.meetingLink;
        existingEvent.meetingType = event.meetingType;
      }
      
      // Combine sources
      if (!existingEvent.source.includes(event.source)) {
        existingEvent.source = `${existingEvent.source}, ${event.source}`;
      }
      
      // Merge descriptions if different
      if (event.description && event.description !== existingEvent.description) {
        existingEvent.description = existingEvent.description 
          ? `${existingEvent.description}\n\n---\n${event.description}`
          : event.description;
      }
      
      // Keep location if existing doesn't have one
      if (!existingEvent.location && event.location) {
        existingEvent.location = event.location;
      }
      
      console.log(`🔗 Merged duplicate event: "${event.title}" at ${event.start.toISOString()}`);
    } else {
      // New event, add to map
      eventMap.set(key, { ...event });
    }
  }
  
  return Array.from(eventMap.values());
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const { sources, startDate, endDate } = await request.json();
    
    if (!sources || !Array.isArray(sources)) {
      return NextResponse.json(
        { message: 'Invalid sources provided' },
        { status: 400 }
      );
    }
    
    if (!startDate || !endDate) {
      return NextResponse.json(
        { message: 'Start date and end date are required' },
        { status: 400 }
      );
    }
    
    console.log(`📅 Fetching calendar events from ${sources.length} sources`);
    console.log(`📅 Date range: ${startDate} to ${endDate}`);
    
    // Fetch events from all sources
    const events = await fetchCalendarEvents(sources, startDate, endDate);
    
    return NextResponse.json(events);
    
  } catch (error) {
    console.error('❌ Error in calendar events API:', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}