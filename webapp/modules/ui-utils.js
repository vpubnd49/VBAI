/**
 * UI Utilities for VBAI
 */

/**
 * Hiển thị thông báo (toast)
 * @param {string} msg 
 * @param {'success' | 'error' | 'warning'} type 
 */
export function showToast(msg, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  
  // Animation logic
  setTimeout(() => { 
    toast.style.opacity = '0'; 
    toast.style.transform = 'translateX(100%)'; 
    toast.style.transition = 'all 0.3s'; 
  }, 2500);
  
  setTimeout(() => toast.remove(), 3000);
}
