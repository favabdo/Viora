-- حقول اختيارية لبطاقة الملف الشخصي (نبذة، موقع، منطقة زمنية، مهارات)
alter table profiles
  add column if not exists bio text,
  add column if not exists location text,
  add column if not exists timezone text,
  add column if not exists skills text;
