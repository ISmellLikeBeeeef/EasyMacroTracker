import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, ChevronLeft, ChevronRight, Search, 
  Dumbbell, Scale, X, Flame, Beef, Wheat, Droplets, Activity, Star,
  CalendarDays, BarChart2
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot } from 'firebase/firestore';

// --- Firebase Setup Logic ---
let app, auth, db, appId;
try {
  const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
  if (firebaseConfig) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  }
} catch (e) {
  console.warn("Firebase config not found or invalid", e);
}

// --- PWA Setup Logic ---
const setupPWA = () => {
  if (typeof window === 'undefined') return;
  try {
    const manifest = {
      name: "MacroTracker PWA",
      short_name: "Macros",
      description: "Daily food and macro tracker for bodybuilders.",
      start_url: ".",
      display: "standalone",
      background_color: "#18181b",
      theme_color: "#3b82f6",
      icons: [
        {
          src: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%233b82f6'><path d='M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z'/></svg>",
          sizes: "192x192 512x512",
          type: "image/svg+xml"
        }
      ]
    };
    const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const manifestUrl = URL.createObjectURL(manifestBlob);
    
    let manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = manifestUrl;

    const swCode = `
      self.addEventListener('install', (e) => self.skipWaiting());
      self.addEventListener('activate', (e) => e.waitUntil(clients.claim()));
      self.addEventListener('fetch', (e) => {
        e.respondWith(fetch(e.request).catch(() => new Response('Offline', {status: 503})));
      });
    `;
    const swBlob = new Blob([swCode], { type: 'application/javascript' });
    const swUrl = URL.createObjectURL(swBlob);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register(swUrl).catch(() => {});
    }
  } catch (error) {
    console.warn('PWA setup skipped');
  }
};

// --- Helper Functions ---
const getTodayStr = () => new Date().toISOString().split('T')[0];
const addDays = (dateStr, days) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const formatDateDisplay = (dateStr) => {
  const date = new Date(dateStr);
  const today = new Date(getTodayStr());
  const diffTime = date - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays === 1) return 'Tomorrow';
  
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
};

