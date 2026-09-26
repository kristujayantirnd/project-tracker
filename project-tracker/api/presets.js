import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL);

    if (req.method === 'GET') {
      const presets = await sql`SELECT * FROM presets ORDER BY created_at DESC`;
      const stages = await sql`SELECT * FROM preset_stages ORDER BY stage_order ASC`;

      const result = presets.map(p => {
        const pStages = stages
          .filter(s => s.preset_id === p.preset_id)
          .map(s => ({
            stageName: s.stage_name,
            stageOrder: Number(s.stage_order),
            daysOffset: Number(s.days_offset)
          }))
          .sort((a, b) => a.stageOrder - b.stageOrder);

        return {
          presetId: p.preset_id,
          presetName: p.preset_name,
          stages: pStages
        };
      });

      return res.status(200).json(result);
    } 

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) {}
      }

      const { presetName, stages, existingPresetId } = body || {};

      if (!presetName || !stages || !Array.isArray(stages) || stages.length === 0) {
        return res.status(400).json({ error: 'Preset name and at least one stage are required.' });
      }

      const presetId = existingPresetId || `PRST_${Math.random().toString(36).substring(2, 10)}`;

      if (existingPresetId) {
        await sql`DELETE FROM preset_stages WHERE preset_id = ${existingPresetId}`;
        await sql`UPDATE presets SET preset_name = ${presetName} WHERE preset_id = ${existingPresetId}`;
      } else {
        await sql`INSERT INTO presets (preset_id, preset_name) VALUES (${presetId}, ${presetName})`;
      }

      for (let i = 0; i < stages.length; i++) {
        const stg = stages[i];
        const sName = stg.stageName || `Stage ${i + 1}`;
        const sOrder = Number(i + 1);
        const sOffset = Number(stg.daysOffset) || 0;

        await sql`
          INSERT INTO preset_stages (preset_id, stage_name, stage_order, days_offset)
          VALUES (${presetId}, ${sName}, ${sOrder}, ${sOffset})
        `;
      }

      return res.status(200).json({ success: true, presetId });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error('Presets API Error:', error);
    return res.status(500).json({ error: error.message || 'Database execution error' });
  }
}
