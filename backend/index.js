require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
const { createRemoteJWKSet, jwtVerify } = require("jose");
const { seedData, resetSalonImages } = require("./seed/seedOps");

const prisma = new PrismaClient();
const app = express();
const notificationStreams = new Map();

app.use(cors());
app.use(express.json({ limit: "50mb" }));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const jwksUrl = SUPABASE_URL
  ? new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
  : null;

if (jwksUrl && SUPABASE_ANON_KEY) {
  jwksUrl.searchParams.set("apikey", SUPABASE_ANON_KEY);
}

const JWKS = jwksUrl
  ? createRemoteJWKSet(jwksUrl, {
      headers: SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : undefined,
    })
  : null;

async function verifyAuthToken(token) {
  if (!JWKS || !SUPABASE_URL) {
    throw new Error("Auth nie skonfigurowany");
  }

  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `${SUPABASE_URL}/auth/v1`,
    audience: "authenticated",
  });
  return payload;
}

async function requireAuth(req, res, next) {
  if (!JWKS || !SUPABASE_URL) {
    return res.status(500).json({ error: "Auth nie skonfigurowany" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Brak tokenu" });
  }

  try {
    const payload = await verifyAuthToken(token);
    req.auth = payload;
    return next();
  } catch (err) {
    console.error("Auth verify error:", err);
    return res
      .status(401)
      .json({ error: "Niepoprawny token", details: err?.message });
  }
}

function extractEmailFromAuth(authPayload) {
  const raw =
    authPayload?.email ??
    authPayload?.user_metadata?.email ??
    authPayload?.app_metadata?.email ??
    null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  return trimmed || null;
}

async function getOrCreateUser(authUserId, email) {
  const normalizedEmail =
    typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null;

  return prisma.user.upsert({
    where: { authUserId },
    update: normalizedEmail ? { email: normalizedEmail } : {},
    create: normalizedEmail ? { authUserId, email: normalizedEmail } : { authUserId },
  });
}

async function requireUser(req, res, next) {
  try {
    const authUserId = req.auth?.sub;
    if (!authUserId) {
      return res.status(401).json({ error: "Brak danych uzytkownika" });
    }
    const user = await getOrCreateUser(authUserId, extractEmailFromAuth(req.auth));
    req.user = user;
    return next();
  } catch (err) {
    console.error("User load error:", err);
    return res.status(500).json({ error: "Blad pobierania uzytkownika" });
  }
}

function requireRole(roles) {
  return async (req, res, next) => {
    try {
      const authUserId = req.auth?.sub;
      if (!authUserId) {
        return res.status(401).json({ error: "Brak danych uzytkownika" });
      }
      const user = req.user || (await getOrCreateUser(authUserId, extractEmailFromAuth(req.auth)));
      req.user = user;
      if (!roles.includes(user.role)) {
        return res.status(403).json({ error: "Brak uprawnien" });
      }
      return next();
    } catch (err) {
      console.error("Role check error:", err);
      return res.status(500).json({ error: "Blad autoryzacji" });
    }
  };
}

async function getSalonForAccess(req, res, salonId) {
  const salon = await prisma.salon.findUnique({ where: { id: salonId } });
  if (!salon) {
    res.status(404).json({ error: "Nie znaleziono salonu" });
    return null;
  }

  const user = req.user;
  if (user?.role === "ADMIN") return salon;
  if (user?.role !== "OWNER") {
    res.status(403).json({ error: "Brak uprawnien" });
    return null;
  }
  if (salon.ownerId !== user.id) {
    res.status(403).json({ error: "Brak dostepu do salonu" });
    return null;
  }

  return salon;
}

async function getBookingForManagement(req, res, bookingId) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      service: true,
      salon: true,
      user: { select: { id: true, authUserId: true, role: true } },
    },
  });

  if (!booking) {
    res.status(404).json({ error: "Nie znaleziono rezerwacji" });
    return null;
  }

  const user = req.user;
  if (user?.role === "ADMIN") return booking;
  if (user?.role !== "OWNER") {
    res.status(403).json({ error: "Brak uprawnien" });
    return null;
  }
  if (booking.salon?.ownerId !== user.id) {
    res.status(403).json({ error: "Brak dostepu do rezerwacji" });
    return null;
  }

  return booking;
}

function pushNotificationEvent(userId, payload) {
  if (!userId) return;
  const targets = notificationStreams.get(userId);
  if (!targets || targets.size === 0) return;

  const data = `event: notification\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const stream of targets) {
    try {
      stream.write(data);
    } catch {
      // closed stream will be removed on req close
    }
  }
}

function formatDateTimeForNotification(value) {
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function createNotification({ userId, bookingId = null, type, title, message }) {
  if (!userId) return null;

  try {
    const created = await prisma.notification.create({
      data: { userId, bookingId, type, title, message },
    });
    pushNotificationEvent(created.userId, {
      id: created.id,
      type: created.type,
      createdAt: created.createdAt,
    });
    return created;
  } catch (err) {
    if (err?.code === "P2021") return null;
    console.error("Notification create error:", err);
    return null;
  }
}

async function createBookingReminderNotifications(now = new Date()) {
  try {
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const bookings = await prisma.booking.findMany({
      where: {
        userId: { not: null },
        dateTime: { gt: now, lte: in24h },
      },
      select: {
        id: true,
        userId: true,
        dateTime: true,
        service: { select: { name: true } },
      },
    });

    if (bookings.length === 0) return 0;

    const existing = await prisma.notification.findMany({
      where: {
        type: "BOOKING_REMINDER_24H",
        bookingId: { in: bookings.map((item) => item.id) },
      },
      select: { bookingId: true },
    });

    const existingBookingIds = new Set(existing.map((item) => item.bookingId).filter(Boolean));
    const toCreate = bookings
      .filter((booking) => !existingBookingIds.has(booking.id))
      .map((booking) => ({
        userId: booking.userId,
        bookingId: booking.id,
        type: "BOOKING_REMINDER_24H",
        title: "Przypomnienie o rezerwacji",
        message: `Twoja rezerwacja "${booking.service.name}" zaczyna sie ${formatDateTimeForNotification(
          booking.dateTime
        )}.`,
      }));

    if (toCreate.length === 0) return 0;
    await prisma.notification.createMany({ data: toCreate });
    return toCreate.length;
  } catch (err) {
    if (err?.code === "P2021") return 0;
    console.error("Reminder sweep error:", err);
    return 0;
  }
}

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

async function syncUserRoleBySalonCount(tx, userId) {
  if (!userId) return;

  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!user || user.role === "ADMIN") return;

  const ownedSalonsCount = await tx.salon.count({
    where: { ownerId: user.id },
  });

  const nextRole = ownedSalonsCount > 0 ? "OWNER" : "USER";
  if (user.role !== nextRole) {
    await tx.user.update({
      where: { id: user.id },
      data: { role: nextRole },
    });
  }
}

async function resolveOwnerIdInput(ownerId, ownerEmail) {
  if (ownerEmail !== undefined) {
    if (ownerEmail === null || String(ownerEmail).trim() === "") {
      return { ownerId: null };
    }

    const normalizedEmail = String(ownerEmail).trim().toLowerCase();
    const ownerUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!ownerUser) {
      return { error: "Nie znaleziono uzytkownika o podanym emailu" };
    }

    return { ownerId: ownerUser.id };
  }

  if (ownerId === undefined) {
    return { ownerId: undefined };
  }
  if (ownerId === null || ownerId === "") {
    return { ownerId: null };
  }

  const parsedOwnerId = Number(ownerId);
  if (Number.isNaN(parsedOwnerId)) {
    return { error: "ownerId musi byc liczba" };
  }

  const ownerUser = await prisma.user.findUnique({
    where: { id: parsedOwnerId },
    select: { id: true },
  });
  if (!ownerUser) {
    return { error: "Nie znaleziono uzytkownika o podanym ownerId" };
  }

  return { ownerId: parsedOwnerId };
}

function monthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function monthLabel(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${month}.${date.getFullYear()}`;
}

