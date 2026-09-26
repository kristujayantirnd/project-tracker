import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL);
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) {}
    }

    const { orderedIds } = body || {};
    if (Array.isArray(orderedIds)) {
      for (let index = 0; index < orderedIds.length; index++) {
        await sql`
          UPDATE project_stages 
          SET stage_order = ${index + 1} 
          WHERE id = ${orderedIds[index]}
        `;
      }
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Reorder API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
