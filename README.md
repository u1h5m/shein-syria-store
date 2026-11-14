## SHEIN SY

تطبيق متجر طلبات شي إن إلى سوريا مبني باستخدام React وVite وTailwind CSS، مع تجهيز طبقة Supabase للمصادقة وقاعدة البيانات.

### التشغيل محلياً

```bash
npm install
npm run dev
```

### إعداد Supabase

1. انسخ `.env.example` إلى `.env`.
2. أضف `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY`.
3. نفّذ `supabase/schema.sql` داخل SQL Editor في مشروع Supabase.

لا تضع `service_role` key داخل الواجهة أو ملفات `.env` التي تُرفع إلى GitHub.