function parseStatsMonths(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 6;
  const normalized = Math.floor(parsed);
  if (normalized < 1) return 1;
  if (normalized > 24) return 24;
  return normalized;
}

app.get("/salons", async (req, res) => {
  try {
    const salons = await prisma.salon.findMany({
      orderBy: { id: "asc" },
      include: { services: true, images: true },
    });
    res.json(salons);
  } catch {
    res.status(500).json({ error: "Blad pobierania salonow" });
  }
});

app.get("/salons/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Niepoprawne id salonu" });
    }

    const salon = await prisma.salon.findUnique({
      where: { id },
      include: { services: true, images: true },
    });

    if (!salon) return res.status(404).json({ error: "Nie znaleziono salonu" });
    res.json(salon);
  } catch {
    res.status(500).json({ error: "Blad pobierania salonu" });
  }
});

app.get("/salons/:id/services", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Niepoprawne id salonu" });
    }
    const services = await prisma.service.findMany({
      where: { salonId: id },
      orderBy: { id: "asc" },
    });
    res.json(services);
  } catch {
    res.status(500).json({ error: "Blad pobierania uslug salonu" });
  }
});

app.get("/services", async (req, res) => {
  try {
    const services = await prisma.service.findMany({
      orderBy: { id: "asc" },
    });
    res.json(services);
  } catch {
    res.status(500).json({ error: "Blad serwera" });
  }
});

app.post("/services", requireAuth, requireUser, async (req, res) => {
  try {
    const { salonId, name, duration, price } = req.body;

    if (!salonId || !name || duration == null || price == null) {
      return res.status(400).json({ error: "Niepoprawne dane" });
    }

    const sid = Number(salonId);
    if (Number.isNaN(sid)) {
      return res.status(400).json({ error: "salonId musi byc liczba" });
    }

    const salon = await getSalonForAccess(req, res, sid);
    if (!salon) return;

    const service = await prisma.service.create({
      data: {
        salonId: sid,
        name: String(name),
        duration: Number(duration),
        price: Number(price),
      },
    });

    res.status(201).json(service);
  } catch {
    res.status(500).json({ error: "Blad serwera" });
  }
});

app.post("/salons/:id/services", requireAuth, requireUser, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Niepoprawne id salonu" });
    }

    const { name, duration, price } = req.body;
    if (!name || duration == null || price == null) {
      return res.status(400).json({ error: "Niepoprawne dane" });
    }

    const salon = await getSalonForAccess(req, res, id);
    if (!salon) return;

    const service = await prisma.service.create({
      data: {
        salonId: id,
        name: String(name),
        duration: Number(duration),
        price: Number(price),
      },
    });

    res.status(201).json(service);
  } catch {
    res.status(500).json({ error: "Blad dodawania uslugi" });
  }
});

app.get("/seed", async (req, res) => {
  try {
    const data = await seedData(prisma);
    res.json(data);
  } catch (err) {
    console.error("Seed error:", err);
    res.status(500).json({ error: "Blad serwera", details: err?.message });
  }
});

app.post("/seed/reset", async (req, res) => {
  try {
    await prisma.review.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.service.deleteMany();
    await prisma.salonImage.deleteMany();
    await prisma.salon.deleteMany();

    const data = await seedData(prisma);
    res.json(data);
  } catch (err) {
    console.error("Seed reset error:", err);
    res.status(500).json({ error: "Blad serwera", details: err?.message });
  }
});

app.post("/seed/reset-images", async (req, res) => {
  try {
    const updated = await resetSalonImages(prisma);
    res.json({ updated: updated.length });
  } catch (err) {
    console.error("Seed images reset error:", err);
    res.status(500).json({ error: "Blad serwera", details: err?.message });
  }
});

app.get("/bookings", async (req, res) => {
  try {
    const { salonId, serviceId } = req.query;
    const where = {};

    if (salonId != null) {
      const sid = Number(salonId);
      if (!Number.isNaN(sid)) where.salonId = sid;
    }

    if (serviceId != null) {
      const svcId = Number(serviceId);
      if (!Number.isNaN(svcId)) where.serviceId = svcId;
    }

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { dateTime: "asc" },
      include: {
        service: true,
        user: { select: { id: true, authUserId: true, role: true } },
      },
    });
    res.json(bookings);
  } catch {
    res.status(500).json({ error: "Blad pobierania rezerwacji" });
  }
});

app.get("/reviews", async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
    });
    res.json(reviews);
  } catch (err) {
    console.error("Reviews error:", err);
    res.status(500).json({ error: "Blad pobierania opinii" });
  }
});

