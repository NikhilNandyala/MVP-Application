'use client';

import { useState } from 'react';
import { validateMDX } from '@/lib/mdx/validator';
import { generateFilename } from '@/lib/mdx/slug';

interface ConvertResponse {
  mdx: string;
  tags: string[];
  warnings: string[];
}

export default function Home() {
  const [rawText, setRawText] = useState('');
  const [mdxOutput, setMdxOutput] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('azure-troubleshooting');
  const [severity, setSeverity] = useState('Medium');
  const [tags, setTags] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleConvert = async () => {
    if (!rawText.trim()) {
      setWarnings(['Please enter some text to convert']);
      return;
    }

    setIsLoading(true);
    setWarnings([]);
    setValidationErrors([]);

    try {
      const response = await fetch('/api/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rawText,
          title: title.trim() || undefined,
          category,
          severity,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        setWarnings([error.error || 'Failed to convert']);
        return;
      }

      const data: ConvertResponse = await response.json();
      setMdxOutput(data.mdx);
      setTags(data.tags);
      setWarnings(data.warnings);
    } catch (error) {
      setWarnings(['Failed to convert: ' + (error instanceof Error ? error.message : 'Unknown error')]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidate = () => {
    if (!mdxOutput.trim()) {
      setValidationErrors(['No MDX content to validate']);
      return;
    }

    const result = validateMDX(mdxOutput);
    if (result.isValid) {
      setValidationErrors(['✓ MDX is valid!']);
    } else {
      setValidationErrors(result.errors);
    }
    if (result.warnings.length > 0) {
      setWarnings(result.warnings);
    }
  };

  const handleCopy = async () => {
    if (!mdxOutput.trim()) {
      setWarnings(['No MDX content to copy']);
      return;
    }

    try {
      await navigator.clipboard.writeText(mdxOutput);
      setWarnings(['✓ Copied to clipboard!']);
    } catch (error) {
      setWarnings(['Failed to copy to clipboard']);
    }
  };

  const handleDownload = () => {
    if (!mdxOutput.trim()) {
      setWarnings(['No MDX content to download']);
      return;
    }

    const filename = generateFilename(title || 'azure-guide');
    const blob = new Blob([mdxOutput], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="text-center py-6 mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-100 mb-2">
            MDX Blog Builder
          </h1>
          <p className="text-slate-400 text-sm sm:text-base">
            Convert raw text to structured MDX with auto-tagging
          </p>
        </header>

        {/* Input Controls */}
        <div className="bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 mb-6 border border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-slate-300 mb-2">
                Title (optional)
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Azure Troubleshooting Guide"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-slate-100 placeholder-slate-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-slate-300 mb-2">
                Category
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="azure-troubleshooting">Azure Troubleshooting</option>
                <option value="azure-guide">Azure Guide</option>
                <option value="azure-tutorial">Azure Tutorial</option>
                <option value="azure-best-practices">Azure Best Practices</option>
              </select>
            </div>
            <div>
              <label htmlFor="severity" className="block text-sm font-medium text-slate-300 mb-2">
                Severity
              </label>
              <select
                id="severity"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>

          {/* Auto-tags Display */}
          {tags.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Auto-detected Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-full text-sm font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mb-4">
            <button
              onClick={handleConvert}
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:bg-slate-600 disabled:cursor-not-allowed font-medium transition-colors shadow-sm"
            >
              {isLoading ? 'Converting...' : 'Convert'}
            </button>
            <button
              onClick={handleValidate}
              disabled={!mdxOutput.trim()}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md disabled:bg-slate-600 disabled:cursor-not-allowed font-medium transition-colors shadow-sm"
            >
              Validate
            </button>
            <button
              onClick={handleCopy}
              disabled={!mdxOutput.trim()}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md disabled:bg-slate-600 disabled:cursor-not-allowed font-medium transition-colors shadow-sm"
            >
              Copy
            </button>
            <button
              onClick={handleDownload}
              disabled={!mdxOutput.trim()}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md disabled:bg-slate-600 disabled:cursor-not-allowed font-medium transition-colors shadow-sm"
            >
              Download
            </button>
          </div>

          {/* Warnings & Errors */}
          {warnings.length > 0 && (
            <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-md">
              <h3 className="text-sm font-semibold text-yellow-400 mb-2">Warnings:</h3>
              <ul className="list-disc list-inside space-y-1">
                {warnings.map((warning, index) => (
                  <li key={index} className="text-sm text-yellow-300">
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {validationErrors.length > 0 && (
            <div className={`mt-4 p-4 rounded-md border ${
              validationErrors[0].startsWith('✓') 
                ? 'bg-green-900/20 border-green-700/50' 
                : 'bg-red-900/20 border-red-700/50'
            }`}>
              <h3 className={`text-sm font-semibold mb-2 ${
                validationErrors[0].startsWith('✓') 
                  ? 'text-green-400' 
                  : 'text-red-400'
              }`}>
                Validation Result:
              </h3>
              <ul className="list-disc list-inside space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index} className={`text-sm ${
                    validationErrors[0].startsWith('✓') 
                      ? 'text-green-300' 
                      : 'text-red-300'
                  }`}>
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Text Areas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Textarea */}
          <div className="bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 border border-slate-700">
            <label htmlFor="rawText" className="block text-lg font-semibold text-slate-100 mb-3">
              Raw Input
            </label>
            <textarea
              id="rawText"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste your raw troubleshooting notes or Azure documentation here..."
              className="w-full h-96 px-4 py-3 bg-slate-900 border border-slate-600 text-slate-100 placeholder-slate-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-none"
            />
          </div>

          {/* Output Textarea */}
          <div className="bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 border border-slate-700">
            <label htmlFor="mdxOutput" className="block text-lg font-semibold text-slate-100 mb-3">
              Generated MDX
            </label>
            <textarea
              id="mdxOutput"
              value={mdxOutput}
              readOnly
              placeholder="Generated MDX will appear here..."
              className="w-full h-96 px-4 py-3 bg-slate-900 border border-slate-600 text-slate-100 placeholder-slate-500 rounded-md font-mono text-sm resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center py-8 text-slate-500 text-sm mt-8">
          Built for Azure App Service • Node 22 LTS • Next.js App Router
        </footer>
      </div>
    </div>
  );
}
