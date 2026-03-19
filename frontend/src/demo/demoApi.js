import { getDemoAvailableSlots, getDemoOwnerCalendar, getDemoUserCalendar } from "./demoCalendar";
import {
  attachBookingRelations,
  attachSalonRelations,
  delay,
  getDemoState,
  monthLabel,
  nextCounterValue,
  sanitizeDemoUser,
  updateDemoState,
} from "./demoUtils";

function withOwner(state, salon) {
  const owner = state.users.find((item) => item.id === salon.ownerId) || null;
  return {
    ...attachSalonRelations(salon),
    owner: owner ? sanitizeDemoUser(owner) : null,
  };
}

function getSalonStatsFromState(state, salonId, months) {
  const now = new Date();
  const monthly = [];

  for (let index = months - 1; index >= 0; index -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const nextMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
    const items = state.bookings.filter((booking) => {
      const bookingDate = new Date(booking.dateTime);
      return (
        booking.salonId === Number(salonId) &&
        bookingDate >= monthDate &&
        bookingDate < nextMonth
      );
    });
    monthly.push({
      month: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`,
      label: monthLabel(monthDate),
      count: items.length,
    });
  }

  const totalBookings = monthly.reduce((sum, item) => sum + item.count, 0);
  const currentMonth = monthly[monthly.length - 1]?.count || 0;
  const previousMonth = monthly[monthly.length - 2]?.count || 0;
  const salon = state.salons.find((item) => item.id === Number(salonId));
  const topServices = (salon?.services || [])
    .map((service) => ({
      serviceId: service.id,
      name: service.name,
      count: state.bookings.filter(
        (booking) => booking.salonId === Number(salonId) && booking.serviceId === service.id
      ).length,
    }))
    .filter((service) => service.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalBookings,
    bookingsThisMonth: currentMonth,
    bookingsPrevMonth: previousMonth,
    monthly,
    topServices,
  };
}

function buildSystemStats(state) {
  const totalRevenue = state.bookings.reduce((sum, booking) => {
    const salon = state.salons.find((item) => item.id === booking.salonId);
    const service = salon?.services.find((item) => item.id === booking.serviceId);
    return sum + (service?.price || 0);
  }, 0);

  return {
    totalSalons: state.salons.length,
    totalUsers: state.users.length,
    totalBookings: state.bookings.length,
    totalReviews: state.reviews.length,
    totalRevenue,
    usersByRole: ["USER", "OWNER", "ADMIN"].map((role) => ({
      role,
      count: state.users.filter((user) => user.role === role).length,
    })),
    salonsByCity: Array.from(
      state.salons.reduce((map, salon) => {
        map.set(salon.city, (map.get(salon.city) || 0) + 1);
        return map;
      }, new Map())
    ).map(([city, count]) => ({ city, count })),
  };
}

export async function getDemoSalons() {
  await delay();
  const state = getDemoState();
  return state.salons.map((salon) => withOwner(state, salon));
}

export async function getDemoSalonById(id) {
  await delay();
  const state = getDemoState();
  const salon = state.salons.find((item) => item.id === Number(id));
  return salon ? withOwner(state, salon) : null;
}

export async function getDemoServices(salonId) {
  await delay();
  const state = getDemoState();
  if (salonId) {
    const salon = state.salons.find((item) => item.id === Number(salonId));
    return salon?.services || [];
  }
  return state.salons.flatMap((salon) =>
    salon.services.map((service) => ({
      ...service,
      salonId: salon.id,
      salonName: salon.name,
    }))
  );
}

export async function getDemoPriceList() {
  await delay();
  const state = getDemoState();
  return state.salons.map((salon) => ({
    salonId: salon.id,
    salonName: salon.name,
    city: salon.city,
    items: salon.services.map((service) => ({
      ...service,
      formattedPrice: `${service.price} zl`,
    })),
  }));
}

export async function getDemoBookings() {
  await delay();
  const state = getDemoState();
  return state.bookings.map((booking) => attachBookingRelations(state, booking));
}

export async function getDemoBookingsByUser(userId) {
  await delay();
  const state = getDemoState();
  return state.bookings
    .filter((booking) => booking.userId === Number(userId))
    .map((booking) => attachBookingRelations(state, booking));
}

export async function getDemoBookingsBySalon(salonId) {
  await delay();
  const state = getDemoState();
  return state.bookings
    .filter((booking) => booking.salonId === Number(salonId))
    .map((booking) => attachBookingRelations(state, booking));
}

export async function getDemoReviews() {
  await delay();
  return getDemoState().reviews;
}

export async function addDemoReview(payload) {
  await delay();
  const nextState = updateDemoState((state) => {
    state.reviews.unshift({
      id: nextCounterValue(state, "review"),
      rating: Number(payload.rating),
      name: payload.name,
      city: payload.city,
      text: payload.text,
      salonId: payload.salonId || null,
    });
    return state;
  });
  return nextState.reviews[0];
}

export async function getDemoDashboardStats() {
  await delay();
  return buildSystemStats(getDemoState());
}

export async function getDemoUsers() {
  await delay();
  return getDemoState().users.map((user) => sanitizeDemoUser(user));
}

export async function getDemoOwnerSalons(userId) {
  await delay();
  const state = getDemoState();
  return state.salons
    .filter((salon) => salon.ownerId === Number(userId))
    .map((salon) => withOwner(state, salon));
}

export async function getDemoAdminSalons() {
  return getDemoSalons();
}

export async function getDemoSalonStats(salonId, months = 6) {
  await delay();
  return getSalonStatsFromState(getDemoState(), salonId, Number(months) || 6);
}

export async function createDemoBooking(payload) {
  await delay();
  const nextState = updateDemoState((state) => {
    state.bookings.push({
      id: nextCounterValue(state, "booking"),
      userId: Number(payload.userId),
      salonId: Number(payload.salonId),
      serviceId: Number(payload.serviceId),
      clientName: payload.clientName,
      clientPhone: payload.clientPhone || null,
      dateTime: payload.dateTime,
    });
    return state;
  });
  const booking = nextState.bookings[nextState.bookings.length - 1];
  return attachBookingRelations(nextState, booking);
}

export async function updateDemoUserBooking(bookingId, payload) {
  await delay();
  const nextState = updateDemoState((state) => {
    const target = state.bookings.find((item) => item.id === Number(bookingId));
    if (!target) throw new Error("Nie znaleziono rezerwacji.");
    target.salonId = Number(payload.salonId);
    target.serviceId = Number(payload.serviceId);
    target.clientName = payload.clientName;
    target.clientPhone = payload.clientPhone || null;
    target.dateTime = payload.dateTime;
    return state;
  });
  const booking = nextState.bookings.find((item) => item.id === Number(bookingId));
  return attachBookingRelations(nextState, booking);
}

export async function cancelDemoUserBooking(bookingId) {
  await delay();
  updateDemoState((state) => {
    state.bookings = state.bookings.filter((item) => item.id !== Number(bookingId));
    return state;
  });
  return true;
}

export async function updateDemoScheduleBooking(bookingId, time) {
  await delay();
  const nextState = updateDemoState((state) => {
    const booking = state.bookings.find((item) => item.id === Number(bookingId));
    if (!booking) throw new Error("Nie znaleziono rezerwacji.");
    const date = new Date(booking.dateTime);
    const [hours, minutes] = String(time).split(":").map(Number);
    date.setHours(hours, minutes, 0, 0);
    booking.dateTime = date.toISOString();
    return state;
  });
  const booking = nextState.bookings.find((item) => item.id === Number(bookingId));
  return attachBookingRelations(nextState, booking);
}

export async function cancelDemoScheduleBooking(bookingId) {
  return cancelDemoUserBooking(bookingId);
}

export async function getDemoScheduleBookings(role, userId) {
  if (role === "ADMIN") {
    return getDemoBookings();
  }
  return getDemoOwnerCalendar(userId);
}

export async function getDemoUserCalendarBookings(userId) {
  return getDemoUserCalendar(userId);
}

export async function getDemoCalendarSlots(params) {
  return getDemoAvailableSlots(params);
}

export async function updateDemoSalon(salonId, payload) {
  await delay();
  const nextState = updateDemoState((state) => {
    const salon = state.salons.find((item) => item.id === Number(salonId));
    if (!salon) throw new Error("Nie znaleziono salonu.");
    Object.assign(salon, payload);
    salon.imageUrl = salon.imageUrl || salon.image || salon.images?.[0]?.url || "";
    return state;
  });
  const salon = nextState.salons.find((item) => item.id === Number(salonId));
  return withOwner(nextState, salon);
}

export async function addDemoSalon(payload) {
  await delay();
  const nextState = updateDemoState((state) => {
    const owner =
      payload.ownerEmail
        ? state.users.find(
            (user) => user.email.toLowerCase() === String(payload.ownerEmail).trim().toLowerCase()
          )
        : null;
    const salonId = nextCounterValue(state, "salon");
    const imageId = nextCounterValue(state, "image");
    state.salons.push({
      id: salonId,
      ownerId: owner?.id || null,
      name: payload.name,
      city: payload.city,
      description: payload.description || "",
      address: payload.address || "",
      phone: payload.phone || "",
      instagram: payload.instagram || "",
      rating: payload.rating || 4.7,
      image: "/demo/custom-main.svg",
      imageUrl: "/demo/custom-main.svg",
      coverImage: "/demo/custom-cover.svg",
      openingHours: "Pn-Pt 09:00-18:00",
      hours: payload.hours || {},
      images: [{ id: imageId, url: "/demo/custom-main.svg" }],
      services: [],
    });
    return state;
  });
  return withOwner(nextState, nextState.salons[nextState.salons.length - 1]);
}

export async function deleteDemoSalon(salonId) {
  await delay();
  updateDemoState((state) => {
    state.salons = state.salons.filter((item) => item.id !== Number(salonId));
    state.bookings = state.bookings.filter((item) => item.salonId !== Number(salonId));
    return state;
  });
  return true;
}

export async function addDemoSalonImage(salonId, url, setAsMain = false) {
  await delay();
  const nextState = updateDemoState((state) => {
    const salon = state.salons.find((item) => item.id === Number(salonId));
    if (!salon) throw new Error("Nie znaleziono salonu.");
    const image = { id: nextCounterValue(state, "image"), url };
    salon.images.push(image);
    if (setAsMain || !salon.imageUrl) {
      salon.imageUrl = url;
      salon.image = url;
    }
    return state;
  });
  const salon = nextState.salons.find((item) => item.id === Number(salonId));
  return withOwner(nextState, salon);
}

export async function deleteDemoImage(imageId) {
  await delay();
  updateDemoState((state) => {
    state.salons.forEach((salon) => {
      const imageToDelete = salon.images.find((image) => image.id === Number(imageId));
      if (!imageToDelete) return;
      salon.images = salon.images.filter((image) => image.id !== Number(imageId));
      if (salon.imageUrl === imageToDelete.url) {
        salon.imageUrl = salon.images[0]?.url || "";
        salon.image = salon.imageUrl;
      }
    });
    return state;
  });
  return true;
}

export async function setDemoMainImage(salonId, imageId) {
  await delay();
  const nextState = updateDemoState((state) => {
    const salon = state.salons.find((item) => item.id === Number(salonId));
    const image = salon?.images.find((item) => item.id === Number(imageId));
    if (!salon || !image) throw new Error("Nie znaleziono zdjecia.");
    salon.imageUrl = image.url;
    salon.image = image.url;
    return state;
  });
  const salon = nextState.salons.find((item) => item.id === Number(salonId));
  return withOwner(nextState, salon);
}

export async function addDemoService(salonId, payload) {
  await delay();
  const nextState = updateDemoState((state) => {
    const salon = state.salons.find((item) => item.id === Number(salonId));
    if (!salon) throw new Error("Nie znaleziono salonu.");
    salon.services.push({
      id: nextCounterValue(state, "service"),
      name: payload.name,
      category: payload.category || "Inne",
      duration: Number(payload.duration),
      price: Number(payload.price),
      description: payload.description || "",
    });
    return state;
  });
  return nextState.salons.find((item) => item.id === Number(salonId))?.services || [];
}

export async function updateDemoService(serviceId, payload) {
  await delay();
  const nextState = updateDemoState((state) => {
    state.salons.forEach((salon) => {
      const service = salon.services.find((item) => item.id === Number(serviceId));
      if (!service) return;
      Object.assign(service, {
        name: payload.name,
        duration: Number(payload.duration),
        price: Number(payload.price),
      });
    });
    return state;
  });
  return nextState.salons.flatMap((salon) => salon.services).find((item) => item.id === Number(serviceId));
}

export async function deleteDemoService(serviceId) {
  await delay();
  updateDemoState((state) => {
    state.salons.forEach((salon) => {
      salon.services = salon.services.filter((item) => item.id !== Number(serviceId));
    });
    state.bookings = state.bookings.filter((item) => item.serviceId !== Number(serviceId));
    return state;
  });
  return true;
}
