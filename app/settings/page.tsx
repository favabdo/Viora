"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { supabase, Profile } from "@/lib/supabase";
import Avatar from "@/components/ui/Avatar";
import IconButton from "@/components/ui/IconButton";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { ArrowRight, Languages, Clock, Calendar, Timer, ListTodo, LayoutGrid, Archive, Trash2, Keyboard, Download } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useSettings, DateFormat, TimeFormat, WeekStart, DefaultView } from "@/lib/useSettings";
import { HOME_PATH } from "@/lib/appRoutes";

const TIMEZONES = [
  "auto",
  "Africa/Cairo",
  "Asia/Riyadh",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
];

function SettingRow({
  icon: Icon,
  label,
  hint,
  badge,
  children,
}: {
  icon: React.ElementType;
  label: string;
  hint: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-line last:border-b-0">
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 h-8 w-8 rounded-md bg-tealSoft text-tealDark flex items-center justify-center shrink-0">
          <Icon size={15} strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink flex items-center gap-1.5">
            {label}
            {badge && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-paperDark text-inkFaint">{badge}</span>
            )}
          </p>
          <p className="text-xs text-inkFaint mt-0.5">{hint}</p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-paperDark border-0 rounded-[1.75rem] px-3 py-1.5 text-sm text-ink outline-none focus:outline-none focus:ring-0 min-w-[160px]"
    >
      {children}
    </select>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`h-6 w-11 rounded-full transition-colors shrink-0 p-0.5 flex ${
        checked ? "bg-teal justify-end" : "bg-paperDark justify-start"
      }`}
    >
      <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
    </button>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { t, lang, setLang } = useTranslation();
  const { settings, updateSetting } = useSettings();

  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showImportNotice, setShowImportNotice] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setSession(data.session);
      setChecking(false);
    });
  }, [router]);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => setProfile(data as Profile));
  }, [session]);

  if (checking || !session) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <span className="h-5 w-5 rounded-full border-2 border-line border-t-teal animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-5xl mx-auto px-5 py-6 md:px-8 md:py-8">
        <div className="flex items-center gap-3 mb-1">
          <IconButton aria-label={t("profile.back")} onClick={() => router.push(HOME_PATH)}>
            <ArrowRight size={18} strokeWidth={1.75} className="rtl:rotate-180" />
          </IconButton>
          <h1 className="font-display text-xl font-medium">{t("settings.title")}</h1>
        </div>
        <p className="text-sm text-inkFaint mb-6 ms-11">{t("settings.subtitle")}</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* الإعدادات العامة */}
          <div className="lg:col-span-2 space-y-5">
            <section className="bg-surface border border-line rounded-lg p-5">
              <h2 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-1">
                {t("settings.general")}
              </h2>

              <SettingRow icon={Languages} label={t("settings.language")} hint={t("settings.languageHint")}>
                <Select value={lang} onChange={(v) => setLang(v as "en" | "ar")}>
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                </Select>
              </SettingRow>

              <SettingRow
                icon={Clock}
                label={t("settings.timezone")}
                hint={t("settings.timezoneHint")}
                badge={t("settings.comingSoon")}
              >
                <Select value={settings.timezone} onChange={(v) => updateSetting("timezone", v)}>
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz === "auto" ? t("settings.timezoneAuto") : tz}
                    </option>
                  ))}
                </Select>
              </SettingRow>

              <SettingRow
                icon={Calendar}
                label={t("settings.dateFormat")}
                hint={t("settings.dateFormatHint")}
                badge={t("settings.comingSoon")}
              >
                <Select value={settings.dateFormat} onChange={(v) => updateSetting("dateFormat", v as DateFormat)}>
                  <option value="MMM_D_YYYY">Aug 17, 2026</option>
                  <option value="DD_MM_YYYY">17/08/2026</option>
                  <option value="YYYY_MM_DD">2026-08-17</option>
                </Select>
              </SettingRow>

              <SettingRow icon={Timer} label={t("settings.timeFormat")} hint={t("settings.timeFormatHint")}>
                <Select value={settings.timeFormat} onChange={(v) => updateSetting("timeFormat", v as TimeFormat)}>
                  <option value="12h">{t("settings.time12h")}</option>
                  <option value="24h">{t("settings.time24h")}</option>
                </Select>
              </SettingRow>

              <SettingRow icon={Calendar} label={t("settings.weekStartsOn")} hint={t("settings.weekStartsOnHint")}>
                <Select value={settings.weekStart} onChange={(v) => updateSetting("weekStart", v as WeekStart)}>
                  <option value="sunday">{t("settings.sunday")}</option>
                  <option value="monday">{t("settings.monday")}</option>
                </Select>
              </SettingRow>

              <SettingRow icon={LayoutGrid} label={t("settings.defaultView")} hint={t("settings.defaultViewHint")}>
                <Select value={settings.defaultView} onChange={(v) => updateSetting("defaultView", v as DefaultView)}>
                  <option value="list">{t("views.list")}</option>
                  <option value="board">{t("views.board")}</option>
                  <option value="calendar">{t("views.calendar")}</option>
                  <option value="timeline">{t("views.timeline")}</option>
                </Select>
              </SettingRow>

              <SettingRow
                icon={Archive}
                label={t("settings.archiveCompleted")}
                hint={t("settings.archiveCompletedHint")}
                badge={t("settings.comingSoon")}
              >
                <Toggle
                  checked={settings.archiveCompletedTasks}
                  onChange={(v) => updateSetting("archiveCompletedTasks", v)}
                />
              </SettingRow>

              <SettingRow
                icon={Trash2}
                label={t("settings.moveToTrash")}
                hint={t("settings.moveToTrashHint")}
                badge={t("settings.comingSoon")}
              >
                <Toggle checked={settings.moveTasksToTrash} onChange={(v) => updateSetting("moveTasksToTrash", v)} />
              </SettingRow>
            </section>

            <section className="bg-surface border border-line rounded-lg p-5">
              <h2 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-1">
                {t("settings.otherSettings")}
              </h2>

              <SettingRow
                icon={Keyboard}
                label={t("settings.keyboardShortcuts")}
                hint={t("settings.keyboardShortcutsHint")}
              >
                <Button variant="secondary" onClick={() => setShowShortcuts(true)}>
                  {t("settings.viewShortcuts")}
                </Button>
              </SettingRow>

              <SettingRow icon={Download} label={t("settings.importData")} hint={t("settings.importDataHint")}>
                <Button variant="secondary" onClick={() => setShowImportNotice(true)}>
                  {t("settings.import")}
                </Button>
              </SettingRow>
            </section>
          </div>

          {/* الحساب ومنطقة الخطر */}
          <div className="space-y-5">
            <section className="bg-surface border border-line rounded-lg p-5">
              <h2 className="text-2xs font-semibold tracking-wide text-inkFaint uppercase mb-3">
                {t("settings.yourAccount")}
              </h2>
              <div className="flex flex-col items-center text-center gap-2 py-2">
                <Avatar name={profile?.full_name || profile?.username || "?"} src={profile?.avatar_url} size="lg" />
                <div>
                  <p className="font-display text-sm font-medium text-ink">{profile?.full_name || profile?.username}</p>
                  <p className="text-xs text-inkFaint">{profile?.email || session.user.email}</p>
                </div>
                <Link href="/profile" className="w-full mt-2">
                  <Button variant="secondary" fullWidth>
                    {t("settings.editProfile")}
                  </Button>
                </Link>
              </div>
            </section>

            <section className="bg-surface border border-clay/30 rounded-lg p-5">
              <h2 className="text-2xs font-semibold tracking-wide text-clay uppercase mb-2">
                {t("settings.dangerZone")}
              </h2>
              <p className="text-xs text-inkSoft leading-relaxed mb-3">{t("settings.manageInProfile")}</p>
              <Link href="/profile">
                <Button variant="danger" fullWidth>
                  {t("settings.goToProfile")}
                </Button>
              </Link>
            </section>
          </div>
        </div>
      </div>

      {showShortcuts && (
        <Modal onClose={() => setShowShortcuts(false)} maxWidth="max-w-sm">
          <h3 className="font-display text-lg font-medium mb-4">{t("settings.shortcutsTitle")}</h3>
          <ul className="space-y-2.5">
            {[
              [t("settings.shortcut.addTask"), t("settings.shortcut.addTaskKey")],
              [t("settings.shortcut.cancelEdit"), t("settings.shortcut.cancelEditKey")],
              [t("settings.shortcut.closeModal"), t("settings.shortcut.closeModalKey")],
            ].map(([label, key]) => (
              <li key={label} className="flex items-center justify-between text-sm">
                <span className="text-inkSoft">{label}</span>
                <kbd className="px-2 py-1 rounded-md bg-paperDark border border-line text-2xs font-mono text-ink">
                  {key}
                </kbd>
              </li>
            ))}
          </ul>
          <Button variant="secondary" fullWidth className="mt-5" onClick={() => setShowShortcuts(false)}>
            {t("common.close")}
          </Button>
        </Modal>
      )}

      {showImportNotice && (
        <Modal onClose={() => setShowImportNotice(false)} maxWidth="max-w-sm">
          <h3 className="font-display text-lg font-medium mb-2">{t("settings.importData")}</h3>
          <p className="text-sm text-inkSoft leading-relaxed mb-5">{t("settings.importNotReady")}</p>
          <Button variant="secondary" fullWidth onClick={() => setShowImportNotice(false)}>
            {t("common.close")}
          </Button>
        </Modal>
      )}
    </main>
  );
}
