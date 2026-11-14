import React, { useState, useEffect, useMemo } from 'react';
import { adminEmail, supabase } from './lib/supabase';
import {
  ShoppingBag, ShieldCheck, Calculator, Package, Settings, Plus, Trash2,
  ExternalLink, Copy, Check, Search, Filter, Users, DollarSign, TrendingUp,
  Scale, AlertCircle, Lock, Unlock, Sparkles, MessageCircle, Send, Instagram,
  CreditCard, CheckCircle2, Clock, X, Eye, LogOut, KeyRound, UserCheck,
  Edit3, Star, Database, UserPlus, LogIn, MapPin, Phone, User
} from 'lucide-react';

const sanitizeText = (input, maxLength = 200) => {
  if (typeof input !== 'string') return '';
  return input.replace(/[<>"'`]/g, '').trim().slice(0, maxLength);
};

const sanitizeUrl = (url) => {
  if (typeof url !== 'string' || !url.trim()) return '';
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
    return '';
  } catch {
    return '';
  }
};

const sanitizeNumber = (val, min = 0, max = 1000000000, fallback = 0) => {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(Math.max(num, min), max);
};

const safeLoadStorage = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      delete parsed.__proto__;
      delete parsed.constructor;
      delete parsed.prototype;
      return parsed;
    }
    return fallback;
  } catch {
    return fallback;
  }
};

const hashPasswordSHA256 = async (password) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

const authEmailForPhone = (phone) => `${phone.replace(/\D/g, '')}@customers.shein-sy.local`;

const STORAGE_KEYS = {
  SETTINGS: 'shein_sy_pricing_settings_v4',
  BATCHES: 'shein_sy_batches_v4',
  ORDERS: 'shein_sy_orders_v4',
  STOREFRONT: 'shein_sy_storefront_v4',
  ADMIN_AUTH: 'shein_sy_admin_auth_v5',
  ADMIN_SESSION: 'shein_sy_admin_session_active_v4',
  CUSTOMERS: 'shein_sy_customers_v3',
  CUSTOMER_SESSION: 'shein_sy_customer_session_v3'
};

const DEFAULT_ADMIN_AUTH = {
  username: 'admin',
  password: 'admin1234'
};

const DEFAULT_PRICING_SETTINGS = {
  sarToSypRate: 3950,
  usdToSypRate: 15000,
  safetyMarginPercent: 2.5,
  shippingPerKgSar: 45,
  commissionPercent: 15,
  discountCouponPercent: 15,
  adminFlatShippingSar: 25,
  adminCommissionPercent: 15
};

const DEFAULT_STOREFRONT = {
  brandName: 'شي إن سوريا إكسبرس | SHEIN SY',
  brandLogoText: 'SHEIN SY',
  heroTitle: 'اطلب منتجات شي إن الأصلية من السعودية إلى سوريا بكل سهولة وأمان',
  heroSubtitle: 'نوفر لك تجربة تسوق متكاملة من متجر شي إن الرسمي بأفضل سعر صرف، شحن سريع ومضمون، ودفع محلي ميسر عبر شام كاش.',
  aboutTitle: 'لماذا تطلب معنا؟',
  aboutText: 'نحن نربطك مباشرة بمتجر شي إن السعودية دون تعقيدات الدفع الإلكتروني أو الشحن الدولي، مع متابعة دقيقة لطلبك من لحظة التثبيت وحتى التسليم.',
  whatsappLink: 'https://wa.me/963900000000',
  telegramLink: 'https://t.me/shein_syria_demo',
  instagramLink: 'https://instagram.com/shein_syria_demo',
  shamCashAccount: 'SHAM-987654321 (الاسم: متجر شي إن سوريا)',
  deliveryEstimate: '15 إلى 22 يوم عمل',
  testimonials: [
    { id: 1, name: 'سارة م. - دمشق', text: 'القطع وصلت بتغليف شي إن الأصلي تماماً وبنفس الموعد المحدد، التعامل راقي جداً والأسعار أوفر من السوق بكثير.' },
    { id: 2, name: 'نور الهدى - حلب', text: 'أسهل تجربة طلب جربتها! أرسلت الروابط وحولت العربون بشام كاش وخلال أسبوعين استلمت طلبيتي كاملة.' },
    { id: 3, name: 'رغد ك. - اللاذقية', text: 'مصداقية عالية في الحسابات وسرعة في الرد على الاستفسارات والمقاسات. أكيد مو آخر تعامل.' }
  ]
};

const DEFAULT_BATCHES = [
  {
    id: 'batch-1',
    name: 'الدفعة #1 - شحنة الأسبوع الحالي',
    closeDate: new Date().toISOString().split('T')[0],
    status: 'مفتوحة لاستقبال الطلبات'
  }
];

