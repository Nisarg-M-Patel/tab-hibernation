document.addEventListener('DOMContentLoaded', () => {
    // Get elements
    const inactiveTabsList = document.getElementById('inactive-tabs-list');
    const storeTabButton = document.getElementById('store-tab');
    
    // Load inactive tabs
    loadInactiveTabs();
    
    // Add event listener for storing current tab
    storeTabButton.addEventListener('click', () => {
      browser.runtime.sendMessage({ action: "addTabToInactive" })
        .then((response) => {
          // Refresh the list
          loadInactiveTabs();
          console.log("Tab stored:", response);
        })
        .catch(error => {
          console.error("Error storing tab:", error);
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
            favicon.src = tab.favIconUrl || 'default-favicon.png';
            favicon.onerror = () => { favicon.src = 'default-favicon.png'; };
            
            // Create title
            const title = document.createElement('div');
            title.className = 'tab-title';
            title.textContent = tab.title || tab.url;
            title.title = tab.url; // Show URL on hover
            
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
              if (confirm('Are you sure you want to remove this tab?')) {
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
            
            // Add all elements to the tab item
            actions.appendChild(restoreButton);
            actions.appendChild(removeButton);
            
            tabElement.appendChild(favicon);
            tabElement.appendChild(title);
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