app.post("/reviews", async (req, res) => {
  try {
    const { name, city, rating, text } = req.body;

    if (!name || !city || !text || rating == null) {
      return res.status(400).json({ error: "Brakuje danych opinii" });
    }

    const parsedRating = Number(rating);
    if (Number.isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ error: "Ocena musi byc od 1 do 5" });
    }

    const review = await prisma.review.create({
      data: {
        name: String(name).trim(),
        city: String(city).trim(),
        rating: parsedRating,
        text: String(text).trim(),
      },
    });

    res.status(201).json(review);
  } catch (err) {
    console.error("Review create error:", err);
    res.status(500).json({ error: "Blad zapisu opinii" });
  }
});

app.get("/me", requireAuth, requireUser, async (req, res) => {
  const user = req.user;
  res.json({ id: user.id, authUserId: user.authUserId, email: user.email, role: user.role });
});

app.get("/notifications", requireAuth, requireUser, async (req, res) => {
  try {
    await createBookingReminderNotifications();

    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, rawLimit)) : 20;
    const userId = req.user.id;

    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    res.json({ items, unreadCount });
  } catch (err) {
    console.error("Notifications list error:", err);
    res.status(500).json({ error: "Blad pobierania powiadomien" });
  }
});

app.get("/notifications/stream", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : null;
  if (!token) {
    return res.status(401).json({ error: "Brak tokenu" });
  }

  try {
    const auth = await verifyAuthToken(token);
    const authUserId = auth?.sub;
    if (!authUserId) {
      return res.status(401).json({ error: "Brak danych uzytkownika" });
    }

    const user = await getOrCreateUser(authUserId, extractEmailFromAuth(auth));

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (res.flushHeaders) res.flushHeaders();

    if (!notificationStreams.has(user.id)) {
      notificationStreams.set(user.id, new Set());
    }
    notificationStreams.get(user.id).add(res);

    res.write(`event: ready\ndata: {"ok":true}\n\n`);

    const keepAlive = setInterval(() => {
      try {
        res.write(`event: ping\ndata: {}\n\n`);
      } catch {
        // handled by close
      }
    }, 25000);

    req.on("close", () => {
      clearInterval(keepAlive);
      const targets = notificationStreams.get(user.id);
      if (!targets) return;
      targets.delete(res);
      if (targets.size === 0) {
        notificationStreams.delete(user.id);
      }
    });
  } catch (err) {
    return res.status(401).json({ error: "Niepoprawny token", details: err?.message });
  }
});

app.patch("/notifications/:id/read", requireAuth, requireUser, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Niepoprawne id powiadomienia" });
    }

    const result = await prisma.notification.updateMany({
      where: { id, userId: req.user.id },
      data: { isRead: true },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: "Nie znaleziono powiadomienia" });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Notification read error:", err);
    res.status(500).json({ error: "Blad aktualizacji powiadomienia" });
  }
});

app.patch("/notifications/read-all", requireAuth, requireUser, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("Notification read-all error:", err);
    res.status(500).json({ error: "Blad aktualizacji powiadomien" });
  }
});

app.delete("/notifications/:id", requireAuth, requireUser, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Niepoprawne id powiadomienia" });
    }

    const result = await prisma.notification.deleteMany({
      where: { id, userId: req.user.id },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: "Nie znaleziono powiadomienia" });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Notification delete error:", err);
    res.status(500).json({ error: "Blad usuwania powiadomienia" });
  }
});

app.get("/admin/salons", requireAuth, requireUser, requireRole(["ADMIN"]), async (req, res) => {
  try {
    const salons = await prisma.salon.findMany({
      orderBy: { id: "asc" },
      include: {
        services: true,
        images: true,
        owner: { select: { id: true, authUserId: true, email: true, role: true } },
      },
    });
    res.json(salons);
  } catch (err) {
    console.error("Admin salons error:", err);
    res.status(500).json({ error: "Blad pobierania salonow" });
  }
});

app.post("/admin/salons", requireAuth, requireUser, requireRole(["ADMIN"]), async (req, res) => {
  try {
    const {
      name,
      city,
      description,
      address,
      phone,
      hours,
      imageUrl,
      ownerId,
      ownerEmail,
    } = req.body;

    const parsedName = String(name || "").trim();
    const parsedCity = String(city || "").trim();
    if (!parsedName || !parsedCity) {
      return res.status(400).json({ error: "Nazwa i miasto sa wymagane" });
    }

    let parsedOwnerId = null;
    if (ownerId !== undefined || ownerEmail !== undefined) {
      const ownerResolution = await resolveOwnerIdInput(ownerId, ownerEmail);
      if (ownerResolution.error) {
        return res.status(400).json({ error: ownerResolution.error });
      }
      parsedOwnerId = ownerResolution.ownerId ?? null;
    }

    const salon = await prisma.$transaction(async (tx) => {
      const created = await tx.salon.create({
        data: {
          name: parsedName,
          city: parsedCity,
          description: description ? String(description) : null,
          address: address ? String(address) : null,
          phone: phone ? String(phone) : null,
          hours: hours === undefined ? null : (hours === null ? null : hours),
          imageUrl: imageUrl ? String(imageUrl) : null,
          ownerId: parsedOwnerId,
        },
      });

      await syncUserRoleBySalonCount(tx, created.ownerId);

      return tx.salon.findUnique({
        where: { id: created.id },
        include: {
          services: true,
          images: true,
          owner: { select: { id: true, authUserId: true, email: true, role: true } },
        },
      });
    });

    res.status(201).json(salon);
  } catch (err) {
    console.error("Admin salon create error:", err);
    res.status(500).json({ error: "Blad tworzenia salonu" });
  }
});

app.get("/admin/bookings", requireAuth, requireUser, requireRole(["ADMIN"]), async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      orderBy: { dateTime: "asc" },
      include: {
        service: true,
        salon: true,
        user: { select: { id: true, authUserId: true, role: true } },
      },
    });
    res.json(bookings);
  } catch (err) {
    console.error("Admin bookings error:", err);
    res.status(500).json({ error: "Blad pobierania rezerwacji" });
  }
});

