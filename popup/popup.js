document.addEventListener('DOMContentLoaded', () => {
  // Get elements
  const inactiveTabsList = document.getElementById('inactive-tabs-list');
  const storeTabButton = document.getElementById('store-tab');
  
  // Custom confirm dialog elements
  const confirmDialog = document.getElementById('confirm-dialog');
  const confirmMessage = document.getElementById('confirm-message');
  const confirmOkButton = document.getElementById('confirm-ok');
  const confirmCancelButton = document.getElementById('confirm-cancel');
  
  // Custom confirm dialog function
  function customConfirm(message, callback) {
    // Set message
    confirmMessage.textContent = message;
    
    // Show dialog
    confirmDialog.style.display = 'flex';
    
    // Handle OK button
    const handleOk = () => {
      confirmOkButton.removeEventListener('click', handleOk);
      confirmCancelButton.removeEventListener('click', handleCancel);
      confirmDialog.style.display = 'none';
      callback(true);
    };
    
    // Handle Cancel button
    const handleCancel = () => {
      confirmOkButton.removeEventListener('click', handleOk);
      confirmCancelButton.removeEventListener('click', handleCancel);
      confirmDialog.style.display = 'none';
      callback(false);
    };
    
    // Add event listeners
    confirmOkButton.addEventListener('click', handleOk);
    confirmCancelButton.addEventListener('click', handleCancel);
  }
  
  // Format time since a given date
  function formatTimeSince(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return `just now`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  }
  
  // Load inactive tabs
  loadInactiveTabs();
  
  // Add event listener for storing current tab
  storeTabButton.addEventListener('click', () => {
    // Show a warning about limitations
    customConfirm('Note: Form data and scroll position will not be preserved. Continue?', (confirmed) => {
      if (confirmed) {
        browser.runtime.sendMessage({ action: "addTabToInactive" })
          .then((response) => {
            // Refresh the list
            loadInactiveTabs();
            console.log("Tab stored:", response);
          })
          .catch(error => {
            console.error("Error storing tab:", error);
          });
      }
    });
  });
  
  // Function to load inactive tabs
  function loadInactiveTabs() {
    browser.runtime.sendMessage({ action: "getInactiveTabs" })
      .then(inactiveTabs => {
        // Clear the list
        inactiveTabsList.innerHTML = '';
        
        // If no inactive tabs
        if (!inactiveTabs || inactiveTabs.length === 0) {
          inactiveTabsList.innerHTML = '<div class="empty-state">No inactive tabs. Store a tab to get started.</div>';
          return;
        }
        
        console.log("Loaded inactive tabs:", inactiveTabs);
        
        // Add each inactive tab to the list
        inactiveTabs.forEach((tab, index) => {
          const tabElement = document.createElement('div');
          tabElement.className = 'inactive-tab';
          
          // Create favicon
          const favicon = document.createElement('img');
          favicon.className = 'tab-favicon';
          favicon.src = tab.favIconUrl || '../icons/default-favicon.png';
          favicon.onerror = () => { favicon.src = '../icons/default-favicon.png'; };
          
          // Create title
          const title = document.createElement('div');
          title.className = 'tab-title';
          title.textContent = tab.title || tab.url;
          title.title = tab.url; // Show URL on hover
          
          // Create timestamp
          const timestamp = document.createElement('div');
          timestamp.className = 'tab-timestamp';
          timestamp.textContent = `Stored ${formatTimeSince(new Date(tab.timestamp))}`;
          
          // Create actions
          const actions = document.createElement('div');
          actions.className = 'tab-actions';
          
          const restoreButton = document.createElement('button');
          restoreButton.textContent = 'Restore';
          restoreButton.addEventListener('click', (event) => {
            event.preventDefault();
            console.log("Restore clicked for tab index:", index);
            
            browser.runtime.sendMessage({ 
              action: "restoreTab", 
              index: index 
            })
            .then((response) => {
              console.log("Restore response:", response);
              loadInactiveTabs();
            })
            .catch(error => {
              console.error("Error restoring tab:", error);
            });
          });
          
          const removeButton = document.createElement('button');
          removeButton.textContent = 'Remove';
          removeButton.addEventListener('click', (event) => {
            event.preventDefault();
            
            // Use custom confirm dialog
            customConfirm('Are you sure you want to remove this tab?', (confirmed) => {
              if (confirmed) {
                browser.runtime.sendMessage({ 
                  action: "removeInactiveTab", 
                  index: index 
                })
                .then(() => {
                  loadInactiveTabs();
                })
                .catch(error => {
                  console.error("Error removing tab:", error);
                });
              }
            });
          });
          
          // Add all elements to the tab item
          actions.appendChild(restoreButton);
          actions.appendChild(removeButton);
          
          tabElement.appendChild(favicon);
          tabElement.appendChild(title);
          tabElement.appendChild(timestamp);
          tabElement.appendChild(actions);
          
          inactiveTabsList.appendChild(tabElement);
        });
      })
      .catch(error => {
        console.error("Error loading inactive tabs:", error);
        inactiveTabsList.innerHTML = '<div class="error">Error loading tabs. Please try again.</div>';
      });
  }
});