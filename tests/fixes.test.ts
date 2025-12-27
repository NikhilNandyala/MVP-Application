/**
 * Unit tests for MDX parser fixes
 * Tests: frontmatter extraction, nested bullets, table separation, Fix section formatting
 */

// ==================== TEST CASE 1: FRONTMATTER EXTRACTION ====================

const TEST_FRONTMATTER_EXTRACTION = `---
title: "Resource Tagging Incident - Low Priority"
description: "Missing tags caused billing confusion"
date: "2025-11-15"
tags: ["Azure", "Cost Management", "Governance"]
category: "cost-optimization"
severity: "Low"
---

ISSUE
Resource tagging was inconsistent across subscriptions.

ROOT CAUSE
Tagging was treated as optional during resource creation.

RESOLUTION
STEP 1: DEFINE A TAGGING STANDARD
Created company-wide tagging policy.

VALIDATION
Verified all new resources have required tags.
`;

// ==================== TEST CASE 2: NESTED BULLETS ====================

const TEST_NESTED_BULLETS = `
ROOT CAUSE
Tagging was treated as optional during resource creation.

Because of this:
Resource ownership was unclear
Billing reports grouped all costs under "untagged"
Compliance audits failed due to missing metadata

This created downstream issues.
`;

// ==================== TEST CASE 3: TABLE AFTER BULLET ====================

const TEST_TABLE_AFTER_BULLET = `
ROOT CAUSE
Tagging was treated as optional during resource creation.
Service	Tags	Status
VM	None	Non-compliant
Storage	None	Non-compliant
`;

// ==================== TEST CASE 4: FIX SECTION WITH STEPS ====================

const TEST_FIX_STEPS = `
RESOLUTION
STEP 1: DEFINE A TAGGING STANDARD
Tag	Purpose	Required
Environment	Dev/Prod	Yes
CostCenter	Billing	Yes
Owner	Contact	Yes

STEP 2: ENFORCE TAGS USING AZURE POLICY
Created Azure Policy to deny resources without tags.

STEP 3: REMEDIATE EXISTING RESOURCES
Ran script to backfill tags on 500+ resources.
`;

// ==================== HELPER FUNCTIONS ====================

function extractFrontmatter(rawText: string): { frontmatter: Record<string, any> | null; contentWithoutFrontmatter: string } {
  const lines = rawText.split('\n');
  
  if (lines.length > 2 && lines[0].trim() === '---') {
    let endIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        endIndex = i;
        break;
      }
    }
    
    if (endIndex > 0) {
      const frontmatterLines = lines.slice(1, endIndex);
      const frontmatter: Record<string, any> = {};
      
      for (const line of frontmatterLines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim();
          let value = line.substring(colonIndex + 1).trim();
          value = value.replace(/^["']|["']$/g, '');
          
          if (value.startsWith('[') && value.endsWith(']')) {
            const arrayContent = value.substring(1, value.length - 1);
            frontmatter[key] = arrayContent.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
          } else {
            frontmatter[key] = value;
          }
        }
      }
      
      const contentWithoutFrontmatter = lines.slice(endIndex + 1).join('\n');
      return { frontmatter, contentWithoutFrontmatter };
    }
  }
  
  return { frontmatter: null, contentWithoutFrontmatter: rawText };
}

function buildNestedBullets(lines: string[]): string {
  const result: string[] = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Check for hierarchy marker
    const hierarchyMatch = line.match(/^(.*?):\s*$/);
    if (hierarchyMatch && i + 1 < lines.length) {
      result.push(`- ${hierarchyMatch[1]}:`);
      i++;
      
      // Add nested items
      while (i < lines.length && !lines[i].match(/^(.*?):\s*$/)) {
        const nestedLine = lines[i].trim();
        if (nestedLine.length > 0) {
          result.push(`  - ${nestedLine}`);
        }
        i++;
      }
      continue;
    }
    
    if (line.length > 0) {
      result.push(`- ${line}`);
    }
    i++;
  }
  
  return result.join('\n');
}

function ensureTableSeparation(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // If this is a table line
    if (line.trim().startsWith('|')) {
      // Check if previous line was a bullet
      if (result.length > 0 && result[result.length - 1].trim().startsWith('-')) {
        result.push(''); // Add blank line
      }
    }
    
    result.push(line);
  }
  
  return result.join('\n');
}

function parseFixSteps(fixContent: string): string {
  const lines = fixContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const result: string[] = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    
    // Check for step heading
    const stepMatch = line.match(/^(?:STEP\s*\d+:\s*)(.+?)$/i);
    
    if (stepMatch) {
      const heading = stepMatch[1].trim();
      result.push(`### ${heading}`);
      result.push('');
      i++;
      
      // Add content until next step or table end
      while (i < lines.length && !lines[i].match(/^(?:STEP\s*\d+:)/i)) {
        result.push(lines[i]);
        i++;
      }
      result.push('');
    } else {
      i++;
    }
  }
  
  return result.join('\n');
}

// ==================== TESTS ====================