app.patch("/admin/bookings/:id", requireAuth, requireUser, requireRole(["ADMIN"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Niepoprawne id rezerwacji" });
    }

    const booking = await getBookingForManagement(req, res, id);
    if (!booking) return;

    const { time } = req.body;
    if (time === undefined) {
      return res.status(400).json({ error: "time jest wymagany (HH:mm)" });
    }

    const normalizedTime = String(time).trim();
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(normalizedTime)) {
      return res.status(400).json({ error: "time ma zly format (HH:mm)" });
    }
    const [hours, minutes] = normalizedTime.split(":").map(Number);
    const dt = new Date(booking.dateTime);
    dt.setHours(hours, minutes, 0, 0);

    const conflict = await prisma.booking.findUnique({
      where: {
        serviceId_dateTime: {
          serviceId: booking.serviceId,
          dateTime: dt,
        },
      },
    });
    if (conflict && conflict.id !== booking.id) {
      return res.status(409).json({ error: "Termin zajety" });
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: { dateTime: dt },
      include: {
        service: true,
        salon: true,
        user: { select: { id: true, authUserId: true, role: true } },
      },
    });

    await createNotification({
      userId: updated.userId,
      bookingId: updated.id,
      type: "BOOKING_RESCHEDULED",
      title: "Zmiana terminu rezerwacji",
      message: `Termin rezerwacji "${updated.service.name}" zostal zmieniony z ${formatDateTimeForNotification(
        booking.dateTime
      )} na ${formatDateTimeForNotification(updated.dateTime)}.`,
    });

    res.json(updated);
  } catch (err) {
    console.error("Admin booking update error:", err);
    if (err?.code === "P2002") return res.status(409).json({ error: "Termin zajety" });
    res.status(500).json({ error: "Blad aktualizacji rezerwacji" });
  }
});

app.delete("/admin/bookings/:id", requireAuth, requireUser, requireRole(["ADMIN"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Niepoprawne id rezerwacji" });
    }

    const booking = await getBookingForManagement(req, res, id);
    if (!booking) return;

    await createNotification({
      userId: booking.userId,
      bookingId: null,
      type: "BOOKING_CANCELLED",
      title: "Rezerwacja anulowana",
      message: `Twoja rezerwacja "${booking.service.name}" (${formatDateTimeForNotification(
        booking.dateTime
      )}) zostala anulowana.`,
    });

    await prisma.booking.delete({ where: { id } });

    res.json({ ok: true });
  } catch (err) {
    console.error("Admin booking delete error:", err);
    res.status(500).json({ error: "Blad anulowania rezerwacji" });
  }
});

app.patch("/admin/salons/:id", requireAuth, requireUser, requireRole(["ADMIN"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Niepoprawne id salonu" });
    }

    const {
      name,
      city,
      description,
      address,
      phone,
      hours,
      imageUrl,
      ownerId,
      ownerEmail,
    } = req.body;

    const data = {};
    if (name !== undefined) data.name = String(name);
    if (city !== undefined) data.city = String(city);
    if (description !== undefined) data.description = description ? String(description) : null;
    if (address !== undefined) data.address = address ? String(address) : null;
    if (phone !== undefined) data.phone = phone ? String(phone) : null;
    if (hours !== undefined) data.hours = hours === null ? null : hours;
    if (imageUrl !== undefined) data.imageUrl = imageUrl ? String(imageUrl) : null;
    if (ownerId !== undefined || ownerEmail !== undefined) {
      const ownerResolution = await resolveOwnerIdInput(ownerId, ownerEmail);
      if (ownerResolution.error) {
        return res.status(400).json({ error: ownerResolution.error });
      }
      if (ownerResolution.ownerId !== undefined) {
        data.ownerId = ownerResolution.ownerId;
      }
    }

    const salon = await prisma.$transaction(async (tx) => {
      const before = await tx.salon.findUnique({
        where: { id },
        select: { ownerId: true },
      });

      const updated = await tx.salon.update({
        where: { id },
        data,
        select: { id: true, ownerId: true },
      });

      const ownerIdsToSync = new Set(
        [before?.ownerId ?? null, updated.ownerId ?? null].filter((value) => value != null)
      );
      for (const ownerUserId of ownerIdsToSync) {
        await syncUserRoleBySalonCount(tx, ownerUserId);
      }

      return tx.salon.findUnique({
        where: { id: updated.id },
        include: {
          services: true,
          images: true,
          owner: { select: { id: true, authUserId: true, email: true, role: true } },
        },
      });
    });

    res.json(salon);
  } catch (err) {
    console.error("Admin salon update error:", err);
    res.status(500).json({ error: "Blad aktualizacji salonu" });
  }
});

app.delete("/admin/salons/:id", requireAuth, requireUser, requireRole(["ADMIN"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Niepoprawne id salonu" });
    }

    const existing = await prisma.salon.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "Nie znaleziono salonu" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.salon.delete({ where: { id } });
      await syncUserRoleBySalonCount(tx, existing.ownerId);
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("Admin salon delete error:", err);
    res.status(500).json({ error: "Blad usuwania salonu" });
  }
});

app.post("/admin/salons/:id/images", requireAuth, requireUser, requireRole(["ADMIN"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Niepoprawne id salonu" });
    }

    const { url, setAsMain } = req.body;
    if (!url) {
      return res.status(400).json({ error: "Brak url" });
    }

    const image = await prisma.salonImage.create({
      data: {
        salonId: id,
        url: String(url),
      },
    });

    if (setAsMain) {
      await prisma.salon.update({
        where: { id },
        data: { imageUrl: image.url },
      });
    }

    res.status(201).json(image);
  } catch (err) {
    console.error("Admin image add error:", err);
    res.status(500).json({ error: "Blad dodawania zdjecia" });
  }
});

app.delete("/admin/images/:id", requireAuth, requireUser, requireRole(["ADMIN"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Niepoprawne id zdjecia" });
    }

    const image = await prisma.salonImage.findUnique({ where: { id } });
    if (!image) return res.status(404).json({ error: "Nie znaleziono zdjecia" });

    await prisma.salonImage.delete({ where: { id } });

    const salon = await prisma.salon.findUnique({ where: { id: image.salonId } });
    if (salon?.imageUrl === image.url) {
      const remaining = await prisma.salonImage.findFirst({
        where: { salonId: image.salonId },
        orderBy: { id: "asc" },
      });
      await prisma.salon.update({
        where: { id: image.salonId },
        data: { imageUrl: remaining ? remaining.url : null },
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Admin image delete error:", err);
    res.status(500).json({ error: "Blad usuwania zdjecia" });
  }
});

app.patch("/admin/salons/:id/main-image", requireAuth, requireUser, requireRole(["ADMIN"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Niepoprawne id salonu" });
    }

    const { imageId } = req.body;
    const parsedImageId = Number(imageId);
    if (Number.isNaN(parsedImageId)) {
      return res.status(400).json({ error: "imageId musi byc liczba" });
    }

    const image = await prisma.salonImage.findUnique({ where: { id: parsedImageId } });
    if (!image || image.salonId !== id) {
      return res.status(404).json({ error: "Nie znaleziono zdjecia" });
    }

    const salon = await prisma.salon.update({
      where: { id },
      data: { imageUrl: image.url },
    });

    res.json(salon);
  } catch (err) {
    console.error("Admin main image error:", err);
    res.status(500).json({ error: "Blad ustawiania zdjecia glownego" });
  }
});

app.post("/admin/salons/:id/services", requireAuth, requireUser, requireRole(["ADMIN"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Niepoprawne id salonu" });
    }

    const { name, duration, price } = req.body;
    if (!name || duration == null || price == null) {
      return res.status(400).json({ error: "Niepoprawne dane" });
    }

    const service = await prisma.service.create({
      data: {
        salonId: id,
        name: String(name),
        duration: Number(duration),
        price: Number(price),
      },
    });

    res.status(201).json(service);
  } catch (err) {
    console.error("Admin service add error:", err);
    res.status(500).json({ error: "Blad dodawania uslugi" });
  }
});

