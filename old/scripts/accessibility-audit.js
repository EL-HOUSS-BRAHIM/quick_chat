#!/usr/bin/env node

/**
 * Accessibility Audit Script
 * Automated accessibility testing for Quick Chat
 */

const fs = require('fs');
const path = require('path');

class AccessibilityAuditor {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.suggestions = [];
  }

  /**
   * Run accessibility audit
   */
  async audit() {
    console.log('🔍 Running accessibility audit...\n');

    // Check HTML files
    await this.auditHtmlFiles();

    // Check CSS files
    await this.auditCssFiles();

    // Check JavaScript files
    await this.auditJavaScriptFiles();

    // Generate report
    this.generateReport();
  }

  /**
   * Audit HTML files for accessibility issues
   */
  async auditHtmlFiles() {
    console.log('📄 Auditing HTML files...');

    const htmlFiles = this.findFiles('.', /\.php$|\.html$/);
    
    for (const file of htmlFiles) {
      const content = fs.readFileSync(file, 'utf8');
      this.auditHtmlContent(content, file);
    }
  }

  /**
   * Audit CSS files for accessibility issues
   */
  async auditCssFiles() {
    console.log('🎨 Auditing CSS files...');

    const cssFiles = this.findFiles('./assets/scss', /\.scss$/);
    
    for (const file of cssFiles) {
      const content = fs.readFileSync(file, 'utf8');
      this.auditCssContent(content, file);
    }
  }

  /**
   * Audit JavaScript files for accessibility issues
   */
  async auditJavaScriptFiles() {
    console.log('📜 Auditing JavaScript files...');

    const jsFiles = this.findFiles('./assets/js', /\.js$/);
    
    for (const file of jsFiles) {
      if (file.includes('node_modules') || file.includes('dist')) continue;
      
      const content = fs.readFileSync(file, 'utf8');
      this.auditJavaScriptContent(content, file);
    }
  }

  /**
   * Audit HTML content
   */
  auditHtmlContent(content, file) {
    // Check for missing alt attributes
    const imgTags = content.match(/<img[^>]*>/gi) || [];
    imgTags.forEach(tag => {
      if (!tag.includes('alt=')) {
        this.issues.push({
          type: 'Missing alt attribute',
          file,
          element: tag,
          severity: 'high'
        });
      }
    });

    // Check for missing labels
    const inputTags = content.match(/<input[^>]*>/gi) || [];
    inputTags.forEach(tag => {
      if (!tag.includes('aria-label') && !tag.includes('aria-labelledby')) {
        // Check if there's an associated label
        const id = tag.match(/id="([^"]*)"/) || tag.match(/id='([^']*)'/);
        if (!id || !content.includes(`for="${id[1]}"`)) {
          this.warnings.push({
            type: 'Input without label',
            file,
            element: tag,
            severity: 'medium'
          });
        }
      }
    });

    // Check for heading hierarchy
    const headings = content.match(/<h[1-6][^>]*>/gi) || [];
    let lastLevel = 0;
    headings.forEach(heading => {
      const level = parseInt(heading.charAt(2));
      if (level > lastLevel + 1) {
        this.warnings.push({
          type: 'Heading hierarchy skip',
          file,
          element: heading,
          severity: 'medium'
        });
      }
      lastLevel = level;
    });

    // Check for missing lang attribute
    if (content.includes('<html') && !content.includes('lang=')) {
      this.issues.push({
        type: 'Missing lang attribute',
        file,
        severity: 'high'
      });
    }

    // Check for missing page title
    if (content.includes('<head>') && !content.includes('<title>')) {
      this.issues.push({
        type: 'Missing page title',
        file,
        severity: 'high'
      });
    }
  }

  /**
   * Audit CSS content
   */
  auditCssContent(content, file) {
    // Check for sufficient color contrast
    const colorPatterns = content.match(/color:\s*#[0-9a-fA-F]{3,6}/gi) || [];
    colorPatterns.forEach(color => {
      this.suggestions.push({
        type: 'Color contrast check needed',
        file,
        element: color,
        severity: 'low',
        message: 'Verify color contrast meets WCAG guidelines (4.5:1 for normal text, 3:1 for large text)'
      });
    });

    // Check for focus styles
    if (!content.includes(':focus') && !content.includes('focus-visible')) {
      this.warnings.push({
        type: 'Missing focus styles',
        file,
        severity: 'medium',
        message: 'Consider adding focus styles for keyboard navigation'
      });
    }

    // Check for reduced motion support
    if (!content.includes('@media (prefers-reduced-motion')) {
      this.suggestions.push({
        type: 'Missing reduced motion support',
        file,
        severity: 'low',
        message: 'Consider adding support for users who prefer reduced motion'
      });
    }

    // Check for minimum touch target size
    const buttonStyles = content.match(/\.button[^{]*{[^}]*}/gi) || [];
    buttonStyles.forEach(style => {
      if (!style.includes('min-height') && !style.includes('padding')) {
        this.suggestions.push({
          type: 'Touch target size check',
          file,
          element: style,
          severity: 'low',
          message: 'Ensure touch targets are at least 44x44px'
        });
      }
    });
  }

  /**
   * Audit JavaScript content
   */
  auditJavaScriptContent(content, file) {
    // Check for ARIA attribute management
    if (content.includes('setAttribute') && !content.includes('aria-')) {
      this.suggestions.push({
        type: 'Consider ARIA attributes',
        file,
        severity: 'low',
        message: 'When dynamically changing content, consider updating ARIA attributes'
      });
    }

    // Check for keyboard event handlers
    const clickHandlers = (content.match(/addEventListener\s*\(\s*['"]click['"]/gi) || []).length;
    const keyHandlers = (content.match(/addEventListener\s*\(\s*['"]key/gi) || []).length;
    
    if (clickHandlers > 0 && keyHandlers === 0) {
      this.warnings.push({
        type: 'Missing keyboard handlers',
        file,
        severity: 'medium',
        message: 'Interactive elements should be keyboard accessible'
      });
    }

    // Check for focus management
    if (content.includes('modal') || content.includes('dialog')) {
      if (!content.includes('focus()') && !content.includes('trapFocus')) {
        this.warnings.push({
          type: 'Missing focus management',
          file,
          severity: 'medium',
          message: 'Modals and dialogs should manage focus properly'
        });
      }
    }

    // Check for screen reader announcements
    if (content.includes('dynamically') || content.includes('ajax') || content.includes('fetch')) {
      if (!content.includes('aria-live') && !content.includes('announce')) {
        this.suggestions.push({
          type: 'Consider screen reader announcements',
          file,
          severity: 'low',
          message: 'Dynamic content changes should be announced to screen readers'
        });
      }
    }
  }

  /**
   * Find files matching pattern
   */
  findFiles(dir, pattern) {
    const files = [];
    
    const walk = (currentDir) => {
      const items = fs.readdirSync(currentDir);
      
      items.forEach(item => {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          if (!item.startsWith('.') && item !== 'node_modules' && item !== 'vendor') {
            walk(fullPath);
          }
        } else if (pattern.test(item)) {
          files.push(fullPath);
        }
      });
    };
    
    walk(dir);
    return files;
  }

  /**
   * Generate accessibility report
   */
  generateReport() {
    console.log('\n📊 ACCESSIBILITY AUDIT REPORT');
    console.log('='.repeat(50));

    // Summary
    console.log(`\n📈 SUMMARY:`);
    console.log(`   🔴 Issues: ${this.issues.length}`);
    console.log(`   🟡 Warnings: ${this.warnings.length}`);
    console.log(`   💡 Suggestions: ${this.suggestions.length}`);

    // Issues
    if (this.issues.length > 0) {
      console.log(`\n🔴 ISSUES (${this.issues.length}):`);
      this.issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue.type}`);
        console.log(`      📁 File: ${issue.file}`);
        if (issue.element) console.log(`      🔍 Element: ${issue.element.substring(0, 80)}...`);
        if (issue.message) console.log(`      💬 ${issue.message}`);
        console.log('');
      });
    }

    // Warnings
    if (this.warnings.length > 0) {
      console.log(`\n🟡 WARNINGS (${this.warnings.length}):`);
      this.warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning.type}`);
        console.log(`      📁 File: ${warning.file}`);
        if (warning.element) console.log(`      🔍 Element: ${warning.element.substring(0, 80)}...`);
        if (warning.message) console.log(`      💬 ${warning.message}`);
        console.log('');
      });
    }

    // Suggestions
    if (this.suggestions.length > 0) {
      console.log(`\n💡 SUGGESTIONS (${this.suggestions.length}):`);
      this.suggestions.slice(0, 5).forEach((suggestion, index) => {
        console.log(`   ${index + 1}. ${suggestion.type}`);
        console.log(`      📁 File: ${suggestion.file}`);
        if (suggestion.message) console.log(`      💬 ${suggestion.message}`);
        console.log('');
      });
      
      if (this.suggestions.length > 5) {
        console.log(`   ... and ${this.suggestions.length - 5} more suggestions`);
      }
    }

    // Recommendations
    console.log('\n🎯 RECOMMENDATIONS:');
    console.log('   1. Fix all high-severity issues immediately');
    console.log('   2. Address warnings to improve accessibility');
    console.log('   3. Consider implementing suggestions for better UX');
    console.log('   4. Test with actual screen readers and keyboard navigation');
    console.log('   5. Run automated accessibility testing tools like axe-core');

    // Save report to file
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        issues: this.issues.length,
        warnings: this.warnings.length,
        suggestions: this.suggestions.length
      },
      issues: this.issues,
      warnings: this.warnings,
      suggestions: this.suggestions
    };

    fs.writeFileSync('accessibility-report.json', JSON.stringify(report, null, 2));
    console.log('\n📄 Report saved to accessibility-report.json');

    // Exit with error code if issues found
    if (this.issues.length > 0) {
      process.exit(1);
    }
  }
}

// Run audit if called directly
if (require.main === module) {
  const auditor = new AccessibilityAuditor();
  auditor.audit().catch(error => {
    console.error('Audit failed:', error);
    process.exit(1);
  });
}

module.exports = AccessibilityAuditor;
