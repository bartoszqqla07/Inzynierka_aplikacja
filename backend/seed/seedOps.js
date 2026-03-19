const { salons, reviews } = require("./seedData");

async function seedData(prisma) {
  const salonsCount = await prisma.salon.count();

  if (salonsCount === 0) {
    for (const salon of salons) {
      await prisma.salon.create({
        data: {
          name: salon.name,
          city: salon.city,
          description: salon.description,
          address: salon.address,
          phone: salon.phone,
          hours: salon.hours,
          imageUrl: salon.imageUrl,
          services: {
            create: salon.services,
          },
          images: {
            create: salon.images.map((url) => ({ url })),
          },
        },
      });
    }
  }

  const services = await prisma.service.findMany({
    orderBy: { id: "asc" },
  });

  const salonsList = await prisma.salon.findMany({
    orderBy: { id: "asc" },
    include: { services: true },
  });

  const reviewsCount = await prisma.review.count();
  if (reviewsCount === 0) {
    await prisma.review.createMany({ data: reviews });
  }

  const reviewsList = await prisma.review.findMany({
    orderBy: { createdAt: "desc" },
  });

  return { services, salons: salonsList, reviews: reviewsList };
}

async function resetSalonImages(prisma) {
  const updated = [];
  for (const salon of salons) {
    const existing = await prisma.salon.findFirst({
      where: { name: salon.name },
    });
    if (!existing) continue;

    const result = await prisma.salon.update({
      where: { id: existing.id },
      data: {
        imageUrl: salon.imageUrl,
        images: {
          deleteMany: {},
          create: salon.images.map((url) => ({ url })),
        },
      },
      include: { images: true },
    });

    updated.push(result);
  }

  return updated;
}

module.exports = {
  seedData,
  resetSalonImages,
};
