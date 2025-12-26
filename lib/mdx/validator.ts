/**
 * MDX validation logic
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate MDX content structure and format
 */
export function validateMDX(mdxContent: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check if content is empty
  if (!mdxContent.trim()) {
    errors.push('MDX content is empty');
    return { isValid: false, errors, warnings };
  }
  
  // Check for front matter
  if (!mdxContent.trim().startsWith('---')) {
    errors.push('Front matter is missing (should start with ---)');
  }
  
  // Extract front matter
  const frontMatterMatch = mdxContent.match(/^---\n([\s\S]*?)\n---/);
  if (frontMatterMatch) {
    const frontMatter = frontMatterMatch[1];
    
    // Check required fields
    const requiredFields = ['title:', 'description:', 'date:', 'tags:', 'category:'];
    for (const field of requiredFields) {
      if (!frontMatter.includes(field)) {
        errors.push(`Front matter missing required field: ${field.replace(':', '')}`);
      }
    }
    
    // Validate date format
    const dateMatch = frontMatter.match(/date:\s*["']?(\d{4}-\d{2}-\d{2})["']?/);
    if (dateMatch) {
      const dateStr = dateMatch[1];
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        errors.push('Invalid date format (should be YYYY-MM-DD)');
      }
    }
    
    // Validate tags array
    if (frontMatter.includes('tags:')) {
      if (!frontMatter.match(/tags:\s*\[.*\]/)) {
        warnings.push('Tags should be formatted as an array [tag1, tag2]');
      }
    }
  } else if (mdxContent.trim().startsWith('---')) {
    errors.push('Front matter is not properly closed (missing closing ---)');
  }
  
  // Check for balanced code fences
  const codeFences = (mdxContent.match(/```/g) || []).length;
  if (codeFences % 2 !== 0) {
    errors.push(`Unbalanced code fences (found ${codeFences}, should be even)`);
  }
  
  // Check for common markdown issues
  const lines = mdxContent.split('\n');
  let inCodeBlock = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
    }
    
    if (!inCodeBlock) {
      // Check for unclosed inline code
      const backtickCount = (line.match(/`/g) || []).length;
      if (backtickCount % 2 !== 0 && !line.includes('```')) {
        warnings.push(`Line ${i + 1}: Possible unclosed inline code backtick`);
      }
    }
  }
  
  // Check for minimum content length
  const contentWithoutFrontMatter = mdxContent.replace(/^---\n[\s\S]*?\n---\n/, '');
  if (contentWithoutFrontMatter.trim().length < 50) {
    warnings.push('Content seems too short (less than 50 characters)');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
