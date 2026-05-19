import React, { useState, useEffect } from 'react';
import { 
  Search, 
  MapPin, 
  ShoppingBag, 
  User, 
  ChevronRight, 
  Star, 
  Clock, 
  Bike,
  Menu as MenuIcon,
  X,
  Plus,
  Minus,
  ArrowLeft,
  ChevronLeft,
  CheckCircle2,
  Package,
  History,
  LogOut,
  Ticket,
  Trophy,
  LayoutDashboard,
  Home,
  Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Types
interface Product {
  id: number;
  restaurante_id: number;
  nome: string;
  descricao: string;
  preco: number;
  categoria: string;
}

interface Restaurant {
  id: number;
  nome: string;
  descricao: string;
  categoria: string;
  logo_url: string;
  pedido_minimo: number;
  tempo_preparo: number;
  avaliacao_media: number;
  total_avaliacoes: number;
  logradouro: string;
  bairro: string;
  produtos?: Product[];
}

interface CartItem extends Product {
  quantity: number;
}

interface Order {
  id: string;
  restaurante_nome: string;
  restaurante_logo?: string;
  total: number;
  status: string;
  criado_em: string;
  itens: CartItem[];
  pontos_ganhos: number;
  endereco: string;
}

interface UserAdmin {
  id: number;
  nome: string;
  email: string;
  tipo: string;
  ativo: boolean;
  permissoes?: Record<string, string[]>;
}

// Views: 'home' | 'restaurant' | 'cart' | 'auth' | 'history' | 'dashboard' | 'addresses' | 'profile' | 'delivery' | 'management' | 'accept_invite'
type AppView = 'home' | 'restaurant' | 'cart' | 'auth' | 'history' | 'dashboard' | 'addresses' | 'profile' | 'delivery' | 'management' | 'accept_invite';

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRest, setSelectedRest] = useState<Restaurant | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [showToast, setShowToast] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  
  // Admin Gestao states
  const [usersList, setUsersList] = useState<UserAdmin[]>([]);
  const [invitesList, setInvitesList] = useState<any[]>([]);
  const [logsList, setLogsList] = useState<any[]>([]);
  const [inviteToken, setInviteToken] = useState(''); // for acceptance flow
  const [newInviteData, setNewInviteData] = useState({ email: '', tipo: 'admin' as any, permissoes: {} as any });

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [newAddr, setNewAddr] = useState({ logradouro: '', numero: '', bairro: '', complemento: '' });

  useEffect(() => {
    fetchRestaurants();
    const urlParams = new URLSearchParams(window.location.search);
    const inviteTokenParam = urlParams.get('convite');
    if (inviteTokenParam) {
      setInviteToken(inviteTokenParam);
      setView('accept_invite');
    }

    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const u = JSON.parse(storedUser);
      setUser(u);
      fetchAddresses();
      if (u.tipo === 'admin' || u.tipo === 'dono_master') fetchStatusData(u);
      if (u.tipo === 'entregador') {
        setView('delivery');
        fetchOrders();
      }
    }
  }, []);

  const fetchStatusData = (u: any) => {
    fetchStats();
    if (u.tipo === 'dono_master') {
      fetchUsersAdmin();
      fetchInvites();
    }
  }

  const fetchUsersAdmin = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/admin_gestao/usuarios', { headers: { 'Authorization': `Bearer ${token}` }});
    const data = await res.json();
    if (Array.isArray(data)) setUsersList(data);
  };

  const fetchInvites = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/admin_gestao/convites', { headers: { 'Authorization': `Bearer ${token}` }});
    const data = await res.json();
    if (Array.isArray(data)) setInvitesList(data);
  };

  const fetchLogData = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/admin_gestao/logs', { headers: { 'Authorization': `Bearer ${token}` }});
    const data = await res.json();
    if (Array.isArray(data)) setLogsList(data);
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const res = await fetch('/api/auth/convidar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(newInviteData)
    });
    const data = await res.json();
    if (data.token) {
      alert(`CONVITE GERADO!\nLink: ${window.location.origin}?convite=${data.token}`);
      fetchInvites();
      setNewInviteData({ email: '', tipo: 'admin', permissoes: {} });
    }
  };

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auth/aceitar-convite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: inviteToken, senha: password, nome: name, telefone: phone })
    });
    const data = await res.json();
    if (data.token) {
       localStorage.setItem('token', data.token);
       localStorage.setItem('user', JSON.stringify(data.usuario));
       setUser(data.usuario);
       window.history.replaceState({}, '', '/');
       if (data.usuario.tipo === 'entregador') setView('delivery');
       else if (['admin', 'dono_master'].includes(data.usuario.tipo)) setView('dashboard');
       else setView('home');
    } else {
      alert(data.erro);
    }
  };

  const toggleUserStatus = async (userId: number, currentStatus: boolean) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/admin_gestao/usuarios/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ ativo: !currentStatus })
    });
    fetchUsersAdmin();
  };

  const fetchRestaurants = () => {
    setLoading(true);
    fetch('/api/restaurantes')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setRestaurants(data);
        setLoading(false);
      });
  };

  const fetchOrders = () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch('/api/pedidos', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setOrders(data));
  };

  const fetchAddresses = () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch('/api/enderecos', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setAddresses(data));
  };

  const fetchStats = () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch('/api/admin/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setStats(data));
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/registro';
    // Logic: if email contains 'admin', 'moto' or 'rest', set type automatically for demo
    let tipo = 'cliente';
    if (email.includes('admin')) tipo = 'admin';
    else if (email.includes('moto')) tipo = 'entregador';
    else if (email.includes('rest')) tipo = 'restaurante';

    const body = authMode === 'login' ? { email, senha: password } : { nome: name, email, senha: password, tipo };
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.usuario));
        setUser(data.usuario);
        
        if (data.usuario.tipo === 'entregador') setView('delivery');
        else if (['admin', 'dono_master', 'operador', 'financeiro', 'suporte'].includes(data.usuario.tipo)) setView('dashboard');
        else setView('home');

        fetchAddresses();
        if (data.usuario.tipo === 'admin' || data.usuario.tipo === 'restaurante') fetchStats();
      } else {
        alert(data.erro || 'Erro na autenticação');
      }
    } catch (err) {
      alert('Erro ao conectar ao servidor');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setView('home');
  };

  const selectRestaurant = async (rest: Restaurant) => {
    setSelectedRest(rest);
    setView('restaurant');
    const res = await fetch(`/api/restaurantes/${rest.id}`);
    const data = await res.json();
    setSelectedRest(data);
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: Math.max(0, item.quantity - 1) } : item).filter(item => item.quantity > 0));
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.preco * item.quantity), 0);
  const deliveryFee = subtotal > 0 ? 6.50 : 0;
  const total = subtotal + deliveryFee;

  const placeOrder = async () => {
    if (!user) {
      setView('auth');
      return;
    }
    const token = localStorage.getItem('token');
    const mainAddr = addresses.find(a => a.principal) || addresses[0];
    const orderData = {
      restaurante_id: selectedRest?.id,
      itens: cart,
      subtotal,
      taxa: deliveryFee,
      total,
      forma_pagamento: 'pix',
      endereco: mainAddr ? `${mainAddr.logradouro}, ${mainAddr.numero} - ${mainAddr.bairro}` : 'Endereço não definido'
    };

    try {
      const res = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(orderData)
      });
      if (res.ok) {
        const order = await res.json();
        setCart([]);
        setView('history');
        fetchOrders();
        // Update local user points for immediate feedback
        const updatedUser = { ...user, pontos: (user.pontos || 0) + (order.pontos_ganhos || 0) };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
    } catch (err) {
      alert('Erro ao realizar pedido');
    }
  };

  const addAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const res = await fetch('/api/enderecos', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(newAddr)
    });
    if (res.ok) {
      setNewAddr({ logradouro: '', numero: '', bairro: '', complemento: '' });
      fetchAddresses();
    }
  };

  const setPrincipalAddress = async (id: number) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/enderecos/${id}/principal`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchAddresses();
  };

  const updateOrderStatus = async (id: string, status: string) => {
    const token = localStorage.getItem('token');
    await fetch(`/api/pedidos/${id}/status`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });
    fetchOrders();
    fetchStats();
  };

  const filtered = (Array.isArray(restaurants) ? restaurants : []).filter(r => 
    r.nome.toLowerCase().includes(search.toLowerCase()) ||
    r.categoria.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#FDFDFD] font-sans text-neutral-900 pb-20 md:pb-0">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-neutral-100">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setView(user?.tipo === 'entregador' ? 'delivery' : 'home')}>
             <div className="bg-sky-500 p-2 rounded-xl shadow-lg rotate-3 group-hover:rotate-0 transition-transform">
               <ShoppingBag className="w-5 h-5 text-white" />
             </div>
             <div className="bg-sky-500 px-4 py-1.5 rounded-2xl shadow-sm rotate-[-1deg] group-hover:rotate-0 transition-transform">
                <span className="text-xl font-black tracking-tighter text-white italic">
                  {user?.tipo === 'entregador' ? 'ENTREGADOR ' : 'GRAJA'}
                  <span className={user?.tipo === 'entregador' ? 'text-white' : 'text-white/80'}>{user?.tipo === 'entregador' ? 'FOOD' : 'FOOD'}</span>
                </span>
             </div>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <button 
              onClick={() => { setView('addresses'); fetchAddresses(); }}
              className="flex items-center gap-2 text-[10px] font-black text-neutral-400 bg-neutral-50 px-4 py-2 rounded-2xl hover:bg-neutral-100 transition-all border border-neutral-100"
            >
              <MapPin className="w-4 h-4 text-sky-500" />
              <span>{addresses.find(a => a.principal)?.bairro || 'DEFINIR ENDEREÇO'}</span>
            </button>
            <div className="h-6 w-[1px] bg-neutral-200" />
            {user ? (
               <button onClick={() => setView('profile')} className="flex items-center gap-2 group">
                  <div className="text-right">
                     <p className="text-[10px] font-black text-neutral-400 leading-none mb-0.5">{user.nivel?.toUpperCase()}</p>
                     <p className="text-xs font-bold leading-none">{user.nome.split(' ')[0]}</p>
                  </div>
                  <div className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center border-2 border-white shadow-sm overflow-hidden group-hover:border-sky-500 transition-colors">
                     <User className="w-5 h-5 text-neutral-400" />
                  </div>
               </button>
            ) : (
              <button 
                onClick={() => setView('auth')}
                className="bg-neutral-900 text-white text-[10px] font-black px-6 py-2.5 rounded-full hover:bg-sky-500 transition-all tracking-widest"
              >
                LOGIN
              </button>
            )}
          </div>
          
          <div className="md:hidden">
             {cart.length > 0 && view !== 'cart' && (
               <button 
                 onClick={() => setView('cart')}
                 className="relative p-2"
               >
                 <ShoppingBag className="w-6 h-6 text-neutral-900" />
                 <span className="absolute top-0 right-0 bg-sky-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white">
                   {cart.length}
                 </span>
               </button>
             )}
          </div>
        </div>
      </nav>

      <AnimatePresence mode="wait">
        {/* --- HOME VIEW --- */}
        {view === 'home' && (
          <motion.div 
            key="home"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <header className="bg-white py-12 md:py-20 border-b border-neutral-50 overflow-hidden relative">
              <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-96 h-96 bg-sky-50 rounded-full blur-3xl opacity-50" />
              <div className="max-w-7xl mx-auto px-4 text-center relative z-10">
                <motion.div 
                   initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                   className="inline-flex items-center gap-2 bg-sky-50 text-sky-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-6"
                >
                  <Trophy className="w-3.5 h-3.5" /> 
                  O Delivery Oficial do Grajaú
                </motion.div>
                
                <h1 className="text-5xl md:text-8xl font-black tracking-tighter mb-6 uppercase leading-[0.85] text-neutral-900">
                   FOME DE <span className="text-sky-500">QUÊ</span> NO FUNDÃO?
                </h1>
                
                <div className="relative max-w-2xl mx-auto mt-12 group">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-neutral-300 group-focus-within:text-sky-500 transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Buscar burger, pizza, marmitex..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-16 pr-6 py-6 bg-white border-2 border-neutral-100 rounded-[2.5rem] focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 transition-all shadow-xl shadow-neutral-100/50 outline-none font-bold text-lg"
                  />
                </div>
              </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-12 pb-32">
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-3xl font-black uppercase tracking-tighter italic">RESTAURANTES</h2>
                {user && (user.tipo === 'admin' || user.tipo === 'restaurante') && (
                  <button onClick={() => { setView('dashboard'); fetchStats(); }} className="flex items-center gap-2 text-[10px] font-black bg-sky-500 text-white px-4 py-2 rounded-xl shadow-lg">
                    DASHBOARD <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filtered.map((rest, idx) => (
                  <motion.div 
                    key={rest.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => selectRestaurant(rest)}
                    className="group bg-white rounded-[3rem] border border-neutral-100 overflow-hidden hover:shadow-2xl hover:shadow-sky-500/10 transition-all cursor-pointer relative"
                  >
                    <div className="relative h-64 overflow-hidden">
                      <img src={rest.logo_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-8">
                         <div className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xl">
                            <Star className="w-4 h-4 text-sky-500 fill-sky-500" />
                            <span className="text-sm font-black">{rest.avaliacao_media}</span>
                         </div>
                      </div>
                    </div>
                    <div className="p-8">
                      <h3 className="font-black text-2xl mb-1 group-hover:text-sky-500 transition-colors uppercase tracking-tight italic">{rest.nome}</h3>
                      <p className="text-sm text-neutral-400 mb-6 font-medium line-clamp-1">{rest.descricao}</p>
                      <div className="flex items-center justify-between text-[10px] font-black tracking-widest text-neutral-500 uppercase">
                        <span className="flex items-center gap-1.5 bg-neutral-50 px-4 py-2 rounded-xl"><Clock className="w-4 h-4 text-sky-500" /> {rest.tempo_preparo} MIN</span>
                        <span className="text-green-600 border border-green-100 px-4 py-1.5 rounded-xl">Frete R$ 6,50</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </main>
          </motion.div>
        )}

        {/* --- RESTAURANT DETAIL --- */}
        {view === 'restaurant' && selectedRest && (
          <motion.div 
            key="restaurant"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="pb-32 bg-white min-h-screen"
          >
            <div className="max-w-5xl mx-auto px-4 py-8">
              <button onClick={() => setView('home')} className="flex items-center gap-2 text-[10px] font-black text-neutral-400 mb-8 hover:text-neutral-900 border border-neutral-100 px-4 py-2 rounded-xl self-start bg-neutral-50 uppercase tracking-widest">
                <ArrowLeft className="w-3 h-3" /> Voltar
              </button>

              <div className="flex flex-col md:flex-row gap-12 mb-16 items-center md:items-start text-center md:text-left">
                <img src={selectedRest.logo_url} className="w-72 h-72 object-cover rounded-[2.5rem] shadow-2xl" />
                <div className="flex-1 py-4">
                  <h1 className="text-6xl md:text-8xl font-black mb-4 uppercase tracking-tighter italic leading-none">{selectedRest.nome}</h1>
                  <p className="text-neutral-400 text-xl font-medium max-w-xl">{selectedRest.descricao}</p>
                  <div className="flex flex-wrap gap-6 mt-8 justify-center md:justify-start">
                    <div className="bg-neutral-50 px-8 py-4 rounded-3xl border border-neutral-100">
                      <p className="text-[10px] font-black text-neutral-300 uppercase tracking-widest mb-1">Preparo</p>
                      <p className="font-black text-2xl">{selectedRest.tempo_preparo} min</p>
                    </div>
                    <div className="bg-neutral-50 px-8 py-4 rounded-3xl border border-neutral-100">
                      <p className="text-[10px] font-black text-neutral-300 uppercase tracking-widest mb-1">Mínimo</p>
                      <p className="font-black text-2xl text-green-600">R$ {selectedRest.pedido_minimo.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {selectedRest.produtos?.map(prod => (
                  <motion.div 
                    key={prod.id} 
                    whileHover={{ scale: 1.02 }}
                    className="bg-white p-8 rounded-[3rem] border border-neutral-100 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between group"
                  >
                    <div className="flex justify-between items-start mb-8">
                       <div className="pr-6">
                         <h4 className="text-2xl font-black uppercase tracking-tight italic group-hover:text-sky-500 transition-colors mb-2">{prod.nome}</h4>
                         <p className="text-sm text-neutral-400 font-medium leading-relaxed">{prod.descricao}</p>
                       </div>
                       <span className="text-2xl font-black text-neutral-900">R$ {prod.preco.toFixed(2)}</span>
                    </div>
                    <button 
                      onClick={() => addToCart(prod)}
                      className="w-full flex items-center justify-center gap-3 bg-neutral-900 text-white py-5 rounded-[2rem] hover:bg-sky-500 transition-all font-black uppercase tracking-widest text-xs shadow-xl active:scale-95"
                    >
                      <Plus className="w-5 h-5" /> ADICIONAR AO CARRINHO
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* --- CART VIEW --- */}
        {view === 'cart' && (
          <motion.div 
            key="cart" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto px-4 py-12 md:py-20 pb-40"
          >
            <h1 className="text-4xl font-black uppercase tracking-tighter italic mb-12">MINHA SACOLA</h1>
            
            {cart.length === 0 ? (
              <div className="text-center py-32 bg-white rounded-[4rem] border-4 border-dashed border-neutral-50">
                 <ShoppingBag className="w-20 h-20 text-neutral-100 mx-auto mb-6" />
                 <p className="text-neutral-400 font-black uppercase tracking-widest text-sm mb-8">Sacola vazia</p>
                 <button onClick={() => setView('home')} className="bg-neutral-900 text-white px-10 py-4 rounded-[2rem] font-black uppercase tracking-widest text-[10px] hover:bg-orange-500 shadow-xl transition-all">RESTAURANTES</button>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="bg-white rounded-[4rem] border border-neutral-100 shadow-sm overflow-hidden">
                  <div className="p-10 space-y-8">
                     {cart.map(item => (
                       <div key={item.id} className="flex justify-between items-center">
                          <div className="flex-1 pr-6">
                             <p className="text-xl font-black uppercase tracking-tight italic">{item.nome}</p>
                             <p className="text-xs font-black text-neutral-400 uppercase tracking-widest">R$ {item.preco.toFixed(2)}/cada</p>
                          </div>
                          <div className="flex items-center gap-4 bg-neutral-50 px-4 py-3 rounded-[2rem] border border-neutral-100">
                             <button onClick={() => removeFromCart(item.id)} className="p-2 hover:text-red-500 transition-colors"><Minus className="w-4 h-4" /></button>
                             <span className="font-black text-xl w-6 text-center">{item.quantity}</span>
                             <button onClick={() => addToCart(item)} className="p-2 hover:text-sky-500 transition-colors"><Plus className="w-4 h-4" /></button>
                          </div>
                       </div>
                     ))}
                  </div>
                  
                  <div className="bg-neutral-900 text-white p-10">
                     <div className="space-y-4 mb-8">
                        <div className="flex justify-between font-bold text-neutral-400 text-sm uppercase tracking-widest">
                           <span>Subtotal</span>
                           <span>R$ {subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-neutral-400 text-sm uppercase tracking-widest">
                           <span>Taxa de Entrega</span>
                           <span className="text-green-500">R$ {deliveryFee.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center border-t border-white/10 pt-8 mt-4">
                           <span className="text-3xl font-black italic tracking-tighter uppercase">Total</span>
                           <span className="text-4xl font-black italic tracking-tighter text-sky-500">R$ {total.toFixed(2)}</span>
                        </div>
                     </div>
                  </div>
                </div>

                <div onClick={() => { setView('addresses'); fetchAddresses(); }} className="bg-white p-10 rounded-[4rem] border border-neutral-100 shadow-sm cursor-pointer hover:border-sky-200 transition-all flex items-center gap-6">
                   <div className="w-16 h-16 bg-sky-500 rounded-3xl flex items-center justify-center shadow-xl shadow-sky-500/20 rotate-3">
                      <MapPin className="w-8 h-8 text-white" />
                   </div>
                   <div className="flex-1">
                      <p className="text-xs font-black text-neutral-300 uppercase tracking-widest mb-1">LOCAL DE ENTREGA</p>
                      <p className="text-xl font-black uppercase tracking-tight italic">
                        {addresses.find(a => a.principal)?.logradouro ? `${addresses.find(a => a.principal).logradouro}, ${addresses.find(a => a.principal).numero}` : 'DEFINIR ENDEREÇO'}
                      </p>
                   </div>
                </div>

                <button 
                  onClick={placeOrder}
                  className="w-full py-8 bg-neutral-900 text-white rounded-[2.5rem] font-black text-3xl uppercase tracking-tighter italic shadow-2xl hover:bg-sky-500 transition-all"
                >
                  FINALIZAR PEDIDO R$ {total.toFixed(2)}
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* --- PROFILE / LOYALTY VIEW --- */}
        {view === 'profile' && user && (
           <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-xl mx-auto px-4 py-20 pb-40">
              <div className="text-center mb-16">
                 <div className="relative inline-block mb-8">
                    <div className="w-32 h-32 bg-neutral-900 rounded-[3rem] shadow-2xl flex items-center justify-center text-4xl border-4 border-white rotate-3">
                       <User className="w-12 h-12 text-sky-500" />
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-sky-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl border-2 border-white">
                       {user.nivel}
                    </div>
                 </div>
                 <h1 className="text-4xl font-black uppercase tracking-tighter italic">{user.nome}</h1>
                 <p className="text-neutral-400 font-bold mt-2 uppercase tracking-widest text-[10px]">{user.email}</p>
              </div>

              <div className="bg-white p-10 rounded-[4rem] border border-neutral-100 shadow-sm mb-8 text-center">
                 <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-6 flex items-center justify-center gap-2">
                   <Trophy className="w-4 h-4 text-sky-500" /> GRAJAPONTOS ACUMULADOS
                 </p>
                 <p className="text-7xl font-black italic tracking-tighter text-neutral-900 leading-none">{user.pontos || 0}</p>
              </div>

              <div className="space-y-4">
                 <button onClick={() => { setView('history'); fetchOrders(); }} className="w-full flex items-center justify-between p-6 bg-white rounded-3xl border border-neutral-100 transition-colors font-black uppercase tracking-widest text-xs shadow-sm">
                    Histórico <History className="w-5 h-5 text-sky-500" />
                 </button>
                 <button onClick={() => { setView('addresses'); fetchAddresses(); }} className="w-full flex items-center justify-between p-6 bg-white rounded-3xl border border-neutral-100 transition-colors font-black uppercase tracking-widest text-xs shadow-sm">
                    Endereços <MapPin className="w-5 h-5 text-sky-500" />
                 </button>
                 <button onClick={logout} className="w-full flex items-center justify-between p-6 bg-red-50 text-red-600 rounded-3xl font-black uppercase tracking-widest text-xs mt-12">
                    Sair <LogOut className="w-5 h-5" />
                 </button>
              </div>
           </motion.div>
        )}

        {/* --- MANAGEMENT VIEW (Dono Master) --- */}
        {view === 'management' && user?.tipo === 'dono_master' && (
           <motion.div key="management" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto px-4 py-20 pb-40">
              <div className="flex items-center justify-between mb-12">
                 <h1 className="text-5xl font-black uppercase tracking-tighter italic">GESTÃO DE USUÁRIOS</h1>
                 <button onClick={fetchUsersAdmin} className="text-xs font-black bg-neutral-100 px-4 py-2 rounded-xl">ATUALIZAR</button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                 <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-6">USUÁRIOS ATIVOS</h3>
                    {usersList.map(u => (
                       <div key={u.id} className="bg-white p-6 rounded-[2.5rem] border border-neutral-100 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center">
                                <User className="w-6 h-6 text-neutral-400" />
                             </div>
                             <div>
                                <p className="font-black uppercase italic leading-none">{u.nome}</p>
                                <p className="text-[10px] font-bold text-neutral-400 mt-1">{u.email}</p>
                                <span className="text-[8px] font-black bg-sky-50 text-sky-600 px-2 py-0.5 rounded-full uppercase ml-1">{u.tipo}</span>
                             </div>
                          </div>
                          <button 
                             onClick={() => toggleUserStatus(u.id, u.ativo)}
                             className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${u.ativo ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                          >
                             {u.ativo ? 'DESATIVAR' : 'ATIVAR'}
                          </button>
                       </div>
                    ))}
                 </div>

                 <div className="space-y-8">
                    <div className="bg-neutral-900 text-white p-10 rounded-[3.5rem] shadow-2xl">
                       <h3 className="text-2xl font-black uppercase italic mb-6">CONVIDAR NOVO</h3>
                       <form onSubmit={handleCreateInvite} className="space-y-4">
                          <input 
                             type="email" placeholder="E-MAIL" required 
                             className="w-full p-4 bg-white/10 rounded-2xl border-none text-xs font-bold" 
                             value={newInviteData.email} 
                             onChange={e => setNewInviteData({...newInviteData, email: e.target.value})}
                          />
                          <select 
                             className="w-full p-4 bg-white/10 rounded-2xl border-none text-xs font-bold uppercase"
                             value={newInviteData.tipo}
                             onChange={e => setNewInviteData({...newInviteData, tipo: e.target.value as any})}
                          >
                             <option value="admin">Administrador</option>
                             <option value="operador">Operador</option>
                             <option value="financeiro">Financeiro</option>
                             <option value="suporte">Suporte</option>
                             <option value="entregador">Entregador</option>
                          </select>
                          <button type="submit" className="w-full py-4 bg-sky-500 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-sky-500/20">ENVIAR CONVITE</button>
                       </form>
                    </div>

                    <div className="bg-white p-8 rounded-[3rem] border border-neutral-100">
                       <h3 className="text-xs font-black uppercase tracking-widest mb-6 flex items-center gap-2">
                          <History className="w-4 h-4 text-sky-500" /> LOGS RECENTES
                       </h3>
                       <div className="space-y-4">
                          {logsList.slice(0, 5).map(l => (
                             <div key={l.id} className="text-[9px] border-b border-neutral-50 pb-2">
                                <p className="font-black text-neutral-900 uppercase">{l.acao}</p>
                                <p className="text-neutral-400 font-medium">{l.detalhes}</p>
                             </div>
                          ))}
                          <button onClick={fetchLogData} className="w-full text-[8px] font-black text-sky-500 uppercase">VER TUDO</button>
                       </div>
                    </div>
                 </div>
              </div>
           </motion.div>
        )}

        {/* --- ACCEPT INVITE VIEW --- */}
        {view === 'accept_invite' && (
           <motion.div key="accept_invite" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md mx-auto px-4 py-24 pb-40">
              <div className="bg-white p-12 rounded-[5rem] border border-neutral-100 shadow-2xl relative overflow-hidden text-center">
                 <div className="absolute top-0 left-0 w-full h-2 bg-sky-500" />
                 <h2 className="text-4xl font-black uppercase tracking-tighter italic mb-3">BEM-VINDO AO TIME</h2>
                 <p className="text-xs font-bold text-neutral-400 mb-8 uppercase tracking-widest italic">Crie sua senha para acessar a plataforma</p>
                 <form onSubmit={handleAcceptInvite} className="space-y-4">
                    <input type="text" placeholder="SEU NOME" required value={name} onChange={(e) => setName(e.target.value)} className="w-full p-5 bg-neutral-50 rounded-[2rem] border-none font-bold" />
                    <input type="text" placeholder="TELEFONE" required value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full p-5 bg-neutral-50 rounded-[2rem] border-none font-bold" />
                    <input type="password" placeholder="DEFINIR SENHA" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-5 bg-neutral-50 rounded-[2rem] border-none font-bold" />
                    <button type="submit" className="w-full py-6 bg-neutral-900 text-white font-black uppercase tracking-widest text-xs rounded-[2rem] shadow-xl hover:bg-sky-500 transition-all mt-6">FINALIZAR CADASTRO</button>
                 </form>
              </div>
           </motion.div>
        )}

        {/* --- DELIVERY VIEW (MOTOBOY) --- */}
        {view === 'delivery' && (
           <motion.div key="delivery" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-xl mx-auto px-4 py-20 pb-40">
              <div className="flex items-center justify-between mb-12">
                 <h1 className="text-4xl font-black uppercase tracking-tighter italic">ENTREGADOR</h1>
                 <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-green-500 uppercase">Online</span>
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                 </div>
              </div>

              <div className="bg-sky-500 p-10 rounded-[4rem] text-white shadow-2xl shadow-sky-500/20 mb-12">
                 <p className="text-[10px] font-black opacity-80 uppercase tracking-widest mb-2">GANHOS DO DIA</p>
                 <p className="text-6xl font-black italic tracking-tighter">R$ 142,50</p>
                 <div className="mt-8 flex gap-4">
                    <div className="bg-white/10 px-6 py-3 rounded-2xl">
                       <p className="text-[8px] font-black opacity-60">CORRIDAS</p>
                       <p className="font-black text-xl">12</p>
                    </div>
                    <div className="bg-white/10 px-6 py-3 rounded-2xl">
                       <p className="text-[8px] font-black opacity-60">KM RODADOS</p>
                       <p className="font-black text-xl">48km</p>
                    </div>
                 </div>
              </div>

              <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-6">PEDIDOS DISPONÍVEIS</h3>
              <div className="space-y-4">
                 {orders.filter(o => o.status === 'recebido' || o.status === 'preparando').length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-neutral-100">
                       <Bike className="w-12 h-12 text-neutral-100 mx-auto mb-4" />
                       <p className="text-neutral-300 font-black uppercase text-[10px] tracking-widest">Aguardando novos pedidos...</p>
                    </div>
                 ) : (
                    orders.filter(o => o.status === 'recebido' || o.status === 'preparando').map(order => (
                       <div key={order.id} className="bg-white p-8 rounded-[3rem] border border-neutral-100 shadow-sm">
                          <div className="flex justify-between items-start mb-6">
                             <div>
                                <p className="text-[10px] font-black text-sky-500 uppercase mb-1">R$ 6,50 de entrega</p>
                                <h4 className="text-2xl font-black uppercase italic">{order.restaurante_nome}</h4>
                             </div>
                             <div className="bg-neutral-50 px-4 py-2 rounded-xl text-xs font-black">2.4km</div>
                          </div>
                          <p className="text-xs font-bold text-neutral-400 uppercase mb-8"><MapPin className="w-3 h-3 inline mr-1" /> {order.endereco}</p>
                          <div className="grid grid-cols-2 gap-4">
                             <a 
                               href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.endereco)}`} 
                               target="_blank" rel="noreferrer"
                               className="flex items-center justify-center py-4 bg-neutral-100 rounded-2xl font-black uppercase text-[8px] tracking-widest hover:bg-neutral-200 transition-all text-neutral-600"
                             >
                                <MapPin className="w-4 h-4 mr-2" /> NAVEGAR
                             </a>
                             <button 
                               onClick={() => updateOrderStatus(order.id, 'saiu')}
                               className="py-4 bg-neutral-900 text-white rounded-2xl font-black uppercase text-[8px] tracking-widest hover:bg-sky-500 transition-all shadow-lg shadow-sky-500/10"
                             >
                                ACEITAR CORRIDA
                             </button>
                          </div>
                       </div>
                    ))
                 )}
              </div>
           </motion.div>
        )}

        {/* --- ADRESSES VIEW --- */}
        {view === 'addresses' && (
           <motion.div key="addresses" initial={{ y: 20 }} animate={{ y: 0 }} className="max-w-xl mx-auto px-4 py-20 pb-40">
              <h1 className="text-5xl font-black uppercase tracking-tighter italic mb-12">MEUS LOCAIS</h1>
              <div className="space-y-4 mb-16">
                 {addresses.map(addr => (
                   <div key={addr.id} className={`p-8 rounded-[3rem] border-2 transition-all cursor-pointer flex justify-between items-center ${addr.principal ? 'border-sky-500 bg-sky-50/20' : 'border-neutral-100 bg-white'}`} onClick={() => setPrincipalAddress(addr.id)}>
                      <div className="flex-1">
                         <p className="font-black text-xl leading-none mb-2 uppercase italic">{addr.logradouro}, {addr.numero}</p>
                         <p className="text-sm font-bold text-neutral-400 uppercase tracking-widest">{addr.bairro}</p>
                      </div>
                      {addr.principal && <CheckCircle2 className="w-6 h-6 text-sky-500" />}
                   </div>
                 ))}
              </div>
              <div className="bg-white p-10 rounded-[4rem] border border-neutral-100 shadow-sm">
                 <h3 className="font-black text-2xl uppercase tracking-tighter mb-8">NOVO ENDEREÇO</h3>
                 <form onSubmit={addAddress} className="space-y-4">
                    <input type="text" placeholder="RUA / AVENIDA" required value={newAddr.logradouro} onChange={e => setNewAddr({...newAddr, logradouro: e.target.value})} className="w-full p-5 bg-neutral-50 rounded-[2rem] border-none font-bold uppercase text-[10px] tracking-widest" />
                    <div className="grid grid-cols-2 gap-4">
                       <input type="text" placeholder="Nº" required value={newAddr.numero} onChange={e => setNewAddr({...newAddr, numero: e.target.value})} className="w-full p-5 bg-neutral-50 rounded-[2rem] border-none font-bold uppercase text-[10px] tracking-widest" />
                       <input type="text" placeholder="BAIRRO" required value={newAddr.bairro} onChange={e => setNewAddr({...newAddr, bairro: e.target.value})} className="w-full p-5 bg-neutral-50 rounded-[2rem] border-none font-bold uppercase text-[10px] tracking-widest" />
                    </div>
                    <button type="submit" className="w-full py-6 bg-neutral-900 text-white font-black rounded-[2rem] shadow-xl hover:bg-sky-500 transition-all uppercase tracking-widest text-[10px]">SALVAR</button>
                 </form>
              </div>
           </motion.div>
        )}

        {/* --- DASHBOARD VIEW --- */}
        {view === 'dashboard' && stats && (
           <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto px-4 py-20 pb-40">
              <h1 className="text-6xl font-black uppercase tracking-tighter italic mb-12">DASHBOARD</h1>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                  <div className="bg-white p-10 rounded-[4rem] border border-neutral-100 shadow-sm">
                     <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-4">PEDIDOS</p>
                     <p className="text-5xl font-black">{stats.pedidos}</p>
                  </div>
                  <div className="bg-white p-10 rounded-[4rem] border border-neutral-100 shadow-sm">
                     <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-4">FATURAMENTO</p>
                     <p className="text-5xl font-black text-green-600">R$ {stats.faturamento.toFixed(2)}</p>
                  </div>
                  <div className="bg-white p-10 rounded-[4rem] border border-neutral-100 shadow-sm">
                     <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-4">MEMBROS</p>
                     <p className="text-5xl font-black">{stats.usuarios}</p>
                  </div>
              </div>
              <div className="bg-neutral-900 text-white rounded-[4rem] shadow-2xl overflow-hidden p-12">
                 <div className="flex justify-between items-center mb-10">
                    <h3 className="text-3xl font-black uppercase italic">Últimos Pedidos</h3>
                    <button onClick={fetchStats} className="bg-white/10 hover:bg-white/20 px-6 py-2 rounded-full font-black uppercase tracking-widest text-[10px]">REFRESH</button>
                 </div>
                 <div className="space-y-6">
                    {orders.map(order => (
                      <div key={order.id} className="p-8 border border-white/5 rounded-[3rem] flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                         <div>
                            <p className="text-[10px] font-black text-sky-500 uppercase tracking-widest mb-2">{order.id} | {new Date(order.criado_em).toLocaleTimeString()}</p>
                            <p className="text-2xl font-black uppercase tracking-tighter mb-1">{order.restaurante_nome}</p>
                            <p className="text-xs font-bold text-neutral-500 uppercase">{order.endereco}</p>
                         </div>
                         <div className="flex gap-2">
                            {['recebido', 'preparando', 'saiu', 'entregue'].map(st => (
                              <button key={st} onClick={() => updateOrderStatus(order.id, st)} className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase transition-all ${order.status === st ? 'bg-sky-500 text-white' : 'bg-white/5 text-neutral-500 hover:text-white'}`}>{st}</button>
                            ))}
                         </div>
                         <p className="text-3xl font-black italic tracking-tighter">R$ {order.total.toFixed(2)}</p>
                      </div>
                    ))}
                 </div>
              </div>
           </motion.div>
        )}

        {/* --- HISTORY VIEW --- */}
        {view === 'history' && (
           <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto px-4 py-20 pb-40">
              <h1 className="text-5xl font-black uppercase tracking-tighter italic mb-16">HISTÓRICO</h1>
              <div className="space-y-6">
                {orders.map(order => (
                  <div key={order.id} className="bg-white p-10 rounded-[4rem] border border-neutral-100 shadow-sm relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                     <div className="flex gap-6">
                        <img src={order.restaurante_logo || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100"} className="w-24 h-24 object-cover rounded-3xl" />
                        <div>
                           <p className="text-[10px] font-black text-neutral-300 uppercase tracking-widest mb-2">ID: {order.id}</p>
                           <h4 className="text-3xl font-black uppercase tracking-tighter italic leading-none">{order.restaurante_nome}</h4>
                           <p className="text-sm font-bold text-neutral-400 mt-2">{new Date(order.criado_em).toLocaleDateString()}</p>
                        </div>
                     </div>
                     <p className="text-4xl font-black italic tracking-tighter text-neutral-900">R$ {order.total.toFixed(2)}</p>
                     <span className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl ${['recebido', 'preparando', 'saiu'].includes(order.status) ? 'bg-sky-500 text-white' : 'bg-neutral-900 text-white'}`}>{order.status}</span>
                  </div>
                ))}
              </div>
           </motion.div>
        )}

        {/* --- AUTH VIEW --- */}
        {view === 'auth' && (
          <motion.div key="auth" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md mx-auto px-4 py-24 pb-40">
            <div className="bg-white p-12 rounded-[5rem] border border-neutral-100 shadow-2xl relative overflow-hidden text-center">
              <div className="absolute top-0 left-0 w-full h-2 bg-sky-500" />
              <h2 className="text-4xl font-black uppercase tracking-tighter italic mb-3">{authMode === 'login' ? 'LOGIN' : 'CADASTRO'}</h2>
              <form onSubmit={handleAuth} className="space-y-4">
                {authMode === 'register' && <input type="text" placeholder="NOME" required value={name} onChange={(e) => setName(e.target.value)} className="w-full p-5 bg-neutral-50 rounded-[2rem] border-none font-bold" />}
                <input type="email" placeholder="E-MAIL" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-5 bg-neutral-50 rounded-[2rem] border-none font-bold" />
                <input type="password" placeholder="SENHA" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-5 bg-neutral-50 rounded-[2rem] border-none font-bold" />
                <button type="submit" className="w-full py-6 bg-neutral-900 text-white font-black uppercase tracking-widest text-xs rounded-[2rem] shadow-xl hover:bg-sky-500 transition-all mt-6">ENTRAR</button>
              </form>
              <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="w-full mt-10 text-[10px] font-black text-neutral-400 hover:text-sky-500 uppercase tracking-widest">{authMode === 'login' ? 'NOVO POR AQUI?' : 'JÁ SOU DA CASA'}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Navigation (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-100 px-8 py-5 flex justify-between items-center z-50 rounded-t-[3rem] shadow-2xl">
        {user?.tipo === 'entregador' ? (
          <>
            <button onClick={() => { setView('delivery'); fetchOrders(); }} className={`p-1.5 transition-all ${view === 'delivery' ? 'text-sky-500 scale-125' : 'text-neutral-300'}`}><Bike className="w-7 h-7" /></button>
            <button onClick={() => { setView('history'); fetchOrders(); }} className={`p-1.5 transition-all ${view === 'history' ? 'text-sky-500 scale-125' : 'text-neutral-300'}`}><History className="w-7 h-7" /></button>
            <button onClick={() => setView('profile')} className={`p-1.5 transition-all ${view === 'profile' ? 'text-sky-500 scale-125' : 'text-neutral-300'}`}><User className="w-7 h-7" /></button>
          </>
        ) : ['admin', 'dono_master', 'operador', 'financeiro', 'suporte'].includes(user?.tipo) ? (
          <>
            <button onClick={() => { setView('dashboard'); fetchStats(); }} className={`p-1.5 transition-all ${view === 'dashboard' ? 'text-sky-500 scale-125' : 'text-neutral-300'}`}><LayoutDashboard className="w-7 h-7" /></button>
            <button onClick={() => { setView('home'); }} className={`p-1.5 transition-all ${view === 'home' ? 'text-sky-500 scale-125' : 'text-neutral-300'}`}><Home className="w-7 h-7" /></button>
            <button onClick={() => setView('profile')} className={`p-1.5 transition-all ${view === 'profile' ? 'text-sky-500 scale-125' : 'text-neutral-300'}`}><User className="w-7 h-7" /></button>
          </>
        ) : (
          <>
            <button onClick={() => setView('home')} className={`p-1.5 transition-all ${view === 'home' ? 'text-sky-500 scale-125' : 'text-neutral-300'}`}><Home className="w-7 h-7" /></button>
            <button onClick={() => { setView('history'); fetchOrders(); }} className={`p-1.5 transition-all ${view === 'history' ? 'text-sky-500 scale-125' : 'text-neutral-300'}`}><History className="w-7 h-7" /></button>
            <button onClick={() => setView('cart')} className={`p-1.5 transition-all ${view === 'cart' ? 'text-sky-500 scale-125' : 'text-neutral-300'} relative`}><ShoppingBag className="w-7 h-7" />{cart.length > 0 && <span className="absolute -top-1 -right-1 bg-sky-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">{cart.length}</span>}</button>
            <button onClick={() => { if(user) setView('profile'); else setView('auth'); }} className={`p-1.5 transition-all ${view === 'profile' || view === 'auth' ? 'text-sky-500 scale-125' : 'text-neutral-300'}`}><User className="w-7 h-7" /></button>
          </>
        )}
      </nav>

      <AnimatePresence>
        {showToast && (
          <motion.div initial={{ y: 100, x: '-50%', opacity: 0 }} animate={{ y: -120, x: '-50%', opacity: 1 }} exit={{ y: 100, x: '-50%', opacity: 0 }} className="fixed bottom-0 left-1/2 z-[100] bg-neutral-900 border border-white/10 text-white px-8 py-4 rounded-[2rem] font-black uppercase tracking-widest text-[10px] shadow-2xl flex items-center gap-3">
             <CheckCircle2 className="w-4 h-4 text-sky-500" /> Item na sacola
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
