'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { WithScale42Access } from '@/components/WithScale42Access';
import DashboardLayout from '@/components/DashboardLayout';
import toast from 'react-hot-toast';
import { Loader } from '@googlemaps/js-api-loader';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

interface PlotDetailPageProps {
  params: { id: string };
}

interface Field {
  "Field ID": string;
  "Field Name": string;
  Type: string;
  Category: string;
  Subcategory: string;
  Table: string;
  Options?: string;
  Description?: string;
}

interface Plot {
  _db_id: number;
  Id: string;
  "Plot Name": string;
  [key: string]: any;
}

interface Project {
  _db_id: number;
  Id: string;
  "Project Name": string;
  [key: string]: any;
}

interface ImageAttachment {
  path: string;
  title: string;
  mimetype: string;
  size: number;
  width: number;
  height: number;
  id: string;
  thumbnails?: {
    tiny?: { signedPath: string };
    small?: { signedPath: string };
    card_cover?: { signedPath: string };
  };
  signedPath: string;
}

interface Section {
  id: string;
  name: string;
  type: 'map' | 'combined' | 'project' | 'plot' | 'hero-image' | 'image-gallery';
  visible: boolean;
  expanded?: boolean;
  category?: string;
  fields?: Field[];
  fieldVisibility?: Record<string, boolean>;
  fieldOrder?: string[];
  fieldWidth?: Record<string, 'full' | 'half'>;
  images?: ImageAttachment[];
}

interface PlotPreferences {
  sections: Section[];
  sidebarOpen: boolean;
}

// Cookie helper functions
const setCookie = (name: string, value: string, days: number = 365) => {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
};

const getCookie = (name: string): string | null => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
};

