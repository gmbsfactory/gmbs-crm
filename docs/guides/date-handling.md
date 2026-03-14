# Date Handling Guide

Comprehensive guide to GMBS-CRM's production-grade date handling system, designed for CSV imports, real-time data sync, and multi-timezone support.

## Overview

The date handling system provides:
- **Explicit validation** - No silent failures, clear error messages
- **CSV-first parsing** - Handles multiple date formats from spreadsheets
- **Timezone awareness** - UTC internally, local display via date-fns
- **Excel compatibility** - Auto-detects and parses Excel serial dates
- **Type safety** - Full TypeScript strict mode support
- **Edge case handling** - Leap years, century transitions, boundaries

### Architecture

```
Parsing         Validation       Formatting        Comparison
────────        ──────────       ──────────        ──────────
CSV string  →  isValidDate() → date-fns format → isBetween()
Excel serial    stripTime()     locale support    isInRange()
Timestamp       Error handling   timezone aware    compareDates()
```

## API Reference

### Core Functions

#### `parseCSVDate(value: unknown): Date`

Parse a CSV date value with automatic format detection. Throws on error.

**Supported formats:**
- `DD/MM/YYYY` - European format (e.g., "30/12/1899")
- `DD/MM/YYYY HH:mm:ss` - With time (e.g., "30/12/1899 14:30:45")
- `YYYY-MM-DD` - ISO format (e.g., "1899-12-30")
- `YYYY-MM-DD HH:mm:ss` - ISO with time (e.g., "1899-12-30 14:30:45")
- Excel serial numbers (e.g., `44927` = 2022-12-31)

**Returns:** Date in UTC

**Throws:** Error with clear message on parse failure

```typescript
import { parseCSVDate } from '@/lib/date-utils'

// Normal European format
const date = parseCSVDate('30/12/1899')
// → 1899-12-30T00:00:00.000Z

// With time component
const dateWithTime = parseCSVDate('30/12/1899 14:30:45')
// → 1899-12-30T14:30:45.000Z

// Excel serial number
const excelDate = parseCSVDate(44927)
// → 2022-12-31T00:00:00.000Z

// Error handling
try {
  parseCSVDate('invalid-date')
} catch (error) {
  console.error(error.message)
  // → "Cannot parse date from "invalid-date". Expected formats: DD/MM/YYYY, YYYY-MM-DD, ..."
}
```

#### `parseCSVDateRange(start: unknown, end: unknown): DateRange`

Parse a date range from start and end values. Both dates must be valid and start ≤ end.

```typescript
import { parseCSVDateRange } from '@/lib/date-utils'

const range = parseCSVDateRange('01/01/2025', '31/12/2025')
// → { start: Date, end: Date }

// Mixed formats work
const mixedRange = parseCSVDateRange('01/01/2025', '2025-12-31')
// → { start: Date, end: Date }

// Throws if invalid
try {
  parseCSVDateRange('31/12/2025', '01/01/2025')
} catch (error) {
  console.error(error.message)
  // → "Invalid date range: start ... is after end ..."
}
```

#### `isValidDate(date: unknown): boolean`

Safe validation that doesn't throw. Returns false for Invalid Date, null, undefined, and non-Date objects.

```typescript
import { isValidDate } from '@/lib/date-utils'

isValidDate(new Date())                    // → true
isValidDate(parseCSVDate('30/12/1899'))    // → true
isValidDate(new Date('invalid'))           // → false
isValidDate(null)                          // → false
isValidDate(undefined)                     // → false
isValidDate('2025-01-15')                  // → false
```

#### `stripTimeComponent(date: Date): Date`

Normalize a date to midnight (00:00:00.000) in UTC. Returns a new Date instance (immutable).

```typescript
import { stripTimeComponent } from '@/lib/date-utils'

const original = new Date('2025-01-15T14:30:45.123Z')
const midnight = stripTimeComponent(original)

midnight.toISOString()        // → '2025-01-15T00:00:00.000Z'
original.getUTCHours()        // → 14 (unchanged, immutable)
midnight.getUTCHours()        // → 0
```

#### `isInRange(date: Date, range: DateRange): boolean`

Check if a date falls within a range (inclusive on both boundaries: start ≤ date ≤ end).

```typescript
import { isInRange, parseCSVDateRange } from '@/lib/date-utils'

const range = parseCSVDateRange('01/01/2025', '31/12/2025')

isInRange(new Date('2025-06-15'), range)   // → true
isInRange(range.start, range)              // → true (inclusive)
isInRange(range.end, range)                // → true (inclusive)
isInRange(new Date('2024-12-31'), range)   // → false
isInRange(new Date('2026-01-01'), range)   // → false
```

