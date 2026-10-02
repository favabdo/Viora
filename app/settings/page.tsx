"use client";

import { AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase, Profile } from "@/lib/supabase";
import Avatar from "@/components/ui/Avatar";
import VioraSplash from "@/components/ui/VioraSplash";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import {
  Archive,
  Calendar,
  CalendarDays,
  ChevronRight,
  Clock,
  Download,
  Keyboard,
  Languages,
  LayoutGrid,
  Timer,
  Trash2,
  UserRound,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useSettings, DateFormat, TimeFormat, WeekStart, DefaultView } from "@/lib/useSettings";
import { HOME_PATH } from "@/lib/appRoutes";
import { Segmented, Select, SettingsGroup, SettingsGroupTitle, SettingsHeader, SettingsRow, Toggle } from "@/components/settingsUi";

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

  return (
    <>
      <AnimatePresence>
        {(checking || !session) && <VioraSplash key="splash" />}
      </AnimatePresence>
      {session && (
        <main className="min-h-screen px-4 pb-16 sm:px-6 lg:px-8">
          <SettingsHeader title={t("settings.title")} subtitle={t("settings.subtitle")} onBack={() => router.push(HOME_PATH)} backLabel={t("profile.back")} />
          <div className="mx-auto grid w-full max-w-7xl items-start gap-6 lg:grid-cols-[19rem_minmax(0,1fr)]">
            {/* العمود الجانبي: الحساب ومنطقة الخطر */}
            <aside className="space-y-6 lg:sticky lg:top-[5.25rem]">
              <div>
                <SettingsGroupTitle>{t("settings.yourAccount")}</SettingsGroupTitle>
                <SettingsGroup>
                  <SettingsRow
                    icon={UserRound}
                    title={profile?.full_name || profile?.username || t("common.you")}
                    hint={profile?.email || session.user.email || ""}
                    control={<Avatar name={profile?.full_name || profile?.username || "?"} src={profile?.avatar_url} size="md" />}
                    onClick={() => router.push("/profile")}
                  />
                  <SettingsRow
                    title={t("settings.editProfile")}
                    control={<ChevronRight size={16} className="text-inkFaint rtl:rotate-180" />}
                    onClick={() => router.push("/profile")}
                  />
                </SettingsGroup>
              </div>

              <div>
                <SettingsGroupTitle>{t("settings.dangerZone")}</SettingsGroupTitle>
                <SettingsGroup danger>
                  <SettingsRow
                    icon={UserRound}
                    iconColor="#E85D4C"
                    danger
                    title={t("settings.manageInProfile")}
                    control={<ChevronRight size={16} className="text-inkFaint rtl:rotate-180" />}
                    onClick={() => router.push("/profile")}
                  />
                </SettingsGroup>
              </div>
            </aside>

            {/* منطقة المحتوى */}
            <div className="grid min-w-0 items-start gap-6 2xl:grid-cols-2">
              <div>
                <SettingsGroupTitle>{t("settings.general")}</SettingsGroupTitle>
                <SettingsGroup>
                  <SettingsRow
                    icon={Languages}
                    title={t("settings.language")}
                    hint={t("settings.languageHint")}
                    control={
                      <Segmented
                        value={lang}
                        onChange={(v) => setLang(v)}
                        options={[
                          { value: "en", label: "EN" },
                          { value: "ar", label: "ع" },
                        ]}
                      />
                    }
                  />
                  <SettingsRow
                    icon={Clock}
                    title={t("settings.timezone")}
                    hint={t("settings.timezoneHint")}
                    badge={t("settings.comingSoon")}
                    control={
                      <Select value={settings.timezone} onChange={(v) => updateSetting("timezone", v)} ariaLabel={t("settings.timezone")}>
                        {TIMEZONES.map((tz) => (
                          <option key={tz} value={tz}>
                            {tz === "auto" ? t("settings.timezoneAuto") : tz}
                          </option>
                        ))}
                      </Select>
                    }
                  />
                  <SettingsRow
                    icon={CalendarDays}
                    title={t("settings.dateFormat")}
                    hint={t("settings.dateFormatHint")}
                    badge={t("settings.comingSoon")}
                    control={
                      <Select value={settings.dateFormat} onChange={(v) => updateSetting("dateFormat", v as DateFormat)} ariaLabel={t("settings.dateFormat")}>
                        <option value="MMM_D_YYYY">Aug 17, 2026</option>
                        <option value="DD_MM_YYYY">17/08/2026</option>
                        <option value="YYYY_MM_DD">2026-08-17</option>
                      </Select>
                    }
                  />
                  <SettingsRow
                    icon={Timer}
                    title={t("settings.timeFormat")}
                    hint={t("settings.timeFormatHint")}
                    control={
                      <Segmented
                        value={settings.timeFormat}
                        onChange={(v) => updateSetting("timeFormat", v as TimeFormat)}
                        options={[
                          { value: "12h", label: t("settings.time12h") },
                          { value: "24h", label: t("settings.time24h") },
                        ]}
                      />
                    }
                  />
                  <SettingsRow
                    icon={Calendar}
                    title={t("settings.weekStartsOn")}
                    hint={t("settings.weekStartsOnHint")}
                    control={
                      <Segmented
                        value={settings.weekStart}
                        onChange={(v) => updateSetting("weekStart", v as WeekStart)}
                        options={[
                          { value: "sunday", label: t("settings.sunday") },
                          { value: "monday", label: t("settings.monday") },
                        ]}
                      />
                    }
                  />
                  <SettingsRow
                    icon={LayoutGrid}
                    title={t("settings.defaultView")}
                    hint={t("settings.defaultViewHint")}
                    control={
                      <Select value={settings.defaultView} onChange={(v) => updateSetting("defaultView", v as DefaultView)} ariaLabel={t("settings.defaultView")}>
                        <option value="list">{t("views.list")}</option>
                        <option value="board">{t("views.board")}</option>
                        <option value="calendar">{t("views.calendar")}</option>
                        <option value="timeline">{t("views.timeline")}</option>
                      </Select>
                    }
                  />
                </SettingsGroup>
              </div>

              <div>
                <SettingsGroupTitle>{t("settings.otherSettings")}</SettingsGroupTitle>
                <SettingsGroup>
                  <SettingsRow
                    icon={Keyboard}
                    title={t("settings.keyboardShortcuts")}
                    hint={t("settings.keyboardShortcutsHint")}
                    control={
                      <Button variant="secondary" size="sm" onClick={() => setShowShortcuts(true)}>
                        {t("settings.viewShortcuts")}
                      </Button>
                    }
                  />
                  <SettingsRow
                    icon={Download}
                    title={t("settings.importData")}
                    hint={t("settings.importDataHint")}
                    control={
                      <Button variant="secondary" size="sm" onClick={() => setShowImportNotice(true)}>
                        {t("settings.import")}
                      </Button>
                    }
                  />
                  <SettingsRow
                    icon={Archive}
                    title={t("settings.archiveCompleted")}
                    hint={t("settings.archiveCompletedHint")}
                    badge={t("settings.comingSoon")}
                    control={<Toggle checked={settings.archiveCompletedTasks} onChange={(v) => updateSetting("archiveCompletedTasks", v)} />}
                  />
                  <SettingsRow
                    icon={Trash2}
                    title={t("settings.moveToTrash")}
                    hint={t("settings.moveToTrashHint")}
                    badge={t("settings.comingSoon")}
                    control={<Toggle checked={settings.moveTasksToTrash} onChange={(v) => updateSetting("moveTasksToTrash", v)} />}
                  />
                </SettingsGroup>
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
      )}
    </>
  );
}
