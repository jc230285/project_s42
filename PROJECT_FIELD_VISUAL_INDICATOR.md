# Project Field Visual Indicator Implementation

## Overview
Added a visual indicator (green clipboard icon with checkmark) next to field names that belong to the "Projects" table, making it easy to distinguish project-level fields from plot/site-level fields.

## Implementation Details

### Icon Design
- **Icon**: Clipboard with checkmark SVG
- **Color**: Green background (`bg-green-100` in light mode, `bg-green-900/30` in dark mode)
- **Icon Color**: Green text (`text-green-600` in light mode, `text-green-400` in dark mode)
- **Size**: Small (w-3 h-3 = 12x12px)
- **Tooltip**: "Project field" on hover

### Logic
```typescript
{field["Table"] === "Projects" && (
  <div className="p-1 rounded bg-green-100 dark:bg-green-900/30" title="Project field">
    <svg className="w-3 h-3 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
    </svg>
  </div>
)}
```

### Updated Components in `PlotDisplay.tsx`

1. **SingleLineTextField** (Line ~217)
   - Field card display for single-line text inputs
   - Icon appears in top-right corner next to field name

2. **RichTextField** (Line ~392)
   - Field card display for rich text/WYSIWYG editor
   - Icon appears next to field name at top of card

3. **LongTextField** (Line ~645)
   - Field card display for multi-line text areas
   - Icon appears next to field name at top of card

4. **Single-select Dropdown** (Line ~885)
   - Field card for dropdown/select fields with single selection
   - Icon appears next to field name

5. **Multi-select Dropdown** (Line ~1154)
   - Field card for dropdown/select fields with multiple selections
   - Icon appears next to field name

6. **Static/Disabled Fields** (Line ~2047)
   - Read-only fields that cannot be edited
   - Icon appears next to field name in red-bordered cards

## Field Name Display Pattern

All field name displays were updated to use a flex container:

```typescript
<div className="text-sm font-medium text-foreground mb-2 break-words flex items-center gap-2">
  <span>{field["Field Name"]}</span>
  {field["Table"] === "Projects" && (
    // Green clipboard icon
  )}
</div>
```

## Benefits

1. **Visual Clarity**: Users can immediately identify which fields belong to the project vs the plot/site
2. **Consistent UX**: Same icon appears across all field types (text, rich text, dropdown, etc.)
3. **Dark Mode Support**: Icon colors adapt to light/dark theme
4. **Accessibility**: Tooltip provides text description on hover
5. **Non-intrusive**: Small, subtle icon that doesn't clutter the UI

## Testing

To verify the implementation:
1. Navigate to the Projects page
2. Select a plot to view its fields
3. Look for the green clipboard icon next to field names
4. Verify that only fields from the "Projects" table show the icon
5. Test in both light and dark modes
6. Hover over the icon to see the "Project field" tooltip

## Schema Reference

The field schema includes a `"Table"` property with possible values:
- `"Projects"` - Fields from the Projects table (shows icon)
- `"Land Plots, Sites"` - Fields from the plots/sites table (no icon)
