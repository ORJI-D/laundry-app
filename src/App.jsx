import React, { useState, useEffect } from 'react';
import { Plus, Check, Calendar, Users, Shirt } from 'lucide-react';

// IndexedDB utility functions
const DB_NAME = 'LaundryQueueDB';
const DB_VERSION = 1;
const STORE_NAME = 'customers';

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('dateAdded', 'dateAdded', { unique: false });
        store.createIndex('completed', 'completed', { unique: false });
      }
    };
  });
};

const saveCustomersToDb = async (customers) => {
  const db = await initDB();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  
  // Clear existing data
  await store.clear();
  
  // Add all customers
  for (const customer of customers) {
    await store.add({
      ...customer,
      dateAdded: customer.dateAdded.toISOString(),
      readyDate: customer.readyDate.toISOString(),
      completedDate: customer.completedDate ? customer.completedDate.toISOString() : null
    });
  }
};

const loadCustomersFromDb = async () => {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const customers = request.result.map(customer => ({
          ...customer,
          dateAdded: new Date(customer.dateAdded),
          readyDate: new Date(customer.readyDate),
          completedDate: customer.completedDate ? new Date(customer.completedDate) : null
        }));
        resolve(customers);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error loading customers:', error);
    return [];
  }
};

const LaundryQueueApp = () => {
  const [customers, setCustomers] = useState([]);
  const [newCustomer, setNewCustomer] = useState({ name: '', clothesCount: '' });
  const [loading, setLoading] = useState(true);
  const [clearMessage, setClearMessage] = useState('');
  
  const DAILY_LIMIT = 8;

  // Load customers from IndexedDB on component mount
  useEffect(() => {
    const loadData = async () => {
      const savedCustomers = await loadCustomersFromDb();
      setCustomers(savedCustomers);
      setLoading(false);
    };
    loadData();
  }, []);

  // Save customers to IndexedDB whenever customers array changes
  useEffect(() => {
    if (!loading && customers.length > 0) {
      saveCustomersToDb(customers);
    }
  }, [customers, loading]);

  // Calculate ready date for a customer based on queue position
  const calculateReadyDate = (clothesCount, queuePosition = 0) => {
    const today = new Date();
    let totalClothesInQueue = queuePosition;
    
    // Add clothes from existing queue
    customers.forEach(customer => {
      if (!customer.completed) {
        totalClothesInQueue += customer.clothesCount;
      }
    });
    
    // Calculate how many days needed
    const totalClothes = totalClothesInQueue + parseInt(clothesCount);
    const daysNeeded = Math.ceil(totalClothes / DAILY_LIMIT);
    
    const readyDate = new Date(today);
    readyDate.setDate(today.getDate() + daysNeeded - 1);
    
    return readyDate;
  };

  // Add new customer
  const addCustomer = () => {
    if (!newCustomer.name.trim() || !newCustomer.clothesCount) return;
    
    const readyDate = calculateReadyDate(parseInt(newCustomer.clothesCount));
    
    const customer = {
      id: Date.now(),
      name: newCustomer.name.trim(),
      clothesCount: parseInt(newCustomer.clothesCount),
      dateAdded: new Date(),
      readyDate: readyDate,
      completed: false
    };
    
    setCustomers([...customers, customer]);
    setNewCustomer({ name: '', clothesCount: '' });
  };

  // Mark customer as completed
  const markCompleted = (customerId) => {
    setCustomers(customers.map(customer => 
      customer.id === customerId 
        ? { ...customer, completed: true, completedDate: new Date() }
        : customer
    ));
  };

  // Get pending customers
  const pendingCustomers = customers.filter(c => !c.completed);
  const completedCustomers = customers.filter(c => c.completed);

  // Calculate total pending clothes
  const totalPendingClothes = pendingCustomers.reduce((sum, customer) => sum + customer.clothesCount, 0);

  // Clear all data from IndexedDB
  const clearAllData = async () => {
    try {
      const db = await initDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      await store.clear();
      
      // Update local state
      setCustomers([]);
      setClearMessage('✅ All data cleared successfully!');
      console.log('All laundry data cleared from IndexedDB');
      
      // Clear message after 3 seconds
      setTimeout(() => setClearMessage(''), 3000);
      
    } catch (error) {
      console.error('Error clearing database:', error);
      setClearMessage('❌ Error clearing data');
      setTimeout(() => setClearMessage(''), 3000);
    }
  };

  const handleClearClick = () => {
    const confirmed = window.confirm(
      'Are you sure you want to clear ALL laundry data? This action cannot be undone.'
    );
    
    if (confirmed) {
      clearAllData();
    }
  };

  // Format date
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header */}
      <div className="header">
        <h1 className="header-title">
          <Shirt className="header-icon" />
          Laundry Queue
        </h1>
        <div className="header-subtitle">
          Daily limit: {DAILY_LIMIT} clothes
        </div>
        
        {/* Clear Data Button */}
        <button
          onClick={handleClearClick}
          className="clear-data-button"
        >
          Clear All Data
        </button>
        
        {/* Clear Message */}
        {clearMessage && (
          <div className={`clear-message ${clearMessage.includes('✅') ? 'success' : 'error'}`}>
            {clearMessage}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="stats-container">
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-number stat-pending">{pendingCustomers.length}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-item">
            <div className="stat-number stat-clothes">{totalPendingClothes}</div>
            <div className="stat-label">Total Clothes</div>
          </div>
          <div className="stat-item">
            <div className="stat-number stat-completed">{completedCustomers.length}</div>
            <div className="stat-label">Completed</div>
          </div>
        </div>
      </div>

      {/* Add Customer Form */}
      <div className="form-container">
        <h2 className="form-title">Add New Customer</h2>
        <div className="form-inputs">
          <input
            type="text"
            placeholder="Customer name"
            value={newCustomer.name}
            onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
            className="form-input"
          />
          <input
            type="number"
            placeholder="Number of clothes"
            value={newCustomer.clothesCount}
            onChange={(e) => setNewCustomer({...newCustomer, clothesCount: e.target.value})}
            className="form-input"
            min="1"
          />
          <button
            onClick={addCustomer}
            className={`form-button ${(!newCustomer.name.trim() || !newCustomer.clothesCount) ? 'form-button-disabled' : ''}`}
            disabled={!newCustomer.name.trim() || !newCustomer.clothesCount}
          >
            <Plus className="button-icon" />
            Add to Queue
          </button>
        </div>
      </div>

      {/* Pending Queue */}
      <div className="queue-container">
        <h2 className="queue-title">
          <Users className="queue-icon" />
          Pending Queue
        </h2>
        
        {pendingCustomers.length === 0 ? (
          <div className="empty-state">
            <Shirt className="empty-icon" />
            <p>No pending orders</p>
          </div>
        ) : (
          <div className="customer-list">
            {pendingCustomers.map((customer, index) => (
              <div key={customer.id} className="customer-card">
                <div className="customer-info">
                  <div className="customer-left">
                    <div className="customer-name">{customer.name}</div>
                    <div className="customer-clothes">
                      {customer.clothesCount} clothes
                    </div>
                  </div>
                  <div className="customer-right">
                    <div className="customer-ready">
                      Ready: {formatDate(customer.readyDate)}
                    </div>
                    <div className="customer-position">
                      Position: {index + 1}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => markCompleted(customer.id)}
                  className="complete-button"
                >
                  <Check className="button-icon" />
                  Mark as Completed
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Section */}
      {completedCustomers.length > 0 && (
        <div className="completed-section">
          <h2 className="completed-title">
            Completed Today ({completedCustomers.length})
          </h2>
          <div className="completed-list">
            {completedCustomers.slice(-5).map((customer) => (
              <div key={customer.id} className="completed-item">
                <div className="completed-info">
                  <span className="completed-name">{customer.name}</span>
                  <span className="completed-clothes">{customer.clothesCount} clothes</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LaundryQueueApp;