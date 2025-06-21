    /**
     * Toggle emoji picker visibility
     */
    toggleEmojiPicker() {
        const emojiPicker = document.getElementById('emojiPicker');
        if (emojiPicker) {
            const isVisible = emojiPicker.classList.contains('show');
            emojiPicker.classList.toggle('show', !isVisible);
            
            if (!isVisible) {
                // If showing the picker, set up event listeners for emoji selection
                const emojis = emojiPicker.querySelectorAll('.emoji');
                emojis.forEach(emoji => {
                    emoji.addEventListener('click', () => {
                        this.insertEmoji(emoji.textContent);
                        this.toggleEmojiPicker(); // Hide picker after selection
                    });
                });
            }
        }
    }
