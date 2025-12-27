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
 * Extract existing frontmatter from raw text if present
 */
function extractFrontmatter(rawText: string): { frontmatter: Record<string, any> | null; contentWithoutFrontmatter: string } {
  const lines = rawText.split('\n');
  
  // Check if starts with ---
  if (lines.length > 2 && lines[0].trim() === '---') {
    // Find closing ---
    let endIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        endIndex = i;
        break;
      }
    }
    
    if (endIndex > 0) {
      // Parse YAML frontmatter
      const frontmatterLines = lines.slice(1, endIndex);
      const frontmatter: Record<string, any> = {};
      
      for (const line of frontmatterLines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim();
          let value = line.substring(colonIndex + 1).trim();
          
          // Remove quotes
          value = value.replace(/^["']|["']$/g, '');
          
          // Parse arrays
          if (value.startsWith('[') && value.endsWith(']')) {
            const arrayContent = value.substring(1, value.length - 1);
            frontmatter[key] = arrayContent.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
          } else {
            frontmatter[key] = value;
          }
        }
      }
      
      // Return content without frontmatter
      const contentWithoutFrontmatter = lines.slice(endIndex + 1).join('\n');
      return { frontmatter, contentWithoutFrontmatter };
    }
  }
  
  return { frontmatter: null, contentWithoutFrontmatter: rawText };
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
 * Convert parsed lines into Fix steps with proper subheadings
 */
function buildFixSection(fixLines: string[]): string {
  if (fixLines.length === 0) {
    return '(No fix steps captured in incident notes.)';
  }

  const result: string[] = [];
  let i = 0;
  
  while (i < fixLines.length) {
    const line = fixLines[i];
    
    // Check if this is a step heading (e.g., "STEP 1: DEFINE A TAGGING STANDARD")
    const stepMatch = line.match(/^(?:STEP\s*\d+:\s*)?(.+?)$/i);
    
    if (stepMatch) {
      const content = stepMatch[1].trim();
      
      // Check if next line is a table
      const isFollowedByTable = i + 1 < fixLines.length && fixLines[i + 1].startsWith('|');
      
      if (isFollowedByTable || /^[A-Z][A-Za-z\s]+$/.test(content)) {
        // This is a step heading - convert to ### subheading
        result.push(`### ${content}`);
        result.push('');
        i++;
        
        // Add table if present
        while (i < fixLines.length && fixLines[i].startsWith('|')) {
          result.push(fixLines[i]);
          i++;
        }
        result.push('');
      } else {
        // Regular fix step
        const cleanLine = line.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '');
        result.push(`- ${cleanLine}`);
        i++;
      }
    } else {
      i++;
    }
  }
  
  return result.join('\n').trim();
}

/**
 * Build section content from lines (handles hierarchies, tables, bullets)
 */
function buildSection(lines: string[]): string {
  if (lines.length === 0) {
    return '(No data captured in incident notes.)';
  }
  
  const result: string[] = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    
    // If it's already a Markdown table, ensure proper spacing
    if (line.startsWith('|')) {
      // Check if previous line was a bullet - add blank line before table
      if (result.length > 0 && result[result.length - 1].startsWith('-')) {
        result.push('');
      }
      result.push(line);
      i++;
      continue;
    }
    
    // Check for hierarchy markers (e.g., "Because of this:")
    const hierarchyMatch = line.match(/^(.*?:)\s*$/);
    if (hierarchyMatch && i + 1 < lines.length && !lines[i + 1].startsWith('|')) {
      // This starts a nested structure
      result.push(`- ${hierarchyMatch[1]}`);
      i++;
      
      // Add nested items
      while (i < lines.length && !lines[i].startsWith('|') && !lines[i].match(/^(.*?):\s*$/)) {
        const nestedLine = lines[i];
        if (nestedLine.startsWith('-')) {
          result.push(`  ${nestedLine}`);
        } else {
          result.push(`  - ${nestedLine}`);
        }
        i++;
      }
      continue;
    }
    
    // If it's already a bullet or numbered list, preserve it
    if (/^[-*•]\s/.test(line) || /^\d+\.\s/.test(line)) {
      result.push(line);
      i++;
      continue;
    }
    
    // Otherwise, add as bullet
    result.push(`- ${line}`);
    i++;
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
  
  // Extract frontmatter from raw text if present
  const { frontmatter: extractedFrontmatter, contentWithoutFrontmatter } = extractFrontmatter(rawText);
  const actualFrontmatter = existingFrontmatter || extractedFrontmatter;
  
  // Use content without frontmatter for parsing
  const contentToParse = extractedFrontmatter ? contentWithoutFrontmatter : rawText;
  
  // If frontmatter exists, use it as-is
  if (actualFrontmatter) {
    // Parse the content into sections
    const parsed = parseIncidentText(contentToParse);
    
    // Build frontmatter from existing
    const frontMatterLines = ['---'];
    for (const [key, value] of Object.entries(actualFrontmatter)) {
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
    
    return { mdx, tags: actualFrontmatter.tags || [], warnings };
  }
  
  // Extract tags from raw text
  const tags = extractTags(contentToParse);
  
  // Parse the raw text into sections
  const parsed = parseIncidentText(contentToParse);
  
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