app.patch("/admin/services/:id", requireAuth, requireUser, requireRole(["ADMIN"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Niepoprawne id uslugi" });
    }

    const { name, duration, price } = req.body;
    const data = {};
    if (name !== undefined) data.name = String(name);
    if (duration !== undefined) data.duration = Number(duration);
    if (price !== undefined) data.price = Number(price);

    const service = await prisma.service.update({
      where: { id },
      data,
    });

    res.json(service);
  } catch (err) {
    console.error("Admin service update error:", err);
    res.status(500).json({ error: "Blad aktualizacji uslugi" });
  }
});

app.delete("/admin/services/:id", requireAuth, requireUser, requireRole(["ADMIN"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Niepoprawne id uslugi" });
    }

    await prisma.service.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    console.error("Admin service delete error:", err);
    res.status(500).json({ error: "Blad usuwania uslugi" });
  }
});

app.get("/owner/salons", requireAuth, requireUser, requireRole(["OWNER", "ADMIN"]), async (req, res) => {
  try {
    const user = req.user;
    const where = user.role === "ADMIN" ? {} : { ownerId: user.id };

    const salons = await prisma.salon.findMany({
      where,
      orderBy: { id: "asc" },
      include: { services: true, images: true },
    });
    res.json(salons);
  } catch (err) {
    console.error("Owner salons error:", err);
    res.status(500).json({ error: "Blad pobierania salonow" });
  }
});

app.get("/owner/salons/:id/stats", requireAuth, requireUser, requireRole(["OWNER", "ADMIN"]), async (req, res) => {
  try {
    const salonId = Number(req.params.id);
    if (Number.isNaN(salonId)) {
      return res.status(400).json({ error: "Niepoprawne id salonu" });
    }

    const salon = await getSalonForAccess(req, res, salonId);
    if (!salon) return;

    const months = parseStatsMonths(req.query.months);
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthBuckets = [];
    for (let i = months - 1; i >= 0; i -= 1) {
      const date = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() - i, 1);
      monthBuckets.push({
        key: monthKey(date),
        label: monthLabel(date),
        count: 0,
      });
    }

    const monthMap = new Map(monthBuckets.map((bucket) => [bucket.key, bucket]));

    const bookings = await prisma.booking.findMany({
      where: { salonId },
      select: {
        dateTime: true,
        service: { select: { id: true, name: true } },
      },
    });

    const serviceCounter = new Map();
    for (const booking of bookings) {
      const key = monthKey(new Date(booking.dateTime));
      const bucket = monthMap.get(key);
      if (bucket) {
        bucket.count += 1;
      }

      const serviceId = booking.service?.id;
      if (serviceId) {
        const current = serviceCounter.get(serviceId) || {
          serviceId,
          name: booking.service.name,
          count: 0,
        };
        current.count += 1;
        serviceCounter.set(serviceId, current);
      }
    }

    const monthly = monthBuckets.map((bucket) => ({
      month: bucket.key,
      label: bucket.label,
      count: bucket.count,
    }));

    const totalBookings = monthly.reduce((sum, item) => sum + item.count, 0);
    const bookingsThisMonth = monthly[monthly.length - 1]?.count || 0;
    const bookingsPrevMonth = monthly[monthly.length - 2]?.count || 0;
    const topServices = Array.from(serviceCounter.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    res.json({
      salonId: salon.id,
      salonName: salon.name,
      months,
      totalBookings,
      bookingsThisMonth,
      bookingsPrevMonth,
      monthly,
      topServices,
    });
  } catch (err) {
    console.error("Owner salon stats error:", err);
    res.status(500).json({ error: "Blad pobierania statystyk salonu" });
  }
});

app.get("/owner/bookings", requireAuth, requireUser, requireRole(["OWNER", "ADMIN"]), async (req, res) => {
  try {
    const user = req.user;
    const where = user.role === "ADMIN" ? {} : { salon: { ownerId: user.id } };
    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { dateTime: "asc" },
      include: {
        service: true,
        salon: true,
        user: { select: { id: true, authUserId: true, role: true } },
      },
    });
    res.json(bookings);
  } catch (err) {
    console.error("Owner bookings error:", err);
    res.status(500).json({ error: "Blad pobierania rezerwacji" });
  }
});

app.patch("/owner/bookings/:id", requireAuth, requireUser, requireRole(["OWNER", "ADMIN"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Niepoprawne id rezerwacji" });
    }

    const booking = await getBookingForManagement(req, res, id);
    if (!booking) return;

    const { time } = req.body;
    if (time === undefined) {
      return res.status(400).json({ error: "time jest wymagany (HH:mm)" });
    }

    const normalizedTime = String(time).trim();
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(normalizedTime)) {
      return res.status(400).json({ error: "time ma zly format (HH:mm)" });
    }
    const [hours, minutes] = normalizedTime.split(":").map(Number);
    const dt = new Date(booking.dateTime);
    dt.setHours(hours, minutes, 0, 0);

    const conflict = await prisma.booking.findUnique({
      where: {
        serviceId_dateTime: {
          serviceId: booking.serviceId,
          dateTime: dt,
        },
      },
    });
    if (conflict && conflict.id !== booking.id) {
      return res.status(409).json({ error: "Termin zajety" });
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: { dateTime: dt },
      include: {
        service: true,
        salon: true,
        user: { select: { id: true, authUserId: true, role: true } },
      },
    });

    await createNotification({
      userId: updated.userId,
      bookingId: updated.id,
      type: "BOOKING_RESCHEDULED",
      title: "Zmiana terminu rezerwacji",
      message: `Termin rezerwacji "${updated.service.name}" zostal zmieniony z ${formatDateTimeForNotification(
        booking.dateTime
      )} na ${formatDateTimeForNotification(updated.dateTime)}.`,
    });

    res.json(updated);
  } catch (err) {
    console.error("Owner booking update error:", err);
    if (err?.code === "P2002") return res.status(409).json({ error: "Termin zajety" });
    res.status(500).json({ error: "Blad aktualizacji rezerwacji" });
  }
});

