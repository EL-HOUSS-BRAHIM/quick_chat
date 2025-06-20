/**
 * Card Component - Flexible container with modern styling
 * @module components/ui/Card
 */

export class Card {
    constructor(options = {}) {
        this.options = {
            title: '',
            subtitle: '',
            content: '',
            footer: '',
            variant: 'default', // default, elevated, outlined, filled
            size: 'medium', // small, medium, large
            interactive: false,
            loading: false,
            className: '',
            ...options
        };

        this.element = null;
        this.render();
    }

    render() {
        this.element = document.createElement('div');
        this.element.className = this.getCardClasses();
        
        if (this.options.interactive) {
            this.element.setAttribute('role', 'button');
            this.element.setAttribute('tabindex', '0');
            this.setupInteractiveHandlers();
        }

        this.element.innerHTML = this.getCardHTML();
        this.setupEventListeners();
        
        return this.element;
    }

    getCardClasses() {
        const classes = ['card', `card--${this.options.variant}`, `card--${this.options.size}`];
        
        if (this.options.interactive) classes.push('card--interactive');
        if (this.options.loading) classes.push('card--loading');
        if (this.options.className) classes.push(this.options.className);
        
        return classes.join(' ');
    }

    getCardHTML() {
        const hasHeader = this.options.title || this.options.subtitle;
        const hasFooter = this.options.footer;

        return `
            ${this.options.loading ? '<div class="card__loading-overlay"><div class="loading-spinner"></div></div>' : ''}
            
            ${hasHeader ? `
                <div class="card__header">
                    ${this.options.title ? `<h3 class="card__title">${this.options.title}</h3>` : ''}
                    ${this.options.subtitle ? `<p class="card__subtitle">${this.options.subtitle}</p>` : ''}
                </div>
            ` : ''}
            
            <div class="card__content">
                ${this.options.content}
            </div>
            
            ${hasFooter ? `
                <div class="card__footer">
                    ${this.options.footer}
                </div>
            ` : ''}
        `;
    }

    setupEventListeners() {
        if (this.options.interactive) {
            this.element.addEventListener('click', (e) => {
                this.handleClick(e);
            });

            this.element.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.handleClick(e);
                }
            });
        }
    }

    setupInteractiveHandlers() {
        this.element.addEventListener('mouseenter', () => {
            this.element.classList.add('card--hover');
        });

        this.element.addEventListener('mouseleave', () => {
            this.element.classList.remove('card--hover');
        });

        this.element.addEventListener('focus', () => {
            this.element.classList.add('card--focus');
        });

        this.element.addEventListener('blur', () => {
            this.element.classList.remove('card--focus');
        });
    }

    handleClick(event) {
        if (this.options.loading) return;
        
        this.element.classList.add('card--active');
        setTimeout(() => {
            this.element.classList.remove('card--active');
        }, 150);

        if (this.options.onClick) {
            this.options.onClick(event, this);
        }
    }

    // Public API methods
    setTitle(title) {
        this.options.title = title;
        this.update();
    }

    setContent(content) {
        this.options.content = content;
        this.update();
    }

    setLoading(loading) {
        this.options.loading = loading;
        this.element.classList.toggle('card--loading', loading);
        
        const overlay = this.element.querySelector('.card__loading-overlay');
        if (loading && !overlay) {
            this.element.insertAdjacentHTML('afterbegin', 
                '<div class="card__loading-overlay"><div class="loading-spinner"></div></div>'
            );
        } else if (!loading && overlay) {
            overlay.remove();
        }
    }

    addAction(label, callback, variant = 'primary') {
        if (!this.element.querySelector('.card__footer')) {
            this.element.insertAdjacentHTML('beforeend', '<div class="card__footer"></div>');
        }
        
        const footer = this.element.querySelector('.card__footer');
        const button = document.createElement('button');
        button.className = `btn btn--${variant} btn--small`;
        button.textContent = label;
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            callback(e, this);
        });
        
        footer.appendChild(button);
    }

    update() {
        const content = this.element.querySelector('.card__content');
        const header = this.element.querySelector('.card__header');
        
        if (header) {
            header.outerHTML = this.options.title || this.options.subtitle ? `
                <div class="card__header">
                    ${this.options.title ? `<h3 class="card__title">${this.options.title}</h3>` : ''}
                    ${this.options.subtitle ? `<p class="card__subtitle">${this.options.subtitle}</p>` : ''}
                </div>
            ` : '';
        }
        
        if (content) {
            content.innerHTML = this.options.content;
        }
    }

    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
    }

    getElement() {
        return this.element;
    }
}

// Static helper methods
Card.createSimple = (content, className = '') => {
    return new Card({
        content,
        className: `card--simple ${className}`,
        variant: 'outlined'
    });
};

Card.createWithActions = (title, content, actions = []) => {
    const card = new Card({
        title,
        content,
        variant: 'elevated'
    });

    actions.forEach(action => {
        card.addAction(action.label, action.callback, action.variant);
    });

    return card;
};

export default Card;