// قاموس ترجمة التطبيق بالكامل. الإنجليزية هي اللغة الافتراضية، والعربية هنا عربية فصحى.
// المفاتيح منظمة حسب الملف/القسم عشان تبقى سهلة اللقاء والصيانة.

export const translations = {
  en: {
    // Projects section
    "projects.favorite": "Add to Favorites",
    "projects.unfavorite": "Remove from Favorites",
    "projects.archive": "Archive Project",
    "projects.unarchive": "Unarchive Project",
    "projects.edit": "Edit Project",
    "projects.duplicate": "Duplicate Project",
    "projects.delete": "Delete Project",
    "projects.leave": "Leave Project",
    "projects.deleteConfirm": "Are you sure you want to delete \"{name}\"? This action cannot be undone.",
    "projects.leaveConfirm": "Are you sure you want to leave \"{name}\"?",
    "projects.err.toggleFavorite": "Failed to toggle favorite status",
    "projects.err.toggleArchive": "Failed to toggle archive status",
    "projects.err.duplicate": "Failed to duplicate project",
    "projects.err.edit": "Failed to save changes",
    "projects.err.delete": "Failed to delete project",
    "projects.err.leave": "Failed to leave project",
    // Common
    "common.save": "Save",
    "common.cancel": "Cancel",
  },
  ar: {
    // Projects section
    "projects.favorite": "إضافة للمفضلة",
    "projects.unfavorite": "إزالة من المفضلة",
    "projects.archive": "أرشفة المشروع",
    "projects.unarchive": "إلغاء أرشفة المشروع",
    "projects.edit": "تعديل المشروع",
    "projects.duplicate": "تكرار المشروع",
    "projects.delete": "حذف المشروع",
    "projects.leave": "مغادرة المشروع",
    "projects.deleteConfirm": "هل أنت متأكد من حذف \"{name}\"؟ هذا الإجراء لا يمكن التراجع عنه.",
    "projects.leaveConfirm": "هل أنت متأكد من مغادرة \"{name}\"؟",
    "projects.err.toggleFavorite": "فشل في تغيير حالة المفضلة",
    "projects.err.toggleArchive": "فشل في تغيير حالة الأرشفة",
    "projects.err.duplicate": "فشل في تكرار المشروع",
    "projects.err.edit": "فشل في حفظ التعديلات",
    "projects.err.delete": "فشل في حذف المشروع",
    "projects.err.leave": "فشل في مغادرة المشروع",
    // Common
    "common.save": "حفظ",
    "common.cancel": "إلغاء",
  },
};

export type TranslationKey = string;
