import { NextRequest, NextResponse } from 'next/server';
import { extractTags } from '@/lib/mdx/tagger';
import { validateMDX } from '@/lib/mdx/validator';

interface ConvertRequest {
  rawText: string;
  title?: string;
  category?: string;
  severity?: string;
  frontmatter?: Record<string, any>; // Allow passing existing frontmatter
}

interface ConvertResponse {
  mdx: string;
  tags: string[];
  warnings: string[];
}

interface ParsedSections {
  issue: string[];
  impact: string[];
  rootCause: string[];
  fix: string[];
  validation: string[];
  lessonsLearned: string[];
  prevention: string[];
  finalNote: string[];
}

/**
 * Preprocess raw text to add machine-safe markers
 */
function preprocessRawText(rawText: string): string {
  const lines = rawText.split('\n');
  const result: string[] = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Skip empty lines
    if (trimmed.length === 0) {
      result.push(line);
      i++;
      continue;
    }
    
    // Check for section header
    const sectionKey = detectSectionHeader(line);
    if (sectionKey) {
      // Convert to marker
      const markerMap: Record<string, string> = {
        'issue': 'ISSUE',
        'impact': 'IMPACT',
        'rootCause': 'ROOT_CAUSE',
        'fix': 'RESOLUTION',
        'validation': 'VALIDATION',
        'lessonsLearned': 'LESSONS_LEARNED',
        'prevention': 'PREVENTION',
        'finalNote': 'FINAL_NOTE'
      };
      result.push(`[[SECTION:${markerMap[sectionKey]}]]`);
      i++;
      continue;
    }
    
    // Look ahead for table
    const lookAheadLines: string[] = [trimmed];
    let j = i + 1;
    
    while (j < lines.length) {
      const nextLine = lines[j].trim();
      if (nextLine.length === 0) break;
      if (detectSectionHeader(lines[j])) break;
      lookAheadLines.push(nextLine);
      j++;
    }
    
    // Check if this is a table
    if (isTableLike(lookAheadLines)) {
      result.push('[[TABLE]]');
      for (let k = i; k < j; k++) {
        result.push(lines[k].trim());
      }
      result.push('[[/TABLE]]');
      i = j;
      continue;
    }
    
    // Regular line
    result.push(line);
    i++;
  }
  
  return result.join('\n');
}

/**
 * Parse preprocessed text with markers into sections
 */
function parseMarkedText(markedText: string): ParsedSections {
  const sections: ParsedSections = {
    issue: [],
    impact: [],
    rootCause: [],
    fix: [],
    validation: [],
    lessonsLearned: [],
    prevention: [],
    finalNote: []
  };
  
  const markerToSection: Record<string, keyof ParsedSections> = {
    'ISSUE': 'issue',
    'IMPACT': 'impact',
    'ROOT_CAUSE': 'rootCause',
    'RESOLUTION': 'fix',
    'VALIDATION': 'validation',
    'LESSONS_LEARNED': 'lessonsLearned',
    'PREVENTION': 'prevention',
    'FINAL_NOTE': 'finalNote'
  };
  
  const lines = markedText.split('\n');
  let currentSection: keyof ParsedSections | null = null;
  let inTable = false;
  let tableLines: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Section marker
    const sectionMatch = trimmed.match(/^\[\[SECTION:(\w+)\]\]$/);
    if (sectionMatch) {
      currentSection = markerToSection[sectionMatch[1]] || null;
      continue;
    }
    
    // Table start
    if (trimmed === '[[TABLE]]') {
      inTable = true;
      tableLines = [];
      continue;
    }
    
    // Table end
    if (trimmed === '[[/TABLE]]') {
      inTable = false;
      if (currentSection && tableLines.length > 0) {
        const table = linesToMarkdownTable(tableLines);
        sections[currentSection].push(table);
      }
      continue;
    }
    
    // Inside table
    if (inTable) {
      if (trimmed.length > 0) {
        tableLines.push(trimmed);
      }
      continue;
    }
    
    // Regular content
    if (trimmed.length > 0 && currentSection) {
      sections[currentSection].push(trimmed);
    }
  }
  
  return sections;
}

