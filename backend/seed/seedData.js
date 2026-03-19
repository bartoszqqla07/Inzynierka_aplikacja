const H = (from, to) => ({ from, to });

const salons = [
  {
    name: "Salon Bella",
    city: "Warszawa",
    description: "Nowoczesny salon fryzjersko-beauty w centrum miasta.",
    address: "ul. Przykladowa 12",
    phone: "500 600 700",
    hours: {
      mon: [H("09:00", "19:00")],
      tue: [H("09:00", "19:00")],
      wed: [H("09:00", "19:00")],
      thu: [H("09:00", "19:00")],
      fri: [H("09:00", "19:00")],
      sat: [H("10:00", "16:00")],
      sun: [],
    },
    imageUrl:
      "https://images.unsplash.com/photo-1522336572468-97b06e8ef143?q=80&w=1200&auto=format&fit=crop",
    services: [
      { name: "Strzyzenie", duration: 30, price: 60 },
      { name: "Koloryzacja", duration: 90, price: 180 },
      { name: "Modelowanie", duration: 45, price: 80 },
    ],
    images: [
      "https://images.unsplash.com/photo-1522336572468-97b06e8ef143?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=1200&auto=format&fit=crop",
    ],
  },
  {
    name: "Studio Glam",
    city: "Katowice",
    description: "Studio stylizacji paznokci i pielegnacji dloni.",
    address: "ul. Kwiatowa 7",
    phone: "501 222 333",
    hours: {
      mon: [H("10:00", "20:00")],
      tue: [H("10:00", "20:00")],
      wed: [H("10:00", "20:00")],
      thu: [H("10:00", "20:00")],
      fri: [H("10:00", "20:00")],
      sat: [],
      sun: [],
    },
    imageUrl:
      "https://images.unsplash.com/photos/T1EJj-G9l5w?q=80&w=1200&auto=format&fit=crop",
    services: [
      { name: "Manicure", duration: 60, price: 120 },
      { name: "Pedicure", duration: 75, price: 150 },
      { name: "Hybryda", duration: 90, price: 170 },
    ],
    images: [
      "https://images.unsplash.com/photos/T1EJj-G9l5w?q=80&w=1200&auto=format&fit=crop",
      "https://pixabay.com/get/gd4fdbe4b52b4c4b3bfe45c4e0aaad3e1f7aaf5c3d1a7bd2e2fba31a5e284267d11c7c70b2d2d2d5ab5e8bf5a2d53b8bb_1280.jpg",
    ],
  },
  {
    name: "Beauty Zone",
    city: "Gdansk",
    description: "Specjalizacja: brwi, henna i zabiegi pielegnacyjne.",
    address: "ul. Nadmorska 3",
    phone: "502 111 222",
    hours: {
      mon: [],
      tue: [H("09:00", "18:00")],
      wed: [H("09:00", "18:00")],
      thu: [H("09:00", "18:00")],
      fri: [H("09:00", "18:00")],
      sat: [H("09:00", "18:00")],
      sun: [],
    },
    imageUrl:
      "https://pixabay.com/get/gc6d7c8f0a9e4d7f0b83a92b6c9ad8e2ac5b8c8f8bdb0d1c2d7d1b8b7b4c9a1e6_1280.jpg",
    services: [
      { name: "Regulacja brwi", duration: 15, price: 30 },
      { name: "Henna", duration: 20, price: 40 },
      { name: "Laminacja", duration: 45, price: 90 },
    ],
    images: [
      "https://pixabay.com/get/gc6d7c8f0a9e4d7f0b83a92b6c9ad8e2ac5b8c8f8bdb0d1c2d7d1b8b7b4c9a1e6_1280.jpg",
      "https://images.pexels.com/photos/33580445/pexels-photo-33580445.jpeg?auto=compress&cs=tinysrgb&w=1200",
    ],
  },
  {
    name: "Ink & Art Studio",
    city: "Krakow",
    description: "Studio tatuazu i piercingu z doswiadczonym zespolem.",
    address: "ul. Starowislna 22",
    phone: "503 444 555",
    hours: {
      mon: [H("11:00", "20:00")],
      tue: [H("11:00", "20:00")],
      wed: [H("11:00", "20:00")],
      thu: [H("11:00", "20:00")],
      fri: [H("11:00", "20:00")],
      sat: [H("11:00", "20:00")],
      sun: [],
    },
    imageUrl:
      "https://cdn.pixabay.com/photo/2017/01/30/08/36/tattoo-2020311_1280.jpg",
    services: [
      { name: "Konsultacja projektu", duration: 30, price: 80 },
      { name: "Tatuaz (mini)", duration: 90, price: 300 },
      { name: "Piercing", duration: 20, price: 150 },
    ],
    images: [
      "https://images.unsplash.com/photos/Xkdyu1IOBb4?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photos/w8NbLvjVTog?q=80&w=1200&auto=format&fit=crop",
    ],
  },
  {
    name: "Barber House",
    city: "Lodz",
    description: "Barber shop z klasycznym cieciem i pielegnacja brody.",
    address: "ul. Piotrkowska 120",
    phone: "504 222 111",
    hours: {
      mon: [H("10:00", "20:00")],
      tue: [H("10:00", "20:00")],
      wed: [H("10:00", "20:00")],
      thu: [H("10:00", "20:00")],
      fri: [H("10:00", "20:00")],
      sat: [H("10:00", "16:00")],
      sun: [],
    },
    imageUrl:
      "https://images.unsplash.com/photos/jkr6B-R3DL4?q=80&w=1200&auto=format&fit=crop",
    services: [
      { name: "Strzyzenie meskie", duration: 30, price: 70 },
      { name: "Modelowanie brody", duration: 25, price: 60 },
      { name: "Combo: wlosy + broda", duration: 50, price: 120 },
    ],
    images: [
      "https://images.unsplash.com/photos/jkr6B-R3DL4?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photos/IIHHk7LXbYE?q=80&w=1200&auto=format&fit=crop",
    ],
  },
  {
    name: "Glow Skin Clinic",
    city: "Poznan",
    description: "Kosmetologia estetyczna, zabiegi na twarz i cialo.",
    address: "ul. Polwiejska 18",
    phone: "505 777 888",
    hours: {
      mon: [H("09:00", "19:00")],
      tue: [H("09:00", "19:00")],
      wed: [H("09:00", "19:00")],
      thu: [H("09:00", "19:00")],
      fri: [H("09:00", "19:00")],
      sat: [],
      sun: [],
    },
    imageUrl:
      "https://images.unsplash.com/photos/j07wi0zn0Ho?q=80&w=1200&auto=format&fit=crop",
    services: [
      { name: "Oczyszczanie wodorowe", duration: 60, price: 220 },
      { name: "Mezoterapia", duration: 45, price: 260 },
      { name: "Peeling kwasowy", duration: 40, price: 180 },
    ],
    images: [
      "https://images.unsplash.com/photos/j07wi0zn0Ho?q=80&w=1200&auto=format&fit=crop",
      "https://images.unsplash.com/photos/1r0U0mcrsUo?q=80&w=1200&auto=format&fit=crop",
    ],
  },
  {
    name: "Relax Spa",
    city: "Wroclaw",
    description: "Masaze relaksacyjne i zabiegi spa.",
    address: "ul. Swidnicka 40",
    phone: "506 333 999",
    hours: {
      mon: [H("10:00", "21:00")],
      tue: [H("10:00", "21:00")],
      wed: [H("10:00", "21:00")],
      thu: [H("10:00", "21:00")],
      fri: [H("10:00", "21:00")],
      sat: [H("10:00", "21:00")],
      sun: [],
    },
    imageUrl:
      "https://pixabay.com/get/g2191461a76f54a0a9f2e47b2a5f3e5f98f0a1d0e6a6c2bbad5b9ce6b86b1e2a8_1280.jpg",
    services: [
      { name: "Masaz klasyczny", duration: 60, price: 200 },
      { name: "Masaz relaksacyjny", duration: 90, price: 280 },
      { name: "Rytual spa", duration: 120, price: 360 },
    ],
    images: [
      "https://pixabay.com/get/g2191461a76f54a0a9f2e47b2a5f3e5f98f0a1d0e6a6c2bbad5b9ce6b86b1e2a8_1280.jpg",
      "https://pixabay.com/get/gb2df8a0ac6178c0e2e9f2be76f6c3fb0b6d2d1b545d8a7c39433c50c6ecfc1c0_1280.jpg",
    ],
  },
];

const reviews = [
  {
    name: "Anna K.",
    city: "Warszawa",
    rating: 5,
    text: "Szybko znalazlam salon i od razu zarezerwowalam termin. Bardzo wygodne!",
  },
  {
    name: "Marek P.",
    city: "Krakow",
    rating: 4,
    text: "Podoba mi sie prosty wybor godzin i kalendarz. Wszystko czytelne.",
  },
  {
    name: "Julia S.",
    city: "Gdansk",
    rating: 5,
    text: "Fajne salony w jednym miejscu. Rezerwacja zajela minute.",
  },
];

module.exports = { salons, reviews };
