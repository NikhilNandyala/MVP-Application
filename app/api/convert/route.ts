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

  // Split into lines and analyze each
  const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
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
function buildSection(lines: string[]): string {
  if (lines.length === 0) {
    return '(No data captured in incident notes.)';
  }
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

${buildSection(parsed.issue)}

## Symptoms

${buildSection(parsed.symptoms)}

## Root Cause

${buildSection(parsed.rootCause)}

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
