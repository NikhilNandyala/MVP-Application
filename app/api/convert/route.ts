import { NextRequest, NextResponse } from 'next/server';
import { extractTags } from '@/lib/mdx/tagger';
import { validateMDX } from '@/lib/mdx/validator';

interface ConvertRequest {
  rawText: string;
  title?: string;
  category?: string;
  severity?: string;
}

interface ConvertResponse {
  mdx: string;
  tags: string[];
  warnings: string[];
}

interface ParsedSections {
  issue: string[];
  symptoms: string[];
  rootCause: string[];
  fix: string[];
  validation: string[];
  prevention: string[];
  notes: string[];
}

/**
 * Detect and convert table-like structures to Markdown tables
 */
function detectAndConvertTables(lines: string[]): string[] {
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check if this line looks like a table (pipe-separated or multi-space separated)
    const isPipeSeparated = line.includes('|');
    const hasMultipleSpaces = /\s{2,}/.test(line);

    if (isPipeSeparated || hasMultipleSpaces) {
      // Try to build a table starting from this line
      const tableLines: string[] = [line];
      let j = i + 1;

      // Collect consecutive lines that look like table rows
      while (j < lines.length) {
        const nextLine = lines[j];
        const nextIsPipe = nextLine.includes('|');
        const nextHasSpaces = /\s{2,}/.test(nextLine);
        const isSeparator = /^[-|:\s]+$/.test(nextLine);

        // Stop if line doesn't match table pattern (unless it's a separator)
        if (!nextIsPipe && !nextHasSpaces && !isSeparator) {
          break;
        }

        tableLines.push(nextLine);
        j++;
      }

      // If we have at least 2 lines, try to build a table
      if (tableLines.length >= 2) {
        const table = buildMarkdownTable(tableLines);
        if (table) {
          result.push(table);
          i = j;
          continue;
        }
      }
    }

    // Not a table, add as regular line
    result.push(line);
    i++;
  }

  return result;
}

/**
 * Build a Markdown table from detected table lines
 */
function buildMarkdownTable(lines: string[]): string | null {
  if (lines.length < 2) return null;

  // Parse rows
  const rows: string[][] = [];

  for (const line of lines) {
    // Skip separator lines
    if (/^[-|:\s]+$/.test(line)) continue;

    let cells: string[];

    // Parse pipe-separated
    if (line.includes('|')) {
      cells = line.split('|').map(c => c.trim()).filter(c => c.length > 0);
    }
    // Parse space-separated (2+ spaces as delimiter)
    else if (/\s{2,}/.test(line)) {
      cells = line.split(/\s{2,}/).map(c => c.trim()).filter(c => c.length > 0);
    } else {
      continue;
    }

    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  if (rows.length < 2) return null;

  // Ensure all rows have the same number of columns
  const maxCols = Math.max(...rows.map(r => r.length));
  const normalizedRows = rows.map(row => {
    while (row.length < maxCols) {
      row.push('');
    }
    return row;
  });

  // Build Markdown table
  const header = normalizedRows[0];
  const dataRows = normalizedRows.slice(1);

  const headerLine = `| ${header.join(' | ')} |`;
  const separatorLine = `|${header.map(() => '---').join('|')}|`;
  const dataLines = dataRows.map(row => `| ${row.join(' | ')} |`);

  return [headerLine, separatorLine, ...dataLines].join('\n');
}

/**
 * Smart parser that distributes content to appropriate sections
 */
function parseIncidentText(rawText: string): ParsedSections {
  const sections: ParsedSections = {
    issue: [],
    symptoms: [],
    rootCause: [],
    fix: [],
    validation: [],
    prevention: [],
    notes: []
  };

  // Split into lines and detect/convert tables
  const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const processedLines = detectAndConvertTables(lines);
  
  for (const line of processedLines) {
    // If it's a table, add to notes by default
    if (line.startsWith('|')) {
      sections.notes.push(line);
      continue;
    }
    
    const lowerLine = line.toLowerCase();
    
    // Check for inline labels at the start of the line
    const labelMatch = lowerLine.match(/^(issue|symptoms?|root cause|cause|fix(ed)?|resolution|validation|verify|validated?|prevention|recommend(ation)?|notes?)[\s:]+(.+)/i);
    
    if (labelMatch) {
      const label = labelMatch[1].toLowerCase();
      const content = line.substring(labelMatch[0].length - labelMatch[3].length).trim();
      
      // Handle multi-label lines (e.g., "validation and fix")
      if (/validation.*fix|fix.*validation/.test(lowerLine)) {
        // Extract action for Fix
        const actionMatch = content.match(/opened|added|enabled|configured|created|updated|changed|modified|set|applied|ran|executed/i);
        if (actionMatch) {
          const fixPart = content.split(/\.|tested|confirmed|verified/i)[0].trim();
          if (fixPart) sections.fix.push(fixPart);
        }
        // Extract verification for Validation
        const validationMatch = content.match(/(tested|confirmed|verified|validation|works?).*/i);
        if (validationMatch) {
          sections.validation.push(validationMatch[0].trim());
        }
      }
      // Single label classification
      else if (label.startsWith('issue')) {
        sections.issue.push(content);
      } else if (label.startsWith('symptom')) {
        sections.symptoms.push(content);
      } else if (label.includes('cause') || label === 'cause') {
        sections.rootCause.push(content);
      } else if (label.startsWith('fix') || label === 'resolution') {
        sections.fix.push(content);
      } else if (label.startsWith('validat') || label === 'verify') {
        sections.validation.push(content);
      } else if (label.startsWith('prevent') || label.startsWith('recommend')) {
        sections.prevention.push(content);
      } else {
        sections.notes.push(content);
      }
      continue;
    }
    
    // Fallback to keyword-based detection for unlabeled content
    // Symptoms: errors, failures, observed issues
    if (/\b(error|failed?|unable|timeout|403|401|502|500|user reported|observed|symptom|impact|receiving|getting|returned)\b/i.test(lowerLine)) {
      sections.symptoms.push(line);
    }
    // Root Cause: explanations of why
    else if (/\b(caused by|root cause|because|due to|blocked by|misconfigured?|missing role|dns (wrong|issue)|reason|explanation)\b/i.test(lowerLine)) {
      sections.rootCause.push(line);
    }
    // Fix: actions taken
    else if (/\b(fix(ed)?|changed?|enabled?|added?|opened?|updated?|configured?|created?|whitelisted?|modified?|set|ran|executed|applied)\b/i.test(lowerLine)) {
      sections.fix.push(line);
    }
    // Validation: verification steps
    else if (/\b(test(ed)?|confirmed?|verified?|validation|health probe|works? (now|fine)|success(ful)?|passed|checked)\b/i.test(lowerLine)) {
      sections.validation.push(line);
    }
    // Prevention: recommendations
    else if (/\b(prevent|avoid|recommend(ation)?|harden(ing)?|policy|monitor(ing)?|alert|standardize|best practice|ensure|always)\b/i.test(lowerLine)) {
      sections.prevention.push(line);
    }
    // Issue/Notes: everything else
    else {
      // If it's the first few lines, likely the issue description
      if (sections.issue.length < 3 && !line.match(/^[-*•]\s/)) {
        sections.issue.push(line);
      } else {
        sections.notes.push(line);
      }
    }
  }

  return sections;
}

/**
 * Convert parsed lines into Fix steps
 */
function buildFixSection(fixLines: string[]): string {
  if (fixLines.length === 0) {
    return '(No fix steps captured in incident notes.)';
  }

  // Build numbered steps
  return fixLines.map((line, index) => {
    // Remove leading bullets/numbers if present
    const cleanLine = line.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '');
    return `### Step ${index + 1}: ${cleanLine}`;
  }).join('\n\n');
}

