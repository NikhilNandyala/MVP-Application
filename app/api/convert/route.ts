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

/**
 * Generate MDX content with front matter and structured sections
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
  
  // Generate description from first 100 chars of raw text
  const description = rawText.trim().substring(0, 100).replace(/\n/g, ' ') + '...';
  
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

[Brief description of the issue]

## Symptoms

[What the user is experiencing]

## Root Cause

[Technical explanation of what's causing the issue]

## Fix

[Step-by-step solution]

## Validation

[How to verify the fix worked]

## Prevention

[How to prevent this issue in the future]

## Notes

${rawText}
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