#### `createDateRangeFromStrings(start: unknown, end: unknown): DateRange | null`

Convenience wrapper that returns null on error instead of throwing.

```typescript
import { createDateRangeFromStrings } from '@/lib/date-utils'

const range = createDateRangeFromStrings('01/01/2025', '31/12/2025')
if (range) {
  // Use range
} else {
  // Handle parse error
}
```

#### `getDateParseDebugInfo(value: unknown, error: Error): Record<string, unknown>`

Get detailed debug information about a parse failure. Useful for logging and troubleshooting.

```typescript
import { parseCSVDate, getDateParseDebugInfo } from '@/lib/date-utils'

try {
  parseCSVDate(invalidValue)
} catch (error) {
  const debug = getDateParseDebugInfo(invalidValue, error as Error)
  console.error('Parse failed:', debug)
  // → { input: ..., inputType: 'string', error: '...', timestamp: '2025-03-12T...' }
}
```

## Common Patterns

### CSV Import with Date Filtering

Filter rows from a CSV import by date range:

```typescript
import { parseCSVDate, isInRange, parseCSVDateRange } from '@/lib/date-utils'

const csvRows = [
  { date: '01/01/2025', name: 'Row 1' },
  { date: '15/06/2025', name: 'Row 2' },
  { date: '31/12/2025', name: 'Row 3' },
  { date: '15/01/2026', name: 'Row 4' },
]

const range = parseCSVDateRange('01/01/2025', '31/12/2025')

const filtered = csvRows.filter(row => {
  const parsed = parseCSVDate(row.date)
  return isInRange(parsed, range)
})

// Result: [Row 1, Row 2, Row 3]
```

### Parse Multiple Dates with Error Handling

```typescript
import { parseCSVDate, getDateParseDebugInfo } from '@/lib/date-utils'

const csvValues = ['30/12/1899', '2025-01-15', '15/03/2025 14:30:45', 44927]

const dates = csvValues.map(value => {
  try {
    return parseCSVDate(value)
  } catch (error) {
    const debug = getDateParseDebugInfo(value, error as Error)
    console.warn(`Failed to parse date:`, debug)
    return null
  }
}).filter(Boolean)

// dates now contains only successfully parsed dates
```

### Normalize Dates for Storage

Strip time components before storing dates in the database to ensure consistency:

```typescript
import { parseCSVDate, stripTimeComponent } from '@/lib/date-utils'

// Input from CSV: "30/12/1899 14:30:45"
const parsed = parseCSVDate('30/12/1899 14:30:45')
const normalized = stripTimeComponent(parsed)

// Store normalized: 1899-12-30T00:00:00Z
const storedDate = normalized.toISOString()
```

### Excel Import with Serial Dates

Excel files often export dates as serial numbers. The parser auto-detects these:

```typescript
import { parseCSVDate } from '@/lib/date-utils'

const excelDates = [44927, 44928, 44929] // Excel serial numbers

const parsed = excelDates.map(serial => parseCSVDate(serial))
// → [2022-12-31T00:00:00Z, 2023-01-01T00:00:00Z, 2023-01-02T00:00:00Z]
```

### Display Dates in User's Locale

Combine with `date-fns` for locale-aware formatting:

```typescript
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { parseCSVDate } from '@/lib/date-utils'

const date = parseCSVDate('30/12/1899')
const formatted = format(date, 'PPPP', { locale: fr })
// → "samedi 30 décembre 1899"
```

## Edge Cases

### Leap Year Dates

Dates like February 29 are validated correctly:

```typescript
import { parseCSVDate } from '@/lib/date-utils'

// Leap year
parseCSVDate('29/02/2020')  // → 2020-02-29T00:00:00.000Z

// Non-leap year - throws
try {
  parseCSVDate('29/02/2021')
} catch (error) {
  console.error(error.message)
  // → "Invalid date: 29/02/2021 parses to invalid date 2021-02-29T00:00:00Z. Check month..."
}
```

### Century Boundaries

Works correctly across century transitions:

```typescript
import { parseCSVDate } from '@/lib/date-utils'

parseCSVDate('31/12/1999')  // → 1999-12-31T00:00:00.000Z
parseCSVDate('01/01/2000')  // → 2000-01-01T00:00:00.000Z
parseCSVDate('31/12/2099')  // → 2099-12-31T00:00:00.000Z
parseCSVDate('01/01/2100')  // → 2100-01-01T00:00:00.000Z
```

### Excel Epoch

