# Contributing to Quick Chat

Thank you for your interest in contributing to Quick Chat! This document provides guidelines and instructions for contributing to this project.

## 🍴 Fork First Policy

**Please fork this repository before making any contributions.** This is the preferred workflow for several reasons:

- Maintains clean project history
- Gives you proper credit for your work
- Enables better collaboration and code review
- Keeps the main repository stable

## 📋 How to Contribute

### Step 1: Fork the Repository
1. Go to [https://github.com/EL-HOUSS-BRAHIM/quick_chat](https://github.com/EL-HOUSS-BRAHIM/quick_chat)
2. Click the "Fork" button in the top right
3. This creates your own copy of the repository

### Step 2: Clone Your Fork
```bash
# Clone your fork (replace YOUR-USERNAME with your GitHub username)
git clone https://github.com/YOUR-USERNAME/quick_chat.git
cd quick_chat

# Add the original repository as upstream
git remote add upstream https://github.com/EL-HOUSS-BRAHIM/quick_chat.git
```

### Step 3: Create a Feature Branch
```bash
# Create and switch to a new branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

### Step 4: Make Your Changes
- Write clean, well-commented code
- Follow existing code style and conventions
- Test your changes thoroughly
- Update documentation if needed

### Step 5: Commit Your Changes
```bash
# Add your changes
git add .

# Commit with a descriptive message
git commit -m "Add: Brief description of your changes"
```

**Commit Message Guidelines:**
- `Add:` for new features
- `Fix:` for bug fixes
- `Update:` for modifications
- `Remove:` for deletions
- `Docs:` for documentation changes

### Step 6: Push and Create Pull Request
```bash
# Push to your fork
git push origin feature/your-feature-name
```

Then go to GitHub and create a Pull Request from your fork to the main repository.

## 🐛 Reporting Issues

If you find a bug or have a feature request:

1. **Search existing issues** first to avoid duplicates
2. **Use the issue templates** if available
3. **Provide detailed information:**
   - Steps to reproduce the issue
   - Expected vs actual behavior
   - Browser/environment details
   - Screenshots if applicable

## 💡 Suggestions for Contributions

### High Priority:
- Security improvements
- Performance optimizations
- Mobile responsiveness fixes
- Accessibility enhancements

### Medium Priority:
- New features (emoji support, file sharing, etc.)
- UI/UX improvements
- Code refactoring
- Documentation improvements

### Low Priority:
- Theme customizations
- Additional language support
- Integration with external services

## 📝 Code Style Guidelines

### PHP Code:
- Follow PSR-12 coding standards
- Use meaningful variable and function names
- Add docblocks for classes and methods
- Handle errors gracefully

### JavaScript Code:
- Use ES6+ features where appropriate
- Follow consistent naming conventions
- Add comments for complex logic
- Ensure cross-browser compatibility

### CSS Code:
- Use consistent naming conventions
- Organize styles logically
- Comment complex selectors
- Maintain responsive design principles

## 🔍 Code Review Process

1. All contributions go through code review
2. Maintainers will provide feedback within 48-72 hours
3. Address any requested changes
4. Once approved, your PR will be merged

## 📄 License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.

## 🤝 Questions?

If you have questions about contributing:
- Open a [Discussion](https://github.com/EL-HOUSS-BRAHIM/quick_chat/discussions)
- Create an [Issue](https://github.com/EL-HOUSS-BRAHIM/quick_chat/issues)
- Contact the maintainer: BRAHIM EL HOUSS

Thank you for contributing to Quick Chat! 🚀
