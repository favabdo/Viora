import sql from "mssql";

/**
 * الاتصال بقاعدة بيانات SQL Server الخاصة بسكشن Rooms.
 * ده ملف سيرفر فقط (بيتقرا جوا app/api/... مش جوا component بتاع المتصفح)،
 * عشان بيانات الاتصال متتسربش لأي حد بيفتح الموقع.
 *
 * لازم تحط المتغيرات دي في .env.local (محليًا) وفي إعدادات البيئة بتاعت الاستضافة (Vercel مثلًا):
 *
 *   ROOMS_SQLSERVER_HOST=your-server.database.windows.net
 *   ROOMS_SQLSERVER_PORT=1433
 *   ROOMS_SQLSERVER_DATABASE=RoomsDB
 *   ROOMS_SQLSERVER_USER=sa
 *   ROOMS_SQLSERVER_PASSWORD=********
 *   ROOMS_SQLSERVER_ENCRYPT=true      // true لو سيرفر سحابي (Azure)، false لو سيرفر محلي بدون شهادة SSL
 */

let poolPromise: Promise<sql.ConnectionPool> | null = null;

function readConfig(): sql.config {
  const host = process.env.ROOMS_SQLSERVER_HOST;
  const database = process.env.ROOMS_SQLSERVER_DATABASE;
  const user = process.env.ROOMS_SQLSERVER_USER;
  const password = process.env.ROOMS_SQLSERVER_PASSWORD;

  if (!host || !database || !user || !password) {
    throw new Error(
      "بيانات الاتصال بقاعدة بيانات Rooms ناقصة. تأكد إنك حاطط ROOMS_SQLSERVER_HOST / DATABASE / USER / PASSWORD في .env.local"
    );
  }

  return {
    server: host,
    port: process.env.ROOMS_SQLSERVER_PORT ? Number(process.env.ROOMS_SQLSERVER_PORT) : 1433,
    database,
    user,
    password,
    options: {
      encrypt: (process.env.ROOMS_SQLSERVER_ENCRYPT ?? "true") === "true",
      trustServerCertificate: (process.env.ROOMS_SQLSERVER_TRUST_CERT ?? "false") === "true",
    },
    pool: {
      max: 5,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}

/** بيرجع Connection Pool واحد مشترك (singleton) بدل ما نفتح اتصال جديد كل ريكوست */
export function getRoomsPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    const connecting: Promise<sql.ConnectionPool> = new sql.ConnectionPool(readConfig())
      .connect()
      .catch((err: unknown) => {
        // لو الاتصال فشل، امسح الـ promise عشان المحاولة الجاية تتحاول تاني بدل ما تفضل واقفة على الخطأ ده
        poolPromise = null;
        throw err;
      });
    poolPromise = connecting;
  }
  return poolPromise;
}

export { sql };
