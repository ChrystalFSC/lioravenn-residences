(() => {
    'use strict';

    const filters = Array.from(document.querySelectorAll('.collection-filter'));
    const items = Array.from(document.querySelectorAll('.collection-item'));
    const count = document.getElementById('collection-count');
    const dialog = document.getElementById('collection-lightbox');
    const image = document.getElementById('lightbox-image');
    const title = document.getElementById('lightbox-title');
    const description = document.getElementById('lightbox-description');
    const position = document.getElementById('lightbox-position');
    let visibleItems = items.slice();
    let currentIndex = 0;
    let previousOverflow = '';
    let opener = null;

    function filterCollection(category, updateURL = true) {
        const selected = filters.find(button => button.dataset.filter === category);
        if (!selected) return;
        filters.forEach(button => {
            const active = button === selected;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', String(active));
        });
        items.forEach(item => { item.hidden = category !== 'all' && item.dataset.category !== category; });
        visibleItems = items.filter(item => !item.hidden);
        count.textContent = `${visibleItems.length} ${visibleItems.length === 1 ? 'moment' : 'moments'} to discover`;
        if (updateURL) {
            const url = new URL(window.location.href);
            url.searchParams.delete('category');
            if (category === 'all') url.searchParams.delete('filter');
            else url.searchParams.set('filter', category);
            try { window.history.replaceState(null, '', url); } catch (_) { /* Local-file previews can restrict history. */ }
        }
    }

    filters.forEach(button => button.addEventListener('click', () => filterCollection(button.dataset.filter)));
    const requestedFilter = new URLSearchParams(window.location.search);
    filterCollection(requestedFilter.get('filter') || requestedFilter.get('category') || 'all', false);

    function showImage(index) {
        if (!visibleItems.length) return;
        currentIndex = (index + visibleItems.length) % visibleItems.length;
        const item = visibleItems[currentIndex];
        const source = item.querySelector('img');
        image.src = source.currentSrc || source.src;
        image.alt = source.alt;
        title.textContent = item.dataset.title;
        description.textContent = item.dataset.description;
        position.textContent = `${currentIndex + 1} / ${visibleItems.length}`;
    }

    items.forEach(item => item.addEventListener('click', () => {
        opener = item;
        showImage(visibleItems.indexOf(item));
        previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        dialog.showModal();
    }));
    dialog.querySelector('.lightbox-close').addEventListener('click', () => dialog.close());
    dialog.querySelector('.lightbox-prev').addEventListener('click', () => showImage(currentIndex - 1));
    dialog.querySelector('.lightbox-next').addEventListener('click', () => showImage(currentIndex + 1));
    dialog.addEventListener('close', () => {
        document.body.style.overflow = previousOverflow;
        if (opener && !opener.hidden) opener.focus({ preventScroll: true });
    });
    dialog.addEventListener('click', event => {
        if (event.target !== dialog) return;
        const bounds = dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
    dialog.addEventListener('keydown', event => {
        if (event.key === 'ArrowLeft') { event.preventDefault(); showImage(currentIndex - 1); }
        if (event.key === 'ArrowRight') { event.preventDefault(); showImage(currentIndex + 1); }
    });

    const rooms = {
        living: {
            src: 'img/enhanced/living_room.webp', alt: 'A light-filled open living and dining room',
            label: 'LIVING & DINING', title: 'Life, with room to unfold.',
            description: 'A place for easy mornings and long conversations. Imagine an open living and dining space that brings everyone a little closer.'
        },
        bedroom: {
            src: 'img/enhanced/bedroom.webp', alt: 'A bedroom styled in warm neutral tones',
            label: 'THE BEDROOM', title: 'Your own quiet corner.',
            description: 'Soft tones, warm textures, and a little distance from the rush outside. Picture a personal retreat for restful evenings and fresh starts.'
        },
        kitchen: {
            src: 'img/optimized/kitchen.webp', alt: 'A contemporary kitchen with ample preparation space',
            label: 'THE KITCHEN', title: 'The heart of the everyday.',
            description: 'From the first cup of coffee to a meal worth lingering over. Explore a kitchen mood that makes simple daily rituals feel special.'
        },
        bathroom: {
            src: 'img/optimized/Bathroom.webp', alt: 'A contemporary bathroom with warm materials',
            label: 'THE BATHROOM', title: 'A moment just for you.',
            description: 'Clean lines and a calming material palette. Imagine a space to pause, refresh, and find a quieter rhythm at either end of your day.'
        }
    };
    const tabs = Array.from(document.querySelectorAll('.room-tabs [role="tab"]'));
    const panel = document.getElementById('room-panel');
    const roomImage = document.getElementById('room-image');
    function selectRoom(tab) {
        const room = rooms[tab.dataset.room];
        if (!room) return;
        tabs.forEach(button => {
            const active = button === tab;
            button.setAttribute('aria-selected', String(active));
            button.tabIndex = active ? 0 : -1;
        });
        panel.setAttribute('aria-labelledby', tab.id);
        roomImage.src = room.src;
        roomImage.alt = room.alt;
        document.getElementById('room-number').textContent = `0${tabs.indexOf(tab) + 1} / 04`;
        document.getElementById('room-label').textContent = room.label;
        document.getElementById('room-story-title').textContent = room.title;
        document.getElementById('room-description').textContent = room.description;
    }
    tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => selectRoom(tab));
        tab.addEventListener('keydown', event => {
            let nextIndex;
            if (event.key === 'ArrowDown' || event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
            if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
            if (event.key === 'Home') nextIndex = 0;
            if (event.key === 'End') nextIndex = tabs.length - 1;
            if (nextIndex === undefined) return;
            event.preventDefault();
            selectRoom(tabs[nextIndex]);
            tabs[nextIndex].focus();
        });
    });
})();
