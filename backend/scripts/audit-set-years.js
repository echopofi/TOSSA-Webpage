// One-off audit: list every GraduationSet whose year span != 6.
// Sets the (endYear - startYear) difference; run BEFORE any write.
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const sets = await prisma.graduationSet.findMany({
    orderBy: { endYear: "asc" },
  });

  const bad = sets.filter((s) => s.endYear - s.startYear !== 6);

  console.log(
    `Total sets: ${sets.length} | already 6-year span: ${sets.length - bad.length} | anomalies: ${bad.length}`
  );
  console.log("");

  if (bad.length === 0) {
    console.log("All sets already span exactly 6 years (endYear - startYear).");
  } else {
    console.log("setName (endYear) | endYear | startYear | diff | PROPOSED startYear");
    for (const s of bad) {
      console.log(
        `${s.setName} (${s.endYear}) | ${s.endYear} | ${s.startYear} | ${s.endYear - s.startYear} | ${s.endYear - 6}`
      );
    }
  }
}

main()
  .catch((e) => {
    console.error("Audit failed:", e && e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());