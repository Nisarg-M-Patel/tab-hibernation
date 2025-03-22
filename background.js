// Store for inactive tabs
let inactiveTabs = [];

// Initialize: Load saved inactive tabs
browser.storage.local.get('inactiveTabs').then(result => {
  if (result.inactiveTabs) {
    inactiveTabs = result.inactiveTabs;
    console.log("Loaded from storage:", inactiveTabs);
  }
}).catch(error => {
  console.error("Error loading from storage:", error);
});

// Save inactive tabs to storage
function saveInactiveTabs() {
  return browser.storage.local.set({ inactiveTabs })
    .then(() => {
      console.log("Saved to storage:", inactiveTabs);
    })
    .catch(error => {
      console.error("Error saving to storage:", error);
    });
}

// Create a function to hibernate a specific tab
function hibernateTab(tabId) {
  return browser.tabs.get(tabId)
    .then(tab => {
      console.log("Hibernating tab:", tab);
      
      // Store tab info
      inactiveTabs.push({
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl || '',
        timestamp: Date.now()
      });
      
      // Save first, then close tab
      return saveInactiveTabs()
        .then(() => browser.tabs.remove(tab.id))
        .then(() => ({ success: true }));
    })
    .catch(error => {
      console.error("Error hibernating tab:", error);
      return { success: false, error: error.toString() };
    });
}

// Create a function to hibernate the current tab
function hibernateCurrentTab() {
  return browser.tabs.query({ active: true, currentWindow: true })
    .then(tabs => {
      if (tabs.length > 0) {
        return hibernateTab(tabs[0].id);
      }
      return { success: false, error: "No active tab found" };
    })
    .catch(error => {
      console.error("Error getting current tab:", error);
      return { success: false, error: error.toString() };
    });
}

// Create right-click context menu items
browser.contextMenus.create({
  id: "hibernate-tab",
  title: "Hibernate this tab",
  contexts: ["tab"]
});

browser.contextMenus.create({
  id: "hibernate-link",
  title: "Hibernate link",
  contexts: ["link"]
});

// Listen for context menu clicks
browser.contextMenus.onClicked.addListener((info, tab) => {
  console.log("Context menu clicked:", info, tab);
  
  if (info.menuItemId === "hibernate-tab") {
    // Hibernate the tab that was right-clicked
    hibernateTab(tab.id);
  } 
  else if (info.menuItemId === "hibernate-link") {
    // Store the link in inactive tabs and don't navigate to it
    inactiveTabs.push({
      url: info.linkUrl,
      title: info.linkText || info.linkUrl,
      favIconUrl: tab.favIconUrl || '',
      timestamp: Date.now()
    });
    
    saveInactiveTabs()
      .then(() => {
        console.log("Link hibernated successfully:", info.linkUrl);
      })
      .catch(error => {
        console.error("Error hibernating link:", error);
      });
  }
});

// Listen for messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Received message:", message);
  
  // Get all inactive tabs
  if (message.action === "getInactiveTabs") {
    console.log("Returning inactive tabs:", inactiveTabs);
    return Promise.resolve(inactiveTabs);
  }
  
  // Add current tab to inactive tabs
  else if (message.action === "addTabToInactive") {
    return hibernateCurrentTab();
  }
  
  // Restore tab from inactive list
  else if (message.action === "restoreTab") {
    const index = message.index;
    console.log(`Restoring tab at index ${index}:`, inactiveTabs[index]);
    
    if (index >= 0 && index < inactiveTabs.length) {
      const tabInfo = inactiveTabs[index];
      
      // First remove from inactive list
      inactiveTabs.splice(index, 1);
      
      // Save changes, then create tab
      return saveInactiveTabs()
        .then(() => browser.tabs.create({ url: tabInfo.url }))
        .then(() => {
          console.log("Tab restored successfully");
          return { success: true };
        })
        .catch(error => {
          console.error("Error restoring tab:", error);
          return { success: false, error: error.toString() };
        });
    }
    
    console.log("Invalid index for restoring tab");
    return Promise.resolve({ 
      success: false, 
      error: "Invalid tab index" 
    });
  }
  
  // Remove tab from inactive list
  else if (message.action === "removeInactiveTab") {
    const index = message.index;
    console.log(`Removing tab at index ${index}`);
    
    if (index >= 0 && index < inactiveTabs.length) {
      // Remove from inactive list
      inactiveTabs.splice(index, 1);
      
      // Save changes
      return saveInactiveTabs()
        .then(() => ({ success: true }));
    }
    
    return Promise.resolve({ 
      success: false, 
      error: "Invalid tab index" 
    });
  }
  
  // Unknown action
  return Promise.resolve({ 
    success: false, 
    error: "Unknown action" 
  });
});