const ORDER_STATUSES = [
  { value: 'بانتظار العربون', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'تم التثبيت والشراء', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'قيد الشحن من السعودية', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { value: 'وصلت لسوريا', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  { value: 'تم التسليم بالكامل', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
];

export default function App() {
  const [activeView, setActiveView] = useState('storefront');
  const [adminSubTab, setAdminSubTab] = useState('orders');

  const [adminAuth, setAdminAuth] = useState(() => safeLoadStorage(STORAGE_KEYS.ADMIN_AUTH, DEFAULT_ADMIN_AUTH));
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => sessionStorage.getItem(STORAGE_KEYS.ADMIN_SESSION) === 'true');
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminUserField, setAdminUserField] = useState('');
  const [adminPassField, setAdminPassField] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');

  const [customers, setCustomers] = useState(() => safeLoadStorage(STORAGE_KEYS.CUSTOMERS, []));
  const [currentCustomer, setCurrentCustomer] = useState(() => safeLoadStorage(STORAGE_KEYS.CUSTOMER_SESSION, null));
  const [showCustomerAuthModal, setShowCustomerAuthModal] = useState(false);
  const [customerAuthMode, setCustomerAuthMode] = useState('login');
  const [custPhone, setCustPhone] = useState('');
  const [custPassword, setCustPassword] = useState('');
  const [custName, setCustName] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custAuthError, setCustAuthError] = useState('');

  const [pricingSettings, setPricingSettings] = useState(() => safeLoadStorage(STORAGE_KEYS.SETTINGS, DEFAULT_PRICING_SETTINGS));
  const [batches, setBatches] = useState(() => {
    const loaded = safeLoadStorage(STORAGE_KEYS.BATCHES, DEFAULT_BATCHES);
    return Array.isArray(loaded) && loaded.length > 0 ? loaded : DEFAULT_BATCHES;
  });
  const [orders, setOrders] = useState(() => {
    const loaded = safeLoadStorage(STORAGE_KEYS.ORDERS, []);
    return Array.isArray(loaded) ? loaded : [];
  });
  const [storefrontData, setStorefrontData] = useState(() => safeLoadStorage(STORAGE_KEYS.STOREFRONT, DEFAULT_STOREFRONT));

  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(pricingSettings)); }, [pricingSettings]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.BATCHES, JSON.stringify(batches)); }, [batches]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders)); }, [orders]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.STOREFRONT, JSON.stringify(storefrontData)); }, [storefrontData]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, JSON.stringify(adminAuth)); }, [adminAuth]);
  useEffect(() => {
    if (!supabase) return;
    let active = true;

    const loadSupabaseSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !active) return;

      const [{ data: profile }, { data: remoteOrders }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
        supabase.from('orders').select('*').eq('customer_id', session.user.id).order('created_at', { ascending: false }),
      ]);

      if (profile) setCurrentCustomer(profile);
      if (remoteOrders) {
        setOrders(remoteOrders.map((order) => ({
          ...order,
          customerName: profile?.full_name || '',
          customerContact: profile?.phone || '',
          customerAddress: profile?.address || '',
          createdAt: new Date(order.created_at).toLocaleDateString('ar-SY'),
        })));
      }
    };

    loadSupabaseSession();
    const { data: listener } = supabase.auth.onAuthStateChange(() => loadSupabaseSession());
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => { if (!supabase) localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers)); }, [customers]);
  useEffect(() => {
    if (currentCustomer) {
      localStorage.setItem(STORAGE_KEYS.CUSTOMER_SESSION, JSON.stringify(currentCustomer));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CUSTOMER_SESSION);
    }
  }, [currentCustomer]);

  const handleAdminLogin = (e) => {
    e.preventDefault();
    const cleanUser = sanitizeText(adminUserField, 50);
    if (!cleanUser || !adminPassField) {
      setAdminLoginError('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }
    
    if (supabase) {
      handleSupabaseAdminLogin(cleanUser, adminPassField);
      return;
    }

    if (cleanUser === adminAuth.username && adminPassField === adminAuth.password) {
      sessionStorage.setItem(STORAGE_KEYS.ADMIN_SESSION, 'true');
      setIsAdminAuthenticated(true);
      setShowAdminLoginModal(false);
      setActiveView('admin');
      setAdminUserField('');
      setAdminPassField('');
      setAdminLoginError('');
      showToast('مرحباً بك مجدداً في لوحة الإدارة');
    } else {
      setAdminLoginError('بيانات دخول الإدارة غير صحيحة (اسم المستخدم: admin | كلمة المرور: admin1234)');
    }
  };

  const handleSupabaseAdminLogin = async (email, password) => {
    if (email.toLowerCase() !== adminAuth.username.toLowerCase()) {
      setAdminLoginError('اسم المستخدم أو كلمة المرور غير صحيحة');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: adminEmail, password });
    if (error) {
      setAdminLoginError(error.message || 'تعذر تسجيل دخول الإدارة');
      return;
    }

    sessionStorage.setItem(STORAGE_KEYS.ADMIN_SESSION, 'true');
    setIsAdminAuthenticated(true);
    setShowAdminLoginModal(false);
    setActiveView('admin');
    setAdminUserField('');
    setAdminPassField('');
    setAdminLoginError('');
    showToast('مرحباً بك في لوحة الإدارة');
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem(STORAGE_KEYS.ADMIN_SESSION);
    if (supabase) supabase.auth.signOut();
    setIsAdminAuthenticated(false);
    setActiveView('storefront');
    showToast('تم تسجيل خروج الإدارة بأمان');
  };

  useEffect(() => {
    if (!supabase || !isAdminAuthenticated) return;
    let active = true;

    const loadAdminData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.email?.toLowerCase() !== adminEmail.toLowerCase()) return;

      const [{ data: profiles, error: profilesError }, { data: remoteOrders, error: ordersError }] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('orders').select('*, profiles:customer_id(full_name, phone, address)').order('created_at', { ascending: false }),
      ]);

      if (!active) return;
      if (profilesError) {
        showToast(profilesError.message, 'error');
        return;
      }
      if (ordersError) {
        showToast(ordersError.message, 'error');
        return;
      }

      setCustomers((profiles || []).map((profile) => ({
        ...profile,
        name: profile.full_name,
        createdAt: new Date(profile.created_at).toLocaleDateString('ar-SY'),
      })));
      setOrders((remoteOrders || []).map((order) => ({
        ...order,
        customerName: order.profiles?.full_name || '',
        customerContact: order.profiles?.phone || '',
        customerAddress: order.profiles?.address || '',
        createdAt: new Date(order.created_at).toLocaleDateString('ar-SY'),
      })));
    };

    loadAdminData();
    return () => { active = false; };
  }, [isAdminAuthenticated]);

  const handleCustomerRegister = async (e) => {
    e.preventDefault();
    const phone = sanitizeText(custPhone, 20);
    const name = sanitizeText(custName, 60);
    const address = sanitizeText(custAddress, 150);

    if (!phone || !custPassword || !name || !address) {
      setCustAuthError('يرجى تعبئة كافة الحقول المطلوبة');
      return;
    }

    try {
      if (supabase) {
        const { data, error } = await supabase.auth.signUp({
          email: authEmailForPhone(phone),
          password: custPassword,
          options: { data: { full_name: name, phone, address } },
        });
        if (error) throw error;
        if (!data.user) throw new Error('تعذر إنشاء الحساب');
        const newCustomer = { id: data.user.id, phone, name, address };
        setCurrentCustomer(newCustomer);
        setShowCustomerAuthModal(false);
        showToast('تم إنشاء الحساب وتسجيل الدخول بنجاح أهلاً بك!');
      } else {
        const passHash = await hashPasswordSHA256(custPassword);
        const newCustomer = { id: `cust-${Date.now()}`, phone, name, address, passwordHash: passHash, createdAt: new Date().toLocaleDateString('ar-SY') };

        setCustomers([...customers, newCustomer]);
        setCurrentCustomer(newCustomer);
        setShowCustomerAuthModal(false);
        showToast('تم إنشاء الحساب وتسجيل الدخول بنجاح أهلاً بك!');
      }
      setCustPhone('');
      setCustPassword('');
      setCustName('');
      setCustAddress('');
      setCustAuthError('');
    } catch (error) {
      setCustAuthError(error.message || 'حدث خطأ أثناء حفظ البيانات');
    }
  };

  const handleCustomerLogin = async (e) => {
    e.preventDefault();
    const phone = sanitizeText(custPhone, 20);
    if (!phone || !custPassword) {
      setCustAuthError('يرجى إدخال رقم الهاتف وكلمة المرور');
      return;
    }

    try {
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmailForPhone(phone),
          password: custPassword,
        });
        if (error) throw error;
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
        setCurrentCustomer(profile);
        setShowCustomerAuthModal(false);
        setCustPhone('');
        setCustPassword('');
        setCustAuthError('');
        showToast('تم تسجيل الدخول بنجاح');
      } else {
        const customer = customers.find((c) => c.phone === phone);
        if (!customer) throw new Error('رقم الهاتف غير مسجل، يرجى إنشاء حساب جديد');
        const passHash = await hashPasswordSHA256(custPassword);
        if (passHash !== customer.passwordHash) throw new Error('كلمة المرور غير صحيحة');
        setCurrentCustomer(customer);
        setShowCustomerAuthModal(false);
        setCustPhone('');
        setCustPassword('');
        setCustAuthError('');
        showToast('تم تسجيل الدخول بنجاح');
      }
    } catch (error) {
      setCustAuthError(error.message || 'حدث خطأ أثناء التحقق');
    }
  };

  const handleCustomerLogout = async () => {
    if (supabase) await supabase.auth.signOut();
    setCurrentCustomer(null);
    setActiveView('storefront');
    showToast('تم تسجيل خروج العميل');
  };

  const [customerOrderForm, setCustomerOrderForm] = useState({
    cartUrl: '',
    originalSar: '',
    notes: ''
  });

  const effectiveExchangeRate = useMemo(() => {
    const base = sanitizeNumber(pricingSettings.sarToSypRate, 1, 1000000, 3950);
    const margin = sanitizeNumber(pricingSettings.safetyMarginPercent, 0, 100, 0);
    return base * (1 + margin / 100);
  }, [pricingSettings.sarToSypRate, pricingSettings.safetyMarginPercent]);

  const usdRate = useMemo(() => {
    return sanitizeNumber(pricingSettings.usdToSypRate, 1, 10000000, 15000);
  }, [pricingSettings.usdToSypRate]);

  const handleCustomerSubmitOrder = async (e) => {
    e.preventDefault();
    if (!currentCustomer) {
      setShowCustomerAuthModal(true);
      return;
    }
    const sar = sanitizeNumber(customerOrderForm.originalSar, 1, 100000, 0);
    if (sar <= 0) {
      showToast('يرجى إدخال مجموع سعر السلة بالريال السعودي', 'error');
      return;
    }

    const flatShippingSar = sanitizeNumber(pricingSettings.adminFlatShippingSar, 0, 10000, 25);
    const commPercent = sanitizeNumber(pricingSettings.adminCommissionPercent, 0, 200, 15);
    
    const shippingCostSar = flatShippingSar;
    const finalSar = (sar + shippingCostSar) * (1 + commPercent / 100);
    const finalSyp = Math.ceil((finalSar * effectiveExchangeRate) / 1000) * 1000;
    const finalUsd = Number((finalSyp / usdRate).toFixed(2));

    const activeBatch = batches.find((b) => b.status.includes('مفتوحة')) || batches[0];

    const newOrder = {
      id: `ord-${Date.now()}`,
      batchId: activeBatch ? activeBatch.id : 'batch-1',
      customerName: currentCustomer.name,
      customerContact: currentCustomer.phone,
      customerAddress: currentCustomer.address,
      cartUrl: sanitizeUrl(customerOrderForm.cartUrl),
      originalSar: sar,
      shippingSar: shippingCostSar,
      commissionSar: Math.round((sar + shippingCostSar) * (commPercent / 100)),
      finalSyp,
      finalUsd,
      paidSyp: 0,
      netProfitSyp: Math.round(Math.max(0, finalSar - sar) * effectiveExchangeRate),
      status: 'بانتظار العربون',
      notes: sanitizeText(customerOrderForm.notes, 200),
      createdAt: new Date().toLocaleDateString('ar-SY')
    };

    if (supabase) {
      const { data: savedOrder, error } = await supabase.from('orders').insert({
        customer_id: currentCustomer.id,
        batch_name: activeBatch?.name || null,
        cart_url: newOrder.cartUrl,
        original_sar: newOrder.originalSar,
        shipping_sar: newOrder.shippingSar,
        commission_sar: newOrder.commissionSar,
        final_syp: newOrder.finalSyp,
        paid_syp: 0,
        status: newOrder.status,
        notes: newOrder.notes,
      }).select().single();
      if (error) {
        showToast(error.message, 'error');
        return;
      }
      setOrders([{ ...newOrder, ...savedOrder }, ...orders]);
    } else {
      setOrders([newOrder, ...orders]);
    }
    setCustomerOrderForm({ cartUrl: '', originalSar: '', notes: '' });
    showToast('تم إرسال طلبك بنجاح! يمكنك متابعته من لوحتك الشخصية');
  };

  const kpiStats = useMemo(() => {
    return orders.reduce(
      (acc, o) => {
        const finalSyp = sanitizeNumber(o.finalSyp);
        const paidSyp = sanitizeNumber(o.paidSyp);
        acc.totalSalesSyp += finalSyp;
        acc.totalPaidSyp += paidSyp;
        acc.totalRemainingSyp += Math.max(0, finalSyp - paidSyp);
        acc.totalProfitSyp += sanitizeNumber(o.netProfitSyp);
        return acc;
      },
      { totalSalesSyp: 0, totalPaidSyp: 0, totalRemainingSyp: 0, totalProfitSyp: 0 }
    );
  }, [orders]);

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-rose-500 selection:text-white">
      {toast && (
        <div className="fixed bottom-5 left-5 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-xs sm:text-sm font-bold ${toast.type === 'error' ? 'bg-red-600 text-white border-red-700' : 'bg-slate-900 text-white border-slate-700'}`}>
            {toast.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {showAdminLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="bg-slate-900 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base">دخول لوحة تحكم الأدمن</h3>
                  <p className="text-xs text-slate-400">اسم المستخدم: admin</p>
                </div>
              </div>
              <button onClick={() => setShowAdminLoginModal(false)} className="p-2 rounded-xl text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAdminLogin} className="p-6 space-y-4">
              {adminLoginError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{adminLoginError}</span>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المستخدم</label>
                <input
                  type="text"
                  required
                  value={adminUserField}
                  onChange={(e) => setAdminUserField(e.target.value)}
                  placeholder="admin"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-slate-900 outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور</label>
                <input
                  type="password"
                  required
                  value={adminPassField}
                  onChange={(e) => setAdminPassField(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-slate-900 outline-none"
                />
              </div>
              <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2">
                <Unlock className="w-4 h-4" />
                <span>تسجيل دخول الأدمن</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {showCustomerAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-gradient-to-br from-rose-600 to-slate-900 text-white p-6 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-lg">
                  {customerAuthMode === 'login' ? 'تسجيل دخول العملاء' : 'إنشاء حساب جديد'}
                </h3>
                <p className="text-xs text-rose-100 mt-0.5">تابع طلباتك وسجل بياناتك بكل سهولة</p>
              </div>
              <button onClick={() => setShowCustomerAuthModal(false)} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={customerAuthMode === 'login' ? handleCustomerLogin : handleCustomerRegister}
              className="p-6 space-y-4"
            >
              {custAuthError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{custAuthError}</span>
                </div>
              )}

              {customerAuthMode === 'register' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل *</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={custName}
                        onChange={(e) => setCustName(e.target.value)}
                        placeholder="مثلاً: ريم أحمد"
                        className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">العنوان بالتفصيل (المحافظة / المنطقة / الشارع) *</label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                      <textarea
                        required
                        rows="2"
                        value={custAddress}
                        onChange={(e) => setCustAddress(e.target.value)}
                        placeholder="دمشق، المزة، شارع الفردوس..."
                        className="w-full pr-10 pl-4 py-2 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف (يُستخدم لتسجيل الدخول) *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    dir="ltr"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    placeholder="0912345678"
                    className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm text-right outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور *</label>
                <input
                  type="password"
                  required
                  value={custPassword}
                  onChange={(e) => setCustPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                {customerAuthMode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                <span>{customerAuthMode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}</span>
              </button>

              <div className="text-center pt-2 border-t border-slate-100">
                {customerAuthMode === 'login' ? (
                  <p className="text-xs text-slate-600">
                    ليس لديك حساب؟{' '}
                    <button
                      type="button"
                      onClick={() => { setCustomerAuthMode('register'); setCustAuthError(''); }}
                      className="text-rose-600 font-bold hover:underline"
                    >
                      أنشئ حساباً جديداً الآن
                    </button>
                  </p>
                ) : (
                  <p className="text-xs text-slate-600">
                    لديك حساب بالفعل؟{' '}
                    <button
                      type="button"
                      onClick={() => { setCustomerAuthMode('login'); setCustAuthError(''); }}
                      className="text-rose-600 font-bold hover:underline"
                    >
                      تسجيل الدخول
                    </button>
                  </p>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-600 to-slate-900 flex items-center justify-center text-white shadow-md">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
                {storefrontData.brandName}
              </h1>
              <p className="text-[11px] text-slate-500 hidden sm:block">وساطة طلبات شي إن من السعودية إلى سوريا</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdminAuthenticated && activeView === 'admin' ? (
              <>
                <button
                  onClick={() => setActiveView('storefront')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold"
                >
                  <Eye className="w-4 h-4 text-rose-600" />
                  <span>معاينة المتجر</span>
                </button>
                <button
                  onClick={handleAdminLogout}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold"
                >
                  <LogOut className="w-4 h-4" />
                  <span>خروج الأدمن</span>
                </button>
              </>
            ) : currentCustomer ? (
              <>
                <button
                  onClick={() => setActiveView('customer_dashboard')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold ${
                    activeView === 'customer_dashboard' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>حسابي ({currentCustomer.name.split(' ')[0]})</span>
                </button>
                <button
                  onClick={handleCustomerLogout}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                >
                  <LogOut className="w-4 h-4" />
                  <span>خروج</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setCustomerAuthMode('login'); setShowCustomerAuthModal(true); }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-sm"
                >
                  <LogIn className="w-4 h-4" />
                  <span>دخول / إنشاء حساب</span>
                </button>
                <button
                  onClick={() => setShowAdminLoginModal(true)}
                  title="دخول الوسيط"
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                >
                  <Lock className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {activeView === 'storefront' && (
        <main className="pb-20">
          <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 text-white py-16 sm:py-24 px-4">
            <div className="max-w-5xl mx-auto text-center space-y-6 relative z-10">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-500/20 border border-rose-400/30 text-rose-200 text-xs font-bold">
                <Sparkles className="w-4 h-4" />
                <span>تجميع أسبوعي مباشر من متجر شي إن السعودية</span>
              </div>
              <h2 className="text-3xl sm:text-5xl font-black leading-tight tracking-tight">
                {storefrontData.heroTitle}
              </h2>
              <p className="text-slate-300 text-sm sm:text-lg max-w-2xl mx-auto leading-relaxed">
                {storefrontData.heroSubtitle}
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
                {sanitizeUrl(storefrontData.whatsappLink) && (
                  <a
                    href={sanitizeUrl(storefrontData.whatsappLink)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3.5 rounded-2xl font-bold text-sm shadow-lg transition-all"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span>تواصل عبر واتساب</span>
                  </a>
                )}
                {sanitizeUrl(storefrontData.telegramLink) && (
                  <a
                    href={sanitizeUrl(storefrontData.telegramLink)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-6 py-3.5 rounded-2xl font-bold text-sm shadow-lg transition-all"
                  >
                    <Send className="w-5 h-5" />
                    <span>قناة التليجرام</span>
                  </a>
                )}
                {sanitizeUrl(storefrontData.instagramLink) && (
                  <a
                    href={sanitizeUrl(storefrontData.instagramLink)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 px-6 py-3.5 rounded-2xl font-bold text-sm transition-all"
                  >
                    <Instagram className="w-5 h-5" />
                    <span>إنستغرام</span>
                  </a>
                )}
              </div>
            </div>
          </section>

          <section className="max-w-4xl mx-auto px-4 sm:px-6 -mt-10 relative z-20">
            <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xl space-y-6">
              <div className="text-center space-y-1">
                <span className="text-xs font-extrabold text-rose-600 bg-rose-50 px-3 py-1 rounded-full">حاسبة وتقديم الطلبات الفوري</span>
                <h3 className="text-xl font-extrabold text-slate-900">أدخل مجموع سعر السلة واحسب التكلفة فوراً</h3>
              </div>

              <form onSubmit={handleCustomerSubmitOrder} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">مجموع سعر السلة من موقع شي إن (ريال سعودي)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.5"
                    value={customerOrderForm.originalSar}
                    onChange={(e) => setCustomerOrderForm({ ...customerOrderForm, originalSar: e.target.value })}
                    placeholder="مثلاً: 250"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 text-base font-bold focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رابط السلة أو القطع (URL)</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={customerOrderForm.cartUrl}
                    onChange={(e) => setCustomerOrderForm({ ...customerOrderForm, cartUrl: e.target.value })}
                    placeholder="https://ar.shein.com/..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-left"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المقاسات / ملاحظات إضافية</label>
                  <input
                    type="text"
                    value={customerOrderForm.notes}
                    onChange={(e) => setCustomerOrderForm({ ...customerOrderForm, notes: e.target.value })}
                    placeholder="مثلاً: تفاصيل المقاسات والألوان للقطع..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-slate-200">
                  <div>
                    <p className="text-xs text-slate-500">التكلفة الإجمالية التقديرية (بالدولار والليرة):</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xl font-black text-rose-600">
                        {customerOrderForm.originalSar ? Math.ceil(((Number(customerOrderForm.originalSar) + pricingSettings.adminFlatShippingSar) * (1 + pricingSettings.adminCommissionPercent/100) * effectiveExchangeRate) / 1000) * 1000 : 0} <span className="text-xs font-normal">ل.س</span>
                      </span>
                      <span className="text-slate-300">|</span>
                      <span className="text-lg font-extrabold text-emerald-700">
                        ${customerOrderForm.originalSar ? ((Math.ceil(((Number(customerOrderForm.originalSar) + pricingSettings.adminFlatShippingSar) * (1 + pricingSettings.adminCommissionPercent/100) * effectiveExchangeRate) / 1000) * 1000) / usdRate).toFixed(2) : '0.00'}
                      </span>
                    </div>
                  </div>

                  {currentCustomer ? (
                    <button
                      type="submit"
                      className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>إرسال الطلب الآن</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setCustomerAuthMode('login'); setShowCustomerAuthModal(true); }}
                      className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>سجل دخولك لإرسال الطلب</span>
                    </button>
                  )}
                </div>
              </form>
            </div>
          </section>

          <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-16 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="inline-flex items-center gap-2 text-rose-600 font-bold text-xs bg-rose-50 px-3 py-1 rounded-full">
                <ShieldCheck className="w-4 h-4" />
                <span>ثقة وأمان في التعامل</span>
              </div>
              <h3 className="text-2xl font-black text-slate-900">{storefrontData.aboutTitle}</h3>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">{storefrontData.aboutText}</p>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8 rounded-3xl shadow-xl space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-lg">الدفع المحلي عبر شام كاش</h4>
                  <p className="text-xs text-slate-400">الحساب المعتمد لتحويل العربون</p>
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-700/80 p-4 rounded-2xl flex items-center justify-between gap-3">
                <span className="font-mono text-xs sm:text-sm text-emerald-300 break-all">{storefrontData.shamCashAccount}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(storefrontData.shamCashAccount);
                    showToast('تم نسخ حساب شام كاش');
                  }}
                  className="shrink-0 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold"
                >
                  <Copy className="w-4 h-4" />
                  <span>نسخ</span>
                </button>
              </div>
            </div>
          </section>

          <section className="max-w-6xl mx-auto px-4 sm:px-6 mt-16 space-y-8">
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-black text-slate-900">آراء زبائننا وتجاربهم</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {storefrontData.testimonials.map((item) => (
                <div key={item.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center gap-1 text-amber-400">
                    {[...Array(5)].map((_, idx) => (
                      <Star key={idx} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed">"{item.text}"</p>
                  <p className="font-bold text-xs text-slate-900 pt-2 border-t border-slate-100">{item.name}</p>
                </div>
              ))}
            </div>
          </section>
        </main>
      )}

      {activeView === 'customer_dashboard' && currentCustomer && (
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-black text-2xl">
                {currentCustomer.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-slate-900">{currentCustomer.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">رقم الهاتف: {currentCustomer.phone}</p>
                <p className="text-xs text-slate-500 mt-0.5">العنوان: {currentCustomer.address}</p>
              </div>
            </div>
            <div className="bg-slate-50 px-4 py-3 rounded-2xl border border-slate-200 text-xs text-slate-700">
              <span className="font-bold text-slate-900">حسابك مفعل ومربوط بالنظام</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h4 className="font-extrabold text-base text-slate-900 border-b border-slate-100 pb-3">طلباتك السابقة والحالية</h4>
            <div className="space-y-3">
              {orders.filter((o) => o.customerContact === currentCustomer.phone).length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm font-medium">
                  ليس لديك أي طلبات مسجلة حتى الآن. يمكنك إرسال طلب جديد من واجهة المتجر الرئيسية!
                </div>
              ) : (
                orders
                  .filter((o) => o.customerContact === currentCustomer.phone)
                  .map((order) => {
                    const statusObj = ORDER_STATUSES.find((s) => s.value === order.status) || ORDER_STATUSES[0];
                    return (
                      <div key={order.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">طلب بسعر {order.originalSar} ريال</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusObj.color}`}>{order.status}</span>
                          </div>
                          <p className="text-xs text-slate-500">تاريخ الطلب: {order.createdAt}</p>
                          {order.notes && <p className="text-xs text-slate-600 bg-white p-2 rounded-xl border border-slate-200">ملاحظاتك: {order.notes}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-500">المبلغ المطلوب:</p>
                          <p className="text-base font-black text-rose-600">{order.finalSyp.toLocaleString()} ل.س</p>
                          <p className="text-xs font-extrabold text-emerald-700 mt-0.5">${order.finalUsd} USD</p>
                          <p className="text-[11px] text-slate-600 font-bold mt-1">المدفوع: {order.paidSyp.toLocaleString()} ل.س</p>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </main>
      )}

      {activeView === 'admin' && isAdminAuthenticated && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24">
          <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
            <button
              onClick={() => setAdminSubTab('orders')}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold ${adminSubTab === 'orders' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border'}`}
            >
              إدارة الطلبات
            </button>
            <button
              onClick={() => setAdminSubTab('customers')}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold ${adminSubTab === 'customers' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border'}`}
            >
              بيانات العملاء المسجلين ({customers.length})
            </button>
            <button
              onClick={() => setAdminSubTab('settings')}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold ${adminSubTab === 'settings' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border'}`}
            >
              سعر الصرف وإعدادات المتجر
            </button>
          </div>

          {adminSubTab === 'orders' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border shadow-sm">
                  <p className="text-xs text-slate-500 font-bold">إجمالي المبيعات (ل.س)</p>
                  <p className="text-xl font-black text-slate-900 mt-2">{kpiStats.totalSalesSyp.toLocaleString()} ل.س</p>
                  <p className="text-xs font-bold text-emerald-700 mt-1">${(kpiStats.totalSalesSyp / usdRate).toFixed(2)} USD</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border shadow-sm">
                  <p className="text-xs text-emerald-700 font-bold">المحصل شام كاش</p>
                  <p className="text-xl font-black text-emerald-700 mt-2">{kpiStats.totalPaidSyp.toLocaleString()} ل.س</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border shadow-sm">
                  <p className="text-xs text-amber-700 font-bold">المتبقي عند الزبائن</p>
                  <p className="text-xl font-black text-amber-700 mt-2">{kpiStats.totalRemainingSyp.toLocaleString()} ل.س</p>
                </div>
                <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-md">
                  <p className="text-xs text-emerald-300 font-bold">صافي الربح الشخصي</p>
                  <p className="text-xl font-black text-white mt-2">{kpiStats.totalProfitSyp.toLocaleString()} ل.س</p>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-base text-slate-900">سجلات طلبات العملاء (قابل للتعديل المباشر)</h3>
                  <span className="text-xs bg-slate-100 px-3 py-1 rounded-full text-slate-600 font-bold">تعديل مباشر للتكلفة والشحن والعمولة</span>
                </div>

                <div className="space-y-4">
                  {orders.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">لا توجد طلبات مسجلة حتى الآن</div>
                  ) : (
                    orders.map((order) => {
                      const statusObj = ORDER_STATUSES.find((s) => s.value === order.status) || ORDER_STATUSES[0];
                      return (
                        <div key={order.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-900 text-sm">{order.customerName}</span>
                                <span className="text-xs text-slate-500 font-mono">({order.customerContact})</span>
                              </div>
                              <p className="text-xs text-slate-600 mt-0.5">العنوان: {order.customerAddress || 'غير محدد'}</p>
                              {order.cartUrl && (
                                <a href={order.cartUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-rose-600 hover:underline flex items-center gap-1 mt-1 font-bold">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>رابط السلة</span>
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                value={order.status}
                                onChange={(e) => {
                                  const updated = orders.map((o) => o.id === order.id ? { ...o, status: e.target.value } : o);
                                  setOrders(updated);
                                  showToast('تم تحديث الحالة');
                                }}
                                className={`px-3 py-1.5 rounded-xl border text-xs font-bold ${statusObj.color}`}
                              >
                                {ORDER_STATUSES.map((s) => (
                                  <option key={s.value} value={s.value}>{s.value}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => {
                                  setOrders(orders.filter((o) => o.id !== order.id));
                                  showToast('تم حذف الطلب');
                                }}
                                className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">مجموع السلة (ريال)</label>
                              <input
                                type="number"
                                value={order.originalSar}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  const updated = orders.map((o) => {
                                    if (o.id === order.id) {
                                      const newFinalSyp = Math.ceil(((val + (o.shippingSar || 0)) * (1 + pricingSettings.adminCommissionPercent/100) * effectiveExchangeRate) / 1000) * 1000;
                                      return { ...o, originalSar: val, finalSyp: newFinalSyp, finalUsd: Number((newFinalSyp / usdRate).toFixed(2)) };
                                    }
                                    return o;
                                  });
                                  setOrders(updated);
                                }}
                                className="w-full px-3 py-2 rounded-xl border bg-white text-xs font-bold"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">أجور التوصيل (ريال)</label>
                              <input
                                type="number"
                                value={order.shippingSar}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  const updated = orders.map((o) => {
                                    if (o.id === order.id) {
                                      const newFinalSyp = Math.ceil(((o.originalSar + val) * (1 + pricingSettings.adminCommissionPercent/100) * effectiveExchangeRate) / 1000) * 1000;
                                      return { ...o, shippingSar: val, finalSyp: newFinalSyp, finalUsd: Number((newFinalSyp / usdRate).toFixed(2)) };
                                    }
                                    return o;
                                  });
                                  setOrders(updated);
                                }}
                                className="w-full px-3 py-2 rounded-xl border bg-white text-xs font-bold"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">المبلغ المطلوب (ل.س)</label>
                              <input
                                type="number"
                                value={order.finalSyp}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  const updated = orders.map((o) => {
                                    if (o.id === order.id) {
                                      return { ...o, finalSyp: val, finalUsd: Number((val / usdRate).toFixed(2)) };
                                    }
                                    return o;
                                  });
                                  setOrders(updated);
                                }}
                                className="w-full px-3 py-2 rounded-xl border bg-white text-xs font-bold text-rose-600"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">المبلغ المطلوب ($)</label>
                              <input
                                type="number"
                                step="0.01"
                                value={order.finalUsd}
                                readOnly
                                className="w-full px-3 py-2 rounded-xl border bg-slate-100 text-xs font-bold text-emerald-700"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 mb-1">المدفوع شام كاش (ل.س)</label>
                              <input
                                type="number"
                                value={order.paidSyp}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  const updated = orders.map((o) => o.id === order.id ? { ...o, paidSyp: val } : o);
                                  setOrders(updated);
                                }}
                                className="w-full px-3 py-2 rounded-xl border bg-white text-xs font-bold text-emerald-700"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {adminSubTab === 'customers' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
              <h3 className="font-extrabold text-base text-slate-900">سجل العملاء المسجلين عالموقع</h3>
              <div className="space-y-3">
                {customers.length === 0 ? (
                  <p className="text-slate-400 text-center py-8 text-sm">لا يوجد عملاء مسجلين حتى الآن.</p>
                ) : (
                  customers.map((c) => (
                    <div key={c.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900">{c.name}</p>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">الهاتف: {c.phone}</p>
                        <p className="text-xs text-slate-600 mt-0.5">العنوان: {c.address}</p>
                      </div>
                      <span className="text-[11px] bg-white px-3 py-1 rounded-full border text-slate-500">تاريخ التسجيل: {c.createdAt}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {adminSubTab === 'settings' && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <h3 className="font-extrabold text-base text-slate-900 border-b border-slate-100 pb-3">إعدادات التسعير، أسعار الصرف، والعمولات</h3>

              <div className="space-y-4 max-w-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">اسم المتجر / العلامة التجارية</label>
                    <input
                      type="text"
                      value={storefrontData.brandName}
                      onChange={(e) => setStorefrontData({ ...storefrontData, brandName: sanitizeText(e.target.value, 100) })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">شعار اللوجو المختصر</label>
                    <input
                      type="text"
                      value={storefrontData.brandLogoText || 'SHEIN'}
                      onChange={(e) => setStorefrontData({ ...storefrontData, brandLogoText: sanitizeText(e.target.value, 20) })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">سعر صرف الريال (SAR to SYP)</label>
                    <input
                      type="number"
                      value={pricingSettings.sarToSypRate}
                      onChange={(e) => setPricingSettings({ ...pricingSettings, sarToSypRate: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">سعر صرف الدولار (USD to SYP)</label>
                    <input
                      type="number"
                      value={pricingSettings.usdToSypRate}
                      onChange={(e) => setPricingSettings({ ...pricingSettings, usdToSypRate: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-emerald-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">نسبة عمولتك الشخصية (%)</label>
                    <input
                      type="number"
                      value={pricingSettings.adminCommissionPercent}
                      onChange={(e) => setPricingSettings({ ...pricingSettings, adminCommissionPercent: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-rose-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">أجور التوصيل الافتراضية (ريال سعودي)</label>
                    <input
                      type="number"
                      value={pricingSettings.adminFlatShippingSar}
                      onChange={(e) => setPricingSettings({ ...pricingSettings, adminFlatShippingSar: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">حساب شام كاش الظاهر للعملاء</label>
                  <input
                    type="text"
                    value={storefrontData.shamCashAccount}
                    onChange={(e) => setStorefrontData({ ...storefrontData, shamCashAccount: sanitizeText(e.target.value, 150) })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">رابط الواتساب</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={storefrontData.whatsappLink}
                      onChange={(e) => setStorefrontData({ ...storefrontData, whatsappLink: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">رابط التليجرام</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={storefrontData.telegramLink}
                      onChange={(e) => setStorefrontData({ ...storefrontData, telegramLink: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">رابط الإنستغرام</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={storefrontData.instagramLink}
                      onChange={(e) => setStorefrontData({ ...storefrontData, instagramLink: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                </div>

                <button
                  onClick={() => showToast('تم حفظ أسعار الصرف والتعديلات بنجاح')}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl text-xs font-bold"
                >
                  حفظ التعديلات
                </button>
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}