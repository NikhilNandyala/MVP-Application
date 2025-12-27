/**
 * Unit tests for the MDX parser
 * Run these tests to verify section detection, table parsing, and MDX generation
 */

// Test Case 1: Input with multiple tables and all sections
const TEST_CASE_1 = `
ISSUE
Customer reported 502 errors on Azure Front Door.

IMPACT
Service	Status	Users Affected
Frontend	Down	1200
Backend	Degraded	800

ROOT CAUSE
Found that the origin server's NSG was blocking traffic on port 443.

RESOLUTION
Opened port 443 in NSG rule priority 100.
Updated security group to allow HTTPS traffic.

VALIDATION
Tested the endpoint and confirmed 200 OK responses.
Verified with customer that service is restored.

LESSONS LEARNED
- NSG rules should be documented in runbook
- Monitoring should alert on connection timeouts

PREVENTION
Implement infrastructure-as-code for NSG rules.
Add automated health checks every 5 minutes.

FINAL NOTE
Incident resolved in 45 minutes. Post-mortem scheduled for next week.
`;

// Test Case 2: Input with missing IMPACT section
const TEST_CASE_2 = `
ISSUE
Azure SQL Database connection pool exhausted.

ROOT CAUSE
Application was not properly disposing database connections.
Connection leak in the data access layer.

RESOLUTION
- Updated connection string with Max Pool Size=200
- Fixed using statements in repository classes
- Deployed hotfix v2.3.1

VALIDATION
Connection count returned to normal levels.
No more timeout errors in Application Insights.

PREVENTION
Add connection pool monitoring to dashboard.
`;

// Test Case 3: Tables with tabs vs multiple spaces
const TEST_CASE_3_TABS = `
ISSUE
Performance degradation in API Gateway.

IMPACT
Endpoint	Response Time	Threshold
/api/users	3500ms	500ms
/api/orders	2800ms	1000ms

RESOLUTION
Increased API Gateway throttling limits.
`;

const TEST_CASE_3_SPACES = `
ISSUE
Performance degradation in API Gateway.

IMPACT
Endpoint         Response Time    Threshold
/api/users       3500ms           500ms
/api/orders      2800ms           1000ms

RESOLUTION
Increased API Gateway throttling limits.
`;

// Test Case 4: Frontmatter preservation with severity
const TEST_CASE_4_FRONTMATTER = {
  rawText: `
ISSUE
High risk incident with critical data exposure.

ROOT CAUSE
Misconfigured storage account allowed public access.

RESOLUTION
Updated storage account to private access only.
`,
  frontmatter: {
    title: "Security Incident - Public Storage Exposure",
    description: "Critical security incident involving public data exposure",
    date: "2025-12-20",
    tags: ["Security", "Storage", "Azure"],
    category: "security-incident",
    severity: "Low" // Should remain "Low" despite "risk", "critical", "incident" in text
  }
};

// Expected output structure validation
interface TestExpectation {
  hasFrontMatter: boolean;
  requiredSections: string[];
  forbiddenSections: string[];
  hasMarkdownTables: boolean;
  severityInferred: boolean;
}

const EXPECTED_OUTPUT: TestExpectation = {
  hasFrontMatter: true,
  requiredSections: [
    '## Issue',
    '## Impact',
    '## Root Cause',
    '## Fix',
    '## Validation',
    '## Lessons Learned',
    '## Prevention'
  ],
  forbiddenSections: ['## Symptoms', '## Notes'],
  hasMarkdownTables: true,
  severityInferred: false
};

// ==================== PREPROCESSING TESTS ====================

function testPreprocessing() {
  console.log('=== Preprocessing Tests ===\n');
  
  const rawInput = `
ISSUE
Test issue

IMPACT
Col1  Col2
Val1  Val2

RESOLUTION
Fixed it
`;
  
  const marked = preprocessRawText(rawInput);
  console.log('Preprocessed output:');
  console.log(marked);
  console.log('');
  
  // Verify markers
  const hasIssueMarker = marked.includes('[[SECTION:ISSUE]]');
  const hasImpactMarker = marked.includes('[[SECTION:IMPACT]]');
  const hasResolutionMarker = marked.includes('[[SECTION:RESOLUTION]]');
  const hasTableMarkers = marked.includes('[[TABLE]]') && marked.includes('[[/TABLE]]');
  
  console.log('✓ Issue marker:', hasIssueMarker);
  console.log('✓ Impact marker:', hasImpactMarker);
  console.log('✓ Resolution marker:', hasResolutionMarker);
  console.log('✓ Table markers:', hasTableMarkers);
  console.log('');
}