/**
 * Build section content from lines
 */
function buildSection(lines: string[], asPlainText: boolean = false): string {
  if (lines.length === 0) {
    return '(No data captured in incident notes.)';
  }
  
  if (asPlainText) {
    // Join as paragraph for Issue and Root Cause
    return lines.join(' ').replace(/^[-*•]\s*/, '');
  }
  
  // Build as bullets for other sections
  return lines.map(line => `- ${line.replace(/^[-*•]\s*/, '')}`).join('\n');
}

/**
 * Generate MDX content with smart parsing
 */
function generateMDX(
  rawText: string,
  title?: string,
  category?: string,
  severity?: string
): { mdx: string; tags: string[]; warnings: string[] } {
  const warnings: string[] = [];
  
  // Extract tags from raw text
  const tags = extractTags(rawText);
  
  // Generate title if not provided
  const finalTitle = title || 'Azure Troubleshooting Guide';
  
  // Parse the raw text into sections
  const parsed = parseIncidentText(rawText);
  
  // Generate description from first issue or symptom
  const descriptionSource = parsed.issue[0] || parsed.symptoms[0] || rawText.trim().substring(0, 100);
  const description = descriptionSource.substring(0, 100).replace(/\n/g, ' ') + '...';
  
  // Get current date
  const date = new Date().toISOString().split('T')[0];
  
  // Set defaults
  const finalCategory = category || 'azure-troubleshooting';
  const finalSeverity = severity || 'Medium';
  
  // Build front matter
  const frontMatter = `---
title: "${finalTitle}"
description: "${description}"
date: "${date}"
tags: [${tags.map(tag => `"${tag}"`).join(', ')}]
category: "${finalCategory}"
severity: "${finalSeverity}"
---`;
  
  // Build body sections
  const body = `
## Issue

${buildSection(parsed.issue, true)}

## Symptoms

${buildSection(parsed.symptoms)}

## Root Cause

${buildSection(parsed.rootCause, true)}

## Fix

${buildFixSection(parsed.fix)}

## Validation

${buildSection(parsed.validation)}

## Prevention

${buildSection(parsed.prevention)}
${parsed.notes.length > 0 ? `\n## Notes\n\n${parsed.notes.join('\n')}` : ''}
`;
  
  const mdx = frontMatter + '\n' + body;
  
  // Validate the generated MDX
  const validation = validateMDX(mdx);
  if (validation.warnings.length > 0) {
    warnings.push(...validation.warnings);
  }
  
  return { mdx, tags, warnings };
}

/**
 * POST /api/convert
 * Convert raw text to MDX with auto-tagging
 */
export async function POST(request: NextRequest) {
  try {
    const body: ConvertRequest = await request.json();
    
    // Validate input
    if (!body.rawText || typeof body.rawText !== 'string') {
      return NextResponse.json(
        { error: 'rawText is required and must be a string' },
        { status: 400 }
      );
    }
    
    if (body.rawText.trim().length === 0) {
      return NextResponse.json(
        { error: 'rawText cannot be empty' },
        { status: 400 }
      );
    }
    
    // Generate MDX
    const result = generateMDX(
      body.rawText,
      body.title,
      body.category,
      body.severity
    );
    
    const response: ConvertResponse = {
      mdx: result.mdx,
      tags: result.tags,
      warnings: result.warnings
    };
    
    return NextResponse.json(response, { status: 200 });
    
  } catch (error) {
    console.error('Error in /api/convert:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
