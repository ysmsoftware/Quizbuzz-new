/**
 * Operational seed script — populates default platform ambassador types and
 * enables them for all organizations in the database.
 * Run using:
 *   npx ts-node prisma/seeds/seed-ambassador-types.ts
 */
import { prisma } from "../../src/config/db";

const defaultTypes = [
    {
        key: "CAMPUS_AMBASSADOR",
        label: "Campus Ambassador",
        proofFieldLabel: "College ID Card / Enrollment Letter",
        isActive: true,
        applicationFields: [
            { key: "college", label: "College / Institution", type: "TEXT", required: true },
            { key: "department", label: "Department / Stream", type: "TEXT", required: true },
            { key: "studentId", label: "Student ID / Roll Number", type: "TEXT", required: true },
        ],
    },
    {
        key: "FACULTY_AMBASSADOR",
        label: "Faculty Ambassador",
        proofFieldLabel: "Employee ID Card / Employment Proof",
        isActive: true,
        applicationFields: [
            { key: "college", label: "Institution / School", type: "TEXT", required: true },
            { key: "department", label: "Department", type: "TEXT", required: true },
            { key: "employeeId", label: "Employee ID / Code", type: "TEXT", required: true },
        ],
    },
];

async function main() {
    console.log("Seeding platform ambassador types...");

    for (const t of defaultTypes) {
        await prisma.platformAmbassadorType.upsert({
            where: { key: t.key },
            update: {
                label: t.label,
                proofFieldLabel: t.proofFieldLabel,
                isActive: t.isActive,
                applicationFields: t.applicationFields as any,
            },
            create: {
                key: t.key,
                label: t.label,
                proofFieldLabel: t.proofFieldLabel,
                isActive: t.isActive,
                applicationFields: t.applicationFields as any,
            },
        });
        console.log(`- Upserted type: ${t.key}`);
    }

    const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
    console.log(`Enabling types for ${orgs.length} organizations...`);

    for (const org of orgs) {
        for (const t of defaultTypes) {
            await prisma.organizationAmbassadorTypeAccess.upsert({
                where: {
                    organizationId_typeKey: {
                        organizationId: org.id,
                        typeKey: t.key,
                    },
                },
                update: {
                    isEnabled: true,
                },
                create: {
                    organizationId: org.id,
                    typeKey: t.key,
                    isEnabled: true,
                },
            });
        }
        console.log(`- Enabled types for org: ${org.name} (${org.id})`);
    }

    console.log("Seeding complete!");
}

main()
    .catch((e) => {
        console.error("Error during seeding:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