app.delete("/owner/bookings/:id", requireAuth, requireUser, requireRole(["OWNER", "ADMIN"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Niepoprawne id rezerwacji" });
    }

    const booking = await getBookingForManagement(req, res, id);
    if (!booking) return;

    await createNotification({
      userId: booking.userId,
      bookingId: null,
      type: "BOOKING_CANCELLED",
      title: "Rezerwacja anulowana",
      message: `Twoja rezerwacja "${booking.service.name}" (${formatDateTimeForNotification(
        booking.dateTime
      )}) zostala anulowana.`,
    });

    await prisma.booking.delete({ where: { id } });

    res.json({ ok: true });
  } catch (err) {
    console.error("Owner booking delete error:", err);
    res.status(500).json({ error: "Blad anulowania rezerwacji" });
  }
});

app.patch("/owner/salons/:id", requireAuth, requireUser, requireRole(["OWNER", "ADMIN"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Niepoprawne id salonu" });
    }

    const salon = await getSalonForAccess(req, res, id);
    if (!salon) return;

    const { name, city, description, address, phone, hours, imageUrl } = req.body;
    const data = {};
    if (name !== undefined) data.name = String(name);
    if (city !== undefined) data.city = String(city);
    if (description !== undefined) data.description = description ? String(description) : null;
    if (address !== undefined) data.address = address ? String(address) : null;
    if (phone !== undefined) data.phone = phone ? String(phone) : null;
    if (hours !== undefined) data.hours = hours === null ? null : hours;
    if (imageUrl !== undefined) data.imageUrl = imageUrl ? String(imageUrl) : null;

    const updated = await prisma.salon.update({
      where: { id },
      data,
      include: { services: true, images: true },
    });

    res.json(updated);
  } catch (err) {
    console.error("Owner salon update error:", err);
    res.status(500).json({ error: "Blad aktualizacji salonu" });
  }
});

app.post("/owner/salons/:id/images", requireAuth, requireUser, requireRole(["OWNER", "ADMIN"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Niepoprawne id salonu" });
    }

    const salon = await getSalonForAccess(req, res, id);
    if (!salon) return;

    const { url, setAsMain } = req.body;
    if (!url) {
      return res.status(400).json({ error: "Brak url" });
    }

    const image = await prisma.salonImage.create({
      data: {
        salonId: id,
        url: String(url),
      },
    });

    if (setAsMain) {
      await prisma.salon.update({
        where: { id },
        data: { imageUrl: image.url },
      });
    }

    res.status(201).json(image);
  } catch (err) {
    console.error("Owner image add error:", err);
    res.status(500).json({ error: "Blad dodawania zdjecia" });
  }
});

app.delete("/owner/images/:id", requireAuth, requireUser, requireRole(["OWNER", "ADMIN"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Niepoprawne id zdjecia" });
    }

    const image = await prisma.salonImage.findUnique({ where: { id } });
    if (!image) return res.status(404).json({ error: "Nie znaleziono zdjecia" });

    const salon = await getSalonForAccess(req, res, image.salonId);
    if (!salon) return;

    await prisma.salonImage.delete({ where: { id } });

    if (salon.imageUrl === image.url) {
      const remaining = await prisma.salonImage.findFirst({
        where: { salonId: image.salonId },
        orderBy: { id: "asc" },
      });
      await prisma.salon.update({
        where: { id: image.salonId },
        data: { imageUrl: remaining ? remaining.url : null },
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Owner image delete error:", err);
    res.status(500).json({ error: "Blad usuwania zdjecia" });
  }
});

app.patch("/owner/salons/:id/main-image", requireAuth, requireUser, requireRole(["OWNER", "ADMIN"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Niepoprawne id salonu" });
    }

    const salon = await getSalonForAccess(req, res, id);
    if (!salon) return;

    const { imageId } = req.body;
    const parsedImageId = Number(imageId);
    if (Number.isNaN(parsedImageId)) {
      return res.status(400).json({ error: "imageId musi byc liczba" });
    }

    const image = await prisma.salonImage.findUnique({ where: { id: parsedImageId } });
    if (!image || image.salonId !== id) {
      return res.status(404).json({ error: "Nie znaleziono zdjecia" });
    }

    const updated = await prisma.salon.update({
      where: { id },
      data: { imageUrl: image.url },
    });

    res.json(updated);
  } catch (err) {
    console.error("Owner main image error:", err);
    res.status(500).json({ error: "Blad ustawiania zdjecia glownego" });
  }
});

app.post("/owner/salons/:id/services", requireAuth, requireUser, requireRole(["OWNER", "ADMIN"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Niepoprawne id salonu" });
    }

    const salon = await getSalonForAccess(req, res, id);
    if (!salon) return;

    const { name, duration, price } = req.body;
    if (!name || duration == null || price == null) {
      return res.status(400).json({ error: "Niepoprawne dane" });
    }

    const service = await prisma.service.create({
      data: {
        salonId: id,
        name: String(name),
        duration: Number(duration),
        price: Number(price),
      },
    });

    res.status(201).json(service);
  } catch (err) {
    console.error("Owner service add error:", err);
    res.status(500).json({ error: "Blad dodawania uslugi" });
  }
});

app.patch("/owner/services/:id", requireAuth, requireUser, requireRole(["OWNER", "ADMIN"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Niepoprawne id uslugi" });
    }

    const service = await prisma.service.findUnique({
      where: { id },
      include: { salon: true },
    });
    if (!service) return res.status(404).json({ error: "Nie znaleziono uslugi" });

    const salon = await getSalonForAccess(req, res, service.salonId);
    if (!salon) return;

    const { name, duration, price } = req.body;
    const data = {};
    if (name !== undefined) data.name = String(name);
    if (duration !== undefined) data.duration = Number(duration);
    if (price !== undefined) data.price = Number(price);

    const updated = await prisma.service.update({
      where: { id },
      data,
    });

    res.json(updated);
  } catch (err) {
    console.error("Owner service update error:", err);
    res.status(500).json({ error: "Blad aktualizacji uslugi" });
  }
});

