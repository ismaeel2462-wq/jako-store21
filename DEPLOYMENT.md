# نشر JAKO STORE

## الملفات

- `index.html` هو التطبيق الرئيسي.
- `games.html` يفتح مباشرة عرض الألعاب عبر `index.html?view=games`.
- `applications.html` يفتح مباشرة عرض التطبيقات عبر `index.html?view=applications`.
- ملفات قاعدة البيانات موجودة في `supabase/migrations/`.

## Supabase

المشروع المستخدم هو `zfqhfrxvpbnzzrixjaxf`. المفتاح الموجود في الواجهة هو مفتاح `publishable` وليس مفتاح `service_role`. لا تضع أي secret أو service-role key في ملفات الواجهة.

في Supabase Dashboard راجع: Authentication → URL Configuration. عيّن Site URL إلى رابط GitHub Pages المنشور، وأضف عناوين الموقع وإعادة التوجيه الخاصة بتسجيل الحساب وتأكيد البريد واستعادة كلمة المرور ضمن Redirect URLs.

## كتالوج المنتجات

تمت إضافة 6 ألعاب و6 تطبيقات إلى `public.products` بعناوين ووصف وحقول الحساب المطلوبة. لا توجد أسعار أو باقات بعد. أضف الباقات الحقيقية من لوحة الإدارة ضمن Product Variants قبل إتاحة الطلب. لا تضع بيانات دفع غير مؤكدة.

## GitHub Pages

بعد رفع ملفات المشروع إلى فرع `main`، افتح إعدادات المستودع → Pages، واختر النشر من `Deploy from a branch` ثم الفرع `main` والمجلد `/ (root)`. فعّل `.nojekyll` الموجود في جذر المشروع.

## ملاحظة نشر

هذا الإصدار موجود محلياً في ملفات التسليم. لم يُرفع بعد إلى GitHub ولم يُفعّل Pages، لأن تكامل GitHub المتصل أعاد خطأ `403 Resource not accessible by integration` عند اختبار الكتابة.