/**
 * Detect section headers and map to section keys
 */
function detectSectionHeader(line: string): keyof ParsedSections | null {
  const trimmed = line.trim().toLowerCase();
  
  // Remove common prefixes/suffixes
  const cleaned = trimmed.replace(/^#+\s*/, '').replace(/[:：]\s*$/, '');
  
  if (cleaned === 'issue') return 'issue';
  if (cleaned === 'impact') return 'impact';
  if (cleaned === 'root cause') return 'rootCause';
  if (cleaned === 'resolution' || cleaned === 'fix') return 'fix';
  if (cleaned === 'validation') return 'validation';
  if (cleaned === 'lesson learned' || cleaned === 'lessons learned') return 'lessonsLearned';
  if (cleaned === 'prevention') return 'prevention';
  if (cleaned === 'final note' || cleaned === 'final notes') return 'finalNote';
  
  return null;
}

/**
 * Detect if lines form a table (tab or multi-space separated)
 */
function isTableLike(lines: string[]): boolean {
  if (lines.length < 2) return false;
  
  // Check if lines have consistent column structure
  const hasTabSeparators = lines.every(line => line.includes('\t'));
  const hasMultiSpaceSeparators = lines.every(line => /\s{2,}/.test(line));
  
  if (!hasTabSeparators && !hasMultiSpaceSeparators) return false;
  
  // Parse columns for each line
  const columnCounts = lines.map(line => {
    if (line.includes('\t')) {
      return line.split('\t').filter(cell => cell.trim().length > 0).length;
    } else {
      return line.split(/\s{2,}/).filter(cell => cell.trim().length > 0).length;
    }
  });
  
  // Must have at least 2 columns and consistent column counts (within 1 column variance)
  const minCols = Math.min(...columnCounts);
  const maxCols = Math.max(...columnCounts);
  
  return minCols >= 2 && (maxCols - minCols <= 1);
}

/**
 * Convert lines to Markdown table
 */
function linesToMarkdownTable(lines: string[]): string {
  const rows: string[][] = [];
  
  for (const line of lines) {
    let cells: string[];
    
    if (line.includes('\t')) {
      cells = line.split('\t').map(c => c.trim());
    } else {
      cells = line.split(/\s{2,}/).map(c => c.trim());
    }
    
    rows.push(cells);
  }
  
  if (rows.length === 0) return '';
  
  // Normalize column count
  const maxCols = Math.max(...rows.map(r => r.length));
  const normalizedRows = rows.map(row => {
    while (row.length < maxCols) row.push('');
    return row.slice(0, maxCols);
  });
  
  // Build Markdown table
  const header = normalizedRows[0];
  const dataRows = normalizedRows.slice(1);
  
  const headerLine = `| ${header.join(' | ')} |`;
  const separatorLine = `| ${header.map(() => '---').join(' | ')} |`;
  const dataLines = dataRows.map(row => `| ${row.join(' | ')} |`);
  
  return [headerLine, separatorLine, ...dataLines].join('\n');
}

/**
 * Smart parser with strict section header detection (legacy - use parseMarkedText instead)
 */
function parseIncidentText(rawText: string): ParsedSections {
  // Use preprocessing pipeline
  const markedText = preprocessRawText(rawText);
  return parseMarkedText(markedText);
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
 * Build section content from lines (preserves tables, bullets, and paragraph formatting)
 */
function buildSection(lines: string[]): string {
  if (lines.length === 0) {
    return '(No data captured in incident notes.)';
  }
  
  const result: string[] = [];
  
  for (const line of lines) {
    // If it's already a Markdown table, add as-is
    if (line.startsWith('|')) {
      result.push(line);
      continue;
    }
    
    // If it's already a bullet or numbered list, preserve it
    if (/^[-*•]\s/.test(line) || /^\d+\.\s/.test(line)) {
      result.push(line);
      continue;
    }
    
    // Otherwise, add as bullet
    result.push(`- ${line}`);
  }
  
  return result.join('\n');
}

/**
 * Generate MDX content with strict section-based parsing
 * Preserves existing frontmatter if provided, never infers values
 */
function generateMDX(
  rawText: string,
  title?: string,
  category?: string,
  severity?: string,
  existingFrontmatter?: Record<string, any>
): { mdx: string; tags: string[]; warnings: string[] } {
  const warnings: string[] = [];
  
  // If frontmatter exists, use it as-is
  if (existingFrontmatter) {
    // Parse the raw text into sections
    const parsed = parseIncidentText(rawText);
    
    // Build frontmatter from existing
    const frontMatterLines = ['---'];
    for (const [key, value] of Object.entries(existingFrontmatter)) {
      if (Array.isArray(value)) {
        frontMatterLines.push(`${key}: [${value.map(v => `"${v}"`).join(', ')}]`);
      } else if (typeof value === 'string') {
        frontMatterLines.push(`${key}: "${value}"`);
      } else {
        frontMatterLines.push(`${key}: ${value}`);
      }
    }
    frontMatterLines.push('---');
    
    const frontMatter = frontMatterLines.join('\n');
    const body = buildBody(parsed);
    const mdx = frontMatter + '\n' + body;
    
    return { mdx, tags: existingFrontmatter.tags || [], warnings };
  }
  
  // Extract tags from raw text
  const tags = extractTags(rawText);
  
  // Parse the raw text into sections
  const parsed = parseIncidentText(rawText);
  
  // Generate title from Issue section if not provided
  let finalTitle = title;
  if (!finalTitle) {
    const issueText = parsed.issue.join(' ');
    const firstSentence = issueText.split(/[.!?]/)[0].trim();
    finalTitle = firstSentence.substring(0, 80) || 'Azure Troubleshooting Guide';
  }
  
  // Generate description from first 1-2 sentences of Issue
  const issueText = parsed.issue.join(' ');
  const sentences = issueText.split(/[.!?]/).filter(s => s.trim().length > 0);
  const description = sentences.slice(0, 2).join('. ').substring(0, 150) + '...';
  
  // Get current date
  const date = new Date().toISOString().split('T')[0];
  
  // Set defaults (severity ONLY if provided - never infer)
  const finalCategory = category || 'azure-troubleshooting';
  
  // Build front matter
  let frontMatter = `---
title: "${finalTitle}"
description: "${description}"
date: "${date}"
tags: [${tags.map(tag => `"${tag}"`).join(', ')}]
category: "${finalCategory}"`;
  
  if (severity) {
    frontMatter += `\nseverity: "${severity}"`;
  }
  
  frontMatter += '\n---';
  
  const body = buildBody(parsed);
  const mdx = frontMatter + '\n' + body;
  
  // Validate the generated MDX
  const validation = validateMDX(mdx);
  if (validation.warnings.length > 0) {
    warnings.push(...validation.warnings);
  }
  
  return { mdx, tags, warnings };
}

/**
 * Build body sections from parsed content
 */
function buildBody(parsed: ParsedSections): string {
  return `
## Issue

${buildSection(parsed.issue)}

## Impact

${buildSection(parsed.impact)}

## Root Cause

${buildSection(parsed.rootCause)}

## Fix

${buildFixSection(parsed.fix)}

## Validation

${buildSection(parsed.validation)}

## Lessons Learned

${buildSection(parsed.lessonsLearned)}

## Prevention

${parsed.prevention.length > 0 ? buildSection(parsed.prevention) : '(No prevention steps captured.)'}

${parsed.finalNote.length > 0 ? `## Final Note\n\n${buildSection(parsed.finalNote)}` : ''}
`;
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
      body.severity,
      body.frontmatter
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
