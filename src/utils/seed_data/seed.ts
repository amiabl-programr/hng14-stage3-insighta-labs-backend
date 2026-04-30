import { prisma } from '../../lib/prisma.js';
import { uuidv7 } from 'uuidv7';
import rawData from './seed_profiles.json' with { type: 'json' };

interface SeedProfile {
  name: string;
  gender: string;
  gender_probability: number;
  age: number;
  sample_size?: number;
  age_group: string;
  country_id: string;
  country_name: string;
  country_probability: number;
}

const profiles = rawData.profiles as SeedProfile[];

async function main() {
  try {
    if (profiles.length === 0) {
      throw new Error('No profiles found in the seed data');
    }

    // Single query to get all existing names
    const existing = await prisma.profile.findMany({ select: { name: true } });
    const existingNames = new Set(existing.map((p) => p.name));

    const toCreate = profiles.filter((p) => !existingNames.has(p.name));
    // const skippedCount = profiles.length - toCreate.length;

    // Batch insert in chunks to avoid memory issues on large datasets
    const CHUNK_SIZE = 500;
    // let createdCount = 0;

    for (let i = 0; i < toCreate.length; i += CHUNK_SIZE) {
      const chunk = toCreate.slice(i, i + CHUNK_SIZE);

      await prisma.profile.createMany({
        data: chunk.map((profile) => ({
          id: uuidv7(),
          ...profile,
        })),
        skipDuplicates: true,
      });

      // createdCount += chunk.length;
    }
  } catch {
    throw new Error();
  } finally {
    await prisma.$disconnect();
  }
}

main();