export default function App() {
  // --- State ---
  const [view, setView] = useState('daily');
  const [currentDate, setCurrentDate] = useState(getTodayStr());
  const [user, setUser] = useState(null);
  
  const [logs, setLogs] = useState({});
  
  // Search & Modal State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  
  // Add Food Modal State
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [servingAmount, setServingAmount] = useState('100');
  const [servingUnit, setServingUnit] = useState('g'); // 'g' or 'oz'

  // Favorites State
  const [favorites, setFavorites] = useState([]);

  // --- Firebase Auth & Data Sync ---
  useEffect(() => {
    if (!auth) return;
    
    const initAuth = async () => {
      try {
        // Securely authenticate the user
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error", err);
      }
    };
    
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    
    // Real-time listener for Food Logs
    const logsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'logs');
    const unsubLogs = onSnapshot(logsRef, (snapshot) => {
      const newLogs = {};
      snapshot.forEach(docSnap => {
        newLogs[docSnap.id] = docSnap.data().foods || [];
      });
      setLogs(newLogs);
    }, (err) => console.error("Logs sync error:", err));

    // Real-time listener for Favorites
    const favRef = doc(db, 'artifacts', appId, 'users', user.uid, 'favorites', 'user_favorites');
    const unsubFavs = onSnapshot(favRef, (docSnap) => {
      if (docSnap.exists()) {
        setFavorites(docSnap.data().items || []);
      }
    }, (err) => console.error("Favs sync error:", err));

    return () => {
      unsubLogs();
      unsubFavs();
    };
  }, [user]);

  useEffect(() => {
    setupPWA();
  }, []);

  // --- API Fetch ---
  const searchFood = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setFetchError('');
    try {
      // Switched to USDA FoodData Central API. It provides solid CORS support
      // and is much better for finding the whole foods common in bodybuilding.
      const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=DEMO_KEY&query=${encodeURIComponent(searchQuery)}&pageSize=20`);
      if (!res.ok) throw new Error('Network response failed');
      const data = await res.json();
      
      setSearchResults(data.foods || []);
    } catch (err) {
      console.error("Failed to fetch food data", err);
      setFetchError('Network error: Failed to fetch data. Please try again.');
    }
    setIsSearching(false);
  };

  // --- Add Food Logic ---
  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
  };

  const toggleFavorite = (product) => {
    const isFav = favorites.some(f => f.fdcId === product.fdcId);
    const newFavs = isFav ? favorites.filter(f => f.fdcId !== product.fdcId) : [...favorites, product];
    
    if (user && db) {
      setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'favorites', 'user_favorites'), { items: newFavs }).catch(e => console.error(e));
    } else {
      setFavorites(newFavs);
    }
  };

  const handleAddFood = () => {
    if (!selectedProduct || !servingAmount || isNaN(servingAmount)) return;

    const amount = parseFloat(servingAmount);
    // Convert to multiplier based on 100g base from API
    // 1 oz = 28.3495 g
    const grams = servingUnit === 'oz' ? amount * 28.3495 : amount;
    const multiplier = grams / 100;
    
    const nutrients = selectedProduct.foodNutrients || [];
    
    // Safely extract and calculate macros/micros (USDA FDC format)
    const getNut = (names) => {
      const targetNames = Array.isArray(names) ? names : [names];
      const nut = nutrients.find(n => targetNames.includes(n.nutrientName));
      return nut ? nut.value * multiplier : 0;
    };
    
    // Dynamically grab ALL available micronutrients
    const micros = {};
    nutrients.forEach(n => {
      const name = n.nutrientName;
      if (!name) return;
      
      // Ignore main macros from the micros object as they are top-level
      if (['Energy', 'Energy (Atwater General Factors)', 'Protein', 'Carbohydrate, by difference', 'Total lipid (fat)'].includes(name)) return;
      
      if (!micros[name]) {
        micros[name] = { value: 0, unit: (n.unitName || '').toLowerCase() };
      }
      micros[name].value += (n.value * multiplier);
    });

    const newFoodEntry = {
      id: crypto.randomUUID(),
      name: selectedProduct.description,
      brand: selectedProduct.brandOwner || selectedProduct.foodCategory || 'Generic',
      amount: amount,
      unit: servingUnit,
      calories: getNut(['Energy', 'Energy (Atwater General Factors)']),
      protein: getNut(['Protein']),
      carbs: getNut(['Carbohydrate, by difference']),
      fat: getNut(['Total lipid (fat)']),
      sodium: getNut(['Sodium, Na']), 
      potassium: getNut(['Potassium, K']),
      magnesium: getNut(['Magnesium, Mg']),
      micros: micros // Store the complete dynamically fetched list
    };

    const updatedDayLogs = [...(logs[currentDate] || []), newFoodEntry];

    // Push to cloud storage if connected, otherwise update locally
    if (user && db) {
      setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'logs', currentDate), { foods: updatedDayLogs }).catch(e => console.error(e));
    } else {
      setLogs(prev => ({ ...prev, [currentDate]: updatedDayLogs }));
    }

    // Reset and close
    setSelectedProduct(null);
    setSearchQuery('');
    setSearchResults([]);
    setIsSearchOpen(false);
  };

  const handleDeleteFood = (id) => {
    const updatedDayLogs = (logs[currentDate] || []).filter(food => food.id !== id);
    
    // Push removal to cloud storage
    if (user && db) {
      setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'logs', currentDate), { foods: updatedDayLogs }).catch(e => console.error(e));
    } else {
      setLogs(prev => ({ ...prev, [currentDate]: updatedDayLogs }));
    }
  };

  // --- Derived Data for Current Day ---
  const dailyFoods = logs[currentDate] || [];
  
  const dailyTotals = dailyFoods.reduce((acc, food) => {
    acc.calories += food.calories;
    acc.protein += food.protein;
    acc.carbs += food.carbs;
    acc.fat += food.fat;
    acc.sodium += food.sodium;
    acc.potassium += food.potassium;
    acc.magnesium += food.magnesium;
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0, sodium: 0, potassium: 0, magnesium: 0 });

  return (
    <div className="flex flex-col h-screen w-full bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
      
      {/* Header / Date Navigation */}
      <header className="flex items-center justify-between p-4 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-blue-500 font-bold text-xl tracking-tight">
          <Dumbbell size={24} />
          <span>MacroTracker</span>
        </div>
        {view === 'daily' && (
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setCurrentDate(addDays(currentDate, -1))}
              className="p-2 text-zinc-400 hover:text-white bg-zinc-800 rounded-full transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="w-28 text-center font-medium text-zinc-200">
              {formatDateDisplay(currentDate)}
            </div>
            <button 
              onClick={() => setCurrentDate(addDays(currentDate, 1))}
              className="p-2 text-zinc-400 hover:text-white bg-zinc-800 rounded-full transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </header>

      {/* Main Dashboard */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-32">
        {view === 'daily' ? (
          <div className="max-w-4xl mx-auto space-y-6">
            
            {/* Macros Summary */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10 text-orange-500"><Flame size={48}/></div>
                <span className="text-zinc-400 text-sm font-medium mb-1 z-10">Calories</span>
                <span className="text-3xl font-black text-orange-400 z-10">{dailyTotals.calories.toFixed(0)}</span>
                <span className="text-xs text-zinc-500 mt-1 z-10">kcal</span>
              </div>
              <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10 text-blue-500"><Beef size={48}/></div>
                <span className="text-zinc-400 text-sm font-medium mb-1 z-10">Protein</span>
                <span className="text-3xl font-black text-blue-400 z-10">{dailyTotals.protein.toFixed(1)}</span>
                <span className="text-xs text-zinc-500 mt-1 z-10">grams</span>
              </div>
              <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10 text-green-500"><Wheat size={48}/></div>
                <span className="text-zinc-400 text-sm font-medium mb-1 z-10">Carbohydrates</span>
                <span className="text-3xl font-black text-green-400 z-10">{dailyTotals.carbs.toFixed(1)}</span>
                <span className="text-xs text-zinc-500 mt-1 z-10">grams</span>
              </div>
              <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center relative overflow-hidden">
            </div>
            <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2 opacity-10 text-yellow-500"><Droplets size={48}/></div>
              <span className="text-zinc-400 text-sm font-medium mb-1 z-10">Fat</span>
              <span className="text-3xl font-black text-yellow-400 z-10">{dailyTotals.fat.toFixed(1)}</span>
              <span className="text-xs text-zinc-500 mt-1 z-10">grams</span>
            </div>
          </section>

          {/* Micros Summary */}
          <section className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 flex flex-wrap gap-6 justify-around text-sm">
            <div className="flex flex-col items-center">
              <span className="text-zinc-500">Sodium</span>
              <span className="font-bold text-zinc-300">{dailyTotals.sodium.toFixed(0)} <span className="text-xs text-zinc-600">mg</span></span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-zinc-500">Potassium</span>
              <span className="font-bold text-zinc-300">{dailyTotals.potassium.toFixed(0)} <span className="text-xs text-zinc-600">mg</span></span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-zinc-500">Magnesium</span>
              <span className="font-bold text-zinc-300">{dailyTotals.magnesium.toFixed(0)} <span className="text-xs text-zinc-600">mg</span></span>
            </div>
          </section>

          {/* Logged Foods List */}
          <section>
            <h3 className="text-lg font-semibold mb-4 text-zinc-300 flex items-center gap-2">
              <Activity size={20} className="text-blue-500"/> 
              Food Log
            </h3>
            {dailyFoods.length === 0 ? (
              <div className="text-center py-12 bg-zinc-900/50 rounded-2xl border border-zinc-800 border-dashed">
                <Scale size={48} className="mx-auto mb-4 text-zinc-700" />
                <p className="text-zinc-400">No food logged yet.</p>
                <p className="text-sm text-zinc-600 mt-1">Tap the + button to add your meals.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {dailyFoods.map(food => (
                  <li key={food.id} className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex justify-between items-center group">
                    <div className="flex-1 min-w-0 pr-4">
                      <h4 className="font-medium text-zinc-100 truncate">{food.name}</h4>
                      <div className="text-xs text-zinc-500 mt-1 flex gap-3">
                        <span>{food.amount} {food.unit}</span>
                        <span>•</span>
                        <span className="text-blue-400">{food.protein.toFixed(1)}g Protein</span>
                        <span className="text-green-400">{food.carbs.toFixed(1)}g Carbohydrates</span>
                        <span className="text-yellow-400">{food.fat.toFixed(1)}g Fat</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="block font-bold text-orange-400">{food.calories.toFixed(0)}</span>
                        <span className="text-[10px] uppercase tracking-wider text-zinc-600">kcal</span>
                      </div>
                      <button 
                        onClick={() => handleDeleteFood(food.id)}
                        className="text-zinc-600 hover:text-red-500 p-2 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-4">
            <h2 className="text-2xl font-bold text-white mb-6">Historical Reports</h2>
            {Object.keys(logs).length === 0 ? (
              <div className="text-center py-12 bg-zinc-900/50 rounded-2xl border border-zinc-800 border-dashed">
                <BarChart2 size={48} className="mx-auto mb-4 text-zinc-700" />
                <p className="text-zinc-400">No data to report yet.</p>
              </div>
            ) : (
              Object.keys(logs).sort((a, b) => new Date(b) - new Date(a)).map(dateStr => {
                const dayFoods = logs[dateStr];
                const totals = dayFoods.reduce((acc, food) => {
                  acc.calories += food.calories || 0;
                  acc.protein += food.protein || 0;
                  acc.carbs += food.carbs || 0;
                  acc.fat += food.fat || 0;
                  
                  // Dynamically build the micros for the report
                  if (food.micros) {
                    Object.entries(food.micros).forEach(([name, data]) => {
                      if (!acc.micros[name]) {
                        acc.micros[name] = { value: 0, unit: data.unit };
                      }
                      acc.micros[name].value += data.value;
                    });
                  } else {
                    // Fallback for previously logged foods before the dynamic update
                    if (food.sodium) {
                      if (!acc.micros['Sodium, Na']) acc.micros['Sodium, Na'] = { value: 0, unit: 'mg' };
                      acc.micros['Sodium, Na'].value += food.sodium;
                    }
                    if (food.potassium) {
                      if (!acc.micros['Potassium, K']) acc.micros['Potassium, K'] = { value: 0, unit: 'mg' };
                      acc.micros['Potassium, K'].value += food.potassium;
                    }
                    if (food.magnesium) {
                      if (!acc.micros['Magnesium, Mg']) acc.micros['Magnesium, Mg'] = { value: 0, unit: 'mg' };
                      acc.micros['Magnesium, Mg'].value += food.magnesium;
                    }
                  }
                  
                  return acc;
                }, { calories: 0, protein: 0, carbs: 0, fat: 0, micros: {} });

                return (
                  <div key={dateStr} className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 flex flex-col gap-3">
                    <h3 className="text-lg font-semibold text-zinc-100 border-b border-zinc-800 pb-2">{formatDateDisplay(dateStr)}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="bg-zinc-950 p-2 rounded-xl text-center flex flex-col">
                        <span className="text-xs text-zinc-500 mb-1">Calories</span>
                        <span className="font-bold text-orange-400">{totals.calories.toFixed(0)}</span>
                      </div>
                      <div className="bg-zinc-950 p-2 rounded-xl text-center flex flex-col">
                        <span className="text-xs text-zinc-500 mb-1">Protein</span>
                        <span className="font-bold text-blue-400">{totals.protein.toFixed(1)}g</span>
                      </div>
                      <div className="bg-zinc-950 p-2 rounded-xl text-center flex flex-col">
                        <span className="text-xs text-zinc-500 mb-1">Carbohydrates</span>
                        <span className="font-bold text-green-400">{totals.carbs.toFixed(1)}g</span>
                      </div>
                      <div className="bg-zinc-950 p-2 rounded-xl text-center flex flex-col">
                        <span className="text-xs text-zinc-500 mb-1">Fat</span>
                        <span className="font-bold text-yellow-400">{totals.fat.toFixed(1)}g</span>
                      </div>
                    </div>
                    
                    {Object.keys(totals.micros).length > 0 && (
                      <div className="mt-2 bg-zinc-950 rounded-xl p-3 border border-zinc-800">
                        <h4 className="text-xs uppercase tracking-wider text-zinc-500 mb-3 font-semibold">Micronutrients</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
                          {Object.entries(totals.micros)
                            .sort(([a], [b]) => a.localeCompare(b)) // Sort alphabetically
                            .filter(([_, data]) => data.value > 0)  // Hide empty micros
                            .map(([name, data]) => {
                              // FDC names have scientific annotations, extract a clean readable name
                              let cleanName = name.split(',')[0];
                              return (
                                <div key={name} className="flex justify-between items-end border-b border-zinc-800/50 pb-1">
                                  <span className="text-xs text-zinc-400 truncate pr-2" title={name}>{cleanName}</span>
                                  <span className="text-xs font-medium text-zinc-200 shrink-0">
                                    {data.value < 10 ? data.value.toFixed(2) : data.value.toFixed(1)} <span className="text-[10px] text-zinc-500">{data.unit}</span>
                                  </span>
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      {view === 'daily' && (
        <div className="fixed bottom-24 right-6 z-20">
          <button 
            onClick={() => setIsSearchOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-full shadow-lg shadow-blue-900/20 transition-transform active:scale-95"
          >
            <Plus size={28} />
          </button>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-zinc-950 border-t border-zinc-900 flex justify-around items-center z-30 pb-2 pt-2">
        <button 
          onClick={() => setView('daily')} 
          className={`flex-1 flex flex-col items-center gap-1 transition-colors ${view === 'daily' ? 'text-blue-500' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <CalendarDays size={24} />
          <span className="text-xs font-medium">Daily</span>
        </button>
        <button 
          onClick={() => setView('reports')} 
          className={`flex-1 flex flex-col items-center gap-1 transition-colors ${view === 'reports' ? 'text-blue-500' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <BarChart2 size={24} />
          <span className="text-xs font-medium">Reports</span>
        </button>
      </nav>

      {/* --- Search & Add Modal --- */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 md:p-6">
          <div className="bg-zinc-950 w-full md:max-w-2xl md:rounded-3xl h-[90vh] md:h-[80vh] flex flex-col border border-zinc-800 shadow-2xl animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-100">Add Food</h2>
              <button 
                onClick={() => {
                  setIsSearchOpen(false);
                  setSelectedProduct(null);
                }}
                className="p-2 text-zinc-400 hover:text-white bg-zinc-900 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            {/* View 1: Search */}
            {!selectedProduct ? (
              <>
                <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
                  <form onSubmit={searchFood} className="relative">
                    <input 
                      type="text" 
                      autoFocus
                      placeholder="Search food database..."
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl py-3 pl-12 pr-4 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Search className="absolute left-4 top-3.5 text-zinc-500" size={20} />
                    <button type="submit" className="hidden">Search</button>
                  </form>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2">
                  {isSearching ? (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-3">
                      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <p>Searching database...</p>
                    </div>
                  ) : searchQuery ? (
                    searchResults.length > 0 ? (
                      <ul className="space-y-1">
                        {searchResults.map((product, idx) => (
                          <li key={product.fdcId || idx}>
                            <button 
                              onClick={() => handleSelectProduct(product)}
                              className="w-full text-left p-4 hover:bg-zinc-900 rounded-xl transition-colors flex justify-between items-center group"
                            >
                              <div className="min-w-0 pr-4">
                                <p className="font-medium text-zinc-200 truncate">{product.description}</p>
                                <p className="text-sm text-zinc-500 truncate">{product.brandOwner || product.foodCategory || 'Generic'}</p>
                              </div>
                              <div className="text-right shrink-0 bg-zinc-900 px-3 py-1 rounded-lg group-hover:bg-zinc-800 transition-colors">
                                <span className="text-orange-400 font-bold">
                                  {Math.round(product.foodNutrients?.find(n => n.nutrientName === 'Energy' || n.nutrientName === 'Energy (Atwater General Factors)')?.value || 0)}
                                </span>
                                <span className="text-xs text-zinc-500 ml-1">kcal/100g</span>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : !fetchError && (
                      <div className="flex flex-col items-center justify-center h-full text-zinc-600 p-8 text-center">
                        <Search size={48} className="mb-4 opacity-20" />
                        <p>No foods found. Try a different search term.</p>
                      </div>
                    )
                  ) : (
                    // Default View: Favorites
                    <div className="p-2">
                      <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3 px-2 flex items-center gap-2">
                        <Star size={16} /> Favorite Foods
                      </h3>
                      {favorites.length > 0 ? (
                        <ul className="space-y-1">
                          {favorites.map((product, idx) => (
                            <li key={product.fdcId || idx}>
                              <button 
                                onClick={() => handleSelectProduct(product)}
                                className="w-full text-left p-4 hover:bg-zinc-900 rounded-xl transition-colors flex justify-between items-center group relative overflow-hidden"
                              >
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-500 rounded-l-xl"></div>
                                <div className="min-w-0 pr-4 pl-2">
                                  <p className="font-medium text-zinc-200 truncate">{product.description}</p>
                                  <p className="text-sm text-zinc-500 truncate">{product.brandOwner || product.foodCategory || 'Generic'}</p>
                                </div>
                                <div className="text-right shrink-0 bg-zinc-900 px-3 py-1 rounded-lg group-hover:bg-zinc-800 transition-colors">
                                  <span className="text-orange-400 font-bold">
                                    {Math.round(product.foodNutrients?.find(n => n.nutrientName === 'Energy' || n.nutrientName === 'Energy (Atwater General Factors)')?.value || 0)}
                                  </span>
                                  <span className="text-xs text-zinc-500 ml-1">kcal/100g</span>
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-center p-8 text-zinc-600 mt-8">
                          <Star size={48} className="mx-auto mb-4 opacity-20" />
                          <p>No favorites yet.</p>
                          <p className="text-sm mt-1">Search for a food and tap the star icon to save it here.</p>
                        </div>
                      )}
                    </div>
                  )}
                  {fetchError && (
                    <div className="flex flex-col items-center justify-center h-full text-red-500 p-8 text-center">
                      <p>{fetchError}</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              // View 2: Enter Weight & Confirm
              <div className="flex-1 flex flex-col p-6 overflow-y-auto">
                <button 
                  onClick={() => setSelectedProduct(null)}
                  className="flex items-center text-sm text-blue-500 mb-6 hover:text-blue-400 w-fit"
                >
                  <ChevronLeft size={16} className="mr-1"/> Back to search
                </button>
                
                <div className="flex justify-between items-start mb-8 gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-2xl font-bold text-white mb-1 leading-tight">{selectedProduct.description}</h3>
                    <p className="text-zinc-500 truncate">{selectedProduct.brandOwner || selectedProduct.foodCategory || 'Generic brand'}</p>
                  </div>
                  <button 
                    onClick={() => toggleFavorite(selectedProduct)}
                    className={`p-3 rounded-xl transition-all shrink-0 ${
                      favorites.some(f => f.fdcId === selectedProduct.fdcId) 
                        ? 'bg-yellow-500/20 text-yellow-500' 
                        : 'bg-zinc-900 text-zinc-500 hover:text-yellow-500'
                    }`}
                    title="Toggle Favorite"
                  >
                    <Star size={24} fill={favorites.some(f => f.fdcId === selectedProduct.fdcId) ? "currentColor" : "none"} />
                  </button>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6 mb-8 shadow-inner">
  <label className="block text-sm font-medium text-zinc-400 mb-3 sm:mb-4">Amount Consumed</label>
  <div className="flex gap-3 sm:gap-4">
    <input 
      type="number"
      autoFocus
      className="flex-1 min-w-0 w-full bg-zinc-950 border border-zinc-700 rounded-xl py-3 px-3 sm:py-4 sm:px-4 text-xl sm:text-2xl font-bold text-white focus:outline-none focus:border-blue-500"
      value={servingAmount}
      onChange={(e) => setServingAmount(e.target.value)}
      placeholder="0"
    />
    <select 
      className="w-24 sm:w-32 shrink-0 bg-zinc-950 border border-zinc-700 rounded-xl py-3 px-2 sm:py-4 sm:px-4 text-lg sm:text-xl font-bold text-white focus:outline-none focus:border-blue-500 appearance-none text-center"
      value={servingUnit}
      onChange={(e) => setServingUnit(e.target.value)}
    >
      <option value="g">grams</option>
      <option value="oz">oz</option>
    </select>
  </div>
</div>

                <div className="mt-auto pt-4 space-y-4">
                  <button 
                    onClick={handleAddFood}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg py-4 rounded-xl shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98]"
                  >
                    Log Food
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}