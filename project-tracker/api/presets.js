import { sql } from '@neondatabase/serverless';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const presets = await sql`SELECT * FROM presets ORDER BY created_at DESC`;
      const stages = await sql`SELECT * FROM preset_stages ORDER BY stage_order ASC`;

      const result = presets.map(p => ({
        presetId: p.preset_id,
        presetName: p.preset_name,
        stages: stages
          .filter(s => s.preset_id === p.preset_id)
          .map(s => ({ stageName: s.stage_name, stageOrder: s.stage_order, daysOffset: s.days_offset }))
      }));

      return res.status(200).json(result);
    } 
    
    if (req.method === 'POST') {
      const { presetName, stages, existingPresetId } = req.body;
      const presetId = existingPresetId || `PRST_${Math.random().toString(36).substring(2, 10)}`;

      if (existingPresetId) {
        await sql`DELETE FROM preset_stages WHERE preset_id = ${existingPresetId}`;
        await sql`UPDATE presets SET preset_name = ${presetName} WHERE preset_id = ${existingPresetId}`;
      } else {
        await sql`INSERT INTO presets (preset_id, preset_name) VALUES (${presetId}, ${presetName})`;
      }

      for (let idx = 0; idx < stages.length; idx++) {
        const stg = stages[idx];
        await sql`
          INSERT INTO preset_stages (preset_id, stage_name, stage_order, days_offset)
          VALUES (${presetId}, ${stg.stageName}, ${idx + 1}, ${parseInt(stg.daysOffset, 10)})
        `;
      }

      return res.status(200).json({ success: true, presetId });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}