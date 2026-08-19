// Basic content protection for VIP content
document.addEventListener('contextmenu', e => {
  if (e.target.closest('.vip-card, .prediction-tip')) e.preventDefault();
});
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && ['u','s','p'].includes(e.key.toLowerCase())) {
    if (document.querySelector('.vip-card')) e.preventDefault();
  }
});