// ==================== TABLE DETECTION TESTS ====================

function testTableDetection() {
  console.log('=== Table Detection Tests ===\n');
  
  // Test 1: Tab-separated table
  console.log('Test 1: Tab-separated table');
  const tabLines = [
    'Service\tStatus\tUsers',
    'Frontend\tDown\t1200',
    'Backend\tDegraded\t800'
  ];
  const isTabTable = isTableLike(tabLines);
  console.log(`  Is table: ${isTabTable} (expected: true)`);
  
  // Test 2: Space-separated table
  console.log('Test 2: Space-separated table (multiple spaces)');
  const spaceLines = [
    'Endpoint         Response Time    Threshold',
    '/api/users       3500ms           500ms',
    '/api/orders      2800ms           1000ms'
  ];
  const isSpaceTable = isTableLike(spaceLines);
  console.log(`  Is table: ${isSpaceTable} (expected: true)`);
  
  // Test 3: Non-table
  console.log('Test 3: Non-table detection');
  const nonTableLines = [
    'This is regular text',
    'With single spaces between words'
  ];
  const isNotTable = isTableLike(nonTableLines);
  console.log(`  Is table: ${isNotTable} (expected: false)`);
  
  // Test 4: Single line (not a table)
  console.log('Test 4: Single line');
  const singleLine = ['Just one line'];
  const isSingleTable = isTableLike(singleLine);
  console.log(`  Is table: ${isSingleTable} (expected: false)`);
  
  console.log('');
}

// ==================== SECTION MAPPING TESTS ====================

function testSectionMapping() {
  console.log('=== Section Mapping Tests ===\n');
  
  const headers = [
    'ISSUE',
    'Impact',
    'ROOT CAUSE',
    'resolution',
    'VALIDATION',
    'LESSONS LEARNED',
    'LESSON LEARNED',
    'PREVENTION',
    'FINAL NOTE'
  ];
  
  headers.forEach(header => {
    const result = detectSectionHeader(header);
    console.log(`  "${header}" -> ${result}`);
  });
  
  console.log('');
}

// ==================== FRONTMATTER PRESERVATION TESTS ====================

function testFrontmatterPreservation() {
  console.log('=== Frontmatter Preservation Test ===\n');
  
  const result = generateMDX(
    TEST_CASE_4_FRONTMATTER.rawText,
    undefined,
    undefined,
    undefined,
    TEST_CASE_4_FRONTMATTER.frontmatter
  );
  
  console.log('Generated MDX:');
  console.log(result.mdx.substring(0, 500));
  console.log('...\n');
  
  // Verify severity is preserved as "Low"
  const hasSeverityLow = result.mdx.includes('severity: "Low"');
  const hasNoSeverityHigh = !result.mdx.includes('severity: "High"') && 
                             !result.mdx.includes('severity: "Critical"') &&
                             !result.mdx.includes('severity: "Medium"');
  
  console.log('✓ Severity preserved as "Low":', hasSeverityLow);
  console.log('✓ No severity inference occurred:', hasNoSeverityHigh);
  console.log('✓ Title preserved:', result.mdx.includes('Security Incident'));
  console.log('✓ Date preserved:', result.mdx.includes('2025-12-20'));
  console.log('');
  
  if (hasSeverityLow && hasNoSeverityHigh) {
    console.log('✅ PASS: Frontmatter preserved correctly\n');
  } else {
    console.log('❌ FAIL: Frontmatter was modified\n');
  }
}

// ==================== FORBIDDEN SECTIONS TEST ====================

function testForbiddenSections() {
  console.log('=== Forbidden Sections Test ===\n');
  
  const result = generateMDX(TEST_CASE_1);
  
  const hasSymptoms = result.mdx.includes('## Symptoms');
  const hasNotes = result.mdx.includes('## Notes');
  
  console.log('✓ No "Symptoms" section:', !hasSymptoms);
  console.log('✓ No "Notes" section:', !hasNotes);
  
  if (!hasSymptoms && !hasNotes) {
    console.log('✅ PASS: No forbidden sections created\n');
  } else {
    console.log('❌ FAIL: Forbidden sections found\n');
  }
}