app.delete("/owner/services/:id", requireAuth, requireUser, requireRole(["OWNER", "ADMIN"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Niepoprawne id uslugi" });
    }

    const service = await prisma.service.findUnique({
      where: { id },
      include: { salon: true },
    });
    if (!service) return res.status(404).json({ error: "Nie znaleziono uslugi" });

    const salon = await getSalonForAccess(req, res, service.salonId);
    if (!salon) return;

    await prisma.service.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    console.error("Owner service delete error:", err);
    res.status(500).json({ error: "Blad usuwania uslugi" });
  }
});

app.get("/me/bookings", requireAuth, async (req, res) => {
  try {
    const authUserId = req.auth?.sub;
    if (!authUserId) {
      return res.status(401).json({ error: "Brak danych uzytkownika" });
    }

    const user = await getOrCreateUser(authUserId, extractEmailFromAuth(req.auth));

    const bookings = await prisma.booking.findMany({
      where: { userId: user.id },
      orderBy: { dateTime: "asc" },
      include: { service: true, salon: true },
    });

    res.json(bookings);
  } catch (err) {
    console.error("My bookings error:", err);
    res.status(500).json({ error: "Blad pobierania rezerwacji" });
  }
});

app.patch("/me/bookings/:id", requireAuth, async (req, res) => {
  try {
    const authUserId = req.auth?.sub;
    if (!authUserId) {
      return res.status(401).json({ error: "Brak danych uzytkownika" });
    }

    const user = await getOrCreateUser(authUserId, extractEmailFromAuth(req.auth));

    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Niepoprawne id rezerwacji" });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { service: true, salon: true },
    });
    if (!booking) return res.status(404).json({ error: "Nie znaleziono rezerwacji" });
    if (booking.userId !== user.id) {
      return res.status(403).json({ error: "Brak uprawnien" });
    }

    const { salonId, serviceId, clientName, clientPhone, dateTime } = req.body;
    const data = {};

    if (clientName !== undefined) {
      const trimmed = String(clientName).trim();
      if (!trimmed) return res.status(400).json({ error: "Imie jest wymagane" });
      data.clientName = trimmed;
    }

    if (clientPhone !== undefined) {
      data.clientPhone = clientPhone ? String(clientPhone).trim() : null;
    }

    let targetSalonId = booking.salonId;
    let targetServiceId = booking.serviceId;

    if (salonId !== undefined) {
      const parsedSalon = Number(salonId);
      if (Number.isNaN(parsedSalon)) {
        return res.status(400).json({ error: "salonId musi byc liczba" });
      }
      targetSalonId = parsedSalon;
      data.salonId = parsedSalon;
    }

    if (serviceId !== undefined) {
      const parsedService = Number(serviceId);
      if (Number.isNaN(parsedService)) {
        return res.status(400).json({ error: "serviceId musi byc liczba" });
      }
      targetServiceId = parsedService;
      data.serviceId = parsedService;
    }

    if (dateTime !== undefined) {
      const dt = new Date(dateTime);
      if (Number.isNaN(dt.getTime())) {
        return res.status(400).json({ error: "dateTime ma zly format" });
      }
      data.dateTime = dt;
    }

    if (salonId !== undefined || serviceId !== undefined) {
      const service = await prisma.service.findUnique({
        where: { id: targetServiceId },
      });
      if (!service) return res.status(404).json({ error: "Nie ma takiej uslugi" });
      if (service.salonId !== targetSalonId) {
        return res.status(400).json({ error: "Usluga nie nalezy do salonu" });
      }
    }

    if (data.serviceId !== undefined || data.dateTime !== undefined) {
      const checkServiceId = data.serviceId ?? booking.serviceId;
      const checkDateTime = data.dateTime ?? booking.dateTime;
      const conflict = await prisma.booking.findUnique({
        where: {
          serviceId_dateTime: {
            serviceId: checkServiceId,
            dateTime: checkDateTime,
          },
        },
      });
      if (conflict && conflict.id !== booking.id) {
        return res.status(409).json({ error: "Termin zajety" });
      }
    }

    const updated = await prisma.booking.update({
      where: { id },
      data,
      include: { service: true, salon: true },
    });

    const hasDateTimeChanged =
      new Date(updated.dateTime).getTime() !== new Date(booking.dateTime).getTime();
    const hasServiceChanged = updated.serviceId !== booking.serviceId;

    if (hasDateTimeChanged || hasServiceChanged) {
      let title = "Zmiana rezerwacji";
      let message = `Rezerwacja "${updated.service.name}" zostala zaktualizowana.`;

      if (hasDateTimeChanged && hasServiceChanged) {
        const previousServiceName = booking.service?.name || "Usluga";
        message = `Rezerwacja zostala zmieniona: usluga z "${previousServiceName}" na "${updated.service.name}", termin z ${formatDateTimeForNotification(
          booking.dateTime
        )} na ${formatDateTimeForNotification(updated.dateTime)}.`;
      } else if (hasServiceChanged) {
        title = "Zmiana uslugi rezerwacji";
        const previousServiceName = booking.service?.name || "Usluga";
        message = `Usluga w rezerwacji zostala zmieniona z "${previousServiceName}" na "${updated.service.name}".`;
      } else if (hasDateTimeChanged) {
        title = "Zmiana terminu rezerwacji";
        message = `Termin rezerwacji "${updated.service.name}" zostal zmieniony z ${formatDateTimeForNotification(
          booking.dateTime
        )} na ${formatDateTimeForNotification(updated.dateTime)}.`;
      }

      await createNotification({
        userId: updated.userId,
        bookingId: updated.id,
        type: "BOOKING_RESCHEDULED",
        title,
        message,
      });
    }

    res.json(updated);
  } catch (err) {
    console.error("Booking update error:", err);
    if (err?.code === "P2002") return res.status(409).json({ error: "Termin zajety" });
    res.status(500).json({ error: "Blad aktualizacji rezerwacji" });
  }
});

