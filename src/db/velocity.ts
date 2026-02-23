import { getDatabase } from "@/db";
import { velocityHistory } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function getAvgVelocity(
  sprintCount = 6
): Promise<number | null> {
  const db = getDatabase();
  const velHistory = await db
    .select()
    .from(velocityHistory)
    .orderBy(desc(velocityHistory.sprintEndDate))
    .limit(sprintCount);

  if (velHistory.length === 0) return null;
  return (
    velHistory.reduce((s, v) => s + (v.completedPoints || 0), 0) /
    velHistory.length
  );
}
