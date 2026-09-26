import { sql } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // CORS & Header settings
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 1. GET ALL PRESETS WITH STAGES
    if (req.method === 'GET') {
      const presets = await sql`SELECT * FROM presets ORDER BY created_at DESC`;
      const stages = await sql`SELECT * FROM preset_stages ORDER BY stage_order ASC`;

      const result = presets.map(p => {
        const pStages = stages
          .filter(s => s.preset_id === p.preset_id)
          .map(s => ({
            stageName: s.stage_name,
            stageOrder: parseInt(s.stage_order, 10),
            daysOffset: parseInt(s.days_offset, 10)
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

    // 2. SAVE OR UPDATE PRESET
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { presetName, stages, existingPresetId } = body || {};

      if (!presetName || !stages || !Array.isArray(stages)) {
        return res.status(400).json({ error: 'Missing presetName or stages array.' });
      }

      const presetId = existingPresetId || `PRST_${Math.random().toString(36).substring(2, 10)}`;

      if (existingPresetId) {
        // Delete existing stages for this preset to allow clean replacement
        await sql`DELETE FROM preset_stages WHERE preset_id = ${existingPresetId}`;
        await sql`UPDATE presets SET preset_name = ${presetName} WHERE preset_id = ${existingPresetId}`;
      } else {
        // Create new preset entry
        await sql`INSERT INTO presets (preset_id, preset_name) VALUES (${presetId}, ${presetName})`;
      }

      // Insert all stage rows sequentially
      for (let i = 0; i < stages.length; i++) {
        const stg = stages[i];
        await sql`
          INSERT INTO preset_stages (preset_id, stage_name, stage_order, days_offset)
          VALUES (${presetId}, ${stg.stageName}, ${i + 1}, ${parseInt(stg.daysOffset, 10)})
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
