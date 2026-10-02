// يفحص أن كل مسار إنشاء/رفع في الواجهة داخله فحص حد الخطة المناسب.
// القاعدة: الفحص لازم يكون داخل نفس الدالة اللي بتعمل الكتابة.
// بيشتغل offline (بلا قاعدة بيانات) وبيخرج كود خروج غير صفري عند أي مسار مكشوف.
// npm run check:plan-limits
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["components", "lib", "app"];

const TABLE_CHECKS = {
  projects: "checkProjectLimit",
  tasks: "checkTaskLimit",
  ideas: "checkIdeaLimit",
};

const FN_START =
  /^(\s*)(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+\w+|^(\s*)(?:export\s+)?(?:const|let)\s+\w+\s*=\s*(?:async\s*)?\(|^(\s*)(?:async\s+)?\w+\s*\([^)]*\)\s*\{\s*$|^(\s*)(?:export\s+)?(?:async\s+)?function\s*\(/;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/** يحسب نهاية الدالة بمطابقة الأقواس من سطر بدايتها */
function functionEnd(lines, startIdx) {
  let depth = 0;
  let seen = false;
  for (let i = startIdx; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === "{") {
        depth++;
        seen = true;
      } else if (ch === "}") {
        depth--;
      }
    }
    if (seen && depth <= 0) return i;
  }
  return lines.length - 1;
}

/** كل نطاقات الدوال في الملف [start, end] */
function functionRanges(lines) {
  const ranges = [];
  lines.forEach((line, i) => {
    if (FN_START.test(line)) ranges.push([i, functionEnd(lines, i)]);
  });
  return ranges;
}

/** أعمق دالة تحيط بالسطر ده */
function innermostFunction(lines, ranges, siteIdx) {
  let best = null;
  for (const [start, end] of ranges) {
    if (siteIdx > start && siteIdx <= end) {
      if (!best || start > best[0]) best = [start, end];
    }
  }
  return best;
}

const violations = [];
let checked = 0;

for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    if (rel === "lib/planLimits.ts" || rel === "lib/planUsage.ts") continue;
    const src = readFileSync(file, "utf8");
    const lines = src.split(/\r?\n/);
    const ranges = functionRanges(lines);

    lines.forEach((line, idx) => {
      for (const [table, check] of Object.entries(TABLE_CHECKS)) {
        if (!new RegExp(`\\.from\\(["'\`]${table}["'\`]\\)`).test(line)) continue;
        // نص الجملة فقط: لو السطر نفسه منتهي بفاصلة منقوطة ما نكملش،
        // وإلا نلحق السطور لحد نهاية الجملة — عشان استعلام تاني وراها ما يتلغبطش
        let stmt = line;
        if (!stmt.includes(";")) {
          for (let j = idx + 1; j < Math.min(lines.length, idx + 12); j++) {
            stmt += "\n" + lines[j];
            if (lines[j].includes(";")) break;
          }
        }
        if (!/\.insert\(|\.upsert\(/.test(stmt)) continue;
        checked++;
        const fn = innermostFunction(lines, ranges, idx);
        const body = fn ? lines.slice(fn[0], fn[1] + 1).join("\n") : src;
        if (!body.includes(check)) {
          violations.push(`${rel}:${idx + 1} insert into "${table}" without ${check}()`);
        }
      }

      if (!/\.upload\(/.test(line)) return;
      if (!/storage/.test(lines.slice(Math.max(0, idx - 3), idx + 1).join(" "))) return;
      checked++;
      const fn = innermostFunction(lines, ranges, idx);
      const body = fn ? lines.slice(fn[0], fn[1] + 1).join("\n") : src;
      if (!body.includes("checkStorageUpload")) {
        violations.push(`${rel}:${idx + 1} storage upload without checkStorageUpload()`);
      }
    });
  }
}

if (violations.length) {
  console.error(`plan-limit coverage: ${violations.length} unguarded write path(s)\n`);
  for (const v of violations) console.error("  " + v);
  process.exit(1);
}
console.log(`plan-limit coverage: OK (${checked} guarded write paths)`);
