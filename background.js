// Set up the database
let db;
const dbName = "tabHibernationDB";
const dbVersion = 1;
const storeName = "inactiveTabs";
let inactiveTabs = []; // In-memory cache of tabs

// Initialize the database
function initDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion);
    
    request.onerror = event => {
      console.error("Database error:", event.target.error);
      reject(event.target.error);
    };
    
    request.onsuccess = event => {
      db = event.target.result;
      console.log("Database opened successfully");
      resolve(db);
    };
    
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(storeName)) {
        const store = db.createObjectStore(storeName, { keyPath: "timestamp" });
        // Add index for faster URL-based lookups
        store.createIndex("url", "url", { unique: false });
        console.log("Object store created with url index");
      }
    };
  });
}

// Save tabs to IndexedDB
function saveInactiveTabs() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);
    
    // Clear existing data
    const clearRequest = store.clear();
    
    clearRequest.onsuccess = () => {
      // Add each tab
      inactiveTabs.forEach(tab => {
        store.add(tab);
      });
      
      transaction.oncomplete = () => {
        console.log("Saved to IndexedDB:", inactiveTabs);
        resolve();
      };
      
      transaction.onerror = event => {
        console.error("Transaction error:", event.target.error);
        reject(event.target.error);
      };
    };
  });
}

// Load tabs from IndexedDB
function loadInactiveTabs() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    
    request.onsuccess = () => {
      inactiveTabs = request.result;
      console.log("Loaded from IndexedDB:", inactiveTabs);
      resolve(inactiveTabs);
    };
    
    request.onerror = event => {
      console.error("Get error:", event.target.error);
      reject(event.target.error);
    };
  });
}

// Initialize database and load tabs
initDatabase()
  .then(() => loadInactiveTabs())
  .catch(error => {
    console.error("Error initializing database:", error);
  });

// Create a function to hibernate a specific tab
function hibernateTab(tabId) {
  return browser.tabs.get(tabId)
    .then(tab => {
      console.log("Hibernating tab:", tab);
      
      // Store basic tab info
      inactiveTabs.push({
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl || '',
        timestamp: Date.now()
      });
      
      // Save and close tab
      return saveInactiveTabs()
        .then(() => browser.tabs.remove(tabId))
        .then(() => {
          console.log("Tab hibernated successfully");
          return { success: true };
        })
        .catch(error => {
          console.error("Error closing tab:", error);
          return { success: false, error: error.toString() };
        });
    })
    .catch(error => {
      console.error("Error getting tab:", error);
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
    return loadInactiveTabs();
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