app.delete("/me/bookings/:id", requireAuth, async (req, res) => {
  try {
    const authUserId = req.auth?.sub;
    if (!authUserId) {
      return res.status(401).json({ error: "Brak danych uzytkownika" });
    }

    const user = await getOrCreateUser(authUserId, extractEmailFromAuth(req.auth));

    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: "Niepoprawne id rezerwacji" });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { service: true },
    });
    if (!booking) return res.status(404).json({ error: "Nie znaleziono rezerwacji" });
    if (booking.userId !== user.id) {
      return res.status(403).json({ error: "Brak uprawnien" });
    }

    await createNotification({
      userId: booking.userId,
      bookingId: null,
      type: "BOOKING_CANCELLED",
      title: "Rezerwacja anulowana",
      message: `Twoja rezerwacja "${booking.service.name}" (${formatDateTimeForNotification(
        booking.dateTime
      )}) zostala anulowana.`,
    });

    await prisma.booking.delete({ where: { id } });

    res.json({ ok: true });
  } catch (err) {
    console.error("Booking delete error:", err);
    res.status(500).json({ error: "Blad anulowania rezerwacji" });
  }
});

app.get("/admin/salons/:id/stats", requireAuth, requireUser, requireRole(["ADMIN"]), async (req, res) => {
  try {
    const salonId = Number(req.params.id);
    if (Number.isNaN(salonId)) {
      return res.status(400).json({ error: "Niepoprawne id salonu" });
    }

    const salon = await prisma.salon.findUnique({
      where: { id: salonId },
      select: { id: true, name: true },
    });
    if (!salon) {
      return res.status(404).json({ error: "Nie znaleziono salonu" });
    }

    const months = parseStatsMonths(req.query.months);
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthBuckets = [];
    for (let i = months - 1; i >= 0; i -= 1) {
      const date = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() - i, 1);
      monthBuckets.push({
        key: monthKey(date),
        label: monthLabel(date),
        count: 0,
      });
    }

    const monthMap = new Map(monthBuckets.map((bucket) => [bucket.key, bucket]));

    const bookings = await prisma.booking.findMany({
      where: { salonId },
      select: {
        dateTime: true,
        service: { select: { id: true, name: true } },
      },
    });

    const serviceCounter = new Map();
    for (const booking of bookings) {
      const key = monthKey(new Date(booking.dateTime));
      const bucket = monthMap.get(key);
      if (bucket) {
        bucket.count += 1;
      }

      const serviceId = booking.service?.id;
      if (serviceId) {
        const current = serviceCounter.get(serviceId) || {
          serviceId,
          name: booking.service.name,
          count: 0,
        };
        current.count += 1;
        serviceCounter.set(serviceId, current);
      }
    }

    const monthly = monthBuckets.map((bucket) => ({
      month: bucket.key,
      label: bucket.label,
      count: bucket.count,
    }));

    const totalBookings = monthly.reduce((sum, item) => sum + item.count, 0);
    const bookingsThisMonth = monthly[monthly.length - 1]?.count || 0;
    const bookingsPrevMonth = monthly[monthly.length - 2]?.count || 0;
    const topServices = Array.from(serviceCounter.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    res.json({
      salonId: salon.id,
      salonName: salon.name,
      months,
      totalBookings,
      bookingsThisMonth,
      bookingsPrevMonth,
      monthly,
      topServices,
    });
  } catch (err) {
    console.error("Admin salon stats error:", err);
    res.status(500).json({ error: "Blad pobierania statystyk salonu" });
  }
});

app.post("/bookings", requireAuth, async (req, res) => {
  try {
    const { salonId, serviceId, clientName, clientPhone, dateTime } = req.body;

    if (!salonId || !serviceId || !clientName || !dateTime) {
      return res.status(400).json({ error: "Wymagane: salonId, serviceId, clientName, dateTime" });
    }

    const sid = Number(serviceId);
    const salon = Number(salonId);
    if (Number.isNaN(sid) || Number.isNaN(salon)) {
      return res.status(400).json({ error: "serviceId i salonId musza byc liczbami" });
    }

    const dt = new Date(dateTime);
    if (Number.isNaN(dt.getTime())) {
      return res.status(400).json({ error: "dateTime ma zly format" });
    }

    const service = await prisma.service.findUnique({ where: { id: sid } });
    if (!service) return res.status(404).json({ error: "Nie ma takiej uslugi" });
    if (service.salonId !== salon) {
      return res.status(400).json({ error: "Usluga nie nalezy do salonu" });
    }

    const exists = await prisma.booking.findUnique({
      where: {
        serviceId_dateTime: { serviceId: sid, dateTime: dt },
      },
    });

    if (exists) return res.status(409).json({ error: "Termin zajety" });

    const authUserId = req.auth?.sub;
    if (!authUserId) {
      return res.status(401).json({ error: "Brak danych uzytkownika" });
    }

    const user = await getOrCreateUser(authUserId, extractEmailFromAuth(req.auth));

    const booking = await prisma.booking.create({
      data: {
        salonId: salon,
        serviceId: sid,
        userId: user.id,
        clientName: String(clientName).trim(),
        clientPhone: clientPhone ? String(clientPhone).trim() : null,
        dateTime: dt,
      },
      include: {
        service: true,
        user: { select: { id: true, authUserId: true, role: true } },
      },
    });

    await createNotification({
      userId: user.id,
      bookingId: booking.id,
      type: "BOOKING_CONFIRMED",
      title: "Rezerwacja potwierdzona",
      message: `Twoja rezerwacja "${booking.service.name}" na ${formatDateTimeForNotification(
        booking.dateTime
      )} zostala potwierdzona.`,
    });

    res.status(201).json(booking);
  } catch (err) {
    console.error("Booking error:", err);
    if (err?.code === "P2002") return res.status(409).json({ error: "Termin zajety" });
    res.status(500).json({ error: "Blad zapisu rezerwacji" });
  }
});

const REMINDER_SWEEP_MS = 15 * 60 * 1000;

function startReminderSweep() {
  const run = async () => {
    const created = await createBookingReminderNotifications();
    if (created > 0) {
      console.log(`Reminder sweep: created ${created} notifications`);
    }
  };

  run().catch((err) => {
    console.error("Initial reminder sweep error:", err);
  });

  setInterval(() => {
    run().catch((err) => {
      console.error("Reminder sweep interval error:", err);
    });
  }, REMINDER_SWEEP_MS);
}

startReminderSweep();

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`API dziala na http://localhost:${PORT}`);
});


