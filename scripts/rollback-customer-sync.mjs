import fs from "node:fs/promises"
import path from "node:path"
import { PrismaClient } from "@prisma/client"

const oltUrl = process.env.DATABASE_URL || "postgresql://postgres:admin@localhost:5432/olt_db?schema=public"
const ispUrl = process.env.ISP_OPS_DATABASE_URL || "postgresql://postgres:admin@localhost:5432/isp_ops_db?schema=public"

async function main() {
  const backupPath = path.join(process.cwd(), "data", "backup-billing-customers-before-sync.json")
  const raw = await fs.readFile(backupPath, "utf8")
  const backup = JSON.parse(raw)

  const oltPrisma = new PrismaClient({ datasources: { db: { url: oltUrl } } })
  const ispPrisma = new PrismaClient({ datasources: { db: { url: ispUrl } } })

  try {
    console.log("1. Dropping onu_customer_links table from olt_db (if exists)...")
    await oltPrisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "onu_customer_links" CASCADE`)

    console.log(`2. Restoring ${backup.rows.length} billing_customers rows in isp_ops_db...`)
    await ispPrisma.$executeRawUnsafe(`UPDATE billing_customers SET nama_router = NULL, id_olt = NULL`)

    const withValues = backup.rows.filter((r) => r.nama_router !== null || r.id_olt !== null)
    for (const row of withValues) {
      await ispPrisma.$executeRawUnsafe(
        `UPDATE billing_customers SET nama_router = $1, id_olt = $2 WHERE id = $3`,
        row.nama_router,
        row.id_olt,
        row.id
      )
    }

    console.log(`Rollback complete! Restored ${withValues.length} pre-existing router/OLT assignments and cleared the rest.`)
  } finally {
    await oltPrisma.$disconnect()
    await ispPrisma.$disconnect()
  }
}

main().catch((err) => {
  console.error("Rollback failed:", err)
  process.exit(1)
})