Excel dates are relative to 1899-12-30:

```typescript
import { parseCSVDate } from '@/lib/date-utils'

parseCSVDate(1)     // → 1899-12-31T00:00:00.000Z
parseCSVDate(44927) // → 2022-12-31T00:00:00.000Z
```

## Error Handling Strategy

The system uses **exception-driven design** for the main parsing functions. This is intentional:

```typescript
// Good: Parse and handle errors
try {
  const date = parseCSVDate(csvValue)
  // date is guaranteed valid here
  processDate(date)
} catch (error) {
  // Handle with full error context
  logger.error(`Failed to parse date: ${error.message}`)
  skipRow()
}

// Also available: Safe validation without throwing
if (isValidDate(someDate)) {
  // someDate is definitely valid
}
```

### Error Messages

Error messages are designed to be:
- **Clear** - Explain what went wrong
- **Specific** - Include the input value
- **Actionable** - Suggest valid formats
- **Logged** - Useful for debugging imports

Example:
```
Cannot parse date from "30/13/1899". Expected formats: DD/MM/YYYY, YYYY-MM-DD,
or Excel serial number. Include time with HH:mm:ss if needed (e.g., "30/12/1899 14:30:45").
```

## Timezone Considerations

### Internal Storage

All dates are stored in UTC:

```typescript
import { parseCSVDate } from '@/lib/date-utils'

const date = parseCSVDate('30/12/1899')
date.toISOString()  // → Always UTC with Z suffix: "1899-12-30T00:00:00.000Z"
```

### Display in Browser

Convert to user's local timezone for display:

```typescript
import { parseCSVDate } from '@/lib/date-utils'

const date = parseCSVDate('30/12/1899')

// Browser local time (e.g., Europe/Paris)
const localString = date.toLocaleString('fr-FR')
// → "30/12/1899 00:00:00" (or adjusted for local TZ)

// Using date-fns (recommended)
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

format(date, 'dd/MM/yyyy', { locale: fr })  // → "30/12/1899"
```

### CSV Import Timezone Awareness

CSV imports should assume **user's local timezone** unless specified:

```typescript
import { parseCSVDate, stripTimeComponent } from '@/lib/date-utils'

// CSV contains: "30/12/1899" (user's local date, no time)
const csvDate = parseCSVDate('30/12/1899')

// Strip time to normalize
const normalized = stripTimeComponent(csvDate)

// Store in database as UTC midnight
```

## Testing

The CSV parser includes comprehensive tests for:

```bash
# Run all date tests
npm run test -- csv-parser

# Watch mode
npm run test:watch -- csv-parser

# Specific test
npm run test -- csv-parser -t "should parse DD/MM/YYYY format"
```

Test coverage includes:
- ✅ Normal formats (DD/MM/YYYY, YYYY-MM-DD)
- ✅ With time components (HH:mm:ss)
- ✅ Excel serial dates
- ✅ Leap years, century boundaries
- ✅ Invalid inputs and error scenarios
- ✅ Date range validation
- ✅ Integration scenarios (CSV filtering)

## Troubleshooting

### "Cannot parse date: value is null"

The input is null or undefined. Check CSV row parsing:

```typescript
// Bad: undefined value from CSV parsing error
const value = csvRow.date  // → undefined

// Good: Check before parsing
if (csvRow.date) {
  const date = parseCSVDate(csvRow.date)
}
```

### "Invalid date: ... parses to invalid date ... Check month (01-12) and day"

The input doesn't represent a valid calendar date:

```typescript
parseCSVDate('30/02/2025')  // Invalid: Feb 30 doesn't exist
parseCSVDate('32/01/2025')  // Invalid: Jan 32 doesn't exist
```

### "Invalid date range: start ... is after end ..."

The start date is later than the end date:

```typescript
// Bad: end before start
parseCSVDateRange('31/12/2025', '01/01/2025')

// Good: start before end
parseCSVDateRange('01/01/2025', '31/12/2025')
```

### Excel dates look wrong

Excel uses 1899-12-30 as epoch (serial 0). Verify the serial number:

```typescript
import { parseCSVDate } from '@/lib/date-utils'

// If you're getting unexpected dates, check the Excel serial format
const date = parseCSVDate(44927)
console.log(date.toISOString())  // → "2022-12-31T00:00:00.000Z"
```

## Related Documentation

- [API Reference: date-utils.ts](../api-reference/date-utils.md)
- [Architecture: Data Flow](../architecture/data-flow.md)
- [Guides: Adding a Feature](./adding-a-feature.md)
- [Getting Started: Import Data](../getting-started/import-data.md)
