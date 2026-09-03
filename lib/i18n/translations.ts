// قاموس ترجمة التطبيق بالكامل. الإنجليزية هي اللغة الافتراضية، والعربية هنا عربية فصحى.
// المفاتيح منظمة حسب الملف/القسم عشان تبقى سهلة اللقاء والصيانة.

export const translations = {
  en: {
    // Projects section
    "projects.favorite": "Add to Favorites",
    "projects.archive": "Archive Project",
    "projects.edit": "Edit Project",
    "projects.duplicate": "Duplicate Project",
    "projects.delete": "Delete Project",
    "projects.leave": "Leave Project",
    "projects.err.toggleFavorite": "Failed to toggle favorite status",
    "projects.err.toggleArchive": "Failed to toggle archive status",
    "projects.err.duplicate": "Failed to duplicate project",
  },
  ar: {
    // Projects section
    "projects.favorite": "إضافة للمفضلة",
    "projects.archive": "أرشفة المشروع",
    "projects.edit": "تعديل المشروع",
    "projects.duplicate": "تكرار المشروع",
    "projects.delete": "حذف المشروع",
    "projects.leave": "مغادرة المشروع",
    "projects.err.toggleFavorite": "فشل في تغيير حالة المفضلة",
    "projects.err.toggleArchive": "فشل في تغيير حالة الأرشفة",
    "projects.err.duplicate": "فشل في تكرار المشروع",
  },
};

export type TranslationKey = string;