function testFrontmatterExtraction() {
  console.log('=== Test 1: Frontmatter Extraction ===\n');
  
  const { frontmatter, contentWithoutFrontmatter } = extractFrontmatter(TEST_FRONTMATTER_EXTRACTION);
  
  console.log('Extracted Frontmatter:');
  console.log(JSON.stringify(frontmatter, null, 2));
  console.log('');
  
  // Verify all fields preserved
  const hasTitleCorrect = frontmatter?.title === 'Resource Tagging Incident - Low Priority';
  const hasDateCorrect = frontmatter?.date === '2025-11-15';
  const hasSeverityLow = frontmatter?.severity === 'Low';
  const hasRichTags = Array.isArray(frontmatter?.tags) && frontmatter.tags.length === 3;
  
  console.log('✓ Title preserved:', hasTitleCorrect);
  console.log('✓ Date preserved (not today):', hasDateCorrect);
  console.log('✓ Severity preserved as Low:', hasSeverityLow);
  console.log('✓ Tags array preserved:', hasRichTags);
  console.log('');
  
  console.log('Content without frontmatter:');
  console.log(contentWithoutFrontmatter.substring(0, 100) + '...');
  console.log('');
  
  if (hasTitleCorrect && hasDateCorrect && hasSeverityLow && hasRichTags) {
    console.log('✅ PASS: Frontmatter extracted correctly\n');
  } else {
    console.log('❌ FAIL: Frontmatter extraction issues\n');
  }
}

function testNestedBullets() {
  console.log('=== Test 2: Nested Bullets ===\n');
  
  const lines = [
    'Tagging was treated as optional during resource creation.',
    '',
    'Because of this:',
    'Resource ownership was unclear',
    'Billing reports grouped all costs under "untagged"',
    'Compliance audits failed due to missing metadata',
    '',
    'This created downstream issues.'
  ];
  
  const result = buildNestedBullets(lines);
  
  console.log('Output:');
  console.log(result);
  console.log('');
  
  const hasParentBullet = result.includes('- Because of this:');
  const hasNestedBullets = result.includes('  - Resource ownership was unclear');
  const hasProperIndentation = result.split('\n').filter(l => l.startsWith('  -')).length === 3;
  
  console.log('✓ Parent bullet created:', hasParentBullet);
  console.log('✓ Nested bullets created:', hasNestedBullets);
  console.log('✓ Proper indentation (2 spaces):', hasProperIndentation);
  console.log('');
  
  if (hasParentBullet && hasNestedBullets && hasProperIndentation) {
    console.log('✅ PASS: Nested bullets formatted correctly\n');
  } else {
    console.log('❌ FAIL: Nested bullet formatting issues\n');
  }
}

function testTableSeparation() {
  console.log('=== Test 3: Table Separation ===\n');
  
  const content = `- Tagging was treated as optional during resource creation.
| Service | Tags | Status |`;
  
  const result = ensureTableSeparation(content);
  
  console.log('Input:');
  console.log(content);
  console.log('');
  console.log('Output:');
  console.log(result);
  console.log('');
  
  const hasBlankLine = result.includes('creation.\n\n|');
  const tableNotInBullet = !result.includes('- |');
  
  console.log('✓ Blank line before table:', hasBlankLine);
  console.log('✓ Table not attached to bullet:', tableNotInBullet);
  console.log('');
  
  if (hasBlankLine && tableNotInBullet) {
    console.log('✅ PASS: Table properly separated from bullets\n');
  } else {
    console.log('❌ FAIL: Table separation issues\n');
  }
}

function testFixSteps() {
  console.log('=== Test 4: Fix Section Formatting ===\n');
  
  const result = parseFixSteps(TEST_FIX_STEPS);
  
  console.log('Output:');
  console.log(result.substring(0, 300));
  console.log('...\n');
  
  const hasCleanHeading1 = result.includes('### DEFINE A TAGGING STANDARD');
  const hasCleanHeading2 = result.includes('### ENFORCE TAGS USING AZURE POLICY');
  const hasCleanHeading3 = result.includes('### REMEDIATE EXISTING RESOURCES');
  const noDuplicateStep = !result.includes('STEP 1: STEP 1:') && !result.includes('### STEP 1:');
  
  console.log('✓ Clean heading 1:', hasCleanHeading1);
  console.log('✓ Clean heading 2:', hasCleanHeading2);
  console.log('✓ Clean heading 3:', hasCleanHeading3);
  console.log('✓ No duplicate "STEP" prefix:', noDuplicateStep);
  console.log('');
  
  if (hasCleanHeading1 && hasCleanHeading2 && hasCleanHeading3 && noDuplicateStep) {
    console.log('✅ PASS: Fix steps formatted correctly\n');
  } else {
    console.log('❌ FAIL: Fix step formatting issues\n');
  }
}

// ==================== TEST RUNNER ====================

function runAllTests() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  MDX Parser Fixes Test Suite                  ║');
  console.log('╚════════════════════════════════════════════════╝\n');
  
  testFrontmatterExtraction();
  testNestedBullets();
  testTableSeparation();
  testFixSteps();
  
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  All Tests Completed                          ║');
  console.log('╚════════════════════════════════════════════════╝');
}

// Export test cases
export const TEST_CASES = {
  frontmatterExtraction: TEST_FRONTMATTER_EXTRACTION,
  nestedBullets: TEST_NESTED_BULLETS,
  tableAfterBullet: TEST_TABLE_AFTER_BULLET,
  fixSteps: TEST_FIX_STEPS
};

// Run tests if executed directly
if (require.main === module) {
  runAllTests();
}
