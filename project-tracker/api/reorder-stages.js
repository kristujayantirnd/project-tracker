import { sql } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { orderedIds } = req.body; // Array of primary key IDs in new sequence
    for (let index = 0; index < orderedIds.length; index++) {
      await sql`
        UPDATE project_stages 
        SET stage_order = ${index + 1} 
        WHERE id = ${orderedIds[index]}
      `;
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}