function PlotDetailPageContent({ params }: PlotDetailPageProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [plot, setPlot] = useState<Plot | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [plotFields, setPlotFields] = useState<Field[]>([]);
  const [projectFields, setProjectFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInitialized = useRef(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sectionsInitialized, setSectionsInitialized] = useState(false);

  useEffect(() => {
    console.log('🔍 Session status:', session ? 'Authenticated' : 'Not authenticated');
    if (session) {
      fetchPlotData();
    } else if (session === null) {
      // Session loaded but user is not authenticated
      setLoading(false);
    }
  }, [session, params.id]);

  const fetchPlotData = async () => {
    if (!session?.user?.email) {
      console.error('❌ No session email found');
      setLoading(false);
      return;
    }

    try {
      console.log('📡 Fetching plot data for ID:', params.id);
      const userInfo = {
        email: session.user.email,
        name: session.user.name || session.user.email,
        image: session.user.image || ""
      };
      const authHeader = `Bearer ${btoa(JSON.stringify(userInfo))}`;

      // Fetch plot data using the same endpoint as the projects page
      const plotResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/projects/plots?plot_ids=${params.id}&preserve_order=true`,
        {
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!plotResponse.ok) {
        throw new Error('Failed to fetch plot data');
      }

      const data = await plotResponse.json();
      
      console.log('📦 Plot API Response:', data);
      
      // Extract plot and project from the response structure
      let plotData = null;
      if (data.data?.projects?.length > 0) {
        const projectData = data.data.projects[0];
        
        console.log('📁 Project Data:', projectData);
        
        if (projectData.plots?.length > 0) {
          plotData = projectData.plots[0];
          console.log('🗺️ Plot Data:', plotData);
          
          // Flatten the structure - merge basic_data values into the plot object
          const transformedPlot = {
            _db_id: plotData._db_id || plotData.id,
            Id: `S${String(plotData._db_id || plotData.id).padStart(3, '0')}`,
            ...plotData.values  // Use values from the API response
          };
          console.log('✅ Transformed Plot:', transformedPlot);
          setPlot(transformedPlot);
        } else {
          console.warn('⚠️ No plots found in project data');
        }
        
        // Set project data if available
        if (projectData._db_id) {
          const transformedProject = {
            _db_id: projectData._db_id,
            Id: `P${String(projectData._db_id).padStart(3, '0')}`,
            "Project Name": projectData.values?.["c5udjaiacvutwek"] || projectData.values?.["Project Name"],
            ...projectData.values
          };
          console.log('✅ Transformed Project:', transformedProject);
          setProject(transformedProject);
        }
      } else {
        console.warn('⚠️ No projects found in API response');
      }

      // Extract schema from response
      if (data.schema) {
        const plotCols = data.schema
          .filter((field: any) => field.Table === "Land Plots, Sites")
          .map((field: any) => ({
            "Field ID": field["Field ID"],
            "Field Name": field["Field Name"],
            Type: field.Type,
            Category: field.Category || "Uncategorized",
            Subcategory: field.Subcategory || "",
            Table: "Land Plots",
            Options: field.Options,
            Description: field.Description || ""
          }));
        setPlotFields(plotCols);

        const projectCols = data.schema
          .filter((field: any) => field.Table === "Projects")
          .map((field: any) => ({
            "Field ID": field["Field ID"],
            "Field Name": field["Field Name"],
            Type: field.Type,
            Category: field.Category || "Uncategorized",
            Subcategory: field.Subcategory || "",
            Table: "Projects",
            Options: field.Options,
            Description: field.Description || ""
          }));
        setProjectFields(projectCols);
        
        // Extract coordinates from plot data
        if (plotData) {
          console.log('🗺️ Looking for coordinates field in plot data');
          const coordsField = plotCols.find((f: Field) => f["Field Name"] === "Coordinates");
          console.log('📍 Coordinates field found:', coordsField);
          if (coordsField && plotData.values[coordsField["Field ID"]]) {
            const coordsValue = plotData.values[coordsField["Field ID"]];
            console.log('📍 Coordinates value:', coordsValue);
            const [lat, lon] = coordsValue.split(/[;,]/).map((s: string) => parseFloat(s.trim()));
            console.log('📍 Parsed lat/lon:', lat, lon);
            if (!isNaN(lat) && !isNaN(lon)) {
              console.log('✅ Setting coordinates:', { lat, lng: lon });
              setCoordinates({ lat, lng: lon });
            } else {
              console.warn('⚠️ Invalid coordinates - NaN values');
            }
          } else {
            console.warn('⚠️ No coordinates field or value found');
          }
        }
      }
    } catch (error) {
      console.error('Error fetching plot data:', error);
      toast.error('Failed to load plot data');
    } finally {
      setLoading(false);
    }
  };

  // Build sections when fields are loaded
  useEffect(() => {
    if ((plotFields.length > 0 || projectFields.length > 0) && !sectionsInitialized) {
      buildSections(plotFields, projectFields);
      setSectionsInitialized(true);
    }
  }, [plotFields, projectFields, coordinates, plot, sectionsInitialized]);

  // Save preferences to cookies whenever sections or sidebar state changes
  useEffect(() => {
    if (sections.length > 0 && plot && sectionsInitialized) {
      const preferences: PlotPreferences = {
        sections,
        sidebarOpen
      };
      const cookieName = `plot-preferences-${plot.Id}`;
      setCookie(cookieName, JSON.stringify(preferences), 365);
      console.log('💾 Saved preferences to cookie:', cookieName, preferences);
    }
  }, [sections, sidebarOpen, plot, sectionsInitialized]);

  // Load Google Map - Wait for both coordinates AND mapRef to be ready
  useEffect(() => {
    // Early returns for missing requirements
    if (!coordinates) {
      console.log('🗺️ No coordinates yet');
      return;
    }

    if (mapInitialized.current) {
      console.log('🗺️ Map already initialized, skipping');
      return;
    }

    if (!mapRef.current) {
      console.log('🗺️ Map ref not ready yet, will retry when sections update');
      return;
    }

    console.log('🗺️ All conditions met - Initializing Google Maps with coordinates:', coordinates);
    
    const loader = new Loader({
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
      version: 'weekly',
    });

    let map: google.maps.Map | null = null;

    loader.load().then(() => {
      if (!mapRef.current) {
        console.warn('⚠️ mapRef lost during load');
        return;
      }

      console.log('✅ Google Maps loaded, creating map instance');
      
      map = new google.maps.Map(mapRef.current, {
        center: coordinates,
        zoom: 13,
        mapTypeId: 'roadmap',
        disableDefaultUI: true,
        zoomControl: false,
        mapTypeControl: false,
        scaleControl: false,
        streetViewControl: false,
        rotateControl: false,
        fullscreenControl: false,
      });

      new google.maps.Marker({
        position: coordinates,
        map: map,
        title: plot?.["Plot Name"] || 'Plot Location',
      });

      mapInitialized.current = true;
      console.log('✅ Map marker added and initialization complete');
    }).catch((error) => {
      console.error('❌ Error loading Google Maps:', error);
    });

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up map instance');
      mapInitialized.current = false;
      if (map) {
        map = null;
      }
    };
  }, [coordinates, sections.length]); // Depend on sections.length to trigger when sections are created

  const buildSections = (plotCols: Field[], projectCols: Field[]) => {
    // Try to load saved preferences from cookies
    const savedPrefs = plot ? getCookie(`plot-preferences-${plot.Id}`) : null;
    let savedSections: Section[] | null = null;
    
    console.log('🔧 Building sections for plot:', plot?.Id);
    console.log('📂 Saved preferences cookie:', savedPrefs ? 'Found' : 'Not found');
    
    if (savedPrefs) {
      try {
        const prefs: PlotPreferences = JSON.parse(savedPrefs);
        savedSections = prefs.sections;
        setSidebarOpen(prefs.sidebarOpen);
        console.log('✅ Loaded saved preferences:', prefs);
      } catch (e) {
        console.error('❌ Failed to parse saved preferences:', e);
      }
    }

    const newSections: Section[] = [];
    
    // Extract images from BOTH plot and project data
    const imagesFieldId = 'caymmpbkuy00bkl'; // The attachment field ID
    let images: ImageAttachment[] = [];
    
    // Try to get images from project first (this is where they actually are!)
    if (project && project[imagesFieldId]) {
      images = Array.isArray(project[imagesFieldId]) ? project[imagesFieldId] : [];
      console.log('📸 Images found in PROJECT:', images.length, images);
    }
    // Fallback to plot if not in project
    else if (plot && plot[imagesFieldId]) {
      images = Array.isArray(plot[imagesFieldId]) ? plot[imagesFieldId] : [];
      console.log('📸 Images found in PLOT:', images.length, images);
    } else {
      console.log('📸 No images found in project or plot');
    }
    
    // Add Hero Image section (first image, no heading)
    if (images.length > 0) {
      const heroSection: Section = {
        id: 'hero-image',
        name: 'Hero Image',
        type: 'hero-image',
        visible: true,
        images: [images[0]]
      };
      newSections.push(heroSection);
      console.log('✅ Added Hero Image section');
    } else {
      console.log('⚠️ No images found - Hero Image section not added');
    }
    
    // Add Location Map section if coordinates exist
    if (coordinates) {
      newSections.push({
        id: 'location-map',
        name: 'Location Map',
        type: 'map',
        visible: true
      });
    }
    
    // Merge plot and project fields by category
    const allCategories: Record<string, Field[]> = {};
    
    // Add project fields
    projectCols.forEach(field => {
      if (field.Category !== 'HIDDEN') {
        if (!allCategories[field.Category]) {
          allCategories[field.Category] = [];
        }
        allCategories[field.Category].push(field);
      }
    });
    
    // Add plot fields to same categories
    plotCols.forEach(field => {
      if (field.Category !== 'HIDDEN') {
        if (!allCategories[field.Category]) {
          allCategories[field.Category] = [];
        }
        allCategories[field.Category].push(field);
      }
    });
    
    // Create combined sections
    Object.entries(allCategories).forEach(([category, fields]) => {
      const fieldVisibility: Record<string, boolean> = {};
      const fieldWidth: Record<string, 'full' | 'half'> = {};
      const fieldOrder: string[] = [];
      
      fields.forEach(field => {
        fieldVisibility[field["Field ID"]] = true;
        fieldWidth[field["Field ID"]] = 'half';
        fieldOrder.push(field["Field ID"]);
      });
      
      newSections.push({
        id: `section-${category.toLowerCase().replace(/\s+/g, '-')}`,
        name: category,
        type: 'combined',
        category,
        fields,
        visible: true,
        expanded: false,
        fieldVisibility,
        fieldWidth,
        fieldOrder
      });
    });

    // Add Image Gallery section (remaining images in 3-column grid)
    if (images.length > 1) {
      const gallerySection: Section = {
        id: 'image-gallery',
        name: 'Image Gallery',
        type: 'image-gallery',
        visible: true,
        images: images.slice(1) // All images except the first one
      };
      newSections.push(gallerySection);
      console.log('✅ Added Image Gallery section with', images.length - 1, 'images');
    } else {
      console.log('⚠️ Not enough images for gallery section (need 2+, have', images.length, ')');
    }
    
    console.log('📋 Total sections built:', newSections.length, newSections.map(s => s.name));

    // If we have saved sections, merge preferences while keeping field structure up to date
    if (savedSections && savedSections.length > 0) {
      const mergedSections = newSections.map(newSection => {
        const savedSection = savedSections.find(s => s.id === newSection.id);
        if (savedSection) {
          // Merge saved preferences with new section data
          return {
            ...newSection,
            visible: savedSection.visible,
            expanded: savedSection.expanded,
            fieldVisibility: savedSection.fieldVisibility || newSection.fieldVisibility,
            fieldWidth: savedSection.fieldWidth || newSection.fieldWidth,
            fieldOrder: savedSection.fieldOrder || newSection.fieldOrder,
          };
        }
        return newSection;
      });
      
      // Restore section order from saved preferences
      const orderedSections: Section[] = [];
      savedSections.forEach(savedSection => {
        const section = mergedSections.find(s => s.id === savedSection.id);
        if (section) {
          orderedSections.push(section);
        }
      });
      
      // Add any new sections that weren't in saved preferences
      mergedSections.forEach(section => {
        if (!orderedSections.find(s => s.id === section.id)) {
          orderedSections.push(section);
        }
      });
      
      console.log('📋 Final sections after merge:', orderedSections.length, orderedSections.map(s => `${s.name} (visible: ${s.visible})`));
      setSections(orderedSections);
    } else {
      console.log('📋 Using new sections (no saved preferences):', newSections.length);
      setSections(newSections);
    }
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    
    const items = Array.from(sections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setSections(items);
  };

  const toggleSection = (sectionId: string) => {
    setSections(sections.map(s => 
      s.id === sectionId ? { ...s, visible: !s.visible } : s
    ));
  };

  const toggleSectionExpanded = (sectionId: string) => {
    setSections(sections.map(s => 
      s.id === sectionId ? { ...s, expanded: !s.expanded } : s
    ));
  };

  const toggleField = (sectionId: string, fieldId: string) => {
    setSections(sections.map(s => {
      if (s.id === sectionId && s.fieldVisibility) {
        return {
          ...s,
          fieldVisibility: {
            ...s.fieldVisibility,
            [fieldId]: !s.fieldVisibility[fieldId]
          }
        };
      }
      return s;
    }));
  };

  const handleFieldDragEnd = (sectionId: string, result: any) => {
    if (!result.destination) return;
    
    setSections(sections.map(s => {
      if (s.id === sectionId && s.fieldOrder) {
        const newOrder = Array.from(s.fieldOrder);
        const [removed] = newOrder.splice(result.source.index, 1);
        newOrder.splice(result.destination.index, 0, removed);
        
        return {
          ...s,
          fieldOrder: newOrder
        };
      }
      return s;
    }));
  };

  const toggleFieldWidth = (sectionId: string, fieldId: string) => {
    setSections(sections.map(s => {
      if (s.id === sectionId && s.fieldWidth) {
        const currentWidth = s.fieldWidth[fieldId] || 'half';
        return {
          ...s,
          fieldWidth: {
            ...s.fieldWidth,
            [fieldId]: currentWidth === 'half' ? 'full' : 'half'
          }
        };
      }
      return s;
    }));
  };

  const handlePrint = () => {
    window.print();
  };

  const formatValue = (value: any, type: string, fieldName?: string) => {
    if (value === null || value === undefined || value === '') return '—';
    
    switch (type) {
      case 'LongText':
        // Render long text as markdown
        const textValue = String(value);
        return (
          <div className="prose prose-sm max-w-none">
            <div className="whitespace-pre-wrap">
              {textValue.split('\n').map((line, i) => {
                // Check for markdown-style bullets
                if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                  return <li key={i} className="ml-4">{line.trim().substring(2)}</li>;
                }
                // Check for numbered lists
                if (/^\d+\.\s/.test(line.trim())) {
                  return <li key={i} className="ml-4 list-decimal">{line.trim().replace(/^\d+\.\s/, '')}</li>;
                }
                // Check for headings
                if (line.trim().startsWith('# ')) {
                  return <h3 key={i} className="font-bold text-lg mt-2">{line.trim().substring(2)}</h3>;
                }
                if (line.trim().startsWith('## ')) {
                  return <h4 key={i} className="font-semibold text-base mt-2">{line.trim().substring(3)}</h4>;
                }
                // Regular paragraph
                return line.trim() ? <p key={i}>{line}</p> : <br key={i} />;
              })}
            </div>
          </div>
        );
      case 'Date':
        return new Date(value).toLocaleDateString();
      case 'DateTime':
        return new Date(value).toLocaleString();
      case 'Checkbox':
        return value ? '✓' : '✗';
      case 'Percent':
        return `${value}%`;
      case 'Currency':
        return `$${Number(value).toLocaleString()}`;
      case 'Decimal':
      case 'Number':
        return Number(value).toLocaleString();
      default:
        return String(value);
    }
  };

  // Group fields by category and subcategory
  const groupFields = (fields: Field[]) => {
    const grouped: Record<string, Record<string, Field[]>> = {};
    
    fields.forEach(field => {
      // Skip fields in HIDDEN category
      if (field.Category === 'HIDDEN') return;
      
      const category = field.Category || 'Uncategorized';
      const subcategory = field.Subcategory || 'General';
      
      if (!grouped[category]) {
        grouped[category] = {};
      }
      if (!grouped[category][subcategory]) {
        grouped[category][subcategory] = [];
      }
      grouped[category][subcategory].push(field);
    });
    
    return grouped;
  };

  const groupedPlotFields = groupFields(plotFields);
  const groupedProjectFields = project ? groupFields(projectFields) : {};

  return (
    <DashboardLayout contentClassName="p-0 bg-white" disableChat={true}>
      <style jsx global>{`
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          /* Hide all scrollbars in print */
          *::-webkit-scrollbar {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
          }
          
          * {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
          }
          
          body, html {
            overflow: visible !important;
            height: auto !important;
            background: white !important;
            background-color: white !important;
          }
          
          /* Ensure main content area is white */
          .min-h-screen {
            background-color: white !important;
          }
          
          /* Preserve field card backgrounds */
          .bg-gray-50 {
            background-color: #f9fafb !important;
          }
        }
      `}</style>
      {loading && (
        <div className="flex items-center justify-center min-h-screen bg-gray-900">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      )}

      {!loading && !plot && (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900">
          <p className="text-lg text-gray-300 mb-4">Plot not found</p>
          <button
            onClick={() => router.push('/projects')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Projects
          </button>
        </div>
      )}

      {!loading && plot && (
      <div className="min-h-screen bg-black flex">
        {/* Right Sidebar - Section Manager */}
        <div className={`print:hidden fixed right-0 top-0 h-full bg-black border-l border-gray-700 shadow-lg transition-all duration-300 z-40 ${sidebarOpen ? 'w-80' : 'w-0'} overflow-hidden`}>
          <div className="p-4 border-b border-gray-700 flex items-center justify-between bg-black">
            <h2 className="font-bold text-lg text-gray-100">Document Sections</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 hover:bg-gray-700 rounded text-gray-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="sections">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="p-4 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 140px)' }}>
                {sections.map((section, index) => (
                  <Draggable key={section.id} draggableId={section.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`bg-gray-700 border rounded-lg ${snapshot.isDragging ? 'shadow-lg border-blue-500' : 'border-gray-600'}`}
                      >
                        <div className="p-3 flex items-center justify-between" {...provided.dragHandleProps}>
                          <div className="flex items-center gap-2 flex-1">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16" />
                            </svg>
                            <div className="flex-1">
                              <span className="text-sm font-medium text-gray-100 block">{section.name}</span>
                              {section.fields && (
                                <span className="text-xs text-gray-400">
                                  {Object.values(section.fieldVisibility || {}).filter(v => v).length}/{section.fields.length} fields
                                </span>
                              )}
                              {section.images && (
                                <span className="text-xs text-gray-400">
                                  {section.images.length} {section.images.length === 1 ? 'image' : 'images'}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {section.fields && section.fields.length > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSectionExpanded(section.id);
                                }}
                                className="p-1 hover:bg-gray-600 rounded text-gray-300"
                              >
                                <svg className={`w-4 h-4 transition-transform ${section.expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSection(section.id);
                              }}
                              className={`ml-1 p-1 rounded ${section.visible ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}
                            >
                              {section.visible ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                        
                        {/* Expandable Field List */}
                        {section.expanded && section.fields && section.fieldVisibility && section.fieldOrder && section.fieldWidth && (
                          <div className="px-3 pb-3 pt-1 border-t border-gray-600 mt-2">
                            <DragDropContext onDragEnd={(result) => handleFieldDragEnd(section.id, result)}>
                              <Droppable droppableId={`fields-${section.id}`}>
                                {(provided) => (
                                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1 max-h-48 overflow-y-auto">
                                    {(section.fieldOrder || []).map((fieldId, index) => {
                                      const field = section.fields!.find(f => f["Field ID"] === fieldId);
                                      if (!field) return null;
                                      
                                      const isVisible = section.fieldVisibility?.[fieldId] ?? true;
                                      const width = section.fieldWidth?.[fieldId] || 'half';
                                      
                                      return (
                                        <Draggable key={fieldId} draggableId={fieldId} index={index}>
                                          {(provided, snapshot) => (
                                            <div
                                              ref={provided.innerRef}
                                              {...provided.draggableProps}
                                              className={`flex items-center gap-2 py-1 px-2 rounded ${
                                                snapshot.isDragging ? 'bg-blue-600 shadow-md' : 'hover:bg-gray-600'
                                              }`}
                                            >
                                              {/* Drag Handle */}
                                              <div {...provided.dragHandleProps} className="cursor-move">
                                                <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16" />
                                                </svg>
                                              </div>
                                              
                                              {/* Visibility Checkbox */}
                                              <button
                                                onClick={() => toggleField(section.id, fieldId)}
                                                className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center ${
                                                  isVisible
                                                    ? 'bg-blue-500 border-blue-500' 
                                                    : 'bg-gray-800 border-gray-500'
                                                }`}
                                              >
                                                {isVisible && (
                                                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                                  </svg>
                                                )}
                                              </button>
                                              
                                              {/* Field Name */}
                                              <span className="text-xs text-gray-200 truncate flex-1">{field["Field Name"]}</span>
                                              
                                              {/* Width Toggle Buttons */}
                                              <div className="flex gap-0.5">
                                                <button
                                                  onClick={() => toggleFieldWidth(section.id, fieldId)}
                                                  title="Half width"
                                                  className={`px-1.5 py-0.5 text-xs rounded ${
                                                    width === 'half'
                                                      ? 'bg-blue-500 text-white'
                                                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                                                  }`}
                                                >
                                                  ▦
                                                </button>
                                                <button
                                                  onClick={() => toggleFieldWidth(section.id, fieldId)}
                                                  title="Full width"
                                                  className={`px-1.5 py-0.5 text-xs rounded ${
                                                    width === 'full'
                                                      ? 'bg-blue-500 text-white'
                                                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                                                  }`}
                                                >
                                                  ⬜
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </Draggable>
                                      );
                                    })}
                                    {provided.placeholder}
                                  </div>
                                )}
                              </Droppable>
                            </DragDropContext>
                          </div>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
        
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700 bg-gray-800">
          <button
            onClick={handlePrint}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print Document
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'mr-80' : 'mr-0'} print:mr-0 overflow-y-auto`}>
        {/* Toggle button for sidebar when closed */}
        <div className="print:hidden fixed top-4 right-4 z-30">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 shadow-lg"
              title="Show sections panel"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
        </div>

        {/* Document Content */}
        <div className="max-w-[210mm] mx-auto bg-white print:max-w-full print:mx-0 print:shadow-none shadow-lg my-6 print:my-0">
          <div className="p-4 print:p-4">
            {/* Header */}
            <div className="mb-8 pb-6 border-b-2 border-gray-200 relative">
              {/* Logo - Top Right */}
              <div className="absolute top-0 right-0">
                <svg width="180" height="45" viewBox="0 0 512 128" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Scale42* logo">
                  <defs>
                    <style>
                      {`@font-face { font-family: 'Inter'; src: local('Inter'); }`}
                    </style>
                  </defs>
                  <rect x="0" y="0" width="512" height="128" fill="none"/>
                  <g transform="translate(16,94)">
                    <text x="0" y="0" fontFamily="Inter, Montserrat, Poppins, Arial Black, Arial, Helvetica, sans-serif" fontWeight="800" fontSize="88" letterSpacing="0" fill="#1a1a1a">
                      <tspan>SCALE42*</tspan>
                    </text>
                  </g>
                </svg>
              </div>
              
              {/* Project and Plot Names - Top Left */}
              <div className="pr-48">
                <h1 className="text-4xl font-bold text-gray-900">
                  {project && <span>{project["Project Name"] || project.Id}</span>}
                  {project && plot && <span className="mx-3">—</span>}
                  <span>{plot["cjn6mu5x6gythrx"] || plot["Plot Name"] || plot.Id}</span>
                </h1>
              </div>
            </div>

            {/* Dynamic Sections Based on Sidebar Order */}
            {sections.filter(s => s.visible).map((section) => {
              // Hero Image Section (no heading, 16:9 aspect ratio)
              if (section.type === 'hero-image' && section.images && section.images.length > 0) {
                const image = section.images[0];
                const nocodbUrl = process.env.NEXT_PUBLIC_NOCODB_API_URL || 'https://nocodb.edbmotte.com';
                // path already includes 'download/' prefix, just add leading slash
                const imageUrl = `${nocodbUrl}/${image.path}`;
                
                return (
                  <div key={section.id} className="mb-10 print:page-break-inside-avoid">
                    <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                      <img 
                        src={imageUrl}
                        alt={image.title}
                        className="absolute top-0 left-0 w-full h-full object-cover rounded-lg"
                      />
                    </div>
                  </div>
                );
              }

              // Image Gallery Section (3-column grid, 16:9 aspect ratio)
              if (section.type === 'image-gallery' && section.images && section.images.length > 0) {
                const nocodbUrl = process.env.NEXT_PUBLIC_NOCODB_API_URL || 'https://nocodb.edbmotte.com';
                
                return (
                  <div key={section.id} className="mb-10 print:page-break-inside-avoid">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-200">
                      {section.name}
                    </h2>
                    <div className="grid grid-cols-3 gap-4">
                      {section.images.map((image, idx) => {
                        // path already includes 'download/' prefix, just add leading slash
                        const imageUrl = `${nocodbUrl}/${image.path}`;
                        return (
                          <div key={image.id || idx} className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                            <img 
                              src={imageUrl}
                              alt={image.title}
                              className="absolute top-0 left-0 w-full h-full object-cover rounded-lg"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              if (section.type === 'map' && coordinates) {
                return (
                  <div key={section.id} className="mb-10 print:page-break-inside-avoid">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-200">
                      {section.name}
                    </h2>
                    <div className="relative">
                      <div 
                        ref={mapRef} 
                        className="w-full h-96 rounded-lg border-2 border-gray-300 print:h-64 map-container"
                        style={{ minHeight: '384px' }}
                      />
                      {/* QR Code Overlay - Bottom Left */}
                      <div style={{ position: 'absolute', left: '0.3rem', bottom: '0.3rem' }} className="bg-white p-2 rounded-lg shadow-lg border-2 border-gray-300">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`https://www.google.com/maps?q=${coordinates.lat},${coordinates.lng}`)}`}
                          alt="Google Maps QR Code" 
                          className="w-24 h-24"
                        />
                      </div>
                    </div>
                  </div>
                );
              }
              
              if (section.type === 'combined' && section.fields && section.fieldVisibility && section.fieldOrder && section.fieldWidth) {
                // Get fields in custom order
                const orderedFields = section.fieldOrder
                  .map(fieldId => section.fields!.find(f => f["Field ID"] === fieldId))
                  .filter((f): f is Field => f !== undefined && section.fieldVisibility![f["Field ID"]]);
                
                if (orderedFields.length === 0) return null;
                
                return (
                  <div key={section.id} className="mb-10 print:page-break-inside-avoid">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-200">
                      {section.name}
                    </h2>
                    <div className="grid grid-cols-2 gap-6">
                      {orderedFields.map(field => {
                        const width = section.fieldWidth![field["Field ID"]] || 'half';
                        const fieldValue = plot[field["Field ID"]] !== undefined 
                          ? plot[field["Field ID"]] 
                          : project?.[field["Field ID"]];
                        
                        return (
                          <div 
                            key={field["Field ID"]} 
                            className={` ${width === 'full' ? 'col-span-2' : ''}`}
                          >
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                              {field["Field Name"]}
                            </div>
                            <div className="text-sm text-gray-900">
                              {formatValue(fieldValue, field.Type, field["Field Name"])}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }
              
              return null;
            })}

            {/* Footer */}
            <div className="mt-12 pt-6 border-t-2 border-gray-200 text-sm text-gray-500">
              <p>Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
            </div>
          </div>
        </div>
      </div>
      </div>
      )}
    </DashboardLayout>
  );
}

export default function PlotDetailPage({ params }: PlotDetailPageProps) {
  return (
    <WithScale42Access>
      <PlotDetailPageContent params={params} />
    </WithScale42Access>
  );
}