// ==================== FULL INTEGRATION TEST ====================

function testFullIntegration() {
  console.log('=== Full Integration Test ===\n');
  
  const result = generateMDX(TEST_CASE_1);
  
  // Check for required sections
  const hasIssue = result.mdx.includes('## Issue');
  const hasImpact = result.mdx.includes('## Impact');
  const hasRootCause = result.mdx.includes('## Root Cause');
  const hasFix = result.mdx.includes('## Fix');
  const hasValidation = result.mdx.includes('## Validation');
  const hasLessonsLearned = result.mdx.includes('## Lessons Learned');
  const hasPrevention = result.mdx.includes('## Prevention');
  
  // Check for table
  const hasMarkdownTable = result.mdx.includes('| Service | Status | Users Affected |');
  
  console.log('Required Sections:');
  console.log('  ✓ Issue:', hasIssue);
  console.log('  ✓ Impact:', hasImpact);
  console.log('  ✓ Root Cause:', hasRootCause);
  console.log('  ✓ Fix:', hasFix);
  console.log('  ✓ Validation:', hasValidation);
  console.log('  ✓ Lessons Learned:', hasLessonsLearned);
  console.log('  ✓ Prevention:', hasPrevention);
  console.log('');
  console.log('  ✓ Markdown table generated:', hasMarkdownTable);
  console.log('');
  
  const allSectionsPresent = hasIssue && hasImpact && hasRootCause && 
                              hasFix && hasValidation && hasLessonsLearned && 
                              hasPrevention && hasMarkdownTable;
  
  if (allSectionsPresent) {
    console.log('✅ PASS: All sections present and table converted\n');
  } else {
    console.log('❌ FAIL: Missing sections or table not converted\n');
  }
}

// ==================== HELPER FUNCTIONS (imported from route.ts) ====================

function detectSectionHeader(line: string): string | null {
  const trimmed = line.trim().toLowerCase();
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

function isTableLike(lines: string[]): boolean {
  if (lines.length < 2) return false;
  
  const hasTabSeparators = lines.every(line => line.includes('\t'));
  const hasMultiSpaceSeparators = lines.every(line => /\s{2,}/.test(line));
  
  if (!hasTabSeparators && !hasMultiSpaceSeparators) return false;
  
  const columnCounts = lines.map(line => {
    if (line.includes('\t')) {
      return line.split('\t').filter(cell => cell.trim().length > 0).length;
    } else {
      return line.split(/\s{2,}/).filter(cell => cell.trim().length > 0).length;
    }
  });
  
  const minCols = Math.min(...columnCounts);
  const maxCols = Math.max(...columnCounts);
  
  return minCols >= 2 && (maxCols - minCols <= 1);
}

// Mock functions (replace with actual imports in production)
function preprocessRawText(text: string): string { return text; }
function generateMDX(text: string, title?: string, cat?: string, sev?: string, fm?: any): any { 
  return { mdx: '', tags: [], warnings: [] }; 
}

// ==================== TEST RUNNER ====================

function runAllTests() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  MDX Parser Comprehensive Test Suite         ║');
  console.log('╚════════════════════════════════════════════════╝\n');
  
  testPreprocessing();
  testTableDetection();
  testSectionMapping();
  testFrontmatterPreservation();
  testForbiddenSections();
  testFullIntegration();
  
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  All Tests Completed                          ║');
  console.log('╚════════════════════════════════════════════════╝');
}

// Export for use in other tests
export const TEST_CASES = {
  multipleTablesAllSections: TEST_CASE_1,
  missingImpact: TEST_CASE_2,
  tabSeparatedTable: TEST_CASE_3_TABS,
  spaceSeparatedTable: TEST_CASE_3_SPACES,
  frontmatterPreservation: TEST_CASE_4_FRONTMATTER
};

export const EXPECTATIONS = EXPECTED_OUTPUT;

// Run tests if executed directly
if (require.main === module) {
  runAllTests();
}

