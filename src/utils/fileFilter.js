const { minimatch } = require('minimatch');
const core = require('@actions/core');

/**
 * Determines if a file should be analyzed based on its properties and patterns
 * @param {string} filename - The name/path of the file
 * @param {string[]} includePatterns - Glob patterns for files to include
 * @param {string[]} excludePatterns - Glob patterns for files to exclude
 * @returns {boolean}
 */
function matchesPatterns(filename, includePatterns, excludePatterns) {
  // If no include patterns are specified, consider all files as included
  const isIncluded = includePatterns.length === 0 || includePatterns.some((pattern) => minimatch(filename, pattern));

  // Check if file matches any exclude pattern
  const isExcluded = excludePatterns.some((pattern) => minimatch(filename, pattern));

  return isIncluded && !isExcluded;
}

/**
 * Analyzes a file's changes to determine if it needs review
 * @param {Object} file - The file object from GitHub API
 * @returns {boolean}
 */
function hasSignificantChanges(file) {
  // Skip files that are deleted
  if (file.status === 'removed') {
    return false;
  }

  // Skip files that are too large
  const MAX_CHANGES = 1000;
  if (file.changes > MAX_CHANGES) {
    core.warning(`File ${file.filename} has too many changes (${file.changes}). Skipping.`);
    return false;
  }

  // Skip files that are just moves without changes
  if (file.status === 'renamed' && file.changes === 0) {
    return false;
  }

  return true;
}

/**
 * Filter files for analysis based on patterns and other criteria
 * @param {Object[]} files - Array of file objects from GitHub API
 * @param {Object} options - Filtering options
 * @returns {Object[]} Filtered array of files
 */
function filterFiles(files, options) {
  const { includePatterns = [], excludePatterns = [], maxFiles = 10 } = options;

  core.debug(`Filtering ${files.length} files`);
  core.debug(`Include patterns: ${includePatterns.join(', ')}`);
  core.debug(`Exclude patterns: ${excludePatterns.join(', ')}`);

  const filteredFiles = files
    .filter((file) => {
      const shouldAnalyze =
        matchesPatterns(file.filename, includePatterns, excludePatterns) && hasSignificantChanges(file);

      if (!shouldAnalyze) {
        core.debug(`Skipping ${file.filename}`);
      }

      return shouldAnalyze;
    })
    .sort((a, b) => {
      // Prioritize files with more changes
      return b.changes - a.changes;
    })
    .slice(0, maxFiles);

  core.info(`Selected ${filteredFiles.length} files for analysis`);
  filteredFiles.forEach((file) => {
    core.debug(`Will analyze: ${file.filename} (${file.changes} changes)`);
  });

  return filteredFiles;
}

module.exports = {
  filterFiles,
  matchesPatterns,
  hasSignificantChanges,
};