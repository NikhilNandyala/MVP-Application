# MDX Parser Specification

## Overview
Deterministic parser that converts raw incident text to structured MDX format with strict section detection and table preservation.

## Section Detection Rules

### Recognized Headers (Case-Insensitive)
The parser detects sections by exact header match:

| Raw Header | MDX Section | Notes |
|------------|-------------|-------|
| `ISSUE` | `## Issue` | Required |
| `IMPACT` | `## Impact` | Optional |
| `ROOT CAUSE` | `## Root Cause` | Optional |
| `RESOLUTION` or `FIX` | `## Fix` | Converted to numbered steps |
| `VALIDATION` | `## Validation` | Optional |
| `LESSON LEARNED` or `LESSONS LEARNED` | `## Lessons Learned` | Optional |
| `PREVENTION` | `## Prevention` | Always included (empty if no data) |
| `FINAL NOTE` or `FINAL NOTES` | `## Final Note` | Optional |

### Non-Recognized Sections
- **Symptoms**: Will NOT be created. Use `IMPACT` instead.
- **Notes**: Will NOT be created. Use `FINAL NOTE` instead.

## Table Detection

### Supported Formats
1. **Tab-separated**: Columns delimited by tab characters
2. **Multi-space separated**: Columns delimited by 2+ consecutive spaces

### Requirements
- Minimum 2 rows (header + 1 data row)
- Minimum 2 columns
- Consistent column count (within ±1 variance)

### Output
All detected tables are converted to Markdown pipe tables:
```
| Column1 | Column2 | Column3 |
| --- | --- | --- |
| Value1 | Value2 | Value3 |
```

## Content Formatting

### Bullets
- Lines starting with `-`, `•`, or numbered lists are preserved
- Other content is converted to bullets automatically

### Paragraphs
- Multiple lines within a section are joined with proper spacing
- Blank lines are preserved between distinct items

## Frontmatter Rules

### Required Fields
```yaml
title: string       # From metadata OR first sentence of ISSUE
description: string # First 1-2 sentences of ISSUE
date: string        # ISO format (YYYY-MM-DD)
tags: string[]      # Auto-extracted from content
category: string    # From metadata OR "azure-troubleshooting"
```

### Optional Fields
```yaml
severity: string    # ONLY if provided in metadata (not inferred)
```

## Output Schema

### Fixed Section Order
1. Frontmatter
2. `## Issue`
3. `## Impact`
4. `## Root Cause`
5. `## Fix` (as numbered steps)
6. `## Validation`
7. `## Lessons Learned`
8. `## Prevention` (always present)
9. `## Final Note` (only if content exists)

### Empty Sections
If no content detected: `(No data captured in incident notes.)`

## Example

### Input
```
ISSUE
Customer reported 502 errors on Azure Front Door.

IMPACT
Service	Status	Users Affected
Frontend	Down	1200
Backend	Degraded	800

ROOT CAUSE
Origin server's NSG was blocking port 443.

RESOLUTION
Opened port 443 in NSG rule priority 100.
Updated security group to allow HTTPS traffic.

VALIDATION
Tested endpoint and confirmed 200 OK responses.

PREVENTION
Implement IaC for NSG rules.
Add automated health checks.
```

### Output
```mdx
---
title: "Customer reported 502 errors on Azure Front Door"
description: "Customer reported 502 errors on Azure Front Door..."
date: "2025-12-27"
tags: ["Azure", "Front Door", "Networking"]
category: "azure-troubleshooting"
---

## Issue

- Customer reported 502 errors on Azure Front Door.

## Impact

| Service | Status | Users Affected |
| --- | --- | --- |
| Frontend | Down | 1200 |
| Backend | Degraded | 800 |

## Root Cause

- Origin server's NSG was blocking port 443.

## Fix

### Step 1: Opened port 443 in NSG rule priority 100.

### Step 2: Updated security group to allow HTTPS traffic.

## Validation

- Tested endpoint and confirmed 200 OK responses.

## Lessons Learned

(No data captured in incident notes.)

## Prevention

- Implement IaC for NSG rules.
- Add automated health checks.
```

## Testing

Run unit tests:
```bash
npm test
```

Test cases include:
- Multiple tables with all sections
- Missing IMPACT section
- Tab-separated vs space-separated tables
