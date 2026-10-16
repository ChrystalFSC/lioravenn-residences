// A single source of truth for the illustrative residence collection.
(() => {
  'use strict';
  const units = [
    { id: 'type-a', name: 'The Solis', label: 'Type A', bedrooms: 1, bathrooms: 1, area: 947, price: 580000, image: 'img/enhanced/bedroom.webp', plan: 'img/floorplan-a.png', description: 'An inviting one-bedroom home with a separate study, made for fresh starts and room to focus.', features: ['Separate study', 'Open living and dining', 'Separate utility yard'], pdf: 'pdfs/type-a.pdf' },
    { id: 'type-b', name: 'The Luma', label: 'Type B', bedrooms: 2, bathrooms: 2, area: 1076, price: 720000, image: 'img/enhanced/bedroom3.webp', plan: 'img/floorplan-b.png', description: 'A balanced two-bedroom layout with room to share, host and make the everyday your own.', features: ['Two bathrooms', 'Connected living and dining', 'Separate utility yard'], pdf: 'pdfs/type-b.pdf' },
    { id: 'type-c', name: 'The Seren', label: 'Type C', bedrooms: 3, bathrooms: 2, area: 1431, price: 960000, image: 'img/enhanced/bedroom5.webp', plan: 'img/floorplan-c.png', description: 'An expansive three-bedroom home for a growing household, with a powder room for guests.', features: ['Guest powder room', 'Generous family living', 'Three bedrooms'], pdf: 'pdfs/type-c.pdf' }
  ];
  const storage = {
    get(key, fallback = null) { try { const value = JSON.parse(localStorage.getItem(key)); return value === null ? fallback : value; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }
  };
  window.Lioravenn = { units, storage, money: value => `RM ${new Intl.NumberFormat('en-MY', { maximumFractionDigits: 0 }).format(Number(value) || 0)}` };
})();
