import { prisma } from '../../lib/prisma.js';
import { uuidv7 } from 'uuidv7';
import rawData from './seed_profiles.json' with { type: 'json' };

interface SeedProfile {
  name: string;
  gender: string;
  gender_probability: number;
  age: number;
  age_group: string;
  country_id: string;
  country_name: string;
  country_probability: number;
}

const profiles = rawData.profiles as SeedProfile[];

async function main() {
  try {
    console.log('Starting seed...');
    console.log(`Found ${profiles.length} profiles to seed`);

    // Single query to get all existing names
    const existing = await prisma.profile.findMany({ select: { name: true } });
    const existingNames = new Set(existing.map((p) => p.name));

    const toCreate = profiles.filter((p) => !existingNames.has(p.name));
    const skippedCount = profiles.length - toCreate.length;

    console.log(`Existing profiles in database: ${existingNames.size}`);
    console.log(`To create: ${toCreate.length}, To skip: ${skippedCount}`);

    // Batch insert in chunks to avoid memory issues on large datasets
    const CHUNK_SIZE = 500;
    let createdCount = 0;

    for (let i = 0; i < toCreate.length; i += CHUNK_SIZE) {
      const chunk = toCreate.slice(i, i + CHUNK_SIZE);

      await prisma.profile.createMany({
        data: chunk.map((profile) => ({
          id: uuidv7(),
          ...profile,
        })),
        skipDuplicates: true,
      });

      createdCount += chunk.length;
      console.log(
        `Progress: ${Math.min(createdCount, toCreate.length)}/${toCreate.length}`,
      );
    }

    console.log(`\nSeed completed!`);
    console.log(`Created: ${createdCount} profiles`);
    console.log(`Skipped: ${skippedCount} profiles (already exist)`);
    console.log(`Total in database: ${await prisma.profile.count()}`);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
