import { seedAcademicCatalog } from '../src/server/db/seed.js';

async function main() {
  console.log('🌱 Starting academic catalog seed for StuddyBuddy...');
  try {
    const results = await seedAcademicCatalog();
    console.log('✅ Catalog seeded successfully!');
    console.log(`- Universities: ${results.universitiesCreated}`);
    console.log(`- Faculties/Groups: ${results.facultiesCreated}`);
    console.log(`- Programs: ${results.programsCreated}`);
    console.log(`- Academic Terms: ${results.termsCreated}`);
    console.log(`- Subjects: ${results.subjectsCreated}`);
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Failed to seed catalog:', error?.message || error);
    process.exit(1);
  }
}

main();
