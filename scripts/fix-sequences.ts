import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixSequences() {
  console.log('🔍 Diagnosing sequence issues...\n');

  try {
    const diagnostics = await prisma.$queryRaw<
      Array<{ table_name: string; sequence_value: bigint; max_table_id: bigint }>
    >`
      SELECT
        'CustomerProfile' AS table_name,
        (SELECT last_value FROM "CustomerProfile_id_seq") AS sequence_value,
        (SELECT COALESCE(MAX(id), 0) FROM "CustomerProfile") AS max_table_id
      UNION ALL
      SELECT
        'Phone' AS table_name,
        (SELECT last_value FROM "Phone_id_seq"),
        (SELECT COALESCE(MAX(id), 0) FROM "Phone")
      UNION ALL
      SELECT
        'Address' AS table_name,
        (SELECT last_value FROM "Address_id_seq"),
        (SELECT COALESCE(MAX(id), 0) FROM "Address")
      UNION ALL
      SELECT
        'User' AS table_name,
        (SELECT last_value FROM "User_id_seq"),
        (SELECT COALESCE(MAX(id), 0) FROM "User")
      UNION ALL
      SELECT
        'Business' AS table_name,
        (SELECT last_value FROM "Business_id_seq"),
        (SELECT COALESCE(MAX(id), 0) FROM "Business")
    `;

    console.log('Current sequence states:');
    console.log('========================');
    let hasIssues = false;

    diagnostics.forEach((row) => {
      const seqVal = Number(row.sequence_value);
      const maxId = Number(row.max_table_id);
      const status = seqVal > maxId ? '✅ OK' : '❌ OUT OF SYNC';

      if (seqVal <= maxId) {
        hasIssues = true;
      }

      console.log(
        `${row.table_name.padEnd(20)} | Sequence: ${seqVal.toString().padEnd(5)} | Max ID: ${maxId.toString().padEnd(5)} | ${status}`,
      );
    });

    console.log('\n');

    if (!hasIssues) {
      console.log('✅ All sequences are in sync. No fix needed!');
      return;
    }

    console.log('🔧 Fixing sequences...\n');

    await prisma.$executeRaw`
      SELECT setval('"CustomerProfile_id_seq"', (SELECT COALESCE(MAX(id), 0) + 1 FROM "CustomerProfile"))
    `;
    console.log('✅ Fixed CustomerProfile_id_seq');

    await prisma.$executeRaw`
      SELECT setval('"Phone_id_seq"', (SELECT COALESCE(MAX(id), 0) + 1 FROM "Phone"))
    `;
    console.log('✅ Fixed Phone_id_seq');

    await prisma.$executeRaw`
      SELECT setval('"Address_id_seq"', (SELECT COALESCE(MAX(id), 0) + 1 FROM "Address"))
    `;
    console.log('✅ Fixed Address_id_seq');

    await prisma.$executeRaw`
      SELECT setval('"User_id_seq"', (SELECT COALESCE(MAX(id), 0) + 1 FROM "User"))
    `;
    console.log('✅ Fixed User_id_seq');

    await prisma.$executeRaw`
      SELECT setval('"Business_id_seq"', (SELECT COALESCE(MAX(id), 0) + 1 FROM "Business"))
    `;
    console.log('✅ Fixed Business_id_seq');

    await prisma.$executeRaw`
      SELECT setval('"Parcel_id_seq"', (SELECT COALESCE(MAX(id), 0) + 1 FROM "Parcel"))
    `;
    console.log('✅ Fixed Parcel_id_seq');

    await prisma.$executeRaw`
      SELECT setval('"Journey_id_seq"', (SELECT COALESCE(MAX(id), 0) + 1 FROM "Journey"))
    `;
    console.log('✅ Fixed Journey_id_seq');

    await prisma.$executeRaw`
      SELECT setval('"Vehicle_id_seq"', (SELECT COALESCE(MAX(id), 0) + 1 FROM "Vehicle"))
    `;
    console.log('✅ Fixed Vehicle_id_seq');

    await prisma.$executeRaw`
      SELECT setval('"Country_id_seq"', (SELECT COALESCE(MAX(id), 0) + 1 FROM "Country"))
    `;
    console.log('✅ Fixed Country_id_seq');

    console.log('\n🎉 All sequences have been fixed!');
    console.log('\n🔍 Verifying fixes...\n');

    const verification = await prisma.$queryRaw<
      Array<{ table_name: string; sequence_value: bigint; max_table_id: bigint }>
    >`
      SELECT
        'CustomerProfile' AS table_name,
        (SELECT last_value FROM "CustomerProfile_id_seq") AS sequence_value,
        (SELECT COALESCE(MAX(id), 0) FROM "CustomerProfile") AS max_table_id
      UNION ALL
      SELECT
        'Phone' AS table_name,
        (SELECT last_value FROM "Phone_id_seq"),
        (SELECT COALESCE(MAX(id), 0) FROM "Phone")
      UNION ALL
      SELECT
        'Address' AS table_name,
        (SELECT last_value FROM "Address_id_seq"),
        (SELECT COALESCE(MAX(id), 0) FROM "Address")
    `;

    console.log('Verification results:');
    console.log('====================');
    verification.forEach((row) => {
      const seqVal = Number(row.sequence_value);
      const maxId = Number(row.max_table_id);
      const status = seqVal > maxId ? '✅ OK' : '❌ STILL BROKEN';
      console.log(
        `${row.table_name.padEnd(20)} | Sequence: ${seqVal.toString().padEnd(5)} | Max ID: ${maxId.toString().padEnd(5)} | ${status}`,
      );
    });

    console.log('\n✅ Customer creation should now work without errors!');
  } catch (error) {
    console.error('❌ Error fixing sequences:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixSequences()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
