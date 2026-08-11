import sql from "mssql";

/**
 * الاتصال بقاعدة بيانات SQL Server الخاصة بسكشن Rooms.
 * ده ملف سيرفر فقط (بيتقرا جوا app/api/... مش جوا component بتاع المتصفح)،
 * عشان بيانات الاتصال متتسربش لأي حد بيفتح الموقع.
 *
 * نفس طريقة الاتصال بالظبط المستخدمة في مشروع Stock Watcher (config/db.js):
 * config واحد بيتبني مرة من متغيرات البيئة، وpool مشترك (singleton) بيتعمله connect مرة واحدة.
 *
 * لازم تحط المتغيرات دي في .env.local (محليًا) وفي إعدادات البيئة بتاعت الاستضافة:
 *
 *   ROOMS_SQLSERVER_HOST=162.55.67.11
 *   ROOMS_SQLSERVER_PORT=1433
 *   ROOMS_SQLSERVER_DATABASE=ChatwootReports
 *   ROOMS_SQLSERVER_USER=elharaman
 *   ROOMS_SQLSERVER_PASSWORD=********
 *   ROOMS_SQLSERVER_ENCRYPT=false      // زي Stock Watcher: false لسيرفر self-hosted بدون شهادة SSL موثوقة
 *   ROOMS_SQLSERVER_TRUST_CERT=true    // true لسيرفر self-hosted (يتخطى التحقق من الشهادة)
 */

const config: sql.config = {
  server: process.env.ROOMS_SQLSERVER_HOST as string,
  database: process.env.ROOMS_SQLSERVER_DATABASE as string,
  user: process.env.ROOMS_SQLSERVER_USER as string,
  password: process.env.ROOMS_SQLSERVER_PASSWORD as string,
  port: Number(process.env.ROOMS_SQLSERVER_PORT) || 1433,
  options: {
    encrypt: process.env.ROOMS_SQLSERVER_ENCRYPT === "true",
    trustServerCertificate: process.env.ROOMS_SQLSERVER_TRUST_CERT !== "false",
  },
  pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
};

let poolPromise: Promise<sql.ConnectionPool> | null = null;

/** بيرجع Connection Pool واحد مشترك (singleton) بدل ما نفتح اتصال جديد كل ريكوست */
export function getRoomsPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .then((pool) => {
        console.log("[Rooms DB] Connected to SQL Server:", config.server, "/", config.database);
        return pool;
      })
      .catch((err: unknown) => {
        // لو الاتصال فشل، امسح الـ promise عشان المحاولة الجاية تتحاول تاني بدل ما تفضل واقفة على الخطأ ده
        poolPromise = null;
        const message = err instanceof Error ? err.message : String(err);
        console.error("[Rooms DB] Connection failed:", message);
        throw err;
      });
  }
  return poolPromise;
}

export { sql };
