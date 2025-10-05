# GeoData Field and Tooltip Position Updates

## Date: 2025-10-05

## Changes Implemented

### 1. ✅ Tooltip Position Fixed
**Problem:** Tooltips were getting cut off at the bottom of the viewport  
**Solution:** Changed all tooltip positions from `top-6/top-7` to `bottom-6/bottom-7`

**Affected Components:**
- SingleLineTextField
- LongTextField  
- GenericField
- SingleSelectField
- MultiSelectField
- GeoDataField (new)

**Implementation:**
- All field name tooltips now use `bottom-6` (appear above the field name)
- All field type icon tooltips now use `bottom-7` (appear above the icon)

---

### 2. ✅ GeoData Field Component Created
**Purpose:** Custom field type for displaying geographic coordinates with Google Maps integration

**Features:**
- **Inline Editing:** Click field to edit directly (no popup modal)
- **Visual Display:** Shows coordinates with a Google Maps icon
- **Google Maps Link:** Click the map icon to open coordinates in Google Maps
- **Smart Validation:** Validates latitude/longitude format before saving
- **Auto-normalization:** Converts commas (,) and colons (:) to semicolons (;) automatically
- **Field History:** Includes audit trail button like other field types
- **Tooltips:** Field name and type icons have detailed tooltips
- **Keyboard Support:** Press Enter to save, Escape to cancel

**Coordinate Format:**
- Required format: `latitude;longitude`
- Example: `68.607358;14.461009`
- Auto-converts: `68.607358,14.461009` → `68.607358;14.461009`
- Auto-converts: `68.607358:14.461009` → `68.607358;14.461009`

**Validation:**
- Checks for valid numeric latitude and longitude
- Ensures exactly 2 parts separated by semicolon (after normalization)
- Shows error toast if format is invalid

**Google Maps Integration:**
- Map icon appears next to coordinate value when valid coordinates exist
- Clicking icon opens `https://www.google.com/maps?q=LAT,LNG` in new tab
- Icon: Blue pin/location marker SVG

---

### 3. ✅ Coordinate Normalization Logic
**Implementation in GeoDataField:**

```typescript
const normalizeCoordinates = (value: string): string => {
  if (!value) return value;
  return value.replace(/[,:]/g, ';');
};
```

**Usage:**
1. User enters: `68.607358,14.461009` or `68.607358:14.461009`
2. On save: Auto-normalized to `68.607358;14.461009`
3. Stored in NocoDB: `68.607358;14.461009`

**Validation:**
```typescript
const parseCoordinates = (value: string): { lat: number; lng: number } | null => {
  if (!value) return null;
  const normalized = normalizeCoordinates(value);
  const parts = normalized.split(';');
  if (parts.length !== 2) return null;
  const lat = parseFloat(parts[0].trim());
  const lng = parseFloat(parts[1].trim());
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
};
```

---

## Field Type Rendering Logic

**Location:** `frontend/app/projects/PlotDisplay.tsx` line ~3117

**Order of field type checks:**
1. GeoData ← **NEW**
2. SingleLineText
3. LongText
4. SingleSelect
5. MultiSelect
6. Static fields (CreatedBy, Formula, etc.)
7. GenericField (catch-all for other types)

---

## Testing Checklist

### GeoData Field
- [ ] Field displays correctly with blue/red icon indicator
- [ ] Clicking field opens edit modal
- [ ] Entering `68.607358,14.461009` auto-converts to semicolon
- [ ] Entering `68.607358:14.461009` auto-converts to semicolon
- [ ] Invalid coordinates show error toast
- [ ] Valid coordinates show Google Maps icon
- [ ] Clicking Google Maps icon opens correct location in new tab
- [ ] Field history button works
- [ ] Value change validation prevents unnecessary updates
- [ ] Tooltips show on field name and type icon

### Tooltip Positioning
- [ ] Field name tooltips appear ABOVE the field name (not cut off)
- [ ] Field type icon tooltips appear ABOVE the icon (not cut off)
- [ ] Tooltips work on all field types
- [ ] Tooltips show Type, Table, and Description (if available)

---

## Code Locations

### GeoDataField Component
- **Start:** Line ~100
- **End:** Line ~490
- **Key Functions:**
  - `normalizeCoordinates()` - Replaces `,` and `:` with `;`
  - `parseCoordinates()` - Validates and parses lat/lng
  - `handleSave()` - Normalizes before saving to NocoDB
  - `loadFieldHistory()` - Loads audit trail

### Field Type Rendering
- **Location:** Line ~3117
- **Check:** `if (field.Type === "GeoData")`

### Tooltip Classes Changed
- **Before:** `absolute z-50 left-0 top-6 min-w-[220px]`
- **After:** `absolute z-50 left-0 bottom-6 min-w-[220px]`
- **Icon tooltips:** `top-7` → `bottom-7`

---

## API Integration

### NocoDB Update Endpoint
```typescript
fetch(`/api/proxy/nocodb?path=api/v2/tables/${tableId}/records`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': authHeader,
  },
  body: JSON.stringify({
    Id: recordId,
    [field["Field Name"]]: normalizedValue // ← semicolon-separated
  }),
});
```

---

## User Instructions

### How to Use GeoData Fields

1. **View Coordinates:**
   - Field shows coordinates in format: `latitude;longitude`
   - If valid, a blue map icon appears next to the value

2. **Edit Coordinates (Inline):**
   - Click anywhere on the field value text
   - Input appears inline for direct editing
   - Enter coordinates in any of these formats:
     - `68.607358;14.461009` (preferred)
     - `68.607358,14.461009` (auto-converts)
     - `68.607358:14.461009` (auto-converts)
   - Press Enter to save or Escape to cancel
   - Click outside field to save automatically

3. **Open in Google Maps:**
   - Click the blue map icon (📍) next to valid coordinates
   - Opens location in new Google Maps tab

4. **View Field History:**
   - Click the clock icon (⏰) to see all changes to this field
   - Shows who made changes and when

---

## Future Enhancements (Optional)

- [ ] Embedded map preview in edit modal
- [ ] Click on map to set coordinates
- [ ] Reverse geocoding (show address from coordinates)
- [ ] Support for multiple coordinate formats (DMS, UTM, etc.)
- [ ] Coordinate precision validation
- [ ] Distance calculations between coordinates

---

## Related Documentation

- `FIELD_CHANGES_SUMMARY.md` - Field display changes
- `PROJECT_FIELD_VISUAL_INDICATOR.md` - Project/plot field icons
- `FIELD_UPDATE_CHANGES_SUMMARY.md` - Value change validation
- `desktop.instructions.md` - Toast notification standards
