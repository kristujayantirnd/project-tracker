import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  try {
    const sql = neon(process.env.POSTGRES_URL || process.env.DATABASE_URL);

    if (req.method === 'GET') {
      const projects = await sql`SELECT * FROM projects ORDER BY created_at DESC`;
      return res.status(200).json(projects.map(p => ({
        projectId: p.project_id,
        projectName: p.project_name,
        startDate: new Date(p.start_date).toISOString().split('T')[0],
        presetId: p.preset_id,
        status: p.status
      })));
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) {}
      }

      const { projectName, startDateStr, presetId } = body || {};
      const projectId = `PRJ_${Math.random().toString(36).substring(2, 10)}`;

      await sql`
        INSERT INTO projects (project_id, project_name, start_date, preset_id, status)
        VALUES (${projectId}, ${projectName}, ${startDateStr}, ${presetId}, 'Active')
      `;

      const presetStages = await sql`SELECT * FROM preset_stages WHERE preset_id = ${presetId} ORDER BY stage_order ASC`;
      const baseDate = new Date(startDateStr);

      for (const stg of presetStages) {
        const calcDueDate = new Date(baseDate);
        calcDueDate.setDate(calcDueDate.getDate() + stg.days_offset);
        const dueDateStr = calcDueDate.toISOString().split('T')[0];

        await sql`
          INSERT INTO project_stages (project_id, stage_name, stage_order, calculated_due_date, is_completed, remarks)
          VALUES (${projectId}, ${stg.stage_name}, ${stg.stage_order}, ${dueDateStr}, FALSE, '')
        `;
      }

      return res.status(200).json({ success: true, projectId });
    }

    if (req.method === 'PUT') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) {}
      }

      const { projectId, newStartDateStr } = body || {};
      await sql`UPDATE projects SET start_date = ${newStartDateStr} WHERE project_id = ${projectId}`;

      const proj = await sql`SELECT * FROM projects WHERE project_id = ${projectId}`;
      if (proj.length > 0 && proj[0].preset_id) {
        const presetStages = await sql`SELECT * FROM preset_stages WHERE preset_id = ${proj[0].preset_id}`;
        const baseDate = new Date(newStartDateStr);

        for (const stg of presetStages) {
          const calcDueDate = new Date(baseDate);
          calcDueDate.setDate(calcDueDate.getDate() + stg.days_offset);
          const dueDateStr = calcDueDate.toISOString().split('T')[0];

          await sql`
            UPDATE project_stages 
            SET calculated_due_date = ${dueDateStr} 
            WHERE project_id = ${projectId} AND stage_order = ${stg.stage_order}
          `;
        }
      }

      return res.status(200).json({ success: true });
    }
  } catch (error) {
    console.error('Projects API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
